// 게임 진행: 로그인, 플레이어 상태, 낚시, 고양이, 낮밤 시계.
// 서버 권한(authoritative) 방식: 클라이언트는 입력만 보내고, 위치와 결과는 서버가 계산한다.
#pragma once

#include "core/accounts.hpp"
#include "activity/chess.hpp"
#include "activity/farm.hpp"
#include "base/worker.hpp"
#include "core/world.hpp"
#include "base/ws_server.hpp"

#include <cstdint>
#include <functional>
#include <random>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

constexpr int kTickRate = 20;  // 초당 틱 수
// 가방에 담겨 버리고 주고받을 수 있는 것: 물고기, 전리품, 매점 물건, 그 뒤로 농장의 물건(작물·달걀·우유·씨앗·요리)
constexpr int kBagKinds = kItemKinds + farm::kGoods;

struct GameConfig {
    int authIterations = 600000;  // PBKDF2 반복 횟수 (OWASP 권장값)
    int signupLimitPerHour = 10;  // IP 하나가 한 시간에 만들 수 있는 계정 수
    double halfCycleSec = 1800.0; // 낮 또는 밤이 이어지는 시간
    int authPerIp = 3;            // IP 하나가 동시에 처리할 수 있는 로그인 수
    double restSec = 60.0;        // 이만큼 앉아서 쉬면 골드 1
    double focusMinuteSec = 60.0; // 집중 타이머의 1분 (시험에서만 줄인다)
    int farmSpeed = 1;            // 작물이 자라고 닭·젖소가 기다리는 시간을 이만큼 나눈다 (시험에서만 올린다)
    int catNapPercent = -1;       // 쉬던 동물이 잠들 확률(%). -1 이면 낮 12, 밤 60 (시험에서만 정한다)
};

// 방명록 글 한 개
struct GuestEntry {
    long id = 0;
    int zone = 0;
    long time = 0;          // 쓴 때 (유닉스 초)
    std::string account;    // 쓴 사람 (지울 수 있는지 보는 데만 쓰고 보내지 않는다)
    std::string name;
    std::string look;       // 쓸 때의 모양 "rgb,팔,다리,팔다리색"
    std::string text;
};

// 할 일 한 줄
struct TodoItem {
    std::string text;
    bool done = false;
    int date = 0;   // 날짜 yyyymmdd (0 이면 날짜를 정하기 전의 예전 할 일)
};

class Game {
public:
    Game(WsServer& server, AccountStore& accounts, Worker& worker, const GameConfig& config);

    void onMessage(ConnId id, const std::string& msg);
    void onClose(ConnId id);
    void tick(float dt);
    void saveAll();

private:
    enum class FishState { Idle = 0, Waiting = 1, Bite = 2 };  // 값이 그대로 state 메시지에 실린다

    struct Player {
        std::string account;
        std::string name;
        int zone = 0;
        float x = 0.f;
        float y = 0.f;
        uint8_t input = 0;
        int rgb = 0;  // 몸 색 0xRRGGBB
        int arms = 1;
        int legs = 1;
        int limbColor = 0;
        float chatTokens = 0.f;
        float faceX = 1.f;  // 마지막 좌우 이동 방향 (다리 위에서 낚싯대를 던질 쪽)
        int seat = -1;      // 앉아 있는 자리 번호
        FishState fish = FishState::Idle;
        float fishTimer = 0.f;  // 입질까지, 또는 입질이 끝날 때까지 남은 시간
        float bobberX = 0.f;
        float bobberY = 0.f;
        int caught[kFishKinds] = {};
        int loot[kLootKinds] = {};
        int shop[kShopKinds] = {};
        int gold = 0;
        float actionTokens = 0.f;  // 버리기, 사기, 먹기, 교환 요청의 도배 제한
        ConnId tradeAsk = 0;       // 교환을 신청한 상대
        ConnId tradeWith = 0;      // 교환 중인 상대
        int offerItems[kBagKinds] = {};
        int offerGold = 0;
        bool tradeReady = false;
        int furn[kDecorKinds] = {};
        int dye = 0;                                     // 염료 개수
        std::vector<std::pair<int, std::string>> dyed;   // 소지품에 있는 염색한 가구: (가구 번호, 염색 값)
        bool welcomeReady = false;  // 재즈바에 들어올 때마다 웰컴 드링크를 한 잔 받을 수 있다
        int hp = 0;
        float catCooldown = 0.f;
        float pachiTokens = 0.f;  // 빠칭코 구슬 연사 제한
        float extTokens = 0.f;    // 집 외관 바꾸기 도배 제한
        float lightTokens = 0.f;
        float noteTokens = 0.f;
        float tvTokens = 0.f;
        bool boardOn = false;   // 머리 위 광고판을 띄웠는지
        std::string boardText;  // 꺼 둔 동안에도 문구는 남겨 둔다
        int boardStyle = 0;     // 광고판 모양. 0 기본, 1 도트
        int pets = 0;           // 가진 펫 (펫 번호마다 한 비트)
        int pet = -1;           // 데리고 다니는 펫. 없으면 -1
        int emotes = 0;         // 상점에서 산 감정표현 (감정 번호마다 한 비트)
        float restSeconds = 0.f;  // 앉아서 쉰 시간. 1분마다 1골드
        std::vector<std::string> mates;  // 동거인 계정
        int floorsOwned = 0;             // 산 바닥재 (번호마다 한 비트)
        int stats[24] = {};              // 기록. 순서는 core/rules.hpp 의 Stat
        float playCarry = 0.f;           // 접속 시간의 1초 미만 나머지
        ConnId mateAskFrom = 0;          // 나에게 동거인을 신청한 사람
        std::vector<std::string> friends;    // 친구 계정
        std::vector<std::string> friendReq;  // 나에게 온 친구 신청 (계정, 먼저 온 순서)
        std::vector<TodoItem> todo;          // 할 일
        bool todoShare = true;               // 친구에게 할 일을 보여 줄지
        std::string todoWatch;               // 지금 할 일 창에서 보고 있는 친구 (계정)
        int today = 0;                       // 이 사람 화면의 오늘 (yyyymmdd). 친구 목록의 "오늘 할 일" 을 센다
        int guestWatch = -1;                 // 열어 둔 방명록의 집 (구역)
        double guestAt = 0.0;                // 마지막으로 방명록에 쓴 때
        bool focusing = false;               // 집중 모임의 타이머가 도는 중 (머리 위 표시)
        int goods[farm::kGoods] = {};        // 곳간: 작물, 달걀, 우유, 씨앗, 요리
        long eggAt = 0, milkAt = 0;          // 마지막으로 달걀과 우유를 거둔 때 (유닉스 초)
        int cooking = -1;                    // 만들고 있는 요리법. 없으면 -1
        double cookAt = 0.0;                 // 요리를 시작한 때
        bool dirty = false;  // 마지막 저장 이후 바뀐 값이 있는지
    };

    struct Session {
        std::string account;  // 로그인에 성공한 계정. 비어 있으면 로그인 전
        bool authPending = false;
        int failures = 0;
    };

    struct Cat {
        int zone = 0;
        int slot = 0;       // 같은 구역의 고양이 중 몇 번째인지. 메시지의 고양이 번호
        float x = 0.f;
        float y = 0.f;
        float homeX = 0.f;
        bool north = true;  // 강의 어느 쪽에 사는지. 다리를 건너지 않는다.
        bool walking = false;
        float targetX = 0.f;
        float targetY = 0.f;
        float timer = 0.f;  // 남은 휴식 시간, 또는 걷기를 포기할 때까지 남은 시간
        ConnId followId = 0;  // 먹이를 준 플레이어를 따라가는 중이면 그 연결 번호
        float followTimer = 0.f;
        bool asleep = false;  // 웅크리고 자는 중. timer 가 다 되거나 누가 쓰다듬으면 깬다
        int pet = -1;         // 집에 풀어놓은 펫이면 펫 번호
        std::string owner;    // 풀어놓은 펫의 주인 계정
    };

    // 오목: 오목판을 놓은 방마다 한 판. 칸은 0 빈칸, 1 흑, 2 백.
    struct OmokGame {
        std::string board = std::string(225, '0');
        ConnId players[2] = {0, 0};  // 흑, 백
        std::string names[2];
        int turn = 1;        // 1 흑 차례, 2 백 차례
        int winner = 0;      // 1 흑 승, 2 백 승, 3 무승부. 0 이면 끝나지 않았다
        bool playing = false;
        int last = -1;       // 마지막으로 둔 칸
        double since = 0.0;  // 이번 수가 시작된 시각
        std::string why;     // 끝난 까닭: five, resign, time, leave, draw
        std::vector<ConnId> watchers;  // 관전하는 사람
    };

    // 오락기 한 대의 판. 슈팅과 벽돌깨기는 각자의 화면에서 같은 씨앗으로 돌리고 점수만 서버가 받아 승부를 가린다.
    // 지뢰찾기는 서버가 판을 갖고 둔다 (혼자: 보통 지뢰찾기, 둘: 번갈아 열어 지뢰를 더 많이 찾는 쪽이 이긴다).
    struct ArcadeGame {
        long decorId = 0;
        int zone = 0;
        int game = 0;                 // 0 슈팅, 1 벽돌깨기, 2 지뢰찾기, 3 체스
        ConnId players[2] = {0, 0};   // 1P, 2P (체스는 1P 가 백, 2P 가 흑)
        std::string names[2];
        int state = 0;                // 0 기다림, 1 하는 중, 2 끝
        bool versus = false;          // 둘이 앉아 시작했다
        bool coop = false;            // 슈팅·벽돌깨기를 둘이 한 화면에서 함께 한다 (1P 화면이 판을 돌려 중계한다)
        std::vector<ConnId> watchers; // 창을 열어 구경하는 사람 (중계 화면을 받는다)
        double relayClock = -1.0;     // 중계 메시지를 틱마다 센다 (0 1P 화면의 판, 1 2P 의 조작)
        int relays[2] = {0, 0};
        unsigned seed = 0;
        double startedAt = 0.0;
        int scores[2] = {0, 0};
        int lives[2] = {0, 0};
        bool done[2] = {false, false};
        double reportedAt[2] = {0.0, 0.0};
        int winner = -1;              // 0/1 이긴 쪽, 2 비김, -1 승부 없음(혼자)
        std::string why;              // 끝난 까닭: over, time, leave, clear, boom, mines, stale, mate, stalemate, material, fifty, repeat
        // 지뢰찾기
        int size = 0;
        int mineCount = 0;
        std::string board;            // 보이는 판: '.' 덮임, '0'~'8' 연 칸, 'a'/'b' 1P/2P 가 찾은 지뢰, 'x' 터진 지뢰, '*' 끝나고 드러난 지뢰
        std::string mines;            // '1' 이 지뢰
        bool laid = false;            // 혼자 하는 판은 첫 칸을 연 뒤에 지뢰를 묻는다
        int turn = 0;                 // 둘이 할 때 차례 (0 1P, 1 2P)
        double turnSince = 0.0;
        int found[2] = {0, 0};
        int stage = 1;                // 혼자 하는 지뢰찾기의 단계 (깰수록 판이 커지고 지뢰가 늘어난다)
        double nextStageAt = 0.0;     // 판을 깨고 다음 단계로 넘어가는 때 (0 이면 하는 중)
        // 체스
        chess::Position pos;
        struct ChessPly {
            chess::Position before;
            int from, to;
        };
        std::vector<ChessPly> plies;  // 둔 수 (무르기와 마지막 수 표시)
        std::vector<std::string> seen;// 지나온 국면 (세 번 같으면 비김)
        int aiSide = -1;              // 혼자 둘 때 컴퓨터의 색 (0 백, 1 흑)
        int aiLevel = 1;
        double aiAt = 0.0;            // 컴퓨터가 생각을 시작할 때
        bool aiThinking = false;
        unsigned serial = 0;          // 국면이 바뀔 때마다 늘린다 (늦게 온 컴퓨터의 수를 버린다)
        int hint[2] = {-1, -1};
    };

    // 방 조명. 같은 방에 있는 모두에게 똑같이 보인다.
    struct RoomLight {
        bool on = true;     // 방 전체의 불
        bool lamp = true;   // 스탠드
        int level = 100;    // 밝기(%)
    };

    // 땅에 떨어진 아이템. 가까이 가면 저절로 줍는다.
    struct Drop {
        int id = 0;
        int kind = 0;     // 아이템 번호. kGoldDrop 이면 골드
        int amount = 1;
        int zone = 0;
        float x = 0.f;
        float y = 0.f;
        float ttl = 0.f;
        ConnId owner = 0; // 버린 사람은 한 번 멀어진 뒤에야 다시 주울 수 있다
    };

    // 레코드판. 재즈바와, 레코드 플레이어를 놓은 집마다 하나씩 있다.
    // 등록한 곡을 차례로 끝없이 튼다. gen 은 곡이 바뀔 때마다 늘어난다.
    struct JazzTrack {
        std::string id;
        std::string title;
    };
    struct JazzBar {
        std::vector<JazzTrack> tracks;
        size_t current = 0;
        double since = 0.0;
        int gen = 1;
        bool stopped = false;  // 정지 버튼으로 멈춘 동안은 아무 곡도 틀지 않는다
    };

    // 집에 배치한 가구. 자리 번호는 서버를 켤 때마다 새로 정해진다.
    struct Decor {
        int id;
        int zone;
        int kind;
        float x, y;
        std::string owner;   // 놓은 사람의 계정. 비어 있으면 집에 원래 있던 가구라 누구나 소지품에 넣을 수 있다
        int seats[3];
        std::string tint{};  // 염색 값 "rrggbb-명도-채도". 비어 있으면 원래 색
        bool faced = false;  // 앉는 방향을 따로 정했는지 (식탁을 둘러싼 의자처럼 집에 원래 있던 가구)
        float faceX = 0.f, faceY = 1.f;
        int side = 0;
        bool flip = false;   // 좌우로 돌려 놓았는지. 그림과 앉는 자리, 앉는 방향이 함께 뒤집힌다
        float scale = 1.f;   // 크기 배율. 충돌 영역과 앉는 자리도 함께 바뀐다
        int rot = 0;         // 90도씩 돌린 횟수 (깔개, 텃밭, 침대). x, y 는 돌린 모양의 기준점이다
        // 텃밭에 심은 것. 농장의 밭과 같이 심은 사람만 거두고, 물은 누구나 준다
        int crop = -1;
        long plantedAt = 0, readyAt = 0, wateredAt = 0;
        std::string planter{};
    };

    // 재즈바 다트. 다트판이 하나라 한 번에 한 판만 열린다. 값의 순서는 클라이언트와 같다.
    enum class DartState { Idle, Lobby, Playing, Finished };
    enum class DartPhase { AimX, AimY, Pause };
    struct DartPlayer {
        ConnId id;
        std::string name;
        int score;
    };
    struct DartHit {
        double x, y;
        int points;
        std::string mark;
    };
    struct DartGame {
        DartState state = DartState::Idle;
        size_t size = 2;
        std::vector<DartPlayer> players;
        size_t turn = 0;
        int round = 1;
        std::vector<DartHit> hits;     // 지금 차례에 던진 다트
        DartPhase phase = DartPhase::Pause;
        int seq = 0;                   // 단계가 바뀔 때마다 늘어나 늦게 온 입력을 걸러낸다
        double since = 0.0;            // 지금 조준 단계가 시작된 시각
        double offset = 0.0;           // 조준선의 시작 위치
        double lockedX = 0.0;
        double until = 0.0;            // 대기실 마감, 다음 다트, 결과 화면 종료 시각
        std::vector<ConnId> winners;
    };

    // 방의 TV. 재생 위치는 pos 와 그 값을 정한 시각(since)으로 계산해 모두가 같은 장면을 본다.
    struct RoomTv {
        std::string video;  // 유튜브 영상 ID 또는 릴스 코드. 비어 있으면 꺼진 상태
        bool reel = false;  // 인스타 릴스면 true. 재생 위치를 맞출 수 없어 일시정지와 이동이 없다
        double pos = 0.0;
        double since = 0.0;
        bool paused = false;
        ConnId sharer = 0;  // 화면을 공유하는 사람. 이때 video 는 "@share" 이고 영상은 브라우저끼리 직접 주고받는다
        std::string sharerName;
    };

    // 함께 집중: 모임을 만들어 사람을 모으고, 방장이 시간을 정해 시작하면 모두 같은 타이머를 본다.
    // 계정으로 기억하므로 타이머가 도는 동안 끊겼다 다시 들어와도 모임에 남아 있다. 맨 앞 사람이 방장이다.
    struct FocusMember {
        std::string account;
        double since = 0.0;  // 이번 타이머에 함께하기 시작한 때 (집중한 시간 기록)
    };
    struct FocusRoom {
        int id = 0;
        std::vector<FocusMember> members;
        int minutes = 25;
        bool running = false;
        double endsAt = 0.0;
    };

    // 농장의 밭 한 칸. 심은 사람만 거둘 수 있고, 물은 누구나 줄 수 있다. 시각은 유닉스 초라 서버를 다시 켜도 이어 자란다.
    struct FarmPlot {
        std::string owner;   // 심은 사람의 계정. 비어 있으면 빈 칸
        int crop = -1;
        long plantedAt = 0;
        long readyAt = 0;
        long wateredAt = 0;
    };

    struct SignupWindow {
        double start = 0.0;
        int count = 0;
    };

    // 아이디와 IP 조합별 잠금. 다른 사람이 일부러 틀려서 내 계정을 잠그지 못하게 한다.
    struct LoginLock {
        int failures = 0;
        double lockedUntil = 0.0;
    };

    // 로그인
    void login(ConnId id, const std::string& arg);
    // 이어 들어오기: "resume <표>" 는 로그인할 때 받은 표로 비밀번호 없이 다시 들어온다
    void resume(ConnId id, const std::string& arg);
    void loadResumeKey();
    std::string resumeToken(const std::string& account, long expires) const;
    void authError(ConnId id, const std::string& message);
    bool allowSignup(const std::string& ip);
    void beginAuth(const std::string& ip);
    void endAuth(const std::string& ip);
    void finishSignup(ConnId id, const std::string& ip, const std::string& username, const std::string& saltHex,
                      int iterations, const std::string& hashHex);
    void finishVerify(ConnId id, const std::string& ip, const std::string& username, bool matched);
    void completeLogin(ConnId id, Account& account, bool isNew);
    void logout(ConnId id);

    // 입장과 저장
    void join(ConnId id, const std::string& arg);
    void placePlayer(Player& p, const Account& account);
    void syncAccount(Player& p);
    void persist(const Account& account);

    // 플레이어 행동
    void setInput(Player& p, uint8_t mask);
    void use(ConnId id, Player& p, const std::string& arg);
    bool tryDoor(ConnId id, Player& p);
    bool tryLamp(ConnId id, Player& p);
    void setLight(ConnId id, Player& p, const std::string& arg);
    void changeLight(ConnId id, Player& p, const RoomLight& next);
    void playNote(ConnId id, Player& p, const std::string& arg);
    void controlTv(ConnId id, Player& p, const std::string& arg);
    // "<상대 연결 번호> <내용>": 화면 공유의 연결 정보(WebRTC)를 공유하는 사람과 보는 사람 사이에서 그대로 전한다
    void relayRtc(ConnId id, const Player& p, const std::string& arg);
    // 화면을 공유하던 사람이 방을 떠나면 공유를 끝낸다
    void endShareBy(ConnId id, int zone);
    void moveToZone(ConnId id, Player& p, int zone, float x, float y);
    bool seatTaken(int seat) const;
    void toggleSit(Player& p);
    void chat(ConnId id, Player& p, const std::string& raw);
    void setBoard(ConnId id, Player& p, const std::string& arg);

    // 낚시
    void useRod(ConnId id, Player& p);
    void cast(ConnId id, Player& p);
    void reelIn(ConnId id, Player& p);
    void updateFishing(ConnId id, Player& p, float dt);

    // 고양이
    void placeCats();
    float catRestTime();
    bool isNight() const;
    int nearestCat(const Player& p) const;
    void pickCatTarget(Cat& cat);
    void updateCat(Cat& cat, float dt);
    void stepCat(Cat& cat, float nx, float ny);
    void petCat(ConnId id, Player& p);
    void feedCat(ConnId id, Player& p);
    std::string catEvent(int index, ConnId id, const Player& p, const char* action) const;
    void broadcastCats();

    // 떨어진 아이템
    void addDrop(int zone, int kind, int amount, float x, float y, ConnId owner);
    void updateDrops(float dt);
    std::string dropsJson(int zone) const;
    std::string lootCounts(const Player& p) const;
    std::string countsJson(const int* counts, int size) const;

    // 아이템과 골드
    int* itemCount(Player& p, int kind);
    void sendInventory(ConnId id, const Player& p);
    bool spendAction(Player& p);
    void dropItem(ConnId id, Player& p, const std::string& arg);
    void eatItem(ConnId id, Player& p, const std::string& arg);
    void buyItem(ConnId id, Player& p, const std::string& arg);
    void setHp(ConnId id, Player& p, int hp, int hit);

    // 카지노 빠칭코: "pachi shoot" 은 구슬 하나를 쏘고 떨어진 곳과 숫자판, 받은 골드를 알려 준다
    void pachinkoCommand(ConnId id, Player& p, const std::string& arg);
    bool atPachinko(const Player& p) const;
    // 집 외관: "ext <구역> <벽> <지붕> <문> <장식 비트> [모양]" 은 그 집 안이나 문 앞에서만
    void exteriorCommand(ConnId id, Player& p, const std::string& arg);
    std::string exteriorsJson() const;
    void loadExteriors();
    void saveExteriors();

    void decorCommand(ConnId id, Player& p, const std::string& arg);
    void buyDecor(ConnId id, Player& p, long kind);
    void buyDye(ConnId id, Player& p);
    void dyeFurniture(ConnId id, Player& p, long number, const std::string& tint, bool again);
    void placeDecor(ConnId id, Player& p, long number, float x, float y, bool dyed);
    void seedDecor();
    void floorCommand(ConnId id, Player& p, const std::string& arg);
    // 집 확장: "open <방향> [폭]" 은 그 방향 벽을 그 폭만큼 뚫어 방을 붙이고, "width <방향> <폭>" 은 뚫어 둔 통로의 폭을 바꾸고,
    // "close <방향>" 은 비어 있는 확장 방을 다시 막는다
    void expandCommand(ConnId id, Player& p, const std::string& arg);
    // strict 2: 고정 장식과 벽 앞 고정 가구도 피한다, 1: 벽 앞 고정 가구만 피한다, 0: 옮길 수 있는 가구만 본다
    std::string openingProblem(int zone, int dir, float at, float half, int strict, float len = 0.f, float deep = 0.f) const;
    void loadExpansions();
    void saveExpansions();
    void applyExpansion(int zone, std::vector<Opening> openings);
    std::string floorJson(int zone) const;
    void loadFloors();
    void saveFloors();
    void visitHouse(ConnId id, Player& p, const std::string& arg);
    void setBoardStyle(ConnId id, Player& p, const std::string& arg);
    // "<감정 번호>": 상점에서 감정표현을 산다. 한 번 사면 계속 쓴다
    void buyEmote(ConnId id, Player& p, const std::string& arg);
    void buyPet(ConnId id, Player& p, const std::string& arg);
    void walkPet(ConnId id, Player& p, const std::string& arg);
    void updateRest(ConnId id, Player& p, float dt);
    bool roomHasTv(int zone) const;
    bool lampNear(int zone, float x, float y) const;
    static std::string dyedJson(const Player& p);
    void takeDecor(ConnId id, Player& p, long decorId);
    std::string decorProblem(const Player& p, const decor::Kind& kind, float x, float y, bool moving = false) const;
    void moveDecor(ConnId id, Player& p, long decorId, float x, float y);
    void turnDecor(ConnId id, Player& p, long decorId);
    void scaleDecor(ConnId id, Player& p, long decorId, long percent);
    bool canManage(const Player& p, const Decor& item) const;
    bool returnToOwner(const std::string& owner, int kind, const std::string& tint);
    void mateCommand(ConnId id, Player& p, const std::string& arg);
    void sendMates(ConnId id, const Player& p);
    void setMates(const std::string& account, const std::vector<std::string>& mates);
    void friendCommand(ConnId id, Player& p, const std::string& arg);
    void askFriend(ConnId id, Player& p, const std::string& target, const std::string& targetName);
    void acceptFriend(ConnId id, Player& p, size_t request);
    std::vector<std::string> friendList(const std::string& account, bool requests);
    void editFriends(const std::string& account, bool requests, const std::function<void(std::vector<std::string>&)>& edit);
    std::string nickOf(const std::string& account);
    void sendFriends(ConnId id, const Player& p);
    void notifyFriends(const std::string& account);
    // 함께 집중: "open <분>", "join <모임 번호>", "leave", "mins <분>", "start [분]", "stop", "invite", "list"
    void focusCommand(ConnId id, Player& p, const std::string& arg);
    FocusRoom* focusOf(const std::string& account);
    bool focusVisible(const Player& p, const FocusRoom& room);
    void sendFocus(FocusRoom& room);
    void sendFocusList(ConnId id, const Player& p);
    void inviteFocus(ConnId id, const Player& p, const FocusRoom& room);
    void leaveFocus(const std::string& account, const std::string& name);
    void finishFocus(size_t index, bool cut);
    void updateFocus();
    // 농장: "plant <칸> <작물>", "water <칸>", "harvest <칸>", "dig <칸>", "buy <작물> <개수>" (씨앗),
    // "sell <물건> <개수>", "egg", "milk", "eat <요리>"
    void farmCommand(ConnId id, Player& p, const std::string& arg);
    static decor::Kind shapeOf(const Decor& item) { return decor::turned(decor::scaled(decor::kCatalog[item.kind], item.scale), item.rot); }
    void gardenCommand(ConnId id, Player& p, const std::string& arg);
    void sendGarden(ConnId id, const Player& p);
    void broadcastGarden(int zone);
    std::string yardProblem(const Player& p, const decor::Kind& kind, float x, float y, bool moving) const;
    void sendFarm(ConnId id, const Player& p);
    void broadcastFarm();
    void sendGoods(ConnId id, const Player& p);
    void addGoods(Player& p, int good, int count);
    bool nearFixed(const Player& p, const char* kind, float reach) const;
    void loadFarm();
    void saveFarm();
    // 요리: "start <요리법>" 은 조리대 앞에서 재료가 있을 때 시작하고, "done <점수>" 는 재료를 쓰고 요리를 받는다. "cancel" 은 그만둔다
    void cookCommand(ConnId id, Player& p, const std::string& arg);
    bool atKitchen(const Player& p) const;
    bool hasIngredients(const Player& p, int recipe) const;
    void todoCommand(ConnId id, Player& p, const std::string& arg);
    void sendTodo(ConnId id, const Player& p);
    void sendFriendTodo(ConnId id, const std::string& account);
    void todoChanged(ConnId id, const Player& p);
    void loadGuestbook();
    void saveGuestbook();
    std::string guestJson(int zone, const std::string& viewer) const;
    void sendGuestbook(int zone);
    std::string guestLastJson() const;
    void guestCommand(ConnId id, Player& p, const std::string& arg);
    Player* onlinePlayer(const std::string& account, ConnId* idOut = nullptr);
    bool isHouseZone(int zone) const;
    void installDecor(Decor& item);
    void uninstallDecor(const Decor& item);
    std::string decorJson(int zone, const Player& viewer) const;
    void broadcastDecor(int zone);
    void loadDecor();
    void saveDecor();
    void standUp(Player& p);
    void dartCommand(ConnId id, Player& p, const std::string& arg);
    std::string dartJson(int zone) const;
    void broadcastDarts(int zone);
    void resetDarts(int zone);
    void updateDarts();
    void updateDartGame(int zone);
    void startDartAim(int zone);
    void lockDart(int zone, double elapsed);
    void nextDartTurn(int zone);
    void finishDarts(int zone);
    void removeFromDarts(ConnId id);
    bool hasDarts(int zone) const;
    bool dartSpotNear(int zone, float x, float y) const;
    bool hasDecorKind(int zone, const char* kind) const;
    bool decorNear(int zone, const char* kind, float x, float y, float reach) const;
    void omokCommand(ConnId id, Player& p, const std::string& arg);
    std::string omokJson(int zone) const;
    void startOmok(int zone);
    void finishOmok(int zone, int winner, const char* why);
    void removeFromOmok(ConnId id);
    void arcadeCommand(ConnId id, Player& p, const std::string& arg);
    std::string arcadeJson(const ArcadeGame& g) const;
    void sendArcade(const ArcadeGame& g);
    void startArcade(ArcadeGame& g);
    void finishArcade(ArcadeGame& g, int winner, const char* why);
    void digMines(ArcadeGame& g, int side, int cell);
    void newMinesBoard(ArcadeGame& g);
    void playChess(ArcadeGame& g, const chess::Move& m);
    void askChessAi(ArcadeGame& g);
    void chessAiMoved(long decorId, unsigned serial, chess::Move m);
    int arcadeHost(const ArcadeGame& g) const;
    void arcadeRelay(ArcadeGame& g, ConnId from, const std::string& json);
    void removeFromArcade(ConnId id);
    void dropArcade(long decorId);
    void updateArcade();
    void statsCommand(ConnId id, Player& p, const std::string& arg);
    void addStat(ConnId id, int stat, int amount = 1);
    void updateOmok();
    void releasePet(ConnId id, Player& p, const std::string& arg);
    void callPet(ConnId id, Player& p, const std::string& arg);
    bool takeBackPet(const std::string& account, int kind);
    void renumberCats();
    void loadPets();
    void savePets();
    std::string freedPetsJson(const std::string& account) const;
    void jazzCommand(ConnId id, Player& p, const std::string& arg);
    bool hasRecord(int zone) const;
    std::string jazzJson(int zone) const;
    void changeJazzTrack(JazzBar& bar, size_t index);
    void enterJazzBar(ConnId id, Player& p);
    void startRecordIfAlone(ConnId id, int zone);
    void loadJazz();
    void saveJazz(int zone);
    std::string recordPath(int zone) const;
    void tradeCommand(ConnId id, Player& p, const std::string& arg);
    void sendTradeState(ConnId id, const Player& p);
    void endTrade(ConnId id, Player& p, const std::string& message);
    void finishTrade(ConnId aId, Player& a, ConnId bId, Player& b);

    // 전송
    static std::string systemMessage(const std::string& message);
    std::string timeJson() const;
    static std::string boardJson(ConnId id, const std::string& shown, int style);
    static std::string myBoardJson(const Player& p);
    std::string boardsJson() const;
    std::string lightJson(int zone) const;
    double tvPosition(const RoomTv& tv) const;
    std::string tvJson(int zone) const;
    void sendRoomStateOnEntry(ConnId id, int zone);
    void sendToAll(const std::string& json);
    void sendToZone(int zone, const std::string& json);
    void broadcastState();

    WsServer& server_;
    AccountStore& accounts_;
    Worker& worker_;
    GameConfig config_;
    World world_;
    std::mt19937 rng_;
    std::discrete_distribution<int> fishKind_{60.0, 30.0, 10.0};  // 붕어 60%, 메기 30%, 황금잉어 10%

    std::unordered_map<ConnId, Player> players_;
    std::unordered_map<ConnId, Session> sessions_;
    std::unordered_map<std::string, ConnId> online_;  // 계정 → 현재 접속 연결
    std::unordered_map<std::string, SignupWindow> signups_;
    std::unordered_map<std::string, LoginLock> loginLocks_;  // "IP|아이디" → 잠금 상태
    std::unordered_map<std::string, int> authByIp_;          // IP → 처리 중인 로그인 수
    std::vector<Cat> cats_;
    std::vector<RoomLight> lights_;  // 구역 번호별 조명
    std::vector<RoomTv> tvs_;        // 구역 번호별 TV
    std::vector<Drop> drops_;
    int nextDropId_ = 1;
    std::unordered_map<int, JazzBar> records_;  // 구역 번호별 레코드판
    std::unordered_map<int, DartGame> darts_;  // 구역 번호별 다트 (재즈바와 다트판을 놓은 집)
    std::unordered_map<int, OmokGame> omoks_;  // 구역 번호별 오목
    std::unordered_map<long, ArcadeGame> arcades_;  // 오락기 배치 번호별 판
    std::vector<GuestEntry> guestbook_;             // 모든 집의 방명록 (쓴 순서)
    std::vector<FarmPlot> farm_;                    // 농장의 밭 (칸 번호 순서)
    std::vector<FocusRoom> focus_;                  // 집중 모임
    int nextFocusId_ = 1;
    long guestNext_ = 1;
    std::vector<Decor> decor_;
    int nextDecorId_ = 1;
    std::vector<int> floors_;  // 구역별 바닥재 번호. 0 은 원래 바닥
    std::vector<std::string> floorTints_;  // 구역별 바닥 염색 값. 비어 있으면 원래 색
    struct Exterior {
        int wall = 0, roof = 0, door = 0, deco = 0, form = 0;   // form: 집의 생김새. 0 은 원래 모양
    };
    std::vector<Exterior> exteriors_;  // 구역별 집 외관 (집이 아닌 구역은 쓰지 않는다)
    std::string resumeKey_;            // 이어 들어오기 표의 서명 열쇠. 데이터 폴더에 남겨 서버를 다시 켜도 그대로 쓴다
    unsigned long tickCount_ = 0;
    struct Delayed {
        double at;
        int zone;
        std::string json;
    };
    std::vector<Delayed> delayed_;     // 잠시 뒤에 그 구역에 보낼 메시지 (빠칭코 대박 알림)      // state 메시지의 틱 번호. 화면이 다른 사람의 움직임을 고르게 잇는 데 쓴다

    double clock_ = 0.0;  // 서버 시작 후 경과 시간(초)
    int authInFlight_ = 0;
    int catTicks_ = 0;
    float autosaveTimer_ = 0.f;
    float timeSyncTimer_ = 0.f;
};
