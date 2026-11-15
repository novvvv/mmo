// 농장과 요리의 표: 작물, 곳간에 쌓이는 물건(작물·달걀·우유·씨앗·요리), 요리법.
// 물건 번호는 계정에 저장되므로 새 물건은 종류별 자리의 맨 뒤에만 더한다. 이름과 그림은 클라이언트의 GOODS, RECIPES 표에 있다.
#pragma once

#include "home/decor.hpp"

namespace farm {

inline constexpr int kCrops = 8;
inline constexpr int kEgg = 8, kMilk = 9;
inline constexpr int kSeedBase = 10;    // 씨앗: kSeedBase + 작물 번호
inline constexpr int kDishBase = 18;    // 요리: kDishBase + 요리법 번호
inline constexpr int kRecipes = 12;
inline constexpr int kGoods = kDishBase + kRecipes;
inline constexpr int kMaxGoods = 999;   // 한 가지를 가질 수 있는 개수

inline constexpr int kPlots = 24;       // 밭 칸 수 (6 × 4)
inline constexpr int kPlotsPerPlayer = 8;
inline constexpr float kPlotReach = 64.f;     // 밭 칸에 손이 닿는 거리
inline constexpr float kFarmReach = 120.f;    // 씨앗 가게, 출하 상자, 닭장, 젖소, 조리대에 손이 닿는 거리
inline constexpr int kHomePlotsPerPlayer = 12;  // 집과 마당의 텃밭에 한 사람이 한꺼번에 기를 수 있는 수
inline constexpr float kYardReach = 340.f;      // 집 문에서 이 거리 안이 그 집의 마당 (텃밭을 놓을 수 있는 곳)
inline constexpr int kYardPerPlayer = 8;        // 한 사람이 마당에 놓을 수 있는 텃밭과 꾸미기의 수
inline constexpr int kWaterEverySec = 60;     // 한 칸에 물을 다시 줄 수 있을 때까지
inline constexpr int kWaterPercent = 20;      // 물을 한 번 주면 줄어드는 자라는 시간 (전체의 %)
inline constexpr long kAbandonSec = 24 * 3600; // 다 자라고 이만큼 내버려 둔 작물은 누구나 거둘 수 있다
inline constexpr int kEggEverySec = 600, kEggCount = 2;
inline constexpr int kMilkEverySec = 900, kMilkCount = 1;

struct Crop {
    const char* name;
    int seedPrice;
    int sell;      // 작물 하나를 출하하는 값
    int growSec;   // 심고 나서 다 자랄 때까지
};

// 당근, 감자, 토마토, 양배추, 옥수수, 밀, 딸기, 호박
inline constexpr Crop kCropInfo[kCrops] = {
    {"당근", 10, 18, 180}, {"감자", 12, 22, 300}, {"토마토", 15, 28, 420}, {"양배추", 15, 30, 480},
    {"옥수수", 20, 40, 600}, {"밀", 8, 14, 240}, {"딸기", 25, 55, 900}, {"호박", 30, 70, 1200},
};

inline constexpr int seedPrice(int crop) { return decor::kFreeForTesting ? 0 : kCropInfo[crop].seedPrice; }

struct Need {
    int good;   // 물건 번호. -1 이면 빈 칸
    int count;
};

// steps 는 조리 과정: C 썰기, S 젓기, F 뒤집기, H 불 조절, P 담기
struct Recipe {
    const char* name;
    Need needs[4];
    int fish;          // 낚은 물고기 (종류는 가리지 않는다)
    const char* steps;
    int sell;
};

inline constexpr Recipe kRecipeInfo[kRecipes] = {
    {"채소 샐러드", {{2, 1}, {3, 1}, {-1, 0}, {-1, 0}}, 0, "CP", 90},
    {"당근 수프", {{0, 2}, {kMilk, 1}, {-1, 0}, {-1, 0}}, 0, "CHS", 85},
    {"감자튀김", {{1, 2}, {-1, 0}, {-1, 0}, {-1, 0}}, 0, "CH", 70},
    {"오믈렛", {{kEgg, 2}, {2, 1}, {-1, 0}, {-1, 0}}, 0, "SF", 90},
    {"팬케이크", {{5, 1}, {kEgg, 1}, {kMilk, 1}, {-1, 0}}, 0, "SFP", 80},
    {"옥수수 버터구이", {{4, 2}, {-1, 0}, {-1, 0}, {-1, 0}}, 0, "HF", 125},
    {"토마토 파스타", {{5, 1}, {2, 2}, {-1, 0}, {-1, 0}}, 0, "CHS", 110},
    {"생선구이", {{-1, 0}, {-1, 0}, {-1, 0}, {-1, 0}}, 1, "FH", 60},
    {"생선 스튜", {{1, 1}, {3, 1}, {-1, 0}, {-1, 0}}, 1, "CHS", 110},
    {"호박 파이", {{7, 1}, {5, 1}, {kEgg, 1}, {-1, 0}}, 0, "CSH", 160},
    {"딸기 케이크", {{6, 2}, {5, 1}, {kEgg, 1}, {kMilk, 1}}, 0, "SHP", 260},
    {"딸기 우유", {{6, 1}, {kMilk, 1}, {-1, 0}, {-1, 0}}, 0, "CS", 115},
};

// 출하 상자에 넣었을 때 받는 골드
inline constexpr int sellPrice(int good) {
    if (good < 0 || good >= kGoods) return 0;
    if (good < kCrops) return kCropInfo[good].sell;
    if (good == kEgg) return 15;
    if (good == kMilk) return 20;
    if (good < kDishBase) return kCropInfo[good - kSeedBase].seedPrice / 2;
    return kRecipeInfo[good - kDishBase].sell;
}

}  // namespace farm
