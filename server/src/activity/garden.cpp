// 텃밭: 집과 마당에 놓은 텃밭 가구에 심고, 물 주고, 거둔다. 작물은 그 가구와 함께 decor.list 에 저장된다.
#include "core/rules.hpp"

// 지금 있는 구역의 텃밭에 자라는 것. p 는 [가구 번호, 작물, 남은 초, 걸리는 초, 심은 사람, 내 것인지, 물을 다시 줄 수 있을 때까지, 누구나 거둘 수 있는지]
void Game::sendGarden(ConnId id, const Player& p) {
    const long now = unixNow();
    std::string json = "{\"t\":\"garden\",\"z\":" + std::to_string(p.zone) + ",\"p\":[";
    char buf[96];
    bool first = true;
    for (const Decor& item : decor_) {
        if (item.zone != p.zone || item.crop < 0) continue;
        std::snprintf(buf, sizeof(buf), "%s[%d,%d,%ld,%ld,\"", first ? "" : ",", item.id, item.crop, std::max(0L, item.readyAt - now), std::max(1L, item.readyAt - item.plantedAt));
        json += buf + text::jsonEscape(nickOf(item.planter));
        std::snprintf(buf, sizeof(buf), "\",%d,%ld,%d]", item.planter == p.account ? 1 : 0, std::max(0L, item.wateredAt + farm::kWaterEverySec / config_.farmSpeed - now),
                      now >= item.readyAt + farm::kAbandonSec ? 1 : 0);
        json += buf;
        first = false;
    }
    server_.send(id, json + "]}");
}

void Game::broadcastGarden(int zone) {
    for (const auto& entry : players_) {
        if (entry.second.zone == zone) sendGarden(entry.first, entry.second);
    }
}

// "plant <가구 번호> <작물>", "water <가구 번호>", "harvest <가구 번호>", "dig <가구 번호>"
void Game::gardenCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long a = -1, b = -1;
    in >> action >> a >> b;
    if (p.tradeWith || !spendAction(p)) return;
    const auto say = [&](const std::string& message) { server_.send(id, systemMessage(message)); };
    const auto found = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == a && item.zone == p.zone && decor::isPlot(item.kind); });
    if (found == decor_.end()) return;
    Decor& bed = *found;
    if (std::hypot(bed.x - p.x, bed.y - p.y) > farm::kPlotReach + 16.f * bed.scale) {
        say("밭에 더 가까이 가 주세요.");
        return;
    }
    const long now = unixNow();
    const bool mine = bed.planter == p.account;
    const bool ripe = bed.crop >= 0 && now >= bed.readyAt;
    if (action == "plant") {
        if (bed.crop >= 0) {
            say("이미 무언가 자라고 있어요.");
            return;
        }
        if (b < 0 || b >= farm::kCrops) return;
        const int seed = farm::kSeedBase + static_cast<int>(b);
        if (p.goods[seed] <= 0) {
            say(std::string(farm::kCropInfo[b].name) + " 씨앗이 없어요. 농장의 씨앗 가게에서 구할 수 있어요.");
            return;
        }
        const long held = std::count_if(decor_.begin(), decor_.end(), [&](const Decor& other) { return other.crop >= 0 && other.planter == p.account; });
        if (held >= farm::kHomePlotsPerPlayer) {
            say("텃밭에는 한 사람이 " + std::to_string(farm::kHomePlotsPerPlayer) + "칸까지 기를 수 있어요. 다 자란 것부터 거둬 주세요.");
            return;
        }
        addGoods(p, seed, -1);
        bed.crop = static_cast<int>(b);
        bed.planter = p.account;
        bed.plantedAt = now;
        bed.readyAt = now + std::max(1L, static_cast<long>(farm::kCropInfo[b].growSec / config_.farmSpeed));
        bed.wateredAt = 0;
        sendGoods(id, p);
    } else if (action == "water") {
        if (bed.crop < 0 || ripe) return;
        if (now < bed.wateredAt + farm::kWaterEverySec / config_.farmSpeed) {
            say("흙이 아직 촉촉해요. 조금 뒤에 다시 줄 수 있어요.");
            return;
        }
        bed.wateredAt = now;
        bed.readyAt = std::max(now, bed.readyAt - std::max(1L, (bed.readyAt - bed.plantedAt) * farm::kWaterPercent / 100));
        if (!mine) {
            ConnId ownerId = 0;
            if (onlinePlayer(bed.planter, &ownerId)) server_.send(ownerId, systemMessage(p.name + "님이 내 " + farm::kCropInfo[bed.crop].name + "에 물을 줬어요."));
        }
    } else if (action == "harvest") {
        if (!ripe) return;
        if (!mine && now < bed.readyAt + farm::kAbandonSec) {
            say(nickOf(bed.planter) + "님이 심은 작물이에요.");
            return;
        }
        const int crop = bed.crop;
        const int count = 2 + (std::uniform_int_distribution<int>(0, 4)(rng_) == 0 ? 1 : 0);
        addGoods(p, crop, count);
        addStat(id, kHarvested, count);
        bed.crop = -1;
        bed.planter.clear();
        sendGoods(id, p);
        server_.send(id, "{\"t\":\"harvest\",\"bed\":" + std::to_string(bed.id) + ",\"crop\":" + std::to_string(crop) + ",\"n\":" + std::to_string(count) + "}");
    } else if (action == "dig") {   // 심은 사람이나, 그 밭을 치울 수 있는 사람이 뽑는다
        if (bed.crop < 0 || (!mine && !canManage(p, bed))) return;
        bed.crop = -1;
        bed.planter.clear();
    } else {
        return;
    }
    saveDecor();
    broadcastGarden(p.zone);
}
