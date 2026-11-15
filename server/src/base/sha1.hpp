// WebSocket 핸드셰이크(Sec-WebSocket-Accept)에 필요한 SHA-1 + Base64.
// 외부 라이브러리 없이 쓰기 위한 최소 구현.
#pragma once

#include <cstdint>
#include <string>

namespace util {

// 20바이트 raw digest를 반환한다.
inline std::string sha1(const std::string& input) {
    uint32_t h[5] = {0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0};

    std::string msg = input;
    const uint64_t bitLen = static_cast<uint64_t>(input.size()) * 8;
    msg.push_back(static_cast<char>(0x80));
    while (msg.size() % 64 != 56) msg.push_back('\0');
    for (int i = 7; i >= 0; --i) msg.push_back(static_cast<char>((bitLen >> (i * 8)) & 0xFF));

    auto rol = [](uint32_t v, int n) { return (v << n) | (v >> (32 - n)); };
    auto byteAt = [&msg](size_t i) { return static_cast<uint32_t>(static_cast<uint8_t>(msg[i])); };

    for (size_t chunk = 0; chunk < msg.size(); chunk += 64) {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i) {
            const size_t p = chunk + i * 4;
            w[i] = (byteAt(p) << 24) | (byteAt(p + 1) << 16) | (byteAt(p + 2) << 8) | byteAt(p + 3);
        }
        for (int i = 16; i < 80; ++i) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

        uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
        for (int i = 0; i < 80; ++i) {
            uint32_t f, k;
            if (i < 20)      { f = (b & c) | (~b & d);           k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d;                    k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d);  k = 0x8F1BBCDC; }
            else             { f = b ^ c ^ d;                    k = 0xCA62C1D6; }
            const uint32_t temp = rol(a, 5) + f + e + k + w[i];
            e = d; d = c; c = rol(b, 30); b = a; a = temp;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
    }

    std::string out;
    for (uint32_t v : h)
        for (int i = 3; i >= 0; --i) out.push_back(static_cast<char>((v >> (i * 8)) & 0xFF));
    return out;
}

inline std::string base64(const std::string& in) {
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    size_t i = 0;
    auto b = [&in](size_t idx) { return static_cast<uint32_t>(static_cast<uint8_t>(in[idx])); };
    for (; i + 2 < in.size(); i += 3) {
        const uint32_t n = (b(i) << 16) | (b(i + 1) << 8) | b(i + 2);
        out += tbl[(n >> 18) & 63];
        out += tbl[(n >> 12) & 63];
        out += tbl[(n >> 6) & 63];
        out += tbl[n & 63];
    }
    const size_t rem = in.size() - i;
    if (rem == 1) {
        const uint32_t n = b(i) << 16;
        out += tbl[(n >> 18) & 63];
        out += tbl[(n >> 12) & 63];
        out += "==";
    } else if (rem == 2) {
        const uint32_t n = (b(i) << 16) | (b(i + 1) << 8);
        out += tbl[(n >> 18) & 63];
        out += tbl[(n >> 12) & 63];
        out += tbl[(n >> 6) & 63];
        out += '=';
    }
    return out;
}

}  // namespace util
