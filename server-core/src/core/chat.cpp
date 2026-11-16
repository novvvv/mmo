// 채팅: 글을 정리하고 도배를 막은 뒤 모두에게 보낸다. 모듈이 먼저 가로챌 수 있다 (감정표현처럼).
#include "core/rules.hpp"

void Core::chat(ConnId id, PlayerBase& p, const std::string& raw) {
    const std::string message = text::sanitize(raw, kMaxChatChars);
    if (message.empty()) return;
    if (p.chatTokens < 1.f) {
        server_.send(id, systemMessage(kTooFastMessage));
        return;
    }
    p.chatTokens -= 1.f;
    for (Module* m : modules_) {
        if (m->onChat(id, p, message)) return;
    }
    sendToAll("{\"t\":\"chat\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) +
              "\",\"c\":\"" + rgbToHex(p.rgb) + "\",\"m\":\"" + text::jsonEscape(message) + "\"}");
}
