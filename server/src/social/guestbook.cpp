// 방명록: 집마다 있고, 누구나 어디서든 남기고, 쓴 사람만 지운다.
#include "core/rules.hpp"

// 집마다 방명록이 있다. 누구나 어디서든 글을 남기고, 쓴 사람만 지운다. 글에는 쓸 때의 캐릭터 모양을 함께 남겨
// 작은 캐릭터(미니미)로 보여 준다. 창을 열어 둔 사람에게는 새 글이 바로 간다. 파일은 guestbook.list 하나다.

void Game::loadGuestbook() {
    std::ifstream file(accounts_.dir() + "/guestbook.list");
    std::string line;
    while (std::getline(file, line)) {
        const std::vector<std::string> f = splitTabs(line);
        long id = 0, zone = 0, time = 0, rgb = 0;
        if (f.size() < 7 || !parseWhole(f[0].c_str(), id) || !parseWhole(f[1].c_str(), zone) || !parseWhole(f[2].c_str(), time) || !isHouseZone(static_cast<int>(zone))) continue;
        GuestEntry entry;
        entry.id = id;
        entry.zone = static_cast<int>(zone);
        entry.time = time;
        entry.account = f[3];
        entry.name = text::sanitizeName(f[4]);
        entry.look = f[5];
        entry.text = text::sanitize(f[6], kGuestChars);
        if (entry.text.empty() || !parseWhole(entry.look.substr(0, entry.look.find(',')).c_str(), rgb)) continue;
        guestNext_ = std::max(guestNext_, id + 1);
        guestbook_.push_back(std::move(entry));
    }
}

void Game::saveGuestbook() {
    std::string content;
    for (const GuestEntry& e : guestbook_) {
        content += std::to_string(e.id) + "\t" + std::to_string(e.zone) + "\t" + std::to_string(e.time) + "\t" + e.account + "\t" + e.name + "\t" + e.look + "\t" + e.text + "\n";
    }
    worker_.post([path = accounts_.dir() + "/guestbook.list", content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

// {"t":"guest","z","n" 전체 글 수,"e":[[번호, 이름, 글, 쓴 때(유닉스 초), 모양 "rgb,팔,다리,팔다리색", 내 글이면 1], ...]} 새 글부터
std::string Game::guestJson(int zone, const std::string& viewer) const {
    std::string json;
    long total = 0;
    for (auto it = guestbook_.rbegin(); it != guestbook_.rend(); ++it) {
        if (it->zone != zone) continue;
        if (++total > static_cast<long>(kGuestSend)) continue;
        json += (json.empty() ? "[" : ",[") + std::to_string(it->id) + ",\"" + text::jsonEscape(it->name) + "\",\"" + text::jsonEscape(it->text) + "\"," +
                std::to_string(it->time) + ",\"" + it->look + "\"," + (it->account == viewer ? "1" : "0") + "]";
    }
    return "{\"t\":\"guest\",\"z\":" + std::to_string(zone) + ",\"n\":" + std::to_string(total) + ",\"e\":[" + json + "]}";
}

// {"t":"guestlast","p":[[구역, 가장 최근 글 번호], ...]} 모든 집. 화면은 본 번호와 비교해 새 글(N)을 띄운다
std::string Game::guestLastJson() const {
    std::string json;
    for (int zone = 1; zone < world_.zoneCount(); ++zone) {
        if (!isHouseZone(zone)) continue;
        long last = 0;
        for (const GuestEntry& e : guestbook_) {
            if (e.zone == zone) last = std::max(last, e.id);
        }
        json += (json.empty() ? "[" : ",[") + std::to_string(zone) + "," + std::to_string(last) + "]";
    }
    return "{\"t\":\"guestlast\",\"p\":[" + json + "]}";
}

void Game::sendGuestbook(int zone) {   // 그 집 방명록을 보고 있는 사람들에게 (내 글 표시가 사람마다 달라 따로 만든다)
    for (const auto& entry : players_) {
        if (entry.second.guestWatch == zone) server_.send(entry.first, guestJson(zone, entry.second.account));
    }
}

// "look <구역>" (창을 열거나 다른 집 탭을 고름), "close", "write <구역> <글>", "del <글 번호>"
void Game::guestCommand(ConnId id, Player& p, const std::string& arg) {
    std::istringstream in(arg);
    std::string action;
    in >> action;
    if (action == "close") {
        p.guestWatch = -1;
        return;
    }
    if (action == "look") {
        long zone = -1;
        in >> zone;
        if (in.fail() || !isHouseZone(static_cast<int>(zone))) return;
        p.guestWatch = static_cast<int>(zone);
        server_.send(id, guestJson(p.guestWatch, p.account));
        return;
    }
    if (!spendAction(p)) return;
    if (action == "write") {
        long zone = -1;
        in >> zone;
        std::string raw;
        std::getline(in >> std::ws, raw);
        const std::string message = text::sanitize(raw, kGuestChars);
        if (in.fail() && raw.empty()) return;
        if (!isHouseZone(static_cast<int>(zone)) || message.empty()) return;
        if (clock_ - p.guestAt < kGuestCooldown && p.guestAt > 0.0) {
            server_.send(id, systemMessage("방명록은 조금 있다가 다시 남겨 주세요."));
            return;
        }
        p.guestAt = clock_;
        char look[48];
        std::snprintf(look, sizeof(look), "%d,%d,%d,%d", p.rgb, p.arms, p.legs, p.limbColor);
        guestbook_.push_back({guestNext_++, static_cast<int>(zone), static_cast<long>(std::time(nullptr)), p.account, p.name, look, message});
        // 집마다 오래된 글부터 kGuestKeep 개만 남긴다
        long count = std::count_if(guestbook_.begin(), guestbook_.end(), [&](const GuestEntry& e) { return e.zone == zone; });
        for (auto it = guestbook_.begin(); count > static_cast<long>(kGuestKeep) && it != guestbook_.end();) {
            if (it->zone == zone) {
                it = guestbook_.erase(it);
                --count;
            } else {
                ++it;
            }
        }
        saveGuestbook();
        p.guestWatch = static_cast<int>(zone);
        sendGuestbook(static_cast<int>(zone));
        sendToAll(guestLastJson());
        const std::string house = world_.buildings()[static_cast<size_t>(world_.zone(static_cast<int>(zone)).building)].name;
        server_.send(id, systemMessage(house + "의 집 방명록에 글을 남겼어요."));
        for (const auto& entry : players_) {   // 그 집에 있는 사람들에게 알린다
            if (entry.first != id && entry.second.zone == zone) server_.send(entry.first, "{\"t\":\"guestnew\",\"z\":" + std::to_string(zone) + ",\"n\":\"" + text::jsonEscape(p.name) + "\"}");
        }
    } else if (action == "del") {
        long entryId = -1;
        in >> entryId;
        const auto it = std::find_if(guestbook_.begin(), guestbook_.end(), [&](const GuestEntry& e) { return e.id == entryId; });
        if (in.fail() || it == guestbook_.end() || it->account != p.account) return;   // 쓴 사람만 지운다
        const int zone = it->zone;
        guestbook_.erase(it);
        saveGuestbook();
        sendGuestbook(zone);
        sendToAll(guestLastJson());
    }
}
