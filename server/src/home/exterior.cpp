// 집 외관: 모양, 벽, 지붕, 문, 장식. 마을의 모두에게 보인다.
#include "game/rules.hpp"

std::string Game::exteriorsJson() const {
    std::string json = "{\"t\":\"ext\",\"p\":[";
    bool first = true;
    for (int zone = 1; zone < world_.zoneCount(); ++zone) {
        if (!isHouseZone(zone)) continue;
        const Exterior& e = exteriors_[static_cast<size_t>(zone)];
        json += (first ? "[" : ",[") + std::to_string(zone) + "," + std::to_string(e.wall) + "," + std::to_string(e.roof) + "," + std::to_string(e.door) + "," + std::to_string(e.deco) + "," + std::to_string(e.form) + "]";
        first = false;
    }
    return json + "]}";
}

void Game::loadExteriors() {
    exteriors_.assign(static_cast<size_t>(world_.zoneCount()), Exterior{});
    std::ifstream file(accounts_.dir() + "/exteriors.list");
    std::string line;
    while (std::getline(file, line)) {
        std::istringstream in(line);
        long zone = -1, wall = 0, roof = 0, door = 0, deco = 0, form = 0;
        if (!(in >> zone >> wall >> roof >> door >> deco) || !isHouseZone(static_cast<int>(zone))) continue;
        if (!(in >> form)) form = 0;   // 예전 파일에는 모양이 없다
        Exterior& e = exteriors_[static_cast<size_t>(zone)];
        e.wall = clampInt(wall, 0, kExteriorWalls - 1);
        e.roof = clampInt(roof, 0, kExteriorRoofs - 1);
        e.door = clampInt(door, 0, kExteriorDoors - 1);
        e.deco = static_cast<int>(deco) & ((1 << kExteriorDecoBits) - 1);
        e.form = clampInt(form, 0, kExteriorForms - 1);
    }
}

void Game::saveExteriors() {
    std::string content;
    for (size_t zone = 0; zone < exteriors_.size(); ++zone) {
        const Exterior& e = exteriors_[zone];
        if (e.wall || e.roof || e.door || e.deco || e.form)
            content += std::to_string(zone) + " " + std::to_string(e.wall) + " " + std::to_string(e.roof) + " " + std::to_string(e.door) + " " + std::to_string(e.deco) + " " + std::to_string(e.form) + "\n";
    }
    worker_.post([path = accounts_.dir() + "/exteriors.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

// "<집 구역> <벽> <지붕> <문> <장식 비트>": 그 집 안에 있거나, 밖에서 그 집 문 앞에 있을 때만 바꾼다.
void Game::exteriorCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    long zone = -1, wall = -1, roof = -1, door = -1, deco = -1, form = 0;
    if (!(in >> zone >> wall >> roof >> door >> deco) || !isHouseZone(static_cast<int>(zone))) return;
    if (!(in >> form)) form = exteriors_[static_cast<size_t>(zone)].form;   // 모양을 보내지 않는 예전 화면은 그대로 둔다
    if (form < 0 || form >= kExteriorForms) return;
    if (wall < 0 || wall >= kExteriorWalls || roof < 0 || roof >= kExteriorRoofs || door < 0 || door >= kExteriorDoors || deco < 0 || deco >= (1 << kExteriorDecoBits)) return;
    const bool here = p.zone == zone || (p.zone == 0 && town_.houseDoorNear(p.x, p.y, kExteriorReach) == zone);
    if (!here) {
        server_.send(id, systemMessage("그 집 안이나 문 앞에서만 외관을 꾸밀 수 있습니다."));
        return;
    }
    if (p.extTokens < 1.f) {
        server_.send(id, systemMessage(kTooFastMessage));
        return;
    }
    Exterior& e = exteriors_[static_cast<size_t>(zone)];
    if (e.wall == wall && e.roof == roof && e.door == door && e.deco == deco && e.form == form) return;
    const int price = decor::exteriorPrice();
    if (p.gold < price) {
        server_.send(id, systemMessage("골드가 부족합니다."));
        return;
    }
    p.extTokens -= 1.f;
    p.gold -= price;
    if (price > 0) {
        p.dirty = true;
        sendInventory(id, p);
    }
    e = {static_cast<int>(wall), static_cast<int>(roof), static_cast<int>(door), static_cast<int>(deco), static_cast<int>(form)};
    saveExteriors();
    sendToAll(exteriorsJson());
}
