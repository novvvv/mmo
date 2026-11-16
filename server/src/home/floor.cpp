// 바닥재: 사기(한 번 사면 계속), 깔기, 바닥 염색.
#include "game/rules.hpp"

std::string Game::floorJson(int zone) const {
    return "{\"t\":\"floor\",\"z\":" + std::to_string(zone) + ",\"m\":" + std::to_string(floors_[static_cast<size_t>(zone)]) +
           ",\"tint\":\"" + floorTints_[static_cast<size_t>(zone)] + "\"}";
}

// 한 줄에 "<구역>\t<바닥재 번호>[\t<염색 값>]". 원래 바닥(0)에 원래 색인 집은 적지 않는다.
void Game::loadFloors() {
    std::ifstream file(accounts_.dir() + "/floors.list");
    std::string line;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long zone = -1, kind = -1;
        if (f.size() < 2 || !parseWhole(f[0].c_str(), zone) || !parseWhole(f[1].c_str(), kind)) continue;
        if (!isHouseZone(static_cast<int>(zone)) || kind < 0 || kind >= decor::kFloorKinds) continue;
        floors_[static_cast<size_t>(zone)] = static_cast<int>(kind);
        if (f.size() > 2 && validTint(f[2])) floorTints_[static_cast<size_t>(zone)] = f[2];
    }
}

void Game::saveFloors() {
    std::string content;
    for (size_t zone = 0; zone < floors_.size(); ++zone) {
        if (floors_[zone] != 0 || !floorTints_[zone].empty()) content += std::to_string(zone) + "\t" + std::to_string(floors_[zone]) + "\t" + floorTints_[zone] + "\n";
    }
    worker_.post([path = accounts_.dir() + "/floors.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

// "<바닥재 번호>": 아직 없는 바닥재면 사고(한 번만), 집 안이면 지금 집에 깐다. 원래 바닥(0)은 늘 무료다.
void Game::floorCommand(ConnId id, Player& p, const std::string& arg) {
    // "dye <염색 값>": 지금 집의 바닥을 염료 한 병으로 물들인다. "undye": 원래 색으로 (무료)
    if (arg.rfind("dye ", 0) == 0 || arg == "undye") {
        if (!isHouseZone(p.zone)) {
            server_.send(id, systemMessage("집 안에서만 바닥을 염색할 수 있습니다."));
            return;
        }
        const std::string tint = arg == "undye" ? std::string() : arg.substr(4);
        if (!tint.empty() && !validTint(tint)) return;
        if (!spendAction(p)) return;
        if (!tint.empty()) {
            if (p.dye <= 0) {
                server_.send(id, systemMessage("염료가 없습니다. 상점에서 받아 오세요."));
                return;
            }
            --p.dye;
            p.dirty = true;
            sendInventory(id, p);
        }
        floorTints_[static_cast<size_t>(p.zone)] = tint;
        saveFloors();
        sendToZone(p.zone, floorJson(p.zone));
        return;
    }
    long kind = -1;
    if (!parseWhole(arg.c_str(), kind) || kind < 0 || kind >= decor::kFloorKinds || !spendAction(p)) return;
    const int bit = 1 << kind;
    if (kind != 0 && !(p.floorsOwned & bit)) {
        if (p.gold < decor::floorPrice()) {
            server_.send(id, systemMessage("골드가 부족합니다."));
            return;
        }
        p.gold -= decor::floorPrice();
        p.floorsOwned |= bit;
        p.dirty = true;
        sendInventory(id, p);
    }
    if (!isHouseZone(p.zone)) {
        if (kind != 0) server_.send(id, systemMessage("바닥재를 샀습니다. 집 안에서 깔 수 있습니다."));
        return;
    }
    if (floors_[static_cast<size_t>(p.zone)] == kind) return;
    floors_[static_cast<size_t>(p.zone)] = static_cast<int>(kind);
    saveFloors();
    sendToZone(p.zone, floorJson(p.zone));
}
