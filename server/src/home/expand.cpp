// 집 확장: 원래 방 바깥을 20px 칸 단위로 칠해 바닥을 넓히고, 칠한 칸을 다시 지운다. 바닥과 벽은 World::setCells 가 만든다.
// 원래 방 바로 위(뒷벽 자리)를 칠하면 그만큼 벽이 없어져 방이 이어진다. 벽을 세우고 싶으면 벽 가구(room_wall)를 놓는다.
#include "game/rules.hpp"

#include <map>
#include <queue>
#include <set>

namespace {
constexpr long kMaxCellsPerCommand = 12000;   // 한 번에 끄는 사각형. 한도(1만 칸)를 한 번에 칠할 수 있을 만큼

bool overlaps(float ax0, float ay0, float ax1, float ay1, float bx0, float by0, float bx1, float by1) {
    return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

// ---- 예전 방식(벽을 뚫어 통로와 방을 붙이던 것)으로 저장된 expand.list 를 칸으로 옮길 때만 쓴다
struct OldOpening {
    int dir;
    float at, half, len, deep;
};

const FloorRect& oldEdge(const std::vector<FloorRect>& base, int dir) {
    const FloorRect* best = &base.front();
    for (const FloorRect& f : base) {
        const float span = dir <= 1 ? f.x1 - f.x0 : f.y1 - f.y0, bestSpan = dir <= 1 ? best->x1 - best->x0 : best->y1 - best->y0;
        const float edge = dir == 0 ? -f.y0 : dir == 1 ? f.y1 : dir == 2 ? -f.x0 : f.x1;
        const float bestEdge = dir == 0 ? -best->y0 : dir == 1 ? best->y1 : dir == 2 ? -best->x0 : best->x1;
        if (edge > bestEdge || (edge == bestEdge && span > bestSpan)) best = &f;
    }
    return *best;
}

void oldRects(const FloorRect& edge, const OldOpening& o, FloorRect& corridor, FloorRect& room) {
    const auto along = [&](float lo, float hi, float size) {
        return size <= hi - lo ? std::clamp(o.at - size / 2.f, lo, hi - size) : (lo + hi - size) / 2.f;
    };
    if (o.dir <= 1) {
        const float w = o.len > 0.f ? o.len : std::min(edge.x1 - edge.x0, 560.f), d = o.deep > 0.f ? o.deep : 300.f;
        const float x0 = along(edge.x0, edge.x1, w);
        if (o.dir == 0) {
            corridor = {o.at - o.half, edge.y0 - 160.f, o.at + o.half, edge.y0, edge.style};
            room = {x0, corridor.y0 - d, x0 + w, corridor.y0, edge.style};
        } else {
            corridor = {o.at - o.half, edge.y1, o.at + o.half, edge.y1 + 160.f, edge.style};
            room = {x0, corridor.y1, x0 + w, corridor.y1 + d, edge.style};
        }
        return;
    }
    const float h = o.len > 0.f ? o.len : std::min(edge.y1 - edge.y0, 440.f), d = o.deep > 0.f ? o.deep : 360.f;
    const float y0 = along(edge.y0, edge.y1, h);
    if (o.dir == 2) {
        corridor = {edge.x0 - 60.f, o.at - o.half, edge.x0, o.at + o.half, edge.style};
        room = {corridor.x0 - d, y0, corridor.x0, y0 + h, edge.style};
    } else {
        corridor = {edge.x1, o.at - o.half, edge.x1 + 60.f, o.at + o.half, edge.style};
        room = {corridor.x1, y0, corridor.x1 + d, y0 + h, edge.style};
    }
}
}  // namespace

// 칠한 칸이 모두 원래 방에서 이어져 있는지 (옆으로 맞닿은 칸끼리 이어진다)
bool Game::cellsConnected(int zone, const std::vector<Cell>& cells) const {
    if (cells.empty()) return true;
    const std::set<Cell> all(cells.begin(), cells.end());
    const auto touchesBase = [&](const Cell& c) {
        const float x0 = static_cast<float>(c.first) * kExpandCell, y0 = static_cast<float>(c.second) * kExpandCell;
        const float x1 = x0 + kExpandCell, y1 = y0 + kExpandCell;
        return std::any_of(world_.zone(zone).base.begin(), world_.zone(zone).base.end(), [&](const FloorRect& f) {
            const bool sideBySide = (x1 == f.x0 || x0 == f.x1) && y0 < f.y1 && y1 > f.y0;
            const bool aboveBelow = (y1 == f.y0 || y0 == f.y1) && x0 < f.x1 && x1 > f.x0;
            return sideBySide || aboveBelow;
        });
    };
    std::set<Cell> seen;
    std::queue<Cell> todo;
    for (const Cell& c : cells) {
        if (touchesBase(c)) {
            seen.insert(c);
            todo.push(c);
        }
    }
    while (!todo.empty()) {
        const Cell c = todo.front();
        todo.pop();
        for (const Cell& n : {Cell{c.first + 1, c.second}, Cell{c.first - 1, c.second}, Cell{c.first, c.second + 1}, Cell{c.first, c.second - 1}}) {
            if (all.count(n) && seen.insert(n).second) todo.push(n);
        }
    }
    return seen.size() == all.size();
}

void Game::applyExpansion(int zone, std::vector<Cell> cells) {
    world_.setCells(zone, std::move(cells));
    const std::string json = world_.zoneJson(zone);
    for (const auto& entry : players_) server_.send(entry.first, json);   // 나중에 들어올 사람도 보이게 모두에게
}

// "add <칸 x0> <칸 y0> <칸 x1> <칸 y1>": 그 사각형(양 끝 칸 포함)을 칠한다. "remove …": 칠한 칸을 지운다.
void Game::expandCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long cx0 = 0, cy0 = 0, cx1 = 0, cy1 = 0;
    in >> action >> cx0 >> cy0 >> cx1 >> cy1;
    if (in.fail() || (action != "add" && action != "remove")) return;
    if (cx0 > cx1) std::swap(cx0, cx1);
    if (cy0 > cy1) std::swap(cy0, cy1);
    constexpr long kLimit = 1000;   // 범위 검사 전에 터무니없는 값부터 거른다
    if (cx0 < -kLimit || cy0 < -kLimit || cx1 > kLimit || cy1 > kLimit || (cx1 - cx0 + 1) * (cy1 - cy0 + 1) > kMaxCellsPerCommand) return;
    if (!world_.expandable(p.zone)) {
        server_.send(id, systemMessage("넓힐 수 있는 집 안에서만 할 수 있습니다."));
        return;
    }
    if (p.tradeWith || !spendAction(p)) return;
    const Zone& z = world_.zone(p.zone);
    const std::set<Cell> have(z.cells.begin(), z.cells.end());
    const auto cellRect = [](const Cell& c, float& x0, float& y0, float& x1, float& y1) {
        x0 = static_cast<float>(c.first) * kExpandCell;
        y0 = static_cast<float>(c.second) * kExpandCell;
        x1 = x0 + kExpandCell;
        y1 = y0 + kExpandCell;
    };

    if (action == "add") {
        std::vector<Cell> fresh;
        const char* skipped = nullptr;
        for (long cy = cy0; cy <= cy1; ++cy) {
            for (long cx = cx0; cx <= cx1; ++cx) {
                const Cell c{static_cast<int>(cx), static_cast<int>(cy)};
                if (have.count(c) || world_.baseCell(p.zone, c)) continue;   // 이미 바닥
                if (const char* problem = world_.cellProblem(p.zone, c)) {
                    if (!skipped || std::strcmp(problem, "원래 방에 걸치는 칸입니다.") != 0) skipped = problem;
                    continue;
                }
                fresh.push_back(c);
            }
        }
        if (fresh.empty()) {
            if (skipped) server_.send(id, systemMessage(skipped));
            return;
        }
        // 벽걸이가 걸린 벽 앞을 칠하면 벽이 없어진다
        for (const Decor& d : decor_) {
            if (d.zone != p.zone) continue;
            const decor::Kind info = shapeOf(d);
            if (info.place != decor::kWall) continue;
            const float half = decor::visualHalf(info) * d.scale;
            for (const Cell& c : fresh) {
                float x0, y0, x1, y1;
                cellRect(c, x0, y0, x1, y1);
                if (overlaps(x0, y0, x1, y1, d.x - half, d.y - 70.f, d.x + half, d.y + kWallHeight)) {
                    server_.send(id, systemMessage("그 자리의 벽에 걸린 벽걸이를 먼저 옮겨 주세요."));
                    return;
                }
            }
        }
        std::vector<Cell> next(z.cells);
        next.insert(next.end(), fresh.begin(), fresh.end());
        if (static_cast<int>(next.size()) > kExpandMaxCells) {
            server_.send(id, systemMessage("더 넓힐 수 없습니다. 한 집에 " + std::to_string(kExpandMaxCells) + "칸까지 칠할 수 있어요."));
            return;
        }
        if (!cellsConnected(p.zone, next)) {
            server_.send(id, systemMessage("지금 바닥과 이어지게 칠해 주세요."));
            return;
        }
        if (World::mergeCells(next, z.style).size() > static_cast<size_t>(kExpandMaxRects)) {
            server_.send(id, systemMessage("바닥 모양이 너무 복잡합니다. 조금 더 반듯하게 칠해 주세요."));
            return;
        }
        const long price = static_cast<long>(fresh.size()) * decor::expandPrice();
        if (p.gold < price) {
            server_.send(id, systemMessage("골드가 부족합니다. (" + std::to_string(price) + " G 필요)"));
            return;
        }
        if (price > 0) {
            p.gold -= price;
            p.dirty = true;
            sendInventory(id, p);
        }
        applyExpansion(p.zone, std::move(next));
        saveExpansions();
        broadcastDecor(p.zone);
        server_.send(id, systemMessage(std::to_string(fresh.size()) + "칸을 넓혔습니다." + (skipped ? std::string(" (") + skipped + " 그 칸은 빼고 칠했어요)" : "")));
        return;
    }

    // remove
    std::vector<Cell> gone;
    for (const Cell& c : z.cells) {
        if (c.first >= cx0 && c.first <= cx1 && c.second >= cy0 && c.second <= cy1) gone.push_back(c);
    }
    if (gone.empty()) return;
    const auto inGone = [&](float x0, float y0, float x1, float y1) {
        return std::any_of(gone.begin(), gone.end(), [&](const Cell& c) {
            float a0, b0, a1, b1;
            cellRect(c, a0, b0, a1, b1);
            return overlaps(x0, y0, x1, y1, a0, b0, a1, b1);
        });
    };
    for (const Decor& d : decor_) {
        if (d.zone != p.zone) continue;
        const decor::Kind info = shapeOf(d);
        bool hit = false;
        if (info.place == decor::kWall) {   // 벽걸이가 걸린 벽의 바닥
            const float half = decor::visualHalf(info) * d.scale;
            hit = inGone(d.x - half, d.y, d.x + half, d.y + kWallBandTop + 20.f);
        } else if (info.place == decor::kFlat) {
            hit = inGone(d.x - std::max(info.halfW, 4.f), d.y - std::max(info.depth, 4.f), d.x + std::max(info.halfW, 4.f), d.y + std::max(info.depth, 4.f));
        } else {
            hit = inGone(d.x - std::max(info.halfW, 4.f), d.y - std::max(info.depth, 4.f), d.x + std::max(info.halfW, 4.f), d.y + 1.f);
        }
        if (hit) {
            server_.send(id, systemMessage("지우려는 칸에 놓인 가구를 먼저 옮겨 주세요."));
            return;
        }
    }
    const auto someoneIn = [&](float x, float y) { return inGone(x - kRadius, y - kRadius, x + kRadius, y + kRadius); };
    if (std::any_of(players_.begin(), players_.end(), [&](const auto& e) { return e.second.zone == p.zone && someoneIn(e.second.x, e.second.y); }) ||
        std::any_of(cats_.begin(), cats_.end(), [&](const Cat& c) { return c.zone == p.zone && someoneIn(c.x, c.y); })) {
        server_.send(id, systemMessage("지우려는 칸에 누가 있습니다."));
        return;
    }
    const std::set<Cell> removing(gone.begin(), gone.end());
    std::vector<Cell> next;
    for (const Cell& c : z.cells) {
        if (!removing.count(c)) next.push_back(c);
    }
    if (!cellsConnected(p.zone, next)) {
        server_.send(id, systemMessage("그 칸을 지우면 바닥이 끊어집니다."));
        return;
    }
    if (World::mergeCells(next, z.style).size() > static_cast<size_t>(kExpandMaxRects)) {
        server_.send(id, systemMessage("바닥 모양이 너무 복잡해집니다. 더 크게 지워 주세요."));
        return;
    }
    applyExpansion(p.zone, std::move(next));
    saveExpansions();
    broadcastDecor(p.zone);
    server_.send(id, systemMessage(std::to_string(gone.size()) + "칸을 지웠습니다."));
}

// expand.list: 한 줄에 "<구역>\tc\t<x>,<y> <x>,<y> …" (칠한 칸).
// 예전 방식의 줄 "<구역>\t<방향>\t<통로 가운데>\t<반폭>[\t<길이>\t<깊이>]" 은 그 통로와 방을 덮는 칸으로 옮긴다.
void Game::loadExpansions() {
    std::ifstream file(accounts_.dir() + "/expand.list");
    std::string line;
    std::map<int, std::set<Cell>> byZone;
    std::map<int, std::set<int>> oldDirs;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long zone = -1;
        if (f.size() < 3 || !parseWhole(f[0].c_str(), zone) || !world_.expandable(static_cast<int>(zone))) continue;
        const int z = static_cast<int>(zone);
        auto& cells = byZone[z];
        if (f[1] == "c") {
            std::istringstream in(f[2]);
            std::string pair;
            while (in >> pair) {
                int x = 0, y = 0;
                if (std::sscanf(pair.c_str(), "%d,%d", &x, &y) == 2 && !world_.cellProblem(z, {x, y})) cells.insert({x, y});
            }
            continue;
        }
        long dir = -1;
        if (!parseWhole(f[1].c_str(), dir) || dir < 0 || dir > 3 || !oldDirs[z].insert(static_cast<int>(dir)).second) continue;
        OldOpening o{static_cast<int>(dir), static_cast<float>(std::atof(f[2].c_str())), f.size() > 3 ? static_cast<float>(std::atof(f[3].c_str())) : 60.f, 0.f, 0.f};
        if (f.size() > 5) {
            o.len = static_cast<float>(std::atof(f[4].c_str()));
            o.deep = static_cast<float>(std::atof(f[5].c_str()));
        }
        if (!std::isfinite(o.at) || !std::isfinite(o.half) || !std::isfinite(o.len) || !std::isfinite(o.deep)) continue;
        FloorRect corridor{}, room{};
        oldRects(oldEdge(world_.zone(z).base, o.dir), o, corridor, room);
        // 예전 바닥을 모두 덮는 칸 (조금 넓어질 수는 있어도 놓인 가구가 바닥 밖으로 나가지 않는다)
        for (const FloorRect& r : {corridor, room}) {
            for (int cy = static_cast<int>(std::floor(r.y0 / kExpandCell)); static_cast<float>(cy) * kExpandCell < r.y1; ++cy) {
                for (int cx = static_cast<int>(std::floor(r.x0 / kExpandCell)); static_cast<float>(cx) * kExpandCell < r.x1; ++cx) {
                    if (!world_.baseCell(z, {cx, cy}) && !world_.cellProblem(z, {cx, cy})) cells.insert({cx, cy});
                }
            }
        }
    }
    bool migrated = !oldDirs.empty();
    for (auto& entry : byZone) {
        std::vector<Cell> cells(entry.second.begin(), entry.second.end());
        if (!cellsConnected(entry.first, cells)) continue;   // 손으로 고친 파일 같은 것. 그 집은 넓히기 전으로
        world_.setCells(entry.first, std::move(cells));
    }
    if (migrated) saveExpansions();
}

void Game::saveExpansions() {
    std::string content;
    for (int zone = 0; zone < world_.zoneCount(); ++zone) {
        const Zone& z = world_.zone(zone);
        if (z.cells.empty()) continue;
        content += std::to_string(zone) + "\tc\t";
        for (size_t i = 0; i < z.cells.size(); ++i) content += (i ? " " : "") + std::to_string(z.cells[i].first) + "," + std::to_string(z.cells[i].second);
        content += "\n";
    }
    worker_.post([path = accounts_.dir() + "/expand.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}
