// 다트 (재즈바와 다트판을 놓은 집): 대기실, 차례, 조준선, 점수. 점수 계산은 darts.hpp.
#include "game/rules.hpp"

bool Game::hasDarts(int zone) const {
    return world_.findFurniture(zone, "dart_line") || hasDecorKind(zone, "dart_stand");
}

bool Game::dartSpotNear(int zone, float x, float y) const {
    const Furniture* line = world_.findFurniture(zone, "dart_line");
    if (line && std::hypot(line->x - x, line->y - y) <= kDartReach + 40.f) return true;
    return decorNear(zone, "dart_stand", x, y, kDartReach + 40.f);
}

std::string Game::dartJson(int zone) const {
    static const DartGame idle;
    const auto found = darts_.find(zone);
    const DartGame& g = found == darts_.end() ? idle : found->second;
    char numbers[128];
    std::snprintf(numbers, sizeof(numbers), ",\"age\":%.3f,\"off\":%.4f,\"lx\":%.4f", clock_ - g.since, g.offset, g.lockedX);
    std::string json = "{\"t\":\"dart\",\"st\":" + std::to_string(static_cast<int>(g.state)) + ",\"size\":" + std::to_string(g.size) +
                       ",\"turn\":" + std::to_string(g.turn) + ",\"round\":" + std::to_string(g.round) + ",\"rounds\":" + std::to_string(kDartRounds) +
                       ",\"phase\":" + std::to_string(static_cast<int>(g.phase)) + ",\"seq\":" + std::to_string(g.seq) + numbers + ",\"players\":[";
    for (size_t i = 0; i < g.players.size(); ++i) {
        json += (i ? ",[" : "[") + std::to_string(g.players[i].id) + ",\"" + text::jsonEscape(g.players[i].name) + "\"," + std::to_string(g.players[i].score) + "]";
    }
    json += "],\"hits\":[";
    for (size_t i = 0; i < g.hits.size(); ++i) {
        char point[64];
        std::snprintf(point, sizeof(point), "%s[%.4f,%.4f,%d,\"", i ? "," : "", g.hits[i].x, g.hits[i].y, g.hits[i].points);
        json += point + g.hits[i].mark + "\"]";
    }
    json += "],\"win\":[";
    for (size_t i = 0; i < g.winners.size(); ++i) json += (i ? "," : "") + std::to_string(g.winners[i]);
    return json + "]}";
}

void Game::broadcastDarts(int zone) {
    sendToZone(zone, dartJson(zone));
}

void Game::resetDarts(int zone) {
    DartGame& g = darts_[zone];
    const int seq = g.seq;
    g = DartGame{};
    g.seq = seq + 1;
    broadcastDarts(zone);
}

void Game::startDartAim(int zone) {
    DartGame& g = darts_[zone];
    g.phase = DartPhase::AimX;
    g.offset = std::uniform_real_distribution<double>(0.0, 1.0)(rng_);
    g.since = clock_;
    ++g.seq;
    broadcastDarts(zone);
}

// 지금 단계의 조준선을 elapsed 초 시점의 위치에 멈춘다. 세로까지 멈추면 다트가 날아간다.
void Game::lockDart(int zone, double elapsed) {
    DartGame& g = darts_[zone];
    const double value = darts::sweep(g.offset, elapsed);
    ++g.seq;
    if (g.phase == DartPhase::AimX) {
        g.lockedX = value;
        g.phase = DartPhase::AimY;
        g.offset = std::uniform_real_distribution<double>(0.0, 1.0)(rng_);
        g.since = clock_;
        broadcastDarts(zone);
        return;
    }
    const double angle = std::uniform_real_distribution<double>(0.0, 6.283185307)(rng_);
    const double spread = std::uniform_real_distribution<double>(0.0, kDartScatter)(rng_);
    const double x = g.lockedX + std::cos(angle) * spread, y = value + std::sin(angle) * spread;
    darts::Score result = darts::score(x, y);
    g.players[g.turn].score += result.points;
    g.hits.push_back({x, y, result.points, std::move(result.mark)});
    g.phase = DartPhase::Pause;
    g.until = clock_ + (g.hits.size() >= kDartsPerTurn ? kDartTurnPause : kDartThrowPause);
    broadcastDarts(zone);
}

void Game::nextDartTurn(int zone) {
    DartGame& g = darts_[zone];
    g.hits.clear();
    if (++g.turn >= g.players.size()) {
        g.turn = 0;
        if (++g.round > kDartRounds) {
            finishDarts(zone);
            return;
        }
    }
    startDartAim(zone);
}

void Game::finishDarts(int zone) {
    DartGame& g = darts_[zone];
    g.state = DartState::Finished;
    g.phase = DartPhase::Pause;
    g.round = std::min(g.round, kDartRounds);
    g.until = clock_ + kDartResultSeconds;
    ++g.seq;
    std::stable_sort(g.players.begin(), g.players.end(), [](const DartPlayer& a, const DartPlayer& b) { return a.score > b.score; });
    g.winners.clear();
    for (size_t i = 0; i < g.players.size(); ++i) {
        addStat(g.players[i].id, kDartGame);
        if (g.players[i].score == g.players.front().score) addStat(g.players[i].id, kDartWin);
    }
    std::string names;
    for (const DartPlayer& player : g.players) {
        if (player.score != g.players.front().score) break;
        g.winners.push_back(player.id);
        names += (names.empty() ? "" : ", ") + player.name;
        sendToZone(zone, "{\"t\":\"emote\",\"id\":" + std::to_string(player.id) + ",\"n\":\"" + text::jsonEscape(player.name) + "\",\"e\":" + std::to_string(kDartWinEmote) + "}");
    }
    if (!g.players.empty()) sendToZone(zone, systemMessage("다트 우승: " + names + " (" + std::to_string(g.players.front().score) + "점)"));
    broadcastDarts(zone);
}

// 나가거나 접속이 끊긴 사람을 뺀다. 혼자 남으면 그 사람이 이긴다.
void Game::removeFromDarts(ConnId id) {
    int zone = -1;
    for (const auto& entry : darts_) {
        const DartGame& game = entry.second;
        if ((game.state == DartState::Lobby || game.state == DartState::Playing) &&
            std::any_of(game.players.begin(), game.players.end(), [id](const DartPlayer& player) { return player.id == id; })) {
            zone = entry.first;
        }
    }
    if (zone < 0) return;
    DartGame& g = darts_[zone];
    const auto found = std::find_if(g.players.begin(), g.players.end(), [id](const DartPlayer& player) { return player.id == id; });
    const size_t index = static_cast<size_t>(found - g.players.begin());
    g.players.erase(found);
    if (g.state == DartState::Lobby) {
        if (g.players.empty()) resetDarts(zone);
        else broadcastDarts(zone);
        return;
    }
    if (g.players.size() < 2) {
        finishDarts(zone);
        return;
    }
    const bool wasTurn = index == g.turn;
    if (index < g.turn) --g.turn;
    if (!wasTurn) {
        broadcastDarts(zone);
        return;
    }
    g.hits.clear();
    if (g.turn >= g.players.size()) {
        g.turn = 0;
        if (++g.round > kDartRounds) {
            finishDarts(zone);
            return;
        }
    }
    startDartAim(zone);
}

void Game::updateDarts() {
    std::vector<int> zones;
    for (const auto& entry : darts_) zones.push_back(entry.first);
    for (const int zone : zones) updateDartGame(zone);
}

void Game::updateDartGame(int zone) {
    DartGame& g = darts_[zone];
    if (g.state == DartState::Idle) return;
    if (g.state == DartState::Lobby) {
        if (clock_ < g.until) return;
        sendToZone(zone, systemMessage("사람이 모이지 않아 다트 게임을 닫았습니다."));
        resetDarts(zone);
    } else if (g.state == DartState::Finished) {
        if (clock_ >= g.until) resetDarts(zone);
    } else if (g.phase == DartPhase::Pause) {
        if (clock_ < g.until) return;
        if (g.hits.size() >= kDartsPerTurn) nextDartTurn(zone);
        else startDartAim(zone);
    } else if (clock_ - g.since >= kDartAimSeconds) {
        lockDart(zone, clock_ - g.since);
    }
}

// "new <2|3>", "join", "leave", "lock <단계 번호> <조준 시작 후 지난 밀리초>"
void Game::dartCommand(ConnId id, Player& p, const std::string& arg) {
    if (!hasDarts(p.zone)) return;
    DartGame& g = darts_[p.zone];
    std::istringstream in(arg);
    std::string action, first, second;
    in >> action >> first >> second;
    if (action == "lock") {
        long seq = 0, ms = 0;
        if (g.state != DartState::Playing || g.phase == DartPhase::Pause || g.players[g.turn].id != id) return;
        if (!parseWhole(first.c_str(), seq) || seq != g.seq || !parseWhole(second.c_str(), ms)) return;
        const double elapsed = clock_ - g.since;
        lockDart(p.zone, std::clamp(static_cast<double>(ms) / 1000.0, std::max(0.0, elapsed - kDartMaxLag), elapsed + kDartClockSlack));
        return;
    }
    if (!spendAction(p)) return;
    if (action == "leave") {
        removeFromDarts(id);
        return;
    }
    if (!dartSpotNear(p.zone, p.x, p.y)) return;
    if (action == "new") {
        if ((g.state != DartState::Idle && g.state != DartState::Finished) || (first != "2" && first != "3")) return;
        const int seq = g.seq;
        g = DartGame{};
        g.seq = seq + 1;
        g.state = DartState::Lobby;
        g.size = first == "2" ? 2 : 3;
        g.until = clock_ + kDartLobbySeconds;
        g.players.push_back({id, p.name, 0});
        sendToZone(p.zone, systemMessage(p.name + "님이 " + first + "인 다트 게임을 열었습니다. 다트판 앞에서 E를 눌러 참가하세요."));
        broadcastDarts(p.zone);
    } else if (action == "join") {
        if (g.state != DartState::Lobby) return;
        if (std::any_of(g.players.begin(), g.players.end(), [id](const DartPlayer& player) { return player.id == id; })) return;
        g.players.push_back({id, p.name, 0});
        if (g.players.size() >= g.size) {
            g.state = DartState::Playing;
            g.phase = DartPhase::Pause;
            g.until = clock_ + kDartStartPause;
            ++g.seq;
        }
        broadcastDarts(p.zone);
    }
}
