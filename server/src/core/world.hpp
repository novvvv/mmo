// 게임 월드의 고정된 모습: 강, 구역(야외/집 내부), 건물, 가구, 앉을 자리, 나무, 가로등.
// 같은 데이터를 입장 시 클라이언트에 보내 화면과 충돌 판정이 일치하게 한다.
#pragma once

#include <string>
#include <vector>

// 마을. 예전(2000×2000)보다 빈 땅을 줄여 가까이 모았다. 예전 위치로 저장된 계정은 kMapVersion 으로 알아보고 옮긴다.
constexpr float kWorldW = 1440.f;
constexpr float kWorldH = 1520.f;
constexpr float kRadius = 16.f;
constexpr int kMapVersion = 2;
constexpr float kSpawnX = 720.f, kSpawnY = 560.f;  // 처음 들어오는 사람이 서는 광장 (카페 아래, 강 북쪽)

constexpr float kRiverStep = 40.f;  // 강둑 샘플 간격
constexpr int kRiverSamples = static_cast<int>(kWorldW / kRiverStep) + 1;
constexpr float kBridgeL = 680.f;   // 다리 양 끝 (샘플 지점에 맞춤)
constexpr float kBridgeR = 760.f;
constexpr float kShoreMargin = kRadius;  // 캐릭터 중심이 물가에 다가갈 수 있는 한계
constexpr float kBodyMargin = 14.f;      // 건물, 가구와 캐릭터 중심 사이의 최소 거리

constexpr float kChairReach = 56.f;  // 자리에 앉을 수 있는 거리
constexpr float kDoorReach = 56.f;   // 문을 쓸 수 있는 거리
constexpr float kFishReach = 96.f;   // 낚시할 수 있는 물가까지의 거리
constexpr float kCatReach = 68.f;    // 고양이와 상호작용할 수 있는 거리
constexpr float kLampReach = 56.f;   // 스탠드를 켜고 끌 수 있는 거리
constexpr float kTvReach = 70.f;     // TV 창을 열 수 있는 거리
constexpr float kDartReach = 80.f;   // 다트 게임을 열거나 참가할 수 있는 거리
constexpr float kBedReach = 104.f;   // 침대에 누울 수 있는 거리
constexpr float kShopReach = 90.f;   // 매점을 이용할 수 있는 거리
constexpr float kExteriorReach = 150.f;  // 밖에서 집 외관을 꾸밀 수 있는 문까지의 거리

// 동서로 흐르는 강. 둑은 샘플 지점을 직선으로 이은 선이다.
class River {
public:
    River();

    float top(float x) const { return sample(top_, x); }
    float bottom(float x) const { return sample(bottom_, x); }

    // (x, y)에서 (nx, ny)로 옮긴다. 물에 닿으면 둑을 따라 미끄러지고, 다리에서는 옆으로 떨어지지 않는다.
    void move(float& x, float& y, float nx, float ny) const;

    // 고양이용: 다리도 물처럼 막아서 자기 쪽 강가를 벗어나지 않게 한다.
    void moveOnBank(float& x, float& y, float nx, float ny) const;

    // 강폭 안이면 true. 물에는 들어갈 수 없으므로 플레이어에게는 다리 위라는 뜻이다.
    bool overWater(float x, float y) const { return y > top(x) && y < bottom(x); }

    // 가장 가까운 수면까지의 거리. 강폭 안(다리 위)이면 0.
    float distanceToWater(float x, float y) const;

    void appendJson(std::string& out) const;

    bool walkable(float x, float y) const { return !inChannel(x, y) || onBridge(x); }

private:
    static float sample(const float* table, float x);
    bool inChannel(float x, float y) const { return y > top(x) - kShoreMargin && y < bottom(x) + kShoreMargin; }
    static bool onBridge(float x) { return x >= kBridgeL + kShoreMargin && x <= kBridgeR - kShoreMargin; }
    void pushToBank(float nx, float& ny) const;

    float top_[kRiverSamples];
    float bottom_[kRiverSamples];
};

struct Spot {
    float x;
    float y;
};

struct Seat {
    int zone;
    float x;
    float y;
    float faceX;  // 앉았을 때 바라보는 방향
    float faceY;
    int side;     // 옆자리와 글자가 겹치지 않게 이름을 펼칠 방향 (-1 왼쪽, 1 오른쪽, 0 가운데)
    bool lie = false;   // 침대처럼 눕는 자리인지
    float sortY = 0.f;  // 눕는 자리: 침대보다 앞에 그려지도록 쓰는 기준선
    float exitX = 0.f;  // 눕는 자리: 일어나면 서는 곳
    float exitY = 0.f;
};

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

struct Furniture {
    std::string kind;  // 그림 종류. 클라이언트의 FURNITURE 표에 대응한다.
    int zone;
    float x;
    float y;
    bool hidden = false;  // 집을 넓히며 뚫은 벽 자리에 걸려 있던 고정 장식. 그리지 않는다
};

struct Solid {
    int zone;
    float x0, y0, x1, y1;
    bool carved = false;  // 여러 방을 잇는 집에서 바닥이 아닌 곳을 막은 것. 집을 넓히면 다시 만든다
};

struct Building {
    std::string kind;  // "house", "cafe", "theater", "casino", "jazz"
    int style;         // 외형 번호
    std::string name;  // 간판 글자
    float x, y;        // 건물 바닥의 중심
    float halfW, back, front;  // 충돌 영역: x±halfW, y-back ~ y+front
    float doorX, doorY;
    int room;          // 문으로 들어가는 구역 번호. 없으면 -1
    int outside = 0;   // 문이 나 있는 구역. 마을이 아니면 다른 건물 안에 난 문이다 (극장 안의 특별관). 이때 x, y 는 지도에 찍을 자리다
    float deckX0 = 0.f, deckY0 = 0.f, deckX1 = 0.f, deckY1 = 0.f;  // 테라스 바닥 (없으면 모두 0)
};

// 방 안에서 사는 반려동물의 시작 위치. 종류와 이름은 클라이언트의 ROOM_PETS 표에 있다
struct CatHome {
    int zone;
    float x;
    float y;
};

// 여러 방이 복도로 이어진 구역의 바닥 하나. style 은 클라이언트의 ROOM_STYLES 번호다.
struct FloorRect {
    float x0, y0, x1, y1;
    int style;
};

// 집 확장: 원래 방의 한쪽 벽을 뚫어 통로와 새 방을 붙인다. at 은 통로의 가운데(위아래로 뚫으면 x, 좌우면 y)다.
enum ExpandDir { kExpandUp = 0, kExpandDown = 1, kExpandLeft = 2, kExpandRight = 3 };
struct Opening {
    int dir;
    float at;
    float half = 60.f;  // 통로의 반폭. 넓히는 사람이 정한다
    float len = 0.f;    // 붙인 방의 크기: 뚫은 벽과 나란한 쪽. 0 이면 원래 방에 맞춘 기본 크기
    float deep = 0.f;   // 붙인 방의 크기: 벽에서 멀어지는 쪽. 0 이면 기본 크기
};
constexpr float kRoomMinLen = 200.f, kRoomMaxLen = 900.f;    // 붙인 방을 줄이고 늘릴 수 있는 범위
constexpr float kRoomMinDeep = 200.f, kRoomMaxDeep = 700.f;
constexpr float kWallHeight = 124.f;       // 방 뒤쪽 벽의 높이. 클라이언트의 WALL_HEIGHT 와 같다
constexpr float kOpeningHalf = 60.f;       // 폭을 정하지 않고 뚫을 때의 통로 반폭
constexpr float kOpeningMinHalf = 40.f;    // 가장 좁게 뚫을 수 있는 반폭
constexpr float kOpeningMargin = 20.f;     // 벽을 다 트지 않을 때 통로가 방 모서리에서 떨어져야 하는 거리
constexpr float kSideCorridor = 60.f;      // 좌우로 뚫은 통로의 길이 (두 방의 옆벽 두께)
constexpr float kFrontCorridor = 160.f;    // 위아래로 뚫은 통로의 길이 (뒷벽 높이보다 길어야 벽이 바닥을 덮지 않는다)
constexpr float kExpandSideW = 360.f;      // 좌우로 붙이는 방의 폭
constexpr float kExpandDepth = 300.f;      // 위아래로 붙이는 방의 깊이
constexpr float kExpandMaxW = 560.f;       // 위아래로 붙이는 방의 최대 폭
constexpr float kExpandMaxH = 440.f;       // 좌우로 붙이는 방의 최대 높이
constexpr float kOpeningEdge = 80.f;       // 통로 가운데가 방 모서리에서 떨어져야 하는 거리

// 구역 0은 야외, 1번부터는 집 내부다.
struct Zone {
    float w;
    float h;
    float doorX;
    float doorY;
    int building;  // 이 구역의 문이 이어지는 건물 번호. 야외는 -1
    int style;     // 내부 꾸밈 번호
    bool lighting = false;  // 조명을 조작할 수 있는 방인지
    int lightLevel = 100;   // 처음 밝기(%)
    std::vector<FloorRect> floors = {};  // 비어 있으면 구역 전체가 한 방이다
    float minX = 0.f, minY = 0.f;        // 구역의 왼쪽 위. 왼쪽이나 위로 넓힌 집은 음수가 된다
    // 넓힐 수 있는 집: 원래 방(들)과 크기. 원래 한 방이던 집은 넓힌 곳이 없으면 다시 한 방으로 그린다
    std::vector<FloorRect> base = {};
    float baseW = 0.f, baseH = 0.f;
    bool single = false;
    std::vector<Opening> openings = {};
};

class World {
public:
    World();

    const River& river() const { return river_; }
    int zoneCount() const { return static_cast<int>(zones_.size()); }
    const Zone& zone(int index) const { return zones_[static_cast<size_t>(index)]; }
    const std::vector<Seat>& seats() const { return seats_; }
    int pianoSeat() const { return pianoSeat_; }  // 피아노 의자의 자리 번호
    const std::vector<CatHome>& roomCats() const { return roomCats_; }
    const std::vector<Building>& buildings() const { return buildings_; }
    const std::string& mapJson() const { return mapJson_; }
    // 구역에 놓인 해당 종류의 첫 가구. 없으면 nullptr.
    const Furniture* findFurniture(int zone, const std::string& kind) const;
    // (x, y) 가 놓인 바닥. 방이 하나뿐인 구역이면 nullptr.
    const FloorRect* floorAt(int zone, float x, float y) const;
    // 켜고 끌 수 있는 조명이 손 닿는 곳에 있는지
    bool lampNear(int zone, float x, float y) const;
    bool hasTv(int zone) const;
    static bool isCinemaScreen(const std::string& kind) { return kind == "cinema_screen" || kind == "cinema_screen_big"; }
    int jazzZone() const { return jazzZone_; }
    int casinoZone() const { return casinoZone_; }
    int farmZone() const { return farmZone_; }
    // 농장의 밭 칸 가운데 (칸 번호 순서)
    const std::vector<Spot>& farmPlots() const { return farmPlots_; }
    // 카지노 빠칭코 기계 앞 의자의 자리 번호
    const std::vector<int>& pachinkoSeats() const { return pachinkoSeats_; }
    // 집(구역 1~3)의 문이 (x, y) 에서 손 닿는 곳에 있으면 그 집 구역, 아니면 -1
    int houseDoorNear(float x, float y, float reach) const;
    const std::vector<DecorSeed>& decorSeeds() const { return seeds_; }
    const std::vector<Furniture>& furniture() const { return furniture_; }

    // ---- 집 확장
    bool expandable(int zone) const { return zone > 0 && zone < zoneCount() && !zones_[static_cast<size_t>(zone)].base.empty(); }
    // 원래 방들 중 그 방향 맨 끝의 방. 그 방의 벽을 뚫는다
    const FloorRect& edgeRoom(int zone, int dir) const;
    static const FloorRect& edgeOf(const std::vector<FloorRect>& base, int dir);
    // 그 방향으로 at 에 뚫었을 때의 통로와 새 방
    static void expansionRects(const FloorRect& edge, int dir, float at, float half, FloorRect& corridor, FloorRect& room, float len = 0.f, float deep = 0.f);
    // 그 방향 벽에 낼 수 있는 가장 넓은 통로의 반폭 (벽 전체, 또는 붙는 방의 폭까지)
    static float maxOpeningHalf(const FloorRect& edge, int dir);
    // 뚫은 곳을 바꾸고 바닥, 벽, 충돌 영역을 다시 만든다
    // publish 가 false 면 맵 메시지를 다시 만들지 않는다 (뚫어 보고 되돌릴 때)
    void setOpenings(int zone, std::vector<Opening> openings, bool publish = true);
    // 문에서 (x, y) 까지 걸어갈 수 있는지
    bool canReach(int zone, float x, float y) const;
    // 고정 가구(벽 제외)와 놓은 가구의 충돌 영역을 따로 본다
    bool overlapsFixed(int zone, float x0, float y0, float x1, float y1) const;
    bool overlapsDecor(int zone, float x0, float y0, float x1, float y1) const;
    // floor 의 뒷벽 중 [x0, x1] 이 다른 바닥으로 뚫려 있는지 (벽걸이를 걸 수 없는 곳)
    bool wallCut(int zone, const FloorRect& floor, float x0, float x1) const;
    // 뚫은 벽 자리에 걸린 고정 장식인지 (벽을 뚫으면 숨긴다)
    static bool coversOpening(const Furniture& f, const FloorRect& edge, int dir, float at, float half);
    // 한 구역의 모습, 고정 충돌 영역과 고정 가구. 집을 넓히면 모두에게 보낸다
    std::string zoneJson(int zone) const;

    // 플레이어가 배치한 가구의 충돌 영역과 자리. 서버가 실행 중에 늘리고 줄인다.
    void addDecorSolid(int id, int zone, float x0, float y0, float x1, float y1);
    void removeDecorSolid(int id);
    bool overlapsSolid(int zone, float x0, float y0, float x1, float y1) const;
    int addDynamicSeat(const Seat& seat);
    void removeDynamicSeat(int index);
    // 문에서 걸어서 갈 수 있는 칸의 수. 가구가 길을 막는지 볼 때 쓴다.
    int reachableCells(int zone) const;

    // 플레이어 이동: 구역 경계, 강, 건물과 가구를 반영한다.
    void move(int zone, float& x, float& y, float nx, float ny) const;
    // 고양이 이동: 야외에서만 움직이고 다리를 건너지 않는다.
    void moveCat(float& x, float& y, float nx, float ny) const;

    bool blocked(int zone, float x, float y) const;
    // 저장된 위치에 다시 세워도 되는 곳인지
    bool standable(int zone, float x, float y) const;

private:
    void buildOverworld();
    void buildCafe();
    int addHouse(const std::string& name, int style, float x, float y, float roomW, float roomH);
    // 문으로 들어가는 건물과 그 안쪽 구역을 만든다. style 은 외형, roomStyle 은 내부의 꾸밈 번호다.
    int addPlace(const char* kind, const std::string& name, int style, float x, float y, float halfW, float back, float front,
                 float roomW, float roomH, int roomStyle);
    // 다른 건물 안(outside 구역)의 (doorX, doorY) 에 문이 난 방을 만든다. 마을에는 건물이 서지 않는다.
    int addAnnex(const char* kind, const std::string& name, int outside, float doorX, float doorY, float roomW, float roomH, int roomStyle);
    void furnishTheater(int zone);
    void furnishScreeningRoom(int zone);
    void furnishCasino(int zone);
    void furnishJazzBar(int zone);
    void furnishFarm(int zone);
    void furnishBrickHouse(int zone, float w, float h);
    void furnishCabin(int zone, float w, float h);
    void furnishLoftHouse(int zone);
    void carveRooms(int zone, std::vector<FloorRect> floors, float doorX, float doorY);
    void markExpandable(int zone);
    void appendZone(std::string& json, const Zone& z) const;

    void put(int zone, const char* kind, float x, float y, float halfW = 0.f, float depth = 0.f);
    void seed(int zone, const char* kind, float x, float y, int gen = 1);
    void seedFacing(int zone, const char* kind, float x, float y, float faceX, float faceY, int side);
    void addSeat(int zone, float x, float y, float faceX = 0.f, float faceY = 1.f, int side = 0);
    void addCafeTable(float x, float y);
    std::string buildJson() const;

    River river_;
    std::vector<Zone> zones_;
    std::vector<Building> buildings_;
    std::vector<Furniture> furniture_;
    std::vector<Solid> solids_;
    std::vector<Seat> seats_;
    std::vector<Spot> trees_;
    std::vector<Spot> lamps_;
    int pianoSeat_ = -1;
    int jazzZone_ = -1;
    int casinoZone_ = -1;
    int farmZone_ = -1;
    std::vector<Spot> farmPlots_;
    std::vector<int> pachinkoSeats_;
    std::vector<DecorSeed> seeds_;
    struct DecorSolid {
        int id;
        Solid solid;
    };
    std::vector<DecorSolid> decorSolids_;
    std::vector<CatHome> roomCats_;
    std::string mapJson_;
};
