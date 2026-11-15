// 계정 저장소. 계정마다 파일 하나를 쓴다 (<데이터 폴더>/<아이디의 16진수>.acc).
// 비밀번호 원문은 어디에도 저장하지 않고 PBKDF2 결과만 저장한다.
#pragma once

#include "home/decor.hpp"

#include <string>
#include <unordered_map>
#include <vector>

constexpr int kFishKinds = 3;  // 이름과 색은 클라이언트의 FISH 표에 있다
constexpr int kLootKinds = 2;  // 몬스터가 떨어뜨리는 아이템. 클라이언트의 LOOT 표에 있다
constexpr int kShopKinds = 8;  // 매점과 재즈바에서 파는 아이템. 클라이언트의 SHOP 표에 있다
// 아이템 번호: 물고기, 드롭 아이템, 매점 아이템 순서로 이어진다.
constexpr int kItemKinds = kFishKinds + kLootKinds + kShopKinds;

// 예전 저장 형식과 접속 명령의 색상(hue)을 그때 화면에 보이던 RGB 로 바꾼다.
int hueToRgb(int hue);
// 0xRRGGBB 를 "#rrggbb" 로. 음수면 빈 문자열.
std::string rgbToHex(int rgb);

struct Account {
    std::string id;
    std::string saltHex;
    std::string hashHex;
    int iterations = 0;

    std::string nick;
    int rgb = -1;  // 몸 색 0xRRGGBB. 아직 캐릭터를 만들지 않았으면 -1
    int arms = 1;
    int legs = 1;
    int limbColor = 0;
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
    int emotes = 0;         // 상점에서 산 감정표현 (감정 번호마다 한 비트)
    std::string mates;      // 동거인 계정 "<아이디>,<아이디>". 서로의 가구를 옮기고 치울 수 있다
    std::string friends;    // 친구 계정 "<아이디>,<아이디>"
    std::string friendReq;  // 나에게 온 친구 신청 "<아이디>,<아이디>" (접속하지 않은 동안 온 것도 남는다)
    std::string todo;       // 할 일: 항목마다 "<0|1 다 했는지><글>" 를 탭으로 잇는다
    bool todoShare = true;  // 친구에게 할 일을 보여 줄지
    int floorsOwned = 0;    // 산 바닥재 (바닥재 번호마다 한 비트). 한 번 사면 어느 집에나 계속 깐다
    std::string goods;      // 곳간의 물건 개수 "<당근>,<감자>,..." (activity/farm.hpp 의 물건 번호 순서)
    long eggAt = 0, milkAt = 0;  // 마지막으로 달걀과 우유를 거둔 때 (유닉스 초)
    std::string stats;      // 상태창의 기록 "<오목 승>,<패>,<무>,<다트 우승>,<다트 판>,<낚은 물고기>,<잡은 슬라임>,<접속 초>"

    int zone = 0;
    float x = -1.f;  // 저장된 위치가 없으면 음수
    float y = -1.f;
    int mapVersion = 1;  // 위치를 저장할 때의 마을 모양 (core/world.hpp 의 kMapVersion). 예전 넓은 맵은 1
};

class AccountStore {
public:
    explicit AccountStore(std::string dir);

    // 폴더를 만들고 저장된 계정을 전부 읽는다. 폴더를 쓸 수 없으면 false.
    bool load();

    Account* find(const std::string& id);
    // 닉네임이 같은 계정들 (친구를 이름으로 찾을 때)
    std::vector<const Account*> withNick(const std::string& nick) const;
    Account& add(Account account);
    size_t size() const { return accounts_.size(); }

    std::string pathFor(const std::string& id) const;
    const std::string& dir() const { return dir_; }

    static std::string serialize(const Account& account);
    static bool parse(const std::string& content, Account& out);

    // 임시 파일에 쓴 뒤 이름을 바꿔, 중간에 죽어도 이전 파일이 온전히 남게 한다.
    static bool writeAtomic(const std::string& path, const std::string& content);

private:
    std::string dir_;
    std::unordered_map<std::string, Account> accounts_;
};
