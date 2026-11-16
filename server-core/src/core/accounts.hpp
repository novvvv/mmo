// 계정 저장소. 계정마다 파일 하나를 쓴다 (<데이터 폴더>/<아이디의 16진수>.acc).
// 비밀번호 원문은 어디에도 저장하지 않고 PBKDF2 결과만 저장한다.
// 파일은 "키=값" 줄의 모음이다. core 는 아이디, 비밀번호, 모양, 위치만 알고, 나머지 키는 모듈의 것이라
// 읽은 순서 그대로 extra 에 보관했다가 다시 쓴다. 모듈이 없는 서버도 다른 모듈의 값을 지우지 않는다.
#pragma once

#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

// 예전 저장 형식과 접속 명령의 색상(hue)을 그때 화면에 보이던 RGB 로 바꾼다.
int hueToRgb(int hue);
// 0xRRGGBB 를 "#rrggbb" 로. 음수면 빈 문자열.
std::string rgbToHex(int rgb);

struct Account {
    std::string id;
    std::string saltHex;
    std::string hashHex;
    int iterations = 0;

    std::string nick;
    int rgb = -1;  // 몸 색 0xRRGGBB. 아직 캐릭터를 만들지 않았으면 -1
    int arms = 1;
    int legs = 1;
    int limbColor = 0;

    int zone = 0;
    float x = -1.f;  // 저장된 위치가 없으면 음수
    float y = -1.f;
    int mapVersion = 1;  // 위치를 저장할 때의 마을 모양 (core/world.hpp 의 kMapVersion). 예전 넓은 맵은 1

    // 모듈들의 키와 값 (파일에 있던 순서). get 은 없으면 빈 문자열, set 은 있으면 그 자리를 바꾸고 없으면 뒤에 더한다
    std::vector<std::pair<std::string, std::string>> extra;
    const std::string& get(const std::string& key) const;
    bool has(const std::string& key) const;
    void set(const std::string& key, const std::string& value);
};

class AccountStore {
public:
    explicit AccountStore(std::string dir);

    // 폴더를 만들고 저장된 계정을 전부 읽는다. 폴더를 쓸 수 없으면 false.
    bool load();

    Account* find(const std::string& id);
    // 닉네임이 같은 계정들 (친구를 이름으로 찾을 때)
    std::vector<const Account*> withNick(const std::string& nick) const;
    Account& add(Account account);
    size_t size() const { return accounts_.size(); }

    std::string pathFor(const std::string& id) const;
    const std::string& dir() const { return dir_; }

    static std::string serialize(const Account& account);
    static bool parse(const std::string& content, Account& out);

    // 임시 파일에 쓴 뒤 이름을 바꿔, 중간에 죽어도 이전 파일이 온전히 남게 한다.
    static bool writeAtomic(const std::string& path, const std::string& content);

private:
    std::string dir_;
    std::unordered_map<std::string, Account> accounts_;
};
