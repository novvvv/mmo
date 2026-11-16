// 서버의 뼈대: 접속과 로그인, 입장과 퇴장, 이동과 문, 앉기, 채팅, 매 틱의 위치 전송, 자동 저장.
// 서버 권한(authoritative) 방식: 클라이언트는 입력만 보내고, 위치와 결과는 서버가 계산한다.
// 콘텐츠는 Module 로 만들어 addModule 로 등록한다. core 는 콘텐츠를 모르고, 정해진 자리(module.hpp)에서 모듈을 부를 뿐이다.
#pragma once

#include "base/worker.hpp"
#include "base/ws_server.hpp"
#include "core/accounts.hpp"
#include "core/module.hpp"
#include "core/player.hpp"
#include "core/world.hpp"

#include <functional>
#include <memory>
#include <random>
#include <string>
#include <unordered_map>
#include <vector>

constexpr int kTickRate = 20;  // 초당 틱 수

struct CoreConfig {
    int authIterations = 600000;  // PBKDF2 반복 횟수 (OWASP 권장값)
    int signupLimitPerHour = 10;  // IP 하나가 한 시간에 만들 수 있는 계정 수
    int authPerIp = 3;            // IP 하나가 동시에 처리할 수 있는 로그인 수
    double halfCycleSec = 1800.0; // 낮 또는 밤이 이어지는 시간
};

class Core {
public:
    using PlayerMap = std::unordered_map<ConnId, std::unique_ptr<PlayerBase>>;
    // 명령 하나를 처리하는 함수: (보낸 연결, 보낸 플레이어, 명령 뒤의 글자 전체)
    using Command = std::function<void(ConnId, PlayerBase&, const std::string&)>;

    Core(WsServer& server, AccountStore& accounts, Worker& worker, const CoreConfig& config);

    // ---- 켜기: 모듈을 모두 등록한 뒤 start 를 부른다
    void addModule(Module& module);
    // 입장한 플레이어의 명령. core 의 명령(login, resume, join, in, use, chat)과 같은 이름은 쓸 수 없다
    void addCommand(const std::string& name, Command command);
    void start();

    // ---- 네트워크와 루프 (main.cpp 가 부른다)
    void onMessage(ConnId id, const std::string& msg);
    void onClose(ConnId id);
    void tick(float dt);
    void saveAll();

    // ---- 모듈이 쓰는 것
    WsServer& server() { return server_; }
    AccountStore& accounts() { return accounts_; }
    Worker& worker() { return worker_; }
    World& world() { return world_; }
    const CoreConfig& config() const { return config_; }
    const double& clock() const { return clock_; }   // 서버를 켠 뒤 지난 초 (틱마다 늘어난다)
    PlayerMap& players() { return players_; }
    PlayerBase* player(ConnId id);
    // 그 계정이 지금 월드에 있으면 그 플레이어 (idOut 에 연결 번호), 아니면 nullptr
    PlayerBase* onlinePlayer(const std::string& account, ConnId* idOut = nullptr);

    void moveToZone(ConnId id, PlayerBase& p, int zone, float x, float y);
    void standUp(PlayerBase& p);
    bool seatTaken(int seat) const;
    // 플레이어를 계정에 옮겨 적고 파일에 쓴다 (작업 스레드에서)
    void syncAccount(PlayerBase& p);
    void persist(const Account& account);

    void sendToAll(const std::string& json);
    void sendToZone(int zone, const std::string& json);
    static std::string systemMessage(const std::string& message);
    std::string timeJson() const;

private:
    struct Session {
        std::string account;  // 로그인에 성공한 계정. 비어 있으면 로그인 전
        bool authPending = false;
        int failures = 0;
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

    // 로그인 (session.cpp)
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

    // 입장 (session.cpp)
    void join(ConnId id, const std::string& arg);
    void placePlayer(PlayerBase& p, const Account& account);

    // 이동과 자리 (movement.cpp)
    void setInput(PlayerBase& p, uint8_t mask);
    void use(ConnId id, PlayerBase& p, const std::string& arg);
    bool tryDoor(ConnId id, PlayerBase& p);
    void toggleSit(PlayerBase& p);
    bool holdStill(const PlayerBase& p) const;
    void cancelHold(PlayerBase& p);

    // 채팅 (chat.cpp)
    void chat(ConnId id, PlayerBase& p, const std::string& raw);

    // 보내기 (send.cpp)
    void enterRoom(ConnId id, int zone);
    void broadcastState();

    WsServer& server_;
    AccountStore& accounts_;
    Worker& worker_;
    CoreConfig config_;
    World world_;
    std::mt19937 rng_;
    std::vector<Module*> modules_;
    std::unordered_map<std::string, Command> commands_;

    PlayerMap players_;
    std::unordered_map<ConnId, Session> sessions_;
    std::unordered_map<std::string, ConnId> online_;  // 계정 → 현재 접속 연결
    std::unordered_map<std::string, SignupWindow> signups_;
    std::unordered_map<std::string, LoginLock> loginLocks_;  // "IP|아이디" → 잠금 상태
    std::unordered_map<std::string, int> authByIp_;          // IP → 처리 중인 로그인 수
    std::string resumeKey_;  // 이어 들어오기 표의 서명 열쇠. 데이터 폴더에 남겨 서버를 다시 켜도 그대로 쓴다

    double clock_ = 0.0;     // 서버 시작 후 경과 시간(초)
    unsigned long tickCount_ = 0;   // state 메시지의 틱 번호. 화면이 다른 사람의 움직임을 고르게 그리는 데 쓴다
    int authInFlight_ = 0;
    float autosaveTimer_ = 0.f;
    float timeSyncTimer_ = 0.f;
};
