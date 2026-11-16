// 모듈 예시 서버: core(server-core) 위에 예시 모듈 하나를 올린다.
// 새 서버를 만들 때 이 폴더를 복사해 시작하고, 아래 람다에서 core.addModule(...) 로 모듈을 더한다. 등록한 순서대로 훅이 불린다.
//
// 사용법: ./hello_server [port] [client_dir] [data_dir]

#include "core/app.hpp"
#include "example.hpp"

int main(int argc, char** argv) {
    ExampleModule example;
    return runServer(argc, argv, [&](Core& core) {
        core.addModule(example);
    });
}
