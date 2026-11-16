# 서버 리팩토링 계획: server-core 분리

2026-11-15 작성. 6절의 결정에 따라 진행했습니다. 진행 상황은 맨 아래 「진행 기록」에 있습니다.

## 1. 목표

게임 서버를 **뼈대(server-core)**와 **콘텐츠 모듈**로 나눕니다.

```
server-core/     연결, 로그인·입장, 월드·이동, 채팅, 보내기 + 콘텐츠가 끼어들 자리(확장 지점)
server/          지금 게임 = server-core + 콘텐츠 모듈(집, 농장, 미니게임, 친구 …)
server-core/examples/hello/   모듈 예시 서버 = server-core + 예시 모듈 (처음에는 ctf-server 였다. 맨 아래 2026-11-16 기록)
```

얻는 것:

- 뼈대 코드가 한 벌입니다. 로그인·이동·연결을 고치면 그 뼈대를 쓰는 모든 서버에 함께 반영됩니다.
- 새 기능은 모듈 하나를 만들어 등록하면 됩니다. 지금처럼 `onMessage`, `tick`, `join`, `Player`, `Account`를 여기저기 고치지 않아도 됩니다.
- 여러 사람이 서로 다른 모듈을 동시에 작업해도 같은 파일을 덜 건드립니다.
- 시즌 콘텐츠나 시험 중인 기능을 모듈 단위로 켜고 끌 수 있습니다.

## 2. 지키는 것

- **프로토콜은 그대로**: 클라이언트와 주고받는 메시지의 형식, 순서, 내용이 바뀌지 않습니다. `client/`는 고치지 않습니다.
- **저장 파일은 그대로**: 계정 파일(`.acc`)과 월드 파일(`decor.list` 등)을 지금 형식 그대로 읽고 씁니다. 운영 중인 데이터를 옮기는 작업은 없습니다.
- **단계마다 배포 가능**: 각 단계가 끝날 때마다 전체 테스트가 통과하고, 지금의 배포 명령으로 그대로 올릴 수 있는 상태를 유지합니다. 배포 명령은 마지막 폴더 분리 단계에서만 바뀝니다.
- **동작은 그대로**: 리팩토링 중에는 기능을 더하거나 고치지 않습니다. 고칠 것이 보이면 따로 적어 두고 리팩토링 뒤에 합니다.

## 3. 지금 core가 콘텐츠와 엮인 곳

core가 콘텐츠를 직접 부르는 곳입니다. 이 연결을 모두 끊는 것이 이 작업의 본체입니다.

| 위치 | 지금 하는 일 | 엮인 콘텐츠 |
|---|---|---|
| `Game::Game` (생성자) | 저장된 월드를 읽음 | 외관, 레코드판, 집 확장, 방명록, 농장, 가구, 펫, 바닥재, 동물 배치 |
| `Game::onMessage` | 명령 45개를 `if`로 나눔 | core 명령은 `login` `resume` `join` `in` `use` `chat` 6개뿐, 나머지 39개가 콘텐츠 |
| `Game::tick` | 매 틱 진행 | 쉬기 골드, 낚시, 동물, 바닥 아이템, 다트, 오목, 오락기, 집중, 빠칭코 지연 알림, 도배 토큰 7종 |
| `Game::join` | 계정을 읽어 플레이어를 만들고 입장 메시지를 보냄 | 물고기·전리품·매점 물건, 가구, 염료, 펫, 감정표현, 바닥재, 기록, 동거인, 친구, 할 일, 곳간, 골드, 광고판 / 친구·할 일·곳간·집중·방명록 메시지 |
| `Game::syncAccount` | 플레이어를 계정에 저장 | 위와 같은 필드 |
| `Game::logout` | 퇴장 처리 | 교환 취소, 다트·오목·오락기에서 빠지기, 화면 공유 끝내기, 집중 모임, 동거인·친구에게 알림, 광고판 끄기 |
| `Game::moveToZone` | 구역 옮기기 | 교환 취소, 다트·오목·오락기에서 빠지기, 화면 공유 끝내기, 요리 취소, 친구에게 알림 |
| `Game::sendRoomStateOnEntry` | 방에 들어온 사람에게 그 방의 상태를 보냄 | 조명, TV, 바닥 아이템, 농장, 가구, 텃밭, 바닥재, 재즈바, 레코드판, 다트, 오목 |
| `Game::broadcastState` | 매 틱 위치 전송 | 앉은 자리, 낚시, 데리고 다니는 펫, 집중 표시 |
| `Player` (`core/game.hpp`) | 플레이어 상태 | 필드 약 60개 중 core는 10개 남짓 |
| `Account` (`core/accounts.hpp`) | 계정 파일의 내용 | 필드 약 35개 중 core는 아이디·비밀번호·모양·위치 정도 |
| `World` (`core/world.*`) | 지형과 충돌, 지도 JSON | 건물 안 꾸미기(`furnish…`), 농장 밭, 집에 원래 있던 가구, 빠칭코 자리, 집 확장, 가구 목록·가격 JSON |
| `core/rules.hpp` | 공용 값 | 상점 표, 기록(`Stat`), 콘텐츠마다의 값 대부분 |

콘텐츠끼리 서로 부르는 곳도 많습니다. 예를 들면 가구를 치우면 텃밭을 다시 알리고, 농장이 기록을 더하고, 교환이 곳간의 물건을 옮깁니다. 이 연결은 지금 게임 안에서만 쓰이므로 끊지 않고 모듈 사이의 의존으로 남깁니다 (6절).

## 4. 확장 지점 설계

core는 아래 자리를 열어 두고, 모듈은 `Module`을 물려받아 쓸 자리만 덮어씁니다 (`server-core/src/core/module.hpp`).

```cpp
class Module {
public:
    virtual void install(Core&) {}                         // 켤 때: 명령 등록(core.addCommand), 건물 짓기, 저장된 것 읽기
    virtual std::unique_ptr<PlayerBase> makePlayer();      // PlayerBase 를 물려받은 플레이어 타입을 쓸 때
    virtual void loadPlayer(PlayerBase&, const Account&);  // 입장할 때 계정에서 읽기
    virtual void savePlayer(const PlayerBase&, Account&);  // 계정에 쓰기
    virtual void welcomeFields(const PlayerBase&, std::string&);   // welcome 메시지에 필드 덧붙이기
    virtual void mapFields(std::string&);                          // map 메시지에
    virtual void stateFields(const PlayerBase&, std::string&);     // 매 틱 state 의 사람 항목에
    virtual void onJoin(ConnId, PlayerBase&, JoinStep);            // 입장 메시지 사이사이 (AfterMap, AfterTime, AfterRoom, Announced)
    virtual void onLeave(ConnId, PlayerBase&, LeaveStep);          // 퇴장 (BeforeSave, Removed, Announced)
    virtual void onLogout(const std::string& account);
    virtual void onZoneChange(ConnId, PlayerBase&, int from, int to, ZoneStep);   // 구역 이동 (Before, Sent, Entered)
    virtual void onEnterRoom(ConnId, int zone);                    // 방에 들어온 사람에게 그 방의 상태
    virtual bool onChat(ConnId, PlayerBase&, const std::string&);  // true 면 채팅으로 보내지 않음
    virtual bool holdStill(const PlayerBase&) const;               // 제자리에 붙잡아 둘지 (낚시 같은)
    virtual void cancelHold(PlayerBase&);
    virtual void onPlayerTick(ConnId, PlayerBase&, float dt);      // 매 틱: 플레이어마다, 움직이기 전
    virtual void onTick(float dt);                                 // 모두 움직인 뒤
    virtual void afterBroadcast(float dt);                         // 위치를 보낸 뒤
};
```

### 플레이어 데이터

core의 `PlayerBase`에는 계정, 이름, 구역, 위치, 입력, 모양, 앉은 자리, 채팅 토큰만 있습니다. 지금 게임은 `PlayerBase`를 물려받은 `Player`를 `makePlayer`로 만들고, 콘텐츠 코드는 `PlayerView`(core의 플레이어 표를 `Player`로 보는 창)를 거쳐 예전처럼 `players_`를 씁니다. 새 모듈은 연결 번호나 계정으로 찾는 자기 표를 두는 편이 간단합니다 (`server-core/examples/hello/`).

### 계정 데이터

core의 `Account`는 아이디, 비밀번호, 모양, 위치만 알고, **나머지 키는 읽은 순서 그대로 `extra`에 보관했다가 다시 씁니다.** 모듈은 `Account::get`, `Account::set`으로 자기 키만 읽고 씁니다. 지금 게임은 자기 키들을 `AccountData`(`server/src/game/account_data.*`)로 한꺼번에 읽고 씁니다. 키 이름과 순서가 예전과 같아서 지금 계정 파일을 그대로 읽습니다.

### 월드 데이터

core의 `World`는 기본 마을(강, 다리, 나무, 가로등, 벤치)을 만들고 지형·충돌·자리·집 확장의 판정을 맡습니다. 건물과 꾸밈은 모듈이 `install`에서 `World`의 짓기 함수(`addPlace`, `addHouse`, `addAnnex`, `put`, `addSeat`, `carveRooms`, `markExpandable` …)로 더하고, 다 지으면 core가 `publish`로 지도를 만듭니다. 지금 게임은 이 일을 `Town`(`server/src/game/town.*`)이 하고, 구역을 짓는 순서는 예전과 같습니다.

## 5. 폴더 구조

```
server-core/
  Makefile               최소 서버 core_server 를 만든다
  src/
    base/                ws_server, sha1, worker, crypto, text
    core/                Core(명령 나누기, 틱, 보내기), module.hpp(훅), player.hpp, session(로그인·입장·퇴장),
                         movement(이동·문·앉기), chat, accounts, world, rules.hpp, app(runServer: 공통 main)
    minimal/main.cpp     모듈 없이 core 만으로 도는 최소 서버
server/
  Makefile               server-core 의 소스를 함께 빌드해 mmo_server 를 만든다
  src/
    main.cpp             core 위에 Game 모듈을 올린다
    game/                Game 모듈의 중심: 훅(game.cpp), 마을 짓기(town), 계정 키(account_data), 규칙 값, 소지품, 교환, 광고판
    home/, activity/, social/   기능별 구현 (예전과 같음)
server-core/examples/hello/
  Makefile, main.cpp     core 위에 예시 모듈을 올린다
  example.hpp/.cpp       모듈 예시 (명령, 플레이어마다의 값, 계정에 저장, 입장 안내)
```

## 6. 정한 것

| 질문 | 결정 | 까닭 |
|---|---|---|
| 콘텐츠를 모듈 몇 개로 나눌까? | **처음에는 지금 콘텐츠 전체를 모듈 하나(`Game`)로** 옮긴다. 안쪽은 지금처럼 기능별 폴더로 나뉜 채 둔다. 더 잘게 나누는 것은 나중에 기능을 손볼 때 하나씩 한다 | 콘텐츠끼리 서로 부르는 곳이 매우 많다 (가구를 치우면 텃밭을 다시 알리고, 농장이 기록을 더하고, 교환이 곳간을 옮긴다). 열한 개로 쪼개려면 5,500줄 대부분을 다시 써야 하는데, 얻고자 한 것(core 한 벌, CTF 서버, 새 기능을 모듈로)은 core 와 콘텐츠를 떼는 것만으로 모두 얻는다 |
| 확장 지점의 모양 | `Module` 클래스의 가상 함수. 쓸 것만 덮어쓴다 (`server-core/src/core/module.hpp`) | 함수 목록을 등록하는 방식보다 처음 보는 사람이 읽기 쉽다 ("onJoin 을 덮어쓰면 된다") |
| 호출 순서 | 모듈을 등록한 순서대로 부른다. 입장·퇴장·구역 이동은 core 가 메시지를 보내는 사이사이에 단계(`JoinStep`, `LeaveStep`, `ZoneStep`)를 두어, 지금과 같은 순서로 메시지가 나가게 한다 | 화면이 메시지 순서에 기대는 곳이 있을 수 있다 |
| 플레이어 데이터 | core 의 `PlayerBase` 에 위치·모양·앉은 자리만 둔다. 콘텐츠는 이를 물려받은 `Player` 를 `makePlayer` 로 만들게 한다 | 콘텐츠 코드 수천 줄이 `p.gold` 처럼 플레이어의 값을 바로 쓰고 있어서, 이 방식이면 그 코드를 거의 고치지 않는다 |
| 계정 데이터 | core 는 모르는 키를 `Account::extra` 에 순서대로 보관한다. 콘텐츠는 `AccountData` 로 읽고 쓴다 | 지금 계정 파일을 그대로 읽고, 같은 내용으로 다시 쓴다 |
| 모듈끼리 서로 부르기 | 허용. 다만 다른 모듈의 상태는 그 모듈의 함수로만 바꾼다 | |
| 광고판, 감정표현, 앉기 | 앉기는 core (이동과 붙어 있음). 광고판과 감정표현은 콘텐츠 (`onChat` 으로 감정표현을 가로챔) | |
| 낮밤 시계 | core | 서버 시각만 보내므로 콘텐츠와 엮이지 않는다 |
| 마을 | core 는 기본 마을(강, 나무, 가로등, 벤치)만 만든다. 건물과 그 안의 꾸밈은 콘텐츠가 `World` 의 짓기 함수로 짓는다 (`server/src/game/town.cpp`) | CTF 서버는 빈 마을에서 시작하고 자기 건물을 지을 수 있다 |
| 빌드 | 라이브러리로 묶지 않고, 각 서버의 Makefile 이 `server-core/src` 를 함께 빌드한다 | 따로 설치할 것이 없다 |
| `main` | 20Hz 루프와 종료 처리는 `runServer` 하나로 두고, 각 서버의 `main.cpp` 는 어떤 모듈을 올릴지만 정한다 | 루프가 세 벌이 되지 않게 |

## 7. 단계

단계마다 **전체 테스트 통과**와 **지금 배포 명령으로 배포 가능**을 완료 조건으로 둡니다.

### 1단계: 확장 지점 만들기

- `Hooks`(명령, 틱, 입장·퇴장, 구역 이동, 방 입장, state·map 필드, 저장)를 core에 만듭니다.
- `onMessage`가 명령표를 먼저 보고, 없으면 지금의 `if` 줄로 넘어가게 합니다. 아직 아무것도 옮기지 않으므로 동작은 그대로입니다.
- 완료 조건: 테스트 통과. 지금 코드에서 바뀐 것은 확장 지점을 부르는 줄뿐.

### 2단계: 계정의 모르는 키 보존

- `Account`에 `extra`를 더하고, core가 모르는 키를 그대로 보관했다가 다시 쓰게 합니다.
- 기존 필드는 아직 그대로 둡니다. 둘이 함께 돌아가는지 확인합니다.
- 완료 조건: 테스트 통과, 예전 계정 파일을 읽고 다시 썼을 때 내용이 같음 (새 확인 스크립트).

### 3단계: 콘텐츠를 모듈로 옮기기

- 지금 `Game` 클래스를 `Module` 을 물려받은 콘텐츠 모듈로 바꾼다. 로그인, 입장·퇴장, 이동, 문, 앉기, 채팅, 보내기는 core 로 옮기고, 콘텐츠가 그 사이에서 하던 일은 훅으로 옮긴다.
- 콘텐츠의 `Player` 는 `PlayerBase` 를 물려받고, 계정의 콘텐츠 값은 `AccountData` 로 읽고 쓴다.
- 건물과 꾸밈은 `World` 에서 `Town` 으로 옮긴다.
- 완료 조건: 테스트 통과.
- 콘텐츠를 더 잘게(가구, 농장, 미니게임 …) 나누는 것은 이 계획의 범위 밖이다. 기능을 손볼 때 그 기능부터 하나씩 떼어 낸다.

### 4단계: core 정리

- `onMessage`의 `if` 줄, `Player`·`Account`의 콘텐츠 필드, `World`의 콘텐츠 함수가 모두 비었는지 확인하고 지웁니다.
- core 파일에서 콘텐츠 헤더를 하나도 포함하지 않는지 확인합니다 (`grep`으로 확인하는 스크립트를 테스트에 넣음).
- 완료 조건: 테스트 통과, core가 콘텐츠를 포함하지 않음.

### 5단계: 폴더 분리

- `server-core/`를 만들고 core와 base를 옮깁니다. `server/`는 모듈만 남기고 core를 함께 빌드합니다.
- `server-core/src/minimal/main.cpp`로 모듈 없는 최소 서버를 만들어, 로그인·이동·채팅이 동작하는지 확인합니다.
- `Dockerfile`, `.dockerignore`, 배포 명령(`tar`로 묶는 폴더에 `server-core` 추가)을 고칩니다.
- 완료 조건: 테스트 통과, 최소 서버 확인 통과, 새 배포 명령으로 로컬 Docker 빌드 성공.

### 6단계: CTF 서버

- `ctf-server/`를 만들고 core만 등록한 상태에서 시작합니다.
- CTF용 모듈은 동아리에서 이 구조 위에 만듭니다.
- **2026-11-16 변경**: 동아리 CTF는 Nimda 쪽 시스템(채점·문제 서버·로그인)에 연결하기로 해서 `ctf-server/`를 지웠습니다. 계획은 [CTF_PLAN.md](CTF_PLAN.md)에 있습니다.

## 8. 테스트

- 지금의 테스트 45개(약 1,600개 검사)가 기준입니다. 리팩토링 중에는 테스트를 고치지 않습니다. 테스트를 고쳐야 통과한다면 동작이 바뀐 것이므로 코드를 다시 봅니다.
- 원래부터 가끔 실패하는 테스트가 있습니다: `casino`(구슬 뒤 골드), `social`(할 일을 달력에 놓기), 동시에 많이 돌릴 때의 `cats`·`nature`. `christmas`(모든 건물의 지붕 장식)는 지금 늘 실패합니다. 이들은 리팩토링 전 코드로도 같은 비율로 실패하는지 비교해서 판단합니다.
- 새로 더할 확인:
  - 계정 파일을 읽고 다시 썼을 때 내용이 같은지 (2단계)
  - core가 콘텐츠 헤더를 포함하지 않는지 (4단계)
  - 모듈 없는 최소 서버로 로그인·이동·채팅 (5단계)

## 9. 위험과 대응

| 위험 | 대응 |
|---|---|
| 입장할 때 보내는 메시지 순서가 바뀌어 화면이 어긋남 | 등록 순서를 지금 코드의 순서에 맞추고, 입장 직후 받은 메시지 순서를 이전과 비교하는 확인을 더함 |
| 계정 파일의 필드가 사라짐 | 2단계의 읽고 다시 쓰기 확인. 운영 데이터는 배포 전에 백업 |
| 구역 번호가 바뀌어 저장된 가구·방명록이 다른 방으로 감 | 구역을 만드는 순서를 고정하고, 구역 번호를 확인하는 테스트(`world`, `housing`)로 지킴 |
| 리팩토링 중에 새 기능을 더해 충돌 | 리팩토링 기간에는 서버 기능 추가를 멈춤. 급한 수정은 단계 사이에만 |
| 한 단계가 길어져 배포가 막힘 | 단계를 작게 나누고, 단계마다 배포 가능한 상태로 끝냄 |

## 10. 하지 않는 것

- 프로토콜 변경, 클라이언트 수정
- 저장 형식 변경 (데이터베이스로 옮기기 등)
- 성능 개선 (전송량 줄이기 등)
- 새 기능

이것들은 리팩토링이 끝난 뒤 따로 계획합니다.

## 진행 기록

### 2026-11-15: 1~6단계

단계마다 따로 배포할 일이 없어서 1~6단계를 한 번에 진행했고, 끝에서 전체 테스트로 확인했습니다.

- **server-core**: `base/`와 core(로그인·입장·퇴장, 이동·문·앉기, 채팅, 보내기, 계정, 월드)를 옮기고, `Module` 훅과 `runServer`(공통 main)를 만들었습니다. 모듈 없이 도는 최소 서버(`core_server`)가 빌드되고 동작합니다.
- **server**: 콘텐츠 전체를 `Game` 모듈 하나로 바꿨습니다. 건물과 꾸밈은 `Town`으로, 계정의 콘텐츠 키는 `AccountData`로 옮겼습니다. 기능별 폴더(home, activity, social)의 코드는 거의 그대로입니다.
- **ctf-server**: core + 예시 모듈(`hello` 명령, 계정의 `hello` 키에 저장)로 시작했습니다.
- **동작 비교**: 예전 서버와 새 서버에 같은 봇을 붙여, 입장할 때 받는 메시지(`welcome`, `map`, `ext`, `mates`, `friends`, `todo`, `goods`, `guestlast`, `zone`, `decor`, `garden`, `myboard`, `boards`, 안내 문구, 채팅)의 내용과 순서가 같은지 확인했습니다 (처음 서는 자리처럼 매번 무작위인 값은 빼고).
  - 비교에서 한 가지 차이를 찾아 고쳤습니다: 지도를 만드는 때가 가구를 놓은 뒤로 바뀌어, 지도의 고정 자리 목록에 놓은 가구의 자리 26개가 섞여 들어갔습니다. 이제 `World`는 짓기로 만든 자리만 지도에 넣습니다 (예전과 같은 118개).
- **테스트**: 새 스위트 `core`(최소 서버의 로그인·이동·채팅, 모듈이 없을 때 콘텐츠 명령 무시, 모르는 계정 키 보존, CTF 예시 모듈, core가 콘텐츠 헤더를 포함하지 않음)를 더했습니다.
  - `nature`의 「모든 고양이가 걷는다」는 밤이면(60%가 낮잠) 실패하던 시험이라, `roomcats`처럼 낮잠을 끄고 보게 고쳤습니다. 리팩토링과는 상관없이 낮잠 기능을 더할 때부터 있던 문제입니다.
- **배포**: `Dockerfile`이 `server-core/`와 `server/`를 함께 복사해 `server/`에서 빌드합니다. 서버로 보내는 `tar`에 `server-core`를 넣어야 합니다 (`server/README.md`의 「배포」).

- **클라이언트**: 스크립트가 늦게 내려오면 앞 파일의 타이머가 뒤 파일의 함수를 먼저 불러 멈추던 문제(`furnShop is not defined`)를 찾아, 그리기 루프와 타이머를 모두 `DOMContentLoaded` 뒤에 시작하게 고쳤습니다. 스크립트를 일부러 늦게 주는 스위트 `loading`으로 확인합니다.
- **테스트 실행기**: 전체 실행이 가끔 한 스위트에서 멈추는 일이 있어(매번 다른 브라우저 스위트, 서버와 브라우저는 응답하는 상태), 스위트마다 시간 제한(기본 300초, `TEST_SUITE_LIMIT_SEC`)을 두어 멈추지 않고 실패로 적고 넘어가게 했습니다.
- **빌드 확인**: macOS clang과 GCC 14(운영 이미지와 같은 계열)에서 `server-core`, `server`, `ctf-server` 셋 다 경고 없이 빌드됩니다.

### 2026-11-16: ctf-server 정리

- 동아리 CTF는 이미 있는 Nimda 시스템(Spring 웹 백엔드가 로그인·채점, Go 서버 Nimda-CTF가 문제 컨테이너)에 게임을 입구로 연결하기로 했습니다. 채점과 문제 서버를 C++로 다시 만들 필요가 없어 `ctf-server/`를 지웠습니다. 자세한 내용은 [CTF_PLAN.md](CTF_PLAN.md)에 있습니다.
- 그 안의 예시 모듈은 모듈 만드는 법을 보여 주는 문서이자 `core` 테스트의 대상이라 `server-core/examples/hello/`(`hello_server`)로 옮겼습니다. 테스트 `core`가 이것을 빌드해 확인합니다.
- `.gitignore`, `.dockerignore`, `.vercelignore`, `README.md`, `server-core/README.md`의 설명을 함께 고쳤습니다.
