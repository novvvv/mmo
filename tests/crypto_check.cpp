// run.mjs 가 Node 의 crypto 결과와 비교하는 데 쓰는 작은 프로그램.
// 사용법: crypto_check <password hex> <salt hex> <iterations>
#include "../server-core/src/base/crypto.hpp"

#include <cstdlib>
#include <iostream>

int main(int argc, char** argv) {
    if (argc != 4) return 2;
    std::cout << crypto::toHex(crypto::pbkdf2Sha256(crypto::fromHex(argv[1]), crypto::fromHex(argv[2]), std::atoi(argv[3])))
              << std::endl;
    return 0;
}
