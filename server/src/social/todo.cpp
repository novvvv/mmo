// 날짜별 할 일. 친구에게 보여 줄 수 있다.
#include "core/rules.hpp"

// 할 일: {"t":"todo","own":1,"n","sh","i":[[글, 다 했는지, 날짜 yyyymmdd], ...]}. 친구의 것은 own 0, 공개하지 않으면 i 가 비어 있다
static std::string todoItemsJson(const std::vector<TodoItem>& todo) {
    std::string json;
    for (const TodoItem& item : todo) json += (json.empty() ? "[\"" : ",[\"") + text::jsonEscape(item.text) + "\"," + (item.done ? "1," : "0,") + std::to_string(item.date) + "]";
    return json;
}

void Game::sendTodo(ConnId id, const Player& p) {
    server_.send(id, "{\"t\":\"todo\",\"own\":1,\"n\":\"" + text::jsonEscape(p.name) + "\",\"sh\":" + (p.todoShare ? "1" : "0") + ",\"i\":[" + todoItemsJson(p.todo) + "]}");
}

void Game::sendFriendTodo(ConnId id, const std::string& account) {
    const Player* online = onlinePlayer(account);
    const Account* stored = accounts_.find(account);
    const std::vector<TodoItem> todo = online ? online->todo : stored ? parseTodo(stored->todo) : std::vector<TodoItem>{};
    const bool share = online ? online->todoShare : stored && stored->todoShare;
    server_.send(id, "{\"t\":\"todo\",\"own\":0,\"n\":\"" + text::jsonEscape(nickOf(account)) + "\",\"on\":" + (online ? "1" : "0") + ",\"sh\":" + (share ? "1" : "0") +
                         ",\"i\":[" + (share ? todoItemsJson(todo) : std::string()) + "]}");
}

// 내 할 일이 바뀌었다: 나에게, 지금 보고 있는 친구들에게, 친구 목록의 숫자에 알린다
void Game::todoChanged(ConnId id, const Player& p) {
    sendTodo(id, p);
    for (auto& entry : players_) {
        Player& viewer = entry.second;
        if (viewer.todoWatch == p.account && std::find(viewer.friends.begin(), viewer.friends.end(), p.account) != viewer.friends.end()) sendFriendTodo(entry.first, p.account);
    }
    notifyFriends(p.account);
}

// "add <날짜> <글>", "done <번호>" (다 했음과 아직을 바꾼다), "del <번호>", "edit <번호> <글>", "date <번호> <날짜>" (다른 날로 옮김), "move <번호> <자리>" (순서 바꾸기),
// "clear [날짜]" (그날, 또는 모든 날의 다 한 일 지우기), "share <0|1>", "today <날짜>" (이 화면의 오늘). 날짜는 yyyymmdd
void Game::todoCommand(ConnId id, Player& p, const std::string& arg) {
    if (!spendAction(p)) return;
    std::istringstream in(arg);
    std::string action;
    in >> action;
    if (action == "today") {
        long date = 0;
        in >> date;
        if (in.fail() || date == 0 || !validTodoDate(date)) return;
        p.today = static_cast<int>(date);
        sendFriends(id, p);
        return;
    }
    if (action == "add") {
        long date = 0;
        in >> date;
        std::string raw;
        std::getline(in >> std::ws, raw);
        const std::string line = text::sanitize(raw, kMaxTodoChars);
        if (in.fail() && raw.empty()) return;
        if (date == 0 || !validTodoDate(date) || line.empty()) return;
        if (p.todo.size() >= kMaxTodos) {
            server_.send(id, systemMessage("할 일은 모두 " + std::to_string(kMaxTodos) + "개까지 적을 수 있어요. 지난 할 일을 지워 주세요."));
            return;
        }
        if (std::count_if(p.todo.begin(), p.todo.end(), [&](const TodoItem& item) { return item.date == date; }) >= kMaxTodosPerDay) {
            server_.send(id, systemMessage("하루에 " + std::to_string(kMaxTodosPerDay) + "개까지 적을 수 있어요."));
            return;
        }
        p.todo.push_back({line, false, static_cast<int>(date)});
    } else if (action == "clear") {
        long date = 0;
        in >> date;
        const bool all = in.fail();
        p.todo.erase(std::remove_if(p.todo.begin(), p.todo.end(), [&](const TodoItem& item) { return item.done && (all || item.date == date); }), p.todo.end());
    } else if (action == "share") {
        long on = 0;
        in >> on;
        if (in.fail()) return;
        p.todoShare = on != 0;
    } else {
        long index = -1;
        in >> index;
        if (in.fail() || index < 0 || index >= static_cast<long>(p.todo.size())) return;
        TodoItem& item = p.todo[static_cast<size_t>(index)];
        if (action == "done") {
            item.done = !item.done;
        } else if (action == "del") {
            p.todo.erase(p.todo.begin() + index);
        } else if (action == "edit") {
            std::string raw;
            std::getline(in >> std::ws, raw);
            const std::string line = text::sanitize(raw, kMaxTodoChars);
            if (line.empty()) return;
            item.text = line;
        } else if (action == "date") {
            long date = 0;
            in >> date;
            if (in.fail() || date == 0 || !validTodoDate(date)) return;
            item.date = static_cast<int>(date);
        } else if (action == "move") {   // 순서 바꾸기: 그 일을 빼서 to 번째 자리에 넣는다 (같은 날 안에서는 to 번째 일의 자리로 간다)
            long to = -1;
            in >> to;
            if (in.fail() || to < 0 || to >= static_cast<long>(p.todo.size()) || to == index) return;
            TodoItem moved = item;
            p.todo.erase(p.todo.begin() + index);
            p.todo.insert(p.todo.begin() + to, std::move(moved));
        } else {
            return;
        }
    }
    p.dirty = true;
    todoChanged(id, p);
}
