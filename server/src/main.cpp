// 이 게임 서버의 진입점: core(server-core) 위에 이 게임의 콘텐츠 모듈(Game)을 올린다.
//
// 사용법: ./mmo_server [port] [client_dir] [data_dir]
// core 의 환경변수는 server-core/src/core/app.hpp, 이 게임의 환경변수: MMO_REST_SEC, MMO_FOCUS_MINUTE_SEC, MMO_CAT_NAP, MMO_CAT_FURNITURE, MMO_FARM_SPEED

#include "core/app.hpp"
#include "game/game.hpp"

#include <algorithm>
#include <memory>

int main(int argc, char** argv) {
    GameConfig config;
    config.restSec = static_cast<double>(envNumber("MMO_REST_SEC", static_cast<long>(config.restSec)));
    config.farmSpeed = static_cast<int>(std::max(1L, envNumber("MMO_FARM_SPEED", config.farmSpeed)));
    config.catNapPercent = static_cast<int>(envNumber("MMO_CAT_NAP", config.catNapPercent));
    config.catFurniturePercent = static_cast<int>(envNumber("MMO_CAT_FURNITURE", config.catFurniturePercent));
    config.focusMinuteSec = static_cast<double>(envNumber("MMO_FOCUS_MINUTE_SEC", static_cast<long>(config.focusMinuteSec)));

    std::unique_ptr<Game> game;
    return runServer(argc, argv, [&](Core& core) {
        game = std::make_unique<Game>(core, config);
        core.addModule(*game);
    });
}
