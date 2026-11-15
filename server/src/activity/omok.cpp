// 오목 (오목판을 놓은 방): 두 사람이 앉아 두고, 같은 방 사람은 관전한다.
#include "core/rules.hpp"

std::string Game::omokJson(int zone) const {
    static const OmokGame empty;
    const auto found = omoks_.find(zone);
    const OmokGame& g = found == omoks_.end() ? empty : found->second;
    char left[32];
    std::snprintf(left, sizeof(left), "%.1f", g.playing ? std::max(0.0, kOmokMoveSeconds - (clock_ - g.since)) : 0.0);
    std::string json = "{\"t\":\"omok\",\"b\":\"" + g.board + "\",\"p\":[";
    for (int i = 0; i < 2; ++i) json += (i ? ",[" : "[") + std::to_string(g.players[i]) + ",\"" + text::jsonEscape(g.names[i]) + "\"]";
    json += "],\"w\":[";
    bool firstWatcher = true;
    for (const ConnId watcher : g.watchers) {
        const auto it = players_.find(watcher);
        if (it == players_.end()) continue;
        json += (firstWatcher ? "\"" : ",\"") + text::jsonEscape(it->second.name) + "\"";
        firstWatcher = false;
    }
    json += "],\"turn\":" + std::to_string(g.turn) + ",\"win\":" + std::to_string(g.winner) + ",\"play\":" + (g.playing ? "true" : "false") +
            ",\"last\":" + std::to_string(g.last) + ",\"left\":" + left + ",\"why\":\"" + g.why + "\"}";
    return json;
}

void Game::startOmok(int zone) {
    OmokGame& g = omoks_[zone];
    g.board.assign(kOmokSize * kOmokSize, '0');
    g.turn = 1;
    g.winner = 0;
    g.playing = true;
    g.last = -1;
    g.since = clock_;
    g.why.clear();
    sendToZone(zone, systemMessage("오목을 시작합니다. 흑 " + g.names[0] + " 대 백 " + g.names[1]));
}

void Game::finishOmok(int zone, int winner, const char* why) {
    OmokGame& g = omoks_[zone];
    g.playing = false;
    g.winner = winner;
    g.why = why;
    if (winner == 3) {
        addStat(g.players[0], kOmokDraw);
        addStat(g.players[1], kOmokDraw);
    } else {
        addStat(g.players[winner - 1], kOmokWin);
        addStat(g.players[2 - winner], kOmokLoss);
    }
    if (winner == 3) sendToZone(zone, systemMessage("오목: 비겼습니다."));
    else sendToZone(zone, systemMessage(std::string("오목: ") + (winner == 1 ? "흑 " : "백 ") + g.names[winner - 1] + " 승리!"));
}

// 다섯 개 이상 이어지면 이긴다 (렌주 금수 없이 쉽게).
static bool omokFive(const std::string& board, int index, char stone) {
    const int x = index % kOmokSize, y = index / kOmokSize;
    const int dirs[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};
    for (const auto& d : dirs) {
        int count = 1;
        for (int sign : {-1, 1}) {
            for (int step = 1; step < 5; ++step) {
                const int nx = x + d[0] * step * sign, ny = y + d[1] * step * sign;
                if (nx < 0 || ny < 0 || nx >= kOmokSize || ny >= kOmokSize || board[static_cast<size_t>(ny * kOmokSize + nx)] != stone) break;
                ++count;
            }
        }
        if (count >= 5) return true;
    }
    return false;
}

// "sit" 빈자리에 앉기 (둘이 앉으면 시작), "leave" 일어나기 (두는 중이면 기권), "put <칸>" 두기, "again" 한 판 더 (흑백을 바꾼다)
void Game::omokCommand(ConnId id, Player& p, const std::string& arg) {
    if (!hasDecorKind(p.zone, "omok_table")) return;
    OmokGame& g = omoks_[p.zone];
    std::istringstream in(arg);
    std::string action;
    long value = -1;
    in >> action >> value;
    const int side = g.players[0] == id ? 0 : g.players[1] == id ? 1 : -1;
    if (action == "put") {
        if (!g.playing || side < 0 || side != g.turn - 1 || value < 0 || value >= kOmokSize * kOmokSize || g.board[static_cast<size_t>(value)] != '0') return;
        const char stone = static_cast<char>('0' + g.turn);
        g.board[static_cast<size_t>(value)] = stone;
        g.last = static_cast<int>(value);
        if (omokFive(g.board, static_cast<int>(value), stone)) finishOmok(p.zone, g.turn, "five");
        else if (g.board.find('0') == std::string::npos) finishOmok(p.zone, 3, "draw");
        else {
            g.turn = 3 - g.turn;
            g.since = clock_;
        }
        sendToZone(p.zone, omokJson(p.zone));
        return;
    }
    if (action == "watch" || action == "unwatch") {   // 창을 열고 닫을 때. 앉은 사람은 관전자가 아니다
        const auto found = std::find(g.watchers.begin(), g.watchers.end(), id);
        if (action == "watch" && side < 0 && found == g.watchers.end() && g.watchers.size() < kMaxWatchers) g.watchers.push_back(id);
        else if (action == "unwatch" && found != g.watchers.end()) g.watchers.erase(found);
        else return;
        sendToZone(p.zone, omokJson(p.zone));
        return;
    }
    if (!spendAction(p)) return;
    if (action == "sit") {
        if (side >= 0 || !decorNear(p.zone, "omok_table", p.x, p.y, kOmokReach)) return;
        g.watchers.erase(std::remove(g.watchers.begin(), g.watchers.end(), id), g.watchers.end());
        if (g.playing) {
            server_.send(id, systemMessage("지금 두는 판이 끝나면 앉을 수 있습니다."));
            return;
        }
        const int seat = g.players[0] == 0 ? 0 : g.players[1] == 0 ? 1 : -1;
        if (seat < 0) {
            server_.send(id, systemMessage("오목판 두 자리가 모두 찼습니다."));
            return;
        }
        g.players[seat] = id;
        g.names[seat] = p.name;
        if (g.players[0] && g.players[1]) startOmok(p.zone);
    } else if (action == "leave") {
        if (side < 0) return;
        if (g.playing) finishOmok(p.zone, 2 - side, "resign");
        g.players[side] = 0;
        g.names[side].clear();
    } else if (action == "again") {
        if (side < 0 || g.playing || !g.players[0] || !g.players[1]) return;
        std::swap(g.players[0], g.players[1]);  // 흑백을 바꿔 다시 둔다
        std::swap(g.names[0], g.names[1]);
        startOmok(p.zone);
    } else {
        return;
    }
    sendToZone(p.zone, omokJson(p.zone));
}

// 나가거나 접속이 끊긴 사람은 일어난다. 두는 중이었으면 상대가 이긴다.
void Game::removeFromOmok(ConnId id) {
    for (auto& entry : omoks_) {
        OmokGame& g = entry.second;
        const auto watcher = std::find(g.watchers.begin(), g.watchers.end(), id);
        if (watcher != g.watchers.end()) {
            g.watchers.erase(watcher);
            sendToZone(entry.first, omokJson(entry.first));
        }
        const int side = g.players[0] == id ? 0 : g.players[1] == id ? 1 : -1;
        if (side < 0) continue;
        if (g.playing) finishOmok(entry.first, 2 - side, "leave");
        g.players[side] = 0;
        g.names[side].clear();
        sendToZone(entry.first, omokJson(entry.first));
    }
}

void Game::updateOmok() {
    for (auto& entry : omoks_) {
        OmokGame& g = entry.second;
        if (!g.playing || clock_ - g.since < kOmokMoveSeconds) continue;
        finishOmok(entry.first, 3 - g.turn, "time");   // 시간을 넘긴 쪽이 진다
        sendToZone(entry.first, omokJson(entry.first));
    }
}
