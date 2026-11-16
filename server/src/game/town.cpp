// 마을 만들기: core 의 기본 마을(강, 나무, 가로등, 벤치) 위에 카페, 집 세 채, 극장, 카지노, 재즈바, 특별관, 농장, 헤연의 집을 짓고 안을 꾸민다.
// 구역 번호(집 1~3, 극장 4, 카지노 5, 재즈바 6, 특별관 7, 농장 8, 헤연의 집 9)와 자리 번호는 저장 파일과 클라이언트가 쓰므로 짓는 순서를 바꾸지 않는다.
#include "game/town.hpp"

#include "activity/darts.hpp"
#include "activity/farm.hpp"
#include "home/decor.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>

Town::Town(World& world) : w_(world) {}

void Town::build() {
    buildCafe();

    // 집의 위치는 건물 바닥의 중심이다. 구역 번호(집 1~3, 극장 4, 카지노 5, 재즈바 6)는 저장된 가구와 방명록이 쓰므로 순서를 지킨다.
    const int brick = w_.addHouse("몰쟈", 0, 1105.f, 1309.f, 680.f, 440.f);
    const int cabin = w_.addHouse("랏라", 1, 449.f, 1316.f, 620.f, 460.f);
    const int loft = w_.addHouse("캬캬", 2, 676.f, 1391.f, 1120.f, 900.f);
    furnishBrickHouse(brick, 680.f, 440.f);
    furnishCabin(cabin, 620.f, 460.f);
    furnishLoftHouse(loft);
    for (const int house : {brick, cabin, loft}) w_.markExpandable(house);
    const int theater = w_.addPlace("theater", "극장", 3, 720.f, 160.f, 170.f, 60.f, 60.f, 1000.f, 640.f, 5);
    furnishTheater(theater);
    furnishCasino(w_.addPlace("casino", "카지노", 4, 360.f, 160.f, 118.f, 50.f, 60.f, 960.f, 600.f, 6));   // 예전 슬라임 군락지 자리 (구역 5)
    furnishJazzBar(w_.addPlace("jazz", "재즈바", 5, 1080.f, 160.f, 110.f, 50.f, 60.f, 900.f, 600.f, 7));

    // 극장 뒷벽 오른쪽 끝의 문으로 들어가는 특별관 (구역 7). 스크린이 훨씬 크고 3인용 소파 하나만 있다
    furnishScreeningRoom(w_.addAnnex("theater", "특별관", theater, 955.f, 0.f, 1360.f, 640.f, 5));

    // 마을 동쪽 끝의 나무 문으로 들어가는 농장 (구역 8): 함께 쓰는 밭, 씨앗 가게, 출하 상자, 닭장과 젖소, 바깥 조리대
    farmZone_ = w_.addPlace("farm", "농장", 6, 1340.f, 520.f, 46.f, 14.f, 14.f, 1200.f, 760.f, 8);
    furnishFarm(farmZone_);

    // 헤연의 집 (구역 9): 강 북쪽, 재즈바 아래와 농장 문 사이의 빈 땅. 겉모습은 기와집(스타일 7), 방은 흰 벽돌(방 스타일 2)
    const int tile = w_.addPlace("house", "헤연", 7, 1150.f, 430.f, 90.f, 45.f, 45.f, 640.f, 440.f, 2);
    furnishTileHouse(tile, 640.f, 440.f);
    w_.markExpandable(tile);

    // 모든 집은 방 불을 켜고 끄고 밝기를 바꿀 수 있다
    for (const int house : {brick, cabin, loft, tile}) w_.zoneRef(house).lighting = true;
}

void Town::addCafeTable(float x, float y) {
    w_.addFurniture({"cafe_table", 0, x, y});
    w_.addSolid({0, x - 18.f, y - 12.f, x + 18.f, y + 8.f});

    // 테이블의 네 모서리에 둘러앉는다. 뒤쪽 두 자리는 테이블에 가려지고 앞쪽 두 자리는 앞에 그려진다.
    const struct { float dx, dy; int side; } places[] = {
        {-38.f, -26.f, -1}, {38.f, -26.f, 1}, {-42.f, 26.f, -1}, {42.f, 26.f, 1},
    };
    for (const auto& place : places) {
        const float len = std::hypot(place.dx, place.dy);
        w_.put(0, "stool", x + place.dx, y + place.dy);
        w_.addSeat(0, x + place.dx, y + place.dy, -place.dx / len, -place.dy / len, place.side);
    }
}

void Town::buildCafe() {
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
    w_.addBuilding(cafe);
    w_.addSolid({0, kX - cafe.halfW, kY - cafe.back, kX + cafe.halfW, kY + cafe.front});

    addCafeTable(kX - 66.f, kY + 124.f);
    addCafeTable(kX + 66.f, kY + 124.f);
    w_.put(0, "menu_board", kX + 136.f, kY + 72.f);
    w_.put(0, "planter", kX - 136.f, kY + 66.f);
    w_.put(0, "planter", kX - 140.f, kY + 178.f);
    w_.put(0, "planter", kX + 140.f, kY + 178.f);
}

// 특별관: 방 폭을 거의 다 채우는 큰 스크린과 그 앞의 3인용 소파 하나
void Town::furnishScreeningRoom(int zone) {
    constexpr float kW = 1360.f;
    Zone& z = w_.zoneRef(zone);
    z.lighting = true;
    z.lightLevel = 15;

    w_.put(zone, "cinema_screen_big", kW / 2.f, 441.f, 640.f, 441.f);
    for (int col = -1; col <= 1; ++col) w_.addSeat(zone, kW / 2.f + 58.f * static_cast<float>(col), 500.f, 0.f, -1.f);
    w_.put(zone, "cinema_sofa", kW / 2.f, 518.f);  // 앉은 사람 앞에 그려지도록 자리보다 아래에 둔다
}

// 극장: 앞쪽 무대의 큰 스크린을 향해 붉은 좌석이 줄지어 있고, 뒤쪽에 매점이 있다.
void Town::furnishTheater(int zone) {
    constexpr float kW = 1000.f;
    Zone& z = w_.zoneRef(zone);
    z.lighting = true;
    z.lightLevel = 15;

    w_.put(zone, "cinema_screen", kW / 2.f, 205.f, 420.f, 205.f);
    for (int row = 0; row < 5; ++row) {
        const float y = 270.f + static_cast<float>(row) * 58.f;
        for (int side = -1; side <= 1; side += 2) {
            for (int col = 0; col < 6; ++col) {
                w_.addSeat(zone, kW / 2.f + static_cast<float>(side) * (90.f + 58.f * static_cast<float>(col)), y, 0.f, -1.f);
            }
        }
        w_.put(zone, "cinema_row", kW / 2.f, y + 18.f);  // 앉은 사람 앞에 그려지도록 자리보다 아래에 둔다
    }
    w_.put(zone, "snack_bar", 840.f, 596.f, 110.f, 36.f);
    w_.put(zone, "movie_poster", 90.f, 300.f);
    w_.put(zone, "cinema_door", 955.f, 0.f);  // 특별관으로 가는 문. 문 자체는 addAnnex 가 만든다
}

// 재즈바: 술병 선반과 긴 바, 바 안쪽의 바텐더, 오른쪽의 레코드판, 앞쪽의 테이블
void Town::furnishJazzBar(int zone) {
    Zone& z = w_.zoneRef(zone);
    z.lighting = true;
    z.lightLevel = 25;
    jazzZone_ = zone;

    w_.put(zone, "bottle_shelf", 170.f, -62.f);
    w_.put(zone, "bottle_shelf", 400.f, -62.f);
    w_.put(zone, "gold_frame", 556.f, -66.f);
    w_.put(zone, "gold_frame", 646.f, -66.f);
    w_.put(zone, "dart_board", 735.f, -66.f);
    w_.put(zone, "dart_line", 735.f, 100.f);

    w_.put(zone, "bartender", 110.f, 92.f);
    w_.put(zone, "bar_counter", 305.f, 150.f, 305.f, 50.f);   // 왼쪽 벽까지 막아 바 안으로 들어갈 수 없다
    w_.put(zone, "bar_counter_side", 636.f, 200.f, 26.f, 200.f);
    for (int i = 0; i < 7; ++i) {
        const float x = 200.f + static_cast<float>(i) * 60.f;
        w_.put(zone, "plum_stool", x, 178.f);
        w_.addSeat(zone, x, 178.f, 0.f, -1.f);
    }

    w_.put(zone, "record_player", 846.f, 250.f, 44.f, 18.f);  // 오른쪽 위 재생 창에 가리지 않는 자리

    const struct { float x, y; } tables[] = {{190.f, 400.f}, {450.f, 330.f}, {720.f, 400.f}};
    for (const auto& table : tables) {
        w_.put(zone, "bar_table", table.x, table.y, 30.f, 14.f);
        for (int side = -1; side <= 1; side += 2) {
            const float x = table.x + static_cast<float>(side) * 66.f;
            w_.put(zone, "velvet_chair", x, table.y + 6.f);
            w_.addSeat(zone, x, table.y + 6.f, static_cast<float>(-side), 0.f, side);
        }
    }
}

// 카지노: 빠칭코 기계가 두 줄로 서 있고(앞줄 5대, 뒷줄 3대), 오른쪽에 룰렛 테이블과 환전소, 쉬는 탁자가 있다.
// 기계 앞 의자에 앉으면 빠칭코 창이 열린다. 줄 사이를 넉넉히 띄워 앞줄에 앉은 사람이 뒷줄 기계에 가리지 않는다.
void Town::furnishCasino(int zone) {
    constexpr float kW = 960.f;
    Zone& z = w_.zoneRef(zone);
    z.lighting = true;
    z.lightLevel = 45;
    casinoZone_ = zone;

    w_.put(zone, "casino_sign", kW / 2.f, -70.f);
    for (const float x : {150.f, kW - 150.f}) w_.put(zone, "gold_frame", x, -66.f);
    const auto machine = [&](float x, float y) {
        w_.put(zone, "pachinko", x, y, 32.f, 34.f);
        w_.put(zone, "plum_stool", x, y + 60.f);
        pachinkoSeats_.push_back(static_cast<int>(w_.seats().size()));
        w_.addSeat(zone, x, y + 60.f, 0.f, -1.f);
    };
    for (int i = 0; i < 5; ++i) machine(130.f + static_cast<float>(i) * 94.f, 170.f);
    for (int i = 0; i < 3; ++i) machine(130.f + static_cast<float>(i) * 94.f, 440.f);
    w_.put(zone, "roulette", 730.f, 300.f, 96.f, 44.f);
    for (int side = -1; side <= 1; side += 2) {
        const float x = 730.f + static_cast<float>(side) * 140.f;
        w_.put(zone, "velvet_chair", x, 308.f);
        w_.addSeat(zone, x, 308.f, static_cast<float>(-side), 0.f, side);
    }
    w_.put(zone, "cashier", 820.f, 540.f, 84.f, 34.f);
    w_.put(zone, "bar_table", 600.f, 470.f, 30.f, 14.f);
    for (int side = -1; side <= 1; side += 2) {
        const float x = 600.f + static_cast<float>(side) * 66.f;
        w_.put(zone, "velvet_chair", x, 476.f);
        w_.addSeat(zone, x, 476.f, static_cast<float>(-side), 0.f, side);
    }
    w_.put(zone, "tall_plant", 40.f, 40.f, 18.f, 14.f);
    w_.put(zone, "tall_plant", kW - 40.f, 40.f, 18.f, 14.f);
    w_.put(zone, "tall_plant", 40.f, 560.f, 18.f, 14.f);
}

// 몰쟈의 집: 큰 통창 너머로 숲이 보이는 콘크리트와 검은 프레임의 집
void Town::furnishBrickHouse(int zone, float w, float h) {
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

// 헤연의 집: 흰 벽돌 방에 책장과 침대, 러그 위의 둥근 탁자와 소파. 모두 옮기거나 소지품에 넣을 수 있는 가구다
void Town::furnishTileHouse(int zone, float w, float h) {
    seed(zone, "sheer_window", 180.f, -64.f);
    seed(zone, "sheer_window", w - 180.f, -64.f);
    seed(zone, "wall_frames", w / 2.f, -66.f);
    seed(zone, "bookshelf", 70.f, 40.f);
    seed(zone, "shade_lamp", w - 150.f, 40.f);
    seed(zone, "linen_bed", w - 80.f, 150.f);
    seed(zone, "rug_shag", 260.f, 250.f);
    seed(zone, "coffee_round", 260.f, 250.f);
    seed(zone, "sofa_cream", 260.f, 334.f);
    seed(zone, "pouf", 150.f, 250.f);
    seed(zone, "monstera", 44.f, h - 44.f);
    seed(zone, "plant_small", w - 44.f, h - 44.f);
}

// 랏라의 집: 숲속 통나무집답게 화분과 어항, 해먹이 있는 방
void Town::furnishCabin(int zone, float w, float h) {
    w_.put(zone, "ivy", 90.f, -104.f);
    w_.put(zone, "ivy", w / 2.f, -104.f);
    w_.put(zone, "ivy", w - 90.f, -104.f);
    w_.put(zone, "window", 150.f, -62.f);
    w_.put(zone, "window", w - 150.f, -62.f);

    w_.put(zone, "bench", w / 2.f, 64.f);
    w_.addSeat(zone, w / 2.f - 22.f, 64.f, 0.f, 1.f, -1);
    w_.addSeat(zone, w / 2.f + 22.f, 64.f, 0.f, 1.f, 1);

    w_.put(zone, "plant", 60.f, 58.f, 20.f, 16.f);
    w_.put(zone, "plant", w - 60.f, 58.f, 20.f, 16.f);
    w_.put(zone, "plant", 40.f, 330.f, 20.f, 16.f);
    w_.put(zone, "plant", w - 40.f, 330.f, 20.f, 16.f);
    w_.put(zone, "aquarium", 122.f, 226.f, 54.f, 30.f);

    w_.put(zone, "hammock", w - 142.f, 214.f);
    w_.addSeat(zone, w - 142.f, 214.f);

    w_.put(zone, "rug_leaf", w / 2.f, 322.f);
    w_.put(zone, "stump", w / 2.f, 322.f, 24.f, 16.f);
    w_.put(zone, "stool", w / 2.f - 66.f, 318.f);
    w_.addSeat(zone, w / 2.f - 66.f, 318.f, 1.f, 0.f, -1);
    w_.put(zone, "stool", w / 2.f + 66.f, 318.f);
    w_.addSeat(zone, w / 2.f + 66.f, 318.f, -1.f, 0.f, 1);

    w_.put(zone, "potting_bench", 140.f, h - 28.f, 72.f, 30.f);
    w_.put(zone, "plant_small", w - 130.f, h - 42.f, 14.f, 12.f);
    w_.put(zone, "tv", 470.f, 380.f, 54.f, 14.f);
}

// 캬캬의 집: 흰 벽돌과 나무 바닥의 거실. 왼쪽 복도 끝에 침실, 왼쪽 아래 복도 끝에 주방이 있다. 식물은 두지 않는다.
void Town::furnishLoftHouse(int zone) {
    constexpr float kX = 460.f;  // 거실의 왼쪽 벽. 거실 안의 가구는 이 값을 더해 놓는다
    constexpr float kRoomH = 420.f;
    w_.carveRooms(zone,
               {
                   {0.f, 0.f, 400.f, 380.f, 3},         // 침실
                   {400.f, 170.f, kX, 250.f, 2},        // 침실로 가는 복도
                   {kX, 0.f, kX + 660.f, kRoomH, 2},    // 거실
                   {470.f, kRoomH, 550.f, 580.f, 2},    // 주방으로 가는 복도
                   {200.f, 580.f, 640.f, 900.f, 4},     // 주방
               },
               kX + 330.f, kRoomH);
    Zone& z = w_.zoneRef(zone);
    z.lighting = true;
    z.lightLevel = 70;

    // ---- 거실
    seed(zone, "sheer_window", kX + 268.f, -64.f, 2);
    seed(zone, "sheer_window", kX + 540.f, -64.f, 2);

    w_.put(zone, "piano", kX + 130.f, 66.f, 72.f, 44.f);
    w_.put(zone, "stool", kX + 130.f, 110.f);
    pianoSeat_ = static_cast<int>(w_.seats().size());
    w_.addSeat(zone, kX + 130.f, 110.f, 0.f, -1.f);

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
    w_.put(zone, "nimda_poster", 207.f, -66.f);
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

// 농장: 왼쪽에 밭 6 × 4 칸, 오른쪽에 가게와 조리대, 출하 상자, 닭장, 젖소
void Town::furnishFarm(int zone) {
    for (int row = 0; row < 4; ++row) {
        for (int col = 0; col < 6; ++col) {
            const float x = 170.f + static_cast<float>(col) * 118.f, y = 250.f + static_cast<float>(row) * 112.f;
            w_.put(zone, "farm_plot", x, y);
            farmPlots_.push_back({x, y});
        }
    }
    w_.put(zone, "farm_scarecrow", 820.f, 120.f, 10.f, 8.f);
    w_.put(zone, "farm_stall", 980.f, 150.f, 76.f, 34.f);
    w_.put(zone, "farm_kitchen", 1070.f, 340.f, 70.f, 32.f);
    w_.put(zone, "farm_bin", 900.f, 430.f, 36.f, 26.f);
    w_.put(zone, "farm_coop", 960.f, 640.f, 62.f, 36.f);
    w_.put(zone, "farm_cow", 1110.f, 600.f, 46.f, 20.f);
    w_.put(zone, "farm_well", 90.f, 690.f, 30.f, 22.f);
}

void Town::seed(int zone, const char* kind, float x, float y, int gen) {
    seeds_.push_back({zone, kind, x, y, false, 0.f, 1.f, 0, gen});
}

void Town::seedFacing(int zone, const char* kind, float x, float y, float faceX, float faceY, int side) {
    seeds_.push_back({zone, kind, x, y, true, faceX, faceY, side, 1});
}

int Town::houseDoorNear(float x, float y, float reach) const {
    for (const Building& b : w_.buildings()) {
        if (b.kind == "house" && b.room > 0 && std::hypot(b.doorX - x, b.doorY - y) <= reach) return b.room;
    }
    return -1;
}

bool Town::hasTv(int zone) const {
    return w_.findFurniture(zone, "tv") || w_.findFurniture(zone, "tv_wall") || w_.findFurniture(zone, "cinema_screen") || w_.findFurniture(zone, "cinema_screen_big");
}

bool Town::lampNear(int zone, float x, float y) const {
    return std::any_of(w_.furniture().begin(), w_.furniture().end(), [=](const Furniture& f) {
        return f.zone == zone && (f.kind == "floor_lamp" || f.kind == "lantern_lamp") && std::hypot(f.x - x, f.y - y) <= kLampReach;
    });
}

// 지도(map 메시지)에 콘텐츠가 쓰는 값을 덧붙인다: 손이 닿는 거리, 값, 빠칭코 자리, 농장, 가구 목록, 집에 처음 깔리는 가구
void Town::mapFields(std::string& json) const {
    const auto appendList = [&json](const char* key, size_t count, const auto& item) {
        json += ",\"" + std::string(key) + "\":[";
        for (size_t i = 0; i < count; ++i) {
            if (i > 0) json += ',';
            item(i);
        }
        json += ']';
    };
    char buf[256];
    std::snprintf(buf, sizeof(buf), ",\"fishReach\":%.0f,\"catReach\":%.0f,\"lampReach\":%.0f,\"tvReach\":%.0f,\"shopReach\":%.0f,\"pianoSeat\":%d",
                  kFishReach, kCatReach, kLampReach, kTvReach, kShopReach, pianoSeat_);
    json += buf;
    std::snprintf(buf, sizeof(buf), ",\"dartReach\":%.0f,\"dartPeriod\":%.2f,\"dartAmp\":%.2f", kDartReach, darts::kSweepPeriod, darts::kSweepAmp);
    json += buf;
    json += decor::kShopAnywhere ? ",\"shopAnywhere\":true" : ",\"shopAnywhere\":false";  // 오른쪽 위 상점 버튼을 보일지
    json += ",\"dyePrice\":" + std::to_string(decor::dyePrice()) + ",\"floorKinds\":" + std::to_string(decor::kFloorKinds) +
            ",\"floorPrice\":" + std::to_string(decor::floorPrice()) + ",\"expandPrice\":" + std::to_string(decor::expandPrice()) + ",\"extPrice\":" + std::to_string(decor::exteriorPrice()) + ",\"petPrices\":[";
    for (int i = 0; i < decor::kPetKinds; ++i) json += (i ? "," : "") + std::to_string(decor::petPrice(i));
    json += "],\"emotePrices\":[";   // 0 이어도 앞의 다섯 뒤로는 상점에서 받아야 쓴다
    for (int i = 0; i < decor::kEmoteKinds; ++i) json += (i ? "," : "") + std::to_string(decor::emotePrice(i));
    json += "]";

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
}
