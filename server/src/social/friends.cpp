// 친구: 신청(접속하지 않은 사람에게도), 수락, 목록과 있는 곳, 끊기.
#include "game/rules.hpp"

// 친구는 서로 수락해야 맺어지고, 신청은 상대가 접속하지 않았어도 계정에 남아 다음에 접속하면 보인다.
// 친구는 서로의 접속 여부, 있는 곳, 할 일(공개한 경우)을 볼 수 있다. 아이디는 클라이언트에 보내지 않고 목록의 번호로 가리킨다.

// 계정의 친구 목록이나 받은 신청 (접속 중이면 플레이어의 것, 아니면 계정 파일의 것)
std::vector<std::string> Game::friendList(const std::string& account, bool requests) {
    if (const Player* online = onlinePlayer(account)) return requests ? online->friendReq : online->friends;
    const Account* stored = accounts_.find(account);
    if (!stored) return {};
    const AccountData data = AccountData::read(*stored);
    return splitList(requests ? data.friendReq : data.friends);
}

// 계정의 친구 목록이나 받은 신청을 고친다. 접속 중이면 플레이어에 쓰고 목록을 다시 보내고, 아니면 계정 파일에 바로 쓴다.
void Game::editFriends(const std::string& account, bool requests, const std::function<void(std::vector<std::string>&)>& edit) {
    ConnId otherId = 0;
    if (Player* other = onlinePlayer(account, &otherId)) {
        edit(requests ? other->friendReq : other->friends);
        other->dirty = true;
        sendFriends(otherId, *other);
        return;
    }
    Account* stored = accounts_.find(account);
    if (!stored) return;
    AccountData data = AccountData::read(*stored);
    std::string& csv = requests ? data.friendReq : data.friends;
    std::vector<std::string> list = splitList(csv);
    edit(list);
    csv = joinList(list);
    data.write(*stored);
    persist(*stored);
}

std::string Game::nickOf(const std::string& account) {
    if (const Player* online = onlinePlayer(account)) return online->name;
    const Account* stored = accounts_.find(account);
    return stored && !stored->nick.empty() ? stored->nick : "알 수 없음";
}

// 내 친구 목록: p 는 [[닉네임, 접속 중이면 연결 번호 아니면 0, 있는 구역(접속 안 하면 -1), 다 한 일, 할 일, 공개하는지], ...],
// q 는 받은 신청의 닉네임들.
void Game::sendFriends(ConnId id, const Player& p) {
    std::string json = "{\"t\":\"friends\",\"p\":[";
    for (size_t i = 0; i < p.friends.size(); ++i) {
        ConnId friendId = 0;
        const Player* online = onlinePlayer(p.friends[i], &friendId);
        const Account* stored = online ? nullptr : accounts_.find(p.friends[i]);
        const AccountData data = stored ? AccountData::read(*stored) : AccountData{};
        const std::vector<TodoItem> todo = online ? online->todo : stored ? parseTodo(data.todo) : std::vector<TodoItem>{};
        const bool share = online ? online->todoShare : stored ? data.todoShare : false;
        const auto counted = [&](const TodoItem& item) { return !p.today || item.date == 0 || item.date == p.today; };   // 오늘 할 일
        const long total = std::count_if(todo.begin(), todo.end(), counted);
        const long done = std::count_if(todo.begin(), todo.end(), [&](const TodoItem& item) { return counted(item) && item.done; });
        char tail[96];
        std::snprintf(tail, sizeof(tail), "\",%u,%d,%ld,%ld,%d]", friendId, online ? online->zone : -1, share ? done : 0L, share ? total : 0L, share ? 1 : 0);
        json += (i ? ",[\"" : "[\"") + text::jsonEscape(nickOf(p.friends[i])) + tail;
    }
    json += "],\"q\":[";
    for (size_t i = 0; i < p.friendReq.size(); ++i) json += (i ? ",\"" : "\"") + text::jsonEscape(nickOf(p.friendReq[i])) + "\"";
    server_.send(id, json + "]}");
}

// 이 계정을 친구로 둔 접속자들에게 목록을 다시 보낸다 (접속, 퇴장, 할 일이 바뀌었을 때)
void Game::notifyFriends(const std::string& account) {
    for (auto& entry : players_) {
        if (std::find(entry.second.friends.begin(), entry.second.friends.end(), account) != entry.second.friends.end()) sendFriends(entry.first, entry.second);
    }
}

void Game::askFriend(ConnId id, Player& p, const std::string& target, const std::string& targetName) {
    if (target == p.account) {
        server_.send(id, systemMessage("자기 자신에게는 친구 신청을 할 수 없어요."));
        return;
    }
    if (std::find(p.friends.begin(), p.friends.end(), target) != p.friends.end()) {
        server_.send(id, systemMessage(targetName + "님과는 이미 친구예요."));
        return;
    }
    const auto mine = std::find(p.friendReq.begin(), p.friendReq.end(), target);
    if (mine != p.friendReq.end()) {   // 상대가 먼저 신청해 두었다: 바로 친구가 된다
        acceptFriend(id, p, static_cast<size_t>(mine - p.friendReq.begin()));
        return;
    }
    if (p.friends.size() >= kMaxFriends) {
        server_.send(id, systemMessage("친구는 " + std::to_string(kMaxFriends) + "명까지예요."));
        return;
    }
    const std::vector<std::string> theirs = friendList(target, false), asked = friendList(target, true);
    if (theirs.size() >= kMaxFriends) {
        server_.send(id, systemMessage(targetName + "님의 친구 목록이 가득 찼어요."));
        return;
    }
    if (std::find(asked.begin(), asked.end(), p.account) != asked.end()) {
        server_.send(id, systemMessage(targetName + "님에게 이미 신청했어요. 수락을 기다려 주세요."));
        return;
    }
    if (asked.size() >= kMaxFriendRequests) {
        server_.send(id, systemMessage(targetName + "님에게 온 친구 신청이 너무 많아요. 나중에 다시 해 주세요."));
        return;
    }
    editFriends(target, true, [&](std::vector<std::string>& list) { list.push_back(p.account); });
    ConnId otherId = 0;
    const bool online = onlinePlayer(target, &otherId) != nullptr;
    if (online) server_.send(otherId, "{\"t\":\"friendask\",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
    server_.send(id, systemMessage(targetName + "님에게 친구 신청을 보냈어요." + (online ? "" : " 다음에 접속하면 볼 수 있어요.")));
}

void Game::acceptFriend(ConnId id, Player& p, size_t request) {
    const std::string other = p.friendReq[request];
    p.friendReq.erase(p.friendReq.begin() + static_cast<long>(request));
    p.dirty = true;
    const std::string otherName = nickOf(other);
    if (!accounts_.find(other) || std::find(p.friends.begin(), p.friends.end(), other) != p.friends.end()) {
        sendFriends(id, p);
        return;
    }
    if (p.friends.size() >= kMaxFriends || friendList(other, false).size() >= kMaxFriends) {
        sendFriends(id, p);
        server_.send(id, systemMessage("친구 목록이 가득 차서 " + otherName + "님과 친구가 될 수 없어요."));
        return;
    }
    p.friends.push_back(other);
    editFriends(other, true, [&](std::vector<std::string>& list) { list.erase(std::remove(list.begin(), list.end(), p.account), list.end()); });
    editFriends(other, false, [&](std::vector<std::string>& list) {
        if (std::find(list.begin(), list.end(), p.account) == list.end()) list.push_back(p.account);
    });
    sendFriends(id, p);
    server_.send(id, systemMessage(otherName + "님과 친구가 되었어요."));
    ConnId otherId = 0;
    if (onlinePlayer(other, &otherId)) {
        server_.send(otherId, "{\"t\":\"friendok\",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
        server_.send(otherId, systemMessage(p.name + "님과 친구가 되었어요."));
    }
}

// "ask <연결 번호>", "name <닉네임>", "yes <받은 신청 번호>", "no <받은 신청 번호>", "remove <친구 번호>",
// "todo <친구 번호>" (그 친구의 할 일을 본다), "unwatch" (그만 본다)
void Game::friendCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    in >> action;
    if (action == "unwatch") {
        p.todoWatch.clear();
        return;
    }
    if (!spendAction(p)) return;
    if (action == "ask") {
        long value = 0;
        in >> value;
        const auto target = players_.find(static_cast<ConnId>(value));
        if (in.fail() || value <= 0 || target == players_.end()) return;
        askFriend(id, p, target->second.account, target->second.name);
        return;
    }
    if (action == "name") {
        std::string raw;
        std::getline(in >> std::ws, raw);
        const std::string clean = text::sanitize(raw, text::kMaxNameChars);
        if (clean.empty()) return;
        const std::string nick = text::sanitizeName(clean);
        // 접속한 사람 가운데 같은 이름을 먼저 찾고, 없으면 계정에 남은 이름으로 찾는다
        for (const auto& entry : players_) {
            if (entry.first != id && entry.second.name == nick) {
                askFriend(id, p, entry.second.account, entry.second.name);
                return;
            }
        }
        std::vector<const Account*> found = accounts_.withNick(nick);
        found.erase(std::remove_if(found.begin(), found.end(), [&](const Account* a) { return a->id == p.account; }), found.end());
        if (found.empty()) server_.send(id, systemMessage("'" + nick + "' 이름을 가진 사람을 찾지 못했어요."));
        else if (found.size() > 1) server_.send(id, systemMessage("'" + nick + "' 이름이 여러 명이에요. 만나서 캐릭터를 우클릭해 신청해 주세요."));
        else askFriend(id, p, found.front()->id, nick);
        return;
    }
    long index = -1;
    in >> index;
    if (in.fail() || index < 0) return;
    const size_t at = static_cast<size_t>(index);
    if (action == "yes" && at < p.friendReq.size()) {
        acceptFriend(id, p, at);
    } else if (action == "no" && at < p.friendReq.size()) {
        const std::string other = p.friendReq[at];
        p.friendReq.erase(p.friendReq.begin() + index);
        p.dirty = true;
        sendFriends(id, p);
        ConnId otherId = 0;
        if (onlinePlayer(other, &otherId)) server_.send(otherId, systemMessage(p.name + "님이 친구 신청을 거절했어요."));
    } else if (action == "remove" && at < p.friends.size()) {
        const std::string other = p.friends[at];
        p.friends.erase(p.friends.begin() + index);
        p.dirty = true;
        if (p.todoWatch == other) p.todoWatch.clear();
        editFriends(other, false, [&](std::vector<std::string>& list) { list.erase(std::remove(list.begin(), list.end(), p.account), list.end()); });
        if (Player* online = onlinePlayer(other)) {
            if (online->todoWatch == p.account) online->todoWatch.clear();
        }
        sendFriends(id, p);
        server_.send(id, systemMessage(nickOf(other) + "님과 친구를 끊었어요."));
    } else if (action == "todo" && at < p.friends.size()) {
        p.todoWatch = p.friends[at];
        sendFriendTodo(id, p.todoWatch);
    }
}
