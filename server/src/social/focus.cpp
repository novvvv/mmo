// 함께 집중: 모임을 모아 같은 타이머를 켠다.
#include "game/rules.hpp"

Game::FocusRoom* Game::focusOf(const std::string& account) {
    for (FocusRoom& room : focus_) {
        for (const FocusMember& m : room.members) if (m.account == account) return &room;
    }
    return nullptr;
}

// 들어갈 수 있는 모임: 친구가 있는 모임이거나, 방장이 지금 같은 곳에 있는 모임
bool Game::focusVisible(const Player& p, const FocusRoom& room) {
    for (const FocusMember& m : room.members) {
        if (std::find(p.friends.begin(), p.friends.end(), m.account) != p.friends.end()) return true;
    }
    const Player* host = onlinePlayer(room.members.front().account);
    return host && host->zone == p.zone;
}

// 모임 사람들에게 지금 상태를 보낸다. m 은 [[이름, 접속 중인지], ...] 이고 맨 앞이 방장, left 는 남은 초.
void Game::sendFocus(FocusRoom& room) {
    std::string list;
    for (const FocusMember& m : room.members) {
        list += (list.empty() ? "[\"" : ",[\"") + text::jsonEscape(nickOf(m.account)) + (onlinePlayer(m.account) ? "\",1]" : "\",0]");
    }
    char head[128];
    for (size_t i = 0; i < room.members.size(); ++i) {
        ConnId who = 0;
        Player* online = onlinePlayer(room.members[i].account, &who);
        if (!online) continue;
        online->focusing = room.running;
        std::snprintf(head, sizeof(head), "{\"t\":\"focus\",\"id\":%d,\"host\":%d,\"min\":%d,\"run\":%d,\"left\":%.1f,\"m\":[", room.id, i == 0 ? 1 : 0,
                      room.minutes, room.running ? 1 : 0, room.running ? std::max(0.0, room.endsAt - clock_) : 0.0);
        server_.send(who, head + list + "]}");
    }
}

// r 은 [[모임 번호, 방장 이름, 분, 사람 수, 도는 중인지, 남은 초], ...]
void Game::sendFocusList(ConnId id, const Player& p) {
    std::string json = "{\"t\":\"focuslist\",\"r\":[";
    bool first = true;
    char tail[96];
    for (const FocusRoom& room : focus_) {
        if (room.members.size() >= kMaxFocusMembers || !focusVisible(p, room)) continue;
        std::snprintf(tail, sizeof(tail), "\",%d,%zu,%d,%.0f]", room.minutes, room.members.size(), room.running ? 1 : 0,
                      room.running ? std::max(0.0, room.endsAt - clock_) : 0.0);
        json += std::string(first ? "[" : ",[") + std::to_string(room.id) + ",\"" + text::jsonEscape(nickOf(room.members.front().account)) + tail;
        first = false;
    }
    server_.send(id, json + "]}");
}

// 같은 곳에 있는 사람과 접속 중인 친구에게 모집을 알린다 (이미 어느 모임에 있는 사람은 빼고)
void Game::inviteFocus(ConnId id, const Player& p, const FocusRoom& room) {
    char tail[64];
    std::snprintf(tail, sizeof(tail), "\",\"min\":%d,\"c\":%zu}", room.minutes, room.members.size());
    const std::string json = "{\"t\":\"focusinv\",\"id\":" + std::to_string(room.id) + ",\"from\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) + tail;
    for (const auto& entry : players_) {
        const Player& other = entry.second;
        if (entry.first == id || focusOf(other.account)) continue;
        const bool isFriend = std::find(p.friends.begin(), p.friends.end(), other.account) != p.friends.end();
        if (isFriend || other.zone == p.zone) server_.send(entry.first, json);
    }
}

void Game::leaveFocus(const std::string& account, const std::string& name) {
    for (size_t i = 0; i < focus_.size(); ++i) {
        FocusRoom& room = focus_[i];
        const auto it = std::find_if(room.members.begin(), room.members.end(), [&](const FocusMember& m) { return m.account == account; });
        if (it == room.members.end()) continue;
        const bool wasHost = it == room.members.begin();
        if (wasHost && room.members.size() > 1) {   // 방장이 나가면 모임이 흩어진다. 남기고 싶으면 먼저 방장을 넘긴다
            disbandFocus(i, name + "님(방장)이 나가서 집중 모임이 해체되었어요.");
            return;
        }
        room.members.erase(it);
        ConnId who = 0;
        if (Player* online = onlinePlayer(account, &who)) {
            online->focusing = false;
            server_.send(who, "{\"t\":\"focus\",\"id\":0}");
        }
        if (room.members.empty()) {
            focus_.erase(focus_.begin() + static_cast<long>(i));
            return;
        }
        const std::string note = name + "님이 집중 모임에서 나갔어요.";
        for (const FocusMember& m : room.members) {
            if (onlinePlayer(m.account, &who)) server_.send(who, systemMessage(note));
        }
        sendFocus(room);
        return;
    }
}

// 모임을 없앤다. 도는 중이었으면 일찍 끝낸 것처럼 함께한 시간을 기록에 남긴다.
void Game::disbandFocus(size_t index, const std::string& note) {
    if (focus_[index].running) {
        const int id = focus_[index].id;
        finishFocus(index, true);
        if (index >= focus_.size() || focus_[index].id != id) return;   // 접속한 사람이 없어 이미 없어졌다
    }
    for (const FocusMember& m : focus_[index].members) {
        ConnId who = 0;
        if (Player* online = onlinePlayer(m.account, &who)) {
            online->focusing = false;
            server_.send(who, systemMessage(note));
            server_.send(who, "{\"t\":\"focus\",\"id\":0}");
        }
    }
    focus_.erase(focus_.begin() + static_cast<long>(index));
}

// 타이머가 끝났거나(cut 아님) 방장이 일찍 끝냈다(cut). 함께한 시간을 기록에 더하고, 모임은 남겨 다음 판을 바로 할 수 있게 한다.
void Game::finishFocus(size_t index, bool cut) {
    FocusRoom& room = focus_[index];
    room.running = false;
    char buf[96];
    for (auto it = room.members.begin(); it != room.members.end();) {
        ConnId who = 0;
        Player* online = onlinePlayer(it->account, &who);
        if (!online) {   // 끝날 때까지 돌아오지 않은 사람은 모임에서 뺀다
            it = room.members.erase(it);
            continue;
        }
        const int spent = std::clamp(static_cast<int>((clock_ - it->since) / config_.focusMinuteSec + 0.01), 0, room.minutes);
        online->focusing = false;
        if (spent > 0) addStat(who, kFocusMinutes, spent);
        if (!cut) addStat(who, kFocusDone);
        std::snprintf(buf, sizeof(buf), "{\"t\":\"focusdone\",\"min\":%d,\"mine\":%d,\"cut\":%d,\"c\":%zu}", room.minutes, spent, cut ? 1 : 0, room.members.size());
        server_.send(who, buf);
        ++it;
    }
    if (room.members.empty()) {
        focus_.erase(focus_.begin() + static_cast<long>(index));
        return;
    }
    sendFocus(room);
}

void Game::updateFocus() {
    for (size_t i = focus_.size(); i-- > 0;) {
        if (focus_[i].running && focus_[i].endsAt <= clock_) finishFocus(i, false);
    }
}

void Game::focusCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long value = 0;
    in >> action;
    const bool hasValue = static_cast<bool>(in >> value);
    if (!spendAction(p)) return;
    if (action == "list") {
        sendFocusList(id, p);
        return;
    }
    FocusRoom* room = focusOf(p.account);
    const bool host = room && room->members.front().account == p.account;
    const auto goodMinutes = [&] {
        if (hasValue && value >= 1 && value <= kMaxFocusMinutes) return true;
        server_.send(id, systemMessage("집중 시간은 1분부터 " + std::to_string(kMaxFocusMinutes) + "분까지 정할 수 있어요."));
        return false;
    };
    const auto tellRoom = [&](const std::string& message) {
        for (const FocusMember& m : room->members) {
            ConnId who = 0;
            if (onlinePlayer(m.account, &who)) server_.send(who, systemMessage(message));
        }
    };
    const auto begin = [&] {
        room->running = true;
        room->endsAt = clock_ + room->minutes * config_.focusMinuteSec;
        for (FocusMember& m : room->members) m.since = clock_;
        tellRoom(p.name + "님이 " + std::to_string(room->minutes) + "분 집중을 시작했어요. 끝날 때 알려 드릴게요!");
        sendFocus(*room);
    };

    if (action == "open") {
        if (room) {
            server_.send(id, systemMessage("이미 집중 모임에 들어가 있어요."));
            return;
        }
        if (!goodMinutes()) return;
        FocusRoom made;
        made.id = nextFocusId_++;
        made.minutes = static_cast<int>(value);
        made.members.push_back({p.account, clock_});
        focus_.push_back(made);
        inviteFocus(id, p, focus_.back());
        sendFocus(focus_.back());
    } else if (action == "join") {
        if (room) {
            server_.send(id, systemMessage("이미 집중 모임에 들어가 있어요. 먼저 나가 주세요."));
            return;
        }
        const auto found = std::find_if(focus_.begin(), focus_.end(), [&](const FocusRoom& r) { return r.id == value; });
        if (!hasValue || found == focus_.end() || !focusVisible(p, *found)) {
            server_.send(id, systemMessage("그 집중 모임은 이미 없어졌어요."));
            return;
        }
        if (found->members.size() >= kMaxFocusMembers) {
            server_.send(id, systemMessage("집중 모임이 가득 찼어요."));
            return;
        }
        room = &*found;
        tellRoom(p.name + "님이 집중 모임에 들어왔어요.");
        room->members.push_back({p.account, clock_});
        sendFocus(*room);
    } else if (!room) {
        server_.send(id, "{\"t\":\"focus\",\"id\":0}");
    } else if (action == "leave") {
        leaveFocus(p.account, p.name);
    } else if (!host) {
        server_.send(id, systemMessage("방장만 할 수 있어요."));
    } else if (action == "invite") {
        if (!room->running) inviteFocus(id, p, *room);
    } else if (action == "mins") {
        if (room->running || !goodMinutes()) return;
        room->minutes = static_cast<int>(value);
        sendFocus(*room);
    } else if (action == "start") {
        if (room->running) return;
        if (hasValue) {
            if (!goodMinutes()) return;
            room->minutes = static_cast<int>(value);
        }
        begin();
    } else if (action == "host") {   // "host <순서>": 모임의 그 사람(접속 중)에게 방장을 넘긴다
        if (!hasValue || value < 1 || value >= static_cast<long>(room->members.size())) return;
        const std::string account = room->members[static_cast<size_t>(value)].account;
        if (!onlinePlayer(account)) {
            server_.send(id, systemMessage("접속 중인 사람에게만 방장을 넘길 수 있어요."));
            return;
        }
        std::rotate(room->members.begin(), room->members.begin() + value, room->members.begin() + value + 1);   // 그 사람을 맨 앞으로, 나머지 순서는 그대로
        tellRoom(p.name + "님이 " + nickOf(account) + "님에게 방장을 넘겼어요.");
        sendFocus(*room);
    } else if (action == "stop") {
        if (!room->running) return;
        finishFocus(static_cast<size_t>(room - focus_.data()), true);
    }
}
