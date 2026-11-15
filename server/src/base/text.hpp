// 사용자가 보낸 문자열을 안전하게 다루는 함수들.
#pragma once

#include <cstdint>
#include <string>

namespace text {

constexpr size_t kMaxNameChars = 12;
constexpr size_t kMinAccountChars = 2;
constexpr size_t kMaxAccountChars = 20;

// 바이트 위치 i 의 UTF-8 글자를 읽는다. 올바르지 않으면 false.
inline bool readUtf8(const std::string& raw, size_t i, size_t& len, uint32_t& cp) {
    const auto c = static_cast<unsigned char>(raw[i]);
    len = 0;
    cp = 0;
    if (c < 0x80) { len = 1; cp = c; }
    else if ((c >> 5) == 0x6) { len = 2; cp = c & 0x1F; }
    else if ((c >> 4) == 0xE) { len = 3; cp = c & 0x0F; }
    else if ((c >> 3) == 0x1E) { len = 4; cp = c & 0x07; }

    bool ok = len > 0 && i + len <= raw.size();
    for (size_t k = 1; ok && k < len; ++k) {
        const auto cc = static_cast<unsigned char>(raw[i + k]);
        if ((cc & 0xC0) != 0x80) ok = false;
        cp = (cp << 6) | (cc & 0x3F);
    }
    if (!ok) return false;
    if (len == 2) return cp >= 0x80;
    if (len == 3) return cp >= 0x800 && (cp < 0xD800 || cp > 0xDFFF);
    if (len == 4) return cp >= 0x10000 && cp <= 0x10FFFF;
    return true;
}

// 브로드캐스트해도 안전하게 정리한다.
// - 올바른 UTF-8 만 허용 (잘못된 바이트가 브로드캐스트되면 브라우저가 연결을 끊어버림)
// - 제어문자 제거, 앞뒤 공백 제거, 최대 maxChars 글자
inline std::string sanitize(const std::string& raw, size_t maxChars) {
    std::string out;
    size_t chars = 0;
    size_t i = 0;
    while (i < raw.size() && chars < maxChars) {
        size_t len = 0;
        uint32_t cp = 0;
        const bool ok = readUtf8(raw, i, len, cp) && !(len == 1 && (cp < 0x20 || cp == 0x7F));
        if (!ok) {
            ++i;
            continue;
        }
        out.append(raw, i, len);
        i += len;
        ++chars;
    }
    const auto b = out.find_first_not_of(' ');
    const auto e = out.find_last_not_of(' ');
    return (b == std::string::npos) ? "" : out.substr(b, e - b + 1);
}

// 이름은 매 틱 JSON에 그대로 들어가므로 따옴표와 백슬래시까지 제거해 둔다.
inline std::string sanitizeName(const std::string& raw) {
    std::string filtered;
    for (char ch : raw) {
        if (ch != '"' && ch != '\\') filtered += ch;
    }
    std::string out = sanitize(filtered, kMaxNameChars);
    return out.empty() ? "Player" : out;
}

// sanitize 를 거친 문자열을 JSON 문자열 값으로 넣을 수 있게 만든다 (제어문자는 이미 없음).
inline std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char ch : s) {
        if (ch == '"' || ch == '\\') out += '\\';
        out += ch;
    }
    return out;
}

// 계정 아이디: 2~20자의 한글, 영문, 숫자, _, -. 영문은 소문자로 통일한다. 형식이 틀리면 빈 문자열.
inline std::string normalizeAccountId(const std::string& raw) {
    std::string out;
    size_t chars = 0;
    for (size_t i = 0; i < raw.size();) {
        size_t len = 0;
        uint32_t cp = 0;
        if (!readUtf8(raw, i, len, cp)) return "";
        const bool ascii = (cp >= '0' && cp <= '9') || (cp >= 'a' && cp <= 'z') || (cp >= 'A' && cp <= 'Z') ||
                           cp == '_' || cp == '-';
        const bool hangul = (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0x3131 && cp <= 0x318E);
        if (!ascii && !hangul) return "";
        if (cp >= 'A' && cp <= 'Z') out += static_cast<char>(cp - 'A' + 'a');
        else out.append(raw, i, len);
        i += len;
        ++chars;
    }
    return (chars >= kMinAccountChars && chars <= kMaxAccountChars) ? out : "";
}

}  // namespace text
