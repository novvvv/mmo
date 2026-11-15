// 아이템과 골드: 소지품 개수, 버리기와 줍기(바닥 아이템), 먹기, 매점, 감정표현 사기, HP.
// 아이템 번호는 물고기, 전리품, 매점 물건, 농장의 물건 순서로 이어진다 (game.hpp 의 kBagKinds).
#include "core/rules.hpp"

void Game::addDrop(int zone, int kind, int amount, float x, float y, ConnId owner) {
    std::uniform_real_distribution<float> scatter(-kDropScatter, kDropScatter);
    const Zone& area = world_.zone(zone);
    Drop drop;
    drop.id = nextDropId_++;
    drop.kind = kind;
    drop.amount = amount;
    drop.zone = zone;
    drop.x = std::clamp(x + scatter(rng_), 20.f, area.w - 20.f);
    drop.y = std::clamp(y + scatter(rng_), 20.f, area.h - 20.f);
    drop.ttl = owner ? kPlayerDropTtlSec : kDropTtlSec;
    drop.owner = owner;
    drops_.push_back(drop);
}

void Game::updateDrops(float dt) {
    std::vector<bool> changed(static_cast<size_t>(world_.zoneCount()), false);
    for (auto it = drops_.begin(); it != drops_.end();) {
        it->ttl -= dt;
        bool gone = it->ttl <= 0.f;
        for (auto& entry : players_) {
            Player& p = entry.second;
            if (gone || p.zone != it->zone) continue;
            const bool near = std::hypot(p.x - it->x, p.y - it->y) <= kPickupReach;
            if (entry.first == it->owner) {
                if (!near) it->owner = 0;  // 멀어졌으니 이제 주울 수 있다
                continue;
            }
            if (!near) continue;
            if (it->kind == kGoldDrop) {
                p.gold = std::min(kMaxGold, p.gold + it->amount);
            } else {
                int* count = itemCount(p, it->kind);
                if (!count) continue;
                *count = std::min(stackLimit(it->kind), *count + it->amount);
            }
            p.dirty = true;
            server_.send(entry.first, "{\"t\":\"loot\",\"k\":" + std::to_string(it->kind) + ",\"n\":" + std::to_string(it->amount) + "}");
            if (it->kind >= kItemKinds && it->kind < kBagKinds) sendGoods(entry.first, p);
            else sendInventory(entry.first, p);
            gone = true;
        }
        if (gone) {
            changed[static_cast<size_t>(it->zone)] = true;
            it = drops_.erase(it);
        } else {
            ++it;
        }
    }
    for (int zone = 0; zone < world_.zoneCount(); ++zone) {
        if (changed[static_cast<size_t>(zone)]) sendToZone(zone, dropsJson(zone));
    }
}

std::string Game::dropsJson(int zone) const {
    std::string json = "{\"t\":\"drops\",\"p\":[";
    char buf[72];
    bool first = true;
    for (const Drop& drop : drops_) {
        if (drop.zone != zone) continue;
        std::snprintf(buf, sizeof(buf), "%s[%d,%d,%.1f,%.1f,%d]", first ? "" : ",", drop.id, drop.kind, drop.x, drop.y, drop.amount);
        json += buf;
        first = false;
    }
    json += "]}";
    return json;
}

std::string Game::lootCounts(const Player& p) const {
    std::string json = "[";
    for (int i = 0; i < kLootKinds; ++i) json += (i ? "," : "") + std::to_string(p.loot[i]);
    return json + "]";
}

int* Game::itemCount(Player& p, int kind) {
    if (kind < 0) return nullptr;
    if (kind < kFishKinds) return &p.caught[kind];
    if (kind < kFishKinds + kLootKinds) return &p.loot[kind - kFishKinds];
    if (kind < kItemKinds) return &p.shop[kind - kFishKinds - kLootKinds];
    if (kind < kBagKinds) return &p.goods[kind - kItemKinds];   // 농장의 물건
    return nullptr;
}

std::string Game::countsJson(const int* counts, int size) const {
    std::string json = "[";
    for (int i = 0; i < size; ++i) json += (i ? "," : "") + std::to_string(counts[i]);
    return json + "]";
}

void Game::sendInventory(ConnId id, const Player& p) {
    server_.send(id, "{\"t\":\"inv\",\"c\":" + countsJson(p.caught, kFishKinds) + ",\"l\":" + countsJson(p.loot, kLootKinds) +
                         ",\"s\":" + countsJson(p.shop, kShopKinds) + ",\"f\":" + countsJson(p.furn, kDecorKinds) + ",\"fd\":" + dyedJson(p) + ",\"dye\":" + std::to_string(p.dye) + ",\"pets\":" + std::to_string(p.pets) + ",\"em\":" + std::to_string(p.emotes) + ",\"pet\":" + std::to_string(p.pet) + ",\"freed\":" + freedPetsJson(p.account) + ",\"floors\":" + std::to_string(p.floorsOwned) + ",\"g\":" + std::to_string(p.gold) + ",\"w\":" + (p.welcomeReady ? "true" : "false") + "}");
}

std::string Game::dyedJson(const Player& p) {
    std::string json = "[";
    for (const auto& item : p.dyed) json += (json.size() > 1 ? ",[" : "[") + std::to_string(item.first) + ",\"" + item.second + "\"]";
    return json + "]";
}

// "<아이템 번호> <개수>": 발밑에 버린다. 교환 중에는 내놓은 물건이 줄어들지 않도록 막는다.
void Game::dropItem(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    long kind = -1, amount = 0;
    if (!(in >> kind >> amount) || p.tradeWith || !spendAction(p)) return;
    int* count = itemCount(p, static_cast<int>(kind));
    if (!count || *count <= 0 || amount <= 0) return;
    const auto inZone = std::count_if(drops_.begin(), drops_.end(), [&p](const Drop& d) { return d.zone == p.zone; });
    if (static_cast<size_t>(inZone) >= kMaxDropsPerZone) {
        server_.send(id, systemMessage("이곳에는 더 버릴 수 없습니다."));
        return;
    }
    const int dropped = clampInt(amount, 1, *count);
    *count -= dropped;
    p.dirty = true;
    addDrop(p.zone, static_cast<int>(kind), dropped, p.x, p.y + 10.f, id);
    if (kind >= kItemKinds) sendGoods(id, p);
    else sendInventory(id, p);
    sendToZone(p.zone, dropsJson(p.zone));
}

void Game::setHp(ConnId id, Player& p, int hp, int hit) {
    p.hp = hp;
    server_.send(id, "{\"t\":\"hp\",\"v\":" + std::to_string(p.hp) + (hit ? ",\"hit\":" + std::to_string(hit) : "") + "}");
}

// "<아이템 번호>": 매점 물건을 먹거나 마신다.
void Game::eatItem(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || p.tradeWith || !spendAction(p)) return;
    const long shopIndex = kind - kFishKinds - kLootKinds;
    if (shopIndex < 0 || shopIndex >= kShopKinds || p.shop[shopIndex] <= 0) return;
    const auto& item = kShop[shopIndex];
    if (!item.snack && p.hp >= kMaxHp) {
        server_.send(id, systemMessage("HP가 가득 차 있어서 쓸 수 없습니다."));
        return;
    }
    --p.shop[shopIndex];
    p.dirty = true;
    setHp(id, p, std::min(kMaxHp, p.hp + item.heal), 0);
    sendInventory(id, p);
    if (item.snack) sendToZone(p.zone, "{\"t\":\"emote\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) + "\",\"e\":1}");
}

// "<아이템 번호>": 매점 앞에서만 살 수 있다.
void Game::buyItem(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || p.tradeWith || !spendAction(p)) return;
    const long shopIndex = kind - kFishKinds - kLootKinds;
    if (shopIndex < 0 || shopIndex >= kShopKinds) return;
    const Furniture* counter = world_.findFurniture(p.zone, kShop[shopIndex].bar ? "bartender" : "snack_bar");
    if (!counter || std::hypot(counter->x - p.x, counter->y - p.y) > kShopReach + 40.f) {
        server_.send(id, systemMessage(kShop[shopIndex].bar ? "바텐더 앞에서만 살 수 있습니다." : "매점 앞에서만 살 수 있습니다."));
        return;
    }
    if (shopIndex == kWelcomeDrink && !p.welcomeReady) {
        server_.send(id, systemMessage("웰컴 드링크는 입장할 때마다 한 잔만 받을 수 있습니다."));
        return;
    }
    if (p.gold < kShop[shopIndex].price) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    if (p.shop[shopIndex] >= kMaxStack) return;
    if (shopIndex == kWelcomeDrink) p.welcomeReady = false;
    p.gold -= kShop[shopIndex].price;
    ++p.shop[shopIndex];
    p.dirty = true;
    sendInventory(id, p);
}

// "<펫 번호>": 상점에서 펫을 산다. 같은 펫은 한 번만 산다.
void Game::buyEmote(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || kind < 0 || kind >= decor::kEmoteKinds || !decor::emotePaid(static_cast<int>(kind)) || !spendAction(p)) return;
    if (p.emotes & (1 << kind)) {
        server_.send(id, systemMessage("이미 가지고 있는 감정표현입니다."));
        return;
    }
    if (p.gold < decor::emotePrice(static_cast<int>(kind))) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    p.gold -= decor::emotePrice(static_cast<int>(kind));
    p.emotes |= 1 << kind;
    p.dirty = true;
    sendInventory(id, p);
}
