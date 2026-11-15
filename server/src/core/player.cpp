// 플레이어의 기본 행동: 이동 입력, E(문과 자리), 구역 옮기기, 앉기와 일어나기, 쉬면 받는 골드, 미니홈피 이동, 상태창 기록.
#include "core/rules.hpp"

// 새 키를 누르면 앉기와 낚시를 끝낸다. 누르고 있던 키를 떼는 것만으로는 끝나지 않는다.
void Game::setInput(Player& p, uint8_t mask) {
    const bool pressed = (mask & ~p.input) != 0;
    p.input = mask;
    if (pressed) {
        p.fish = FishState::Idle;
        standUp(p);
    }
}

// E 키: 문 앞이면 문을 쓰고, 스탠드 앞이면 켜거나 끄고, 아니면 앉거나 일어난다.
// E: "door" 는 문만, "sit" 은 앉기와 일어나기만. 클라이언트가 가장 가까운 것을 골라 보낸다.
// 아무것도 붙이지 않으면 문을 먼저 보고 아니면 앉는다. 스탠드는 따로 "lamp" 로 켜고 끈다.
void Game::use(ConnId id, Player& p, const std::string& arg) {
    if (arg == "door") {
        if (p.seat < 0) tryDoor(id, p);
        return;
    }
    if (arg.empty() && p.seat < 0 && tryDoor(id, p)) return;
    if (arg.empty() || arg == "sit") toggleSit(p);
}

bool Game::tryDoor(ConnId id, Player& p) {
    // 지금 있는 구역에 문이 난 건물로 들어간다: 마을의 건물들, 극장 안의 특별관
    for (const Building& building : world_.buildings()) {
        if (building.room < 0 || building.outside != p.zone) continue;
        if (std::hypot(building.doorX - p.x, building.doorY - p.y) > kDoorReach) continue;
        const Zone& room = world_.zone(building.room);
        moveToZone(id, p, building.room, room.doorX, room.doorY - 40.f);
        return true;
    }
    if (p.zone == 0) return false;
    const Zone& room = world_.zone(p.zone);
    if (std::hypot(room.doorX - p.x, room.doorY - p.y) > kDoorReach + 8.f) return false;
    const Building& building = world_.buildings()[static_cast<size_t>(room.building)];
    moveToZone(id, p, building.outside, building.doorX, building.doorY + 24.f);   // 그 문이 나 있던 곳으로 나간다
    return true;
}

void Game::moveToZone(ConnId id, Player& p, int zone, float x, float y) {
    endTrade(id, p, "구역을 옮겨 교환이 취소되었습니다.");
    const bool moved = zone != p.zone;
    if (moved) {  // 다른 방으로 가면 그 방의 다트와 오목에서 빠진다
        removeFromDarts(id);
        removeFromOmok(id);
        removeFromArcade(id);
    }
    const int left = p.zone;
    p.zone = zone;
    p.x = x;
    p.y = y;
    p.seat = -1;
    p.fish = FishState::Idle;
    p.cooking = -1;
    p.dirty = true;
    char json[96];
    std::snprintf(json, sizeof(json), "{\"t\":\"zone\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", zone, x, y);
    server_.send(id, json);
    if (moved) endShareBy(id, left);   // 나간 뒤에 알려 남은 사람들에게만 간다
    sendRoomStateOnEntry(id, zone);
    if (moved) notifyFriends(p.account);   // 친구 목록의 있는 곳을 바꾼다
}

// 침대에서 일어나면 침대 앞에 선다. 앞이 막혔으면 그 자리에서 걸어 나올 수 있다.
void Game::standUp(Player& p) {
    if (p.seat < 0) return;
    const Seat& seat = world_.seats()[static_cast<size_t>(p.seat)];
    if (seat.lie && world_.standable(p.zone, seat.exitX, seat.exitY)) {
        p.x = seat.exitX;
        p.y = seat.exitY;
        p.dirty = true;
    }
    p.seat = -1;
}

bool Game::seatTaken(int seat) const {
    return std::any_of(players_.begin(), players_.end(), [seat](const auto& entry) { return entry.second.seat == seat; });
}

// 가장 가까운 빈자리에 앉는다. 벤치 한쪽에 누가 있으면 남은 쪽에 앉게 된다.
void Game::toggleSit(Player& p) {
    if (p.seat >= 0) {
        standUp(p);
        p.fish = FishState::Idle;
        return;
    }
    const auto& seats = world_.seats();
    int best = -1;
    float bestDist = kBedReach;
    for (int i = 0; i < static_cast<int>(seats.size()); ++i) {
        const Seat& seat = seats[static_cast<size_t>(i)];
        if (seat.zone != p.zone) continue;
        const float dist = std::hypot(seat.x - p.x, seat.y - p.y);
        if (dist <= (seat.lie ? kBedReach : kChairReach) && dist <= bestDist && !seatTaken(i)) {
            best = i;
            bestDist = dist;
        }
    }
    if (best < 0) return;
    p.fish = FishState::Idle;
    p.seat = best;
    p.x = seats[static_cast<size_t>(best)].x;
    p.y = seats[static_cast<size_t>(best)].y;
    p.dirty = true;
}

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
