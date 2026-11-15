// 다트판의 조준선과 점수 계산. 좌표는 다트판 중심이 (0, 0), 바깥 테두리가 반지름 1이고 y 는 아래로 커진다.
// 고리의 크기는 클라이언트의 drawDartBoard 와 같아야 한다.
#pragma once

#include <cmath>
#include <string>

namespace darts {

constexpr double kSweepPeriod = 1.7;  // 조준선이 한 번 왕복하는 시간(초)
constexpr double kSweepAmp = 1.12;    // 조준선은 판 바깥까지 움직인다
constexpr double kBull = 0.06;
constexpr double kOuterBull = 0.14;
constexpr double kTripleIn = 0.55;
constexpr double kTripleOut = 0.63;
constexpr double kDoubleIn = 0.92;
constexpr int kSectors[20] = {20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5};  // 위에서 시계 방향

struct Score {
    int points;
    std::string mark;
};

// 시작 위치 offset(0~1)에서 elapsed 초가 지났을 때의 조준선 위치.
inline double sweep(double offset, double elapsed) {
    double u = offset + elapsed / kSweepPeriod;
    u -= std::floor(u);
    return kSweepAmp * (4.0 * std::fabs(u - 0.5) - 1.0);
}

inline Score score(double x, double y) {
    const double r = std::hypot(x, y);
    if (r > 1.0) return {0, "MISS"};
    if (r <= kBull) return {50, "BULL"};
    if (r <= kOuterBull) return {25, "25"};
    const double step = 2.0 * std::acos(-1.0) / 20.0;
    int index = static_cast<int>(std::floor((std::atan2(x, -y) + step / 2.0) / step)) % 20;
    if (index < 0) index += 20;
    const int number = kSectors[index];
    if (r >= kDoubleIn) return {number * 2, "D" + std::to_string(number)};
    if (r >= kTripleIn && r <= kTripleOut) return {number * 3, "T" + std::to_string(number)};
    return {number, std::to_string(number)};
}

}  // namespace darts
