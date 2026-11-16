#include "core/app.hpp"

#include <algorithm>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <string>
#include <sys/stat.h>

namespace {

volatile std::sig_atomic_t gRunning = 1;
void onSignal(int) { gRunning = 0; }

}  // namespace

long envNumber(const char* name, long fallback) {
    const char* value = std::getenv(name);
    return value ? std::strtol(value, nullptr, 10) : fallback;
}

int runServer(int argc, char** argv, const std::function<void(Core&)>& addModules) {
    const int port = argc > 1 ? std::atoi(argv[1]) : 8080;
    const std::string staticDir = argc > 2 ? argv[2] : "../client";
    const std::string dataDir = argc > 3 ? argv[3] : "./data";

    struct stat st {};
    if (::stat((staticDir + "/index.html").c_str(), &st) != 0)
        std::cerr << "경고: " << staticDir << "/index.html 이 없습니다. "
                  << "사용법: " << argv[0] << " [port] [client_dir] [data_dir]" << std::endl;

    std::signal(SIGINT, onSignal);
    std::signal(SIGTERM, onSignal);

    CoreConfig config;
    config.authIterations = static_cast<int>(envNumber("MMO_AUTH_ITERATIONS", config.authIterations));
    config.signupLimitPerHour = static_cast<int>(envNumber("MMO_SIGNUP_LIMIT", config.signupLimitPerHour));
    config.halfCycleSec = static_cast<double>(envNumber("MMO_HALF_CYCLE_SEC", static_cast<long>(config.halfCycleSec)));
    config.authPerIp = static_cast<int>(envNumber("MMO_AUTH_PER_IP", config.authPerIp));

    // 소멸 순서: core → server → accounts → worker. worker 는 남은 저장 작업을 끝낸 뒤 종료한다.
    Worker worker;
    AccountStore accounts(dataDir);
    if (!accounts.load()) return 1;

    WsServer server(static_cast<uint16_t>(port), staticDir);
    if (!server.start()) return 1;
    server.setMaxConnectionsPerIp(static_cast<int>(envNumber("MMO_MAX_CONN_PER_IP", 16)));

    Core core(server, accounts, worker, config);
    addModules(core);
    core.start();
    server.onMessage = [&core](ConnId id, const std::string& msg) { core.onMessage(id, msg); };
    server.onClose = [&core](ConnId id) { core.onClose(id); };

    std::cout << "Mini MMO server: http://localhost:" << port << "  (static: " << staticDir << ", data: " << dataDir
              << ", accounts: " << accounts.size() << ")" << std::endl;

    using Clock = std::chrono::steady_clock;
    const auto tickDuration = std::chrono::microseconds(1'000'000 / kTickRate);
    auto nextTick = Clock::now();

    // 고정 틱 게임 루프: 다음 틱까지 남은 시간 동안 네트워크 이벤트를 처리한다.
    while (gRunning) {
        const auto now = Clock::now();
        if (now >= nextTick) {
            core.tick(1.0f / kTickRate);
            nextTick += tickDuration;
            if (now - nextTick > std::chrono::seconds(1)) nextTick = now + tickDuration;  // 크게 밀리면 리셋
        }
        const auto wait = std::chrono::ceil<std::chrono::milliseconds>(nextTick - Clock::now()).count();
        server.poll(static_cast<int>(std::max<long long>(0, wait)));
        worker.drain();
    }

    std::cout << "\nshutting down" << std::endl;
    worker.skipHeavyWork();  // Docker 가 강제 종료하기 전에 저장이 끝나도록 대기 중인 해시는 버린다
    core.saveAll();
    return 0;
}
