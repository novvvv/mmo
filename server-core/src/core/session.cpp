// 로그인과 입장: 가입·로그인(비밀번호 해시는 작업 스레드), 이어 들어오기 표, 캐릭터를 정하고 입장, 계정에 저장, 퇴장.
// 입장과 퇴장 사이사이에서 모듈을 부른다 (module.hpp 의 JoinStep, LeaveStep).
#include "core/rules.hpp"

void Core::authError(ConnId id, const std::string& message) {
    server_.send(id, "{\"t\":\"auth\",\"ok\":false,\"m\":\"" + text::jsonEscape(message) + "\"}");
}

bool Core::allowSignup(const std::string& ip) {
    if (accounts_.size() >= kMaxAccounts) return false;
    if (signups_.size() > kMaxSignupWindows) signups_.clear();
    SignupWindow& window = signups_[ip];
    if (clock_ - window.start > kSignupWindowSec) {
        window.start = clock_;
        window.count = 0;
    }
    if (window.count >= config_.signupLimitPerHour) return false;
    ++window.count;
    return true;
}

void Core::beginAuth(const std::string& ip) {
    ++authInFlight_;
    ++authByIp_[ip];
}

void Core::endAuth(const std::string& ip) {
    --authInFlight_;
    const auto it = authByIp_.find(ip);
    if (it != authByIp_.end() && --it->second <= 0) authByIp_.erase(it);
}

void Core::login(ConnId id, const std::string& arg) {
    Session& session = sessions_[id];
    if (!session.account.empty() || session.authPending) return;

    const auto sp = arg.find(' ');
    if (sp == std::string::npos) {
        authError(id, "아이디와 비밀번호를 입력해 주세요.");
        return;
    }
    const std::string username = text::normalizeAccountId(arg.substr(0, sp));
    const std::string password = arg.substr(sp + 1);
    if (username.empty()) {
        authError(id, "아이디는 2~20자의 한글, 영문, 숫자, _, - 만 쓸 수 있습니다.");
        return;
    }
    if (password.size() < kMinPasswordBytes || password.size() > kMaxPasswordBytes) {
        authError(id, "비밀번호는 4자 이상 128자 이하로 입력해 주세요.");
        return;
    }
    const std::string ip = server_.remoteIp(id);
    const auto inFlightForIp = authByIp_.find(ip);
    if (authInFlight_ >= kMaxAuthInFlight || (inFlightForIp != authByIp_.end() && inFlightForIp->second >= config_.authPerIp)) {
        authError(id, "접속이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.");
        return;
    }

    Account* account = accounts_.find(username);
    Worker* worker = &worker_;
    if (account) {
        const auto lock = loginLocks_.find(ip + "|" + username);
        if (lock != loginLocks_.end() && lock->second.lockedUntil > clock_) {
            authError(id, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
            return;
        }
        session.authPending = true;
        beginAuth(ip);
        const std::string salt = crypto::fromHex(account->saltHex);
        const std::string expected = crypto::fromHex(account->hashHex);
        const int iterations = account->iterations;
        worker_.post([this, worker, id, ip, username, password, salt, expected, iterations] {
            if (worker->heavyWorkSkipped()) return;
            const bool matched = crypto::constantTimeEqual(crypto::pbkdf2Sha256(password, salt, iterations), expected);
            worker->finish([this, id, ip, username, matched] { finishVerify(id, ip, username, matched); });
        });
        return;
    }

    if (!allowSignup(ip)) {
        authError(id, "새 계정을 너무 많이 만들었습니다. 나중에 다시 시도해 주세요.");
        return;
    }
    session.authPending = true;
    beginAuth(ip);
    const std::string salt = crypto::randomBytes(16);
    const int iterations = config_.authIterations;
    worker_.post([this, worker, id, ip, username, password, salt, iterations] {
        if (worker->heavyWorkSkipped()) return;
        const std::string hash = crypto::pbkdf2Sha256(password, salt, iterations);
        const std::string saltHex = crypto::toHex(salt);
        const std::string hashHex = crypto::toHex(hash);
        worker->finish([this, id, ip, username, saltHex, iterations, hashHex] {
            finishSignup(id, ip, username, saltHex, iterations, hashHex);
        });
    });
}

void Core::finishSignup(ConnId id, const std::string& ip, const std::string& username, const std::string& saltHex,
                        int iterations, const std::string& hashHex) {
    endAuth(ip);
    const auto it = sessions_.find(id);
    if (it == sessions_.end()) return;  // 그 사이 연결이 끊겼으면 계정을 만들지 않는다
    it->second.authPending = false;
    if (accounts_.find(username)) {  // 같은 아이디로 동시에 가입을 시도한 경우
        authError(id, "다시 시도해 주세요.");
        return;
    }
    Account account;
    account.id = username;
    account.saltHex = saltHex;
    account.hashHex = hashHex;
    account.iterations = iterations;
    Account& stored = accounts_.add(std::move(account));
    persist(stored);
    completeLogin(id, stored, true);
}

void Core::finishVerify(ConnId id, const std::string& ip, const std::string& username, bool matched) {
    endAuth(ip);
    const std::string lockKey = ip + "|" + username;
    if (matched) {
        loginLocks_.erase(lockKey);
    } else {
        if (loginLocks_.size() > kMaxLoginLocks) loginLocks_.clear();
        LoginLock& lock = loginLocks_[lockKey];
        if (++lock.failures >= kLockAfterFailures) {
            lock.failures = 0;
            lock.lockedUntil = clock_ + kLockSec;
        }
    }
    const auto it = sessions_.find(id);
    if (it == sessions_.end()) return;
    Session& session = it->second;
    session.authPending = false;
    Account* account = accounts_.find(username);
    if (!account) {
        authError(id, "다시 시도해 주세요.");
        return;
    }
    if (!matched) {
        authError(id, "비밀번호가 틀렸습니다.");
        if (++session.failures >= kCloseAfterFailures) server_.close(id);
        return;
    }
    completeLogin(id, *account, false);
}

void Core::completeLogin(ConnId id, Account& account, bool isNew) {
    // 한 계정은 한 곳에서만 접속한다. 이전 연결의 진행 상황을 먼저 저장하고 끊는다.
    const auto online = online_.find(account.id);
    if (online != online_.end() && online->second != id) {
        const ConnId previous = online->second;
        server_.send(previous, "{\"t\":\"kick\",\"m\":\"다른 곳에서 로그인하여 연결을 종료했습니다.\"}");
        logout(previous);
        server_.close(previous);
    }
    sessions_[id].account = account.id;
    online_[account.id] = id;

    char look[96];
    std::snprintf(look, sizeof(look), ",\"h\":\"%s\",\"arms\":%d,\"legs\":%d,\"limb\":%d}", rgbToHex(account.rgb).c_str(), account.arms,
                  account.legs, account.limbColor);
    const std::string token = resumeToken(account.id, static_cast<long>(std::time(nullptr)) + kResumeSec);
    server_.send(id, std::string("{\"t\":\"auth\",\"ok\":true,\"new\":") + (isNew ? "true" : "false") + ",\"id\":\"" +
                         text::jsonEscape(account.id) + "\",\"nick\":\"" + text::jsonEscape(account.nick) + "\",\"rt\":\"" + token + "\"" + look);
}

void Core::logout(ConnId id) {
    const auto sessionIt = sessions_.find(id);
    if (sessionIt == sessions_.end()) return;
    const std::string accountId = sessionIt->second.account;
    sessionIt->second.account.clear();

    const auto playerIt = players_.find(id);
    if (playerIt != players_.end()) {
        for (Module* m : modules_) m->onLeave(id, *playerIt->second, LeaveStep::BeforeSave);
        syncAccount(*playerIt->second);
        // 월드에서 빼되, 모듈이 마지막 모습을 볼 수 있게 플레이어는 이 함수가 끝날 때까지 남겨 둔다
        std::unique_ptr<PlayerBase> gone = std::move(playerIt->second);
        players_.erase(playerIt);
        std::cout << "[leave] #" << id << " " << gone->name << " (online: " << players_.size() << ")" << std::endl;
        for (Module* m : modules_) m->onLeave(id, *gone, LeaveStep::Removed);
        sendToAll(systemMessage(gone->name + "님이 퇴장했습니다."));
        for (Module* m : modules_) m->onLeave(id, *gone, LeaveStep::Announced);
    }
    const auto online = online_.find(accountId);
    if (online != online_.end() && online->second == id) online_.erase(online);
    for (Module* m : modules_) m->onLogout(accountId);
}

void Core::loadResumeKey() {
    const std::string path = accounts_.dir() + "/resume.key";
    std::ifstream file(path);
    std::string hex;
    std::getline(file, hex);
    resumeKey_ = crypto::fromHex(hex);
    if (resumeKey_.size() == 32) return;
    resumeKey_ = crypto::randomBytes(32);
    if (!AccountStore::writeAtomic(path, crypto::toHex(resumeKey_) + "\n"))
        std::cerr << "경고: 이어 들어오기 열쇠를 저장하지 못했습니다. 서버를 다시 켜면 모두 비밀번호로 다시 로그인해야 합니다." << std::endl;
}

// "<아이디 16진수>.<만료 유닉스 초>.<서명>". 서명은 반복 1번의 PBKDF2-SHA256, 곧 HMAC-SHA256(열쇠, 앞부분 + 블록 번호) 이다.
std::string Core::resumeToken(const std::string& account, long expires) const {
    const std::string body = crypto::toHex(account) + "." + std::to_string(expires);
    return body + "." + crypto::toHex(crypto::pbkdf2Sha256(resumeKey_, body, 1));
}

void Core::resume(ConnId id, const std::string& arg) {
    Session& session = sessions_[id];
    if (!session.account.empty() || session.authPending) return;
    const auto fail = [&] {
        server_.send(id, "{\"t\":\"auth\",\"ok\":false,\"resume\":true,\"m\":\"다시 로그인해 주세요.\"}");
        if (++session.failures >= kCloseAfterFailures) server_.close(id);
    };
    const auto first = arg.find('.'), second = arg.rfind('.');
    long expires = 0;
    if (arg.size() > 300 || first == std::string::npos || second == first || !parseWhole(arg.substr(first + 1, second - first - 1).c_str(), expires)) return fail();
    const std::string accountId = crypto::fromHex(arg.substr(0, first));
    if (accountId.empty() || expires < static_cast<long>(std::time(nullptr)) || !crypto::constantTimeEqual(resumeToken(accountId, expires), arg)) return fail();
    Account* account = accounts_.find(accountId);
    if (!account) return fail();
    completeLogin(id, *account, false);
}

void Core::join(ConnId id, const std::string& arg) {
    const auto sessionIt = sessions_.find(id);
    if (sessionIt == sessions_.end() || sessionIt->second.account.empty() || players_.count(id)) return;
    Account* account = accounts_.find(sessionIt->second.account);
    if (!account) return;

    // "<색> <팔> <다리> <팔다리 색> <닉네임>"
    std::istringstream in(arg);
    std::string colorText;
    long arms = 0, legs = 0, limbColor = 0;
    if (!(in >> colorText >> arms >> legs >> limbColor)) return;
    const int rgb = parseBodyColor(colorText);
    if (rgb < 0) return;
    std::string nick;
    std::getline(in, nick);

    std::unique_ptr<PlayerBase> made;
    for (Module* m : modules_) {
        if (!made) made = m->makePlayer();
    }
    if (!made) made = std::make_unique<PlayerBase>();
    PlayerBase& p = *made;
    p.account = account->id;
    p.name = text::sanitizeName(nick);
    p.rgb = rgb;
    p.arms = clampInt(arms, 0, 2);
    p.legs = clampInt(legs, 0, 2);
    p.limbColor = clampInt(limbColor, 0, 2);
    p.chatTokens = kChatBurst;
    for (Module* m : modules_) m->loadPlayer(p, *account);
    placePlayer(p, *account);
    p.dirty = true;
    const std::string name = p.name;
    PlayerBase& placed = *players_.emplace(id, std::move(made)).first->second;
    syncAccount(placed);

    std::ostringstream welcome;
    welcome << "{\"t\":\"welcome\",\"id\":" << id << ",\"w\":" << kWorldW << ",\"h\":" << kWorldH << ",\"speed\":" << kSpeed << ",\"tick\":" << kTickRate;
    std::string fields = welcome.str();
    for (Module* m : modules_) m->welcomeFields(placed, fields);
    server_.send(id, fields + "}");
    server_.send(id, world_.mapJson());
    for (Module* m : modules_) m->onJoin(id, placed, JoinStep::AfterMap);
    server_.send(id, timeJson());
    for (Module* m : modules_) m->onJoin(id, placed, JoinStep::AfterTime);

    char zoneJson[96];
    std::snprintf(zoneJson, sizeof(zoneJson), "{\"t\":\"zone\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", placed.zone, placed.x, placed.y);
    server_.send(id, zoneJson);
    enterRoom(id, placed.zone);
    for (Module* m : modules_) m->onJoin(id, placed, JoinStep::AfterRoom);

    std::cout << "[join]  #" << id << " " << name << " (online: " << players_.size() << ")" << std::endl;
    sendToAll(systemMessage(name + "님이 입장했습니다."));
    for (Module* m : modules_) m->onJoin(id, placed, JoinStep::Announced);
}

void Core::placePlayer(PlayerBase& p, const Account& account) {
    int zone = account.zone;
    float x = account.x, y = account.y;
    if (account.mapVersion < 2 && x >= 0.f) {
        // 예전 넓은 마을(2000×2000)에서 저장한 위치: 마을은 강 근처부터 남쪽을 그대로 옮기고, 북쪽 빈 땅이었던 곳은 광장으로 보낸다.
        // 없어진 슬라임 군락지(5)와 왕국(7)에 있던 사람도 광장에서 시작한다. 집, 극장, 재즈바는 그대로다.
        if (zone == 0 && y >= 1000.f) {
            x -= 280.f;
            y -= 480.f;
        } else if (zone == 0 || zone == 5 || zone >= 7) {
            x = -1.f;
        }
    }
    // 저장한 곳에 그새 가구가 놓였거나(침대 앞이 막힌 채 누워 있다 나간 경우 등) 바닥이 줄었으면 같은 구역의 가장 가까운 빈 곳에,
    // 그것도 없으면 그 구역의 문 안쪽에 선다. 마을 광장으로 보내는 것은 구역 자체가 없을 때뿐이다
    if (x >= 0.f && zone >= 0 && zone < world_.zoneCount()) {
        float sx = 0.f, sy = 0.f;
        const Zone& room = world_.zone(zone);
        if (world_.nearestStandable(zone, x, y, kRestoreSearch, sx, sy) ||
            (zone != 0 && world_.nearestStandable(zone, room.doorX, room.doorY - 40.f, kRestoreSearch, sx, sy))) {
            p.zone = zone;
            p.x = sx;
            p.y = sy;
            return;
        }
    }
    // 시작 지점 근처의 빈 땅을 찾는다.
    p.zone = 0;
    std::uniform_real_distribution<float> spawn(-110.f, 110.f);
    for (int attempt = 0; attempt < 64; ++attempt) {
        const float sx = kSpawnX + spawn(rng_);
        const float sy = kSpawnY + spawn(rng_) * 0.6f;
        if (world_.standable(0, sx, sy)) {
            p.x = sx;
            p.y = sy;
            return;
        }
    }
    p.x = kSpawnX;
    p.y = kSpawnY;
}

void Core::syncAccount(PlayerBase& p) {
    Account* account = accounts_.find(p.account);
    if (!account) return;
    account->nick = p.name;
    account->rgb = p.rgb;
    account->arms = p.arms;
    account->legs = p.legs;
    account->limbColor = p.limbColor;
    for (Module* m : modules_) m->savePlayer(p, *account);
    account->zone = p.zone;
    account->x = p.x;
    account->y = p.y;
    account->mapVersion = kMapVersion;
    if (p.seat >= 0 && world_.seats()[static_cast<size_t>(p.seat)].lie) {   // 침대 안은 다시 설 수 없는 곳이다. 앞이 막혔으면 접속할 때 가까운 빈 곳을 찾는다
        account->x = world_.seats()[static_cast<size_t>(p.seat)].exitX;
        account->y = world_.seats()[static_cast<size_t>(p.seat)].exitY;
    }
    p.dirty = false;
    persist(*account);
}

void Core::persist(const Account& account) {
    std::string path = accounts_.pathFor(account.id);
    std::string content = AccountStore::serialize(account);
    worker_.post([path = std::move(path), content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}
