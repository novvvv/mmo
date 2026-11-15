// 농장: 함께 쓰는 밭, 씨앗 가게, 출하 상자, 닭장과 젖소, 곳간(농장의 물건).
// 작물, 물건 번호, 요리법은 farm.hpp 에 있다.
#include "core/rules.hpp"

void Game::loadFarm() {
    farm_.assign(static_cast<size_t>(farm::kPlots), FarmPlot{});
    std::ifstream file(accounts_.dir() + "/farm.list");
    std::string line;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long plot = -1, crop = -1;
        if (f.size() < 6 || !parseWhole(f[0].c_str(), plot) || !parseWhole(f[1].c_str(), crop)) continue;
        if (plot < 0 || plot >= farm::kPlots || crop < 0 || crop >= farm::kCrops || f[5].empty()) continue;
        farm_[static_cast<size_t>(plot)] = {f[5], static_cast<int>(crop), std::atol(f[2].c_str()), std::atol(f[3].c_str()), std::atol(f[4].c_str())};
    }
}

void Game::saveFarm() {
    std::string content;
    for (size_t i = 0; i < farm_.size(); ++i) {
        const FarmPlot& plot = farm_[i];
        if (plot.crop < 0) continue;
        content += std::to_string(i) + "\t" + std::to_string(plot.crop) + "\t" + std::to_string(plot.plantedAt) + "\t" + std::to_string(plot.readyAt) + "\t" +
                   std::to_string(plot.wateredAt) + "\t" + plot.owner + "\n";
    }
    worker_.post([path = accounts_.dir() + "/farm.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

// 밭의 모습. p 는 칸마다 [작물(-1 빈 칸), 다 자랄 때까지 남은 초, 자라는 데 걸리는 초, 심은 사람, 내 것인지, 물을 다시 줄 수 있을 때까지 남은 초, 누구나 거둘 수 있는지]
void Game::sendFarm(ConnId id, const Player& p) {
    const long now = unixNow();
    std::string json = "{\"t\":\"farm\",\"p\":[";
    char buf[96];
    for (size_t i = 0; i < farm_.size(); ++i) {
        const FarmPlot& plot = farm_[i];
        if (i) json += ',';
        if (plot.crop < 0) {
            json += "[-1]";
            continue;
        }
        std::snprintf(buf, sizeof(buf), "[%d,%ld,%ld,\"", plot.crop, std::max(0L, plot.readyAt - now), std::max(1L, plot.readyAt - plot.plantedAt));
        json += buf + text::jsonEscape(nickOf(plot.owner));
        std::snprintf(buf, sizeof(buf), "\",%d,%ld,%d]", plot.owner == p.account ? 1 : 0, std::max(0L, plot.wateredAt + farm::kWaterEverySec / config_.farmSpeed - now),
                      now >= plot.readyAt + farm::kAbandonSec ? 1 : 0);
        json += buf;
    }
    server_.send(id, json + "]}");
}

void Game::broadcastFarm() {
    for (const auto& entry : players_) {
        if (entry.second.zone == world_.farmZone()) sendFarm(entry.first, entry.second);
    }
}

// 곳간. g 는 물건 번호 순서의 개수, egg 와 milk 는 다시 거둘 수 있을 때까지 남은 초
void Game::sendGoods(ConnId id, const Player& p) {
    const long now = unixNow();
    server_.send(id, "{\"t\":\"goods\",\"g\":" + countsJson(p.goods, farm::kGoods) + ",\"egg\":" +
                         std::to_string(std::max(0L, p.eggAt + farm::kEggEverySec / config_.farmSpeed - now)) + ",\"milk\":" +
                         std::to_string(std::max(0L, p.milkAt + farm::kMilkEverySec / config_.farmSpeed - now)) + "}");
}

void Game::addGoods(Player& p, int good, int count) {
    p.goods[good] = std::clamp(p.goods[good] + count, 0, farm::kMaxGoods);
    p.dirty = true;
}

bool Game::nearFixed(const Player& p, const char* kind, float reach) const {
    const Furniture* f = world_.findFurniture(p.zone, kind);
    return f && std::hypot(f->x - p.x, f->y - p.y) <= reach;
}

void Game::farmCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long a = -1, b = -1;
    in >> action;
    in >> a >> b;
    if (p.tradeWith || !spendAction(p)) return;
    const long now = unixNow();
    const auto say = [&](const std::string& message) { server_.send(id, systemMessage(message)); };

    if (action == "eat") {   // 요리는 어디서든 먹는다
        if (a < farm::kDishBase || a >= farm::kGoods || p.goods[a] <= 0) return;
        addGoods(p, static_cast<int>(a), -1);
        setHp(id, p, std::min(kMaxHp, p.hp + 30), 0);
        sendGoods(id, p);
        sendToZone(p.zone, "{\"t\":\"emote\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) + "\",\"e\":1}");
        return;
    }
    if (p.zone != world_.farmZone()) {
        say("농장에서만 할 수 있어요.");
        return;
    }
    if (action == "buy") {   // 씨앗
        if (a < 0 || a >= farm::kCrops) return;
        const int count = clampInt(b < 0 ? 1 : b, 1, 99);
        if (!nearFixed(p, "farm_stall", farm::kFarmReach)) {
            say("씨앗 가게 앞에서만 살 수 있어요.");
            return;
        }
        const int cost = farm::seedPrice(static_cast<int>(a)) * count;
        if (p.gold < cost) {
            say("골드가 부족합니다.");
            return;
        }
        p.gold -= cost;
        addGoods(p, farm::kSeedBase + static_cast<int>(a), count);
        if (cost > 0) sendInventory(id, p);
        sendGoods(id, p);
        return;
    }
    if (action == "sell") {
        if (a < 0 || a >= farm::kGoods || p.goods[a] <= 0) return;
        if (!nearFixed(p, "farm_bin", farm::kFarmReach)) {
            say("출하 상자 앞에서만 팔 수 있어요.");
            return;
        }
        const int count = std::min(p.goods[a], clampInt(b < 0 ? 1 : b, 1, farm::kMaxGoods));
        addGoods(p, static_cast<int>(a), -count);
        p.gold += farm::sellPrice(static_cast<int>(a)) * count;
        sendInventory(id, p);
        sendGoods(id, p);
        return;
    }
    if (action == "egg" || action == "milk") {
        const bool egg = action == "egg";
        if (!nearFixed(p, egg ? "farm_coop" : "farm_cow", farm::kFarmReach)) return;
        long& last = egg ? p.eggAt : p.milkAt;
        const long wait = last + (egg ? farm::kEggEverySec : farm::kMilkEverySec) / config_.farmSpeed - now;
        if (wait > 0) {
            say(std::string(egg ? "닭이 아직 알을 품고 있어요. " : "젖소가 아직 쉬고 있어요. ") + std::to_string((wait + 59) / 60) + "분쯤 뒤에 다시 와 주세요.");
            return;
        }
        last = now;
        addGoods(p, egg ? farm::kEgg : farm::kMilk, egg ? farm::kEggCount : farm::kMilkCount);
        sendGoods(id, p);
        say(egg ? "달걀 2개를 꺼냈어요." : "우유 1병을 짰어요.");
        return;
    }

    // 여기부터는 밭 한 칸에 하는 일
    if (a < 0 || a >= farm::kPlots) return;
    FarmPlot& plot = farm_[static_cast<size_t>(a)];
    const Spot& spot = world_.farmPlots()[static_cast<size_t>(a)];
    if (std::hypot(spot.x - p.x, spot.y - p.y) > farm::kPlotReach) {
        say("밭에 더 가까이 가 주세요.");
        return;
    }
    const bool mine = plot.owner == p.account;
    const bool ripe = plot.crop >= 0 && now >= plot.readyAt;
    if (action == "plant") {
        if (plot.crop >= 0) {
            say("이미 무언가 자라고 있어요.");
            return;
        }
        if (b < 0 || b >= farm::kCrops) return;
        const int seed = farm::kSeedBase + static_cast<int>(b);
        if (p.goods[seed] <= 0) {
            say(std::string(farm::kCropInfo[b].name) + " 씨앗이 없어요. 씨앗 가게에서 구할 수 있어요.");
            return;
        }
        const long held = std::count_if(farm_.begin(), farm_.end(), [&](const FarmPlot& other) { return other.crop >= 0 && other.owner == p.account; });
        if (held >= farm::kPlotsPerPlayer) {
            say("한 사람이 " + std::to_string(farm::kPlotsPerPlayer) + "칸까지 쓸 수 있어요. 다 자란 것부터 거둬 주세요.");
            return;
        }
        addGoods(p, seed, -1);
        plot = {p.account, static_cast<int>(b), now, now + std::max(1L, static_cast<long>(farm::kCropInfo[b].growSec / config_.farmSpeed)), 0};
        sendGoods(id, p);
    } else if (action == "water") {
        if (plot.crop < 0 || ripe) return;
        if (now < plot.wateredAt + farm::kWaterEverySec / config_.farmSpeed) {
            say("흙이 아직 촉촉해요. 조금 뒤에 다시 줄 수 있어요.");
            return;
        }
        plot.wateredAt = now;
        plot.readyAt = std::max(now, plot.readyAt - std::max(1L, (plot.readyAt - plot.plantedAt) * farm::kWaterPercent / 100));
        if (!mine) {
            ConnId ownerId = 0;
            if (onlinePlayer(plot.owner, &ownerId)) server_.send(ownerId, systemMessage(p.name + "님이 내 " + farm::kCropInfo[plot.crop].name + "에 물을 줬어요."));
        }
    } else if (action == "harvest") {
        if (!ripe) return;
        if (!mine && now < plot.readyAt + farm::kAbandonSec) {
            say(nickOf(plot.owner) + "님이 심은 작물이에요.");
            return;
        }
        const int crop = plot.crop;
        const int count = 2 + (std::uniform_int_distribution<int>(0, 4)(rng_) == 0 ? 1 : 0);   // 가끔 하나 더
        addGoods(p, crop, count);
        addStat(id, kHarvested, count);
        plot = FarmPlot{};
        sendGoods(id, p);
        server_.send(id, "{\"t\":\"harvest\",\"plot\":" + std::to_string(a) + ",\"crop\":" + std::to_string(crop) + ",\"n\":" + std::to_string(count) + "}");
    } else if (action == "dig") {
        if (plot.crop < 0 || !mine) return;
        plot = FarmPlot{};
    } else {
        return;
    }
    saveFarm();
    broadcastFarm();
}
