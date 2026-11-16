#include "core/world.hpp"

#include "base/text.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>

// ------------------------------------------------------------------- 강

River::River() {
    for (int i = 0; i < kRiverSamples; ++i) {
        const float x = static_cast<float>(i) * kRiverStep + 280.f;  // 예전 넓은 맵의 다리 근처와 같은 물굽이
        top_[i] = 850.f + 46.f * std::sin(x / 210.f) + 22.f * std::sin(x / 83.f + 1.3f);
        bottom_[i] = top_[i] + 200.f + 26.f * std::sin(x / 150.f + 0.7f);
    }
    // 다리 구간의 둑은 평평하게 만들어, 물가를 따라 걷다가 다리 입구에 걸리지 않게 한다.
    const int first = static_cast<int>(kBridgeL / kRiverStep);
    const int last = static_cast<int>(kBridgeR / kRiverStep);
    const int mid = (first + last) / 2;
    for (int i = first; i <= last; ++i) {
        top_[i] = top_[mid];
        bottom_[i] = bottom_[mid];
    }
}

float River::sample(const float* table, float x) {
    const float pos = std::clamp(x / kRiverStep, 0.f, static_cast<float>(kRiverSamples - 1));
    const int i = std::min(static_cast<int>(pos), kRiverSamples - 2);
    return table[i] + (table[i + 1] - table[i]) * (pos - static_cast<float>(i));
}

void River::pushToBank(float nx, float& ny) const {
    const float t = top(nx) - kShoreMargin;
    const float b = bottom(nx) + kShoreMargin;
    ny = (ny < (t + b) / 2.f) ? t : b;
}

void River::move(float& x, float& y, float nx, float ny) const {
    if (overWater(x, y) && onBridge(x)) nx = std::clamp(nx, kBridgeL + kShoreMargin, kBridgeR - kShoreMargin);
    if (inChannel(nx, ny) && !onBridge(nx)) pushToBank(nx, ny);
    x = nx;
    y = ny;
}

void River::moveOnBank(float& x, float& y, float nx, float ny) const {
    if (inChannel(nx, ny)) pushToBank(nx, ny);
    x = nx;
    y = ny;
}

float River::distanceToWater(float x, float y) const {
    if (y < top(x)) return top(x) - y;
    if (y > bottom(x)) return y - bottom(x);
    return 0.f;
}

void River::appendJson(std::string& out) const {
    const auto appendTable = [&out](const char* key, const float* table) {
        char buf[16];
        out += ",\"" + std::string(key) + "\":[";
        for (int i = 0; i < kRiverSamples; ++i) {
            std::snprintf(buf, sizeof(buf), i ? ",%.1f" : "%.1f", table[i]);
            out += buf;
        }
        out += ']';
    };
    out += ",\"step\":" + std::to_string(static_cast<int>(kRiverStep));
    appendTable("top", top_);
    appendTable("bot", bottom_);
}

// ----------------------------------------------------------------- 월드

// 기본 마을: 0번 구역(마을)과 강, 의자와 벤치, 나무, 가로등. 그 위에 모듈이 건물을 짓고, 다 지으면 publish 로 지도를 만든다.
World::World() {
    zones_.push_back({kWorldW, kWorldH, 0.f, 0.f, -1, -1});
    buildOverworld();
}

void World::put(int zone, const char* kind, float x, float y, float halfW, float depth) {
    furniture_.push_back({kind, zone, x, y});
    if (halfW > 0.f) solids_.push_back({zone, x - halfW, y - depth, x + halfW, y});
}

void World::addSeat(int zone, float x, float y, float faceX, float faceY, int side) {
    seats_.push_back({zone, x, y, faceX, faceY, side});
    staticSeats_ = seats_.size();
}

void World::addDecorSolid(int id, int zone, float x0, float y0, float x1, float y1) {
    decorSolids_.push_back({id, {zone, x0, y0, x1, y1}});
}

void World::removeDecorSolid(int id) {
    decorSolids_.erase(std::remove_if(decorSolids_.begin(), decorSolids_.end(), [id](const DecorSolid& d) { return d.id == id; }), decorSolids_.end());
}

bool World::overlapsSolid(int zone, float x0, float y0, float x1, float y1) const {
    const auto hits = [&](const Solid& s) { return s.zone == zone && x0 < s.x1 && x1 > s.x0 && y0 < s.y1 && y1 > s.y0; };
    return std::any_of(solids_.begin(), solids_.end(), hits) ||
           std::any_of(decorSolids_.begin(), decorSolids_.end(), [&](const DecorSolid& d) { return hits(d.solid); });
}

int World::addDynamicSeat(const Seat& seat) {
    for (size_t i = 0; i < seats_.size(); ++i) {
        if (seats_[i].zone == -1) {
            seats_[i] = seat;
            return static_cast<int>(i);
        }
    }
    seats_.push_back(seat);
    return static_cast<int>(seats_.size()) - 1;
}

void World::removeDynamicSeat(int index) {
    if (index >= 0 && index < static_cast<int>(seats_.size())) seats_[static_cast<size_t>(index)].zone = -1;
}

int World::reachableCells(int zone) const {
    constexpr float kCell = 16.f;
    const Zone& z = zones_[static_cast<size_t>(zone)];
    const int columns = static_cast<int>((z.w - z.minX) / kCell) + 1, rows = static_cast<int>((z.h - z.minY) / kCell) + 1;
    std::vector<char> seen(static_cast<size_t>(columns * rows), 0);
    std::vector<int> stack;
    const int startX = static_cast<int>((z.doorX - z.minX) / kCell), startY = static_cast<int>((z.doorY - 40.f - z.minY) / kCell);
    if (startX < 0 || startY < 0 || startX >= columns || startY >= rows) return 0;
    stack.push_back(startY * columns + startX);
    seen[static_cast<size_t>(stack.back())] = 1;
    int count = 0;
    while (!stack.empty()) {
        const int cell = stack.back();
        stack.pop_back();
        ++count;
        const int cx = cell % columns, cy = cell / columns;
        static constexpr int kSteps[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (const auto& move : kSteps) {
            const int nx = cx + move[0], ny = cy + move[1];
            if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
            const int next = ny * columns + nx;
            if (seen[static_cast<size_t>(next)]) continue;
            seen[static_cast<size_t>(next)] = 1;
            if (standable(zone, z.minX + static_cast<float>(nx) * kCell, z.minY + static_cast<float>(ny) * kCell)) stack.push_back(next);
        }
    }
    return count;
}

const Furniture* World::findFurniture(int zone, const std::string& kind) const {
    for (const Furniture& furniture : furniture_) {
        if (furniture.zone == zone && furniture.kind == kind) return &furniture;
    }
    return nullptr;
}

void World::buildOverworld() {
    // 스폰 지점 근처와 북쪽 물가에 강을 바라보게 놓는다.
    constexpr float kChairBankGap = 44.f;
    constexpr float kBenchHalfWidth = 46.f;
    constexpr float kBenchSeatGap = 22.f;

    const auto addChair = [this](float x, float y) {
        put(0, "chair", x, y);
        addSeat(0, x, y);
    };
    const auto addBench = [this](float x, float y) {
        put(0, "bench", x, y);
        addSeat(0, x - kBenchSeatGap, y, 0.f, 1.f, -1);
        addSeat(0, x + kBenchSeatGap, y, 0.f, 1.f, 1);
    };

    addChair(600.f, 650.f);
    addChair(840.f, 650.f);
    for (float x : {200.f, 460.f, 950.f, 1240.f}) addChair(x, river_.top(x) - kChairBankGap);

    addBench(720.f, 650.f);
    for (float x : {370.f, 605.f, 835.f, 1080.f}) {
        // 벤치 폭 안에서 강둑이 가장 북쪽인 곳을 기준으로 놓아 모래톱에 걸치지 않게 한다.
        const float bank = std::min({river_.top(x - kBenchHalfWidth), river_.top(x), river_.top(x + kBenchHalfWidth)});
        addBench(x, bank - kChairBankGap);
    }

    // 강가의 나무. {x, 강까지의 거리}. 북쪽은 의자 줄 뒤에, 다리 앞과 스폰 지점은 비워 둔다.
    const struct { float x, gap; } northTrees[] = {
        {40.f, 150.f},  {110.f, 108.f},  {175.f, 172.f},  {305.f, 118.f},
        {925.f, 122.f}, {1010.f, 112.f}, {1135.f, 160.f}, {1330.f, 110.f}, {1400.f, 168.f},
    };
    const struct { float x, gap; } southTrees[] = {
        {30.f, 120.f},  {150.f, 76.f},   {560.f, 84.f},   {860.f, 86.f},
        {1290.f, 112.f}, {1410.f, 78.f},
    };
    for (const auto& t : northTrees) trees_.push_back({t.x, river_.top(t.x) - t.gap});
    for (const auto& t : southTrees) trees_.push_back({t.x, river_.bottom(t.x) + t.gap});

    // 가로등: 의자와 나무 사이의 빈 곳, 다리 양쪽 입구에 놓는다.
    for (float x : {110.f, 295.f, 548.f, 670.f, 770.f, 995.f, 1160.f, 1330.f})
        lamps_.push_back({x, river_.top(x) - 26.f});
    for (float x : {90.f, 350.f, 670.f, 770.f, 925.f, 1190.f, 1380.f})
        lamps_.push_back({x, river_.bottom(x) + 26.f});
}

int World::addHouse(const std::string& name, int style, float x, float y, float roomW, float roomH) {
    return addPlace("house", name, style, x, y, 90.f, 45.f, 45.f, roomW, roomH, style);
}

int World::addPlace(const char* kind, const std::string& name, int style, float x, float y, float halfW, float back, float front,
                    float roomW, float roomH, int roomStyle) {
    const int zoneIndex = zoneCount();
    Building place;
    place.kind = kind;
    place.style = style;
    place.name = name;
    place.x = x;
    place.y = y;
    place.halfW = halfW;
    place.back = back;
    place.front = front;
    place.doorX = x;
    place.doorY = y + front;
    place.room = zoneIndex;
    buildings_.push_back(place);
    solids_.push_back({0, x - halfW, y - back, x + halfW, y + front});

    zones_.push_back({roomW, roomH, roomW / 2.f, roomH, static_cast<int>(buildings_.size()) - 1, roomStyle});
    return zoneIndex;
}

int World::addAnnex(const char* kind, const std::string& name, int outside, float doorX, float doorY, float roomW, float roomH, int roomStyle) {
    const Building& host = buildings_[static_cast<size_t>(zones_[static_cast<size_t>(outside)].building)];
    const int zoneIndex = static_cast<int>(zones_.size());
    Building place{};
    place.kind = kind;
    place.style = host.style;
    place.name = name;
    place.x = host.x;
    place.y = host.y;
    place.doorX = doorX;
    place.doorY = doorY;
    place.room = zoneIndex;
    place.outside = outside;
    buildings_.push_back(place);
    zones_.push_back({roomW, roomH, roomW / 2.f, roomH, static_cast<int>(buildings_.size()) - 1, roomStyle});
    return zoneIndex;
}

// 바닥이 아닌 곳을 전부 막아서 복도로 이어진 여러 방을 만든다. 클라이언트도 같은 충돌 영역을 받는다.
void World::carveRooms(int zone, std::vector<FloorRect> floors, float doorX, float doorY) {
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.doorX = doorX;
    z.doorY = doorY;
    std::vector<float> xs{z.minX, z.w}, ys{z.minY, z.h};
    for (const FloorRect& f : floors) {
        xs.insert(xs.end(), {f.x0, f.x1});
        ys.insert(ys.end(), {f.y0, f.y1});
    }
    const auto tidy = [](std::vector<float>& v) {
        std::sort(v.begin(), v.end());
        v.erase(std::unique(v.begin(), v.end()), v.end());
    };
    tidy(xs);
    tidy(ys);
    const auto isFloor = [&floors](float x, float y) {
        return std::any_of(floors.begin(), floors.end(), [x, y](const FloorRect& f) { return x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1; });
    };
    for (size_t row = 0; row + 1 < ys.size(); ++row) {
        const float midY = (ys[row] + ys[row + 1]) / 2.f;
        for (size_t col = 0; col + 1 < xs.size();) {
            if (isFloor((xs[col] + xs[col + 1]) / 2.f, midY)) {
                ++col;
                continue;
            }
            size_t end = col + 1;
            while (end + 1 < xs.size() && !isFloor((xs[end] + xs[end + 1]) / 2.f, midY)) ++end;
            solids_.push_back({zone, xs[col], ys[row], xs[end], ys[row + 1], true});
            col = end;
        }
    }
    z.floors = std::move(floors);
}

void World::markExpandable(int zone) {
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.baseW = z.w;
    z.baseH = z.h;
    z.single = z.floors.empty();
    z.base = z.single ? std::vector<FloorRect>{{0.f, 0.f, z.w, z.h, z.style}} : z.floors;
}

bool World::baseCell(int zone, Cell cell) const {
    const float x0 = static_cast<float>(cell.first) * kExpandCell, y0 = static_cast<float>(cell.second) * kExpandCell;
    const float x1 = x0 + kExpandCell, y1 = y0 + kExpandCell;
    for (const FloorRect& f : zones_[static_cast<size_t>(zone)].base) {
        if (x0 >= f.x0 && x1 <= f.x1 && y0 >= f.y0 && y1 <= f.y1) return true;
    }
    return false;
}

const char* World::cellProblem(int zone, Cell cell) const {
    const Zone& z = zones_[static_cast<size_t>(zone)];
    const float x0 = static_cast<float>(cell.first) * kExpandCell, y0 = static_cast<float>(cell.second) * kExpandCell;
    const float x1 = x0 + kExpandCell, y1 = y0 + kExpandCell;
    if (x0 < -kExpandReach || y0 < -kExpandReach || x1 > z.baseW + kExpandReach || y1 > z.baseH + kExpandReach) return "그쪽으로는 더 넓힐 수 없습니다.";
    for (const FloorRect& f : z.base) {
        if (x0 < f.x1 && x1 > f.x0 && y0 < f.y1 && y1 > f.y0) return "원래 방에 걸치는 칸입니다.";
    }
    // 문은 남쪽 벽에 있다. 문 바깥(아래)은 비워 두어야 드나들 수 있다
    if (x0 < z.doorX + 80.f && x1 > z.doorX - 80.f && y1 > z.doorY && y0 < z.doorY + 160.f) return "문 앞은 넓힐 수 없습니다.";
    return nullptr;
}

std::vector<FloorRect> World::mergeCells(const std::vector<Cell>& cells, int style) {
    // 줄마다 이어진 칸을 묶고, 바로 윗줄에 같은 폭으로 열린 사각형이 있으면 아래로 늘린다
    std::vector<Cell> sorted = cells;
    std::sort(sorted.begin(), sorted.end(), [](const Cell& a, const Cell& b) { return a.second != b.second ? a.second < b.second : a.first < b.first; });
    std::vector<FloorRect> done;
    struct Open {
        int x0, x1, y0, y1;
    };
    std::vector<Open> open;
    size_t i = 0;
    while (i < sorted.size()) {
        const int row = sorted[i].second;
        std::vector<std::pair<int, int>> runs;
        while (i < sorted.size() && sorted[i].second == row) {
            const int start = sorted[i].first;
            int end = start;
            ++i;
            while (i < sorted.size() && sorted[i].second == row && sorted[i].first == end + 1) end = sorted[i++].first;
            runs.push_back({start, end + 1});
        }
        std::vector<Open> next;
        for (const auto& run : runs) {
            const auto found = std::find_if(open.begin(), open.end(), [&](const Open& o) { return o.x0 == run.first && o.x1 == run.second && o.y1 == row; });
            if (found != open.end()) {
                next.push_back({found->x0, found->x1, found->y0, row + 1});
                open.erase(found);
            } else {
                next.push_back({run.first, run.second, row, row + 1});
            }
        }
        for (const Open& o : open) done.push_back({o.x0 * kExpandCell, o.y0 * kExpandCell, o.x1 * kExpandCell, o.y1 * kExpandCell, style});
        open = std::move(next);
    }
    for (const Open& o : open) done.push_back({o.x0 * kExpandCell, o.y0 * kExpandCell, o.x1 * kExpandCell, o.y1 * kExpandCell, style});
    return done;
}

bool World::overlapsFixed(int zone, float x0, float y0, float x1, float y1) const {
    return std::any_of(solids_.begin(), solids_.end(), [&](const Solid& s) { return s.zone == zone && !s.carved && x0 < s.x1 && x1 > s.x0 && y0 < s.y1 && y1 > s.y0; });
}

bool World::overlapsDecor(int zone, float x0, float y0, float x1, float y1) const {
    return std::any_of(decorSolids_.begin(), decorSolids_.end(), [&](const DecorSolid& d) {
        const Solid& s = d.solid;
        return s.zone == zone && x0 < s.x1 && x1 > s.x0 && y0 < s.y1 && y1 > s.y0;
    });
}

bool World::canReach(int zone, float x, float y) const {
    constexpr float kCell = 16.f;
    const Zone& z = zones_[static_cast<size_t>(zone)];
    const int columns = static_cast<int>((z.w - z.minX) / kCell) + 1, rows = static_cast<int>((z.h - z.minY) / kCell) + 1;
    const int targetX = static_cast<int>((x - z.minX) / kCell), targetY = static_cast<int>((y - z.minY) / kCell);
    const int startX = static_cast<int>((z.doorX - z.minX) / kCell), startY = static_cast<int>((z.doorY - 40.f - z.minY) / kCell);
    if (startX < 0 || startY < 0 || startX >= columns || startY >= rows) return false;
    std::vector<char> seen(static_cast<size_t>(columns * rows), 0);
    std::vector<int> stack{startY * columns + startX};
    seen[static_cast<size_t>(stack.back())] = 1;
    while (!stack.empty()) {
        const int cell = stack.back();
        stack.pop_back();
        const int cx = cell % columns, cy = cell / columns;
        if (std::abs(cx - targetX) <= 1 && std::abs(cy - targetY) <= 1) return true;
        static constexpr int kSteps[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (const auto& move : kSteps) {
            const int nx = cx + move[0], ny = cy + move[1];
            if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
            const int next = ny * columns + nx;
            if (seen[static_cast<size_t>(next)]) continue;
            seen[static_cast<size_t>(next)] = 1;
            if (standable(zone, z.minX + static_cast<float>(nx) * kCell, z.minY + static_cast<float>(ny) * kCell)) stack.push_back(next);
        }
    }
    return false;
}

void World::setCells(int zone, std::vector<Cell> cells, bool publish) {
    Zone& z = zones_[static_cast<size_t>(zone)];
    std::sort(cells.begin(), cells.end());
    cells.erase(std::unique(cells.begin(), cells.end()), cells.end());
    z.cells = std::move(cells);
    const std::vector<FloorRect> added = mergeCells(z.cells, z.style);
    // 원래 방의 뒷벽에 건 고정 장식(창 같은 것)은 그 벽 앞을 칠해 벽이 없어지면 숨긴다
    for (Furniture& f : furniture_) {
        if (f.zone != zone) continue;
        f.hidden = false;
        for (const FloorRect& b : z.base) {
            if (f.hidden || f.x < b.x0 || f.x > b.x1 || f.y >= b.y0 || f.y < b.y0 - kWallHeight - 20.f) continue;
            f.hidden = std::any_of(added.begin(), added.end(), [&](const FloorRect& a) {
                return a.x0 < f.x + 30.f && a.x1 > f.x - 30.f && a.y1 > b.y0 - kWallHeight && a.y0 < b.y0;
            });
        }
    }
    solids_.erase(std::remove_if(solids_.begin(), solids_.end(), [zone](const Solid& s) { return s.zone == zone && s.carved; }), solids_.end());
    z.w = z.baseW;
    z.h = z.baseH;
    z.minX = z.minY = 0.f;
    if (z.cells.empty() && z.single) {   // 넓힌 곳이 없으면 원래 한 방 그대로
        z.floors.clear();
        if (publish) mapJson_ = buildJson();
        return;
    }
    std::vector<FloorRect> floors = z.base;
    floors.insert(floors.end(), added.begin(), added.end());
    for (const FloorRect& f : floors) {
        z.minX = std::min(z.minX, f.x0);
        z.minY = std::min(z.minY, f.y0);
        z.w = std::max(z.w, f.x1);
        z.h = std::max(z.h, f.y1);
    }
    carveRooms(zone, std::move(floors), z.doorX, z.doorY);
    if (publish) mapJson_ = buildJson();
}

bool World::wallCut(int zone, const FloorRect& floor, float x0, float x1) const {
    for (const FloorRect& other : zones_[static_cast<size_t>(zone)].floors) {
        if (&other != &floor && other.x0 < x1 && other.x1 > x0 && other.y1 > floor.y0 - kWallHeight && other.y0 < floor.y0) return true;
    }
    return false;
}

bool World::floorCovers(int zone, float x0, float y0, float x1, float y1) const {
    const Zone& z = zones_[static_cast<size_t>(zone)];
    if (z.floors.empty()) return x0 >= 0.f && y0 >= 0.f && x1 <= z.w && y1 <= z.h;
    // 바닥은 10px 단위로 나뉘므로 10px 간격으로 찍어 보면 충분하다
    const auto onFloor = [&](float x, float y) {
        return std::any_of(z.floors.begin(), z.floors.end(), [x, y](const FloorRect& f) { return x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1; });
    };
    for (float y = y0;; y = std::min(y + 10.f, y1)) {
        for (float x = x0;; x = std::min(x + 10.f, x1)) {
            if (!onFloor(x, y)) return false;
            if (x >= x1) break;
        }
        if (y >= y1) break;
    }
    return true;
}

std::string World::zoneJson(int zone) const {
    std::string json = "{\"t\":\"room\",\"z\":" + std::to_string(zone) + ",\"zone\":";
    appendZone(json, zones_[static_cast<size_t>(zone)]);
    json += ",\"solids\":[";
    char buf[96];
    bool first = true;
    for (const Solid& s : solids_) {
        if (s.zone != zone) continue;
        std::snprintf(buf, sizeof(buf), "%s[%d,%.1f,%.1f,%.1f,%.1f]", first ? "" : ",", s.zone, s.x0, s.y0, s.x1, s.y1);
        json += buf;
        first = false;
    }
    json += "],\"furn\":[";
    first = true;
    for (const Furniture& f : furniture_) {
        if (f.zone != zone || f.hidden) continue;
        std::snprintf(buf, sizeof(buf), "%s{\"k\":\"%s\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", first ? "" : ",", f.kind.c_str(), f.zone, f.x, f.y);
        json += buf;
        first = false;
    }
    json += "]}";
    return json;
}

const FloorRect* World::floorAt(int zone, float x, float y) const {
    for (const FloorRect& f : zones_[static_cast<size_t>(zone)].floors) {
        if (x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1) return &f;
    }
    return nullptr;
}

bool World::blocked(int zone, float x, float y) const {
    const auto inside = [&](const Solid& solid) {
        return solid.zone == zone && x > solid.x0 - kBodyMargin && x < solid.x1 + kBodyMargin && y > solid.y0 - kBodyMargin &&
               y < solid.y1 + kBodyMargin;
    };
    return std::any_of(solids_.begin(), solids_.end(), inside) ||
           std::any_of(decorSolids_.begin(), decorSolids_.end(), [&](const DecorSolid& d) { return inside(d.solid); });
}

bool World::standable(int zone, float x, float y) const {
    if (zone < 0 || zone >= zoneCount()) return false;
    const Zone& z = zones_[static_cast<size_t>(zone)];
    if (x < z.minX + kRadius || y < z.minY + kRadius || x > z.w - kRadius || y > z.h - kRadius) return false;
    if (blocked(zone, x, y)) return false;
    return zone != 0 || river_.walkable(x, y);
}

bool World::nearestStandable(int zone, float x, float y, float maxDist, float& outX, float& outY) const {
    if (standable(zone, x, y)) {
        outX = x;
        outY = y;
        return true;
    }
    constexpr int kSteps = 32;
    for (float r = 8.f; r <= maxDist; r += 8.f) {   // 안쪽 고리부터 돌며 처음 찾은 곳
        for (int i = 0; i < kSteps; ++i) {
            const float a = static_cast<float>(i) * 6.2831853f / kSteps;
            const float cx = x + std::cos(a) * r, cy = y + std::sin(a) * r;
            if (standable(zone, cx, cy)) {
                outX = cx;
                outY = cy;
                return true;
            }
        }
    }
    return false;
}

void World::move(int zone, float& x, float& y, float nx, float ny) const {
    float cx = nx, cy = ny;
    if (zone == 0) {
        float rx = x, ry = y;
        river_.move(rx, ry, nx, ny);
        cx = rx;
        cy = ry;
    }
    if (blocked(zone, x, y)) {  // 어쩌다 가구 안에 있어도 빠져나올 수 있게
        x = cx;
        y = cy;
        return;
    }
    if (blocked(zone, cx, y)) cx = x;
    if (blocked(zone, cx, cy)) cy = y;
    x = cx;
    y = cy;
}

void World::moveCat(float& x, float& y, float nx, float ny) const {
    float cx = x, cy = y;
    river_.moveOnBank(cx, cy, nx, ny);
    if (blocked(0, cx, y)) cx = x;
    if (blocked(0, cx, cy)) cy = y;
    x = cx;
    y = cy;
}

// 구역 하나: 크기, 문, 꾸밈, 여러 방이면 바닥들, 넓힐 수 있는 집이면 뚫은 곳 [방향, 위치] 과 원래 방(들)
void World::appendZone(std::string& json, const Zone& z) const {
    char buf[160];
    std::snprintf(buf, sizeof(buf), "{\"w\":%.0f,\"h\":%.0f,\"door\":[%.0f,%.0f],\"b\":%d,\"style\":%d", z.w, z.h, z.doorX, z.doorY, z.building, z.style);
    json += buf;
    if (z.minX != 0.f || z.minY != 0.f) {
        std::snprintf(buf, sizeof(buf), ",\"x0\":%.0f,\"y0\":%.0f", z.minX, z.minY);
        json += buf;
    }
    const auto rects = [&](const char* key, const std::vector<FloorRect>& list) {
        json += ",\"" + std::string(key) + "\":[";
        for (size_t k = 0; k < list.size(); ++k) {
            const FloorRect& f = list[k];
            std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f,%.0f,%.0f,%d]", k ? "," : "", f.x0, f.y0, f.x1, f.y1, f.style);
            json += buf;
        }
        json += ']';
    };
    if (!z.floors.empty()) rects("floors", z.floors);
    if (!z.base.empty()) {   // 넓힐 수 있는 집: 원래 방, 칸 크기, 칠한 칸 수와 한도, 넓힐 수 있는 범위
        rects("base", z.base);
        std::snprintf(buf, sizeof(buf), ",\"cell\":%.0f,\"cells\":%zu,\"maxCells\":%d,\"reach\":[%.0f,%.0f,%.0f,%.0f]", kExpandCell, z.cells.size(), kExpandMaxCells,
                      -kExpandReach, -kExpandReach, z.baseW + kExpandReach, z.baseH + kExpandReach);
        json += buf;
    }
    json += '}';
}


std::string World::buildJson() const {
    std::string json = "{\"t\":\"map\"";
    river_.appendJson(json);

    char buf[256];
    std::snprintf(buf, sizeof(buf), ",\"bridge\":[%.0f,%.0f],\"margin\":%.0f,\"body\":%.0f,\"chairReach\":%.0f,\"doorReach\":%.0f,\"bedReach\":%.0f",
                  kBridgeL, kBridgeR, kShoreMargin, kBodyMargin, kChairReach, kDoorReach, kBedReach);
    json += buf;

    const auto appendList = [&json](const char* key, size_t count, const auto& item) {
        json += ",\"" + std::string(key) + "\":[";
        for (size_t i = 0; i < count; ++i) {
            if (i > 0) json += ',';
            item(i);
        }
        json += ']';
    };

    appendList("zones", zones_.size(), [&](size_t i) { appendZone(json, zones_[i]); });
    appendList("buildings", buildings_.size(), [&](size_t i) {
        const Building& b = buildings_[i];
        std::snprintf(buf, sizeof(buf),
                      "{\"k\":\"%s\",\"style\":%d,\"x\":%.0f,\"y\":%.0f,\"halfW\":%.0f,\"back\":%.0f,\"front\":%.0f,"
                      "\"door\":[%.0f,%.0f],\"room\":%d,\"in\":%d,\"deck\":[%.0f,%.0f,%.0f,%.0f],\"name\":\"",
                      b.kind.c_str(), b.style, b.x, b.y, b.halfW, b.back, b.front, b.doorX, b.doorY, b.room, b.outside, b.deckX0,
                      b.deckY0, b.deckX1, b.deckY1);
        json += buf;
        json += text::jsonEscape(b.name);
        json += "\"}";
    });
    appendList("solids", solids_.size(), [&](size_t i) {
        const Solid& s = solids_[i];
        std::snprintf(buf, sizeof(buf), "[%d,%.1f,%.1f,%.1f,%.1f]", s.zone, s.x0, s.y0, s.x1, s.y1);
        json += buf;
    });
    std::vector<const Furniture*> shown;
    for (const Furniture& f : furniture_) {
        if (!f.hidden) shown.push_back(&f);
    }
    appendList("furn", shown.size(), [&](size_t i) {
        const Furniture& f = *shown[i];
        std::snprintf(buf, sizeof(buf), "{\"k\":\"%s\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", f.kind.c_str(), f.zone, f.x, f.y);
        json += buf;
    });
    // 고정된 자리만 보낸다. 놓은 가구의 자리는 방에 들어갈 때 decor 메시지로 따로 간다
    appendList("seats", staticSeats_, [&](size_t i) {
        const Seat& s = seats_[i];
        std::snprintf(buf, sizeof(buf), "{\"z\":%d,\"x\":%.1f,\"y\":%.1f,\"fx\":%.2f,\"fy\":%.2f,\"side\":%d,\"lie\":%d,\"sy\":%.1f}", s.zone, s.x,
                      s.y, s.faceX, s.faceY, s.side, s.lie ? 1 : 0, s.sortY);
        json += buf;
    });
    appendList("trees", trees_.size(), [&](size_t i) {
        std::snprintf(buf, sizeof(buf), "{\"x\":%.1f,\"y\":%.1f}", trees_[i].x, trees_[i].y);
        json += buf;
    });
    appendList("lamps", lamps_.size(), [&](size_t i) {
        std::snprintf(buf, sizeof(buf), "{\"x\":%.1f,\"y\":%.1f}", lamps_[i].x, lamps_[i].y);
        json += buf;
    });
    if (extraJson_) extraJson_(json);   // 모듈이 덧붙이는 필드
    json += '}';
    return json;
}
void World::publish() {
    mapJson_ = buildJson();
}

void World::addFurniture(const Furniture& furniture) {
    furniture_.push_back(furniture);
}

void World::addSolid(const Solid& solid) {
    solids_.push_back(solid);
}

void World::addBuilding(const Building& building) {
    buildings_.push_back(building);
}
