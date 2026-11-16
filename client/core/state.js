'use strict';
// 게임 전체가 함께 쓰는 값과 상태: 캔버스, 상수, 아이템 표, 내 캐릭터와 다른 사람들, 소지품.

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');   // core/draw.js 의 drawOn 이 잠시 다른 캔버스로 바꿔 쓴다
const hud = document.getElementById('hud');
const chatEl = document.getElementById('chat');
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatToggle = document.getElementById('chat-toggle');
const chatUnread = document.getElementById('chat-unread');
const bagEl = document.getElementById('bag');
const bagItems = document.getElementById('bag-items');
const bagClose = document.getElementById('bag-close');
const bagTabItems = document.getElementById('bag-tab-items');
const bagTabFurn = document.getElementById('bag-tab-furn');
const bagPaneItems = document.getElementById('bag-pane-items');
const bagPaneFurn = document.getElementById('bag-pane-furn');
const bagFurnCount = document.getElementById('bag-furn-count');
const bagTabPets = document.getElementById('bag-tab-pets');
const bagTabMates = document.getElementById('bag-tab-mates');
const bagPaneMates = document.getElementById('bag-pane-mates');
const bagPanePets = document.getElementById('bag-pane-pets');
const itemTip = document.getElementById('item-tip');
const hpEl = document.getElementById('hp');
const hpFill = document.getElementById('hp-fill');
const hpText = document.getElementById('hp-text');
const tvResize = document.getElementById('tv-resize');
const bagHead = document.getElementById('bag-head');
const tvHead = document.getElementById('tv-head');
const tvEl = document.getElementById('tv');
const tvVideo = document.getElementById('tv-video');
const bagGold = document.getElementById('bag-gold');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
const mapWin = document.getElementById('map-win');
const hompyEl = document.getElementById('hompy');
const dyeEl = document.getElementById('dye');
const shopEl = document.getElementById('shop');
const shopGold = document.getElementById('shop-gold');
const shopList = document.getElementById('shop-list');
const tradeEl = document.getElementById('trade');
const tradeName = document.getElementById('trade-name');
const tradeMine = document.getElementById('trade-mine');
const tradeTheirs = document.getElementById('trade-theirs');
const tradeBag = document.getElementById('trade-bag');
const tradeGold = document.getElementById('trade-gold');
const tradeTheirGold = document.getElementById('trade-their-gold');
const tradeReady = document.getElementById('trade-ready');
const playerMenu = document.getElementById('player-menu');
const playerMate = document.getElementById('player-mate');
const playerTrade = document.getElementById('player-trade');
const tvSource = document.getElementById('tv-source');
const posterView = document.getElementById('poster-view');
const tvStatus = document.getElementById('tv-status');
const tvClose = document.getElementById('tv-close');
const tvScreen = document.getElementById('tv-screen');
const tvEmpty = document.getElementById('tv-empty');
const tvControls = document.getElementById('tv-controls');
const tvToggle = document.getElementById('tv-toggle');
const tvBar = document.getElementById('tv-time-bar');
const tvClock = document.getElementById('tv-clock');
const tvVolume = document.getElementById('tv-volume');
const tvMute = document.getElementById('tv-mute');
const tvStop = document.getElementById('tv-stop');
const tvShareTile = document.querySelector('#tv-tiles [data-source="share"]');
const tvForm = document.getElementById('tv-form');
const tvUrl = document.getElementById('tv-url');
const boardForm = document.getElementById('board-form');
const boardSwitch = document.getElementById('board-on');
const boardInput = document.getElementById('board-text');
const lightPanel = document.getElementById('light-panel');
const lightRoom = document.getElementById('light-room');
const lightLamp = document.getElementById('light-lamp');
const lightLevel = document.getElementById('light-level');
const lightLevelValue = document.getElementById('light-level-value');
const pianoEl = document.getElementById('piano');
const pianoKeys = document.getElementById('piano-keys');
const pianoLeave = document.getElementById('piano-leave');

const authEl = document.getElementById('auth');
const authForm = document.getElementById('auth-form');
const authId = document.getElementById('auth-id');
const authPw = document.getElementById('auth-pw');
const authSubmit = document.getElementById('auth-submit');
const authStatus = document.getElementById('auth-status');

const charEl = document.getElementById('charselect');
const charForm = document.getElementById('char-form');
const charName = document.getElementById('char-name');
const charColor = document.getElementById('char-color');
const charChannels = ['r', 'g', 'b'].map((key) => ({
  slider: document.getElementById(`char-${key}`),
  value: document.getElementById(`char-${key}-value`),
}));
const charLogout = document.getElementById('char-logout');
const charPreview = document.getElementById('char-preview');
const previewCtx = charPreview.getContext('2d');

// 서버와 동일한 비트 정의: 1=상, 2=하, 4=좌, 8=우
const KEYMAP = {
  KeyW: 1, ArrowUp: 1,
  KeyS: 2, ArrowDown: 2,
  KeyA: 4, ArrowLeft: 4,
  KeyD: 8, ArrowRight: 8,
};
// e.code 는 한글 입력 상태에서도 같다.
const ACTION_KEYS = { KeyE: 'use', KeyL: 'lamp', KeyT: 'tv', KeyF: 'fish', KeyC: 'pet', KeyX: 'feed' };

const TILE = 64;
const MAX_CHAT_LINES = 100;
const CHAT_COLLAPSED_KEY = 'mmo.chatCollapsed';
const TV_VOLUME_KEY = 'mmo.tvVolume';
const TV_MUTE_KEY = 'mmo.tvMuted';

// 이 브라우저에 남기는 작은 설정. 저장을 막아 둔 브라우저에서는 없는 것으로 보고, 이번 접속에만 적용한다
function loadSetting(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 이번 접속에만 */ }
}
const TV_SYNC_MS = 1000;       // 영상 위치를 맞춰 보는 간격
const TV_DRIFT_SEC = 1;        // 이보다 어긋나면 다시 맞춘다
const TV_SEEK_COOLDOWN_MS = 5000;  // 느린 회선에서 맞추기를 반복해 끊기지 않게 하는 간격
const BAG_SLOTS = 48;   // 네 칸씩 열두 줄. 창에는 네 줄이 보이고 나머지는 내려서 본다
const TV_MIN_WIDTH = 380;      // 유튜브 플레이어의 최소 높이(200px)를 지키는 폭
const TV_CHROME_HEIGHT = 130;  // TV 창에서 영상을 뺀 나머지 높이
const DAMAGE_FX_MS = 750;
const EMOTE_MS = 3000;         // 표정이 유지되는 시간
// 감정표현: [채팅 명령, 채팅창에 남는 말]. 서버의 감정 번호 순서. 앞의 다섯은 누구나 쓰고 그 뒤는 상점에서 구한다 (그림은 art.js)
const EMOTES = [
  ['/박수', '박수를 칩니다.'], ['/꿀맛', '맛있어합니다.'], ['/행복', '행복해합니다.'], ['/엉엉', '엉엉 웁니다.'], ['/기쁨', '기뻐합니다.'],
  ['/하트', '하트를 날립니다.'], ['/화남', '화를 냅니다.'], ['/졸림', '꾸벅꾸벅 좁니다.'], ['/놀람', '깜짝 놀랍니다.'], ['/인사', '손을 흔들어 인사합니다.'],
  ['/춤', '신나게 춤을 춥니다.'], ['/부끄', '부끄러워합니다.'], ['/웃음', '깔깔 웃습니다.'], ['/윙크', '윙크를 날립니다.'], ['/물음', '고개를 갸웃합니다.'],
];
const EMOTE_FREE = 5;          // 이 번호부터는 가진 것만 쓸 수 있다
const EMOTE_LINES = EMOTES.map(([, line]) => line);
const BUBBLE_MS = 5000;
const BUBBLE_CHARS = 28;
const NAME_CLEARANCE = 23;  // 몸 위로 이름표가 차지하는 높이. 머리 위의 표시는 이보다 위에 쌓인다
const BOARD_FONT = `600 12px ${FONT}`;
const BOARD_PIXEL_FONT = `12px Galmuri11, ${FONT}`;
const BOARD_MAX_WIDTH = 170;
const BOARD_MAX_LINES = 3;
const BOARD_LINE_HEIGHT = 16;
const BOARD_PAD_X = 10;
const BOARD_PAD_Y = 5;
const BOARD_MIN_WIDTH = 36;  // 꼬리가 모서리에 걸리지 않는 최소 폭
const BOARD_RADIUS = 7;
const BOARD_TAIL = 6;
const CATCH_MS = 1800;   // 낚은 물고기가 머리 위에 떠 있는 시간
const HEARTS_MS = 1600;  // 쓰다듬었을 때 하트가 올라오는 시간
const CAT_SAYS_MS = 1800;
const NIGHT_FADE_SEC = 60;
const NIGHT_DARKNESS = 0.68;
const NIGHT_SCALE = 3;   // 어둠 레이어는 작게 그려 늘린다 (빛 번짐이 부드럽고 빠르다)
const ROOM_DARKNESS = NIGHT_DARKNESS;  // 방 불을 껐을 때의 어둠 (바깥의 밤과 같다)
const ROOM_DIM = 0.42;     // 불을 켠 채 밝기를 최저로 내렸을 때의 어둠
const ROOM_ON_GLOW = 0.7;  // 불이 켜진 방에서는 난로와 스탠드의 빛을 줄여 화면이 하얗게 날아가지 않게 한다
const LIGHT_LEVEL_MIN = 10;
const LIGHT_LEVEL_MAX = 100;
const LEVEL_SEND_MS = 100; // 슬라이더를 끄는 동안 서버에 보내는 간격

// 낮은음부터 반음씩. 배열 위치가 곧 서버로 보내는 건반 번호다.
const PIANO_KEYS = [
  ['KeyA', 'A'], ['KeyW', 'W', true], ['KeyS', 'S'], ['KeyE', 'E', true], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyT', 'T', true], ['KeyG', 'G'],
  ['KeyY', 'Y', true], ['KeyH', 'H'], ['KeyU', 'U', true], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyO', 'O', true], ['KeyL', 'L'], ['KeyP', 'P', true], ['Semicolon', ';'],
];
const PIANO_BASE_HZ = 261.63;  // 첫 건반(C4)의 주파수
const PIANO_PARTIALS = [0, 1, 0.5, 0.24, 0.14, 0.08, 0.04, 0.02];  // 기본음과 배음의 세기
const NOTE_FX_MS = 900;
const NOTE_FX_MAX = 40;

// 고양이 털색과 이름. 서버가 보내는 고양이 순서대로 하나씩 입힌다.
const CAT_COATS = [
  { name: '치즈', body: '#eda557', dark: '#c47a2c', eye: '#1b1b1b' },
  { name: '까망이', body: '#2e2e34', dark: '#1a1a1e', eye: '#ffe066' },
  { name: '하양이', body: '#f4f1ea', dark: '#cfc8ba', eye: '#3a7bd5' },
  { name: '회색이', body: '#9096a0', dark: '#6b7077', eye: '#1b1b1b' },
  { name: '얼룩이', body: '#f0e2cc', dark: '#a8703a', eye: '#1b1b1b' },
];
const ROOM_PETS = {  // 집 안에서 사는 동물. 키는 집 이름, 순서는 서버가 보내는 순서
  몰쟈: [{ name: '재롱이', dog: true, body: '#fffdf8', dark: '#ded5c5' }],
  캬캬: [{ name: '뭉치', dog: true, body: '#fffdf8', dark: '#ded5c5' }],
};
// 상점의 펫. 서버 home/decor.hpp 의 kPetPrices 와 같은 순서다. 마을 고양이들과 집 강아지들, 갈색 강아지 초코, 그 뒤에 더한 품종들.
// 털 무늬(고르면 그림이 덧그린다): points 귀·얼굴·꼬리 끝의 짙은 색, chest 가슴·주둥이·발의 흰 털, tufts 귀 끝 털, size 몸집, tail 꼬리 굵기, husky 늑대 얼굴
const PET_KINDS = [...CAT_COATS, ROOM_PETS.몰쟈[0], ROOM_PETS.캬캬[0], { name: '초코', dog: true, body: '#b07a4a', dark: '#7d5232' },
  { name: '랙돌', body: '#f3ece0', dark: '#cbbba5', eye: '#4a8ee0', points: '#6b5546', tail: 6 },
  { name: '메인쿤', body: '#9a7350', dark: '#5e4430', eye: '#3f7a35', tufts: true, size: 1.25, tail: 6.5 },
  { name: '턱시도', body: '#26262b', dark: '#141417', eye: '#9be06a', chest: '#f6f3ec' },
  { name: '허스키', dog: true, husky: true, body: '#7e8792', dark: '#565d66', face: '#f4f2ee', eye: '#62b4ff' }];
const PET_NAP_MS = 12000;  // 주인이 이만큼 앉아 있으면 따라다니는 펫이 잠든다
const PET_SPEED = 170;  // 펫이 주인을 따라가는 빠르기 (px/초)
const PET_PERCH_WAIT_MS = 1500;  // 주인이 고양이 가구 곁에 이만큼 서 있으면 고양이 펫이 그 가구로 간다
const PET_PERCH_REACH = 130;     // 주인과 고양이 가구의 거리
const PET_PERCH_LEAVE = 190;     // 주인이 이보다 멀어지면 내려온다
const PET_PERCH_FRONT = 20;      // 가구를 쓰는 동안 서 있는 곳: 가구 기준점에서 이만큼 앞 (서버 kCatPerchFront)

// 서버의 물고기 종류 번호(k)와 같은 순서. 나올 확률은 서버가 정한다.
const FISH = [
  { name: '붕어', color: '#a9c4d6', grade: '일반', desc: '강에서 가장 흔하게 잡히는 민물고기. 통통하게 살이 올라 고양이들이 제일 좋아한다.' },
  { name: '메기', color: '#a08c74', grade: '고급', desc: '긴 수염으로 강바닥을 더듬으며 사는 물고기. 어둑한 물속에서도 먹이를 잘 찾아낸다.' },
  { name: '황금잉어', color: '#f5c518', rare: true, grade: '희귀', desc: '비늘이 금빛으로 빛나는 귀한 잉어. 낚는 순간 온 마을에 소문이 퍼진다.' },
];

// 슬라임이 떨어뜨리는 아이템. 서버의 kind 번호와 같은 순서.
const LOOT = [
  { name: '슬라임 젤리', grade: '일반', desc: '슬라임이 남긴 말랑한 젤리. 손에 쥐면 미끄러워서 자꾸 놓치게 된다.' },
  { name: '초록 구슬', rare: true, grade: '희귀', desc: '슬라임 몸속에서 아주 드물게 나오는 구슬. 빛에 비추면 안쪽이 천천히 일렁인다.' },
];
const REMOTE = { name: 'TV 리모컨', tool: true, grade: '도구', desc: '누르면 집 안 어디서든 TV 화면을 엽니다. 켜고 끄기와 영상 바꾸기를 멀리서도 할 수 있다.' };
// 극장 매점과 재즈바. 서버의 매점 아이템 순서와 같다. bar 가 붙은 것은 바텐더가 판다.
const SHOP = [
  { name: '팝콘', grade: '간식', price: 15, consumable: true, desc: '영화엔 역시 팝콘. 먹으면 HP가 15 회복된다.' },
  { name: '콜라', grade: '간식', price: 10, consumable: true, desc: '탄산이 톡 쏘는 시원한 콜라. 마시면 HP가 10 회복된다.' },
  { name: '체력 물약', grade: '물약', price: 40, consumable: true, desc: '붉은 물약. 마시면 HP가 50 회복된다.' },
  { name: '고급 물약', grade: '물약', price: 100, consumable: true, rare: true, desc: '보랏빛의 귀한 물약. 마시면 HP가 전부 회복된다.' },
  { name: '웰컴 드링크', grade: '칵테일', price: 0, bar: true, welcome: true, consumable: true, desc: '재즈바에 올 때마다 바텐더가 한 잔 내어 준다. 마시면 HP가 5 회복된다.' },
  { name: '맥주', grade: '술', price: 20, bar: true, consumable: true, desc: '거품이 풍성한 생맥주. 마시면 HP가 10 회복된다.' },
  { name: '칵테일', grade: '술', price: 35, bar: true, consumable: true, desc: '체리를 띄운 붉은 칵테일. 마시면 HP가 20 회복된다.' },
  { name: '위스키', grade: '술', price: 60, bar: true, consumable: true, rare: true, desc: '얼음 위로 천천히 따른 위스키. 마시면 HP가 30 회복된다.' },
];
// 늘 갖고 있는 체스 설명서. 서버의 아이템이 아니라서 맨 뒤에 둔다
const CHESS_BOOK = { name: '체스 설명서', tool: true, book: true, grade: '안내서', desc: '체스 말이 움직이는 법과 규칙을 그림으로 알려 주는 책. 초보도 금방 둘 수 있어요.' };
const ITEMS = [REMOTE, ...FISH, ...LOOT, ...SHOP, CHESS_BOOK];
const FIRST_FISH = 1, FIRST_LOOT = FIRST_FISH + FISH.length, FIRST_SHOP = FIRST_LOOT + LOOT.length;  // ITEMS 안에서의 위치
const FIRST_GOOD = FIRST_SHOP + SHOP.length;  // 농장의 물건(작물·달걀·우유·씨앗·요리). activity/farm.js 가 체스 설명서 앞에 끼워 넣는다
const GOLD_DROP = 99;  // 땅에 떨어진 골드의 번호. 서버와 같다

let ws = null;
let world = { w: 1440, h: 1520, speed: 220, tick: 20, catMs: 250 };  // welcome 메시지로 덮어씀
let myId = null;
let me = null;       // 내 캐릭터의 예측 위치 (입력 즉시 반응용)
let input = 0;    // 서버에 보낸 방향 비트 = 키보드(keyBits) | 조이스틱(padBits)
let keyBits = 0;
let padBits = 0;
let zone = 0;        // 지금 있는 구역. 0은 야외, 1번부터는 집 내부
let onlineCount = 0;
let myBag = [0, 0, 0];
let myLoot = [0, 0];
let myShop = SHOP.map(() => 0);
let myGoods = [];    // 농장의 물건 개수. 물건 번호 순서 (activity/farm.js 의 GOOD_NAMES)
let myWelcome = false;  // 이번 입장에서 웰컴 드링크를 아직 받지 않았다
let myGold = 0;
let myDyed = [];        // 소지품의 염색한 가구 [[가구 번호, 염색 값], ...]
let myDye = 0;          // 염료 개수
let hompyMode = false;  // 미니홈피 모드: 마을 대신 오른쪽 탭으로 집을 오간다
let roomFloor = 0;      // 지금 집의 바닥재 번호. 0 은 원래 바닥
let roomFloorTint = ''; // 지금 집의 바닥 염색 값. 비어 있으면 원래 색
let myPets = 0;         // 가진 펫 (펫 번호마다 한 비트)
let myEmotes = 0;       // 상점에서 구한 감정표현 (감정 번호마다 한 비트)
let myPet = -1;         // 데리고 다니는 펫
let myFreed = [];       // 집에 풀어놓은 펫 [[펫 번호, 구역], ...]
let myPetNames = [];    // 내 펫에게 지어 준 이름 (펫 번호 순서, 비어 있으면 종류 이름)
let selectedPet = -1;   // 소지품 펫 탭에서 고른 펫
let myMates = [];       // 동거인 [[닉네임, 접속 중이면 연결 번호 아니면 0], ...]
let myFloors = 0;       // 산 바닥재 (번호마다 한 비트)
const petFollowers = new Map();  // 플레이어 id → 따라다니는 펫의 화면 위치
let tradeState = null;     // { mine, theirs } 서버가 알려 준 교환 내용
let menuTarget = null;     // 우클릭한 캐릭터
const minimapBase = document.createElement('canvas');
let myHp = 100;
let bagOwner = null;   // 칸 배치를 계정별로 기억한다
let bagSlots = {};     // 아이템 번호 -> 칸 번호
let drops = [];        // { id, kind, x, y }
let damageFx = [];     // { x, y, text, color, at } 떠오르는 글자 (빠칭코 대박 같은)
let closeMessage = null;  // 연결이 끊겼을 때 로그인 화면에 보여 줄 문구 (null 이면 기본 문구)
// 이어 들어오기: 게임 중에 연결이 끊기면(서버를 다시 켜거나 휴대폰이 잠깐 잠들면) 화면은 마지막 모습 그대로 두고
// 로그인 때 받은 표로 다시 들어온다. 표와 캐릭터 모양은 이 브라우저에 남겨 두어 새로 열어도 한 번에 이어 들어간다.
const RESUME_KEY = 'mmo.resume';
let offline = false;
let resuming = false;       // 표로 들어가는 중이라 캐릭터 고르기를 건너뛴다
let reconnectTimer = null;
let reconnectTries = 0;
let pendingSocket = null;
let lastStateAt = 0;        // 마지막 state 메시지를 받은 때. 오래 끊기면 죽은 연결로 보고 다시 잇는다
const STALE_MS = 4500;
let staleSeen = 0, staleMs = 0;   // 마지막으로 본 lastStateAt 과, 그 뒤로 화면이 돈 시간
// 다른 사람의 움직임: 서버 틱 번호로 받은 위치를 조금 늦게(INTERP_MS) 이어 그려 끊김 없이 움직이게 한다
const INTERP_MS = 110;
let stateClock = null;      // 서버 틱 0 이 이 화면 시계로 언제였는지 (가장 덜 늦게 온 메시지 기준)
const entities = new Map();  // id -> { name, color, arms, legs, limbColor, x, y, fromX, fromY, toX, toY, t0, dirX, dirY, moving, seat, fish, bx, by }
const boards = new Map();    // id -> { lines, w, h } 켜 둔 광고판. 구역과 상관없이 전부 받아 둔다
let sentBoard = { on: false, text: '' };  // 서버에 마지막으로 보낸 내 광고판
let unreadChats = 0;

let terrain = null;    // 서버의 map 메시지: 강둑, 구역, 건물, 가구, 자리
let riverPath = null;  // terrain 으로 만든 강 윤곽
let riverNorth = 0, riverSouth = 0;  // 강이 차지하는 y 범위
let cats = [];         // { x, y, fromX, fromY, toX, toY, t0, dir, moving, coat, heartsAt, says, saysUntil }
let clockSync = null;  // { phase, at, len } 서버 시계. 낮은 [0, len), 밤은 [len, 2*len)
let roomLight = null;  // { on, lamp, level } 지금 있는 방의 조명. 조작할 수 없는 곳이면 null
let levelTimer = null;
let levelSentAt = -Infinity;
let audio = null, audioOut = null, pianoWave = null;  // 첫 키 입력이나 클릭 때 만든다 (브라우저의 자동 재생 제한)
let noteFx = [];       // { x, y, at, color } 피아노 위로 떠오르는 음표
let tvState = null;    // { video, pos, paused, at } 지금 있는 방의 TV. 꺼져 있으면 null
let tvPanelOpen = false;
let tvDismissed = null;  // 창을 닫아 둔 영상. 다른 영상이 나오면 창이 다시 열린다
let tvReelFrame = null;
let tvVideoLayout = '';
let tvSourceKind = 'youtube';  // 주소 입력칸이 받을 영상 종류
let tvPlayer = null, tvPlayerPending = false, tvPlayerReady = false, tvLoadedVideo = null, tvSeeking = false, tvSeekedAt = -Infinity;
let youTubeApi = null;

const look = { color: '#4fa3e0', arms: 1, legs: 1, limbColor: 0 };
