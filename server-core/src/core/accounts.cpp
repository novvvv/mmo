#include "core/accounts.hpp"

#include "base/crypto.hpp"

#include <dirent.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cctype>
#include <cerrno>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace {

const char* kExtension = ".acc";

bool endsWith(const std::string& s, const std::string& suffix) {
    return s.size() >= suffix.size() && s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
}

// 폴더를 부모까지 만든다.
bool makeDirs(const std::string& dir) {
    for (size_t i = 1; i <= dir.size(); ++i) {
        if (i != dir.size() && dir[i] != '/') continue;
        const std::string part = dir.substr(0, i);
        if (::mkdir(part.c_str(), 0700) != 0 && errno != EEXIST) return false;
    }
    return true;
}

}  // namespace

int hueToRgb(int hue) {
    constexpr double kSaturation = 0.70, kLightness = 0.58;  // 예전 캐릭터 몸 색 hsl(hue, 70%, 58%)
    const double chroma = (1.0 - std::fabs(2.0 * kLightness - 1.0)) * kSaturation;
    const double sector = hue / 60.0;
    const double middle = chroma * (1.0 - std::fabs(std::fmod(sector, 2.0) - 1.0));
    double r = 0.0, g = 0.0, b = 0.0;
    switch (static_cast<int>(sector) % 6) {
        case 0: r = chroma; g = middle; break;
        case 1: r = middle; g = chroma; break;
        case 2: g = chroma; b = middle; break;
        case 3: g = middle; b = chroma; break;
        case 4: r = middle; b = chroma; break;
        default: r = chroma; b = middle; break;
    }
    const double base = kLightness - chroma / 2.0;
    const auto channel = [base](double value) { return static_cast<int>(std::lround((value + base) * 255.0)); };
    return (channel(r) << 16) | (channel(g) << 8) | channel(b);
}

std::string rgbToHex(int rgb) {
    if (rgb < 0) return "";
    char hex[12];
    std::snprintf(hex, sizeof(hex), "#%06x", static_cast<unsigned>(rgb) & 0xFFFFFFu);
    return hex;
}

AccountStore::AccountStore(std::string dir) : dir_(std::move(dir)) {}

std::string AccountStore::pathFor(const std::string& id) const {
    // 아이디를 16진수로 바꿔 파일 이름에 경로 문자가 들어갈 수 없게 한다.
    return dir_ + "/" + crypto::toHex(id) + kExtension;
}

bool AccountStore::load() {
    if (!makeDirs(dir_)) {
        std::perror(("데이터 폴더를 만들 수 없습니다: " + dir_).c_str());
        return false;
    }
    DIR* handle = ::opendir(dir_.c_str());
    if (!handle) {
        std::perror(("데이터 폴더를 열 수 없습니다: " + dir_).c_str());
        return false;
    }
    while (const dirent* entry = ::readdir(handle)) {
        const std::string name = entry->d_name;
        if (!endsWith(name, kExtension)) continue;
        std::ifstream file(dir_ + "/" + name, std::ios::binary);
        std::ostringstream content;
        content << file.rdbuf();
        Account account;
        if (parse(content.str(), account)) {
            std::string key = account.id;
            accounts_.emplace(std::move(key), std::move(account));
        } else {
            std::cerr << "경고: 계정 파일을 읽지 못해 건너뜁니다: " << name << std::endl;
        }
    }
    ::closedir(handle);
    return true;
}

Account* AccountStore::find(const std::string& id) {
    const auto it = accounts_.find(id);
    return it == accounts_.end() ? nullptr : &it->second;
}

std::vector<const Account*> AccountStore::withNick(const std::string& nick) const {
    std::vector<const Account*> out;
    for (const auto& entry : accounts_) {
        if (entry.second.nick == nick) out.push_back(&entry.second);
    }
    return out;
}

Account& AccountStore::add(Account account) {
    std::string key = account.id;
    return accounts_[std::move(key)] = std::move(account);
}

namespace {
// core 가 직접 읽는 키. 나머지는 모두 extra 로 간다
bool coreKey(const std::string& key) {
    static const char* const kKeys[] = {"v", "id", "salt", "iter", "hash", "nick", "rgb", "hue", "arms", "legs", "limb", "map", "zone", "x", "y"};
    for (const char* k : kKeys) {
        if (key == k) return true;
    }
    return false;
}
}  // namespace

const std::string& Account::get(const std::string& key) const {
    static const std::string kEmpty;
    for (const auto& entry : extra) {
        if (entry.first == key) return entry.second;
    }
    return kEmpty;
}

bool Account::has(const std::string& key) const {
    for (const auto& entry : extra) {
        if (entry.first == key) return true;
    }
    return false;
}

void Account::set(const std::string& key, const std::string& value) {
    for (auto& entry : extra) {
        if (entry.first == key) {
            entry.second = value;
            return;
        }
    }
    extra.emplace_back(key, value);
}

std::string AccountStore::serialize(const Account& a) {
    std::ostringstream out;
    out << "v=1\n"
        << "id=" << a.id << "\n"
        << "salt=" << a.saltHex << "\n"
        << "iter=" << a.iterations << "\n"
        << "hash=" << a.hashHex << "\n"
        << "nick=" << a.nick << "\n"
        << "rgb=" << a.rgb << "\n"
        << "arms=" << a.arms << "\n"
        << "legs=" << a.legs << "\n"
        << "limb=" << a.limbColor << "\n";
    for (const auto& entry : a.extra) out << entry.first << "=" << entry.second << "\n";
    // 위치는 float 를 그대로 되살릴 수 있는 자릿수로 쓴다. 물가에 딱 붙은 좌표가 반올림되면 물 안으로 판정된다.
    out << "map=" << a.mapVersion << "\n";
    out << "zone=" << a.zone << "\n"
        << std::setprecision(9) << "x=" << a.x << "\n"
        << "y=" << a.y << "\n";
    return out.str();
}

bool AccountStore::parse(const std::string& content, Account& out) {
    std::istringstream lines(content);
    std::string line;
    while (std::getline(lines, line)) {
        const auto eq = line.find('=');
        if (eq == std::string::npos) continue;
        const std::string key = line.substr(0, eq);
        const std::string value = line.substr(eq + 1);
        const int number = std::atoi(value.c_str());

        if (!coreKey(key)) out.set(key, value);
        else if (key == "id") out.id = value;
        else if (key == "salt") out.saltHex = value;
        else if (key == "iter") out.iterations = number;
        else if (key == "hash") out.hashHex = value;
        else if (key == "nick") out.nick = value;
        else if (key == "rgb") out.rgb = number;
        else if (key == "hue") { if (number >= 0 && out.rgb < 0) out.rgb = hueToRgb(number); }  // 예전 계정 파일
        else if (key == "arms") out.arms = number;
        else if (key == "legs") out.legs = number;
        else if (key == "limb") out.limbColor = number;
        else if (key == "zone") out.zone = number;
        else if (key == "map") out.mapVersion = number;
        else if (key == "x") out.x = static_cast<float>(std::atof(value.c_str()));
        else if (key == "y") out.y = static_cast<float>(std::atof(value.c_str()));
    }
    return !out.id.empty() && !out.saltHex.empty() && !out.hashHex.empty() && out.iterations > 0;
}

bool AccountStore::writeAtomic(const std::string& path, const std::string& content) {
    const std::string temp = path + ".tmp";
    const int fd = ::open(temp.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (fd < 0) {
        std::perror("계정 저장 실패(open)");
        return false;
    }
    size_t written = 0;
    bool ok = true;
    while (ok && written < content.size()) {
        const ssize_t n = ::write(fd, content.data() + written, content.size() - written);
        if (n > 0) written += static_cast<size_t>(n);
        else if (n < 0 && errno == EINTR) continue;
        else ok = false;
    }
    if (ok) ok = ::fsync(fd) == 0;
    ::close(fd);
    if (ok) ok = ::rename(temp.c_str(), path.c_str()) == 0;
    if (!ok) {
        std::perror("계정 저장 실패");
        ::unlink(temp.c_str());
    }
    return ok;
}
