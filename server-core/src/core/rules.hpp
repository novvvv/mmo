// core 의 구현 파일(.cpp)들이 함께 쓰는 값과 작은 도우미. 모듈도 이 헤더를 포함해 같은 값을 쓴다.
#pragma once

#include "base/crypto.hpp"
#include "base/text.hpp"
#include "core/core.hpp"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>

constexpr float kSpeed = 220.f;  // 걷는 빠르기 (px/s)

constexpr size_t kMaxChatChars = 200;
constexpr float kChatBurst = 5.f;         // 연속으로 보낼 수 있는 메시지 수
constexpr float kChatRefillPerSec = 1.f;  // 초당 회복되는 메시지 수
const char* const kTooFastMessage = "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.";

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

// 이어 들어오기: 로그인하면 이 표를 함께 준다. 연결이 끊기거나 서버가 다시 켜져도 비밀번호 없이 같은 계정으로 돌아온다.
constexpr long kResumeSec = 30L * 24 * 3600;

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

// "<가>,<나>" 꼴의 목록 (계정 파일의 동거인·친구 목록 등). 빈 항목은 건너뛴다
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

// 탭으로 나눈 한 줄 (데이터 폴더의 .list 파일). 빈 칸도 그대로 남긴다
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
