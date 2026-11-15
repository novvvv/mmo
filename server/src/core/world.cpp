#include "core/world.hpp"

#include "activity/darts.hpp"
#include "home/decor.hpp"
#include "activity/farm.hpp"

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

World::World() {
    zones_.push_back({kWorldW, kWorldH, 0.f, 0.f, -1, -1});
    buildOverworld();
    buildCafe();

    // 집의 위치는 건물 바닥의 중심이다. 구역 번호(집 1~3, 극장 4, 카지노 5, 재즈바 6)는 저장된 가구와 방명록이 쓰므로 순서를 지킨다.
    const int brick = addHouse("몰쟈", 0, 1105.f, 1309.f, 680.f, 440.f);
    const int cabin = addHouse("랏라", 1, 449.f, 1316.f, 620.f, 460.f);
    const int loft = addHouse("캬캬", 2, 676.f, 1391.f, 1120.f, 900.f);
    furnishBrickHouse(brick, 680.f, 440.f);
    zones_[static_cast<size_t>(brick)].lighting = true;
    furnishCabin(cabin, 620.f, 460.f);
    furnishLoftHouse(loft);
    for (const int house : {brick, cabin, loft}) markExpandable(house);
    const int theater = addPlace("theater", "극장", 3, 720.f, 160.f, 170.f, 60.f, 60.f, 1000.f, 640.f, 5);
    furnishTheater(theater);
    furnishCasino(addPlace("casino", "카지노", 4, 360.f, 160.f, 118.f, 50.f, 60.f, 960.f, 600.f, 6));   // 예전 슬라임 군락지 자리 (구역 5)
    furnishJazzBar(addPlace("jazz", "재즈바", 5, 1080.f, 160.f, 110.f, 50.f, 60.f, 900.f, 600.f, 7));

    // 극장 뒷벽 오른쪽 끝의 문으로 들어가는 특별관 (구역 7). 스크린이 훨씬 크고 3인용 소파 하나만 있다
    furnishScreeningRoom(addAnnex("theater", "특별관", theater, 955.f, 0.f, 1360.f, 640.f, 5));

    // 마을 동쪽 끝의 나무 문으로 들어가는 농장 (구역 8): 함께 쓰는 밭, 씨앗 가게, 출하 상자, 닭장과 젖소, 바깥 조리대
    farmZone_ = addPlace("farm", "농장", 6, 1340.f, 520.f, 46.f, 14.f, 14.f, 1200.f, 760.f, 8);
    furnishFarm(farmZone_);

    mapJson_ = buildJson();
}

// 농장: 왼쪽에 밭 6 × 4 칸, 오른쪽에 가게와 조리대, 출하 상자, 닭장, 젖소
void World::furnishFarm(int zone) {
    for (int row = 0; row < 4; ++row) {
        for (int col = 0; col < 6; ++col) {
            const float x = 170.f + static_cast<float>(col) * 118.f, y = 250.f + static_cast<float>(row) * 112.f;
            put(zone, "farm_plot", x, y);
            farmPlots_.push_back({x, y});
        }
    }
    put(zone, "farm_scarecrow", 820.f, 120.f, 10.f, 8.f);
    put(zone, "farm_stall", 980.f, 150.f, 76.f, 34.f);
    put(zone, "farm_kitchen", 1070.f, 340.f, 70.f, 32.f);
    put(zone, "farm_bin", 900.f, 430.f, 36.f, 26.f);
    put(zone, "farm_coop", 960.f, 640.f, 62.f, 36.f);
    put(zone, "farm_cow", 1110.f, 600.f, 46.f, 20.f);
    put(zone, "farm_well", 90.f, 690.f, 30.f, 22.f);
}

void World::put(int zone, const char* kind, float x, float y, float halfW, float depth) {
    furniture_.push_back({kind, zone, x, y});
    if (halfW > 0.f) solids_.push_back({zone, x - halfW, y - depth, x + halfW, y});
}

void World::seed(int zone, const char* kind, float x, float y, int gen) {
    seeds_.push_back({zone, kind, x, y, false, 0.f, 1.f, 0, gen});
}

void World::seedFacing(int zone, const char* kind, float x, float y, float faceX, float faceY, int side) {
    seeds_.push_back({zone, kind, x, y, true, faceX, faceY, side, 1});
}

void World::addSeat(int zone, float x, float y, float faceX, float faceY, int side) {
    seats_.push_back({zone, x, y, faceX, faceY, side});
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

void World::addCafeTable(float x, float y) {
    furniture_.push_back({"cafe_table", 0, x, y});
    solids_.push_back({0, x - 18.f, y - 12.f, x + 18.f, y + 8.f});

    // 테이블의 네 모서리에 둘러앉는다. 뒤쪽 두 자리는 테이블에 가려지고 앞쪽 두 자리는 앞에 그려진다.
    const struct { float dx, dy; int side; } places[] = {
        {-38.f, -26.f, -1}, {38.f, -26.f, 1}, {-42.f, 26.f, -1}, {42.f, 26.f, 1},
    };
    for (const auto& place : places) {
        const float len = std::hypot(place.dx, place.dy);
        put(0, "stool", x + place.dx, y + place.dy);
        addSeat(0, x + place.dx, y + place.dy, -place.dx / len, -place.dy / len, place.side);
    }
}

void World::buildCafe() {
    constexpr float kX = 540.f, kY = 400.f;

    Building cafe;
    cafe.kind = "cafe";
    cafe.style = 0;
    cafe.name = "카페";
    cafe.x = kX;
    cafe.y = kY;
    cafe.halfW = 115.f;
    cafe.back = 45.f;
    cafe.front = 45.f;
    cafe.doorX = kX;
    cafe.doorY = kY + 45.f;
    cafe.room = -1;
    cafe.deckX0 = kX - 148.f;
    cafe.deckY0 = kY + 49.f;
    cafe.deckX1 = kX + 148.f;
    cafe.deckY1 = kY + 179.f;
    buildings_.push_back(cafe);
    solids_.push_back({0, kX - cafe.halfW, kY - cafe.back, kX + cafe.halfW, kY + cafe.front});

    addCafeTable(kX - 66.f, kY + 124.f);
    addCafeTable(kX + 66.f, kY + 124.f);
    put(0, "menu_board", kX + 136.f, kY + 72.f);
    put(0, "planter", kX - 136.f, kY + 66.f);
    put(0, "planter", kX - 140.f, kY + 178.f);
    put(0, "planter", kX + 140.f, kY + 178.f);
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

// 특별관: 방 폭을 거의 다 채우는 큰 스크린과 그 앞의 3인용 소파 하나
void World::furnishScreeningRoom(int zone) {
    constexpr float kW = 1360.f;
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.lighting = true;
    z.lightLevel = 15;

    put(zone, "cinema_screen_big", kW / 2.f, 441.f, 640.f, 441.f);
    for (int col = -1; col <= 1; ++col) addSeat(zone, kW / 2.f + 58.f * static_cast<float>(col), 500.f, 0.f, -1.f);
    put(zone, "cinema_sofa", kW / 2.f, 518.f);  // 앉은 사람 앞에 그려지도록 자리보다 아래에 둔다
}

// 극장: 앞쪽 무대의 큰 스크린을 향해 붉은 좌석이 줄지어 있고, 뒤쪽에 매점이 있다.
void World::furnishTheater(int zone) {
    constexpr float kW = 1000.f;
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.lighting = true;
    z.lightLevel = 15;

    put(zone, "cinema_screen", kW / 2.f, 205.f, 420.f, 205.f);
    for (int row = 0; row < 5; ++row) {
        const float y = 270.f + static_cast<float>(row) * 58.f;
        for (int side = -1; side <= 1; side += 2) {
            for (int col = 0; col < 6; ++col) {
                addSeat(zone, kW / 2.f + static_cast<float>(side) * (90.f + 58.f * static_cast<float>(col)), y, 0.f, -1.f);
            }
        }
        put(zone, "cinema_row", kW / 2.f, y + 18.f);  // 앉은 사람 앞에 그려지도록 자리보다 아래에 둔다
    }
    put(zone, "snack_bar", 840.f, 596.f, 110.f, 36.f);
    put(zone, "movie_poster", 90.f, 300.f);
    put(zone, "cinema_door", 955.f, 0.f);  // 특별관으로 가는 문. 문 자체는 addAnnex 가 만든다
}

// 재즈바: 술병 선반과 긴 바, 바 안쪽의 바텐더, 오른쪽의 레코드판, 앞쪽의 테이블
void World::furnishJazzBar(int zone) {
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.lighting = true;
    z.lightLevel = 25;
    jazzZone_ = zone;

    put(zone, "bottle_shelf", 170.f, -62.f);
    put(zone, "bottle_shelf", 400.f, -62.f);
    put(zone, "gold_frame", 556.f, -66.f);
    put(zone, "gold_frame", 646.f, -66.f);
    put(zone, "dart_board", 735.f, -66.f);
    put(zone, "dart_line", 735.f, 100.f);

    put(zone, "bartender", 110.f, 92.f);
    put(zone, "bar_counter", 305.f, 150.f, 305.f, 50.f);   // 왼쪽 벽까지 막아 바 안으로 들어갈 수 없다
    put(zone, "bar_counter_side", 636.f, 200.f, 26.f, 200.f);
    for (int i = 0; i < 7; ++i) {
        const float x = 200.f + static_cast<float>(i) * 60.f;
        put(zone, "plum_stool", x, 178.f);
        addSeat(zone, x, 178.f, 0.f, -1.f);
    }

    put(zone, "record_player", 846.f, 250.f, 44.f, 18.f);  // 오른쪽 위 재생 창에 가리지 않는 자리

    const struct { float x, y; } tables[] = {{190.f, 400.f}, {450.f, 330.f}, {720.f, 400.f}};
    for (const auto& table : tables) {
        put(zone, "bar_table", table.x, table.y, 30.f, 14.f);
        for (int side = -1; side <= 1; side += 2) {
            const float x = table.x + static_cast<float>(side) * 66.f;
            put(zone, "velvet_chair", x, table.y + 6.f);
            addSeat(zone, x, table.y + 6.f, static_cast<float>(-side), 0.f, side);
        }
    }
}

// 카지노: 빠칭코 기계가 두 줄로 서 있고(앞줄 5대, 뒷줄 3대), 오른쪽에 룰렛 테이블과 환전소, 쉬는 탁자가 있다.
// 기계 앞 의자에 앉으면 빠칭코 창이 열린다. 줄 사이를 넉넉히 띄워 앞줄에 앉은 사람이 뒷줄 기계에 가리지 않는다.
void World::furnishCasino(int zone) {
    constexpr float kW = 960.f;
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.lighting = true;
    z.lightLevel = 45;
    casinoZone_ = zone;

    put(zone, "casino_sign", kW / 2.f, -70.f);
    for (const float x : {150.f, kW - 150.f}) put(zone, "gold_frame", x, -66.f);
    const auto machine = [&](float x, float y) {
        put(zone, "pachinko", x, y, 32.f, 34.f);
        put(zone, "plum_stool", x, y + 60.f);
        pachinkoSeats_.push_back(static_cast<int>(seats_.size()));
        addSeat(zone, x, y + 60.f, 0.f, -1.f);
    };
    for (int i = 0; i < 5; ++i) machine(130.f + static_cast<float>(i) * 94.f, 170.f);
    for (int i = 0; i < 3; ++i) machine(130.f + static_cast<float>(i) * 94.f, 440.f);
    put(zone, "roulette", 730.f, 300.f, 96.f, 44.f);
    for (int side = -1; side <= 1; side += 2) {
        const float x = 730.f + static_cast<float>(side) * 140.f;
        put(zone, "velvet_chair", x, 308.f);
        addSeat(zone, x, 308.f, static_cast<float>(-side), 0.f, side);
    }
    put(zone, "cashier", 820.f, 540.f, 84.f, 34.f);
    put(zone, "bar_table", 600.f, 470.f, 30.f, 14.f);
    for (int side = -1; side <= 1; side += 2) {
        const float x = 600.f + static_cast<float>(side) * 66.f;
        put(zone, "velvet_chair", x, 476.f);
        addSeat(zone, x, 476.f, static_cast<float>(-side), 0.f, side);
    }
    put(zone, "tall_plant", 40.f, 40.f, 18.f, 14.f);
    put(zone, "tall_plant", kW - 40.f, 40.f, 18.f, 14.f);
    put(zone, "tall_plant", 40.f, 560.f, 18.f, 14.f);
}

// 몰쟈의 집: 큰 통창 너머로 숲이 보이는 콘크리트와 검은 프레임의 집
void World::furnishBrickHouse(int zone, float w, float h) {
    roomCats_.push_back({zone, 480.f, 360.f});

    // 모두 옮기거나 소지품에 넣을 수 있는 가구다. 처음 설치형이 된 묶음(1)과 뒤에 더한 묶음(2)이 있다
    seed(zone, "big_window", 135.f, -62.f, 2);
    seed(zone, "big_window", w - 135.f, -62.f, 2);
    seed(zone, "fireplace", w / 2.f, 34.f, 2);
    seed(zone, "tv_wall", w / 2.f, 36.f, 2);  // 벽난로 위. 소파와 안락의자가 이쪽을 바라본다
    seed(zone, "glass_partition", 508.f, 240.f, 2);
    seed(zone, "floor_lamp", 520.f, 306.f, 2);
    seed(zone, "tall_plant", 252.f, 46.f);
    seed(zone, "tall_plant", 428.f, 46.f);
    seed(zone, "rug_plain", w / 2.f, 196.f);
    seed(zone, "glass_table", w / 2.f, 200.f);
    seed(zone, "sofa_cream", w / 2.f, 304.f);
    seedFacing(zone, "armchair", 196.f, 190.f, 0.8f, -0.6f, -1);
    seedFacing(zone, "armchair", w - 196.f, 190.f, -0.8f, -0.6f, 1);
    seed(zone, "kitchen_bar", 92.f, 96.f);
    seed(zone, "bed", 590.f, 158.f);
    seed(zone, "dining_table", 150.f, 340.f);
    seed(zone, "pendant_frame", 110.f, 340.f, 3);  // 식탁 위 나무 틀 조명 두 개 (3번째 묶음)
    seed(zone, "pendant_frame", 190.f, 340.f, 3);
    seedFacing(zone, "black_stool", 112.f, 378.f, 0.f, -1.f, -1);
    seedFacing(zone, "black_stool", 188.f, 378.f, 0.f, -1.f, 1);
    seed(zone, "monstera", w - 44.f, h - 44.f);
    seed(zone, "monstera", 44.f, 200.f);
}

// 랏라의 집: 숲속 통나무집답게 화분과 어항, 해먹이 있는 방
void World::furnishCabin(int zone, float w, float h) {
    put(zone, "ivy", 90.f, -104.f);
    put(zone, "ivy", w / 2.f, -104.f);
    put(zone, "ivy", w - 90.f, -104.f);
    put(zone, "window", 150.f, -62.f);
    put(zone, "window", w - 150.f, -62.f);

    put(zone, "bench", w / 2.f, 64.f);
    addSeat(zone, w / 2.f - 22.f, 64.f, 0.f, 1.f, -1);
    addSeat(zone, w / 2.f + 22.f, 64.f, 0.f, 1.f, 1);

    put(zone, "plant", 60.f, 58.f, 20.f, 16.f);
    put(zone, "plant", w - 60.f, 58.f, 20.f, 16.f);
    put(zone, "plant", 40.f, 330.f, 20.f, 16.f);
    put(zone, "plant", w - 40.f, 330.f, 20.f, 16.f);
    put(zone, "aquarium", 122.f, 226.f, 54.f, 30.f);

    put(zone, "hammock", w - 142.f, 214.f);
    addSeat(zone, w - 142.f, 214.f);

    put(zone, "rug_leaf", w / 2.f, 322.f);
    put(zone, "stump", w / 2.f, 322.f, 24.f, 16.f);
    put(zone, "stool", w / 2.f - 66.f, 318.f);
    addSeat(zone, w / 2.f - 66.f, 318.f, 1.f, 0.f, -1);
    put(zone, "stool", w / 2.f + 66.f, 318.f);
    addSeat(zone, w / 2.f + 66.f, 318.f, -1.f, 0.f, 1);

    put(zone, "potting_bench", 140.f, h - 28.f, 72.f, 30.f);
    put(zone, "plant_small", w - 130.f, h - 42.f, 14.f, 12.f);
    put(zone, "tv", 470.f, 380.f, 54.f, 14.f);
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

const FloorRect& World::edgeRoom(int zone, int dir) const {
    return edgeOf(zones_[static_cast<size_t>(zone)].base, dir);
}

const FloorRect& World::edgeOf(const std::vector<FloorRect>& base, int dir) {
    const FloorRect* best = &base.front();
    for (const FloorRect& f : base) {
        const float span = dir <= kExpandDown ? f.x1 - f.x0 : f.y1 - f.y0, bestSpan = dir <= kExpandDown ? best->x1 - best->x0 : best->y1 - best->y0;
        const float edge = dir == kExpandUp ? -f.y0 : dir == kExpandDown ? f.y1 : dir == kExpandLeft ? -f.x0 : f.x1;
        const float bestEdge = dir == kExpandUp ? -best->y0 : dir == kExpandDown ? best->y1 : dir == kExpandLeft ? -best->x0 : best->x1;
        if (edge > bestEdge || (edge == bestEdge && span > bestSpan)) best = &f;
    }
    return *best;
}

float World::maxOpeningHalf(const FloorRect& edge, int dir) {
    return dir <= kExpandDown ? std::min(edge.x1 - edge.x0, kExpandMaxW) / 2.f : std::min(edge.y1 - edge.y0, kExpandMaxH) / 2.f;
}

void World::expansionRects(const FloorRect& edge, int dir, float at, float half, FloorRect& corridor, FloorRect& room, float len, float deep) {
    // 방은 되도록 원래 방의 벽 안쪽에 맞추고, 벽보다 길게 정했으면 원래 방의 가운데에 맞춘다. 어느 쪽이든 통로는 방 안에 든다
    const auto along = [&](float lo, float hi, float size) {
        return size <= hi - lo ? std::clamp(at - size / 2.f, lo, hi - size) : (lo + hi - size) / 2.f;
    };
    if (dir == kExpandUp || dir == kExpandDown) {
        const float w = len > 0.f ? len : std::min(edge.x1 - edge.x0, kExpandMaxW), d = deep > 0.f ? deep : kExpandDepth;
        const float x0 = along(edge.x0, edge.x1, w);
        if (dir == kExpandUp) {
            corridor = {at - half, edge.y0 - kFrontCorridor, at + half, edge.y0, edge.style};
            room = {x0, corridor.y0 - d, x0 + w, corridor.y0, edge.style};
        } else {
            corridor = {at - half, edge.y1, at + half, edge.y1 + kFrontCorridor, edge.style};
            room = {x0, corridor.y1, x0 + w, corridor.y1 + d, edge.style};
        }
        return;
    }
    const float h = len > 0.f ? len : std::min(edge.y1 - edge.y0, kExpandMaxH), d = deep > 0.f ? deep : kExpandSideW;
    const float y0 = along(edge.y0, edge.y1, h);
    if (dir == kExpandLeft) {
        corridor = {edge.x0 - kSideCorridor, at - half, edge.x0, at + half, edge.style};
        room = {corridor.x0 - d, y0, corridor.x0, y0 + h, edge.style};
    } else {
        corridor = {edge.x1, at - half, edge.x1 + kSideCorridor, at + half, edge.style};
        room = {corridor.x1, y0, corridor.x1 + d, y0 + h, edge.style};
    }
}

bool World::coversOpening(const Furniture& f, const FloorRect& edge, int dir, float at, float half) {
    return dir == kExpandUp && f.y < edge.y0 && f.y > edge.y0 - kWallHeight - 20.f && f.x > edge.x0 && f.x < edge.x1 && std::fabs(f.x - at) < half + 50.f;
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

void World::setOpenings(int zone, std::vector<Opening> openings, bool publish) {
    Zone& z = zones_[static_cast<size_t>(zone)];
    for (Furniture& f : furniture_) {
        if (f.zone != zone) continue;
        f.hidden = std::any_of(openings.begin(), openings.end(), [&](const Opening& o) { return coversOpening(f, edgeRoom(zone, o.dir), o.dir, o.at, o.half); });
    }
    solids_.erase(std::remove_if(solids_.begin(), solids_.end(), [zone](const Solid& s) { return s.zone == zone && s.carved; }), solids_.end());
    std::sort(openings.begin(), openings.end(), [](const Opening& a, const Opening& b) { return a.dir < b.dir; });
    z.openings = std::move(openings);
    z.w = z.baseW;
    z.h = z.baseH;
    z.minX = z.minY = 0.f;
    if (z.openings.empty() && z.single) {   // 넓힌 곳이 없으면 원래 한 방 그대로
        z.floors.clear();
        if (publish) mapJson_ = buildJson();
        return;
    }
    std::vector<FloorRect> floors = z.base;
    for (const Opening& o : z.openings) {
        FloorRect corridor{}, room{};
        expansionRects(edgeRoom(zone, o.dir), o.dir, o.at, o.half, corridor, room, o.len, o.deep);
        floors.push_back(corridor);
        floors.push_back(room);
    }
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
        if (&other != &floor && other.y1 == floor.y0 && other.x0 < x1 && other.x1 > x0) return true;
    }
    return false;
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

int World::houseDoorNear(float x, float y, float reach) const {
    for (const Building& b : buildings_) {
        if (b.kind == "house" && b.room > 0 && std::hypot(b.doorX - x, b.doorY - y) <= reach) return b.room;
    }
    return -1;
}

const FloorRect* World::floorAt(int zone, float x, float y) const {
    for (const FloorRect& f : zones_[static_cast<size_t>(zone)].floors) {
        if (x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1) return &f;
    }
    return nullptr;
}

bool World::hasTv(int zone) const {
    return findFurniture(zone, "tv") || findFurniture(zone, "tv_wall") || findFurniture(zone, "cinema_screen") || findFurniture(zone, "cinema_screen_big");
}

bool World::lampNear(int zone, float x, float y) const {
    return std::any_of(furniture_.begin(), furniture_.end(), [=](const Furniture& f) {
        return f.zone == zone && (f.kind == "floor_lamp" || f.kind == "lantern_lamp") && std::hypot(f.x - x, f.y - y) <= kLampReach;
    });
}

// 캬캬의 집: 흰 벽돌과 나무 바닥의 거실. 왼쪽 복도 끝에 침실, 왼쪽 아래 복도 끝에 주방이 있다. 식물은 두지 않는다.
void World::furnishLoftHouse(int zone) {
    constexpr float kX = 460.f;  // 거실의 왼쪽 벽. 거실 안의 가구는 이 값을 더해 놓는다
    constexpr float kRoomH = 420.f;
    carveRooms(zone,
               {
                   {0.f, 0.f, 400.f, 380.f, 3},         // 침실
                   {400.f, 170.f, kX, 250.f, 2},        // 침실로 가는 복도
                   {kX, 0.f, kX + 660.f, kRoomH, 2},    // 거실
                   {470.f, kRoomH, 550.f, 580.f, 2},    // 주방으로 가는 복도
                   {200.f, 580.f, 640.f, 900.f, 4},     // 주방
               },
               kX + 330.f, kRoomH);
    Zone& z = zones_[static_cast<size_t>(zone)];
    z.lighting = true;
    z.lightLevel = 70;

    // ---- 거실
    seed(zone, "sheer_window", kX + 268.f, -64.f, 2);
    seed(zone, "sheer_window", kX + 540.f, -64.f, 2);

    put(zone, "piano", kX + 130.f, 66.f, 72.f, 44.f);
    put(zone, "stool", kX + 130.f, 110.f);
    pianoSeat_ = static_cast<int>(seats_.size());
    addSeat(zone, kX + 130.f, 110.f, 0.f, -1.f);

    seed(zone, "lantern_lamp", kX + 262.f, 110.f, 2);
    seed(zone, "tv", kX + 404.f, 50.f, 2);  // 창 사이 벽에 건 TV와 아래 수납장. 소파가 이쪽을 바라본다
    roomCats_.push_back({zone, kX + 200.f, 320.f});

    // 피아노와 포스터만 그대로 두고 나머지는 옮기거나 소지품에 넣을 수 있는 가구다
    seed(zone, "rug_diamond", kX + 404.f, 190.f);
    seed(zone, "coffee_round", kX + 404.f, 200.f);
    seed(zone, "sofa_l", kX + 404.f, 294.f);
    constexpr float kTableX = kX + 586.f, kTableY = 258.f;  // 둥근 식탁과 나무 의자 네 개
    seed(zone, "round_dining", kTableX, kTableY);
    const struct { float dx, dy; int side; } places[] = {{-52.f, -30.f, -1}, {52.f, -30.f, 1}, {-56.f, 32.f, -1}, {56.f, 32.f, 1}};
    for (const auto& place : places) {
        const float len = std::hypot(place.dx, place.dy);
        seedFacing(zone, "dining_chair", kTableX + place.dx, kTableY + place.dy, -place.dx / len, -place.dy / len, place.side);
    }
    seed(zone, "book_pile", kX + 620.f, 396.f);

    // ---- 침실
    put(zone, "nimda_poster", 207.f, -66.f);
    seed(zone, "sheer_window", 320.f, -64.f, 2);
    seed(zone, "lantern_lamp", 44.f, 346.f, 2);
    seed(zone, "round_mirror", 110.f, -66.f);
    seed(zone, "vanity", 110.f, 72.f);
    seedFacing(zone, "stool", 110.f, 112.f, 0.f, -1.f, 0);
    seed(zone, "linen_bed", 320.f, 150.f);
    seed(zone, "rug_shag", 150.f, 280.f);
    seedFacing(zone, "pouf", 90.f, 290.f, 1.f, 0.f, -1);
    seedFacing(zone, "accent_chair", 232.f, 290.f, -1.f, 0.f, 1);

    // ---- 주방
    seed(zone, "sheer_window", 595.f, 516.f, 2);
    seed(zone, "lantern_lamp", 232.f, 700.f, 2);
    seed(zone, "kitchen_counter", 335.f, 622.f);
    seed(zone, "kitchen_island", 540.f, 728.f);
    seedFacing(zone, "bar_stool", 510.f, 762.f, 0.f, -1.f, -1);
    seedFacing(zone, "bar_stool", 570.f, 762.f, 0.f, -1.f, 1);
    seed(zone, "long_table", 340.f, 824.f);
    for (float dx : {-62.f, 0.f, 62.f}) seed(zone, "pendant_cone", 340.f + dx, 824.f, 3);  // 긴 식탁 위 검은 조명 세 개
    for (float x : {290.f, 390.f}) {
        seedFacing(zone, "white_chair", x, 786.f, 0.f, 1.f, x < 340.f ? -1 : 1);
        seedFacing(zone, "white_chair", x, 862.f, 0.f, -1.f, x < 340.f ? -1 : 1);
    }
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
    if (!z.base.empty()) {
        rects("base", z.base);
        json += ",\"open\":[";
        for (size_t k = 0; k < z.openings.size(); ++k) {
            const Opening& o = z.openings[k];   // [방향, 통로 가운데, 통로 폭, 방의 벽과 나란한 길이, 방의 깊이]
            FloorRect corridor{}, room{};
            expansionRects(edgeOf(z.base, o.dir), o.dir, o.at, o.half, corridor, room, o.len, o.deep);
            const bool vertical = o.dir <= kExpandDown;
            std::snprintf(buf, sizeof(buf), "%s[%d,%.0f,%.0f,%.0f,%.0f]", k ? "," : "", o.dir, o.at, o.half * 2.f, vertical ? room.x1 - room.x0 : room.y1 - room.y0,
                          vertical ? room.y1 - room.y0 : room.x1 - room.x0);
            json += buf;
        }
        json += "],\"omax\":[";   // 방향마다 낼 수 있는 가장 넓은 통로
        for (int dir = 0; dir < 4; ++dir) {
            std::snprintf(buf, sizeof(buf), "%s%.0f", dir ? "," : "", maxOpeningHalf(edgeOf(z.base, dir), dir) * 2.f);
            json += buf;
        }
        std::snprintf(buf, sizeof(buf), "],\"osize\":[%.0f,%.0f,%.0f,%.0f]", kRoomMinLen, kRoomMaxLen, kRoomMinDeep, kRoomMaxDeep);
        json += buf;
    }
    json += '}';
}

std::string World::buildJson() const {
    std::string json = "{\"t\":\"map\"";
    river_.appendJson(json);

    char buf[256];
    std::snprintf(buf, sizeof(buf),
                  ",\"bridge\":[%.0f,%.0f],\"margin\":%.0f,\"body\":%.0f,\"chairReach\":%.0f,\"doorReach\":%.0f,"
                  "\"fishReach\":%.0f,\"catReach\":%.0f,\"lampReach\":%.0f,\"tvReach\":%.0f,\"shopReach\":%.0f,\"pianoSeat\":%d",
                  kBridgeL, kBridgeR, kShoreMargin, kBodyMargin, kChairReach, kDoorReach, kFishReach, kCatReach, kLampReach,
                  kTvReach, kShopReach, pianoSeat_);
    json += buf;
    std::snprintf(buf, sizeof(buf), ",\"dartReach\":%.0f,\"dartPeriod\":%.2f,\"dartAmp\":%.2f,\"bedReach\":%.0f", kDartReach, darts::kSweepPeriod, darts::kSweepAmp, kBedReach);
    json += buf;
    json += decor::kShopAnywhere ? ",\"shopAnywhere\":true" : ",\"shopAnywhere\":false";  // 오른쪽 위 상점 버튼을 보일지
    json += ",\"dyePrice\":" + std::to_string(decor::dyePrice()) + ",\"floorKinds\":" + std::to_string(decor::kFloorKinds) +
            ",\"floorPrice\":" + std::to_string(decor::floorPrice()) + ",\"expandPrice\":" + std::to_string(decor::expandPrice()) + ",\"extPrice\":" + std::to_string(decor::exteriorPrice()) + ",\"petPrices\":[";
    for (int i = 0; i < decor::kPetKinds; ++i) json += (i ? "," : "") + std::to_string(decor::petPrice(i));
    json += "],\"emotePrices\":[";   // 0 이어도 앞의 다섯 뒤로는 상점에서 받아야 쓴다
    for (int i = 0; i < decor::kEmoteKinds; ++i) json += (i ? "," : "") + std::to_string(decor::emotePrice(i));
    json += "]";

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
    appendList("seats", seats_.size(), [&](size_t i) {
        const Seat& s = seats_[i];
        std::snprintf(buf, sizeof(buf), "{\"z\":%d,\"x\":%.1f,\"y\":%.1f,\"fx\":%.2f,\"fy\":%.2f,\"side\":%d,\"lie\":%d,\"sy\":%.1f}", s.zone, s.x,
                      s.y, s.faceX, s.faceY, s.side, s.lie ? 1 : 0, s.sortY);
        json += buf;
    });
    appendList("pachi", pachinkoSeats_.size(), [&](size_t i) { json += std::to_string(pachinkoSeats_[i]); });
    json += ",\"casino\":" + std::to_string(casinoZone_) + ",\"extReach\":" + std::to_string(static_cast<int>(kExteriorReach));
    // 농장: 구역, 밭 칸의 자리, 씨앗 값과 출하 값
    json += ",\"farm\":{\"zone\":" + std::to_string(farmZone_) + ",\"reach\":" + std::to_string(static_cast<int>(farm::kFarmReach)) +
            ",\"plotReach\":" + std::to_string(static_cast<int>(farm::kPlotReach)) + ",\"yard\":" + std::to_string(static_cast<int>(farm::kYardReach)) +
            ",\"homeMax\":" + std::to_string(farm::kHomePlotsPerPlayer) + ",\"max\":" + std::to_string(farm::kPlotsPerPlayer) + ",\"plots\":[";
    for (size_t i = 0; i < farmPlots_.size(); ++i) {
        std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f]", i ? "," : "", farmPlots_[i].x, farmPlots_[i].y);
        json += buf;
    }
    json += "],\"seed\":[";
    for (int i = 0; i < farm::kCrops; ++i) json += (i ? "," : "") + std::to_string(farm::seedPrice(i));
    json += "],\"sell\":[";
    for (int i = 0; i < farm::kGoods; ++i) json += (i ? "," : "") + std::to_string(farm::sellPrice(i));
    json += "]}";
    appendList("catalog", static_cast<size_t>(decor::kKinds), [&](size_t i) {
        const decor::Kind& k = decor::kCatalog[i];
        const decor::ScaleRange range = decor::scaleRange(k);
        std::snprintf(buf, sizeof(buf), "{\"k\":\"%s\",\"price\":%d,\"hw\":%.0f,\"d\":%.0f,\"place\":%d,\"seats\":%d,\"smin\":%.0f,\"smax\":%.0f}", k.kind,
                      decor::priceOf(static_cast<int>(i)), k.halfW, k.depth, static_cast<int>(k.place), k.seats, range.min * 100.f, range.max * 100.f);
        json += buf;
    });
    // 집에 처음 깔리는 설치형 가구. 지금 놓인 모습은 방에 들어갈 때 받는 decor 메시지가 알려 준다.
    appendList("seeds", seeds_.size(), [&](size_t i) {
        std::snprintf(buf, sizeof(buf), "{\"k\":\"%s\",\"z\":%d,\"x\":%.1f,\"y\":%.1f}", seeds_[i].kind.c_str(), seeds_[i].zone, seeds_[i].x, seeds_[i].y);
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
    json += '}';
    return json;
}
