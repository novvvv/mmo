# server: 지금 게임 서버

`server-core`(뼈대) 위에 이 게임의 콘텐츠를 모듈 하나(`Game`)로 올린 서버입니다. 뼈대가 하는 일(연결, 로그인과 입장, 월드와 이동, 채팅, 보내기)은 [server-core/README.md](../server-core/README.md)에 있고, 이 문서는 그 위의 콘텐츠만 설명합니다.

## 빌드와 실행

```bash
cd server
make                 # server-core 의 소스와 이 폴더의 소스를 함께 빌드해 mmo_server 를 만든다
./mmo_server 8080 ../client ./data
```

core의 환경변수(로그인 제한, 낮밤 길이)에 더해 이 게임의 환경변수가 있습니다. 모두 시험용입니다.

| 환경변수 | 기본값 | 뜻 |
|---|---|---|
| `MMO_REST_SEC` | 60 | 앉아서 이만큼(초) 쉬면 골드 1 |
| `MMO_FOCUS_MINUTE_SEC` | 60 | 집중 타이머의 1분 |
| `MMO_FARM_SPEED` | 1 | 작물과 닭·젖소의 대기 시간을 이 값으로 나눔 |
| `MMO_CAT_NAP` | -1 | 쉬던 동물이 잠들 확률(%). -1이면 낮 12, 밤 60 |
| `MMO_CAT_FURNITURE` | 40 | 집에 풀어놓은 고양이가 쉬고 나서 방의 고양이 가구(캣휠, 캣타워, 숨숨집)로 갈 확률(%) |

## 폴더

```
src/
  main.cpp          core 를 만들고 Game 모듈을 올린다
  game/             콘텐츠 모듈의 중심
    game.hpp          Game 클래스: 콘텐츠의 상태, 플레이어(Player : PlayerBase), 모든 기능의 함수 선언
    game.cpp          core 와 만나는 곳: install(마을 짓기, 저장된 월드 읽기, 명령 39개 등록)과 훅들
    rules.hpp         콘텐츠의 규칙 값과 작은 도우미, 상태창 기록(Stat)
    town.*            마을 짓기: 카페, 집 네 채(몰쟈, 랏라, 캬캬, 헤연), 극장, 카지노, 재즈바, 특별관, 농장과 그 안의 꾸밈
    account_data.*    계정 파일의 콘텐츠 키(소지품, 골드, 친구, 할 일 …)를 읽고 쓰기
    player_view.hpp   core 의 플레이어 표를 Player 로 보는 창
    player.cpp        쉬면 받는 골드, 미니홈피 이동, 상태창
    chat.cpp          머리 위 광고판
    items.cpp         소지품, 바닥 아이템, 먹기, 매점, 감정표현 사기, HP
    trade.cpp         교환
  home/             집과 방: 가구(decor.hpp 가 가구 목록), 바닥재, 외관, 집 확장, 조명·피아노·TV·레코드판
  activity/         놀이와 생활: 농장·텃밭·요리(farm.hpp 가 작물과 요리법), 동물과 펫, 낚시, 빠칭코, 다트, 오목, 오락기와 체스
  social/           사람들 사이: 친구, 할 일, 동거인, 함께 집중, 방명록
```

`Game`은 클래스 하나이고, 그 멤버 함수를 여러 `.cpp`에 나눠 구현합니다. 구현 파일은 모두 `#include "game/rules.hpp"` 하나로 필요한 것을 받습니다.

## core 와 만나는 곳

| core 의 훅 | 이 게임이 하는 일 |
|---|---|
| `install` | 마을을 짓고(`Town::build`), 저장된 월드(가구, 외관, 집 확장, 방명록, 농장, 펫, 바닥재, 레코드판)를 읽고, 명령을 등록 |
| `makePlayer`, `loadPlayer`, `savePlayer` | 콘텐츠 값을 가진 `Player`를 만들고, 계정 파일에서 읽고 씀 (`AccountData`) |
| `welcomeFields`, `mapFields`, `stateFields` | 소지품과 골드 / 손 닿는 거리, 가구 목록, 농장 / 데리고 다니는 펫, 집중 표시, 낚시 |
| `onJoin` | 외관, 동거인·친구·할 일·곳간, 집중 모임, 방명록 새 글, 광고판 |
| `onLeave`, `onLogout` | 교환 취소, 다트·오목·오락기에서 빠지기, 화면 공유 끝내기, 광고판 끄기, 동거인·친구에게 알림, 집중 모임 |
| `onZoneChange`, `onEnterRoom` | 위와 같은 정리 / 그 방의 조명, TV, 바닥 아이템, 가구, 텃밭, 바닥재, 레코드판, 다트, 오목 |
| `onChat` | `/박수` 같은 감정표현 |
| `holdStill`, `cancelHold` | 낚시 중에는 제자리 |
| `onPlayerTick`, `onTick`, `afterBroadcast` | 도배 토큰, 쉬기 골드, 낚시 / 동물, 바닥 아이템, 다트, 오목, 오락기, 집중 / 늦게 보내는 알림, 동물 위치 |

## 저장

데이터 폴더(운영에서는 `/data`)에 텍스트 파일로 저장합니다. 계정 파일(`<아이디의 16진수>.acc`)과 `resume.key`는 core의 것이고, 나머지는 이 게임의 것입니다.

| 파일 | 내용 |
|---|---|
| `decor.list` | 집과 마당에 놓인 가구, 텃밭에 심은 작물 |
| `decor.seeded` | 집에 원래 있던 가구를 이미 깐 묶음 |
| `floors.list` | 집의 바닥재와 염색 |
| `exteriors.list` | 집 외관 |
| `expand.list` | 집 확장: 집마다 칠한 20px 칸 목록 (예전 방식의 줄은 읽을 때 칸으로 바꿔 다시 쓴다) |
| `guestbook.list` | 모든 집의 방명록 |
| `jazz.list`, `record<구역>.list` | 재즈바와 집의 곡 목록 |
| `pets.list` | 집에 풀어놓은 펫 |
| `farm.list` | 농장의 밭 |

가구, 물건, 기록, 펫, 감정표현의 번호와 구역 번호는 파일에 저장됩니다. 그래서 `home/decor.hpp`, `activity/farm.hpp`의 표와 `game/rules.hpp`의 `Stat`에는 **맨 뒤에만** 추가하고, `game/town.cpp`에서 건물을 짓는 순서는 바꾸지 않습니다.

## 배포

```bash
# 1. 코드를 서버로 보냄 (Mac, 저장소 루트에서)
COPYFILE_DISABLE=1 tar --no-xattrs --exclude=server/data --exclude=server/mmo_server --exclude=server/build \
  --exclude=server-core/build --exclude=server-core/core_server -czf - Dockerfile .dockerignore server-core server client \
  | ssh -i <SSH 키> ubuntu@<서버 주소> 'mkdir -p ~/mmo-server && tar -xzf - -C ~/mmo-server'

# 2. 이미지 빌드와 교체 (서버)
cd ~/mmo-server && docker tag mmo-server mmo-server:prev && docker build -t mmo-server .
docker stop mmo-server      # 저장을 마칠 시간을 줍니다. rm -f 는 쓰지 않습니다
docker rm mmo-server
docker run -d --name mmo-server --restart unless-stopped \
  --network api_default --memory=128m --memory-swap=128m \
  -v mmo-data:/data mmo-server
docker logs --tail 20 mmo-server

# 3. 클라이언트 (Mac)
npx vercel --prod
```

이미지 빌드에는 `server-core/`와 `server/`가 둘 다 필요합니다 (`Dockerfile`이 둘을 나란히 두고 `server/`에서 `make`). 서버를 먼저, 클라이언트를 나중에 올립니다.
