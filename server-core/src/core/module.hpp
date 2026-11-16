// 모듈: core 위에 기능을 더하는 단위. core 는 등록된 모듈을 등록한 순서대로 부른다.
// 필요한 함수만 덮어쓰면 되고, 나머지는 아무것도 하지 않는다.
// 명령은 install 에서 Core::addCommand 로 등록한다.
#pragma once

#include "base/ws_server.hpp"

#include <memory>
#include <string>

class Core;
struct Account;
struct PlayerBase;

// 입장할 때 core 가 보내는 메시지 사이사이의 자리. 모듈은 자기 메시지를 맞는 자리에 보낸다.
enum class JoinStep {
    AfterMap,       // welcome, map 을 보낸 뒤
    AfterTime,      // 낮밤 시계(time)를 보낸 뒤
    AfterRoom,      // 구역(zone)과 그 방의 상태(onEnterRoom)를 보낸 뒤
    Announced,      // 모두에게 "○○님이 입장했습니다" 를 알린 뒤
};

// 퇴장할 때의 자리. 퇴장은 연결이 끊길 때와, 같은 계정이 다른 곳에서 로그인할 때 일어난다.
enum class LeaveStep {
    BeforeSave,     // 계정에 저장하기 전 (진행 중이던 일을 끝내고 그 결과까지 저장되게)
    Removed,        // 월드에서 빠진 뒤, 퇴장 안내 전
    Announced,      // 모두에게 퇴장을 알린 뒤
};

// 구역을 옮길 때의 자리. from == to 이면 같은 구역 안에서 자리만 옮긴 것이다.
enum class ZoneStep {
    Before,         // 옮기기 전
    Sent,           // 옮긴 사람에게 zone 메시지를 보낸 뒤, 그 방의 상태를 보내기 전
    Entered,        // 그 방의 상태까지 보낸 뒤
};

class Module {
public:
    virtual ~Module() = default;

    // 서버를 켤 때 한 번: 명령 등록, 월드 꾸미기, 저장된 것 읽기
    virtual void install(Core&) {}

    // 플레이어를 만들 때. PlayerBase 를 물려받은 타입을 쓰려면 여기서 만들어 돌려준다 (한 모듈만)
    virtual std::unique_ptr<PlayerBase> makePlayer() { return nullptr; }
    // 입장할 때 계정에서 읽기 / 계정에 쓰기. 자기 키만 Account::extra 에서 읽고 쓴다
    virtual void loadPlayer(PlayerBase&, const Account&) {}
    virtual void savePlayer(const PlayerBase&, Account&) {}

    // welcome 메시지에 필드 덧붙이기 (",\"키\":값" 꼴로 json 끝에 더한다)
    virtual void welcomeFields(const PlayerBase&, std::string&) {}
    // map 메시지에 필드 덧붙이기. 월드가 바뀌어 지도를 다시 만들 때도 불린다
    virtual void mapFields(std::string&) {}
    // state 메시지의 사람 항목에 필드 덧붙이기 (",\"키\":값" 꼴, 매 틱)
    virtual void stateFields(const PlayerBase&, std::string&) {}

    virtual void onJoin(ConnId, PlayerBase&, JoinStep) {}
    virtual void onLeave(ConnId, PlayerBase&, LeaveStep) {}
    // 계정이 접속을 마쳤을 때 (월드에 들어오기 전에 끊겨도 불린다)
    virtual void onLogout(const std::string& /*account*/) {}
    virtual void onZoneChange(ConnId, PlayerBase&, int /*from*/, int /*to*/, ZoneStep) {}
    // 방(구역)에 들어온 사람에게 그 방의 상태를 보낼 때 (입장할 때와 구역을 옮길 때)
    virtual void onEnterRoom(ConnId, int /*zone*/) {}
    // 채팅을 보내기 전에. true 를 돌려주면 채팅으로 보내지 않는다 (감정표현처럼 다르게 처리했을 때)
    virtual bool onChat(ConnId, PlayerBase&, const std::string& /*message*/) { return false; }

    // 이 플레이어가 지금 제자리에 있어야 하는지 (낚시 중처럼). true 면 core 가 움직이지 않는다
    virtual bool holdStill(const PlayerBase&) const { return false; }
    // 새 방향키를 누르거나 앉고 일어날 때: 붙잡고 있던 동작을 끝낸다
    virtual void cancelHold(PlayerBase&) {}

    // 매 틱: 플레이어마다 움직이기 전 / 모두 움직인 뒤, 상태를 보내기 전 / 상태를 보낸 뒤
    virtual void onPlayerTick(ConnId, PlayerBase&, float /*dt*/) {}
    virtual void onTick(float /*dt*/) {}
    virtual void afterBroadcast(float /*dt*/) {}
};
