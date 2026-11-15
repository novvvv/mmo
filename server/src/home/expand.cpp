// 집 확장: 벽을 뚫어 방을 붙이고, 통로 폭과 붙인 방의 크기를 바꾸고, 다시 막는다. 바닥과 벽은 World::setOpenings 가 만든다.
#include "core/rules.hpp"

namespace {
const char* const kDirNames[] = {"위", "아래", "왼", "오른"};   // 뒤에 "쪽" 을 붙여 쓴다

bool insideRect(const FloorRect& r, float x, float y) {
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}
}  // namespace

// 그 방향 벽의 at 자리를 뚫을 수 없는 이유. 뚫을 수 있으면 빈 문자열.
std::string Game::openingProblem(int zone, int dir, float at, float half, int strict, float len, float deep) const {
    const FloorRect& edge = world_.edgeRoom(zone, dir);
    const bool vertical = dir == kExpandUp || dir == kExpandDown;
    // 벽을 다 트는 폭이 아니면 모서리에서 조금 떨어져야 한다
    const float span = vertical ? edge.x1 - edge.x0 : edge.y1 - edge.y0;
    const float margin = std::clamp((span - half * 2.f) / 2.f, 0.f, kOpeningMargin);
    const float lo = (vertical ? edge.x0 : edge.y0) + half + margin, hi = (vertical ? edge.x1 : edge.y1) - half - margin;
    if (!std::isfinite(at) || at < lo - 0.5f || at > hi + 0.5f) return "벽이 좁아서 그 폭으로는 뚫을 수 없습니다.";
    const Zone& z = world_.zone(zone);
    if (dir == kExpandDown && std::fabs(z.doorY - edge.y1) < 1.f && std::fabs(z.doorX - at) < half + 70.f) return "문 앞은 뚫을 수 없습니다.";
    FloorRect corridor{}, room{};
    World::expansionRects(edge, dir, at, half, corridor, room, len, deep);
    for (const FloorRect& f : z.base) {
        for (const FloorRect* r : {&corridor, &room}) {
            if (f.x0 < r->x1 && f.x1 > r->x0 && f.y0 < r->y1 && f.y1 > r->y0) return "그쪽은 이미 다른 방이 있습니다.";
        }
    }
    // 다른 쪽으로 붙인 방과도 겹치지 않아야 한다. 방마다 뒷벽이 서는 자리(위쪽 띠)까지 친다
    for (const Opening& other : z.openings) {
        if (other.dir == dir) continue;
        FloorRect otherCorridor{}, otherRoom{};
        World::expansionRects(world_.edgeRoom(zone, other.dir), other.dir, other.at, other.half, otherCorridor, otherRoom, other.len, other.deep);
        const auto clash = [](const FloorRect& a, const FloorRect& b) {
            return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 - kWallHeight < b.y1 && a.y1 > b.y0 - kWallHeight;
        };
        if (clash(room, otherRoom) || clash(room, otherCorridor) || clash(corridor, otherRoom)) return "그 크기로는 다른 쪽에 붙인 방과 겹칩니다.";
    }
    // 뚫을 벽 바로 앞(방 안쪽 띠)에 놓은 가구가 있으면 옮겨 달라고 한다. 고정 가구는 되도록 피한다
    constexpr float kStrip = 56.f, kPad = kBodyMargin + 4.f;
    const float a0 = at - half - kPad, a1 = at + half + kPad;
    float s0 = 0.f, t0 = 0.f, s1 = 0.f, t1 = 0.f;
    if (dir == kExpandUp) s0 = a0, t0 = edge.y0, s1 = a1, t1 = edge.y0 + kStrip;
    else if (dir == kExpandDown) s0 = a0, t0 = edge.y1 - kStrip, s1 = a1, t1 = edge.y1;
    else if (dir == kExpandLeft) s0 = edge.x0, t0 = a0, s1 = edge.x0 + kStrip, t1 = a1;
    else s0 = edge.x1 - kStrip, t0 = a0, s1 = edge.x1, t1 = a1;
    if (world_.overlapsDecor(zone, s0, t0, s1, t1)) return "뚫을 벽 앞의 가구를 조금 옮겨 주세요.";
    if (strict >= 1 && world_.overlapsFixed(zone, s0, t0, s1, t1)) return "뚫을 벽 앞에 고정 가구가 있습니다.";
    if (dir == kExpandUp) {   // 뒷벽: 벽걸이와 벽에 붙여 세운 가구를 피한다
        const float w0 = at - half - 8.f, w1 = at + half + 8.f;
        for (const Decor& d : decor_) {
            if (d.zone != zone) continue;
            const decor::Kind& info = decor::kCatalog[d.kind];
            if (info.place == decor::kFlat) continue;
            const bool atWall = info.place == decor::kWall ? (d.y < edge.y0 && d.y > edge.y0 - kWallHeight - 20.f) : (d.y >= edge.y0 && d.y <= edge.y0 + 70.f);
            const float half = decor::visualHalf(info) * d.scale;
            if (atWall && d.x + half > w0 && d.x - half < w1 && d.x > edge.x0 - 1.f && d.x < edge.x1 + 1.f) return "뚫을 자리의 벽걸이나 벽에 붙은 가구를 먼저 옮겨 주세요.";
        }
    }
    // 고정 가구: 벽 앞에 세운 것은 되도록 피하고, 벽에 건 고정 장식은 피할 수 없으면 뚫으면서 떼어 낸다
    for (const Furniture& f : world_.furniture()) {
        if (f.zone != zone) continue;
        if (strict >= 2 && World::coversOpening(f, edge, dir, at, half)) return "뚫을 자리에 고정 장식이 있습니다.";
        if (strict >= 1) {
            const float along = vertical ? f.x : f.y, depth = dir == kExpandUp ? f.y - edge.y0 : dir == kExpandDown ? edge.y1 - f.y : dir == kExpandLeft ? f.x - edge.x0 : edge.x1 - f.x;
            if (depth >= 0.f && depth <= 80.f && std::fabs(along - at) < half + 40.f) return "뚫을 자리 앞에 고정 가구가 있습니다.";
        }
    }
    return "";
}

void Game::applyExpansion(int zone, std::vector<Opening> openings) {
    world_.setOpenings(zone, std::move(openings));
    const std::string json = world_.zoneJson(zone);
    for (const auto& entry : players_) server_.send(entry.first, json);   // 나중에 들어올 사람도 보이게 모두에게
}

void Game::expandCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long dir = -1, width = 0;
    in >> action >> dir;
    if (in.fail() || dir < 0 || dir > 3 || (action != "open" && action != "close" && action != "width" && action != "size")) return;
    const bool sized = static_cast<bool>(in >> width);
    long deepArg = 0;
    const bool deepGiven = static_cast<bool>(in >> deepArg);
    if (!world_.expandable(p.zone)) {
        server_.send(id, systemMessage("넓힐 수 있는 집 안에서만 할 수 있습니다."));
        return;
    }
    if (p.tradeWith || !spendAction(p)) return;
    const Zone& z = world_.zone(p.zone);
    std::vector<Opening> openings = z.openings;
    const auto existing = std::find_if(openings.begin(), openings.end(), [dir](const Opening& o) { return o.dir == dir; });
    const std::string name = kDirNames[dir];

    if (action == "close") {
        if (existing == openings.end()) return;
        FloorRect corridor{}, room{};
        World::expansionRects(world_.edgeRoom(p.zone, static_cast<int>(dir)), static_cast<int>(dir), existing->at, existing->half, corridor, room, existing->len, existing->deep);
        const auto inside = [&](float x, float y) { return insideRect(corridor, x, y) || insideRect(room, x, y); };
        const bool furnished = std::any_of(decor_.begin(), decor_.end(), [&](const Decor& d) { return d.zone == p.zone && inside(d.x, d.y); });
        const bool occupied = std::any_of(players_.begin(), players_.end(), [&](const auto& e) { return e.second.zone == p.zone && inside(e.second.x, e.second.y); }) ||
                              std::any_of(cats_.begin(), cats_.end(), [&](const Cat& c) { return c.zone == p.zone && inside(c.x, c.y); });
        if (furnished) {
            server_.send(id, systemMessage(name + "쪽 방의 가구를 먼저 치워 주세요."));
            return;
        }
        if (occupied) {
            server_.send(id, systemMessage(name + "쪽 방에 누가 있어서 막을 수 없습니다."));
            return;
        }
        openings.erase(existing);
        applyExpansion(p.zone, std::move(openings));
        saveExpansions();
        server_.send(id, systemMessage(name + "쪽 방을 막았습니다."));
        return;
    }

    const FloorRect& edge = world_.edgeRoom(p.zone, static_cast<int>(dir));
    const bool vertical = dir == kExpandUp || dir == kExpandDown;
    if (action == "size") {   // 붙인 방의 크기를 바꾼다: "<벽과 나란한 길이> <깊이>"
        if (existing == openings.end() || !sized || !deepGiven) return;
        const float len = std::clamp(static_cast<float>(width), std::max(kRoomMinLen, existing->half * 2.f), kRoomMaxLen);
        const float deep = std::clamp(static_cast<float>(deepArg), kRoomMinDeep, kRoomMaxDeep);
        FloorRect corridor{}, before{}, after{};
        World::expansionRects(edge, static_cast<int>(dir), existing->at, existing->half, corridor, before, existing->len, existing->deep);
        World::expansionRects(edge, static_cast<int>(dir), existing->at, existing->half, corridor, after, len, deep);
        if (std::fabs(before.x0 - after.x0) < 0.5f && std::fabs(before.x1 - after.x1) < 0.5f && std::fabs(before.y0 - after.y0) < 0.5f && std::fabs(before.y1 - after.y1) < 0.5f) return;
        const std::string problem = openingProblem(p.zone, static_cast<int>(dir), existing->at, existing->half, 0, len, deep);
        if (!problem.empty() && problem.find("가구") == std::string::npos) {   // 통로 앞의 가구는 이미 뚫려 있으니 상관없다
            server_.send(id, systemMessage(problem));
            return;
        }
        // 줄이면 방이었던 곳이 벽 밖이 된다. 거기 놓은 가구(벽걸이는 뒷벽까지)나 사람이 있으면 그대로 둔다
        const auto stranded = [&](float x, float y, float up) {
            const bool was = x >= before.x0 && x <= before.x1 && y >= before.y0 - up && y <= before.y1;
            const bool still = x >= after.x0 + (up > 0.f ? 0.f : kRadius) && x <= after.x1 - (up > 0.f ? 0.f : kRadius) && y >= after.y0 - up + (up > 0.f ? 0.f : kRadius) && y <= after.y1 - (up > 0.f ? 0.f : kRadius);
            return was && !still && !insideRect(corridor, x, y);
        };
        const bool furnished = std::any_of(decor_.begin(), decor_.end(), [&](const Decor& d) {
            if (d.zone != p.zone) return false;
            const decor::Kind info = shapeOf(d);
            if (info.place == decor::kWall) return stranded(d.x, d.y, kWallHeight + 20.f);
            const float top = d.y - info.depth, bottom = info.place == decor::kFlat ? d.y + info.depth : d.y;
            const bool was = d.x >= before.x0 && d.x <= before.x1 && d.y >= before.y0 && d.y <= before.y1;
            const bool fits = d.x - info.halfW >= after.x0 && d.x + info.halfW <= after.x1 && top >= after.y0 && bottom <= after.y1;
            return was && !fits && !insideRect(corridor, d.x, d.y);
        });
        if (furnished) {
            server_.send(id, systemMessage("줄이려는 자리에 걸치는 가구를 먼저 옮겨 주세요."));
            return;
        }
        if (std::any_of(players_.begin(), players_.end(), [&](const auto& e) { return e.second.zone == p.zone && stranded(e.second.x, e.second.y, 0.f); }) ||
            std::any_of(cats_.begin(), cats_.end(), [&](const Cat& c) { return c.zone == p.zone && stranded(c.x, c.y, 0.f); })) {
            server_.send(id, systemMessage("줄이려는 자리에 누가 있습니다."));
            return;
        }
        const std::vector<Opening> old = openings;
        existing->len = len;
        existing->deep = deep;
        world_.setOpenings(p.zone, openings, false);
        if (!world_.canReach(p.zone, (after.x0 + after.x1) / 2.f, (after.y0 + after.y1) / 2.f)) {
            world_.setOpenings(p.zone, old, false);
            server_.send(id, systemMessage("그 크기로는 방으로 걸어 들어갈 수 없습니다."));
            return;
        }
        applyExpansion(p.zone, std::move(openings));
        saveExpansions();
        broadcastDecor(p.zone);
        server_.send(id, systemMessage(name + "쪽 방의 크기를 바꿨습니다."));
        return;
    }

    float maxHalf = World::maxOpeningHalf(edge, static_cast<int>(dir));
    if (existing != openings.end() && existing->len > 0.f) maxHalf = std::min(maxHalf, existing->len / 2.f);   // 통로는 방보다 넓을 수 없다
    const float half = sized ? std::clamp(static_cast<float>(width) / 2.f, kOpeningMinHalf, maxHalf) : std::min(kOpeningHalf, maxHalf);

    if (action == "width") {   // 뚫어 둔 통로를 넓히거나 좁힌다. 가운데는 되도록 그대로 두고, 벽 끝에 걸리면 안쪽으로 옮긴다
        if (existing == openings.end() || !sized) return;
        if (std::fabs(existing->half - half) < 0.5f) return;
        const float span = vertical ? edge.x1 - edge.x0 : edge.y1 - edge.y0;
        const float margin = std::clamp((span - half * 2.f) / 2.f, 0.f, kOpeningMargin);
        const float lo = (vertical ? edge.x0 : edge.y0) + half + margin, hi = (vertical ? edge.x1 : edge.y1) - half - margin;
        const float at = lo > hi ? (lo + hi) / 2.f : std::clamp(existing->at, lo, hi);
        const std::string problem = openingProblem(p.zone, static_cast<int>(dir), at, half, 0, existing->len, existing->deep);
        if (!problem.empty()) {
            server_.send(id, systemMessage(problem));
            return;
        }
        // 좁히면 통로였던 곳이 벽이 된다. 거기 놓은 가구나 서 있는 사람이 있으면 그대로 둔다
        FloorRect before{}, after{}, room{};
        World::expansionRects(edge, static_cast<int>(dir), existing->at, existing->half, before, room, existing->len, existing->deep);
        World::expansionRects(edge, static_cast<int>(dir), at, half, after, room, existing->len, existing->deep);
        const auto stranded = [&](float x, float y, float up) {
            const bool was = x >= before.x0 && x <= before.x1 && y >= before.y0 - up && y <= before.y1;
            const bool still = x >= after.x0 && x <= after.x1 && y >= after.y0 - up && y <= after.y1;
            return was && !still;
        };
        if (std::any_of(decor_.begin(), decor_.end(), [&](const Decor& d) { return d.zone == p.zone && stranded(d.x, d.y, kWallHeight + 20.f); })) {
            server_.send(id, systemMessage("좁히려는 통로 자리의 가구를 먼저 옮겨 주세요."));
            return;
        }
        if (std::any_of(players_.begin(), players_.end(), [&](const auto& e) { return e.second.zone == p.zone && stranded(e.second.x, e.second.y, 0.f); }) ||
            std::any_of(cats_.begin(), cats_.end(), [&](const Cat& c) { return c.zone == p.zone && stranded(c.x, c.y, 0.f); })) {
            server_.send(id, systemMessage("좁히려는 통로 자리에 누가 있습니다."));
            return;
        }
        const std::vector<Opening> old = openings;
        existing->at = at;
        existing->half = half;
        world_.setOpenings(p.zone, openings, false);
        const bool reachable = world_.canReach(p.zone, (room.x0 + room.x1) / 2.f, (room.y0 + room.y1) / 2.f);
        if (!reachable) {
            world_.setOpenings(p.zone, old, false);
            server_.send(id, systemMessage("그 폭으로는 방으로 걸어 들어갈 수 없습니다."));
            return;
        }
        applyExpansion(p.zone, std::move(openings));
        saveExpansions();
        broadcastDecor(p.zone);
        server_.send(id, systemMessage(name + "쪽 통로의 폭을 바꿨습니다."));
        return;
    }

    if (existing != openings.end()) {
        server_.send(id, systemMessage("이미 " + name + "쪽으로 넓혔습니다."));
        return;
    }
    // 벽 가운데부터 양옆으로 10px 씩 옮겨 가며 뚫을 수 있는 첫 자리를 고른다
    const float mid = vertical ? (edge.x0 + edge.x1) / 2.f : (edge.y0 + edge.y1) / 2.f;
    const float reach = (vertical ? edge.x1 - edge.x0 : edge.y1 - edge.y0) / 2.f;
    std::string firstProblem;
    float spot = NAN;
    int trials = 0;
    // 마지막 단계에서는 고정 가구 사이로 실제로 걸어 들어갈 수 있는지 뚫어 보고 되돌린다
    const auto walkable = [&](float at) {
        if (++trials > 8) return false;
        std::vector<Opening> trial = openings;
        trial.push_back({static_cast<int>(dir), at, half});
        world_.setOpenings(p.zone, trial, false);
        FloorRect corridor{}, room{};
        World::expansionRects(edge, static_cast<int>(dir), at, half, corridor, room);
        const bool ok = world_.canReach(p.zone, (room.x0 + room.x1) / 2.f, (room.y0 + room.y1) / 2.f);
        world_.setOpenings(p.zone, openings, false);
        return ok;
    };
    for (int strict = 2; strict >= 0 && std::isnan(spot); --strict) {   // 깐깐한 조건부터 자리를 찾는다
        for (float offset = 0.f; offset <= reach && std::isnan(spot); offset += 10.f) {
            for (const float at : {mid + offset, mid - offset}) {
                const std::string problem = openingProblem(p.zone, static_cast<int>(dir), at, half, strict);
                if (strict == 0 && firstProblem.empty()) firstProblem = problem;
                if (problem.empty() && (strict > 0 || walkable(at))) {
                    spot = at;
                    break;
                }
            }
        }
    }
    if (std::isnan(spot)) {
        server_.send(id, systemMessage(firstProblem.empty() ? "뚫을 자리가 없습니다." : firstProblem));
        return;
    }
    if (p.gold < decor::expandPrice()) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    p.gold -= decor::expandPrice();
    p.dirty = true;
    sendInventory(id, p);
    openings.push_back({static_cast<int>(dir), spot, half});
    applyExpansion(p.zone, std::move(openings));
    saveExpansions();
    server_.send(id, systemMessage(name + "쪽 벽을 뚫어 방을 넓혔습니다."));
}

void Game::loadExpansions() {
    std::ifstream file(accounts_.dir() + "/expand.list");
    std::string line;
    std::map<int, std::vector<Opening>> byZone;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long zone = -1, dir = -1;
        if (f.size() < 3 || !parseWhole(f[0].c_str(), zone) || !parseWhole(f[1].c_str(), dir) || dir < 0 || dir > 3) continue;
        if (!world_.expandable(static_cast<int>(zone))) continue;
        const float at = static_cast<float>(std::atof(f[2].c_str()));
        const FloorRect& edge = world_.edgeRoom(static_cast<int>(zone), static_cast<int>(dir));
        const float saved = f.size() > 3 ? static_cast<float>(std::atof(f[3].c_str())) : kOpeningHalf;   // 예전 파일에는 폭이 없다
        const float half = std::isfinite(saved) ? std::clamp(saved, kOpeningMinHalf, World::maxOpeningHalf(edge, static_cast<int>(dir))) : kOpeningHalf;
        auto& list = byZone[static_cast<int>(zone)];
        if (!std::isfinite(at) || std::any_of(list.begin(), list.end(), [dir](const Opening& o) { return o.dir == dir; })) continue;
        Opening opening{static_cast<int>(dir), at, half};
        if (f.size() > 5) {   // 방의 크기를 따로 정한 집
            const float len = static_cast<float>(std::atof(f[4].c_str())), deep = static_cast<float>(std::atof(f[5].c_str()));
            if (std::isfinite(len) && len > 0.f) opening.len = std::clamp(len, std::max(kRoomMinLen, half * 2.f), kRoomMaxLen);
            if (std::isfinite(deep) && deep > 0.f) opening.deep = std::clamp(deep, kRoomMinDeep, kRoomMaxDeep);
        }
        list.push_back(opening);
    }
    for (auto& entry : byZone) world_.setOpenings(entry.first, std::move(entry.second));
}

void Game::saveExpansions() {
    std::string content;
    char buf[64];
    for (int zone = 0; zone < world_.zoneCount(); ++zone) {
        for (const Opening& o : world_.zone(zone).openings) {
            std::snprintf(buf, sizeof(buf), "%d\t%d\t%.1f\t%.1f\t%.1f\t%.1f\n", zone, o.dir, o.at, o.half, o.len, o.deep);
            content += buf;
        }
    }
    worker_.post([path = accounts_.dir() + "/expand.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}
