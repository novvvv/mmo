// 이 게임이 계정 파일에 두는 값들 (core 의 Account::extra 에 들어 있는 키).
// read 로 꺼내 쓰고, 바꿨으면 write 로 다시 넣는다. 키 이름과 순서는 예전 계정 파일과 같다.
#pragma once

#include "core/accounts.hpp"
#include "home/decor.hpp"

#include <string>

constexpr int kFishKinds = 3;  // 이름과 색은 클라이언트의 FISH 표에 있다
constexpr int kLootKinds = 2;  // 몬스터가 떨어뜨리는 아이템. 클라이언트의 LOOT 표에 있다
constexpr int kShopKinds = 8;  // 매점과 재즈바에서 파는 아이템. 클라이언트의 SHOP 표에 있다
// 아이템 번호: 물고기, 드롭 아이템, 매점 아이템 순서로 이어진다.
constexpr int kItemKinds = kFishKinds + kLootKinds + kShopKinds;

struct AccountData {
    int caught[kFishKinds] = {};
    int loot[kLootKinds] = {};
    int shop[kShopKinds] = {};
    int furn[kDecorKinds] = {};
    int dye = 0;          // 염료 개수
    std::string dyed;     // 염색한 가구 "<가구 번호>:<염색 값>,..." (소지품에 있는 것만)
    int gold = 0;
    bool boardOn = false;
    std::string boardText;  // 꺼 둔 동안에도 문구는 남겨 둔다
    int boardStyle = 0;     // 광고판 모양. 0 기본, 1 도트
    int pets = 0;           // 가진 펫 (펫 번호마다 한 비트)
    int pet = -1;           // 데리고 다니는 펫. 없으면 -1
    std::string petNames;   // 지어 준 펫 이름. 펫 번호 순서로 탭으로 잇는다 (비어 있으면 종류 이름)
    int emotes = 0;         // 상점에서 산 감정표현 (감정 번호마다 한 비트)
    std::string mates;      // 동거인 계정 "<아이디>,<아이디>". 서로의 가구를 옮기고 치울 수 있다
    std::string friends;    // 친구 계정 "<아이디>,<아이디>"
    std::string friendReq;  // 나에게 온 친구 신청 "<아이디>,<아이디>" (접속하지 않은 동안 온 것도 남는다)
    std::string todo;       // 할 일: 항목마다 "<0|1 다 했는지><글>" 를 탭으로 잇는다
    bool todoShare = true;  // 친구에게 할 일을 보여 줄지
    int floorsOwned = 0;    // 산 바닥재 (바닥재 번호마다 한 비트). 한 번 사면 어느 집에나 계속 깐다
    std::string goods;      // 곳간의 물건 개수 "<당근>,<감자>,..." (activity/farm.hpp 의 물건 번호 순서)
    long eggAt = 0, milkAt = 0;  // 마지막으로 달걀과 우유를 거둔 때 (유닉스 초)
    std::string stats;      // 상태창의 기록 "<오목 승>,<패>,<무>,..." (game/rules.hpp 의 Stat 순서)

    static AccountData read(const Account& account);
    void write(Account& account) const;
};
