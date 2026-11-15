// 가구점에서 파는 가구 목록. 순서가 곧 계정에 저장되는 번호이므로 새 가구는 맨 뒤에만 추가한다.
#pragma once

namespace decor {

enum Place { kFloor = 0, kWall = 1, kFlat = 2 };  // 바닥에 세우는 가구, 벽걸이, 위를 밟을 수 있는 깔개
// 깔개(kFlat)의 halfW, depth 는 충돌 영역이 아니라 기준점을 가운데로 한 그림의 반폭과 반높이다. 깔개가 방 밖으로 나가지 않는지 볼 때 쓴다.

struct Kind {
    const char* kind;   // 그림 종류. 클라이언트의 FURNITURE 표에 대응한다
    int price;
    float halfW;        // 충돌 영역: x±halfW, y-depth ~ y. 0이면 통과할 수 있다
    float depth;
    Place place;
    int seats;          // 앉거나 누울 수 있는 자리 수 (0~2)
    bool lie;           // 눕는 자리인지
    float ax, ay;       // 가구 기준 첫 자리의 위치
    float bx, by;       // 둘째 자리의 위치
    float faceY;        // 앉았을 때 바라보는 방향
    float cx = 0.f, cy = 0.f;  // 셋째 자리의 위치 (3인용 소파)
};

inline constexpr Kind kCatalog[] = {
    {"dining_chair", 40, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"white_chair", 40, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"black_stool", 30, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"bar_stool", 45, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"pouf", 35, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"armchair", 120, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"accent_chair", 140, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"sofa_cream", 260, 0, 0, kFloor, 2, false, -34, -18, 34, -18, -1},
    {"sofa_l", 320, 0, 0, kFloor, 3, false, -54, -18, 0, -18, -1, 54, -18},
    {"glass_table", 110, 26, 18, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"coffee_round", 100, 28, 14, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"round_dining", 180, 44, 16, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"long_table", 220, 92, 22, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"bed", 400, 62, 118, kFloor, 2, true, -27, -68, 27, -68, 1},
    {"linen_bed", 480, 72, 128, kFloor, 2, true, -30, -74, 30, -74, 1},
    {"vanity", 200, 56, 26, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"bookshelf", 160, 44, 18, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"wardrobe", 220, 44, 24, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"kitchen_counter", 300, 130, 40, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"aquarium", 300, 54, 30, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"shade_lamp", 90, 14, 10, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"tall_plant", 70, 16, 12, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"monstera", 90, 20, 16, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"plant_small", 40, 14, 12, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"book_pile", 30, 18, 10, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"rug_plain", 90, 0, 0, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_diamond", 110, 0, 0, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_shag", 100, 0, 0, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_leaf", 100, 0, 0, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"wall_frames", 80, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"round_mirror", 90, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"window", 70, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"wall_clock", 70, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"record_player", 260, 44, 18, kFloor, 0, false, 0, 0, 0, 0, 1},  // 곡 목록을 등록해 방 안에서 함께 듣는다
    // 몰쟈와 캬캬의 집에 원래 있던 가구를 설치형으로 바꾸며 더한 것
    {"kitchen_bar", 220, 70, 30, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"dining_table", 200, 62, 32, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"stool", 30, 0, 0, kFloor, 1, false, 0, 0, 0, 0, 1},
    {"kitchen_island", 260, 62, 24, kFloor, 0, false, 0, 0, 0, 0, 1},
    // 조명, 칸막이, 창, 벽난로, TV 도 설치형으로 바꾸며 더한 것. 스탠드는 조명 창에서 켜고 끄고, TV 는 영상을 튼다
    {"floor_lamp", 90, 8, 8, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"lantern_lamp", 80, 10, 8, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"glass_partition", 120, 4, 190, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"big_window", 160, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"sheer_window", 140, 0, 0, kWall, 0, false, 0, 0, 0, 0, 1},
    {"fireplace", 400, 78, 34, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"tv_wall", 350, 0, 0, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"tv", 350, 54, 14, kFloor, 0, false, 0, 0, 0, 0, 1},
    // 게임 가구: 놓은 방에서 다트와 오목을 할 수 있다
    {"dart_stand", 280, 14, 8, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"omok_table", 220, 34, 22, kFloor, 0, false, 0, 0, 0, 0, 1},
    // 캐릭터 모양 터프팅 러그 (밟고 지나갈 수 있는 깔개)
    {"rug_cat_black", 160, 130, 48, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_cat_stand", 160, 126, 66, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_bunny", 140, 106, 62, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_long_cat", 150, 152, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_puppy", 170, 120, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_8ball", 150, 108, 60, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_cloud", 130, 146, 46, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"rug_heart", 130, 108, 48, kFlat, 0, false, 0, 0, 0, 0, 1},
    // 식탁 그림에서 떼어 낸 매달린 조명. 기준점은 빛이 떨어지는 바닥이고 그림은 그 위 천장에 걸린다
    {"pendant_frame", 90, 0, 0, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"pendant_cone", 90, 0, 0, kFloor, 0, false, 0, 0, 0, 0, 1},
    // 58~61 오락기: 슈팅, 벽돌깨기(둘이 함께), 지뢰찾기(둘이 겨룸), 체스판(컴퓨터나 사람과 둔다)
    {"arcade_shooter", 600, 34, 24, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"arcade_bricks", 600, 34, 24, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"arcade_mines", 600, 34, 24, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"arcade_chess", 500, 34, 22, kFloor, 0, false, 0, 0, 0, 0, 1},
    // 62~67 텃밭: 씨앗을 심어 기르는 밭 한 칸. 밟고 지나갈 수 있고, 집 안과 집 근처 마당에 놓는다
    {"plot_soil", 60, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"plot_wood", 90, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"plot_stone", 90, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"plot_brick", 90, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"plot_log", 90, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    {"plot_flower", 110, 52, 40, kFlat, 0, false, 0, 0, 0, 0, 1},
    // 68~70 마당 꾸미기: 텃밭 옆에 두는 것들. 지나다닐 수 있다
    {"garden_scarecrow", 80, 0, 0, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"garden_fence", 30, 0, 0, kFloor, 0, false, 0, 0, 0, 0, 1},
    {"garden_flowers", 50, 40, 22, kFlat, 0, false, 0, 0, 0, 0, 1},
};

inline constexpr int kKinds = static_cast<int>(sizeof(kCatalog) / sizeof(kCatalog[0]));

// 놓인 가구의 크기를 바꿀 수 있는 범위(배율). 깔개와 작은 소품은 넓게, 침대처럼 큰 가구와 앉는 가구는 좁게.
struct ScaleRange {
    float min, max;
};
inline constexpr ScaleRange scaleRange(const Kind& k) {
    if (k.place == kFlat) return {0.6f, 1.6f};
    if (k.place == kWall) return {0.6f, 1.5f};
    if (k.lie) return {0.85f, 1.25f};
    if (k.seats > 0) return {0.8f, 1.3f};
    if (k.halfW >= 60.f) return {0.8f, 1.25f};
    if (k.halfW <= 20.f) return {0.6f, 1.6f};   // 화분, 조명, 소품
    return {0.75f, 1.4f};
}

// 배율을 곱한 가구 치수: 충돌 영역과 앉는 자리가 함께 커지고 작아진다.
inline Kind scaled(const Kind& k, float s) {
    Kind out = k;
    out.halfW *= s;
    out.depth *= s;
    out.ax *= s;
    out.ay *= s;
    out.bx *= s;
    out.by *= s;
    out.cx *= s;
    out.cy *= s;
    return out;
}
// 위에서 내려다본 그림이라 90도씩 돌려 놓을 수 있는 가구: 깔개와 텃밭, 침대. 나머지는 앞에서 본 그림이라 좌우로만 뒤집는다
inline constexpr bool rotatable(const Kind& k) { return k.place == kFlat || k.lie; }

// 90도씩 rot 번 돌린 가구 치수. 가로와 세로가 바뀌고, 눕는 자리도 가구의 가운데를 중심으로 함께 돈다.
// 기준점은 늘 지금 놓인 모양의 것이다 (깔개는 가운데, 침대는 발치 가운데).
inline Kind turned(const Kind& k, int rot) {
    Kind out = k;
    for (int step = 0; step < (rot & 3); ++step) {
        const Kind from = out;
        if (from.place == kFlat) {
            out.halfW = from.depth;
            out.depth = from.halfW;
            continue;
        }
        out.halfW = from.depth / 2.f;
        out.depth = from.halfW * 2.f;
        const auto spin = [&](float x, float y, float& ox, float& oy) {   // 가운데에서 본 자리를 시계 방향으로 90도
            const float cx = x, cy = y + from.depth / 2.f;
            ox = -cy;
            oy = cx - out.depth / 2.f;
        };
        spin(from.ax, from.ay, out.ax, out.ay);
        spin(from.bx, from.by, out.bx, out.by);
        spin(from.cx, from.cy, out.cx, out.cy);
    }
    return out;
}
inline constexpr int kRecordPlayer = 33;  // 놓으면 그 방에 곡 목록이 생긴다

constexpr bool sameName(const char* a, const char* b) { return *a == *b && (*a == '\0' || sameName(a + 1, b + 1)); }
static_assert(sameName(kCatalog[kRecordPlayer].kind, "record_player"), "레코드 플레이어 번호가 목록과 맞지 않습니다");

// 오락기. 번호 순서가 게임 번호(0 슈팅, 1 벽돌깨기, 2 지뢰찾기, 3 체스)다
inline constexpr int kArcadeFirst = 58;
inline constexpr int kArcadeGames = 4;
inline constexpr int kArcadeChess = 3;
static_assert(sameName(kCatalog[kArcadeFirst].kind, "arcade_shooter") && sameName(kCatalog[kArcadeFirst + kArcadeChess].kind, "arcade_chess"), "오락기 번호가 목록과 맞지 않습니다");
inline constexpr int arcadeGame(int kind) { return kind >= kArcadeFirst && kind < kArcadeFirst + kArcadeGames ? kind - kArcadeFirst : -1; }

// 텃밭과 마당 꾸미기. 이것들만 집 밖(집 근처 마당)에도 놓을 수 있고, 텃밭에는 씨앗을 심는다
inline constexpr int kPlotFirst = 62, kPlotKinds = 6, kGardenLast = 70;
static_assert(sameName(kCatalog[kPlotFirst].kind, "plot_soil") && sameName(kCatalog[kGardenLast].kind, "garden_flowers"), "텃밭 번호가 목록과 맞지 않습니다");
inline constexpr bool isPlot(int kind) { return kind >= kPlotFirst && kind < kPlotFirst + kPlotKinds; }
inline constexpr bool isGarden(int kind) { return kind >= kPlotFirst && kind <= kGardenLast; }

// true 면 모든 가구, 염료, 바닥재, 펫이 0원이다. 지금은 테스트 기간이라 켜 둔다. 정식으로 팔 때 false 로.
inline constexpr bool kFreeForTesting = true;
// true 면 왕국 가구점까지 가지 않아도 오른쪽 위 상점에서 어디서나 산다.
inline constexpr bool kShopAnywhere = true;

inline constexpr int priceOf(int kind) { return kFreeForTesting ? 0 : kCatalog[kind].price; }

// 염료 한 병으로 가구 하나를 염색한다. 테스트 기간에는 0원.
inline constexpr int kDyePrice = 30;
inline constexpr int dyePrice() { return kFreeForTesting ? 0 : kDyePrice; }

// 바닥재 종류. 0은 집마다의 원래 바닥이고, 그림은 클라이언트의 FLOOR_MATERIALS 에 있다. 원래 바닥으로 되돌리는 것은 무료.
inline constexpr int kFloorKinds = 8;
inline constexpr int kFloorPrice = 150;
inline constexpr int floorPrice() { return kFreeForTesting ? 0 : kFloorPrice; }

// 상점의 펫. 순서가 계정에 저장되는 번호이므로 새 펫은 맨 뒤에만 추가한다. 생김새와 이름은 클라이언트의 PET_KINDS 에 있다.
inline constexpr int kPetPrices[] = {300, 300, 300, 300, 300, 450, 450, 450};
inline constexpr int kPetKinds = static_cast<int>(sizeof(kPetPrices) / sizeof(kPetPrices[0]));
inline constexpr int petPrice(int kind) { return kFreeForTesting ? 0 : kPetPrices[kind]; }

// 감정표현. 앞의 다섯은 누구나 쓰고(0원), 그 뒤는 상점에서 한 번 사면 계속 쓴다. 순서가 계정에 저장되는 번호이므로 새 것은 맨 뒤에만 추가한다.
// 채팅 명령은 core/rules.hpp 의 kEmotes, 그림과 이름은 클라이언트의 EMOTES 에 있다.
inline constexpr int kEmotePrices[] = {0, 0, 0, 0, 0, 200, 200, 200, 200, 150, 400, 200, 250, 250, 150};
inline constexpr int kEmoteKinds = static_cast<int>(sizeof(kEmotePrices) / sizeof(kEmotePrices[0]));
inline constexpr bool emotePaid(int kind) { return kEmotePrices[kind] > 0; }
inline constexpr int emotePrice(int kind) { return kFreeForTesting ? 0 : kEmotePrices[kind]; }

// 집 확장: 한 방향에 한 번, 벽을 뚫어 방을 하나 붙인다. 테스트 기간에는 0원.
inline constexpr int kExpandPrice = 500;
inline constexpr int expandPrice() { return kFreeForTesting ? 0 : kExpandPrice; }

// 집 외관(벽, 지붕, 문, 장식)을 한 번 바꾸는 값
inline constexpr int kExteriorPrice = 100;
inline constexpr int exteriorPrice() { return kFreeForTesting ? 0 : kExteriorPrice; }

// 그림의 반폭. 벽을 뚫을 자리에 벽걸이가 걸려 있는지 볼 때 쓴다 (클라이언트 그림에서 잰 값).
inline float visualHalf(const Kind& k) {
    static constexpr struct { const char* kind; float half; } kWide[] = {
        {"big_window", 118.f}, {"sheer_window", 58.f}, {"window", 44.f}, {"round_mirror", 42.f},
        {"wall_frames", 38.f}, {"wall_clock", 26.f}, {"tv_wall", 44.f}, {"fireplace", 88.f},
    };
    for (const auto& wide : kWide) {
        if (sameName(wide.kind, k.kind)) return wide.half;
    }
    return k.halfW > 30.f ? k.halfW : 30.f;
}

}  // namespace decor

constexpr int kDecorKinds = decor::kKinds;
