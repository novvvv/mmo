// 오락기: 슈팅·벽돌깨기(화면이 돌리고 점수만 받는다), 지뢰찾기(서버가 판을 갖는다), 체스(규칙과 컴퓨터는 chess.hpp).
#include "game/rules.hpp"

int Game::arcadeHost(const ArcadeGame& g) const {
    return g.players[0] ? 0 : 1;   // 판을 돌리는 화면: 1P, 1P 가 없으면 혼자 앉은 2P
}

std::string Game::arcadeJson(const ArcadeGame& g) const {
    const long watching = std::count_if(g.watchers.begin(), g.watchers.end(), [&](ConnId w) { return w != g.players[0] && w != g.players[1]; });
    char buf[400];
    std::snprintf(buf, sizeof(buf),
                  "{\"t\":\"arcade\",\"id\":%ld,\"g\":%d,\"s\":%d,\"vs\":%d,\"co\":%d,\"wc\":%ld,\"seed\":%u,\"el\":%.2f,\"sc\":[%d,%d],\"lv\":[%d,%d],\"dn\":[%d,%d],\"w\":%d,\"why\":\"%s\",\"p\":[%u,%u]",
                  g.decorId, g.game, g.state, g.versus ? 1 : 0, g.coop ? 1 : 0, watching, g.seed, g.state == 1 ? clock_ - g.startedAt : 0.0,
                  g.scores[0], g.scores[1], g.lives[0], g.lives[1], g.done[0] ? 1 : 0, g.done[1] ? 1 : 0, g.winner, g.why.c_str(), g.players[0], g.players[1]);
    std::string json = buf;
    json += ",\"n\":[\"" + text::jsonEscape(g.names[0]) + "\",\"" + text::jsonEscape(g.names[1]) + "\"]";
    if (g.game == 2 && !g.board.empty()) {
        std::snprintf(buf, sizeof(buf), ",\"size\":%d,\"mc\":%d,\"tn\":%d,\"tl\":%.1f,\"f\":[%d,%d],\"st\":%d,\"nx\":%d,\"b\":\"", g.size, g.mineCount, g.turn,
                      g.versus && g.state == 1 ? std::max(0.0, kArcadeTurnSec - (clock_ - g.turnSince)) : 0.0, g.found[0], g.found[1], g.stage, g.nextStageAt > 0.0 ? 1 : 0);
        json += buf + g.board + "\"";
    }
    if (g.game == 3 && g.state > 0) {
        const int king = chess::inCheck(g.pos) ? chess::kingSquare(g.pos, g.pos.side) : -1;
        const int lastFrom = g.plies.empty() ? -1 : g.plies.back().from, lastTo = g.plies.empty() ? -1 : g.plies.back().to;
        std::snprintf(buf, sizeof(buf), ",\"ct\":%d,\"ck\":%d,\"lm\":[%d,%d],\"ai\":%d,\"as\":%d,\"th\":%d,\"hn\":[%d,%d],\"np\":%zu,\"tl\":%.1f,\"cb\":\"", g.pos.side, king, lastFrom, lastTo,
                      g.versus ? 0 : g.aiLevel, g.aiSide, g.aiThinking ? 1 : 0, g.hint[0], g.hint[1], g.plies.size(),
                      g.versus && g.state == 1 ? std::max(0.0, kChessMoveSec - (clock_ - g.turnSince)) : 0.0);
        json += buf + std::string(g.pos.b.begin(), g.pos.b.end()) + "\"";
        if (g.state == 1) {   // 둘 차례인 쪽이 둘 수 있는 수 ("출발.도착", 프로모션은 뒤에 p) 와 지켜 주는 말 없이 공격받는 말
            std::vector<chess::Move> moves;
            chess::legalMoves(g.pos, moves);
            std::string list;
            for (const chess::Move& m : moves) {
                if (m.promo && m.promo != 'q') continue;
                if (!list.empty()) list += ',';
                list += std::to_string(m.from) + '.' + std::to_string(m.to) + (m.promo ? "p" : "");
            }
            json += ",\"cm\":\"" + list + "\",\"hg\":[";
            const std::vector<int> danger = chess::hanging(g.pos);
            for (size_t i = 0; i < danger.size(); ++i) json += (i ? "," : "") + std::to_string(danger[i]);
            json += "]";
        }
    }
    return json + "}";
}

void Game::sendArcade(const ArcadeGame& g) {
    sendToZone(g.zone, arcadeJson(g));
}

// 1P 화면이 돌리는 판(슈팅·벽돌깨기)을 함께 하는 2P 와 구경하는 사람에게 넘긴다.
void Game::arcadeRelay(ArcadeGame& g, ConnId from, const std::string& json) {
    for (const ConnId to : g.players) {
        if (to && to != from) server_.send(to, json);
    }
    for (const ConnId to : g.watchers) {
        if (to != from && to != g.players[0] && to != g.players[1]) server_.send(to, json);
    }
}

void Game::newMinesBoard(ArcadeGame& g) {
    if (g.versus) {
        g.size = kMinesVersusSize;
        g.mineCount = kMinesVersusCount;
    } else {   // 단계가 오를수록 판이 커지고 지뢰가 촘촘해진다
        const size_t stages = sizeof(kMinesStages) / sizeof(kMinesStages[0]);
        const size_t at = std::min(static_cast<size_t>(std::max(1, g.stage) - 1), stages - 1);
        g.size = kMinesStages[at][0];
        g.mineCount = kMinesStages[at][1] + std::min(12, std::max(0, g.stage - static_cast<int>(stages)) * 3);
    }
    g.board.assign(static_cast<size_t>(g.size * g.size), '.');
    g.mines.assign(static_cast<size_t>(g.size * g.size), '0');
    g.laid = false;
    g.turnSince = clock_;
    g.nextStageAt = 0.0;
    if (g.versus) {   // 둘이 할 때는 처음부터 묻어 둔다 (누가 먼저 열어도 공평하게)
        std::vector<int> cells(static_cast<size_t>(g.size * g.size));
        for (size_t i = 0; i < cells.size(); ++i) cells[i] = static_cast<int>(i);
        std::shuffle(cells.begin(), cells.end(), rng_);
        for (int i = 0; i < g.mineCount; ++i) g.mines[static_cast<size_t>(cells[static_cast<size_t>(i)])] = '1';
        g.laid = true;
    }
}

void Game::startArcade(ArcadeGame& g) {
    g.versus = g.players[0] && g.players[1];
    g.coop = g.versus && g.game < 2;
    g.state = 1;
    g.seed = static_cast<unsigned>(rng_() & 0x7fffffff);
    g.startedAt = clock_;
    g.scores[0] = g.scores[1] = 0;
    g.lives[0] = g.players[0] ? 3 : 0;
    g.lives[1] = g.players[1] ? 3 : 0;
    g.done[0] = !g.players[0];
    g.done[1] = !g.players[1];
    g.reportedAt[0] = g.reportedAt[1] = clock_;
    g.winner = -1;
    g.why.clear();
    g.board.clear();
    ++g.serial;
    if (g.game == 2) {
        g.stage = 1;
        g.found[0] = g.found[1] = 0;
        g.turn = g.players[0] ? 0 : 1;
        newMinesBoard(g);
    }
    if (g.game == 3) {
        g.pos = chess::start();
        g.plies.clear();
        g.seen.assign(1, chess::key(g.pos));
        g.hint[0] = g.hint[1] = -1;
        g.turnSince = clock_;
        g.aiThinking = false;
        g.aiSide = g.versus ? -1 : g.players[0] ? 1 : 0;   // 혼자 1P 에 앉으면 백, 2P 에 앉으면 흑을 잡는다
        if (!g.versus) {   // 컴퓨터를 이길 때마다 한 단계씩 세진다
            const auto it = players_.find(g.players[1 - g.aiSide]);
            g.aiLevel = std::min(kChessAiMax, 1 + (it != players_.end() ? it->second.stats[kChessAiWin] : 0));
            g.aiAt = clock_ + 1.0;
        }
    }
}

// winner: 0/1 이긴 쪽(체스는 0 백, 1 흑), 2 비김, -1 승부 없음. 기록을 남긴다.
void Game::finishArcade(ArcadeGame& g, int winner, const char* why) {
    g.state = 2;
    g.winner = winner;
    g.why = why;
    g.aiThinking = false;
    g.nextStageAt = 0.0;
    ++g.serial;
    if (g.game == 2) {   // 끝나면 남은 지뢰를 보여 준다
        for (size_t i = 0; i < g.board.size(); ++i) {
            if (g.mines[i] == '1' && g.board[i] == '.') g.board[i] = '*';
        }
    }
    for (int side = 0; side < 2; ++side) {
        const ConnId who = g.players[side];
        const auto it = players_.find(who);
        if (!who || it == players_.end()) continue;
        Player& pl = it->second;
        const auto best = [&](int stat, int value) {
            if (value <= pl.stats[stat]) return;
            pl.stats[stat] = value;
            pl.dirty = true;
        };
        addStat(who, kArcadePlay, 1);
        if (g.game < 2) best(g.game == 0 ? kBestShooter : kBestBricks, g.coop ? g.scores[0] : g.scores[side]);
        if (g.game == 2 && !g.versus) best(kBestMinesStage, g.stage);
        if (g.versus && g.game >= 2 && winner == side) {
            addStat(who, kArcadeWin, 1);
            if (g.game == 3) addStat(who, kChessWin, 1);
        }
        if (g.game == 3 && !g.versus && winner == side) addStat(who, kChessAiWin, 1);
    }
}

// 지뢰찾기에서 한 칸을 연다. 0 이면 이웃까지 번져 열린다.
void Game::digMines(ArcadeGame& g, int side, int cell) {
    const int n = g.size;
    if (!g.laid) {   // 혼자 하는 판: 처음 연 칸과 그 둘레는 비워 두고 묻는다
        std::vector<int> cells;
        const int cx = cell % n, cy = cell / n;
        for (int i = 0; i < n * n; ++i) {
            if (std::abs(i % n - cx) <= 1 && std::abs(i / n - cy) <= 1) continue;
            cells.push_back(i);
        }
        std::shuffle(cells.begin(), cells.end(), rng_);
        for (int i = 0; i < g.mineCount && i < static_cast<int>(cells.size()); ++i) g.mines[static_cast<size_t>(cells[static_cast<size_t>(i)])] = '1';
        g.laid = true;
    }
    if (g.mines[static_cast<size_t>(cell)] == '1') {
        if (!g.versus) {
            g.board[static_cast<size_t>(cell)] = 'x';
            finishArcade(g, -1, "boom");
            return;
        }
        g.board[static_cast<size_t>(cell)] = side ? 'b' : 'a';
        ++g.found[side];
        g.turnSince = clock_;   // 지뢰를 찾으면 한 번 더 연다
        if (g.found[side] * 2 > g.mineCount) finishArcade(g, side, "mines");
        return;
    }
    const auto around = [&](int at) {
        int count = 0;
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                const int x = at % n + dx, y = at / n + dy;
                if ((dx || dy) && x >= 0 && y >= 0 && x < n && y < n && g.mines[static_cast<size_t>(y * n + x)] == '1') ++count;
            }
        }
        return count;
    };
    std::vector<int> stack{cell};
    while (!stack.empty()) {
        const int at = stack.back();
        stack.pop_back();
        if (g.board[static_cast<size_t>(at)] != '.' || g.mines[static_cast<size_t>(at)] == '1') continue;
        const int count = around(at);
        g.board[static_cast<size_t>(at)] = static_cast<char>('0' + count);
        if (count) continue;
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                const int x = at % n + dx, y = at / n + dy;
                if ((dx || dy) && x >= 0 && y >= 0 && x < n && y < n) stack.push_back(y * n + x);
            }
        }
    }
    if (g.versus) {
        g.turn = 1 - side;
        g.turnSince = clock_;
        return;
    }
    for (size_t i = 0; i < g.board.size(); ++i) {
        if (g.board[i] == '.' && g.mines[i] != '1') return;   // 아직 열 칸이 남았다
    }
    // 다 피했다: 지뢰 자리에 깃발을 꽂아 잠깐 보여 준 뒤 더 어려운 다음 단계로
    for (size_t i = 0; i < g.board.size(); ++i) {
        if (g.mines[i] == '1') g.board[i] = 'a';
    }
    for (const ConnId who : g.players) {
        if (who) addStat(who, kMinesClear, 1);
    }
    g.nextStageAt = clock_ + kMinesStagePause;
}

// 체스 한 수를 두고, 끝났는지(체크메이트, 스테일메이트, 무승부 규칙) 본다.
void Game::playChess(ArcadeGame& g, const chess::Move& m) {
    g.plies.push_back({g.pos, m.from, m.to});
    g.pos = chess::play(g.pos, m);
    ++g.serial;
    g.hint[0] = g.hint[1] = -1;
    g.turnSince = clock_;
    const std::string key = chess::key(g.pos);
    g.seen.push_back(key);
    std::vector<chess::Move> moves;
    chess::legalMoves(g.pos, moves);
    if (moves.empty()) {
        if (chess::inCheck(g.pos)) finishArcade(g, 1 - g.pos.side, "mate");
        else finishArcade(g, 2, "stalemate");
        return;
    }
    if (chess::insufficient(g.pos)) return finishArcade(g, 2, "material");
    if (g.pos.quiet >= 100) return finishArcade(g, 2, "fifty");
    if (std::count(g.seen.begin(), g.seen.end(), key) >= 3) return finishArcade(g, 2, "repeat");
    if (!g.versus && g.pos.side == g.aiSide) g.aiAt = clock_ + kChessAiPause;
}

// 컴퓨터의 수는 작업 스레드에서 찾는다 (깊이 볼수록 오래 걸려 게임 루프를 멈추지 않게).
void Game::askChessAi(ArcadeGame& g) {
    g.aiThinking = true;
    Worker* worker = &worker_;
    worker_.post([this, worker, decorId = g.decorId, serial = g.serial, pos = g.pos, level = g.aiLevel, seed = static_cast<unsigned>(rng_())] {
        std::mt19937 rng(seed);
        const chess::Move m = chess::pick(pos, level, rng);
        worker->finish([this, decorId, serial, m] { chessAiMoved(decorId, serial, m); });
    });
}

void Game::chessAiMoved(long decorId, unsigned serial, chess::Move m) {
    const auto it = arcades_.find(decorId);
    if (it == arcades_.end()) return;
    ArcadeGame& g = it->second;
    if (g.serial != serial || g.state != 1 || g.game != 3 || g.pos.side != g.aiSide) return;   // 그사이 물렸거나 끝났다
    g.aiThinking = false;
    if (m.from < 0) return;
    playChess(g, m);
    sendArcade(g);
}

// "join <배치 번호> <0|1>", "leave <배치 번호>", "start <배치 번호>", "look <배치 번호>" (창을 열어 구경), "unlook <배치 번호>",
// "score <배치 번호> <점수> <1P 목숨> <끝났는지> [2P 목숨]" (슈팅·벽돌깨기를 돌리는 화면), "sync <배치 번호> <판 JSON>" (그 화면의 중계),
// "in <배치 번호> <x> <쏘는지>" (함께 하는 2P 의 조작), "dig <배치 번호> <칸>" (지뢰찾기),
// "move <배치 번호> <출발 칸> <도착 칸> [q|r|b|n]", "undo <배치 번호>", "hint <배치 번호>" (체스)
void Game::arcadeCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long decorId = -1;
    in >> action >> decorId;
    if (in.fail()) return;
    const auto cabinet = std::find_if(decor_.begin(), decor_.end(), [&](const Decor& d) { return d.id == decorId && d.zone == p.zone; });
    if (cabinet == decor_.end() || decor::arcadeGame(cabinet->kind) < 0) return;
    ArcadeGame& g = arcades_[decorId];
    g.decorId = decorId;
    g.zone = cabinet->zone;
    if (g.state == 0 && !g.players[0] && !g.players[1]) g.game = decor::arcadeGame(cabinet->kind);
    const int side = g.players[0] == id ? 0 : g.players[1] == id ? 1 : -1;

    if (action == "sync" || action == "in") {
        if (side < 0 || g.state != 1 || g.game >= 2) return;
        if (g.relayClock != clock_) {
            g.relayClock = clock_;
            g.relays[0] = g.relays[1] = 0;
        }
        if (++g.relays[action == "in" ? 1 : 0] > kArcadeRelayPerTick) return;
        if (action == "sync") {
            if (side != arcadeHost(g)) return;
            std::string data;
            std::getline(in, data);
            if (!data.empty() && data.front() == ' ') data.erase(0, 1);
            if (data.empty() || data.size() > kArcadeRelayMax || !std::all_of(data.begin(), data.end(), [](char c) { return c >= 0x20 && c <= 0x7e; })) return;
            arcadeRelay(g, id, "{\"t\":\"asy\",\"id\":" + std::to_string(decorId) + ",\"d\":\"" + text::jsonEscape(data) + "\"}");
        } else {
            double x = 0.0;
            long fire = 0;
            in >> x >> fire;
            if (in.fail() || !g.coop || side != 1 || !g.players[0] || !std::isfinite(x)) return;
            char buf[96];
            std::snprintf(buf, sizeof(buf), "{\"t\":\"ain\",\"id\":%ld,\"x\":%.1f,\"f\":%d}", decorId, std::clamp(x, 0.0, 240.0), fire ? 1 : 0);
            server_.send(g.players[0], buf);
        }
        return;
    }
    if (action == "look") {
        if (side < 0 && std::find(g.watchers.begin(), g.watchers.end(), id) == g.watchers.end() && g.watchers.size() < kMaxWatchers) {
            g.watchers.push_back(id);
            sendArcade(g);   // 판을 돌리는 화면이 중계를 시작하도록 구경꾼 수를 알린다
        } else {
            server_.send(id, arcadeJson(g));
        }
        return;
    }
    if (action == "unlook") {
        const auto w = std::find(g.watchers.begin(), g.watchers.end(), id);
        if (w == g.watchers.end()) return;
        g.watchers.erase(w);
        sendArcade(g);
        return;
    }
    if (action == "score") {
        long score = 0, lives = 0, over = 0, lives2 = 0;
        in >> score >> lives >> over;
        if (in.fail() || side < 0 || g.state != 1 || g.game >= 2 || side != arcadeHost(g)) return;
        in >> lives2;   // 함께 하는 판이면 2P 의 목숨
        const double elapsed = clock_ - g.reportedAt[side];
        if (score < g.scores[side] || score - g.scores[side] > static_cast<long>((elapsed + 1.0) * kArcadeScorePerSec)) return;
        g.scores[side] = static_cast<int>(score);
        g.lives[side] = static_cast<int>(std::clamp(lives, 0L, 9L));
        if (g.coop && g.players[1]) g.lives[1] = static_cast<int>(std::clamp(lives2, 0L, 9L));
        g.reportedAt[side] = clock_;
        if (over) finishArcade(g, -1, "over");
        sendArcade(g);
        return;
    }
    if (action == "dig") {
        long cell = -1;
        in >> cell;
        if (in.fail() || side < 0 || g.state != 1 || g.game != 2 || g.nextStageAt > 0.0 || cell < 0 || cell >= g.size * g.size) return;
        if (g.versus && g.turn != side) return;
        if (g.board[static_cast<size_t>(cell)] != '.') return;
        digMines(g, side, static_cast<int>(cell));
        sendArcade(g);
        return;
    }
    if (action == "move") {
        long from = -1, to = -1;
        std::string promo;
        in >> from >> to;
        if (in.fail() || side < 0 || g.state != 1 || g.game != 3 || g.pos.side != side || from < 0 || from > 63 || to < 0 || to > 63) return;
        in >> promo;
        const char want = promo.empty() ? 'q' : promo[0];
        std::vector<chess::Move> moves;
        chess::legalMoves(g.pos, moves);
        const auto m = std::find_if(moves.begin(), moves.end(), [&](const chess::Move& mv) { return mv.from == from && mv.to == to && (!mv.promo || mv.promo == want); });
        if (m == moves.end()) return;
        playChess(g, *m);
        sendArcade(g);
        return;
    }
    if (!spendAction(p)) return;
    if (action == "undo") {   // 컴퓨터와 둘 때만: 컴퓨터의 수와 내 수를 함께 물린다
        if (side < 0 || g.state != 1 || g.game != 3 || g.versus) return;
        const size_t back = g.pos.side == side ? 2 : 1;
        if (g.plies.size() < back) return;
        for (size_t i = 0; i < back; ++i) {
            g.pos = g.plies.back().before;
            g.plies.pop_back();
            g.seen.pop_back();
        }
        ++g.serial;
        g.aiThinking = false;
        g.hint[0] = g.hint[1] = -1;
        g.turnSince = clock_;
        sendArcade(g);
    } else if (action == "hint") {
        if (side < 0 || g.state != 1 || g.game != 3 || g.versus || g.pos.side != side) return;
        const chess::Move m = chess::best(g.pos, 2);
        g.hint[0] = m.from;
        g.hint[1] = m.to;
        sendArcade(g);
    } else if (action == "join") {
        long slot = -1;
        in >> slot;
        if (in.fail() || slot < 0 || slot > 1 || side >= 0) return;
        if (std::hypot(cabinet->x - p.x, cabinet->y - p.y) > kArcadeReach + 40.f) {
            server_.send(id, systemMessage(g.game == 3 ? "체스판 앞으로 가서 앉아 주세요." : "오락기 앞으로 가서 앉아 주세요."));
            return;
        }
        if (g.state == 1) {
            server_.send(id, systemMessage("지금 하는 판이 끝나면 앉을 수 있습니다."));
            return;
        }
        if (g.players[slot]) {
            server_.send(id, systemMessage(slot ? "2P 자리에 이미 누가 앉아 있습니다." : "1P 자리에 이미 누가 앉아 있습니다."));
            return;
        }
        removeFromArcade(id);   // 다른 오락기에 앉아 있었으면 거기서 일어난다
        g.players[slot] = id;
        g.names[slot] = p.name;
        if (g.state == 2) {   // 끝난 판 화면은 새로 앉으면 치운다
            g.state = 0;
            g.board.clear();
            g.game = decor::arcadeGame(cabinet->kind);
        }
        sendArcade(g);
    } else if (action == "leave") {
        if (side < 0) return;
        removeFromArcade(id);
    } else if (action == "start") {
        if (side < 0 || g.state == 1) return;
        g.game = decor::arcadeGame(cabinet->kind);
        startArcade(g);
        sendArcade(g);
    }
}

// 오락기 자리에서 일어나거나 창을 닫은 채 방을 나간다(접속을 끊어도).
// 함께 하던 2P 가 일어나면 1P 혼자 이어 가고, 겨루던 판은 남은 쪽이 이기고, 혼자 하던 판은 끝난다.
void Game::removeFromArcade(ConnId id) {
    for (auto& entry : arcades_) {
        ArcadeGame& g = entry.second;
        bool changed = false;
        const auto w = std::find(g.watchers.begin(), g.watchers.end(), id);
        if (w != g.watchers.end()) {
            g.watchers.erase(w);
            changed = true;
        }
        const int side = g.players[0] == id ? 0 : g.players[1] == id ? 1 : -1;
        if (side >= 0) {
            if (g.state == 1) {
                if (g.coop && side == 1 && g.players[0]) {
                    const auto it = players_.find(id);
                    addStat(id, kArcadePlay, 1);
                    const int stat = g.game == 0 ? kBestShooter : kBestBricks;
                    if (it != players_.end() && g.scores[0] > it->second.stats[stat]) {
                        it->second.stats[stat] = g.scores[0];
                        it->second.dirty = true;
                    }
                    g.lives[1] = 0;
                    g.done[1] = true;
                } else if (g.coop) {
                    finishArcade(g, -1, "leave");
                } else if (g.versus) {
                    finishArcade(g, 1 - side, "leave");
                } else {
                    finishArcade(g, g.game == 3 ? g.aiSide : -1, "leave");   // 혼자 두던 체스는 기권
                }
            }
            g.players[side] = 0;
            g.names[side].clear();
            changed = true;
        }
        if (changed) sendArcade(g);
    }
}

// 오락기를 치웠다: 판을 없애고 방에 알린다.
void Game::dropArcade(long decorId) {
    const auto it = arcades_.find(decorId);
    if (it == arcades_.end()) return;
    const int zone = it->second.zone;
    arcades_.erase(it);
    sendToZone(zone, "{\"t\":\"arcade\",\"id\":" + std::to_string(decorId) + ",\"off\":true}");
}

// 슈팅·벽돌깨기 화면이 오래 소식이 없으면 끝내고, 지뢰찾기의 다음 단계와 대전 차례 시간, 체스의 시간과 컴퓨터의 차례를 본다.
void Game::updateArcade() {
    for (auto& entry : arcades_) {
        ArcadeGame& g = entry.second;
        if (g.state != 1) continue;
        if (g.game < 2) {
            if (clock_ - g.reportedAt[arcadeHost(g)] >= kArcadeStaleSec) {
                finishArcade(g, -1, "stale");
                sendArcade(g);
            }
        } else if (g.game == 2) {
            if (g.nextStageAt > 0.0 && clock_ >= g.nextStageAt) {
                ++g.stage;
                newMinesBoard(g);
                sendArcade(g);
            } else if (g.versus && clock_ - g.turnSince >= kArcadeTurnSec) {
                g.turn = 1 - g.turn;   // 시간 안에 열지 않으면 차례가 넘어간다
                g.turnSince = clock_;
                sendArcade(g);
            }
        } else if (g.versus) {
            if (clock_ - g.turnSince >= kChessMoveSec) {   // 시간 안에 두지 않으면 진다
                finishArcade(g, 1 - g.pos.side, "time");
                sendArcade(g);
            }
        } else if (g.pos.side == g.aiSide && !g.aiThinking && clock_ >= g.aiAt) {
            askChessAi(g);
            sendArcade(g);   // 생각하는 중이라고 알린다
        }
    }
}
