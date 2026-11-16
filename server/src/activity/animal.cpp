// 동물: 강가의 고양이와 집 안의 강아지가 돌아다니고 쉬고 잠든다. 쓰다듬기와 먹이 주기. 펫 사기, 데리고 다니기, 집에 풀어놓기.
#include "game/rules.hpp"

// ------------------------------------------------------------ 동물: 강가의 고양이와 집 안의 강아지, 집에 풀어놓은 펫이 돌아다니고 쉬고 잠든다. 쓰다듬기와 먹이 주기.

void Game::placeCats() {
    const River& river = world_.river();
    const struct { float x; bool north; } homes[] = {
        {520.f, true}, {960.f, true}, {170.f, true}, {420.f, false}, {1120.f, false},
    };
    for (const auto& home : homes) {
        Cat cat;
        cat.slot = static_cast<int>(cats_.size());
        cat.homeX = home.x;
        cat.north = home.north;
        cat.x = home.x;
        cat.y = home.north ? river.top(home.x) - 70.f : river.bottom(home.x) + 70.f;
        cat.timer = catRestTime();
        cats_.push_back(cat);
    }
    for (const CatHome& home : town_.roomCats()) {
        Cat cat;
        cat.zone = home.zone;
        cat.slot = static_cast<int>(std::count_if(cats_.begin(), cats_.end(), [&](const Cat& other) { return other.zone == home.zone; }));
        cat.x = home.x;
        cat.y = home.y;
        cat.timer = catRestTime();
        cats_.push_back(cat);
    }
}

float Game::catRestTime() {
    return std::uniform_real_distribution<float>(kCatRestMinSec, kCatRestMaxSec)(rng_);
}

bool Game::isNight() const {
    using namespace std::chrono;
    const double seconds = duration<double>(system_clock::now().time_since_epoch()).count();
    return std::fmod(seconds, core_.config().halfCycleSec * 2.0) >= core_.config().halfCycleSec;
}

int Game::nearestCat(const Player& p) const {
    int best = -1;
    float bestDist = kCatReach;
    for (int i = 0; i < static_cast<int>(cats_.size()); ++i) {
        const Cat& cat = cats_[static_cast<size_t>(i)];
        if (cat.zone != p.zone) continue;
        const float dist = std::hypot(cat.x - p.x, cat.y - p.y);
        if (dist <= bestDist) {
            best = i;
            bestDist = dist;
        }
    }
    return best;
}

void Game::pickCatTarget(Cat& cat) {
    if (cat.zone != 0) {  // 방 안: 가구가 없는 빈 바닥 중 한 곳으로
        // 복도로 이어진 집에서는 지금 있는 방 안에서만 돌아다녀 벽 앞에 서성이지 않게 한다.
        const Zone& room = world_.zone(cat.zone);
        const FloorRect* floor = world_.floorAt(cat.zone, cat.x, cat.y);
        const float x0 = floor ? floor->x0 : 0.f, y0 = floor ? floor->y0 : 0.f;
        const float x1 = floor ? floor->x1 : room.w, y1 = floor ? floor->y1 : room.h;
        const float midX = (x0 + x1) / 2.f, midY = (y0 + y1) / 2.f;
        std::uniform_real_distribution<float> spotX(std::min(x0 + kCatRoomMargin, midX), std::max(x1 - kCatRoomMargin, midX));
        std::uniform_real_distribution<float> spotY(std::min(y0 + kCatRoomMargin, midY), std::max(y1 - kCatRoomMargin, midY));
        for (int attempt = 0; attempt < 16; ++attempt) {
            const float x = spotX(rng_), y = spotY(rng_);
            if (world_.blocked(cat.zone, x, y)) continue;
            cat.targetX = x;
            cat.targetY = y;
            cat.walking = true;
            cat.timer = kCatWalkMaxSec;
            return;
        }
        cat.timer = catRestTime();
        return;
    }
    const River& river = world_.river();
    std::uniform_real_distribution<float> offset(-kCatRoam, kCatRoam);
    std::uniform_real_distribution<float> bankGap(kCatBankMin, kCatBankMax);
    cat.targetX = std::clamp(cat.homeX + offset(rng_), 40.f, kWorldW - 40.f);
    cat.targetY = cat.north ? river.top(cat.targetX) - bankGap(rng_) : river.bottom(cat.targetX) + bankGap(rng_);
    cat.walking = true;
    cat.timer = kCatWalkMaxSec;
}

// 집에 풀어놓은 고양이가 쉬다가 가끔 같은 방의 고양이 가구로 간다. 다른 고양이가 쓰고 있는 가구는 고르지 않는다.
bool Game::pickCatFurniture(Cat& cat) {
    if (cat.zone == 0 || cat.pet < 0 || decor::petIsDog(cat.pet)) return false;
    if (std::uniform_int_distribution<int>(0, 99)(rng_) >= config_.catFurniturePercent) return false;
    std::vector<const Decor*> free;
    for (const Decor& d : decor_) {
        if (d.zone != cat.zone || std::strncmp(decor::kCatalog[d.kind].kind, "cat_", 4) != 0) continue;
        const bool taken = std::any_of(cats_.begin(), cats_.end(), [&](const Cat& other) { return &other != &cat && (other.perch == d.id || other.perchGoal == d.id); });
        if (!taken && !world_.blocked(cat.zone, d.x, d.y + kCatPerchFront)) free.push_back(&d);
    }
    if (free.empty()) return false;
    const Decor& chosen = *free[std::uniform_int_distribution<size_t>(0, free.size() - 1)(rng_)];
    cat.perchGoal = chosen.id;
    cat.targetX = chosen.x;
    cat.targetY = chosen.y + kCatPerchFront;
    cat.walking = true;
    cat.timer = kCatWalkMaxSec;
    return true;
}

void Game::stepCat(Cat& cat, float nx, float ny) {
    if (cat.zone == 0) world_.moveCat(cat.x, cat.y, nx, ny);
    else world_.move(cat.zone, cat.x, cat.y, nx, ny);
}

// 평소에는 돌아다니다 쉬기를 반복하고, 먹이를 준 사람이 있으면 잠시 따라간다.
void Game::updateCat(Cat& cat, float dt) {
    if (cat.followTimer > 0.f) {
        cat.followTimer -= dt;
        const auto it = players_.find(cat.followId);
        if (cat.followTimer <= 0.f || it == players_.end() || it->second.zone != cat.zone) {
            cat.followTimer = 0.f;
            cat.followId = 0;
            cat.walking = false;
            cat.timer = catRestTime();
            return;
        }
        const float dx = it->second.x - cat.x;
        const float dy = it->second.y - cat.y;
        const float dist = std::hypot(dx, dy);
        if (dist > kCatFollowGap) {
            const float step = kCatFollowSpeed * dt;
            stepCat(cat, cat.x + dx / dist * step, cat.y + dy / dist * step);
        }
        return;
    }

    cat.timer -= dt;
    if (cat.perch >= 0) {   // 가구 위: 시간이 다 되거나 가구를 치우거나 옮기면 내려온다
        const auto d = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == cat.perch; });
        const bool still = d != decor_.end() && d->zone == cat.zone && std::hypot(d->x - cat.x, d->y + kCatPerchFront - cat.y) < 2.f;
        if (still && cat.timer > 0.f) return;
        cat.perch = -1;
        cat.asleep = false;
        cat.timer = catRestTime();
        return;
    }
    if (!cat.walking) {
        if (cat.timer > 0.f) return;
        if (cat.asleep) {   // 다 잤다: 잠깐 앉아 있다가 다시 돌아다닌다
            cat.asleep = false;
            cat.timer = catRestTime();
            return;
        }
        // 쉬다가 가끔 그 자리에서 잠든다. 밤에는 더 자주, 더 오래 잔다
        const bool night = isNight();
        const int chance = config_.catNapPercent >= 0 ? config_.catNapPercent : night ? 60 : 12;
        if (std::uniform_int_distribution<int>(0, 99)(rng_) < chance) {
            cat.asleep = true;
            cat.timer = std::uniform_real_distribution<float>(40.f, 100.f)(rng_) * (night ? 2.5f : 1.f);
            return;
        }
        if (!pickCatFurniture(cat)) pickCatTarget(cat);
        return;
    }
    const float dx = cat.targetX - cat.x;
    const float dy = cat.targetY - cat.y;
    const float dist = std::hypot(dx, dy);
    if (dist < 4.f || cat.timer <= 0.f) {
        cat.walking = false;
        cat.timer = catRestTime();
        if (cat.perchGoal >= 0) {   // 가구 앞에 닿았으면 올라탄다. 캣휠은 짧게 달리고, 숨숨집에서는 낮잠을 자기도 한다
            const auto d = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& item) { return item.id == cat.perchGoal; });
            if (d != decor_.end() && d->zone == cat.zone && dist < 30.f) {
                cat.x = d->x;
                cat.y = d->y + kCatPerchFront;
                cat.perch = d->id;
                const bool wheel = std::strcmp(decor::kCatalog[d->kind].kind, "cat_wheel") == 0;
                const bool hideout = std::strcmp(decor::kCatalog[d->kind].kind, "cat_hideout") == 0;
                cat.timer = std::uniform_real_distribution<float>(wheel ? 8.f : 25.f, wheel ? 20.f : 70.f)(rng_);
                cat.asleep = hideout && std::uniform_int_distribution<int>(0, 1)(rng_) == 0;
            }
            cat.perchGoal = -1;
        }
        return;
    }
    const float step = kCatSpeed * dt;
    stepCat(cat, cat.x + dx / dist * step, cat.y + dy / dist * step);
}

std::string Game::catEvent(int index, ConnId id, const Player& p, const char* action) const {
    return "{\"t\":\"cat\",\"i\":" + std::to_string(cats_[static_cast<size_t>(index)].slot) + ",\"act\":\"" + action + "\",\"id\":" + std::to_string(id) +
           ",\"n\":\"" + text::jsonEscape(p.name) + "\"";
}

void Game::petCat(ConnId id, Player& p) {
    if (p.catCooldown > 0.f) return;
    const int index = nearestCat(p);
    if (index < 0) return;
    p.catCooldown = kCatCooldownSec;

    Cat& cat = cats_[static_cast<size_t>(index)];
    const bool woke = cat.asleep;
    cat.asleep = false;
    cat.perch = cat.perchGoal = -1;   // 쓰다듬으면 가구에서 내려온다
    if (cat.followTimer <= 0.f) {  // 쓰다듬는 동안 제자리에 앉아 있는다
        cat.walking = false;
        cat.timer = kCatPetRestSec;
    }
    sendToZone(cat.zone, catEvent(index, id, p, "pet") + (woke ? ",\"woke\":1}" : "}"));
    if (woke) broadcastCats();
}

void Game::feedCat(ConnId id, Player& p) {
    if (p.catCooldown > 0.f) return;
    const int index = nearestCat(p);
    if (index < 0) return;
    p.catCooldown = kCatCooldownSec;

    int kind = -1;
    for (int i = 0; i < kFishKinds && kind < 0; ++i) {
        if (p.caught[i] > 0) kind = i;
    }
    if (kind < 0) {
        server_.send(id, systemMessage("줄 물고기가 없습니다. 먼저 낚시를 해 보세요."));
        return;
    }
    --p.caught[kind];
    p.dirty = true;

    Cat& cat = cats_[static_cast<size_t>(index)];
    cat.walking = false;
    cat.asleep = false;
    cat.perch = cat.perchGoal = -1;
    cat.followId = id;
    cat.followTimer = kCatFollowSec;

    std::string json = catEvent(index, id, p, "feed") + ",\"k\":" + std::to_string(kind) + ",\"c\":[";
    for (int i = 0; i < kFishKinds; ++i) {
        if (i > 0) json += ',';
        json += std::to_string(p.caught[i]);
    }
    json += "]}";
    sendToZone(cat.zone, json);
}

void Game::broadcastCats() {
    if (players_.empty()) return;
    std::vector<std::string> byZone(static_cast<size_t>(world_.zoneCount()));
    char buf[64];
    for (const Cat& cat : cats_) {
        std::string& list = byZone[static_cast<size_t>(cat.zone)];
        if (cat.perch >= 0) std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f,%d,%d,%d]", list.empty() ? "" : ",", cat.x, cat.y, cat.pet, cat.asleep ? 1 : 0, cat.perch);   // 다섯째는 쓰는 고양이 가구
        else if (cat.asleep) std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f,%d,1]", list.empty() ? "" : ",", cat.x, cat.y, cat.pet);
        else if (cat.pet >= 0) std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f,%d]", list.empty() ? "" : ",", cat.x, cat.y, cat.pet);
        else std::snprintf(buf, sizeof(buf), "%s[%.0f,%.0f]", list.empty() ? "" : ",", cat.x, cat.y);
        list += buf;
        if (!cat.name.empty()) {   // 이름을 지어 준 펫: 여섯째에 이름 (빈 자리는 채운다)
            list.pop_back();
            if (cat.perch < 0) list += cat.asleep ? ",-1" : ",0,-1";
            list += ",\"" + text::jsonEscape(cat.name) + "\"]";
        }
    }
    for (int zone = 0; zone < world_.zoneCount(); ++zone) {
        const std::string& list = byZone[static_cast<size_t>(zone)];
        if (!list.empty()) sendToZone(zone, "{\"t\":\"cats\",\"p\":[" + list + "]}");
    }
}

// ------------------------------------------------------------ 펫: 상점에서 사기, 데리고 다니기, 집에 풀어놓기와 불러오기.

void Game::buyPet(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || kind < 0 || kind >= decor::kPetKinds || !spendAction(p)) return;
    if (p.pets & (1 << kind)) {
        server_.send(id, systemMessage("이미 함께하는 펫입니다."));
        return;
    }
    if (p.gold < decor::petPrice(static_cast<int>(kind))) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    p.gold -= decor::petPrice(static_cast<int>(kind));
    p.pets |= 1 << kind;
    if (p.pet < 0) p.pet = static_cast<int>(kind);  // 첫 펫은 바로 데리고 다닌다
    p.dirty = true;
    sendInventory(id, p);
}

// "<펫 번호>" 는 그 펫을 데리고 다니고, "-1" 은 집에 둔다. 다른 사람에게는 매 틱 상태의 pt 로 보인다.
void Game::walkPet(ConnId id, Player& p, const std::string& arg) {
    long kind = -2;
    if (!parseWhole(arg.c_str(), kind) || kind < -1 || kind >= decor::kPetKinds) return;
    if (kind >= 0 && !(p.pets & (1 << kind))) return;
    if (kind == p.pet || !spendAction(p)) return;
    if (kind >= 0 && takeBackPet(p.account, static_cast<int>(kind))) savePets();
    p.pet = static_cast<int>(kind);
    p.dirty = true;
    sendInventory(id, p);
}

// "<펫 번호> <이름>": 내 펫에게 이름을 지어 준다. 이름을 비우면 종류 이름으로 돌아간다.
// 데리고 다니면 state 의 pn 으로, 풀어놓았으면 cats 의 여섯째로 모두에게 보인다.
void Game::renamePet(ConnId id, Player& p, const std::string& arg) {
    const size_t space = arg.find(' ');
    long kind = -1;
    if (!parseWhole(arg.substr(0, space).c_str(), kind) || kind < 0 || kind >= decor::kPetKinds || !(p.pets & (1 << kind)) || !spendAction(p)) return;
    const std::string name = space == std::string::npos ? "" : text::sanitize(arg.substr(space + 1), kMaxPetNameChars);
    if (name == p.petNames[kind]) return;
    p.petNames[kind] = name;
    p.dirty = true;
    bool freed = false;
    for (Cat& cat : cats_) {
        if (cat.pet == kind && cat.owner == p.account) {
            cat.name = name;
            freed = true;
        }
    }
    if (freed) {
        savePets();
        broadcastCats();
    }
    sendInventory(id, p);
}

std::string Game::petNamesJson(const Player& p) {
    std::string json = "[";
    for (int i = 0; i < decor::kPetKinds; ++i) json += (i ? ",\"" : "\"") + text::jsonEscape(p.petNames[i]) + "\"";
    return json + "]";
}

// 한 줄에 "<주인 계정>\t<펫 번호>\t<구역>\t<지어 준 이름>". 서버를 다시 켜면 집 문 안쪽에서 다시 돌아다닌다.
void Game::loadPets() {
    std::ifstream file(accounts_.dir() + "/pets.list");
    std::string line;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long kind = -1, zone = -1;
        if (f.size() < 3 || f[0].empty() || !parseWhole(f[1].c_str(), kind) || kind < 0 || kind >= decor::kPetKinds ||
            !parseWhole(f[2].c_str(), zone) || !isHouseZone(static_cast<int>(zone))) continue;
        const Zone& room = world_.zone(static_cast<int>(zone));
        Cat cat;
        cat.zone = static_cast<int>(zone);
        cat.x = room.doorX;
        cat.y = room.doorY - 70.f;
        cat.timer = catRestTime();
        cat.pet = static_cast<int>(kind);
        cat.owner = f[0];
        if (f.size() > 3) cat.name = text::sanitize(f[3], kMaxPetNameChars);
        cats_.push_back(cat);
    }
    renumberCats();
}

void Game::savePets() {
    std::string content;
    for (const Cat& cat : cats_) {
        if (cat.pet >= 0) content += cat.owner + "\t" + std::to_string(cat.pet) + "\t" + std::to_string(cat.zone) + "\t" + cat.name + "\n";
    }
    worker_.post([path = accounts_.dir() + "/pets.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

// 메시지의 고양이 번호는 구역 안에서의 순서다. 펫이 빠지면 다시 센다.
void Game::renumberCats() {
    std::unordered_map<int, int> counts;
    for (Cat& cat : cats_) cat.slot = counts[cat.zone]++;
}

std::string Game::freedPetsJson(const std::string& account) const {
    std::string json = "[";
    for (const Cat& cat : cats_) {
        if (cat.pet < 0 || cat.owner != account) continue;
        json += (json.size() > 1 ? ",[" : "[") + std::to_string(cat.pet) + "," + std::to_string(cat.zone) + "]";
    }
    return json + "]";
}

// 풀어놓은 펫을 집에서 데려온다. 있었으면 true.
bool Game::takeBackPet(const std::string& account, int kind) {
    const auto found = std::find_if(cats_.begin(), cats_.end(), [&](const Cat& cat) { return cat.pet == kind && cat.owner == account; });
    if (found == cats_.end()) return false;
    cats_.erase(found);
    renumberCats();
    return true;
}

// "<펫 번호>": 지금 있는 집에 풀어놓는다. 데리고 다니던 펫이면 손을 놓는다.
void Game::releasePet(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || kind < 0 || kind >= decor::kPetKinds || !(p.pets & (1 << kind)) || !spendAction(p)) return;
    if (!isHouseZone(p.zone)) {
        server_.send(id, systemMessage("펫은 집 안에만 풀어놓을 수 있습니다."));
        return;
    }
    if (std::count_if(cats_.begin(), cats_.end(), [&](const Cat& cat) { return cat.zone == p.zone && cat.pet >= 0; }) >= kMaxPetsPerHouse) {
        server_.send(id, systemMessage("이 집에는 펫을 더 풀어놓을 수 없습니다."));
        return;
    }
    takeBackPet(p.account, static_cast<int>(kind));  // 다른 집에 있었으면 이리로 옮긴다
    if (p.pet == kind) p.pet = -1;
    Cat cat;
    cat.zone = p.zone;
    cat.x = p.x;
    cat.y = p.y + 6.f;
    cat.timer = catRestTime();
    cat.pet = static_cast<int>(kind);
    cat.owner = p.account;
    cat.name = p.petNames[kind];
    cats_.push_back(cat);
    renumberCats();
    savePets();
    p.dirty = true;
    sendInventory(id, p);
    broadcastCats();
}

// "<펫 번호>": 집에 풀어놓은 펫을 불러 다시 데리고 다닌다. 어디서나 부를 수 있다.
void Game::callPet(ConnId id, Player& p, const std::string& arg) {
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || kind < 0 || kind >= decor::kPetKinds || !spendAction(p)) return;
    if (!takeBackPet(p.account, static_cast<int>(kind))) return;
    p.pet = static_cast<int>(kind);
    savePets();
    p.dirty = true;
    sendInventory(id, p);
    broadcastCats();
}
