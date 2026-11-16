// 카지노 빠칭코: 구슬이 떨어지는 곳과 숫자판은 서버가 정하고, 화면은 그 결과에 맞는 길로 구슬을 굴린다.
#include "game/rules.hpp"

bool Game::atPachinko(const Player& p) const {
    const auto& seats = town_.pachinkoSeats();
    return p.seat >= 0 && std::find(seats.begin(), seats.end(), p.seat) != seats.end();
}

// "shoot": 구슬 하나. 결과 r: 0 아래로 빠짐, 1 왼쪽 튤립, 2 오른쪽 튤립, 3 가운데 시작 구멍(숫자판 d 를 돌린다)
void Game::pachinkoCommand(ConnId id, Player& p, const std::string& arg) {
    if (arg != "shoot" || !atPachinko(p)) return;
    if (p.pachiTokens < 1.f) return;
    if (p.gold < kPachiCost) {
        server_.send(id, "{\"t\":\"pachi\",\"e\":\"gold\"}");
        return;
    }
    p.pachiTokens -= 1.f;
    p.gold -= kPachiCost;
    std::uniform_real_distribution<double> roll(0.0, 1.0);
    const double where = roll(rng_);
    int result = 0, win = 0, jackpot = 0;
    std::string digits;
    if (where < kPachiStartChance) {
        result = 3;
        win = kPachiStartPay;
        std::uniform_int_distribution<int> digit(1, 9);
        int a = digit(rng_), b = digit(rng_), c = digit(rng_);
        if (roll(rng_) < kPachiJackpotChance) {
            if (roll(rng_) < kPachiSevenShare) a = 7;
            else while (a == 7) a = digit(rng_);
            b = c = a;
            jackpot = a == 7 ? kPachiSevenPay : kPachiJackpotPay;
            win += jackpot;
        } else {
            if (roll(rng_) < kPachiReachChance) b = a;   // 두 개가 맞아 두근거리게
            while (c == a && b == a) c = digit(rng_);
        }
        digits = ",\"d\":[" + std::to_string(a) + "," + std::to_string(b) + "," + std::to_string(c) + "],\"j\":" + std::to_string(jackpot);
        if (a == b && b == c) {
            ++p.stats[kPachiJackpot];
            p.stats[kPachiBest] = std::max(p.stats[kPachiBest], win);
            // 숫자판이 멈출 즈음(약 3초 뒤)에 카지노 안의 사람들에게 알린다
            delayed_.push_back({clock_ + 3.2, p.zone, systemMessage(p.name + "님이 빠칭코에서 대박! " + std::to_string(a) + " " + std::to_string(a) + " " + std::to_string(a) + " (+" + std::to_string(win) + "골드)")});
        }
    } else if (where < kPachiStartChance + kPachiTulipChance) {
        result = roll(rng_) < 0.5 ? 1 : 2;
        win = kPachiTulipPay;
    }
    p.gold = std::min(kMaxGold, p.gold + win);
    p.dirty = true;
    server_.send(id, "{\"t\":\"pachi\",\"r\":" + std::to_string(result) + digits + ",\"w\":" + std::to_string(win) + ",\"g\":" + std::to_string(p.gold) + "}");
}
