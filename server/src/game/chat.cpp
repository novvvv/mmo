// 머리 위 광고판. 채팅은 core 가, 감정표현은 game.cpp 의 onChat 이 맡는다.
#include "game/rules.hpp"

// "<0 또는 1> <문구>": 머리 위 광고판을 끄거나 켠다. 문구는 꺼 둘 때도 저장해 다시 켤 때 쓴다.
void Game::setBoard(ConnId id, Player& p, const std::string& arg) {
    if (arg.empty() || (arg[0] != '0' && arg[0] != '1') || (arg.size() > 1 && arg[1] != ' ')) return;
    const std::string message = arg.size() > 2 ? text::sanitize(arg.substr(2), kMaxBoardChars) : std::string();
    const bool on = arg[0] == '1' && !message.empty();

    if (on != p.boardOn || message != p.boardText) {
        if (p.chatTokens < 1.f) {
            server_.send(id, systemMessage(kTooFastMessage));
        } else {
            p.chatTokens -= 1.f;
            const bool shownChanges = on != p.boardOn || (on && message != p.boardText);
            p.boardOn = on;
            p.boardText = message;
            p.dirty = true;
            if (shownChanges) sendToAll(boardJson(id, on ? message : "", p.boardStyle));
        }
    }
    server_.send(id, myBoardJson(p));  // 거절했을 때도 보낸 사람의 스위치를 실제 상태로 맞춘다
}

// 광고판 문구는 바뀔 때만 보낸다. 매 틱 state 에 실으면 인원수의 제곱으로 전송량이 늘어난다.
// 구역과 상관없이 모두에게 보내 두므로 집을 드나들어도 다시 받을 필요가 없다.
std::string Game::boardJson(ConnId id, const std::string& shown, int style) {
    return "{\"t\":\"board\",\"id\":" + std::to_string(id) + ",\"m\":\"" + text::jsonEscape(shown) + "\",\"s\":" + std::to_string(style) + "}";
}

std::string Game::myBoardJson(const Player& p) {
    return std::string("{\"t\":\"myboard\",\"on\":") + (p.boardOn ? "true" : "false") + ",\"m\":\"" +
           text::jsonEscape(p.boardText) + "\",\"s\":" + std::to_string(p.boardStyle) + "}";
}

// "<0 또는 1>": 광고판 모양을 바꾼다. 켜 둔 광고판은 모두에게 새 모양으로 다시 알린다.
void Game::setBoardStyle(ConnId id, Player& p, const std::string& arg) {
    long style = -1;
    if (!parseWhole(arg.c_str(), style) || style < 0 || style > 1) return;
    if (style != p.boardStyle && spendAction(p)) {
        p.boardStyle = static_cast<int>(style);
        p.dirty = true;
        if (p.boardOn) sendToAll(boardJson(id, p.boardText, p.boardStyle));
    }
    server_.send(id, myBoardJson(p));
}

std::string Game::boardsJson() const {
    std::string json = "{\"t\":\"boards\",\"p\":[";
    bool first = true;
    for (const auto& entry : players_) {
        if (!entry.second.boardOn) continue;
        if (!first) json += ',';
        first = false;
        json += "[" + std::to_string(entry.first) + ",\"" + text::jsonEscape(entry.second.boardText) + "\"," + std::to_string(entry.second.boardStyle) + "]";
    }
    json += "]}";
    return json;
}
