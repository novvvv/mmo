// 동거인: 서로 놓은 가구를 옮기고 치울 수 있는 사이.
#include "core/rules.hpp"

// 내 동거인 목록: [[닉네임, 접속 중이면 연결 번호 아니면 0], ...]. 아이디는 보내지 않는다.
void Game::sendMates(ConnId id, const Player& p) {
    std::string json = "{\"t\":\"mates\",\"p\":[";
    for (size_t i = 0; i < p.mates.size(); ++i) {
        ConnId mateId = 0;
        onlinePlayer(p.mates[i], &mateId);
        const Account* account = accounts_.find(p.mates[i]);
        const std::string nick = account && !account->nick.empty() ? account->nick : "알 수 없음";
        json += (i ? ",[\"" : "[\"") + text::jsonEscape(nick) + "\"," + std::to_string(mateId) + "]";
    }
    server_.send(id, json + "]}");
}

// 동거인 목록을 바꾼다. 접속 중이면 플레이어에, 아니면 계정 파일에 바로 쓴다.
void Game::setMates(const std::string& account, const std::vector<std::string>& mates) {
    ConnId otherId = 0;
    if (Player* other = onlinePlayer(account, &otherId)) {
        other->mates = mates;
        other->dirty = true;
        sendMates(otherId, *other);
        broadcastDecor(other->zone);
        return;
    }
    Account* stored = accounts_.find(account);
    if (!stored) return;
    stored->mates.clear();
    for (const std::string& mate : mates) stored->mates += (stored->mates.empty() ? "" : ",") + mate;
    persist(*stored);
}

// "ask <연결 번호>", "yes <연결 번호>", "no <연결 번호>", "remove <내 목록의 번호>"
void Game::mateCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long value = -1;
    in >> action >> value;
    if (in.fail() || !spendAction(p)) return;
    if (action == "remove") {
        if (value < 0 || value >= static_cast<long>(p.mates.size())) return;
        const std::string other = p.mates[static_cast<size_t>(value)];
        p.mates.erase(p.mates.begin() + value);
        p.dirty = true;
        Account* otherAccount = accounts_.find(other);
        if (otherAccount) {
            Player* online = onlinePlayer(other);
            std::vector<std::string> theirs = online ? online->mates : std::vector<std::string>{};
            if (!online) {
                std::istringstream list(otherAccount->mates);
                std::string mate;
                while (std::getline(list, mate, ',')) if (!mate.empty()) theirs.push_back(mate);
            }
            theirs.erase(std::remove(theirs.begin(), theirs.end(), p.account), theirs.end());
            setMates(other, theirs);
        }
        sendMates(id, p);
        broadcastDecor(p.zone);
        server_.send(id, systemMessage("동거인을 해제했습니다."));
        return;
    }
    const auto targetIt = players_.find(static_cast<ConnId>(value));
    if (value <= 0 || targetIt == players_.end() || targetIt->first == id) return;
    Player& target = targetIt->second;
    if (action == "ask") {
        if (std::find(p.mates.begin(), p.mates.end(), target.account) != p.mates.end()) {
            server_.send(id, systemMessage("이미 동거인입니다."));
            return;
        }
        if (p.mates.size() >= kMaxMates || target.mates.size() >= kMaxMates) {
            server_.send(id, systemMessage("동거인은 열 명까지입니다."));
            return;
        }
        target.mateAskFrom = id;
        server_.send(targetIt->first, "{\"t\":\"mateask\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
        server_.send(id, systemMessage(target.name + "님에게 동거인을 신청했습니다."));
    } else if (action == "yes" || action == "no") {
        if (p.mateAskFrom != targetIt->first) return;
        p.mateAskFrom = 0;
        if (action == "no") {
            server_.send(targetIt->first, systemMessage(p.name + "님이 동거인 신청을 거절했습니다."));
            return;
        }
        if (p.mates.size() >= kMaxMates || target.mates.size() >= kMaxMates) return;
        if (std::find(p.mates.begin(), p.mates.end(), target.account) == p.mates.end()) p.mates.push_back(target.account);
        if (std::find(target.mates.begin(), target.mates.end(), p.account) == target.mates.end()) target.mates.push_back(p.account);
        p.dirty = target.dirty = true;
        sendMates(id, p);
        sendMates(targetIt->first, target);
        broadcastDecor(p.zone);
        if (target.zone != p.zone) broadcastDecor(target.zone);
        server_.send(id, systemMessage(target.name + "님과 동거인이 되었습니다. 서로의 가구를 옮기고 치울 수 있습니다."));
        server_.send(targetIt->first, systemMessage(p.name + "님과 동거인이 되었습니다. 서로의 가구를 옮기고 치울 수 있습니다."));
    }
}
