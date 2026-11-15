// 낚시: 던지기, 입질, 낚아채기. 어종은 서버가 정한다.
#include "core/rules.hpp"

void Game::useRod(ConnId id, Player& p) {
    switch (p.fish) {
        case FishState::Idle: cast(id, p); break;
        case FishState::Waiting: p.fish = FishState::Idle; break;  // 입질 전에 거두기
        case FishState::Bite: reelIn(id, p); break;
    }
}

void Game::cast(ConnId id, Player& p) {
    const River& river = world_.river();
    if (p.zone != 0 || river.distanceToWater(p.x, p.y) > kFishReach) {
        server_.send(id, systemMessage("물가에서만 낚시할 수 있습니다."));
        return;
    }
    std::uniform_real_distribution<float> jitter(-24.f, 24.f);
    std::uniform_real_distribution<float> distance(40.f, 90.f);
    std::uniform_real_distribution<float> wait(kBiteMinSec, kBiteMaxSec);

    float bx = std::clamp(p.x + jitter(rng_), 8.f, kWorldW - 8.f);
    float by = 0.f;
    if (river.overWater(p.x, p.y)) {  // 다리 위: 바라보는 쪽 수면으로
        bx = p.faceX < 0.f ? kBridgeL - distance(rng_) : kBridgeR + distance(rng_);
        by = std::clamp(p.y + jitter(rng_), river.top(bx) + 24.f, river.bottom(bx) - 24.f);
    } else {
        if (bx > kBridgeL - 30.f && bx < kBridgeR + 30.f)  // 다리 위에는 찌를 띄우지 않는다
            bx = p.x < (kBridgeL + kBridgeR) / 2.f ? kBridgeL - 30.f : kBridgeR + 30.f;
        by = p.y < river.top(p.x) ? river.top(bx) + distance(rng_) : river.bottom(bx) - distance(rng_);
    }
    p.bobberX = bx;
    p.bobberY = by;
    p.fish = FishState::Waiting;
    p.fishTimer = wait(rng_);
}

void Game::reelIn(ConnId id, Player& p) {
    p.fish = FishState::Idle;
    const int kind = fishKind_(rng_);
    ++p.caught[kind];
    ++p.stats[kFishCaught];
    p.dirty = true;

    std::string json = "{\"t\":\"catch\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) +
                       "\",\"k\":" + std::to_string(kind) + ",\"c\":[";
    for (int i = 0; i < kFishKinds; ++i) {
        if (i > 0) json += ',';
        json += std::to_string(p.caught[i]);
    }
    json += "]}";
    sendToAll(json);
}

void Game::updateFishing(ConnId id, Player& p, float dt) {
    if (p.fish == FishState::Idle) return;
    p.fishTimer -= dt;
    if (p.fishTimer > 0.f) return;
    if (p.fish == FishState::Waiting) {
        p.fish = FishState::Bite;
        p.fishTimer = kBiteWindowSec;
    } else {
        p.fish = FishState::Idle;
        server_.send(id, systemMessage("물고기가 달아났습니다."));
    }
}
