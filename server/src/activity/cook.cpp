// 요리: 조리대 앞에서 재료를 확인하고 시작을 허락한다. 손놀림 놀이는 화면에서 돌고 점수만 받는다.
#include "core/rules.hpp"

// 조리대: 농장의 바깥 조리대나, 집에 놓은 주방 가구 앞
bool Game::atKitchen(const Player& p) const {
    if (nearFixed(p, "farm_kitchen", farm::kFarmReach)) return true;
    for (const char* kind : {"kitchen_counter", "kitchen_bar", "kitchen_island"}) {
        if (decorNear(p.zone, kind, p.x, p.y, farm::kFarmReach + 40.f)) return true;
    }
    return false;
}

bool Game::hasIngredients(const Player& p, int recipe) const {
    const farm::Recipe& r = farm::kRecipeInfo[recipe];
    for (const farm::Need& need : r.needs) {
        if (need.good >= 0 && p.goods[need.good] < need.count) return false;
    }
    int fish = 0;
    for (int i = 0; i < kFishKinds; ++i) fish += p.caught[i];
    return fish >= r.fish;
}

void Game::cookCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long value = -1;
    in >> action >> value;
    if (p.tradeWith || !spendAction(p)) return;
    if (action == "cancel") {
        p.cooking = -1;
        return;
    }
    if (action == "start") {
        if (value < 0 || value >= farm::kRecipes) return;
        if (!atKitchen(p)) {
            server_.send(id, systemMessage("조리대 앞에서만 요리할 수 있어요. 농장의 조리대나 집의 주방 가구 앞으로 가 주세요."));
            return;
        }
        if (!hasIngredients(p, static_cast<int>(value))) {
            server_.send(id, systemMessage("재료가 모자라요."));
            return;
        }
        p.cooking = static_cast<int>(value);
        p.cookAt = clock_;
        server_.send(id, "{\"t\":\"cook\",\"r\":" + std::to_string(value) + "}");
        return;
    }
    if (action != "done" || p.cooking < 0) return;
    const int recipe = p.cooking;
    const farm::Recipe& r = farm::kRecipeInfo[recipe];
    p.cooking = -1;
    // 과정 하나에 적어도 1.5초는 걸린다. 그보다 빠르면 화면을 거치지 않은 것이다
    if (clock_ - p.cookAt < 1.5 * static_cast<double>(std::string(r.steps).size()) || !hasIngredients(p, recipe)) return;
    const int score = clampInt(value, 0, 100);
    for (const farm::Need& need : r.needs) {
        if (need.good >= 0) addGoods(p, need.good, -need.count);
    }
    for (int i = 0, left = r.fish; i < kFishKinds && left > 0; ++i) {   // 물고기는 흔한 것부터 쓴다
        const int used = std::min(left, p.caught[i]);
        p.caught[i] -= used;
        left -= used;
    }
    const int stars = score >= 85 ? 3 : score >= 60 ? 2 : 1;
    const int made = stars == 3 ? 2 : 1;   // 완벽하게 만들면 한 접시 더
    addGoods(p, farm::kDishBase + recipe, made);
    addStat(id, kCooked);
    if (stars == 3) addStat(id, kCookPerfect);
    if (r.fish > 0) sendInventory(id, p);
    sendGoods(id, p);
    char buf[96];
    std::snprintf(buf, sizeof(buf), "{\"t\":\"cooked\",\"r\":%d,\"score\":%d,\"stars\":%d,\"n\":%d}", recipe, score, stars, made);
    server_.send(id, buf);
    const std::string note = p.name + "님이 " + std::string(static_cast<size_t>(stars), '*') + " " + r.name + (stars == 3 ? "를 완벽하게 만들었어요!" : "를 만들었어요.");
    for (const auto& entry : players_) {
        if (entry.second.zone == p.zone && entry.first != id) server_.send(entry.first, systemMessage(note));
    }
}
