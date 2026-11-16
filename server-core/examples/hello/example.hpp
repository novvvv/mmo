// 모듈 예시: 새 모듈을 만들 때 이 두 파일을 복사해 시작한다.
// - 명령 하나("hello")를 등록하고
// - 플레이어마다 기억할 값(인사한 횟수)을 모듈 안의 표에 두고, 계정 파일에 저장하고 (키 "hello")
// - 입장할 때 안내를 보낸다.
#pragma once

#include "core/core.hpp"

#include <string>
#include <unordered_map>

class ExampleModule : public Module {
public:
    void install(Core& core) override;
    void loadPlayer(PlayerBase& p, const Account& account) override;
    void savePlayer(const PlayerBase& p, Account& account) override;
    void onJoin(ConnId id, PlayerBase& p, JoinStep step) override;

private:
    // "hello [아무 글]": 인사한 횟수를 하나 늘리고 답한다
    void hello(ConnId id, PlayerBase& p, const std::string& arg);

    Core* core_ = nullptr;
    std::unordered_map<std::string, int> greetings_;   // 계정 → 인사한 횟수
};
