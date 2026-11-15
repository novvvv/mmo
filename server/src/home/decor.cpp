// 집 꾸미기: 가구 사기, 놓기(집 안과 마당), 치우기, 옮기기, 돌리기, 크기, 염색, 저장.
// 가구 목록과 값은 decor.hpp 에 있다.
#include "core/rules.hpp"

bool Game::isHouseZone(int zone) const {
    if (zone <= 0 || zone >= world_.zoneCount()) return false;
    const int building = world_.zone(zone).building;
    return building >= 0 && world_.buildings()[static_cast<size_t>(building)].kind == "house";
}

// 배치한 가구를 충돌 영역과 자리에 반영한다.
void Game::installDecor(Decor& item) {
    const decor::Kind kind = shapeOf(item);
    if (kind.halfW > 0.f && kind.place != decor::kFlat) world_.addDecorSolid(item.id, item.zone, item.x - kind.halfW, item.y - kind.depth, item.x + kind.halfW, item.y);
    item.seats[0] = item.seats[1] = item.seats[2] = -1;
    for (int i = 0; i < kind.seats && i < 3; ++i) {
        const float mirror = item.flip ? -1.f : 1.f;
        const float ox = (i == 0 ? kind.ax : i == 1 ? kind.bx : kind.cx) * mirror;
        const float oy = i == 0 ? kind.ay : i == 1 ? kind.by : kind.cy;
        const int side = static_cast<int>(mirror) * (kind.seats == 1 ? item.side : kind.seats == 2 ? (i ? 1 : -1) : i - 1);
        Seat seat{item.zone, item.x + ox, item.y + oy, item.faced ? item.faceX * mirror : 0.f, item.faced ? item.faceY : kind.faceY, side};
        if (kind.lie) {
            static constexpr float kHeadX[] = {0.f, -1.f, 0.f, 1.f}, kHeadY[] = {1.f, 0.f, -1.f, 0.f};   // 돌린 침대에서는 누운 방향도 돈다
            seat.faceX = kHeadX[item.rot & 3];
            seat.faceY = kHeadY[item.rot & 3] * kind.faceY;
            seat.lie = true;
            seat.sortY = item.y + 0.5f;
            seat.exitX = seat.x;
            seat.exitY = item.y + kBodyMargin + 8.f;
        }
        item.seats[i] = world_.addDynamicSeat(seat);
    }
}

void Game::uninstallDecor(const Decor& item) {
    world_.removeDecorSolid(item.id);
    for (const int seat : item.seats) {
        if (seat < 0) continue;
        for (auto& entry : players_) {
            if (entry.second.seat == seat) standUp(entry.second);
        }
        world_.removeDynamicSeat(seat);
    }
}

// 배치할 수 없는 이유. 놓을 수 있으면 빈 문자열.
std::string Game::decorProblem(const Player& p, const decor::Kind& kind, float x, float y, bool moving) const {
    const bool garden = std::strncmp(kind.kind, "plot_", 5) == 0 || std::strncmp(kind.kind, "garden_", 7) == 0;
    if (p.zone == 0 && garden) return yardProblem(p, kind, x, y, moving);
    if (!isHouseZone(p.zone)) return garden ? "집 안이나 집 근처 마당에만 놓을 수 있습니다." : "집 안에서만 배치할 수 있습니다.";
    if (!moving && std::count_if(decor_.begin(), decor_.end(), [&p](const Decor& item) { return item.zone == p.zone; }) >= static_cast<long>(kMaxDecorPerZone)) return "이 집에는 가구를 더 놓을 수 없습니다.";
    const Zone& zone = world_.zone(p.zone);
    if (kind.place == decor::kWall) {
        if (zone.floors.empty()) {
            if (y >= -kWallBandTop && y <= -kWallBandBottom && x >= 20.f && x <= zone.w - 20.f) return "";
            return "벽에만 걸 수 있습니다.";
        }
        const bool onWall = std::any_of(zone.floors.begin(), zone.floors.end(), [&](const FloorRect& f) {
            return x >= f.x0 + 20.f && x <= f.x1 - 20.f && y >= f.y0 - kWallBandTop && y <= f.y0 - kWallBandBottom && !world_.wallCut(p.zone, f, x - 30.f, x + 30.f);
        });
        return onWall ? "" : "벽에만 걸 수 있습니다.";
    }
    if (kind.place == decor::kFlat && kind.halfW > 0.f) {
        if (x - kind.halfW < zone.minX || x + kind.halfW > zone.w || y - kind.depth < zone.minY || y + kind.depth > zone.h) return "깔개가 방 밖으로 나갑니다.";
        if (!zone.floors.empty()) {
            const FloorRect* floor = world_.floorAt(p.zone, x, y);
            if (!floor || x - kind.halfW < floor->x0 || x + kind.halfW > floor->x1 || y - kind.depth < floor->y0 || y + kind.depth > floor->y1) return "깔개가 방 밖으로 나갑니다.";
        }
        return "";
    }
    if (x - kind.halfW < zone.minX || x + kind.halfW > zone.w || y - kind.depth < zone.minY || y > zone.h || y < zone.minY) return "방 안에만 놓을 수 있습니다.";
    if (!zone.floors.empty() && !world_.floorAt(p.zone, x, y)) return "방 안에만 놓을 수 있습니다.";
    if (std::hypot(zone.doorX - x, zone.doorY - y) < kDecorDoorGap) return "문 앞에는 놓을 수 없습니다.";
    if (kind.halfW <= 0.f) return "";
    const float x0 = x - kind.halfW, y0 = y - kind.depth, x1 = x + kind.halfW, y1 = y;
    if (world_.overlapsSolid(p.zone, x0, y0, x1, y1)) return "다른 가구와 겹칩니다.";
    const bool someoneThere = std::any_of(players_.begin(), players_.end(), [&](const auto& entry) {
        const Player& other = entry.second;
        return other.zone == p.zone && other.x > x0 - kBodyMargin && other.x < x1 + kBodyMargin && other.y > y0 - kBodyMargin && other.y < y1 + kBodyMargin;
    });
    if (someoneThere) return "사람이 서 있는 곳에는 놓을 수 없습니다.";
    return "";
}

// 마당: 마을에서 집 문 가까이의 빈 땅. 텃밭과 마당 꾸미기만 놓는다. 밟고 지나가는 것들이라 길을 막지 않는다
std::string Game::yardProblem(const Player& p, const decor::Kind& kind, float x, float y, bool moving) const {
    if (world_.houseDoorNear(x, y, farm::kYardReach) < 0) return "집 근처 마당에만 놓을 수 있습니다. 집 문에서 조금 더 가까이 놓아 주세요.";
    if (!moving && std::count_if(decor_.begin(), decor_.end(), [&p](const Decor& item) { return item.zone == 0 && item.owner == p.account; }) >= farm::kYardPerPlayer) {
        return "마당에는 한 사람이 " + std::to_string(farm::kYardPerPlayer) + "개까지 놓을 수 있습니다.";
    }
    const float hw = std::max(kind.halfW, 14.f), hd = kind.place == decor::kFlat ? std::max(kind.depth, 10.f) : 10.f;
    for (const Building& b : world_.buildings()) {   // 문 앞과 건물 자리는 비워 둔다
        if (b.outside != 0) continue;
        if (std::fabs(b.doorX - x) < hw + 44.f && std::fabs(b.doorY - y) < hd + 60.f) return "문 앞에는 놓을 수 없습니다.";
        if (x + hw > b.x - b.halfW && x - hw < b.x + b.halfW && y + hd > b.y - b.back - 150.f && y - hd < b.y + b.front) return "건물과 겹칩니다.";
    }
    for (const float dx : {-hw, 0.f, hw}) {
        for (const float dy : {-hd, 0.f, hd}) {
            if (!world_.standable(0, x + dx, y + dy)) return "빈 땅에만 놓을 수 있습니다.";
        }
    }
    const bool crowded = std::any_of(decor_.begin(), decor_.end(), [&](const Decor& item) {
        if (item.zone != 0) return false;
        const decor::Kind other = shapeOf(item);
        return std::fabs(item.x - x) < hw + std::max(other.halfW, 14.f) && std::fabs(item.y - y) < hd + (other.place == decor::kFlat ? std::max(other.depth, 10.f) : 10.f);
    });
    if (crowded) return "다른 것과 겹칩니다.";
    return "";
}

void Game::buyDecor(ConnId id, Player& p, long kind) {
    if (kind < 0 || kind >= kDecorKinds) return;
    if (!decor::kShopAnywhere) {  // 오른쪽 위 상점이 열려 있으면 어디서나 산다
        server_.send(id, systemMessage("지금은 가구를 살 수 없습니다."));
        return;
    }
    const int price = decor::priceOf(static_cast<int>(kind));
    if (p.gold < price) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    if (p.furn[kind] >= kMaxFurnStack) {
        server_.send(id, systemMessage("같은 가구는 더 가질 수 없습니다."));
        return;
    }
    p.gold -= price;
    ++p.furn[kind];
    p.dirty = true;
    sendInventory(id, p);
}

void Game::placeDecor(ConnId id, Player& p, long number, float x, float y, bool dyed) {
    long kind = number;
    if (dyed) {
        if (number < 0 || number >= static_cast<long>(p.dyed.size())) return;
        kind = p.dyed[static_cast<size_t>(number)].first;
    } else if (kind < 0 || kind >= kDecorKinds || p.furn[kind] <= 0) {
        return;
    }
    const decor::Kind& info = decor::kCatalog[kind];
    std::string problem = decorProblem(p, info, x, y);
    if (!problem.empty()) {
        server_.send(id, systemMessage(problem));
        return;
    }
    Decor item{nextDecorId_++, p.zone, static_cast<int>(kind), x, y, p.account, {-1, -1, -1}};
    if (dyed) item.tint = p.dyed[static_cast<size_t>(number)].second;
    if (info.halfW > 0.f && info.place != decor::kFlat) {   // 이 가구로 방의 일부가 막히면 놓지 않는다
        const int before = world_.reachableCells(p.zone);
        world_.addDecorSolid(item.id, item.zone, x - info.halfW, y - info.depth, x + info.halfW, y);
        const int after = world_.reachableCells(p.zone);
        world_.removeDecorSolid(item.id);
        const int footprint = static_cast<int>((info.halfW * 2.f + 2.f * kBodyMargin) * (info.depth + 2.f * kBodyMargin) / (16.f * 16.f));
        if (after < before - footprint - 8) {
            server_.send(id, systemMessage("길이 막혀서 놓을 수 없습니다."));
            return;
        }
    }
    const bool firstRecord = kind == decor::kRecordPlayer && !hasRecord(p.zone);
    installDecor(item);
    decor_.push_back(item);
    if (dyed) p.dyed.erase(p.dyed.begin() + number);
    else --p.furn[kind];
    p.dirty = true;
    saveDecor();
    sendInventory(id, p);
    broadcastDecor(p.zone);
    const std::string placedKind = decor::kCatalog[kind].kind;
    if (placedKind == "dart_stand") broadcastDarts(p.zone);   // 다트 창을 열 수 있게 지금 상태를 알린다
    if (placedKind == "omok_table") sendToZone(p.zone, omokJson(p.zone));
    if (firstRecord) {  // 이 방에 레코드판이 생겼다: 저장해 둔 곡이 있으면 처음부터 튼다
        JazzBar& bar = records_[p.zone];
        changeJazzTrack(bar, bar.current);
        sendToZone(p.zone, jazzJson(p.zone));
    }
}

void Game::takeDecor(ConnId id, Player& p, long decorId) {
    const auto found = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == decorId && item.zone == p.zone; });
    if (found == decor_.end()) return;
    if (!canManage(p, *found)) {
        server_.send(id, systemMessage("직접 놓았거나 동거인이 놓은 가구만 치울 수 있습니다."));
        return;
    }
    if (found->crop >= 0 && found->planter != p.account) {
        server_.send(id, systemMessage(nickOf(found->planter) + "님이 심은 작물이 자라고 있어서 치울 수 없어요."));
        return;
    }
    const bool hadCrop = found->crop >= 0;   // 내가 심은 것은 밭과 함께 치운다
    if (!found->owner.empty() && found->owner != p.account) {   // 동거인의 가구: 주인의 소지품으로 돌려보낸다
        if (!returnToOwner(found->owner, found->kind, found->tint)) {
            server_.send(id, systemMessage("주인의 소지품이 가득 차서 치울 수 없습니다."));
            return;
        }
    } else if (!found->tint.empty()) {  // 염색한 가구는 색을 지닌 채 소지품으로 돌아간다
        if (p.dyed.size() >= kMaxDyed) {
            server_.send(id, systemMessage("염색한 가구를 너무 많이 가지고 있습니다."));
            return;
        }
        p.dyed.emplace_back(found->kind, found->tint);
    } else if (p.furn[found->kind] >= kMaxFurnStack) {
        server_.send(id, systemMessage("같은 가구를 너무 많이 가지고 있습니다."));
        return;
    } else {
        ++p.furn[found->kind];
    }
    p.dirty = true;
    const int zone = found->zone;
    const bool record = found->kind == decor::kRecordPlayer;
    if (decor::arcadeGame(found->kind) >= 0) dropArcade(found->id);
    uninstallDecor(*found);
    decor_.erase(found);
    saveDecor();
    sendInventory(id, p);
    broadcastDecor(zone);
    if (hadCrop) broadcastGarden(zone);
    if (record && !hasRecord(zone)) sendToZone(zone, jazzJson(zone));  // 마지막 레코드 플레이어를 치웠다: 음악을 끈다
    if (!hasDarts(zone) && darts_.count(zone)) resetDarts(zone);   // 마지막 다트판을 치웠다
    if (!hasDecorKind(zone, "omok_table") && omoks_.count(zone)) {   // 마지막 오목판을 치웠다
        omoks_.erase(zone);
        sendToZone(zone, "{\"t\":\"omok\",\"off\":true}");
    }
    if (!roomHasTv(zone) && !tvs_[static_cast<size_t>(zone)].video.empty()) {  // 마지막 TV 를 치웠다: 영상을 끈다
        tvs_[static_cast<size_t>(zone)] = RoomTv{};
        sendToZone(zone, tvJson(zone));
    }
}

// 옮기거나 치울 수 있는 가구: 내가 놓은 것, 집에 원래 있던 것, 동거인이 놓은 것
bool Game::canManage(const Player& p, const Decor& item) const {
    return item.owner.empty() || item.owner == p.account || std::find(p.mates.begin(), p.mates.end(), item.owner) != p.mates.end();
}

// 동거인이 치운 가구를 주인의 소지품에 넣는다. 주인이 접속해 있지 않으면 계정 파일에 바로 쓴다. 자리가 없으면 false.
bool Game::returnToOwner(const std::string& owner, int kind, const std::string& tint) {
    ConnId ownerId = 0;
    if (Player* other = onlinePlayer(owner, &ownerId)) {
        if (!tint.empty()) {
            if (other->dyed.size() >= kMaxDyed) return false;
            other->dyed.emplace_back(kind, tint);
        } else {
            if (other->furn[kind] >= kMaxFurnStack) return false;
            ++other->furn[kind];
        }
        other->dirty = true;
        sendInventory(ownerId, *other);
        return true;
    }
    Account* account = accounts_.find(owner);
    if (!account) return false;
    if (!tint.empty()) {
        if (parseDyed(account->dyed).size() >= kMaxDyed) return false;
        account->dyed += (account->dyed.empty() ? "" : ",") + std::to_string(kind) + ":" + tint;
    } else {
        if (account->furn[kind] >= kMaxFurnStack) return false;
        ++account->furn[kind];
    }
    persist(*account);
    return true;
}

// 놓인 가구를 다른 자리로 옮긴다. 주인, 염색, 앉는 방향은 그대로다. 놓을 때와 같은 규칙으로 새 자리를 본다.
void Game::moveDecor(ConnId id, Player& p, long decorId, float x, float y) {
    const auto found = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == decorId && item.zone == p.zone; });
    if (found == decor_.end()) return;
    if (!canManage(p, *found)) {
        server_.send(id, systemMessage("직접 놓았거나 동거인이 놓은 가구만 옮길 수 있습니다."));
        return;
    }
    for (const int seat : found->seats) {
        if (seat < 0) continue;
        if (std::any_of(players_.begin(), players_.end(), [seat](const auto& entry) { return entry.second.seat == seat; })) {
            server_.send(id, systemMessage("누가 앉아 있어서 옮길 수 없습니다."));
            return;
        }
    }
    const decor::Kind info = shapeOf(*found);
    uninstallDecor(*found);   // 제자리의 충돌 영역을 빼고 새 자리를 본다
    const float oldX = found->x, oldY = found->y;
    found->x = found->y = -99999.f;   // 마당에서는 놓인 것끼리 겹치는지 보므로 자기 자신은 빼고 본다
    std::string problem = decorProblem(p, info, x, y, true);
    found->x = oldX;
    found->y = oldY;
    if (problem.empty() && info.halfW > 0.f && info.place != decor::kFlat) {
        const int before = world_.reachableCells(p.zone);
        world_.addDecorSolid(found->id, found->zone, x - info.halfW, y - info.depth, x + info.halfW, y);
        const int after = world_.reachableCells(p.zone);
        world_.removeDecorSolid(found->id);
        const int footprint = static_cast<int>((info.halfW * 2.f + 2.f * kBodyMargin) * (info.depth + 2.f * kBodyMargin) / (16.f * 16.f));
        if (after < before - footprint - 8) problem = "길이 막혀서 놓을 수 없습니다.";
    }
    if (!problem.empty()) {
        installDecor(*found);   // 원래 자리로
        server_.send(id, systemMessage(problem));
        return;
    }
    found->x = x;
    found->y = y;
    installDecor(*found);
    saveDecor();
    broadcastDecor(p.zone);
}

// 놓인 가구를 좌우로 돌린다. 옮기기와 같은 사람이 할 수 있고, 누가 앉아 있으면 돌리지 않는다.
void Game::turnDecor(ConnId id, Player& p, long decorId) {
    const auto found = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == decorId && item.zone == p.zone; });
    if (found == decor_.end()) return;
    if (!canManage(p, *found)) {
        server_.send(id, systemMessage("직접 놓았거나 동거인이 놓은 가구만 돌릴 수 있습니다."));
        return;
    }
    for (const int seat : found->seats) {
        if (seat >= 0 && std::any_of(players_.begin(), players_.end(), [seat](const auto& entry) { return entry.second.seat == seat; })) {
            server_.send(id, systemMessage("누가 앉아 있어서 돌릴 수 없습니다."));
            return;
        }
    }
    uninstallDecor(*found);
    const decor::Kind& base = decor::kCatalog[found->kind];
    if (decor::rotatable(base)) {   // 깔개, 텃밭, 침대: 가운데를 그대로 두고 90도 돌린다. 가로세로가 바뀌니 자리가 되는지 다시 본다
        const decor::Kind before = shapeOf(*found);
        const int oldRot = found->rot;
        const float oldX = found->x, oldY = found->y;
        found->rot = (found->rot + 1) & 3;
        const decor::Kind after = shapeOf(*found);
        const float y = base.place == decor::kFlat ? oldY : oldY - before.depth / 2.f + after.depth / 2.f;
        found->x = found->y = -99999.f;   // 마당에서는 놓인 것끼리 겹치는지 보므로 자기 자신은 빼고 본다
        std::string problem = decorProblem(p, after, oldX, y, true);
        if (problem.empty() && after.halfW > 0.f && after.place != decor::kFlat) {
            const int reachBefore = world_.reachableCells(p.zone);
            world_.addDecorSolid(found->id, found->zone, oldX - after.halfW, y - after.depth, oldX + after.halfW, y);
            const int reachAfter = world_.reachableCells(p.zone);
            world_.removeDecorSolid(found->id);
            const int footprint = static_cast<int>((after.halfW * 2.f + 2.f * kBodyMargin) * (after.depth + 2.f * kBodyMargin) / (16.f * 16.f));
            if (reachAfter < reachBefore - footprint - 8) problem = "길이 막힙니다.";
        }
        found->x = oldX;
        found->y = problem.empty() ? y : oldY;
        if (!problem.empty()) {
            found->rot = oldRot;
            installDecor(*found);
            server_.send(id, systemMessage("이 자리에서는 돌릴 수 없어요 (" + problem + ") 조금 옮긴 뒤에 돌려 주세요."));
            return;
        }
    } else {
        found->flip = !found->flip;   // 앞에서 본 그림의 가구: 좌우로 뒤집는다. 충돌 영역은 좌우가 같으니 자리만 새로 만든다
    }
    installDecor(*found);
    saveDecor();
    broadcastDecor(p.zone);
}

// "<배치 번호> <퍼센트>": 놓인 가구의 크기를 바꾼다. 가구마다 정해진 범위 안에서, 그 자리에 그 크기로 놓을 수 있을 때만.
void Game::scaleDecor(ConnId id, Player& p, long decorId, long percent) {
    const auto found = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == decorId && item.zone == p.zone; });
    if (found == decor_.end()) return;
    if (!canManage(p, *found)) {
        server_.send(id, systemMessage("직접 놓았거나 동거인이 놓은 가구만 크기를 바꿀 수 있습니다."));
        return;
    }
    const decor::Kind& base = decor::kCatalog[found->kind];
    const decor::ScaleRange range = decor::scaleRange(base);
    const float s = static_cast<float>(percent) / 100.f;
    if (s < range.min - 0.001f || s > range.max + 0.001f || std::fabs(s - found->scale) < 0.001f) return;
    for (const int seat : found->seats) {
        if (seat >= 0 && std::any_of(players_.begin(), players_.end(), [seat](const auto& entry) { return entry.second.seat == seat; })) {
            server_.send(id, systemMessage("누가 앉아 있어서 크기를 바꿀 수 없습니다."));
            return;
        }
    }
    uninstallDecor(*found);
    const decor::Kind info = decor::turned(decor::scaled(base, s), found->rot);
    const float atX = found->x, atY = found->y;
    found->x = found->y = -99999.f;
    std::string problem = decorProblem(p, info, atX, atY, true);
    found->x = atX;
    found->y = atY;
    if (problem.empty() && info.halfW > 0.f && info.place != decor::kFlat) {
        const int before = world_.reachableCells(p.zone);
        world_.addDecorSolid(found->id, found->zone, found->x - info.halfW, found->y - info.depth, found->x + info.halfW, found->y);
        const int after = world_.reachableCells(p.zone);
        world_.removeDecorSolid(found->id);
        const int footprint = static_cast<int>((info.halfW * 2.f + 2.f * kBodyMargin) * (info.depth + 2.f * kBodyMargin) / (16.f * 16.f));
        if (after < before - footprint - 8) problem = "길이 막혀서 이 크기로는 놓을 수 없습니다.";
    }
    if (!problem.empty()) {
        installDecor(*found);   // 원래 크기로
        server_.send(id, systemMessage(problem));
        return;
    }
    found->scale = s;
    installDecor(*found);
    saveDecor();
    broadcastDecor(p.zone);
}

// "buy <번호>", "place <번호> <x> <y>", "take <배치 번호>", "buydye", "dye <번호> <염색 값>",
// "redye <염색 가구 칸> <염색 값>", "placedyed <염색 가구 칸> <x> <y>"
void Game::decorCommand(ConnId id, Player& p, const std::string& arg) {
    if (p.tradeWith || !spendAction(p)) return;
    std::istringstream in(arg);
    std::string action;
    in >> action;
    if (action == "buydye") {
        buyDye(id, p);
        return;
    }
    long number = -1;
    in >> number;
    if (in.fail()) return;
    if (action == "buy") {
        buyDecor(id, p, number);
    } else if (action == "take") {
        takeDecor(id, p, number);
    } else if (action == "turn") {
        turnDecor(id, p, number);
    } else if (action == "scale") {
        long percent = 0;
        in >> percent;
        if (!in.fail()) scaleDecor(id, p, number, percent);
    } else if (action == "move") {
        double x = 0.0, y = 0.0;
        in >> x >> y;
        if (!in.fail() && std::isfinite(x) && std::isfinite(y)) moveDecor(id, p, number, static_cast<float>(x), static_cast<float>(y));
    } else if (action == "place" || action == "placedyed") {
        double x = 0.0, y = 0.0;
        in >> x >> y;
        if (!in.fail() && std::isfinite(x) && std::isfinite(y)) placeDecor(id, p, number, static_cast<float>(x), static_cast<float>(y), action == "placedyed");
    } else if (action == "dye" || action == "redye") {
        std::string tint;
        in >> tint;
        dyeFurniture(id, p, number, tint, action == "redye");
    }
}

void Game::buyDye(ConnId id, Player& p) {
    if (p.gold < decor::dyePrice()) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    if (p.dye >= kMaxDye) {
        server_.send(id, systemMessage("염료를 더 가질 수 없습니다."));
        return;
    }
    p.gold -= decor::dyePrice();
    ++p.dye;
    p.dirty = true;
    sendInventory(id, p);
}

// 염료 한 병을 써서 소지품의 가구 하나를 염색한다. again 이면 이미 염색한 가구(칸 번호)를 다시 염색한다.
void Game::dyeFurniture(ConnId id, Player& p, long number, const std::string& tint, bool again) {
    if (!validTint(tint)) return;
    if (p.dye <= 0) {
        server_.send(id, systemMessage("염료가 없습니다. 상점에서 받아 오세요."));
        return;
    }
    if (again) {
        if (number < 0 || number >= static_cast<long>(p.dyed.size())) return;
        p.dyed[static_cast<size_t>(number)].second = tint;
    } else {
        if (number < 0 || number >= kDecorKinds || p.furn[number] <= 0) return;
        if (p.dyed.size() >= kMaxDyed) {
            server_.send(id, systemMessage("염색한 가구를 너무 많이 가지고 있습니다."));
            return;
        }
        --p.furn[number];
        p.dyed.emplace_back(static_cast<int>(number), tint);
    }
    --p.dye;
    p.dirty = true;
    sendInventory(id, p);
}

// 받는 사람마다 자기 가구에 표시를 해서 보낸다.
std::string Game::decorJson(int zone, const Player& viewer) const {
    const std::string& account = viewer.account;
    std::string json = "{\"t\":\"decor\",\"z\":" + std::to_string(zone) + ",\"p\":[";
    bool first = true;
    char buf[96];
    for (const Decor& item : decor_) {
        if (item.zone != zone) continue;
        const bool mate = std::find(viewer.mates.begin(), viewer.mates.end(), item.owner) != viewer.mates.end();
        const int mine = item.owner.empty() ? 2 : item.owner == account ? 1 : mate ? 3 : 0;
        std::snprintf(buf, sizeof(buf), "%s[%d,%d,%.1f,%.1f,%d,[", first ? "" : ",", item.id, item.kind, item.x, item.y, mine);
        json += buf;
        first = false;
        bool firstSeat = true;
        for (const int index : item.seats) {
            if (index < 0) continue;
            const Seat& seat = world_.seats()[static_cast<size_t>(index)];
            std::snprintf(buf, sizeof(buf), "%s[%d,%.1f,%.1f,%.2f,%d,%d,%.1f,%.2f]", firstSeat ? "" : ",", index, seat.x, seat.y, seat.faceY, seat.lie ? 1 : 0, seat.side, seat.sortY, seat.faceX);
            json += buf;
            firstSeat = false;
        }
        json += "],\"" + item.tint + "\"," + std::to_string((item.flip ? 1 : 0) | (item.rot << 1)) + "," + std::to_string(static_cast<int>(std::lround(item.scale * 100.f))) + "]";
    }
    return json + "]}";
}

void Game::broadcastDecor(int zone) {
    for (const auto& entry : players_) {
        if (entry.second.zone == zone) server_.send(entry.first, decorJson(zone, entry.second));
    }
}

// 한 줄에 "<종류>\t<구역>\t<x>\t<y>\t<주인 계정>\t<염색 값>[\t<방향 x>\t<방향 y>\t<이름 쪽>]".
// 주인이 비어 있으면 집에 원래 있던 가구다. 예전 형식(주인까지만 있는 줄)도 읽는다. 목록에 없는 가구나 구역은 건너뛴다.
void Game::loadDecor() {
    std::ifstream file(accounts_.dir() + "/decor.list");
    std::string line;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        if (f.size() < 5) continue;
        const auto kind = std::find_if(std::begin(decor::kCatalog), std::end(decor::kCatalog), [&f](const decor::Kind& k) { return f[0] == k.kind; });
        long zone = -1;
        if (kind == std::end(decor::kCatalog) || !parseWhole(f[1].c_str(), zone)) continue;
        const int kindIndex = static_cast<int>(kind - std::begin(decor::kCatalog));
        if (!isHouseZone(static_cast<int>(zone)) && !(zone == 0 && decor::isGarden(kindIndex))) continue;
        const float x = static_cast<float>(std::atof(f[2].c_str())), y = static_cast<float>(std::atof(f[3].c_str()));
        if (!std::isfinite(x) || !std::isfinite(y)) continue;
        Decor item{nextDecorId_++, static_cast<int>(zone), static_cast<int>(kind - std::begin(decor::kCatalog)), x, y, f[4], {-1, -1, -1}};
        if (f.size() > 5 && validTint(f[5])) item.tint = f[5];
        if (f.size() > 8 && !f[6].empty()) {
            item.faced = true;
            item.faceX = static_cast<float>(std::atof(f[6].c_str()));
            item.faceY = static_cast<float>(std::atof(f[7].c_str()));
            item.side = clampInt(std::atoi(f[8].c_str()), -1, 1);
        }
        if (f.size() > 9) {   // 한 숫자에 좌우 뒤집기(1)와 돌린 횟수(×2)
            const int turn = clampInt(std::atoi(f[9].c_str()), 0, 7);
            item.flip = turn & 1;
            if (decor::rotatable(*kind)) item.rot = turn >> 1;
        }
        if (f.size() > 10) {
            const decor::ScaleRange range = decor::scaleRange(*kind);
            const float s = static_cast<float>(std::atof(f[10].c_str()));
            if (std::isfinite(s) && s > 0.f) item.scale = std::clamp(s, range.min, range.max);
        }
        if (f.size() > 15 && decor::isPlot(kindIndex) && !f[15].empty()) {   // 텃밭에 심은 것
            long crop = -1;
            if (parseWhole(f[11].c_str(), crop) && crop >= 0 && crop < farm::kCrops) {
                item.crop = static_cast<int>(crop);
                item.plantedAt = std::atol(f[12].c_str());
                item.readyAt = std::atol(f[13].c_str());
                item.wateredAt = std::atol(f[14].c_str());
                item.planter = f[15];
            }
        }
        installDecor(item);
        decor_.push_back(item);
    }
}

// 몰쟈와 캬캬의 집에 원래 있던 가구를 처음 한 번만 배치 가구로 깐다. 깐 (구역, 묶음)은 decor.seeded 에 남긴다.
// 줄마다 "<구역>:<묶음>"이고, 예전 형식(구역 번호만)은 1번 묶음을 깐 것으로 본다. 뒤에 더한 묶음만 새로 깔린다.
void Game::seedDecor() {
    const std::string markerPath = accounts_.dir() + "/decor.seeded";
    std::vector<std::string> seeded;
    {
        std::ifstream marker(markerPath);
        std::string line;
        while (std::getline(marker, line)) {
            if (line.empty()) continue;
            seeded.push_back(line.find(':') == std::string::npos ? line + ":1" : line);
        }
    }
    std::vector<std::string> added;
    for (const DecorSeed& seed : world_.decorSeeds()) {
        const std::string key = std::to_string(seed.zone) + ":" + std::to_string(seed.gen);
        if (std::find(seeded.begin(), seeded.end(), key) != seeded.end()) continue;
        const auto kind = std::find_if(std::begin(decor::kCatalog), std::end(decor::kCatalog), [&seed](const decor::Kind& k) { return seed.kind == k.kind; });
        if (kind == std::end(decor::kCatalog)) continue;
        Decor item{nextDecorId_++, seed.zone, static_cast<int>(kind - std::begin(decor::kCatalog)), seed.x, seed.y, "", {-1, -1, -1}};
        item.faced = seed.faced;
        item.faceX = seed.faceX;
        item.faceY = seed.faceY;
        item.side = seed.side;
        installDecor(item);
        decor_.push_back(item);
        if (std::find(added.begin(), added.end(), key) == added.end()) added.push_back(key);
    }
    if (added.empty()) return;
    std::string content;
    for (const std::string& key : seeded) content += key + "\n";
    for (const std::string& key : added) content += key + "\n";
    saveDecor();
    worker_.post([path = markerPath, content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

void Game::saveDecor() {
    std::string content;
    char numbers[64];
    for (const Decor& item : decor_) {
        std::snprintf(numbers, sizeof(numbers), "\t%d\t%.1f\t%.1f\t", item.zone, item.x, item.y);
        content += std::string(decor::kCatalog[item.kind].kind) + numbers + item.owner + "\t" + item.tint;
        if (item.faced) std::snprintf(numbers, sizeof(numbers), "\t%.3f\t%.3f\t%d", item.faceX, item.faceY, item.side);
        else std::snprintf(numbers, sizeof(numbers), "\t\t\t");
        content += numbers;
        std::snprintf(numbers, sizeof(numbers), "\t%d\t%.2f", (item.flip ? 1 : 0) | (item.rot << 1), item.scale);
        content += numbers;
        if (item.crop >= 0) {
            content += "\t" + std::to_string(item.crop) + "\t" + std::to_string(item.plantedAt) + "\t" + std::to_string(item.readyAt) + "\t" + std::to_string(item.wateredAt) + "\t" + item.planter;
        }
        content += "\n";
    }
    std::string path = accounts_.dir() + "/decor.list";
    worker_.post([path = std::move(path), content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

bool Game::hasDecorKind(int zone, const char* kind) const {
    return std::any_of(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.zone == zone && std::string(decor::kCatalog[item.kind].kind) == kind; });
}

bool Game::decorNear(int zone, const char* kind, float x, float y, float reach) const {
    return std::any_of(decor_.begin(), decor_.end(), [&](const Decor& item) {
        return item.zone == zone && std::string(decor::kCatalog[item.kind].kind) == kind && std::hypot(item.x - x, item.y - y) <= reach;
    });
}
