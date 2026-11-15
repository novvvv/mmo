// 로그인과 입장: 가입·로그인(비밀번호 해시는 작업 스레드), 이어 들어오기 표, 캐릭터를 정하고 입장, 계정에 저장, 퇴장.
#include "core/rules.hpp"

void Game::authError(ConnId id, const std::string& message) {
    server_.send(id, "{\"t\":\"auth\",\"ok\":false,\"m\":\"" + text::jsonEscape(message) + "\"}");
}

bool Game::allowSignup(const std::string& ip) {
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

void Game::beginAuth(const std::string& ip) {
    ++authInFlight_;
    ++authByIp_[ip];
}

void Game::endAuth(const std::string& ip) {
    --authInFlight_;
    const auto it = authByIp_.find(ip);
    if (it != authByIp_.end() && --it->second <= 0) authByIp_.erase(it);
}

void Game::login(ConnId id, const std::string& arg) {
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

void Game::finishSignup(ConnId id, const std::string& ip, const std::string& username, const std::string& saltHex,
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

void Game::finishVerify(ConnId id, const std::string& ip, const std::string& username, bool matched) {
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

void Game::completeLogin(ConnId id, Account& account, bool isNew) {
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

void Game::logout(ConnId id) {
    const auto sessionIt = sessions_.find(id);
    if (sessionIt == sessions_.end()) return;
    const std::string accountId = sessionIt->second.account;
    sessionIt->second.account.clear();

    const auto playerIt = players_.find(id);
    if (playerIt != players_.end()) {
        endTrade(id, playerIt->second, playerIt->second.name + "님이 접속을 끊어 교환이 취소되었습니다.");
        removeFromDarts(id);
        removeFromOmok(id);   // 두던 오목은 기권으로 지고, 그 기록까지 함께 저장한다
        removeFromArcade(id);
        syncAccount(playerIt->second);
        const std::string name = playerIt->second.name;
        const bool hadBoard = playerIt->second.boardOn;
        const int leftZone = playerIt->second.zone;
        std::cout << "[leave] #" << id << " " << name << " (online: " << players_.size() - 1 << ")" << std::endl;
        players_.erase(playerIt);
        endShareBy(id, leftZone);
        sendToAll(systemMessage(name + "님이 퇴장했습니다."));
        if (hadBoard) sendToAll(boardJson(id, "", 0));
        for (auto& entry : players_) {   // 동거인들의 목록에서 접속 표시를 끈다
            if (std::find(entry.second.mates.begin(), entry.second.mates.end(), accountId) != entry.second.mates.end()) sendMates(entry.first, entry.second);
        }
        notifyFriends(accountId);
    }
    const auto online = online_.find(accountId);
    if (online != online_.end() && online->second == id) online_.erase(online);
    // 모으는 중이면 모임에서 빠지고, 타이머가 도는 중이면 자리를 남겨 다시 들어왔을 때 이어 간다
    if (FocusRoom* room = focusOf(accountId)) {
        if (room->running) sendFocus(*room);
        else leaveFocus(accountId, nickOf(accountId));
    }
}

void Game::loadResumeKey() {
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
std::string Game::resumeToken(const std::string& account, long expires) const {
    const std::string body = crypto::toHex(account) + "." + std::to_string(expires);
    return body + "." + crypto::toHex(crypto::pbkdf2Sha256(resumeKey_, body, 1));
}

void Game::resume(ConnId id, const std::string& arg) {
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

void Game::join(ConnId id, const std::string& arg) {
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

    Player p;
    p.account = account->id;
    p.name = text::sanitizeName(nick);
    p.rgb = rgb;
    p.arms = clampInt(arms, 0, 2);
    p.legs = clampInt(legs, 0, 2);
    p.limbColor = clampInt(limbColor, 0, 2);
    p.chatTokens = kChatBurst;
    p.lightTokens = kLightBurst;
    p.noteTokens = kNoteBurst;
    p.tvTokens = kTvBurst;
    p.pachiTokens = kPachiBurst;
    p.extTokens = kExteriorBurst;
    std::copy(std::begin(account->caught), std::end(account->caught), std::begin(p.caught));
    std::copy(std::begin(account->loot), std::end(account->loot), std::begin(p.loot));
    std::copy(std::begin(account->shop), std::end(account->shop), std::begin(p.shop));
    std::copy(std::begin(account->furn), std::end(account->furn), std::begin(p.furn));
    p.dye = std::clamp(account->dye, 0, kMaxDye);
    p.dyed = parseDyed(account->dyed);
    p.boardStyle = clampInt(account->boardStyle, 0, 1);
    p.pets = account->pets & ((1 << decor::kPetKinds) - 1);
    p.emotes = account->emotes & ((1 << decor::kEmoteKinds) - 1);
    p.floorsOwned = account->floorsOwned & ((1 << decor::kFloorKinds) - 1);
    {
        std::istringstream stats(account->stats);
        std::string value;
        for (int i = 0; i < kStatCount && std::getline(stats, value, ','); ++i) p.stats[i] = std::max(0, std::atoi(value.c_str()));
    }
    {
        std::istringstream mates(account->mates);
        std::string mate;
        while (std::getline(mates, mate, ',') && p.mates.size() < kMaxMates) if (!mate.empty() && mate != account->id) p.mates.push_back(mate);
    }
    for (const std::string& other : splitList(account->friends)) {
        if (other != account->id && p.friends.size() < kMaxFriends && std::find(p.friends.begin(), p.friends.end(), other) == p.friends.end()) p.friends.push_back(other);
    }
    for (const std::string& other : splitList(account->friendReq)) {
        if (other != account->id && p.friendReq.size() < kMaxFriendRequests && std::find(p.friendReq.begin(), p.friendReq.end(), other) == p.friendReq.end()) p.friendReq.push_back(other);
    }
    p.todo = parseTodo(account->todo);
    p.todoShare = account->todoShare;
    {
        std::istringstream goods(account->goods);
        std::string value;
        for (int i = 0; i < farm::kGoods && std::getline(goods, value, ','); ++i) p.goods[i] = clampInt(std::atol(value.c_str()), 0, farm::kMaxGoods);
    }
    p.eggAt = account->eggAt;
    p.milkAt = account->milkAt;
    p.pet = account->pet >= 0 && account->pet < decor::kPetKinds && (p.pets & (1 << account->pet)) ? account->pet : -1;
    p.gold = account->gold;
    p.actionTokens = kActionBurst;
    p.hp = kMaxHp;
    p.boardText = text::sanitize(account->boardText, kMaxBoardChars);
    p.boardOn = account->boardOn && !p.boardText.empty();
    placePlayer(p, *account);
    p.dirty = true;
    const std::string name = p.name;
    auto& placed = players_.emplace(id, std::move(p)).first->second;
    syncAccount(placed);

    std::ostringstream welcome;
    welcome << "{\"t\":\"welcome\",\"id\":" << id << ",\"w\":" << kWorldW << ",\"h\":" << kWorldH
            << ",\"speed\":" << kSpeed << ",\"tick\":" << kTickRate
            << ",\"catMs\":" << (kCatBroadcastTicks * 1000 / kTickRate) << ",\"c\":[";
    for (int i = 0; i < kFishKinds; ++i) welcome << (i ? "," : "") << placed.caught[i];
    welcome << "],\"l\":" << lootCounts(placed) << ",\"hp\":" << placed.hp << ",\"maxHp\":" << kMaxHp
            << ",\"pachiCost\":" << kPachiCost << ",\"f\":" << countsJson(placed.furn, kDecorKinds) << ",\"fd\":" << dyedJson(placed) << ",\"dye\":" << placed.dye << ",\"pets\":" << placed.pets << ",\"em\":" << placed.emotes << ",\"pet\":" << placed.pet << ",\"freed\":" << freedPetsJson(placed.account) << ",\"floors\":" << placed.floorsOwned << ",\"s\":" << countsJson(placed.shop, kShopKinds) << ",\"g\":" << placed.gold << "}";
    server_.send(id, welcome.str());
    server_.send(id, world_.mapJson());
    server_.send(id, exteriorsJson());
    server_.send(id, timeJson());
    sendMates(id, placed);
    sendFriends(id, placed);
    sendTodo(id, placed);
    sendGoods(id, placed);
    if (FocusRoom* room = focusOf(placed.account)) sendFocus(*room);   // 끊겼다 돌아왔다: 돌던 타이머를 이어 본다
    server_.send(id, guestLastJson());
    notifyFriends(placed.account);   // 접속한 것을 친구들의 목록에 알린다
    for (auto& entry : players_) {   // 접속한 것을 동거인들의 목록에 알린다
        if (entry.first != id && std::find(entry.second.mates.begin(), entry.second.mates.end(), placed.account) != entry.second.mates.end()) sendMates(entry.first, entry.second);
    }

    char zoneJson[96];
    std::snprintf(zoneJson, sizeof(zoneJson), "{\"t\":\"zone\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", placed.zone, placed.x, placed.y);
    server_.send(id, zoneJson);
    sendRoomStateOnEntry(id, placed.zone);
    server_.send(id, myBoardJson(placed));
    server_.send(id, boardsJson());

    std::cout << "[join]  #" << id << " " << name << " (online: " << players_.size() << ")" << std::endl;
    sendToAll(systemMessage(name + "님이 입장했습니다."));
    if (placed.boardOn) sendToAll(boardJson(id, placed.boardText, placed.boardStyle));
}

void Game::placePlayer(Player& p, const Account& account) {
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
    if (x >= 0.f && world_.standable(zone, x, y)) {
        p.zone = zone;
        p.x = x;
        p.y = y;
        return;
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

void Game::syncAccount(Player& p) {
    Account* account = accounts_.find(p.account);
    if (!account) return;
    account->nick = p.name;
    account->rgb = p.rgb;
    account->arms = p.arms;
    account->legs = p.legs;
    account->limbColor = p.limbColor;
    std::copy(std::begin(p.caught), std::end(p.caught), std::begin(account->caught));
    std::copy(std::begin(p.loot), std::end(p.loot), std::begin(account->loot));
    std::copy(std::begin(p.shop), std::end(p.shop), std::begin(account->shop));
    std::copy(std::begin(p.furn), std::end(p.furn), std::begin(account->furn));
    account->dye = p.dye;
    account->dyed = formatDyed(p.dyed);
    account->boardStyle = p.boardStyle;
    account->pets = p.pets;
    account->emotes = p.emotes;
    account->goods.clear();
    for (int i = 0; i < farm::kGoods; ++i) account->goods += (i ? "," : "") + std::to_string(p.goods[i]);
    account->eggAt = p.eggAt;
    account->milkAt = p.milkAt;
    account->pet = p.pet;
    account->floorsOwned = p.floorsOwned;
    account->stats.clear();
    for (int i = 0; i < kStatCount; ++i) account->stats += (i ? "," : "") + std::to_string(p.stats[i]);
    account->mates.clear();
    for (const std::string& mate : p.mates) account->mates += (account->mates.empty() ? "" : ",") + mate;
    account->friends = joinList(p.friends);
    account->friendReq = joinList(p.friendReq);
    account->todo = formatTodo(p.todo);
    account->todoShare = p.todoShare;
    account->gold = p.gold;
    account->boardOn = p.boardOn;
    account->boardText = p.boardText;
    account->zone = p.zone;
    account->x = p.x;
    account->y = p.y;
    account->mapVersion = kMapVersion;
    if (p.seat >= 0 && world_.seats()[static_cast<size_t>(p.seat)].lie) {   // 침대 안은 다시 설 수 없는 곳이다
        account->x = world_.seats()[static_cast<size_t>(p.seat)].exitX;
        account->y = world_.seats()[static_cast<size_t>(p.seat)].exitY;
    }
    p.dirty = false;
    persist(*account);
}

void Game::persist(const Account& account) {
    std::string path = accounts_.pathFor(account.id);
    std::string content = AccountStore::serialize(account);
    worker_.post([path = std::move(path), content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}
