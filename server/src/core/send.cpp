// 보내기: 구역별 상태(state), 방에 들어올 때 보내는 것, 모두에게·구역에 보내기, 시스템 문구와 시계.
#include "core/rules.hpp"

std::string Game::systemMessage(const std::string& message) {
    return "{\"t\":\"sys\",\"m\":\"" + text::jsonEscape(message) + "\"}";
}

// 낮밤은 실제 시각으로 계산해 서버를 다시 시작해도 주기가 이어진다.
std::string Game::timeJson() const {
    using namespace std::chrono;
    const double seconds = duration<double>(system_clock::now().time_since_epoch()).count();
    char json[80];
    std::snprintf(json, sizeof(json), "{\"t\":\"time\",\"p\":%.2f,\"len\":%.2f}", std::fmod(seconds, config_.halfCycleSec * 2.0),
                  config_.halfCycleSec);
    return json;
}

// 방에 들어온 사람에게 그 방의 조명과 지금 나오는 영상을 알려 준다.
void Game::sendRoomStateOnEntry(ConnId id, int zone) {
    if (world_.zone(zone).lighting) server_.send(id, lightJson(zone));
    if (!tvs_[static_cast<size_t>(zone)].video.empty()) server_.send(id, tvJson(zone));
    server_.send(id, dropsJson(zone));
    if (zone == world_.farmZone()) {
        const auto player = players_.find(id);
        if (player != players_.end()) sendFarm(id, player->second);
    }
    if (isHouseZone(zone) || zone == 0) {
        const auto player = players_.find(id);
        if (player != players_.end()) {
            server_.send(id, decorJson(zone, player->second));
            sendGarden(id, player->second);
        }
        if (zone != 0) server_.send(id, floorJson(zone));
    }
    if (zone == world_.jazzZone()) {
        const auto player = players_.find(id);
        if (player != players_.end()) enterJazzBar(id, player->second);
    } else if (hasRecord(zone)) {
        startRecordIfAlone(id, zone);
    }
    if (hasDarts(zone)) server_.send(id, dartJson(zone));
    if (hasDecorKind(zone, "omok_table")) server_.send(id, omokJson(zone));
}

void Game::sendToAll(const std::string& json) {
    for (const auto& entry : players_) server_.send(entry.first, json);
}

void Game::sendToZone(int zone, const std::string& json) {
    for (const auto& entry : players_) {
        if (entry.second.zone == zone) server_.send(entry.first, json);
    }
}

// 같은 구역에 있는 사람만 서로 보이도록 구역별로 따로 만들어 보낸다.
void Game::broadcastState() {
    if (players_.empty()) return;
    std::vector<std::string> byZone(static_cast<size_t>(world_.zoneCount()));
    char buf[128];
    for (const auto& entry : players_) {
        const Player& p = entry.second;
        std::string& json = byZone[static_cast<size_t>(p.zone)];
        if (!json.empty()) json += ',';
        std::snprintf(buf, sizeof(buf), "{\"id\":%u,\"x\":%.1f,\"y\":%.1f,\"c\":\"#%06x\"", entry.first, p.x, p.y, static_cast<unsigned>(p.rgb));
        json += buf;
        // 해당할 때만 실어서 매 틱 전송량을 늘리지 않는다
        const int look = p.arms + p.legs * 3 + p.limbColor * 9;
        if (look != 0) {
            std::snprintf(buf, sizeof(buf), ",\"a\":%d", look);
            json += buf;
        }
        if (p.seat >= 0) {
            std::snprintf(buf, sizeof(buf), ",\"s\":%d", p.seat + 1);
            json += buf;
        } else if (p.input != 0 && p.fish == FishState::Idle) {   // 누르고 있는 방향: 화면이 걷는 모습과 바라보는 쪽을 흔들림 없이 그린다
            std::snprintf(buf, sizeof(buf), ",\"d\":%d", p.input);
            json += buf;
        }
        if (p.pet >= 0) {
            std::snprintf(buf, sizeof(buf), ",\"pt\":%d", p.pet);
            json += buf;
        }
        if (p.focusing) json += ",\"fc\":1";
        if (p.fish != FishState::Idle) {
            std::snprintf(buf, sizeof(buf), ",\"f\":%d,\"bx\":%.1f,\"by\":%.1f", static_cast<int>(p.fish), p.bobberX, p.bobberY);
            json += buf;
        }
        json += ",\"n\":\"";
        json += p.name;  // sanitizeName 으로 이미 안전한 문자열
        json += "\"}";
    }
    const std::string header = "{\"t\":\"state\",\"k\":" + std::to_string(tickCount_) + ",\"on\":" + std::to_string(players_.size()) + ",\"p\":[";
    for (const auto& entry : players_) {
        server_.send(entry.first, header + byZone[static_cast<size_t>(entry.second.zone)] + "]}");
    }
}
