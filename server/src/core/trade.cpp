// 두 사람의 교환: 신청과 수락, 내놓기, 둘 다 확인하면 한 번에 맞바꾼다.
#include "core/rules.hpp"

void Game::sendTradeState(ConnId id, const Player& p) {
    const auto partnerIt = players_.find(p.tradeWith);
    if (partnerIt == players_.end()) return;
    const Player& other = partnerIt->second;
    const auto side = [this](const Player& who) {
        return "{\"i\":" + countsJson(who.offerItems, kBagKinds) + ",\"g\":" + std::to_string(who.offerGold) + ",\"r\":" + (who.tradeReady ? "true" : "false") + "}";
    };
    server_.send(id, "{\"t\":\"trade\",\"a\":\"state\",\"mine\":" + side(p) + ",\"theirs\":" + side(other) + "}");
}

void Game::endTrade(ConnId id, Player& p, const std::string& message) {
    p.tradeAsk = 0;
    if (!p.tradeWith) return;
    const auto partnerIt = players_.find(p.tradeWith);
    p.tradeWith = 0;
    server_.send(id, "{\"t\":\"trade\",\"a\":\"closed\",\"m\":\"" + text::jsonEscape(message) + "\"}");
    if (partnerIt == players_.end()) return;
    partnerIt->second.tradeWith = 0;
    server_.send(partnerIt->first, "{\"t\":\"trade\",\"a\":\"closed\",\"m\":\"" + text::jsonEscape(message) + "\"}");
}

// 양쪽이 내놓은 것을 다시 확인한 뒤 한 번에 맞바꾼다. 하나라도 어긋나면 아무것도 옮기지 않는다.
void Game::finishTrade(ConnId aId, Player& a, ConnId bId, Player& b) {
    bool valid = a.offerGold <= a.gold && b.offerGold <= b.gold && a.gold - a.offerGold + b.offerGold <= kMaxGold && b.gold - b.offerGold + a.offerGold <= kMaxGold;
    for (int kind = 0; kind < kBagKinds && valid; ++kind) {
        valid = a.offerItems[kind] <= *itemCount(a, kind) && b.offerItems[kind] <= *itemCount(b, kind);
    }
    if (!valid) {
        endTrade(aId, a, "가진 물건이 달라져 교환이 취소되었습니다.");
        return;
    }
    for (int kind = 0; kind < kBagKinds; ++kind) {
        int& ofA = *itemCount(a, kind);
        int& ofB = *itemCount(b, kind);
        ofA = std::min(stackLimit(kind), ofA - a.offerItems[kind] + b.offerItems[kind]);
        ofB = std::min(stackLimit(kind), ofB - b.offerItems[kind] + a.offerItems[kind]);
    }
    a.gold += b.offerGold - a.offerGold;
    b.gold += a.offerGold - b.offerGold;
    syncAccount(a);
    syncAccount(b);
    sendInventory(aId, a);
    sendInventory(bId, b);
    sendGoods(aId, a);
    sendGoods(bId, b);
    endTrade(aId, a, "교환을 마쳤습니다.");
}

// "ask <상대>", "yes <상대>", "no <상대>", "item <번호> <개수>", "gold <금액>", "ready", "cancel"
void Game::tradeCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    long first = 0, second = 0;
    in >> action >> first >> second;

    if (action == "ask" || action == "yes" || action == "no") {
        const auto otherIt = players_.find(static_cast<ConnId>(first));
        if (otherIt == players_.end() || otherIt->first == id || !spendAction(p)) return;
        Player& other = otherIt->second;
        const ConnId otherId = otherIt->first;
        if (action == "ask") {
            if (p.tradeWith || other.tradeWith || other.zone != p.zone || std::hypot(other.x - p.x, other.y - p.y) > kTradeReach) {
                server_.send(id, systemMessage("지금은 교환을 신청할 수 없습니다."));
                return;
            }
            p.tradeAsk = otherId;
            server_.send(otherId, "{\"t\":\"trade\",\"a\":\"ask\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
            return;
        }
        if (other.tradeAsk != id) return;
        other.tradeAsk = 0;
        if (action == "no") {
            server_.send(otherId, systemMessage(p.name + "님이 교환을 거절했습니다."));
            return;
        }
        if (p.tradeWith || other.tradeWith || other.zone != p.zone) return;
        for (Player* who : {&p, &other}) {
            std::fill(std::begin(who->offerItems), std::end(who->offerItems), 0);
            who->offerGold = 0;
            who->tradeReady = false;
        }
        p.tradeWith = otherId;
        other.tradeWith = id;
        server_.send(id, "{\"t\":\"trade\",\"a\":\"open\",\"n\":\"" + text::jsonEscape(other.name) + "\"}");
        server_.send(otherId, "{\"t\":\"trade\",\"a\":\"open\",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
        sendTradeState(id, p);
        sendTradeState(otherId, other);
        return;
    }

    const auto partnerIt = players_.find(p.tradeWith);
    if (partnerIt == players_.end()) return;
    Player& partner = partnerIt->second;
    const ConnId partnerId = partnerIt->first;
    if (action == "cancel") {
        endTrade(id, p, p.name + "님이 교환을 취소했습니다.");
        return;
    }
    if (action == "ready") {
        p.tradeReady = true;
        if (partner.tradeReady) {
            finishTrade(id, p, partnerId, partner);
            return;
        }
    } else if (action == "item") {
        int* count = itemCount(p, static_cast<int>(first));
        if (!count) return;
        p.offerItems[first] = clampInt(second, 0, *count);
    } else if (action == "gold") {
        p.offerGold = clampInt(first, 0, p.gold);
    } else {
        return;
    }
    if (action != "ready") p.tradeReady = partner.tradeReady = false;  // 내용이 바뀌면 다시 확인해야 한다
    sendTradeState(id, p);
    sendTradeState(partnerId, partner);
}
