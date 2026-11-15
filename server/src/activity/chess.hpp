#pragma once
// 체스 규칙과 컴퓨터 상대. 판은 64칸: 0 이 a8, 7 이 h8, 56 이 a1, 63 이 h1 (FEN 을 읽는 순서).
// 백은 대문자 PNBRQK, 흑은 소문자 pnbrqk, 빈칸은 '.'. 캐슬링, 앙파상, 프로모션, 무승부 규칙까지 다룬다.

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdlib>
#include <random>
#include <string>
#include <vector>

namespace chess {

struct Move {
    int from = -1;
    int to = -1;
    char promo = 0;   // 폰이 끝 줄에 닿아 바뀌는 말 ('q', 'r', 'b', 'n'). 아니면 0
};

struct Position {
    std::array<char, 64> b{};
    int side = 0;      // 둘 차례: 0 백, 1 흑
    int castle = 15;   // 1 백 킹 쪽, 2 백 퀸 쪽, 4 흑 킹 쪽, 8 흑 퀸 쪽
    int ep = -1;       // 앙파상으로 들어갈 수 있는 칸
    int quiet = 0;     // 폰이 움직이지 않고 잡지도 않은 반수 (50수 규칙)
};

inline Position start() {
    static const char kRows[] = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
    Position p;
    for (int i = 0; i < 64; ++i) p.b[static_cast<size_t>(i)] = kRows[i];
    return p;
}

inline int colorOf(char c) { return c == '.' ? -1 : std::isupper(static_cast<unsigned char>(c)) ? 0 : 1; }
inline char kindOf(char c) { return static_cast<char>(std::tolower(static_cast<unsigned char>(c))); }
inline bool onBoard(int r, int c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
inline char at(const Position& p, int r, int c) { return p.b[static_cast<size_t>(r * 8 + c)]; }

inline constexpr int kKnight[8][2] = {{1, 2}, {2, 1}, {-1, 2}, {-2, 1}, {1, -2}, {2, -1}, {-1, -2}, {-2, -1}};
inline constexpr int kLines[8][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, 1}, {1, -1}, {-1, 1}, {-1, -1}};   // 앞 넷은 가로세로

// by 쪽 말이 sq 칸을 공격하는지 (그 칸에 무엇이 있든)
inline bool attacked(const Position& p, int sq, int by) {
    const int r = sq / 8, c = sq % 8;
    const int pr = by == 0 ? r + 1 : r - 1;   // 백 폰은 위(행 번호가 작은 쪽)를 향해 잡는다
    const char pawn = by == 0 ? 'P' : 'p', knight = by == 0 ? 'N' : 'n', king = by == 0 ? 'K' : 'k';
    if (pr >= 0 && pr < 8 && ((c > 0 && at(p, pr, c - 1) == pawn) || (c < 7 && at(p, pr, c + 1) == pawn))) return true;
    for (const auto& d : kKnight) {
        if (onBoard(r + d[0], c + d[1]) && at(p, r + d[0], c + d[1]) == knight) return true;
    }
    for (int dr = -1; dr <= 1; ++dr) {
        for (int dc = -1; dc <= 1; ++dc) {
            if ((dr || dc) && onBoard(r + dr, c + dc) && at(p, r + dr, c + dc) == king) return true;
        }
    }
    for (int i = 0; i < 8; ++i) {
        const bool straight = i < 4;
        int rr = r + kLines[i][0], cc = c + kLines[i][1];
        while (onBoard(rr, cc)) {
            const char q = at(p, rr, cc);
            if (q != '.') {
                const char k = kindOf(q);
                if (colorOf(q) == by && (k == 'q' || k == (straight ? 'r' : 'b'))) return true;
                break;
            }
            rr += kLines[i][0];
            cc += kLines[i][1];
        }
    }
    return false;
}

inline int kingSquare(const Position& p, int side) {
    const char king = side == 0 ? 'K' : 'k';
    for (int i = 0; i < 64; ++i) {
        if (p.b[static_cast<size_t>(i)] == king) return i;
    }
    return -1;
}

inline bool inCheck(const Position& p) {
    const int k = kingSquare(p, p.side);
    return k >= 0 && attacked(p, k, 1 - p.side);
}

// 자기 킹이 공격받는지는 보지 않은 수
inline void pseudoMoves(const Position& p, std::vector<Move>& out) {
    const int me = p.side;
    for (int sq = 0; sq < 64; ++sq) {
        const char pc = p.b[static_cast<size_t>(sq)];
        if (colorOf(pc) != me) continue;
        const int r = sq / 8, c = sq % 8;
        const auto target = [&](int rr, int cc) { return colorOf(at(p, rr, cc)) != me; };   // 빈칸이거나 상대 말
        switch (kindOf(pc)) {
        case 'p': {
            const int dir = me == 0 ? -1 : 1, home = me == 0 ? 6 : 1, last = me == 0 ? 0 : 7, r1 = r + dir;
            if (r1 < 0 || r1 > 7) break;
            const auto add = [&](int to) {
                if (to / 8 == last) {
                    for (const char q : {'q', 'r', 'b', 'n'}) out.push_back({sq, to, q});
                } else {
                    out.push_back({sq, to, 0});
                }
            };
            if (at(p, r1, c) == '.') {
                add(r1 * 8 + c);
                if (r == home && at(p, r + 2 * dir, c) == '.') out.push_back({sq, (r + 2 * dir) * 8 + c, 0});
            }
            for (const int dc : {-1, 1}) {
                if (c + dc < 0 || c + dc > 7) continue;
                const int to = r1 * 8 + c + dc;
                if (colorOf(p.b[static_cast<size_t>(to)]) == 1 - me || to == p.ep) add(to);
            }
            break;
        }
        case 'n':
            for (const auto& d : kKnight) {
                if (onBoard(r + d[0], c + d[1]) && target(r + d[0], c + d[1])) out.push_back({sq, (r + d[0]) * 8 + c + d[1], 0});
            }
            break;
        case 'k':
            for (int dr = -1; dr <= 1; ++dr) {
                for (int dc = -1; dc <= 1; ++dc) {
                    if ((dr || dc) && onBoard(r + dr, c + dc) && target(r + dr, c + dc)) out.push_back({sq, (r + dr) * 8 + c + dc, 0});
                }
            }
            // 캐슬링: 킹과 룩이 처음 자리에 있고, 사이가 비었고, 킹이 지나는 칸이 공격받지 않을 때
            if (me == 0 && sq == 60 && !attacked(p, 60, 1)) {
                if ((p.castle & 1) && p.b[61] == '.' && p.b[62] == '.' && p.b[63] == 'R' && !attacked(p, 61, 1) && !attacked(p, 62, 1)) out.push_back({60, 62, 0});
                if ((p.castle & 2) && p.b[59] == '.' && p.b[58] == '.' && p.b[57] == '.' && p.b[56] == 'R' && !attacked(p, 59, 1) && !attacked(p, 58, 1)) out.push_back({60, 58, 0});
            }
            if (me == 1 && sq == 4 && !attacked(p, 4, 0)) {
                if ((p.castle & 4) && p.b[5] == '.' && p.b[6] == '.' && p.b[7] == 'r' && !attacked(p, 5, 0) && !attacked(p, 6, 0)) out.push_back({4, 6, 0});
                if ((p.castle & 8) && p.b[3] == '.' && p.b[2] == '.' && p.b[1] == '.' && p.b[0] == 'r' && !attacked(p, 3, 0) && !attacked(p, 2, 0)) out.push_back({4, 2, 0});
            }
            break;
        default: {   // 룩, 비숍, 퀸: 막힐 때까지 미끄러진다
            const char k = kindOf(pc);
            const int first = k == 'b' ? 4 : 0, end = k == 'r' ? 4 : 8;
            for (int i = first; i < end; ++i) {
                int rr = r + kLines[i][0], cc = c + kLines[i][1];
                while (onBoard(rr, cc)) {
                    const char q = at(p, rr, cc);
                    if (colorOf(q) == me) break;
                    out.push_back({sq, rr * 8 + cc, 0});
                    if (q != '.') break;
                    rr += kLines[i][0];
                    cc += kLines[i][1];
                }
            }
        }
        }
    }
}

inline Position play(const Position& p, const Move& m) {
    Position n = p;
    const char pc = p.b[static_cast<size_t>(m.from)];
    const char k = kindOf(pc);
    const bool capture = p.b[static_cast<size_t>(m.to)] != '.';
    n.b[static_cast<size_t>(m.to)] = m.promo ? (p.side == 0 ? static_cast<char>(std::toupper(static_cast<unsigned char>(m.promo))) : m.promo) : pc;
    n.b[static_cast<size_t>(m.from)] = '.';
    if (k == 'p' && m.to == p.ep && m.from % 8 != m.to % 8) n.b[static_cast<size_t>((m.from / 8) * 8 + m.to % 8)] = '.';   // 앙파상: 옆의 폰을 잡는다
    n.ep = k == 'p' && std::abs(m.to - m.from) == 16 ? (m.from + m.to) / 2 : -1;
    if (k == 'k' && std::abs(m.to - m.from) == 2) {   // 캐슬링: 룩이 킹을 넘어 옆에 선다
        const int rookFrom = m.to > m.from ? m.from + 3 : m.from - 4, rookTo = m.to > m.from ? m.from + 1 : m.from - 1;
        n.b[static_cast<size_t>(rookTo)] = n.b[static_cast<size_t>(rookFrom)];
        n.b[static_cast<size_t>(rookFrom)] = '.';
    }
    for (const int sq : {m.from, m.to}) {   // 킹이나 룩이 움직이거나 잡히면 그쪽 캐슬링은 못 한다
        if (sq == 60) n.castle &= ~3;
        if (sq == 4) n.castle &= ~12;
        if (sq == 63) n.castle &= ~1;
        if (sq == 56) n.castle &= ~2;
        if (sq == 7) n.castle &= ~4;
        if (sq == 0) n.castle &= ~8;
    }
    n.quiet = k == 'p' || capture ? 0 : p.quiet + 1;
    n.side = 1 - p.side;
    return n;
}

inline void legalMoves(const Position& p, std::vector<Move>& out) {
    std::vector<Move> pseudo;
    pseudo.reserve(48);
    pseudoMoves(p, pseudo);
    out.clear();
    for (const Move& m : pseudo) {
        const Position n = play(p, m);
        const int k = kingSquare(n, p.side);
        if (k >= 0 && !attacked(n, k, n.side)) out.push_back(m);
    }
}

// 킹만 남았거나 킹과 비숍·나이트 하나뿐이면 아무도 이길 수 없다
inline bool insufficient(const Position& p) {
    int minors = 0;
    for (const char c : p.b) {
        const char k = kindOf(c);
        if (k == 'p' || k == 'r' || k == 'q') return false;
        if (k == 'b' || k == 'n') ++minors;
    }
    return minors <= 1;
}

// 같은 국면이 세 번 나왔는지 세는 열쇠
inline std::string key(const Position& p) {
    std::string out(p.b.begin(), p.b.end());
    out += static_cast<char>('0' + p.side);
    out += static_cast<char>('a' + p.castle);
    out += std::to_string(p.ep);
    return out;
}

inline int value(char kind) {
    switch (kind) {
    case 'p': return 100;
    case 'n': return 320;
    case 'b': return 330;
    case 'r': return 500;
    case 'q': return 900;
    default: return 0;
    }
}

// 둘 차례인 쪽에서 본 점수: 말의 값에 가운데를 차지하고 폰을 앞으로 내보낸 만큼 조금 더한다
inline int evaluate(const Position& p) {
    int score = 0;
    for (int sq = 0; sq < 64; ++sq) {
        const char pc = p.b[static_cast<size_t>(sq)];
        if (pc == '.') continue;
        const int side = colorOf(pc), r = sq / 8, c = sq % 8;
        const char k = kindOf(pc);
        const int center = 6 - (std::abs(2 * r - 7) + std::abs(2 * c - 7)) / 2;   // 가운데 0~6
        int v = value(k);
        if (k == 'n' || k == 'b') v += center * 4;
        else if (k == 'q') v += center;
        else if (k == 'p') v += (side == 0 ? 6 - r : r - 1) * 6 + (c >= 2 && c <= 5 ? center * 2 : 0);
        else if (k == 'k') v += (side == 0 ? r == 7 : r == 0) ? 10 : -10;   // 킹은 뒤에 있는 편이 안전하다
        score += side == p.side ? v : -v;
    }
    return score;
}

inline constexpr int kMate = 100000;

struct Search {
    int nodes = 0;
    int limit = 16000;   // 한 수에 살펴보는 국면의 상한 (서버가 멈추지 않게)
    bool quiesce = false;
};

inline void orderMoves(const Position& p, std::vector<Move>& moves) {
    std::stable_sort(moves.begin(), moves.end(), [&](const Move& a, const Move& b) {
        const auto gain = [&](const Move& m) {
            const char victim = p.b[static_cast<size_t>(m.to)];
            return (victim == '.' ? 0 : value(kindOf(victim)) * 10 - value(kindOf(p.b[static_cast<size_t>(m.from)]))) + (m.promo == 'q' ? 8000 : 0);
        };
        return gain(a) > gain(b);
    });
}

// 잡는 수만 끝까지 따라가 보아, 마지막 수에 말을 그냥 내주는 실수를 줄인다
inline int quiesce(const Position& p, int alpha, int beta, Search& s, int depth) {
    const int stand = evaluate(p);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0 || ++s.nodes > s.limit) return alpha;
    std::vector<Move> moves;
    legalMoves(p, moves);
    moves.erase(std::remove_if(moves.begin(), moves.end(), [&](const Move& m) { return p.b[static_cast<size_t>(m.to)] == '.' && m.promo != 'q'; }), moves.end());
    orderMoves(p, moves);
    for (const Move& m : moves) {
        const int score = -quiesce(play(p, m), -beta, -alpha, s, depth - 1);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

inline int negamax(const Position& p, int depth, int alpha, int beta, int ply, Search& s) {
    if (depth <= 0) return s.quiesce ? quiesce(p, alpha, beta, s, 3) : evaluate(p);
    std::vector<Move> moves;
    legalMoves(p, moves);
    if (moves.empty()) return inCheck(p) ? -kMate + ply : 0;
    if (++s.nodes > s.limit) return evaluate(p);
    orderMoves(p, moves);
    for (const Move& m : moves) {
        const int score = -negamax(play(p, m), depth - 1, -beta, -alpha, ply + 1, s);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

// 컴퓨터의 수. level 1 은 한 수 앞만 보고 자주 실수하며, 3 은 세 수 앞과 잡고 잡히는 끝까지 본다.
inline Move pick(const Position& p, int level, std::mt19937& rng) {
    std::vector<Move> moves;
    legalMoves(p, moves);
    if (moves.empty()) return {};
    if (level <= 1 && std::uniform_int_distribution<int>(0, 99)(rng) < 22) {   // 초보 상대: 가끔 아무 수나 둔다
        return moves[static_cast<size_t>(std::uniform_int_distribution<int>(0, static_cast<int>(moves.size()) - 1)(rng))];
    }
    const int depth = std::clamp(level, 1, 3);
    const int slack = level <= 1 ? 180 : level == 2 ? 50 : 12;   // 가장 좋은 수보다 이만큼 덜 좋은 수까지는 섞어서 고른다
    Search s;
    s.quiesce = level >= 3;
    s.limit = 16000;
    orderMoves(p, moves);
    std::vector<int> scores(moves.size(), -kMate * 2);
    int best = -kMate * 2;
    for (size_t i = 0; i < moves.size(); ++i) {
        // 지금까지의 최선보다 slack 넘게 나쁜 수는 그 사실만 알면 되므로 창을 좁혀 빨리 끝낸다
        const int floor = best <= -kMate ? -kMate * 2 : best - slack - 1;
        const int score = -negamax(play(p, moves[i]), depth - 1, -kMate * 2, -floor, 1, s);
        scores[i] = score;
        best = std::max(best, score);
    }
    std::vector<size_t> good;
    for (size_t i = 0; i < moves.size(); ++i) {
        if (scores[i] >= best - slack && (best < kMate / 2 || scores[i] == best)) good.push_back(i);   // 외통수는 놓치지 않는다
    }
    return moves[good[static_cast<size_t>(std::uniform_int_distribution<int>(0, static_cast<int>(good.size()) - 1)(rng))]];
}

// 힌트: 섞지 않고 가장 좋은 수
inline Move best(const Position& p, int depth) {
    std::vector<Move> moves;
    legalMoves(p, moves);
    if (moves.empty()) return {};
    Search s;
    s.quiesce = true;
    orderMoves(p, moves);
    int bestScore = -kMate * 2;
    Move bestMove = moves.front();
    for (const Move& m : moves) {
        const int score = -negamax(play(p, m), depth - 1, -kMate * 2, -bestScore, 1, s);
        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }
    return bestMove;
}

// 둘 차례인 쪽 말 가운데 공격받는데 지켜 주는 말이 없는 칸 (초보에게 위험을 알려 준다)
inline std::vector<int> hanging(const Position& p) {
    std::vector<int> out;
    for (int sq = 0; sq < 64; ++sq) {
        const char pc = p.b[static_cast<size_t>(sq)];
        if (colorOf(pc) != p.side || kindOf(pc) == 'k') continue;
        if (attacked(p, sq, 1 - p.side) && !attacked(p, sq, p.side)) out.push_back(sq);
    }
    return out;
}

}  // namespace chess
