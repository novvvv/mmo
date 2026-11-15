// 게임의 중심: 만들 때 저장된 월드를 읽고, 메시지를 명령별로 나눠 보내고, 틱마다 모든 것을 진행한다.
// 명령을 처리하는 함수는 core/ 의 다른 파일과 home/, activity/, social/ 에 있다.
#include "core/rules.hpp"

Game::Game(WsServer& server, AccountStore& accounts, Worker& worker, const GameConfig& config)
    : server_(server), accounts_(accounts), worker_(worker), config_(config), rng_(std::random_device{}()) {
    placeCats();
    loadResumeKey();
    loadExteriors();
    loadJazz();
    loadExpansions();
    loadGuestbook();
    loadFarm();
    loadDecor();
    loadPets();
    seedDecor();
    floors_.assign(static_cast<size_t>(world_.zoneCount()), 0);
    floorTints_.assign(static_cast<size_t>(world_.zoneCount()), std::string());
    loadFloors();
    lights_.resize(static_cast<size_t>(world_.zoneCount()));
    for (int zone = 0; zone < world_.zoneCount(); ++zone) lights_[static_cast<size_t>(zone)].level = world_.zone(zone).lightLevel;
    tvs_.resize(static_cast<size_t>(world_.zoneCount()));
}

void Game::onMessage(ConnId id, const std::string& msg) {
    const auto sp = msg.find(' ');
    const std::string cmd = msg.substr(0, sp);
    const std::string arg = (sp == std::string::npos) ? "" : msg.substr(sp + 1);

    if (cmd == "login") {
        login(id, arg);
        return;
    }
    if (cmd == "resume") {
        resume(id, arg);
        return;
    }
    if (cmd == "join") {
        join(id, arg);
        return;
    }
    auto it = players_.find(id);
    if (it == players_.end()) return;
    Player& p = it->second;

    if (cmd == "in") {
        setInput(p, static_cast<uint8_t>(std::strtol(arg.c_str(), nullptr, 10) & 0x0F));
    } else if (cmd == "chat") {
        chat(id, p, arg);
    } else if (cmd == "board") {
        setBoard(id, p, arg);
    } else if (cmd == "light") {
        setLight(id, p, arg);
    } else if (cmd == "note") {
        playNote(id, p, arg);
    } else if (cmd == "tv") {
        controlTv(id, p, arg);
    } else if (cmd == "rtc") {
        relayRtc(id, p, arg);
    } else if (cmd == "pachi") {
        pachinkoCommand(id, p, arg);
    } else if (cmd == "ext") {
        exteriorCommand(id, p, arg);
    } else if (cmd == "drop") {
        dropItem(id, p, arg);
    } else if (cmd == "eat") {
        eatItem(id, p, arg);
    } else if (cmd == "buy") {
        buyItem(id, p, arg);
    } else if (cmd == "trade") {
        tradeCommand(id, p, arg);
    } else if (cmd == "jazz") {
        jazzCommand(id, p, arg);
    } else if (cmd == "dart") {
        dartCommand(id, p, arg);
    } else if (cmd == "decor") {
        decorCommand(id, p, arg);
    } else if (cmd == "floor") {
        floorCommand(id, p, arg);
    } else if (cmd == "expand") {
        expandCommand(id, p, arg);
    } else if (cmd == "arcade") {
        arcadeCommand(id, p, arg);
    } else if (cmd == "visit") {
        visitHouse(id, p, arg);
    } else if (cmd == "boardstyle") {
        setBoardStyle(id, p, arg);
    } else if (cmd == "stats") {
        statsCommand(id, p, arg);
    } else if (cmd == "mate") {
        mateCommand(id, p, arg);
    } else if (cmd == "friend") {
        friendCommand(id, p, arg);
    } else if (cmd == "todo") {
        todoCommand(id, p, arg);
    } else if (cmd == "focus") {
        focusCommand(id, p, arg);
    } else if (cmd == "farm") {
        farmCommand(id, p, arg);
    } else if (cmd == "garden") {
        gardenCommand(id, p, arg);
    } else if (cmd == "cook") {
        cookCommand(id, p, arg);
    } else if (cmd == "guest") {
        guestCommand(id, p, arg);
    } else if (cmd == "omok") {
        omokCommand(id, p, arg);
    } else if (cmd == "releasepet") {
        releasePet(id, p, arg);
    } else if (cmd == "callpet") {
        callPet(id, p, arg);
    } else if (cmd == "buyemote") {
        buyEmote(id, p, arg);
    } else if (cmd == "buypet") {
        buyPet(id, p, arg);
    } else if (cmd == "walkpet") {
        walkPet(id, p, arg);
    } else if (cmd == "use") {
        use(id, p, arg);
    } else if (cmd == "lamp") {
        tryLamp(id, p);
    } else if (cmd == "fish") {
        useRod(id, p);
    } else if (cmd == "pet") {
        petCat(id, p);
    } else if (cmd == "feed") {
        feedCat(id, p);
    }
}

void Game::onClose(ConnId id) {
    logout(id);
    sessions_.erase(id);
}

void Game::tick(float dt) {
    clock_ += dt;
    for (auto& entry : players_) {
        Player& p = entry.second;
        p.chatTokens = std::min(kChatBurst, p.chatTokens + kChatRefillPerSec * dt);
        p.lightTokens = std::min(kLightBurst, p.lightTokens + kLightRefillPerSec * dt);
        p.noteTokens = std::min(kNoteBurst, p.noteTokens + kNoteRefillPerSec * dt);
        p.tvTokens = std::min(kTvBurst, p.tvTokens + kTvRefillPerSec * dt);
        p.pachiTokens = std::min(kPachiBurst, p.pachiTokens + kPachiRefillPerSec * dt);
        p.extTokens = std::min(kExteriorBurst, p.extTokens + 1.f * dt);
        p.actionTokens = std::min(kActionBurst, p.actionTokens + kActionRefillPerSec * dt);
        updateRest(entry.first, p, dt);
        p.playCarry += dt;
        if (p.playCarry >= 1.f) {   // 접속 시간은 초 단위로 센다 (저장할 때 함께 남는다)
            p.stats[kPlaySeconds] += static_cast<int>(p.playCarry);
            p.playCarry -= static_cast<float>(static_cast<int>(p.playCarry));
        }
        p.catCooldown = std::max(0.f, p.catCooldown - dt);
        updateFishing(entry.first, p, dt);
        if (p.seat >= 0 || p.fish != FishState::Idle) continue;  // 앉아 있거나 낚시 중이면 제자리

        float dx = 0.f, dy = 0.f;
        if (p.input & kUp) dy -= 1.f;
        if (p.input & kDown) dy += 1.f;
        if (p.input & kLeft) dx -= 1.f;
        if (p.input & kRight) dx += 1.f;
        if (dx == 0.f && dy == 0.f) continue;
        if (dx != 0.f && dy != 0.f) {  // 대각선 이동 속도 보정
            dx *= 0.70710678f;
            dy *= 0.70710678f;
        }
        if (dx != 0.f) p.faceX = dx;
        const Zone& zone = world_.zone(p.zone);
        world_.move(p.zone, p.x, p.y, std::clamp(p.x + dx * kSpeed * dt, zone.minX + kRadius, zone.w - kRadius),
                    std::clamp(p.y + dy * kSpeed * dt, zone.minY + kRadius, zone.h - kRadius));
        p.dirty = true;
    }
    for (Cat& cat : cats_) updateCat(cat, dt);
    updateDrops(dt);
    updateDarts();
    updateOmok();
    updateArcade();
    updateFocus();
    ++tickCount_;
    broadcastState();
    for (auto it = delayed_.begin(); it != delayed_.end();) {
        if (it->at > clock_) {
            ++it;
            continue;
        }
        sendToZone(it->zone, it->json);
        it = delayed_.erase(it);
    }

    if (++catTicks_ >= kCatBroadcastTicks) {
        catTicks_ = 0;
        broadcastCats();
    }
    timeSyncTimer_ += dt;
    if (timeSyncTimer_ >= kTimeSyncSec) {
        timeSyncTimer_ = 0.f;
        sendToAll(timeJson());
    }
    autosaveTimer_ += dt;
    if (autosaveTimer_ >= kAutosaveSec) {
        autosaveTimer_ = 0.f;
        for (auto& entry : players_) {
            if (!entry.second.dirty) continue;
            syncAccount(entry.second);
        }
    }
}

void Game::saveAll() {
    for (auto& entry : players_) syncAccount(entry.second);
}

bool Game::spendAction(Player& p) {
    if (p.actionTokens < 1.f) return false;
    p.actionTokens -= 1.f;
    return true;
}

// 접속 중인 사람이면 그 플레이어를, 아니면 nullptr
Game::Player* Game::onlinePlayer(const std::string& account, ConnId* idOut) {
    for (auto& entry : players_) {
        if (entry.second.account != account) continue;
        if (idOut) *idOut = entry.first;
        return &entry.second;
    }
    return nullptr;
}
