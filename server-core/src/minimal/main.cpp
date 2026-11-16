// 모듈 없이 core 만으로 도는 최소 서버: 로그인, 입장, 이동, 문, 앉기, 채팅.
// 새 서버를 만들 때 이 파일을 복사해 시작하고, runServer 의 람다에서 core.addModule(...) 로 모듈을 더한다.
#include "core/app.hpp"

int main(int argc, char** argv) {
    return runServer(argc, argv, [](Core&) {});
}
