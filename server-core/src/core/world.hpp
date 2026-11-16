// 게임 월드의 모습과 충돌: 강, 구역(마을과 건물 안), 건물, 고정 가구, 앉을 자리, 나무, 가로등.
// 같은 데이터를 입장할 때 클라이언트에 보내(map) 화면과 충돌 판정이 일치하게 한다.
// core 가 기본 마을(강, 나무, 가로등, 벤치)을 만들고, 모듈이 그 위에 건물을 짓고 꾸민 뒤 publish 로 지도를 만든다.
#pragma once

#include <functional>
#include <string>
#include <utility>
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
constexpr float kBedReach = 104.f;   // 침대에 누울 수 있는 거리
constexpr float kRestoreSearch = 240.f;  // 접속할 때 저장한 자리가 막혀 있으면 이만큼 안에서 빈 곳을 찾는다

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

// 여러 방이 복도로 이어진 구역의 바닥 하나. style 은 클라이언트의 ROOM_STYLES 번호다.
struct FloorRect {
    float x0, y0, x1, y1;
    int style;
};

// 집 확장: 원래 방(base) 바깥에 kExpandCell 크기의 칸을 칠해 바닥을 넓힌다. 칸 (cx, cy) 는 x cx*칸 ~ (cx+1)*칸 이다.
using Cell = std::pair<int, int>;
constexpr float kExpandCell = 20.f;        // 넓히는 칸 한 변
constexpr float kExpandReach = 800.f;      // 원래 방에서 이만큼까지 넓힐 수 있다
constexpr int kExpandMaxCells = 10000;     // 한 집에 칠할 수 있는 칸 수 (20px 칸이라 400만 px², 넓힐 수 있는 범위를 거의 다 채운다)
constexpr int kExpandMaxRects = 160;       // 바닥 모양이 너무 잘게 나뉘지 않게 (그리기와 충돌 계산이 무거워진다)
constexpr float kWallHeight = 124.f;       // 방 뒤쪽 벽의 높이. 클라이언트의 WALL_HEIGHT 와 같다

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
    std::vector<Cell> cells = {};   // 칠한 칸 (정렬됨)
};

class World {
public:
    World();

    const River& river() const { return river_; }
    int zoneCount() const { return static_cast<int>(zones_.size()); }
    const Zone& zone(int index) const { return zones_[static_cast<size_t>(index)]; }
    const std::vector<Seat>& seats() const { return seats_; }
    const std::vector<Building>& buildings() const { return buildings_; }
    const std::string& mapJson() const { return mapJson_; }
    // 구역에 놓인 해당 종류의 첫 가구. 없으면 nullptr.
    const Furniture* findFurniture(int zone, const std::string& kind) const;
    // (x, y) 가 놓인 바닥. 방이 하나뿐인 구역이면 nullptr.
    const FloorRect* floorAt(int zone, float x, float y) const;
    const std::vector<Furniture>& furniture() const { return furniture_; }

    // ---- 집 확장
    bool expandable(int zone) const { return zone > 0 && zone < zoneCount() && !zones_[static_cast<size_t>(zone)].base.empty(); }
    // 칸을 칠할 수 없는 이유 (원래 방과 걸침, 넓힐 수 있는 범위 밖, 문 앞). 칠할 수 있으면 nullptr
    const char* cellProblem(int zone, Cell cell) const;
    // 원래 방 안에 다 들어가는 칸인지
    bool baseCell(int zone, Cell cell) const;
    // 칠한 칸을 바꾸고 바닥, 벽, 충돌 영역을 다시 만든다. publish 가 false 면 지도를 다시 만들지 않는다
    void setCells(int zone, std::vector<Cell> cells, bool publish = true);
    // 칸들을 겹치지 않는 사각형으로 묶는다 (같은 줄의 이어진 칸 → 아래로 같은 폭이면 합침)
    static std::vector<FloorRect> mergeCells(const std::vector<Cell>& cells, int style);
    // 문에서 (x, y) 까지 걸어갈 수 있는지
    bool canReach(int zone, float x, float y) const;
    // 고정 가구(벽 제외)와 놓은 가구의 충돌 영역을 따로 본다
    bool overlapsFixed(int zone, float x0, float y0, float x1, float y1) const;
    bool overlapsDecor(int zone, float x0, float y0, float x1, float y1) const;
    // floor 의 뒷벽 중 [x0, x1] 이 다른 바닥에 가려지는지 (벽 높이 안에 다른 바닥이 있으면 벽걸이를 걸 수 없다)
    bool wallCut(int zone, const FloorRect& floor, float x0, float x1) const;
    // 사각형 전체가 바닥 위인지 (여러 바닥에 걸쳐도 된다)
    bool floorCovers(int zone, float x0, float y0, float x1, float y1) const;
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
    // (x, y) 에서 가장 가까운, maxDist 안의 설 수 있는 곳. 없으면 false
    bool nearestStandable(int zone, float x, float y, float maxDist, float& outX, float& outY) const;

    // ---- 짓기: 모듈이 서버를 켤 때(install) 쓴다. 다 지으면 core 가 publish 로 지도를 만든다
    // 구역 번호와 자리 번호는 만든 순서대로 붙고 저장 파일이 쓰므로, 한 번 정한 짓는 순서는 바꾸지 않는다.
    int addHouse(const std::string& name, int style, float x, float y, float roomW, float roomH);
    // 문으로 들어가는 건물과 그 안쪽 구역을 만든다. style 은 외형, roomStyle 은 내부의 꾸밈 번호다.
    int addPlace(const char* kind, const std::string& name, int style, float x, float y, float halfW, float back, float front,
                 float roomW, float roomH, int roomStyle);
    // 다른 건물 안(outside 구역)의 (doorX, doorY) 에 문이 난 방을 만든다. 마을에는 건물이 서지 않는다.
    int addAnnex(const char* kind, const std::string& name, int outside, float doorX, float doorY, float roomW, float roomH, int roomStyle);
    // 한 구역을 여러 방(floors)으로 나누고, 바닥이 아닌 곳을 벽으로 막는다
    void carveRooms(int zone, std::vector<FloorRect> floors, float doorX, float doorY);
    // 집 확장(벽을 뚫어 방 붙이기)을 할 수 있는 구역으로 표시한다
    void markExpandable(int zone);
    // 고정 가구 하나. halfW 가 0 보다 크면 x±halfW, y-depth ~ y 를 막는다
    void put(int zone, const char* kind, float x, float y, float halfW = 0.f, float depth = 0.f);
    void addSeat(int zone, float x, float y, float faceX = 0.f, float faceY = 1.f, int side = 0);
    void addFurniture(const Furniture& furniture);
    void addSolid(const Solid& solid);
    void addBuilding(const Building& building);
    Zone& zoneRef(int index) { return zones_[static_cast<size_t>(index)]; }
    // 지도(map 메시지) 끝에 모듈의 필드를 덧붙이는 함수
    void setExtraJson(std::function<void(std::string&)> extra) { extraJson_ = std::move(extra); }
    // 지금 모습으로 지도를 다시 만든다
    void publish();

private:
    void buildOverworld();
    void appendZone(std::string& json, const Zone& z) const;
    std::string buildJson() const;

    River river_;
    std::vector<Zone> zones_;
    std::vector<Building> buildings_;
    std::vector<Furniture> furniture_;
    std::vector<Solid> solids_;
    std::vector<Seat> seats_;
    size_t staticSeats_ = 0;   // 짓기로 만든 고정 자리 수. 그 뒤의 자리는 놓은 가구의 것(addDynamicSeat)이다
    std::vector<Spot> trees_;
    std::vector<Spot> lamps_;
    struct DecorSolid {
        int id;
        Solid solid;
    };
    std::vector<DecorSolid> decorSolids_;
    std::string mapJson_;
    std::function<void(std::string&)> extraJson_;
};
