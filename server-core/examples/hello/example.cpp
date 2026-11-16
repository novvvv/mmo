#include "example.hpp"

#include "core/rules.hpp"

void ExampleModule::install(Core& core) {
    core_ = &core;
    core.addCommand("hello", [this](ConnId id, PlayerBase& p, const std::string& arg) { hello(id, p, arg); });
}

// 계정 파일의 "hello" 키에서 읽고, 같은 키에 쓴다. 다른 모듈의 키는 core 가 그대로 보관한다
void ExampleModule::loadPlayer(PlayerBase& p, const Account& account) {
    greetings_[p.account] = std::atoi(account.get("hello").c_str());
}

void ExampleModule::savePlayer(const PlayerBase& p, Account& account) {
    account.set("hello", std::to_string(greetings_[p.account]));
}

void ExampleModule::onJoin(ConnId id, PlayerBase&, JoinStep step) {
    if (step == JoinStep::Announced) core_->server().send(id, Core::systemMessage("채팅창에 직접 보내는 대신, 개발자 도구에서 ws.send('hello') 를 보내 보세요."));
}

void ExampleModule::hello(ConnId id, PlayerBase& p, const std::string& arg) {
    const int count = ++greetings_[p.account];
    p.dirty = true;   // 다음 자동 저장 때 savePlayer 가 불린다
    const std::string said = text::sanitize(arg, 50);   // 사용자가 보낸 글은 늘 정리해서 쓴다
    core_->server().send(id, Core::systemMessage(p.name + "님, 안녕하세요! (" + std::to_string(count) + "번째 인사)" + (said.empty() ? "" : " 덧붙인 말: " + said)));
}
