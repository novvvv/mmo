// 플레이어에 붙은 콘텐츠: 쉬면 받는 골드, 미니홈피 이동, 상태창 기록. 이동과 문, 앉기는 core(server-core)가 맡는다.
#include "game/rules.hpp"

// 의자나 침대에 앉아 쉬면 1분마다 1골드. 일어나면 처음부터 센다.
void Game::updateRest(ConnId id, Player& p, float dt) {
    if (p.seat < 0) {
        p.restSeconds = 0.f;
        return;
    }
    p.restSeconds += dt;
    const float period = static_cast<float>(std::max(1.0, config_.restSec));
    if (p.restSeconds < period) return;
    p.restSeconds -= period;
    p.gold += kRestGold;
    p.dirty = true;
    sendInventory(id, p);
}

// "<구역>": 마을을 걷지 않고 집 안으로 바로 간다. 집 문 안쪽에 선다.
void Game::visitHouse(ConnId id, Player& p, const std::string& arg) {
    long zone = -1;
    if (!parseWhole(arg.c_str(), zone) || !isHouseZone(static_cast<int>(zone)) || zone == p.zone || !spendAction(p)) return;
    const Zone& room = world_.zone(static_cast<int>(zone));
    moveToZone(id, p, static_cast<int>(zone), room.doorX, room.doorY - 40.f);
}

// 접속 중인 사람의 기록을 하나 늘린다. 다음 저장 때 계정에 남는다.
void Game::addStat(ConnId id, int stat, int amount) {
    const auto it = players_.find(id);
    if (it == players_.end()) return;
    it->second.stats[stat] += amount;
    it->second.dirty = true;
}

// "<연결 번호>" 또는 빈 값(나): 그 사람의 상태창. 골드와 소지품 수는 자기 것만 보인다.
void Game::statsCommand(ConnId id, Player& p, const std::string& arg) {
    long target = 0;
    if (!arg.empty() && !parseWhole(arg.c_str(), target)) return;
    if (!spendAction(p)) return;
    const ConnId who = target > 0 ? static_cast<ConnId>(target) : id;
    const auto it = players_.find(who);
    if (it == players_.end()) return;
    const Player& other = it->second;
    const bool self = who == id;
    int placed = 0;
    for (const Decor& item : decor_) if (item.owner == other.account) ++placed;
    int pets = 0;
    for (int i = 0; i < decor::kPetKinds; ++i) if (other.pets & (1 << i)) ++pets;
    char head[160];
    std::snprintf(head, sizeof(head), "{\"t\":\"stats\",\"id\":%u,\"self\":%s,\"c\":\"#%06x\",\"a\":%d,\"n\":\"", who, self ? "true" : "false",
                  static_cast<unsigned>(other.rgb), other.arms + other.legs * 3 + other.limbColor * 9);
    std::string json = head + text::jsonEscape(other.name) + "\",\"s\":[";
    for (int i = 0; i < kStatCount; ++i) json += (i ? "," : "") + std::to_string(other.stats[i]);
    json += "],\"placed\":" + std::to_string(placed) + ",\"pets\":" + std::to_string(pets) + ",\"mates\":" + std::to_string(other.mates.size());
    if (self) {
        int furn = static_cast<int>(other.dyed.size());
        for (int i = 0; i < kDecorKinds; ++i) furn += other.furn[i];
        json += ",\"g\":" + std::to_string(other.gold) + ",\"furn\":" + std::to_string(furn);
    }
    server_.send(id, json + "}");
}
