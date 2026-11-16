// 이 게임의 마을: core 의 기본 마을 위에 지은 건물들과 그 안의 꾸밈, 그리고 콘텐츠가 쓰는 자리 정보.
#pragma once

#include "core/world.hpp"

#include <string>
#include <vector>

constexpr float kFishReach = 96.f;   // 낚시할 수 있는 물가까지의 거리
constexpr float kCatReach = 68.f;    // 고양이와 상호작용할 수 있는 거리
constexpr float kLampReach = 56.f;   // 스탠드를 켜고 끌 수 있는 거리
constexpr float kTvReach = 70.f;     // TV 창을 열 수 있는 거리
constexpr float kDartReach = 80.f;   // 다트 게임을 열거나 참가할 수 있는 거리
constexpr float kShopReach = 90.f;   // 매점을 이용할 수 있는 거리
constexpr float kExteriorReach = 150.f;  // 밖에서 집 외관을 꾸밀 수 있는 문까지의 거리

// 집에 원래 놓여 있던 설치형 가구. 서버를 처음 켤 때 한 번만 배치 가구로 깔고, 그 뒤로는 옮기거나 소지품에 넣을 수 있다.
struct DecorSeed {
    int zone;
    std::string kind;  // home/decor.hpp 가구 목록의 이름
    float x, y;
    bool faced;        // 앉는 방향을 따로 정했는지 (식탁을 둘러싼 의자처럼)
    float faceX, faceY;
    int side;
    int gen;           // 몇 번째로 설치형이 된 묶음인지. 이미 깐 묶음은 다시 깔지 않는다
};

// 방 안에서 사는 반려동물의 시작 위치. 종류와 이름은 클라이언트의 ROOM_PETS 표에 있다
struct CatHome {
    int zone;
    float x;
    float y;
};

class Town {
public:
    explicit Town(World& world);

    // 카페, 집 세 채, 극장, 카지노, 재즈바, 특별관, 농장, 헤연의 집을 짓고 꾸민다. 서버를 켤 때 한 번
    void build();
    // 지도에 콘텐츠의 필드를 덧붙인다 (World::setExtraJson 으로 건다)
    void mapFields(std::string& json) const;

    int pianoSeat() const { return pianoSeat_; }  // 피아노 의자의 자리 번호
    const std::vector<CatHome>& roomCats() const { return roomCats_; }
    int jazzZone() const { return jazzZone_; }
    int casinoZone() const { return casinoZone_; }
    int farmZone() const { return farmZone_; }
    // 농장의 밭 칸 가운데 (칸 번호 순서)
    const std::vector<Spot>& farmPlots() const { return farmPlots_; }
    // 카지노 빠칭코 기계 앞 의자의 자리 번호
    const std::vector<int>& pachinkoSeats() const { return pachinkoSeats_; }
    const std::vector<DecorSeed>& decorSeeds() const { return seeds_; }
    // 집(구역 1~3)의 문이 (x, y) 에서 손 닿는 곳에 있으면 그 집 구역, 아니면 -1
    int houseDoorNear(float x, float y, float reach) const;
    // 켜고 끌 수 있는 조명이 손 닿는 곳에 있는지
    bool lampNear(int zone, float x, float y) const;
    bool hasTv(int zone) const;
    static bool isCinemaScreen(const std::string& kind) { return kind == "cinema_screen" || kind == "cinema_screen_big"; }

private:
    void addCafeTable(float x, float y);
    void buildCafe();
    void furnishTheater(int zone);
    void furnishScreeningRoom(int zone);
    void furnishCasino(int zone);
    void furnishJazzBar(int zone);
    void furnishFarm(int zone);
    void furnishBrickHouse(int zone, float w, float h);
    void furnishTileHouse(int zone, float w, float h);
    void furnishCabin(int zone, float w, float h);
    void furnishLoftHouse(int zone);
    void seed(int zone, const char* kind, float x, float y, int gen = 1);
    void seedFacing(int zone, const char* kind, float x, float y, float faceX, float faceY, int side);

    World& w_;
    int pianoSeat_ = -1;
    int jazzZone_ = -1;
    int casinoZone_ = -1;
    int farmZone_ = -1;
    std::vector<Spot> farmPlots_;
    std::vector<int> pachinkoSeats_;
    std::vector<DecorSeed> seeds_;
    std::vector<CatHome> roomCats_;
};
