// core 의 중심: 모듈 등록, 명령 나누기, 매 틱 진행(이동, 위치 전송, 시계, 자동 저장).
#include "core/rules.hpp"

Core::Core(WsServer& server, AccountStore& accounts, Worker& worker, const CoreConfig& config)
    : server_(server), accounts_(accounts), worker_(worker), config_(config), rng_(std::random_device{}()) {
    loadResumeKey();
    world_.setExtraJson([this](std::string& json) {
        for (Module* m : modules_) m->mapFields(json);
    });
}

void Core::addModule(Module& module) {
    modules_.push_back(&module);
    module.install(*this);
}

void Core::addCommand(const std::string& name, Command command) {
    commands_[name] = std::move(command);
}

// 모듈이 월드를 다 지은 뒤: 지도를 만든다
void Core::start() {
    world_.publish();
}

void Core::onMessage(ConnId id, const std::string& msg) {
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
    if (it == players_.end()) return;   // 입장하기 전에는 위 셋만 받는다
    PlayerBase& p = *it->second;

    if (cmd == "in") {
        setInput(p, static_cast<uint8_t>(std::strtol(arg.c_str(), nullptr, 10) & 0x0F));
    } else if (cmd == "chat") {
        chat(id, p, arg);
    } else if (cmd == "use") {
        use(id, p, arg);
    } else {
        const auto command = commands_.find(cmd);
        if (command != commands_.end()) command->second(id, p, arg);
    }
}

void Core::onClose(ConnId id) {
    logout(id);
    sessions_.erase(id);
}

void Core::tick(float dt) {
    clock_ += dt;
    for (auto& entry : players_) {
        PlayerBase& p = *entry.second;
        p.chatTokens = std::min(kChatBurst, p.chatTokens + kChatRefillPerSec * dt);
        for (Module* m : modules_) m->onPlayerTick(entry.first, p, dt);
        if (p.seat >= 0 || holdStill(p)) continue;  // 앉아 있거나 붙잡혀 있으면 제자리

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
    for (Module* m : modules_) m->onTick(dt);
    ++tickCount_;
    broadcastState();
    for (Module* m : modules_) m->afterBroadcast(dt);

    timeSyncTimer_ += dt;
    if (timeSyncTimer_ >= kTimeSyncSec) {
        timeSyncTimer_ = 0.f;
        sendToAll(timeJson());
    }
    autosaveTimer_ += dt;
    if (autosaveTimer_ >= kAutosaveSec) {
        autosaveTimer_ = 0.f;
        for (auto& entry : players_) {
            if (!entry.second->dirty) continue;
            syncAccount(*entry.second);
        }
    }
}

void Core::saveAll() {
    for (auto& entry : players_) syncAccount(*entry.second);
}

PlayerBase* Core::player(ConnId id) {
    const auto it = players_.find(id);
    return it == players_.end() ? nullptr : it->second.get();
}

PlayerBase* Core::onlinePlayer(const std::string& account, ConnId* idOut) {
    for (auto& entry : players_) {
        if (entry.second->account != account) continue;
        if (idOut) *idOut = entry.first;
        return entry.second.get();
    }
    return nullptr;
}
