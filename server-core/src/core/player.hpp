// 월드 안의 플레이어 한 명. core 가 아는 것은 위치, 모양, 입력, 앉은 자리뿐이다.
// 모듈이 플레이어마다 더 기억할 것이 있으면 이 구조체를 물려받은 타입을 Module::makePlayer 로 만들게 하거나,
// 모듈 안에 연결 번호(ConnId)로 찾는 표를 따로 둔다.
#pragma once

#include <cstdint>
#include <string>

struct PlayerBase {
    virtual ~PlayerBase() = default;

    std::string account;   // 계정 아이디
    std::string name;      // 화면에 보이는 이름
    int zone = 0;          // 있는 구역. 0 은 마을
    float x = 0.f;         // 발밑 가운데 (px)
    float y = 0.f;
    uint8_t input = 0;     // 누르고 있는 방향 (위 1, 아래 2, 왼쪽 4, 오른쪽 8)
    int rgb = 0;           // 몸 색 0xRRGGBB
    int arms = 1;          // 팔 모양 0~2
    int legs = 1;          // 다리 모양 0~2
    int limbColor = 0;     // 팔다리 색 0~2
    float chatTokens = 0.f;  // 채팅 도배 제한
    float faceX = 1.f;     // 마지막 좌우 이동 방향
    int seat = -1;         // 앉아 있는 자리 번호. 없으면 -1
    bool dirty = false;    // 마지막 저장 이후 바뀐 값이 있는지 (자동 저장이 본다)
};
