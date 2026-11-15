// Game 의 구현 파일(.cpp)들이 함께 쓰는 규칙 값과 작은 도우미.
// 기능별 파일은 모두 이 헤더 하나를 포함한다. 값을 바꾸면 그 기능의 화면(client/)과 문서도 함께 본다.
#pragma once

#include "core/game.hpp"
#include "base/crypto.hpp"
#include "activity/darts.hpp"
#include "base/text.hpp"
#include <algorithm>
#include <chrono>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>

constexpr float kSpeed = 220.f;  // px/s
constexpr size_t kMaxChatChars = 200;
constexpr float kChatBurst = 5.f;         // 연속으로 보낼 수 있는 메시지 수
constexpr float kChatRefillPerSec = 1.f;  // 초당 회복되는 메시지 수
constexpr size_t kMaxBoardChars = 30;     // 머리 위 광고판 문구의 최대 글자 수
const char* const kTooFastMessage = "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.";

constexpr float kBiteMinSec = 2.5f;     // 던진 뒤 입질까지 걸리는 시간
constexpr float kBiteMaxSec = 7.f;
constexpr float kBiteWindowSec = 1.2f;  // 입질 후 낚아챌 수 있는 시간

constexpr float kCatSpeed = 55.f;        // px/s
constexpr float kCatRoam = 240.f;        // 집을 중심으로 돌아다니는 좌우 범위
constexpr float kCatBankMin = 26.f;      // 걸어갈 지점과 강 사이의 거리
constexpr float kCatBankMax = 150.f;
constexpr float kCatRestMinSec = 2.f;    // 멈춰서 쉬는 시간
constexpr float kCatRestMaxSec = 7.f;
constexpr float kCatWalkMaxSec = 12.f;   // 둑에 막혀 목적지에 못 가면 이 시간 뒤에 포기
constexpr int kCatBroadcastTicks = 5;    // 위치 전송 주기 (틱). 천천히 움직이므로 자주 보낼 필요가 없다
constexpr float kCatCooldownSec = 0.6f;  // 플레이어별 상호작용 간격
constexpr float kCatPetRestSec = 4.f;    // 쓰다듬으면 이만큼 제자리에 있는다
constexpr float kCatFollowSec = 25.f;    // 먹이를 주면 따라다니는 시간
constexpr float kCatFollowSpeed = 150.f;
constexpr float kCatFollowGap = 44.f;    // 따라갈 때 플레이어와 유지하는 거리

constexpr size_t kMinPasswordBytes = 4;
constexpr size_t kMaxPasswordBytes = 128;
constexpr int kMaxAuthInFlight = 16;      // 동시에 처리하는 로그인 수. 넘치면 거절해 CPU를 지킨다
constexpr int kLockAfterFailures = 5;     // 같은 IP에서 이 횟수만큼 연속으로 틀리면 잠시 잠근다
constexpr double kLockSec = 30.0;
constexpr size_t kMaxLoginLocks = 4096;
constexpr int kCloseAfterFailures = 10;   // 한 연결에서 이만큼 틀리면 연결을 끊는다
constexpr size_t kMaxAccounts = 50000;    // 무한 가입으로 디스크가 차지 않게 하는 상한
constexpr double kSignupWindowSec = 3600.0;
constexpr size_t kMaxSignupWindows = 4096;

constexpr int kLightLevelMin = 10;  // 밝기 슬라이더의 범위(%). 완전히 끄는 것은 스위치가 맡는다
constexpr int kLightLevelMax = 100;
constexpr float kLightBurst = 10.f;          // 슬라이더를 끄는 동안의 연속 변경을 받아 주는 양
constexpr float kLightRefillPerSec = 12.f;

constexpr long kPianoNotes = 17;         // 건반 수 (C4 ~ E5)
constexpr float kNoteBurst = 20.f;       // 빠른 연주와 화음을 받아 주는 양
constexpr float kNoteRefillPerSec = 20.f;

constexpr size_t kYoutubeIdLength = 11;
constexpr size_t kReelCodeMin = 5, kReelCodeMax = 64;
constexpr double kTvMaxSeconds = 86400.0;
constexpr float kTvBurst = 6.f;
constexpr float kTvRefillPerSec = 2.f;

// 채팅에 그대로 입력하면 캐릭터가 표정을 짓는다. 번호가 곧 메시지의 감정 번호다.
// 감정표현의 채팅 명령. 순서는 decor::kEmotePrices 와 같다
const char* const kEmotes[] = {"/박수", "/꿀맛", "/행복", "/엉엉", "/기쁨", "/하트", "/화남", "/졸림", "/놀람", "/인사", "/춤", "/부끄", "/웃음", "/윙크", "/물음"};
static_assert(sizeof(kEmotes) / sizeof(kEmotes[0]) == decor::kEmoteKinds, "감정표현 명령과 가격의 수가 같아야 한다");
constexpr float kCatRoomMargin = 40.f;  // 방 안 고양이가 벽과 유지하는 거리

constexpr int kMaxHp = 100;

constexpr int kGoldDrop = 99;               // 땅에 떨어진 골드를 나타내는 번호
constexpr int kMaxGold = 99999999;
constexpr int kMaxStack = 9999;
constexpr size_t kMaxDropsPerZone = 200;
constexpr float kPlayerDropTtlSec = 60.f;
constexpr float kDropScatter = 22.f;
constexpr float kActionBurst = 8.f;
constexpr float kActionRefillPerSec = 4.f;
constexpr float kTradeReach = 320.f;
constexpr size_t kMaxFriends = 30;
constexpr size_t kMaxFriendRequests = 20;   // 한 사람에게 쌓일 수 있는 친구 신청
constexpr size_t kMaxTodos = 200;        // 모든 날짜를 합쳐
constexpr long kMaxTodosPerDay = 30;
constexpr size_t kMaxTodoChars = 40;
constexpr size_t kGuestChars = 100;      // 방명록 글 한 개의 글자 수
constexpr size_t kGuestKeep = 200;       // 집마다 남기는 글
constexpr size_t kGuestSend = 100;       // 창에 보내는 최근 글
constexpr double kGuestCooldown = 10.0;  // 한 사람이 다시 쓰기까지

// 매점과 재즈바의 물건. 순서가 곧 매점 아이템 번호다.
struct ShopItem {
    int price;
    int heal;
    bool snack;
    bool bar;
};
inline constexpr ShopItem kShop[kShopKinds] = {
    {15, 15, true, false},     // 팝콘
    {10, 10, true, false},     // 콜라
    {40, 50, false, false},    // 체력 물약
    {100, kMaxHp, false, false},  // 고급 물약
    {0, 5, true, true},        // 웰컴 드링크 (입장할 때마다 한 잔 무료)
    {20, 10, true, true},      // 맥주
    {35, 20, true, true},      // 칵테일
    {60, 30, true, true},      // 위스키
};
constexpr int kWelcomeDrink = 4;  // 위 표에서의 위치
constexpr size_t kMaxDecorPerZone = 64;  // 집 한 채에 놓을 수 있는 가구 (원래 있던 가구 포함)
constexpr size_t kMaxDyed = 60;          // 소지품에 둘 수 있는 염색한 가구
constexpr int kMaxDye = 99;              // 가질 수 있는 염료
constexpr float kOmokReach = 90.f;        // 오목판에 앉을 수 있는 거리
constexpr double kOmokMoveSeconds = 120.0; // 한 수에 쓸 수 있는 시간. 넘기면 진다
constexpr int kOmokSize = 15;
constexpr int kMaxPetsPerHouse = 8;      // 한 집에 풀어놓을 수 있는 펫
constexpr size_t kMaxMates = 10;         // 동거인 수
constexpr size_t kMaxWatchers = 30;      // 한 판을 관전할 수 있는 사람
constexpr size_t kMaxFocusMembers = 8;   // 집중 모임 한 곳의 사람 수
constexpr int kMaxFocusMinutes = 180;
// 상태창 기록의 순서. 계정 파일의 stats 와 stats 메시지의 s 가 이 순서다.
enum Stat { kOmokWin, kOmokLoss, kOmokDraw, kDartWin, kDartGame, kFishCaught, kSlimeKill, kPlaySeconds,
            kArcadeWin, kArcadePlay, kBestShooter, kBestBricks, kMinesClear, kChessWin, kChessAiWin, kBestMinesStage,
            kPachiJackpot, kPachiBest, kFocusMinutes, kFocusDone, kHarvested, kCooked, kCookPerfect,
            kStatCount };   // 새 기록은 맨 뒤에만 (kSlimeKill 은 슬라임이 없어졌어도 자리를 지킨다)
static_assert(kStatCount <= 24, "Player::stats 크기를 늘려야 합니다");

// 카지노 빠칭코: 구슬 하나에 1골드. 구슬이 떨어지는 곳과 숫자판은 서버가 정하고, 화면은 그 결과에 맞는 길로 구슬을 굴린다.
// 기대값은 구슬 하나에 약 0.92골드로, 오래 하면 조금씩 잃는다.
constexpr int kPachiCost = 1;
constexpr double kPachiStartChance = 0.10;    // 가운데 시작 구멍 (숫자판을 돌린다)
constexpr double kPachiTulipChance = 0.15;    // 양옆 튤립 (둘을 합쳐)
constexpr int kPachiTulipPay = 2;
constexpr int kPachiStartPay = 1;
constexpr double kPachiJackpotChance = 1.0 / 16.0;
constexpr double kPachiSevenShare = 0.25;     // 대박 중 7 7 7 의 몫
constexpr int kPachiJackpotPay = 60, kPachiSevenPay = 150;
constexpr double kPachiReachChance = 0.3;     // 꽝일 때 앞의 두 숫자가 같아 두근거리는 판
constexpr float kPachiBurst = 6.f;            // 연사로 쏠 수 있는 구슬
constexpr float kPachiRefillPerSec = 3.5f;

// 이어 들어오기: 로그인하면 이 표를 함께 준다. 연결이 끊기거나 서버가 다시 켜져도 비밀번호 없이 같은 계정으로 돌아온다.
constexpr long kResumeSec = 30L * 24 * 3600;

// 집 외관: 벽 색, 지붕 색, 문, 장식(비트)
constexpr int kExteriorWalls = 9, kExteriorRoofs = 9, kExteriorDoors = 8, kExteriorDecoBits = 6, kExteriorForms = 9;
constexpr float kExteriorBurst = 6.f;

constexpr float kArcadeReach = 90.f;        // 오락기 앞에 앉을 수 있는 거리
constexpr double kArcadeStaleSec = 60.0;    // 슈팅·벽돌깨기를 돌리는 화면이 이만큼 점수를 안 보내면 끝낸다 (창을 내려 둔 채 떠났을 때)
constexpr int kArcadeRelayPerTick = 4;      // 한 틱에 받는 중계 메시지 (화면은 초당 15~20번 보낸다)
constexpr size_t kArcadeRelayMax = 12000;   // 중계하는 판 JSON 의 상한
constexpr double kArcadeTurnSec = 25.0;     // 지뢰찾기 대전의 한 차례
constexpr int kArcadeScorePerSec = 1500;    // 점수가 이보다 빨리 오르면 받지 않는다
constexpr int kMinesStages[][2] = {{8, 8}, {9, 12}, {10, 16}, {11, 21}, {12, 27}, {13, 34}};   // 혼자 하는 지뢰찾기 단계별 판 크기와 지뢰
constexpr double kMinesStagePause = 1.6;    // 깬 판을 보여 주고 다음 단계로 넘어가기까지
constexpr double kChessMoveSec = 180.0;     // 사람끼리 둘 때 한 수에 쓸 수 있는 시간. 넘기면 진다
constexpr double kChessAiPause = 0.7;       // 컴퓨터가 두기 전에 잠깐 뜸을 들인다
constexpr int kChessAiMax = 3;              // 컴퓨터의 가장 높은 단계
constexpr int kMinesVersusSize = 13, kMinesVersusCount = 33;   // 홀수라 비기지 않는다
constexpr int kRestGold = 1;             // 앉아서 config_.restSec 초를 쉴 때마다 받는 골드
constexpr float kDecorDoorGap = 110.f;       // 문 앞은 비워 둔다
constexpr float kWallBandTop = 112.f, kWallBandBottom = 16.f;  // 벽걸이를 걸 수 있는 벽의 높이
constexpr int kMaxFurnStack = 20;
constexpr int kDartRounds = 4;
constexpr size_t kDartsPerTurn = 3;
constexpr double kDartScatter = 0.03;        // 손이 떨리는 정도. 판 반지름 기준
constexpr double kDartAimSeconds = 8.0;      // 이 안에 멈추지 않으면 그 자리에서 던진다
constexpr double kDartStartPause = 0.8;
constexpr double kDartThrowPause = 0.45;
constexpr double kDartTurnPause = 1.1;
constexpr double kDartLobbySeconds = 90.0;
constexpr double kDartResultSeconds = 20.0;
constexpr double kDartMaxLag = 0.4;          // 누른 시점으로 인정하는 지연의 한도
constexpr double kDartClockSlack = 0.06;     // 서버 시계는 틱 단위로만 흐른다
constexpr int kDartWinEmote = 4;             // /기쁨
constexpr size_t kMaxJazzTracks = 40;
constexpr size_t kMaxJazzTitleChars = 80;
constexpr double kMinJazzPlaySeconds = 2.0;  // 이보다 빨리 온 "곡이 끝났다" 알림은 무시한다

constexpr float kDropTtlSec = 45.f;
constexpr float kPickupReach = 42.f;

constexpr float kAutosaveSec = 20.f;
constexpr float kTimeSyncSec = 30.f;

enum InputBits : uint8_t { kUp = 1, kDown = 2, kLeft = 4, kRight = 8 };

inline int clampInt(long value, int lo, int hi) { return static_cast<int>(std::clamp<long>(value, lo, hi)); }

// "#rrggbb" 또는 예전 클라이언트가 보내는 색상(0~359). 형식이 틀리면 -1.
inline int parseBodyColor(const std::string& text) {
    if (text.size() == 7 && text[0] == '#') {
        if (!std::all_of(text.begin() + 1, text.end(), [](unsigned char c) { return std::isxdigit(c); })) return -1;
        return static_cast<int>(std::strtol(text.c_str() + 1, nullptr, 16));
    }
    char* end = nullptr;
    const long hue = std::strtol(text.c_str(), &end, 10);
    if (end == text.c_str() || *end != '\0') return -1;
    return hueToRgb(clampInt(hue, 0, 359));
}

// 문자열 전체가 정수일 때만 true.
inline bool parseWhole(const char* digits, long& value) {
    char* end = nullptr;
    value = std::strtol(digits, &end, 10);
    return end != digits && *end == '\0';
}

// 염색 값 "rrggbb-명도-채도": 색은 소문자 16진수 6자리, 명도는 50~150, 채도는 0~200 (%).
inline bool validTint(const std::string& tint) {
    if (tint.size() < 10 || tint.size() > 14 || tint[6] != '-') return false;
    for (int i = 0; i < 6; ++i) {
        const unsigned char c = static_cast<unsigned char>(tint[i]);
        if (!std::isdigit(c) && (c < 'a' || c > 'f')) return false;
    }
    const auto dash = tint.find('-', 7);
    if (dash == std::string::npos || dash == 7 || dash + 1 >= tint.size()) return false;
    const std::string light = tint.substr(7, dash - 7), sat = tint.substr(dash + 1);
    if (!std::all_of(light.begin(), light.end(), ::isdigit) || !std::all_of(sat.begin(), sat.end(), ::isdigit)) return false;
    long l = 0, sv = 0;
    return parseWhole(light.c_str(), l) && parseWhole(sat.c_str(), sv) && l >= 50 && l <= 150 && sv >= 0 && sv <= 200;
}

// 계정 파일의 "<가구 번호>:<염색 값>,..." 와 Player::dyed 를 오간다.
inline std::vector<std::pair<int, std::string>> parseDyed(const std::string& text) {
    std::vector<std::pair<int, std::string>> out;
    std::istringstream in(text);
    std::string item;
    while (std::getline(in, item, ',') && out.size() < kMaxDyed) {
        const auto colon = item.find(':');
        long kind = -1;
        if (colon == std::string::npos || !parseWhole(item.substr(0, colon).c_str(), kind) || kind < 0 || kind >= kDecorKinds) continue;
        const std::string tint = item.substr(colon + 1);
        if (validTint(tint)) out.emplace_back(static_cast<int>(kind), tint);
    }
    return out;
}

inline std::string formatDyed(const std::vector<std::pair<int, std::string>>& dyed) {
    std::string out;
    for (const auto& item : dyed) out += (out.empty() ? "" : ",") + std::to_string(item.first) + ":" + item.second;
    return out;
}

// 계정 파일의 "<아이디>,<아이디>" 목록
inline std::vector<std::string> splitList(const std::string& csv) {
    std::vector<std::string> out;
    std::istringstream in(csv);
    std::string item;
    while (std::getline(in, item, ',')) {
        if (!item.empty()) out.push_back(item);
    }
    return out;
}

inline std::string joinList(const std::vector<std::string>& list) {
    std::string out;
    for (const std::string& item : list) out += (out.empty() ? "" : ",") + item;
    return out;
}

// 계정 파일의 할 일: 항목마다 "<0|1><글>" 을 탭으로 잇는다 (글에는 제어 문자가 없다)
// 할 일의 날짜: yyyymmdd. 0 은 날짜가 없던 예전 할 일
inline bool validTodoDate(long date) {
    if (date == 0) return true;
    const long month = (date / 100) % 100, day = date % 100;
    return date >= 20000101 && date <= 21001231 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// 계정 파일의 할 일: 항목마다 "<0|1><yyyymmdd>\x1e<글>" 을 탭으로 잇는다 (글에는 제어 문자가 없다).
// 날짜가 없던 예전 형식 "<0|1><글>" 도 읽는다.
inline std::vector<TodoItem> parseTodo(const std::string& line) {
    std::vector<TodoItem> out;
    std::istringstream in(line);
    std::string item;
    while (std::getline(in, item, '\t') && out.size() < kMaxTodos) {
        if (item.size() < 2 || (item[0] != '0' && item[0] != '1')) continue;
        long date = 0;
        size_t start = 1;
        if (item.size() > 10 && item[9] == '\x1e' && parseWhole(item.substr(1, 8).c_str(), date) && validTodoDate(date)) start = 10;
        else date = 0;
        const std::string text = text::sanitize(item.substr(start), kMaxTodoChars);
        if (!text.empty()) out.push_back({text, item[0] == '1', static_cast<int>(date)});
    }
    return out;
}

inline std::string formatTodo(const std::vector<TodoItem>& todo) {
    std::string out;
    char date[12];
    for (const TodoItem& item : todo) {
        std::snprintf(date, sizeof(date), "%08d", item.date);
        out += (out.empty() ? "" : "\t") + std::string(item.done ? "1" : "0") + date + "\x1e" + item.text;
    }
    return out;
}

inline std::vector<std::string> splitTabs(const std::string& line) {
    std::vector<std::string> fields;
    size_t start = 0;
    while (true) {
        const size_t tab = line.find('\t', start);
        fields.push_back(line.substr(start, tab == std::string::npos ? std::string::npos : tab - start));
        if (tab == std::string::npos) return fields;
        start = tab + 1;
    }
}

// 한 가지를 가질 수 있는 개수. 농장의 물건은 곳간의 한도를 따른다
inline int stackLimit(int kind) {
    return kind >= kItemKinds && kind < kBagKinds ? farm::kMaxGoods : kMaxStack;
}
// 지금 시각 (유닉스 초). 작물처럼 서버를 다시 켜도 이어져야 하는 시간에 쓴다
inline long unixNow() { return static_cast<long>(std::time(nullptr)); }
