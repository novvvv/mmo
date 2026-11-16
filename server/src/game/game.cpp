// 이 게임과 core 가 만나는 곳: 켤 때 마을을 짓고 저장된 월드를 읽고 명령을 등록한다(install),
// 그리고 core 가 정해진 자리에서 부르는 훅들(입장, 퇴장, 구역 이동, 방 입장, 채팅, 매 틱, 지도와 상태 메시지의 필드).
// 명령을 처리하는 함수는 기능별 파일(home/, activity/, social/, game/)에 있다.
#include "game/rules.hpp"

Game::Game(Core& core, const GameConfig& config)
    : core_(core), server_(core.server()), accounts_(core.accounts()), worker_(core.worker()), config_(config), world_(core.world()),
      town_(core.world()), clock_(core.clock()), players_(core.players()), rng_(std::random_device{}()) {}

void Game::install(Core&) {
    town_.build();
    loadWorld();
    registerCommands();
}

void Game::loadWorld() {
    placeCats();
    loadExteriors();
    loadJazz();
    loadExpansions();
    loadGuestbook();
    loadFarm();
    loadDecor();
    loadPets();
    seedDecor();
    floors_.assign(static_cast<size_t>(world_.zoneCount()), 0);
    floorTints_.assign(static_cast<size_t>(world_.zoneCount()), std::string());
    loadFloors();
    lights_.resize(static_cast<size_t>(world_.zoneCount()));
    for (int zone = 0; zone < world_.zoneCount(); ++zone) lights_[static_cast<size_t>(zone)].level = world_.zone(zone).lightLevel;
    tvs_.resize(static_cast<size_t>(world_.zoneCount()));
}

// 명령 이름 → 처리 함수. 메시지 형식은 docs/PROTOCOL.md
void Game::registerCommands() {
    using Handler = void (Game::*)(ConnId, Player&, const std::string&);
    const struct {
        const char* name;
        Handler handler;
    } commands[] = {
        {"board", &Game::setBoard}, {"light", &Game::setLight}, {"note", &Game::playNote}, {"tv", &Game::controlTv},
        {"pachi", &Game::pachinkoCommand}, {"ext", &Game::exteriorCommand}, {"drop", &Game::dropItem}, {"eat", &Game::eatItem},
        {"buy", &Game::buyItem}, {"trade", &Game::tradeCommand}, {"jazz", &Game::jazzCommand}, {"dart", &Game::dartCommand},
        {"decor", &Game::decorCommand}, {"floor", &Game::floorCommand}, {"expand", &Game::expandCommand}, {"arcade", &Game::arcadeCommand},
        {"visit", &Game::visitHouse}, {"boardstyle", &Game::setBoardStyle}, {"stats", &Game::statsCommand}, {"mate", &Game::mateCommand},
        {"friend", &Game::friendCommand}, {"todo", &Game::todoCommand}, {"focus", &Game::focusCommand}, {"farm", &Game::farmCommand},
        {"garden", &Game::gardenCommand}, {"cook", &Game::cookCommand}, {"guest", &Game::guestCommand}, {"omok", &Game::omokCommand},
        {"releasepet", &Game::releasePet}, {"callpet", &Game::callPet}, {"buyemote", &Game::buyEmote}, {"buypet", &Game::buyPet},
        {"walkpet", &Game::walkPet}, {"petname", &Game::renamePet},
    };
    for (const auto& command : commands) {
        const Handler handler = command.handler;
        core_.addCommand(command.name, [this, handler](ConnId id, PlayerBase& p, const std::string& arg) { (this->*handler)(id, static_cast<Player&>(p), arg); });
    }
    core_.addCommand("rtc", [this](ConnId id, PlayerBase& p, const std::string& arg) { relayRtc(id, static_cast<Player&>(p), arg); });
    core_.addCommand("lamp", [this](ConnId id, PlayerBase& p, const std::string&) { tryLamp(id, static_cast<Player&>(p)); });
    core_.addCommand("fish", [this](ConnId id, PlayerBase& p, const std::string&) { useRod(id, static_cast<Player&>(p)); });
    core_.addCommand("pet", [this](ConnId id, PlayerBase& p, const std::string&) { petCat(id, static_cast<Player&>(p)); });
    core_.addCommand("feed", [this](ConnId id, PlayerBase& p, const std::string&) { feedCat(id, static_cast<Player&>(p)); });
}

// ------------------------------------------------------------ 플레이어 만들기, 계정에서 읽고 쓰기

std::unique_ptr<PlayerBase> Game::makePlayer() {
    return std::make_unique<Player>();
}

void Game::loadPlayer(PlayerBase& base, const Account& account) {
    Player& p = static_cast<Player&>(base);
    const AccountData d = AccountData::read(account);
    p.lightTokens = kLightBurst;
    p.noteTokens = kNoteBurst;
    p.tvTokens = kTvBurst;
    p.pachiTokens = kPachiBurst;
    p.extTokens = kExteriorBurst;
    std::copy(std::begin(d.caught), std::end(d.caught), std::begin(p.caught));
    std::copy(std::begin(d.loot), std::end(d.loot), std::begin(p.loot));
    std::copy(std::begin(d.shop), std::end(d.shop), std::begin(p.shop));
    std::copy(std::begin(d.furn), std::end(d.furn), std::begin(p.furn));
    p.dye = std::clamp(d.dye, 0, kMaxDye);
    p.dyed = parseDyed(d.dyed);
    p.boardStyle = clampInt(d.boardStyle, 0, 1);
    p.pets = d.pets & ((1 << decor::kPetKinds) - 1);
    p.emotes = d.emotes & ((1 << decor::kEmoteKinds) - 1);
    p.floorsOwned = d.floorsOwned & ((1 << decor::kFloorKinds) - 1);
    {
        std::istringstream stats(d.stats);
        std::string value;
        for (int i = 0; i < kStatCount && std::getline(stats, value, ','); ++i) p.stats[i] = std::max(0, std::atoi(value.c_str()));
    }
    {
        std::istringstream mates(d.mates);
        std::string mate;
        while (std::getline(mates, mate, ',') && p.mates.size() < kMaxMates) if (!mate.empty() && mate != account.id) p.mates.push_back(mate);
    }
    for (const std::string& other : splitList(d.friends)) {
        if (other != account.id && p.friends.size() < kMaxFriends && std::find(p.friends.begin(), p.friends.end(), other) == p.friends.end()) p.friends.push_back(other);
    }
    for (const std::string& other : splitList(d.friendReq)) {
        if (other != account.id && p.friendReq.size() < kMaxFriendRequests && std::find(p.friendReq.begin(), p.friendReq.end(), other) == p.friendReq.end()) p.friendReq.push_back(other);
    }
    p.todo = parseTodo(d.todo);
    p.todoShare = d.todoShare;
    {
        std::istringstream goods(d.goods);
        std::string value;
        for (int i = 0; i < farm::kGoods && std::getline(goods, value, ','); ++i) p.goods[i] = clampInt(std::atol(value.c_str()), 0, farm::kMaxGoods);
    }
    p.eggAt = d.eggAt;
    p.milkAt = d.milkAt;
    p.pet = d.pet >= 0 && d.pet < decor::kPetKinds && (p.pets & (1 << d.pet)) ? d.pet : -1;
    {
        std::istringstream names(d.petNames);
        std::string name;
        for (int i = 0; i < decor::kPetKinds && std::getline(names, name, '\t'); ++i) p.petNames[i] = text::sanitize(name, kMaxPetNameChars);
    }
    p.gold = d.gold;
    p.actionTokens = kActionBurst;
    p.hp = kMaxHp;
    p.boardText = text::sanitize(d.boardText, kMaxBoardChars);
    p.boardOn = d.boardOn && !p.boardText.empty();
}

void Game::savePlayer(const PlayerBase& base, Account& account) {
    const Player& p = static_cast<const Player&>(base);
    AccountData d;
    std::copy(std::begin(p.caught), std::end(p.caught), std::begin(d.caught));
    std::copy(std::begin(p.loot), std::end(p.loot), std::begin(d.loot));
    std::copy(std::begin(p.shop), std::end(p.shop), std::begin(d.shop));
    std::copy(std::begin(p.furn), std::end(p.furn), std::begin(d.furn));
    d.dye = p.dye;
    d.dyed = formatDyed(p.dyed);
    d.boardStyle = p.boardStyle;
    d.pets = p.pets;
    d.emotes = p.emotes;
    for (int i = 0; i < farm::kGoods; ++i) d.goods += (i ? "," : "") + std::to_string(p.goods[i]);
    d.eggAt = p.eggAt;
    d.milkAt = p.milkAt;
    d.pet = p.pet;
    for (int i = 0; i < decor::kPetKinds; ++i) d.petNames += (i ? "\t" : "") + p.petNames[i];
    d.floorsOwned = p.floorsOwned;
    for (int i = 0; i < kStatCount; ++i) d.stats += (i ? "," : "") + std::to_string(p.stats[i]);
    for (const std::string& mate : p.mates) d.mates += (d.mates.empty() ? "" : ",") + mate;
    d.friends = joinList(p.friends);
    d.friendReq = joinList(p.friendReq);
    d.todo = formatTodo(p.todo);
    d.todoShare = p.todoShare;
    d.gold = p.gold;
    d.boardOn = p.boardOn;
    d.boardText = p.boardText;
    d.write(account);
}

// ------------------------------------------------------------ 메시지에 덧붙이는 필드

// welcome: 고양이 위치를 보내는 주기, 소지품과 골드, HP, 가구, 펫, 감정표현, 바닥재
void Game::welcomeFields(const PlayerBase& base, std::string& json) {
    const Player& p = static_cast<const Player&>(base);
    std::ostringstream out;
    out << ",\"catMs\":" << (kCatBroadcastTicks * 1000 / kTickRate) << ",\"c\":[";
    for (int i = 0; i < kFishKinds; ++i) out << (i ? "," : "") << p.caught[i];
    out << "],\"l\":" << lootCounts(p) << ",\"hp\":" << p.hp << ",\"maxHp\":" << kMaxHp << ",\"pachiCost\":" << kPachiCost << ",\"f\":" << countsJson(p.furn, kDecorKinds)
        << ",\"fd\":" << dyedJson(p) << ",\"dye\":" << p.dye << ",\"pets\":" << p.pets << ",\"em\":" << p.emotes << ",\"pet\":" << p.pet << ",\"pn\":" << petNamesJson(p)
        << ",\"freed\":" << freedPetsJson(p.account) << ",\"floors\":" << p.floorsOwned << ",\"s\":" << countsJson(p.shop, kShopKinds) << ",\"g\":" << p.gold;
    json += out.str();
}

void Game::mapFields(std::string& json) {
    town_.mapFields(json);
}

// state 의 사람 항목: 데리고 다니는 펫, 집중 표시, 낚시
void Game::stateFields(const PlayerBase& base, std::string& json) {
    const Player& p = static_cast<const Player&>(base);
    char buf[96];
    if (p.pet >= 0) {
        std::snprintf(buf, sizeof(buf), ",\"pt\":%d", p.pet);
        json += buf;
        const std::string& name = p.petNames[p.pet];
        if (!name.empty()) json += ",\"pn\":\"" + text::jsonEscape(name) + "\"";
    }
    if (p.focusing) json += ",\"fc\":1";
    if (p.fish != FishState::Idle) {
        std::snprintf(buf, sizeof(buf), ",\"f\":%d,\"bx\":%.1f,\"by\":%.1f", static_cast<int>(p.fish), p.bobberX, p.bobberY);
        json += buf;
    }
}

// ------------------------------------------------------------ 입장과 퇴장

void Game::onJoin(ConnId id, PlayerBase& base, JoinStep step) {
    Player& p = static_cast<Player&>(base);
    switch (step) {
        case JoinStep::AfterMap:
            server_.send(id, exteriorsJson());
            break;
        case JoinStep::AfterTime:
            sendMates(id, p);
            sendFriends(id, p);
            sendTodo(id, p);
            sendGoods(id, p);
            if (FocusRoom* room = focusOf(p.account)) sendFocus(*room);   // 끊겼다 돌아왔다: 돌던 타이머를 이어 본다
            server_.send(id, guestLastJson());
            notifyFriends(p.account);   // 접속한 것을 친구들의 목록에 알린다
            for (auto& entry : players_) {   // 접속한 것을 동거인들의 목록에 알린다
                if (entry.first != id && std::find(entry.second.mates.begin(), entry.second.mates.end(), p.account) != entry.second.mates.end()) sendMates(entry.first, entry.second);
            }
            break;
        case JoinStep::AfterRoom:
            server_.send(id, myBoardJson(p));
            server_.send(id, boardsJson());
            break;
        case JoinStep::Announced:
            if (p.boardOn) sendToAll(boardJson(id, p.boardText, p.boardStyle));
            break;
    }
}

void Game::onLeave(ConnId id, PlayerBase& base, LeaveStep step) {
    Player& p = static_cast<Player&>(base);
    switch (step) {
        case LeaveStep::BeforeSave:
            endTrade(id, p, p.name + "님이 접속을 끊어 교환이 취소되었습니다.");
            removeFromDarts(id);
            removeFromOmok(id);   // 두던 오목은 기권으로 지고, 그 기록까지 함께 저장한다
            removeFromArcade(id);
            break;
        case LeaveStep::Removed:
            endShareBy(id, p.zone);
            break;
        case LeaveStep::Announced:
            if (p.boardOn) sendToAll(boardJson(id, "", 0));
            for (auto& entry : players_) {   // 동거인들의 목록에서 접속 표시를 끈다
                if (std::find(entry.second.mates.begin(), entry.second.mates.end(), p.account) != entry.second.mates.end()) sendMates(entry.first, entry.second);
            }
            notifyFriends(p.account);
            break;
    }
}

void Game::onLogout(const std::string& account) {
    // 모으는 중이면 모임에서 빠지고, 타이머가 도는 중이면 자리를 남겨 다시 들어왔을 때 이어 간다
    if (FocusRoom* room = focusOf(account)) {
        if (room->running) sendFocus(*room);
        else leaveFocus(account, nickOf(account));
    }
}

void Game::onZoneChange(ConnId id, PlayerBase& base, int from, int to, ZoneStep step) {
    Player& p = static_cast<Player&>(base);
    const bool moved = from != to;
    switch (step) {
        case ZoneStep::Before:
            endTrade(id, p, "구역을 옮겨 교환이 취소되었습니다.");
            if (moved) {  // 다른 방으로 가면 그 방의 다트와 오목에서 빠진다
                removeFromDarts(id);
                removeFromOmok(id);
                removeFromArcade(id);
            }
            p.cooking = -1;
            break;
        case ZoneStep::Sent:
            if (moved) endShareBy(id, from);   // 나간 뒤에 알려 남은 사람들에게만 간다
            break;
        case ZoneStep::Entered:
            if (moved) notifyFriends(p.account);   // 친구 목록의 있는 곳을 바꾼다
            break;
    }
}

// 방에 들어온 사람에게 그 방의 조명과 TV, 바닥 아이템, 농장, 가구와 텃밭, 바닥재, 레코드판, 다트, 오목을 알려 준다.
void Game::onEnterRoom(ConnId id, int zone) {
    if (world_.zone(zone).lighting) server_.send(id, lightJson(zone));
    if (!tvs_[static_cast<size_t>(zone)].video.empty()) server_.send(id, tvJson(zone));
    server_.send(id, dropsJson(zone));
    if (zone == town_.farmZone()) {
        const auto player = players_.find(id);
        if (player != players_.end()) sendFarm(id, player->second);
    }
    if (isHouseZone(zone) || zone == 0) {
        const auto player = players_.find(id);
        if (player != players_.end()) {
            server_.send(id, decorJson(zone, player->second));
            sendGarden(id, player->second);
        }
        if (zone != 0) server_.send(id, floorJson(zone));
    }
    if (zone == town_.jazzZone()) {
        const auto player = players_.find(id);
        if (player != players_.end()) enterJazzBar(id, player->second);
    } else if (hasRecord(zone)) {
        startRecordIfAlone(id, zone);
    }
    if (hasDarts(zone)) server_.send(id, dartJson(zone));
    if (hasDecorKind(zone, "omok_table")) server_.send(id, omokJson(zone));
}

// 채팅 글이 감정표현 명령("/박수" …)과 정확히 같으면 채팅 대신 표정을 짓는다. 표정이 보이는 같은 구역에만 알린다.
bool Game::onChat(ConnId id, PlayerBase& base, const std::string& message) {
    Player& p = static_cast<Player&>(base);
    int emote = 0;
    for (const char* name : kEmotes) {
        if (message == name) {
            if (decor::emotePaid(emote) && !(p.emotes & (1 << emote))) {
                server_.send(id, systemMessage("상점의 감정표현 탭에서 구할 수 있는 표정이에요."));
                return true;
            }
            sendToZone(p.zone, "{\"t\":\"emote\",\"id\":" + std::to_string(id) + ",\"n\":\"" + text::jsonEscape(p.name) +
                                   "\",\"e\":" + std::to_string(emote) + "}");
            return true;
        }
        ++emote;
    }
    return false;
}

// ------------------------------------------------------------ 낚시 중에는 제자리

bool Game::holdStill(const PlayerBase& base) const {
    return static_cast<const Player&>(base).fish != FishState::Idle;
}

void Game::cancelHold(PlayerBase& base) {
    static_cast<Player&>(base).fish = FishState::Idle;
}

// ------------------------------------------------------------ 매 틱

void Game::onPlayerTick(ConnId id, PlayerBase& base, float dt) {
    Player& p = static_cast<Player&>(base);
    p.lightTokens = std::min(kLightBurst, p.lightTokens + kLightRefillPerSec * dt);
    p.noteTokens = std::min(kNoteBurst, p.noteTokens + kNoteRefillPerSec * dt);
    p.tvTokens = std::min(kTvBurst, p.tvTokens + kTvRefillPerSec * dt);
    p.pachiTokens = std::min(kPachiBurst, p.pachiTokens + kPachiRefillPerSec * dt);
    p.extTokens = std::min(kExteriorBurst, p.extTokens + 1.f * dt);
    p.actionTokens = std::min(kActionBurst, p.actionTokens + kActionRefillPerSec * dt);
    updateRest(id, p, dt);
    p.playCarry += dt;
    if (p.playCarry >= 1.f) {   // 접속 시간은 초 단위로 센다 (저장할 때 함께 남는다)
        p.stats[kPlaySeconds] += static_cast<int>(p.playCarry);
        p.playCarry -= static_cast<float>(static_cast<int>(p.playCarry));
    }
    p.catCooldown = std::max(0.f, p.catCooldown - dt);
    updateFishing(id, p, dt);
}

void Game::onTick(float dt) {
    for (Cat& cat : cats_) updateCat(cat, dt);
    updateDrops(dt);
    updateDarts();
    updateOmok();
    updateArcade();
    updateFocus();
}

void Game::afterBroadcast(float) {
    for (auto it = delayed_.begin(); it != delayed_.end();) {
        if (it->at > clock_) {
            ++it;
            continue;
        }
        sendToZone(it->zone, it->json);
        it = delayed_.erase(it);
    }
    if (++catTicks_ >= kCatBroadcastTicks) {
        catTicks_ = 0;
        broadcastCats();
    }
}

bool Game::spendAction(Player& p) {
    if (p.actionTokens < 1.f) return false;
    p.actionTokens -= 1.f;
    return true;
}
