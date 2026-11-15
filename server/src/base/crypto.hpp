// 비밀번호 저장에 쓰는 SHA-256 / HMAC / PBKDF2. 외부 라이브러리 없이 쓰기 위한 최소 구현.
#pragma once

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>
#include <random>
#include <string>

namespace crypto {

class Sha256 {
public:
    using Digest = std::array<uint8_t, 32>;

    void update(const uint8_t* data, size_t len) {
        total_ += len;
        while (len > 0) {
            const size_t take = std::min(len, sizeof(buf_) - bufLen_);
            std::memcpy(buf_ + bufLen_, data, take);
            bufLen_ += take;
            data += take;
            len -= take;
            if (bufLen_ == sizeof(buf_)) {
                compress(buf_);
                bufLen_ = 0;
            }
        }
    }

    // 호출하면 내부 상태가 끝나므로, 이어서 쓸 상태는 미리 복사해 둔다.
    Digest finish() {
        const uint64_t bits = total_ * 8;
        const uint8_t pad = 0x80;
        update(&pad, 1);
        const uint8_t zero = 0;
        while (bufLen_ != 56) update(&zero, 1);
        uint8_t lenBytes[8];
        for (int i = 0; i < 8; ++i) lenBytes[i] = static_cast<uint8_t>(bits >> (56 - i * 8));
        update(lenBytes, 8);

        Digest out{};
        for (int i = 0; i < 8; ++i) {
            out[static_cast<size_t>(i) * 4] = static_cast<uint8_t>(h_[i] >> 24);
            out[static_cast<size_t>(i) * 4 + 1] = static_cast<uint8_t>(h_[i] >> 16);
            out[static_cast<size_t>(i) * 4 + 2] = static_cast<uint8_t>(h_[i] >> 8);
            out[static_cast<size_t>(i) * 4 + 3] = static_cast<uint8_t>(h_[i]);
        }
        return out;
    }

private:
    static uint32_t rotr(uint32_t v, int n) { return (v >> n) | (v << (32 - n)); }

    void compress(const uint8_t* block) {
        static constexpr uint32_t k[64] = {
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};

        uint32_t w[64];
        for (int i = 0; i < 16; ++i) {
            w[i] = (uint32_t(block[i * 4]) << 24) | (uint32_t(block[i * 4 + 1]) << 16) |
                   (uint32_t(block[i * 4 + 2]) << 8) | uint32_t(block[i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            const uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        uint32_t a = h_[0], b = h_[1], c = h_[2], d = h_[3], e = h_[4], f = h_[5], g = h_[6], h = h_[7];
        for (int i = 0; i < 64; ++i) {
            const uint32_t s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const uint32_t ch = (e & f) ^ (~e & g);
            const uint32_t t1 = h + s1 + ch + k[i] + w[i];
            const uint32_t s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            const uint32_t t2 = s0 + maj;
            h = g;
            g = f;
            f = e;
            e = d + t1;
            d = c;
            c = b;
            b = a;
            a = t1 + t2;
        }
        h_[0] += a;
        h_[1] += b;
        h_[2] += c;
        h_[3] += d;
        h_[4] += e;
        h_[5] += f;
        h_[6] += g;
        h_[7] += h;
    }

    uint32_t h_[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    uint8_t buf_[64] = {};
    size_t bufLen_ = 0;
    uint64_t total_ = 0;
};

// 32바이트 키를 만든다. HMAC 의 내부/외부 초기 상태를 복사해 쓰므로 반복이 빠르다.
inline std::string pbkdf2Sha256(const std::string& password, const std::string& salt, int iterations) {
    uint8_t key[64] = {};
    if (password.size() > sizeof(key)) {
        Sha256 hashed;
        hashed.update(reinterpret_cast<const uint8_t*>(password.data()), password.size());
        const auto digest = hashed.finish();
        std::memcpy(key, digest.data(), digest.size());
    } else {
        std::memcpy(key, password.data(), password.size());
    }

    uint8_t ipad[64], opad[64];
    for (size_t i = 0; i < sizeof(key); ++i) {
        ipad[i] = key[i] ^ 0x36;
        opad[i] = key[i] ^ 0x5c;
    }
    Sha256 inner, outer;
    inner.update(ipad, sizeof(ipad));
    outer.update(opad, sizeof(opad));

    const auto hmac = [&](const uint8_t* data, size_t len) {
        Sha256 in = inner;
        in.update(data, len);
        const auto innerDigest = in.finish();
        Sha256 out = outer;
        out.update(innerDigest.data(), innerDigest.size());
        return out.finish();
    };

    std::string first = salt;
    first.append("\0\0\0\1", 4);  // 첫 번째(이자 유일한) 블록 번호
    auto u = hmac(reinterpret_cast<const uint8_t*>(first.data()), first.size());
    auto t = u;
    for (int n = 1; n < iterations; ++n) {
        u = hmac(u.data(), u.size());
        for (size_t i = 0; i < t.size(); ++i) t[i] ^= u[i];
    }
    return std::string(reinterpret_cast<const char*>(t.data()), t.size());
}

inline std::string randomBytes(size_t count) {
    std::random_device device;
    std::string out(count, '\0');
    for (char& ch : out) ch = static_cast<char>(device() & 0xFF);
    return out;
}

inline std::string toHex(const std::string& bytes) {
    static const char* digits = "0123456789abcdef";
    std::string out;
    out.reserve(bytes.size() * 2);
    for (const unsigned char b : bytes) {
        out += digits[b >> 4];
        out += digits[b & 0x0F];
    }
    return out;
}

// 형식이 틀리면 빈 문자열.
inline std::string fromHex(const std::string& hex) {
    const auto value = [](char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        return -1;
    };
    if (hex.size() % 2 != 0) return "";
    std::string out;
    out.reserve(hex.size() / 2);
    for (size_t i = 0; i < hex.size(); i += 2) {
        const int hi = value(hex[i]), lo = value(hex[i + 1]);
        if (hi < 0 || lo < 0) return "";
        out += static_cast<char>((hi << 4) | lo);
    }
    return out;
}

// 일치하는 앞부분 길이가 처리 시간으로 드러나지 않게 전부 비교한다.
inline bool constantTimeEqual(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char diff = 0;
    for (size_t i = 0; i < a.size(); ++i) diff |= static_cast<unsigned char>(a[i] ^ b[i]);
    return diff == 0;
}

}  // namespace crypto
