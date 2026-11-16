// 이동과 자리: 방향 입력, E(문과 자리), 구역 옮기기, 앉기와 일어나기.
#include "core/rules.hpp"

// 새 키를 누르면 앉기와 붙잡힌 동작(낚시 같은)을 끝낸다. 누르고 있던 키를 떼는 것만으로는 끝나지 않는다.
void Core::setInput(PlayerBase& p, uint8_t mask) {
    const bool pressed = (mask & ~p.input) != 0;
    p.input = mask;
    if (pressed) {
        cancelHold(p);
        standUp(p);
    }
}

// E: "door" 는 문만, "sit" 은 앉기와 일어나기만. 클라이언트가 가장 가까운 것을 골라 보낸다.
// 아무것도 붙이지 않으면 문을 먼저 보고 아니면 앉는다.
void Core::use(ConnId id, PlayerBase& p, const std::string& arg) {
    if (arg == "door") {
        if (p.seat < 0) tryDoor(id, p);
        return;
    }
    if (arg.empty() && p.seat < 0 && tryDoor(id, p)) return;
    if (arg.empty() || arg == "sit") toggleSit(p);
}

bool Core::tryDoor(ConnId id, PlayerBase& p) {
    // 지금 있는 구역에 문이 난 건물로 들어간다: 마을의 건물들, 다른 건물 안에 난 문
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

void Core::moveToZone(ConnId id, PlayerBase& p, int zone, float x, float y) {
    const int from = p.zone;
    for (Module* m : modules_) m->onZoneChange(id, p, from, zone, ZoneStep::Before);
    p.zone = zone;
    p.x = x;
    p.y = y;
    p.seat = -1;
    cancelHold(p);
    p.dirty = true;
    char json[96];
    std::snprintf(json, sizeof(json), "{\"t\":\"zone\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", zone, x, y);
    server_.send(id, json);
    for (Module* m : modules_) m->onZoneChange(id, p, from, zone, ZoneStep::Sent);
    enterRoom(id, zone);
    for (Module* m : modules_) m->onZoneChange(id, p, from, zone, ZoneStep::Entered);
}

// 침대에서 일어나면 침대 앞에 선다. 앞이 막혔으면 그 자리에서 걸어 나올 수 있다.
void Core::standUp(PlayerBase& p) {
    if (p.seat < 0) return;
    const Seat& seat = world_.seats()[static_cast<size_t>(p.seat)];
    if (seat.lie && world_.standable(p.zone, seat.exitX, seat.exitY)) {
        p.x = seat.exitX;
        p.y = seat.exitY;
        p.dirty = true;
    }
    p.seat = -1;
}

bool Core::seatTaken(int seat) const {
    return std::any_of(players_.begin(), players_.end(), [seat](const auto& entry) { return entry.second->seat == seat; });
}

// 가장 가까운 빈자리에 앉는다. 벤치 한쪽에 누가 있으면 남은 쪽에 앉게 된다.
void Core::toggleSit(PlayerBase& p) {
    if (p.seat >= 0) {
        standUp(p);
        cancelHold(p);
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
    cancelHold(p);
    p.seat = best;
    p.x = seats[static_cast<size_t>(best)].x;
    p.y = seats[static_cast<size_t>(best)].y;
    p.dirty = true;
}

bool Core::holdStill(const PlayerBase& p) const {
    return std::any_of(modules_.begin(), modules_.end(), [&p](const Module* m) { return m->holdStill(p); });
}

void Core::cancelHold(PlayerBase& p) {
    for (Module* m : modules_) m->cancelHold(p);
}
