// 서버 프로그램의 공통 main: 인자와 환경변수 읽기, 계정 읽기, 소켓 열기, 모듈 등록, 20Hz 루프, 끌 때 저장.
//
// 사용법: ./<서버> [port] [client_dir] [data_dir]
// core 의 환경변수: MMO_AUTH_ITERATIONS, MMO_SIGNUP_LIMIT, MMO_AUTH_PER_IP, MMO_MAX_CONN_PER_IP, MMO_HALF_CYCLE_SEC
#pragma once

#include "core/core.hpp"

#include <functional>

// 환경변수를 정수로 읽는다. 없으면 fallback
long envNumber(const char* name, long fallback);

// addModules 에서 core.addModule(...) 로 모듈을 등록한다. 모듈은 이 함수가 끝날 때까지 살아 있어야 한다.
int runServer(int argc, char** argv, const std::function<void(Core&)>& addModules);
