// 방 안의 공용 물건: 조명과 스탠드, 피아노, TV 와 화면 공유, 레코드판. 집뿐 아니라 극장과 재즈바에서도 쓴다.
#include "game/rules.hpp"

// ------------------------------------------------------------ 방 조명: 방 전체의 불, 스탠드, 밝기. 같은 방의 모두에게 같게 보인다.

bool Game::tryLamp(ConnId id, Player& p) {
    if (!world_.zone(p.zone).lighting) return false;
    if (!lampNear(p.zone, p.x, p.y)) return false;
    RoomLight next = lights_[static_cast<size_t>(p.zone)];
    next.lamp = !next.lamp;
    changeLight(id, p, next);
    return true;
}

// "<room|lamp|level> <값>": 방 안 어디서나 아이템창으로 조명을 바꾼다.
void Game::setLight(ConnId id, Player& p, const std::string& arg) {
    if (!world_.zone(p.zone).lighting) return;
    const auto sp = arg.find(' ');
    if (sp == std::string::npos) return;
    const std::string key = arg.substr(0, sp);
    long value = 0;
    if (!parseWhole(arg.c_str() + sp + 1, value)) return;

    RoomLight next = lights_[static_cast<size_t>(p.zone)];
    if (key == "room" && (value == 0 || value == 1)) next.on = value == 1;
    else if (key == "lamp" && (value == 0 || value == 1)) next.lamp = value == 1;
    else if (key == "level") next.level = clampInt(value, kLightLevelMin, kLightLevelMax);
    else return;
    changeLight(id, p, next);
}

void Game::changeLight(ConnId id, Player& p, const RoomLight& next) {
    RoomLight& light = lights_[static_cast<size_t>(p.zone)];
    if (next.on == light.on && next.lamp == light.lamp && next.level == light.level) return;
    if (p.lightTokens < 1.f) {
        server_.send(id, lightJson(p.zone));  // 거절해도 보낸 사람의 스위치와 슬라이더를 실제 상태로 맞춘다
        return;
    }
    p.lightTokens -= 1.f;
    light = next;
    sendToZone(p.zone, lightJson(p.zone));
}

std::string Game::lightJson(int zone) const {
    const RoomLight& light = lights_[static_cast<size_t>(zone)];
    return std::string("{\"t\":\"light\",\"on\":") + (light.on ? "true" : "false") + ",\"lamp\":" +
           (light.lamp ? "true" : "false") + ",\"lv\":" + std::to_string(light.level) + "}";
}

bool Game::lampNear(int zone, float x, float y) const {
    if (town_.lampNear(zone, x, y)) return true;
    return std::any_of(decor_.begin(), decor_.end(), [=](const Decor& item) {
        const std::string kind = decor::kCatalog[item.kind].kind;
        return item.zone == zone && (kind == "floor_lamp" || kind == "lantern_lamp") && std::hypot(item.x - x, item.y - y) <= kLampReach;
    });
}

// ------------------------------------------------------------ 피아노: 의자에 앉은 사람이 친 건반을 같은 방에 전한다.

// "<건반 번호>": 피아노 의자에 앉은 사람만 칠 수 있다. 친 사람은 이미 들었으므로 나머지 사람에게만 보낸다.
void Game::playNote(ConnId id, Player& p, const std::string& arg) {
    if (p.seat < 0 || p.seat != town_.pianoSeat()) return;
    long note = 0;
    if (!parseWhole(arg.c_str(), note) || note < 0 || note >= kPianoNotes) return;
    if (p.noteTokens < 1.f) return;
    p.noteTokens -= 1.f;
    const std::string json = "{\"t\":\"note\",\"id\":" + std::to_string(id) + ",\"n\":" + std::to_string(note) + "}";
    for (const auto& entry : players_) {
        if (entry.first != id && entry.second.zone == p.zone) server_.send(entry.first, json);
    }
}

// ------------------------------------------------------------ 방의 TV 와 화면 공유: 서버는 영상 ID 와 재생 위치만 기억하고, 화면 공유는 연결 정보만 전한다.

// "play <영상 ID>", "reel <릴스 코드>", "pause", "resume", "seek <초>", "stop", "end <영상 ID>". 방 안의 누구나 조작할 수 있다.
void Game::controlTv(ConnId id, Player& p, const std::string& arg) {
    if (!roomHasTv(p.zone)) return;
    const auto sp = arg.find(' ');
    const std::string action = arg.substr(0, sp);
    const std::string value = sp == std::string::npos ? "" : arg.substr(sp + 1);
    RoomTv& tv = tvs_[static_cast<size_t>(p.zone)];
    RoomTv next = tv;

    if (action == "play") {
        const bool valid = value.size() == kYoutubeIdLength && std::all_of(value.begin(), value.end(), [](unsigned char c) {
            return std::isalnum(c) || c == '_' || c == '-';
        });
        if (!valid) return;
        next = RoomTv{};   // 화면 공유 중이었으면 그것도 끝난다
        next.video = value;
        next.since = clock_;
    } else if (action == "reel") {
        const bool valid = value.size() >= kReelCodeMin && value.size() <= kReelCodeMax && std::all_of(value.begin(), value.end(), [](unsigned char c) {
            return std::isalnum(c) || c == '_' || c == '-';
        });
        if (!valid) return;
        next = RoomTv{};
        next.video = value;
        next.reel = true;
        next.since = clock_;
    } else if (action == "share") {  // 내 화면을 이 방의 TV 에 띄운다. 영상은 서버를 거치지 않는다
        next = RoomTv{};
        next.video = "@share";
        next.since = clock_;
        next.sharer = id;
        next.sharerName = p.name;
    } else if (tv.video.empty()) {
        return;
    } else if ((tv.reel || tv.sharer) && action != "stop") {
        return;
    } else if (action == "pause") {
        if (tv.paused) return;
        next.pos = tvPosition(tv);
        next.paused = true;
    } else if (action == "resume") {
        if (!tv.paused) return;
        next.since = clock_;
        next.paused = false;
    } else if (action == "seek") {
        char* end = nullptr;
        const double seconds = std::strtod(value.c_str(), &end);
        if (end == value.c_str() || *end != '\0' || !(seconds >= 0.0)) return;
        next.pos = std::min(seconds, kTvMaxSeconds);
        next.since = clock_;
    } else if (action == "stop") {
        next = RoomTv{};
    } else if (action == "end") {  // 영상이 끝났다는 클라이언트의 알림. 그 사이 다른 영상으로 바뀌었으면 무시한다
        if (value != tv.video) return;
        next = RoomTv{};
    } else {
        return;
    }

    if (p.tvTokens < 1.f) {
        server_.send(id, tvJson(p.zone));  // 거절해도 보낸 사람의 화면을 실제 상태로 맞춘다
        return;
    }
    p.tvTokens -= 1.f;
    tv = next;
    sendToZone(p.zone, tvJson(p.zone));
    if (action == "play" || action == "reel") sendToZone(p.zone, systemMessage(p.name + "님이 TV를 틀었습니다."));
    if (action == "share") sendToZone(p.zone, systemMessage(p.name + "님이 화면 공유를 시작했습니다."));
    if (action == "stop") sendToZone(p.zone, systemMessage(p.name + "님이 TV를 껐습니다."));
}

void Game::relayRtc(ConnId id, const Player& p, const std::string& arg) {
    char* end = nullptr;
    const unsigned long to = std::strtoul(arg.c_str(), &end, 10);
    if (end == arg.c_str() || *end != ' ' || to == id) return;
    const std::string data(end + 1);
    if (data.empty() || std::any_of(data.begin(), data.end(), [](unsigned char c) { return c < 0x20; })) return;
    const ConnId sharer = tvs_[static_cast<size_t>(p.zone)].sharer;
    if (!sharer || (sharer != id && sharer != to)) return;   // 공유하는 사람과 그 방에서 보는 사람 사이에서만
    const auto other = players_.find(static_cast<ConnId>(to));
    if (other == players_.end() || other->second.zone != p.zone) return;
    server_.send(other->first, "{\"t\":\"rtc\",\"from\":" + std::to_string(id) + ",\"d\":\"" + text::jsonEscape(data) + "\"}");
}

void Game::endShareBy(ConnId id, int zone) {
    RoomTv& tv = tvs_[static_cast<size_t>(zone)];
    if (tv.sharer != id) return;
    tv = RoomTv{};
    sendToZone(zone, tvJson(zone));
}

bool Game::roomHasTv(int zone) const {
    if (town_.hasTv(zone)) return true;
    return std::any_of(decor_.begin(), decor_.end(), [zone](const Decor& item) {
        return item.zone == zone && (std::string(decor::kCatalog[item.kind].kind) == "tv" || std::string(decor::kCatalog[item.kind].kind) == "tv_wall");
    });
}

double Game::tvPosition(const RoomTv& tv) const {
    return tv.paused ? tv.pos : tv.pos + (clock_ - tv.since);
}

std::string Game::tvJson(int zone) const {
    const RoomTv& tv = tvs_[static_cast<size_t>(zone)];
    char position[32];
    std::snprintf(position, sizeof(position), "%.2f", tvPosition(tv));
    return "{\"t\":\"tv\",\"v\":\"" + tv.video + "\",\"reel\":" + (tv.reel ? "true" : "false") + ",\"pos\":" + position + ",\"paused\":" + (tv.paused ? "true" : "false") +
           (tv.sharer ? ",\"share\":" + std::to_string(tv.sharer) + ",\"sn\":\"" + text::jsonEscape(tv.sharerName) + "\"" : "") + "}";
}

// ------------------------------------------------------------ 레코드판: 재즈바와, 레코드 플레이어를 놓은 집마다 하나씩. 곡 목록을 차례로 끝없이 튼다.

// 재즈바는 처음부터 레코드판이 있고, 집은 레코드 플레이어 가구를 놓은 동안에만 있다.
bool Game::hasRecord(int zone) const {
    if (zone == town_.jazzZone()) return true;
    return std::any_of(decor_.begin(), decor_.end(), [zone](const Decor& item) { return item.zone == zone && item.kind == decor::kRecordPlayer; });
}

// 등록한 곡은 파일에 남겨 서버를 다시 시작해도 그대로 튼다. 한 줄에 "<영상 ID>\t<제목>".
// 재즈바는 예전부터 쓰던 jazz.list, 집은 record<구역 번호>.list 다.
std::string Game::recordPath(int zone) const {
    return accounts_.dir() + (zone == town_.jazzZone() ? std::string("/jazz.list") : "/record" + std::to_string(zone) + ".list");
}

void Game::loadJazz() {
    for (int zone = 1; zone < world_.zoneCount(); ++zone) {
        if (zone != town_.jazzZone() && !isHouseZone(zone)) continue;
        std::ifstream file(recordPath(zone));
        if (!file) continue;
        JazzBar& bar = records_[zone];
        std::string line;
        while (std::getline(file, line) && bar.tracks.size() < kMaxJazzTracks) {
            const auto tab = line.find('\t');
            if (tab != kYoutubeIdLength) continue;
            bar.tracks.push_back({line.substr(0, tab), text::sanitize(line.substr(tab + 1), kMaxJazzTitleChars)});
        }
    }
}

void Game::saveJazz(int zone) {
    std::string content;
    for (const JazzTrack& track : records_[zone].tracks) content += track.id + "\t" + track.title + "\n";
    worker_.post([path = recordPath(zone), content = std::move(content)] { AccountStore::writeAtomic(path, content); });
}

std::string Game::jazzJson(int zone) const {
    if (!hasRecord(zone)) return "{\"t\":\"jazz\",\"off\":true}";  // 레코드 플레이어를 치웠다
    static const JazzBar empty;
    const auto found = records_.find(zone);
    const JazzBar& bar = found == records_.end() ? empty : found->second;
    char position[32];
    std::snprintf(position, sizeof(position), "%.2f", clock_ - bar.since);
    std::string json = "{\"t\":\"jazz\",\"gen\":" + std::to_string(bar.gen) + ",\"i\":" + std::to_string(bar.current) + ",\"pos\":" + position +
                       ",\"stop\":" + (bar.stopped ? "true" : "false") + ",\"list\":[";
    for (size_t i = 0; i < bar.tracks.size(); ++i) {
        json += (i ? ",[\"" : "[\"") + bar.tracks[i].id + "\",\"" + text::jsonEscape(bar.tracks[i].title) + "\"]";
    }
    return json + "]}";
}

void Game::changeJazzTrack(JazzBar& bar, size_t index) {
    bar.current = bar.tracks.empty() ? 0 : index % bar.tracks.size();
    bar.since = clock_;
    ++bar.gen;
}

// 아무도 없는 동안에는 곡이 넘어갈 수 없으므로, 첫 손님이 오면 지금 곡을 처음부터 튼다.
void Game::startRecordIfAlone(ConnId id, int zone) {
    const auto others = std::count_if(players_.begin(), players_.end(), [&](const auto& entry) { return entry.first != id && entry.second.zone == zone; });
    if (others == 0) {
        JazzBar& bar = records_[zone];
        changeJazzTrack(bar, bar.current);
    }
    server_.send(id, jazzJson(zone));
}

void Game::enterJazzBar(ConnId id, Player& p) {
    p.welcomeReady = true;
    sendInventory(id, p);
    server_.send(id, systemMessage("재즈바에 오신 걸 환영합니다. 바텐더에게 웰컴 드링크를 받아 가세요."));
    startRecordIfAlone(id, p.zone);
}

// "add <영상 ID> <제목>", "remove <영상 ID>", "play <영상 ID>", "next <gen>", "stop", "resume"
void Game::jazzCommand(ConnId id, Player& p, const std::string& arg) {
    if (!hasRecord(p.zone)) return;
    JazzBar& bar = records_[p.zone];
    std::istringstream in(arg);
    std::string action, value;
    in >> action >> value;
    if (action == "next") {  // 곡이 끝났다는 알림. 여러 사람이 동시에 보내도 한 번만 넘어간다
        long gen = 0;
        if (parseWhole(value.c_str(), gen) && gen == bar.gen && !bar.stopped && !bar.tracks.empty() && clock_ - bar.since >= kMinJazzPlaySeconds) {
            changeJazzTrack(bar, bar.current + 1);
            sendToZone(p.zone, jazzJson(p.zone));
        }
        return;
    }
    if (action == "stop" || action == "resume") {
        if (!spendAction(p) || bar.stopped == (action == "stop")) return;
        bar.stopped = action == "stop";
        if (!bar.stopped) changeJazzTrack(bar, bar.current);  // 다시 켜면 지금 곡을 처음부터
        sendToZone(p.zone, jazzJson(p.zone));
        return;
    }
    if (value.size() != kYoutubeIdLength || !std::all_of(value.begin(), value.end(), [](unsigned char c) { return std::isalnum(c) || c == '_' || c == '-'; })) return;
    const auto found = std::find_if(bar.tracks.begin(), bar.tracks.end(), [&value](const JazzTrack& track) { return track.id == value; });
    if (!spendAction(p)) {
        server_.send(id, jazzJson(p.zone));
        return;
    }
    if (action == "add") {
        if (found != bar.tracks.end()) {
            server_.send(id, systemMessage("이미 등록된 곡입니다."));
            return;
        }
        if (bar.tracks.size() >= kMaxJazzTracks) {
            server_.send(id, systemMessage("레코드판이 가득 찼습니다. 곡을 먼저 지워 주세요."));
            return;
        }
        std::string title;
        std::getline(in, title);
        title = text::sanitize(title, kMaxJazzTitleChars);
        bar.tracks.push_back({value, title.empty() ? value : title});
        if (bar.tracks.size() == 1) changeJazzTrack(bar, 0);
        saveJazz(p.zone);
        sendToZone(p.zone, systemMessage(p.name + "님이 레코드판에 곡을 올렸습니다."));
    } else if (action == "remove") {
        if (found == bar.tracks.end()) return;
        const size_t index = static_cast<size_t>(found - bar.tracks.begin());
        bar.tracks.erase(found);
        if (index < bar.current) --bar.current;
        else if (index == bar.current) changeJazzTrack(bar, bar.current);
        saveJazz(p.zone);
    } else if (action == "play") {  // 목록에서 고른 곡. 멈춰 있었으면 다시 튼다
        if (found == bar.tracks.end()) return;
        bar.stopped = false;
        changeJazzTrack(bar, static_cast<size_t>(found - bar.tracks.begin()));
    } else {
        return;
    }
    sendToZone(p.zone, jazzJson(p.zone));
}
