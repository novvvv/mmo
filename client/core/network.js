'use strict';
// 서버 연결: 접속, 끊기면 화면을 유지한 채 다시 잇기, 받은 메시지를 종류별로 나눠 처리하기.

// ------------------------------------------------------------ 네트워크

function socketUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return window.MMO_WS_URL || `${proto}://${location.host}/ws`;
}

function connect(onOpen) {
  let opened = false;
  const socket = new WebSocket(socketUrl());
  ws = socket;
  socket.onopen = () => {
    opened = true;
    onOpen();
  };
  socket.onmessage = (ev) => handleMessage(JSON.parse(ev.data));
  socket.onclose = () => socketClosed(socket, opened);
}

function socketClosed(socket, opened) {
  if (ws !== socket) return;
  if (myId !== null && closeMessage === null && loadResume()?.token) {   // 게임 중에 끊겼다: 화면은 그대로 두고 다시 잇는다
    goOffline();
    return;
  }
  const fallback = opened ? '서버와 연결이 끊어졌습니다.' : '서버에 연결할 수 없습니다.';
  resetToLogin(closeMessage === null ? fallback : closeMessage);
  closeMessage = null;
}

function loadResume() {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveResume(part) {
  try {
    const saved = { ...(loadResume() || {}), ...part };
    if (part.id && saved.id !== part.id) delete saved.look;   // 다른 아이디면 캐릭터 모양을 새로 받는다
    localStorage.setItem(RESUME_KEY, JSON.stringify(saved));
  } catch { /* 저장하지 못하면 끊겼을 때 로그인 화면으로 돌아간다 */ }
  syncResumeButton();
}

function clearResume() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch { /* 없다 */ }
  syncResumeButton();
}

const offlineEl = document.getElementById('offline');
const offlineText = document.getElementById('offline-text');
const authResume = document.getElementById('auth-resume');

function goOffline() {
  offline = true;
  document.body.classList.add('offline');
  offlineEl.hidden = false;
  input = 0;
  keyBits = 0;
  padBits = 0;
  releaseStick();
  if (me) me.moving = false;
  chatInput.blur();
  scheduleReconnect(700);
}

function endOffline() {
  offline = false;
  reconnectTries = 0;
  clearTimeout(reconnectTimer);
  if (pendingSocket) {
    pendingSocket.onclose = null;
    pendingSocket.close();
    pendingSocket = null;
  }
  document.body.classList.remove('offline');
  offlineEl.hidden = true;
}

function scheduleReconnect(delay) {
  clearTimeout(reconnectTimer);
  offlineText.textContent = reconnectTries ? `다시 연결하는 중… (${reconnectTries}번째)` : '다시 연결하는 중…';
  reconnectTimer = setTimeout(tryReconnect, delay);
}

function tryReconnect() {
  clearTimeout(reconnectTimer);
  const saved = loadResume();
  if (!offline || pendingSocket || !saved?.token) return;
  reconnectTries++;
  offlineText.textContent = '연결하는 중…';
  let socket;
  try {
    socket = new WebSocket(socketUrl());
  } catch {
    scheduleReconnect(5000);
    return;
  }
  pendingSocket = socket;
  socket.onopen = () => {
    if (pendingSocket !== socket) return;
    pendingSocket = null;
    ws = socket;
    socket.onmessage = (ev) => handleMessage(JSON.parse(ev.data));
    socket.onclose = () => socketClosed(socket, true);
    resuming = true;
    socket.send(`resume ${saved.token}`);
  };
  socket.onclose = () => {
    if (pendingSocket !== socket) return;
    pendingSocket = null;
    scheduleReconnect(Math.min(10000, 1000 * 2 ** Math.min(reconnectTries - 1, 4)));   // 1, 2, 4, 8, 10초…
  };
}

// 표로 들어가면 지난번 캐릭터 모양으로 곧장 입장한다
function rejoin() {
  const saved = loadResume();
  if (!saved?.look || !saved.name) {   // 모양을 모르면 캐릭터 고르기로
    resuming = false;
    endOffline();
    resetToLogin('');
    return;
  }
  hompyMode = !!saved.hompy;
  if (saved.id) loadBagLayout(saved.id);
  const { color, arms, legs, limbColor } = saved.look;
  ws.send(`join ${color} ${arms} ${legs} ${limbColor} ${saved.name}`);
}

// 다시 들어올 때: 서버가 곧 다시 보내 줄 세상의 상태만 비운다. 열어 둔 창과 채팅은 그대로 둔다
function softReset() {
  entities.clear();
  boards.clear();
  cats = [];
  petFollowers.clear();
  drops = [];
  damageFx = [];
  stateClock = null;
  closeTrade();
  clearNotices();
  clearLight();
  clearTv();
  clearJazz();
  clearDarts();
  clearOmok();
  clearDecor();
  if (pachiOpen) setPachiOpen(false);
  playerMenu.hidden = true;
}

function syncResumeButton() {
  const saved = loadResume();
  const ready = !!(saved?.token && saved.look && saved.name);
  authResume.hidden = !ready;
  if (ready) authResume.textContent = `▶ ${saved.name}(으)로 이어 들어가기`;
}

authResume.addEventListener('click', () => {
  const saved = loadResume();
  if (!saved?.token || authSubmit.disabled) return;
  Sound.unlock();
  setAuthBusy(true, '이어 들어가는 중...');
  resuming = true;
  const send = () => ws.send(`resume ${saved.token}`);
  if (ws && ws.readyState === WebSocket.OPEN) send();
  else connect(send);
});
document.getElementById('offline-retry').addEventListener('click', () => {
  reconnectTries = 0;
  tryReconnect();
});
addEventListener('online', () => { if (offline) tryReconnect(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && offline) tryReconnect(); });
syncResumeButton();

function resetToLogin(message) {
  endOffline();
  resuming = false;
  stateClock = null;
  if (pachiOpen) setPachiOpen(false);
  myId = null;
  me = null;
  input = 0;
  keyBits = 0;
  releaseStick();
  zone = 0;
  entities.clear();
  boards.clear();
  terrain = null;
  cats = [];
  clockSync = null;
  setInventory({ c: [], l: [], s: [], g: 0 });
  closeTrade();
  clearNotices();
  myMates = [];
  myFriends = [];
  friendRequests = [];
  friendsLoaded = false;
  myTodo = { n: '', sh: 1, i: [] };
  friendTodo = null;
  todoRestored = false;
  todoSentToday = 0;
  todoMoving.clear();
  guestLast = new Map();
  guestSeenMap = null;
  guestNew.hidden = true;
  friendsEl.hidden = true;
  todoEl.hidden = true;
  guestEl.hidden = true;
  focusEl.hidden = true;
  applyFocus({ id: 0 });
  farmReset();
  guestBook = null;
  playerMenu.hidden = true;
  shopEl.hidden = true;
  mapWin.hidden = true;
  hompyEl.hidden = true;
  document.body.classList.remove('hompy');
  setDyeOpen(false);
  drops = [];
  damageFx = [];
  hpEl.hidden = true;
  boardInput.blur();
  applyMyBoard({ on: false, m: '' });
  clearLight();
  clearTv();
  clearJazz();
  clearDarts();
  clearOmok();
  profileEl.hidden = true;
  clearDecor();
  setFurnShop(false);
  setCinemaFull(false);
  setBagOpen(false);
  hud.textContent = '';
  chatInput.blur();
  chatInput.value = '';
  chatLog.textContent = '';
  setUnread(0);
  chatEl.hidden = true;
  charEl.hidden = true;
  authEl.hidden = false;
  soundBar.hidden = true;
  Sound.setMusic(null);
  setAuthBusy(false, message);
  syncResumeButton();
}

function handleMessage(msg) {
  switch (msg.t) {
    case 'auth':
      if (msg.ok) {
        if (msg.rt) saveResume({ token: msg.rt, id: msg.id });
        if (resuming) {
          resuming = false;
          rejoin();
        } else {
          showCharacterSelect(msg);
        }
      } else if (msg.resume) {   // 표가 낡았다: 비밀번호로 다시 로그인한다
        resuming = false;
        clearResume();
        resetToLogin(msg.m);
      } else {
        setAuthBusy(false, msg.m);
      }
      break;
    case 'kick':
      closeMessage = msg.m;
      break;
    case 'welcome':
      if (offline) {   // 끊겼다가 다시 들어왔다
        softReset();
        endOffline();
        addChatLine('다시 연결되었습니다.');
      }
      authEl.hidden = true;
      setAuthBusy(false, '');
      myId = msg.id;
      world = { w: msg.w, h: msg.h, speed: msg.speed, tick: msg.tick, catMs: msg.catMs, maxHp: msg.maxHp, pachiCost: msg.pachiCost };
      mapWin.hidden = hompyMode;  // 미니홈피에는 마을 지도가 필요 없다
      hompyEl.hidden = !hompyMode;
      document.body.classList.toggle('hompy', hompyMode);
      soundBar.hidden = false;
      charEl.hidden = true;
      charName.blur();
      chatEl.hidden = false;
      setInventory(msg);
      setHp(msg.hp);
      break;
    case 'map':
      setTerrain(msg);
      break;
    case 'ext':
      exteriors = new Map(msg.p.map(([z, wall, roof, door, deco, form = 0]) => [z, { wall, roof, door, deco, form }]));
      applyExteriors();
      renderExtPane();
      break;
    case 'pachi':
      applyPachi(msg);
      break;
    case 'zone':
      enterZone(msg);
      guestZoneChanged();
      farmZoneChanged();
      if (arcadeOpenId !== null) setArcadeOpen(null);
      arcadeStates.clear();
      if (hompyMode && !hompyHouses().some((h) => h.zone === msg.z)) visitHouse(hompyHouses()[0]?.zone);  // 미니홈피는 집에서 시작한다
      syncHompy();
      renderExpandPane();
      break;
    case 'time':
      clockSync = { phase: msg.p, at: performance.now(), len: msg.len };
      break;
    case 'cats':
      receiveCats(msg.p);
      break;
    case 'cat':
      handleCatEvent(msg);
      break;
    case 'catch':
      handleCatch(msg);
      break;
    case 'light':
      applyLight(msg);
      break;
    case 'tv':
      applyTv(msg);
      break;
    case 'jazz':
      applyJazz(msg);
      break;
    case 'decor':
      applyDecor(msg);
      break;
    case 'dart':
      applyDart(msg);
      break;
    case 'omok':
      applyOmok(msg);
      break;
    case 'stats':
      showProfile(msg);
      break;
    case 'mates':
      myMates = msg.p;
      renderBagMates();
      break;
    case 'mateask':
      pushNotice({
        kind: 'mate', key: `mate:${msg.id}`, title: '동거인 신청', text: `${msg.n}님이 동거인이 되자고 해요!`, sub: '동거인끼리는 서로 놓은 가구를 옮기고 치울 수 있어요.',
        look: (e) => e.id === msg.id, yes: () => ws.send(`mate yes ${msg.id}`), no: () => ws.send(`mate no ${msg.id}`),
      });
      break;
    case 'rtc':
      applyRtc(msg);
      break;
    case 'friends':
      applyFriends(msg);
      break;
    case 'friendask':
      friendAsked(msg.n);
      break;
    case 'friendok':
      pushNotice({ kind: 'friend', title: '친구', text: `${msg.n}님이 친구 신청을 수락했어요!`, sub: '친구 창(N)에서 볼 수 있어요.', look: (e) => e.name === msg.n, yesLabel: '좋아요', noLabel: null });
      break;
    case 'todo':
      applyTodo(msg);
      break;
    case 'focus':
      applyFocus(msg);
      break;
    case 'farm':
    case 'garden':
    case 'goods':
    case 'harvest':
    case 'cook':
    case 'cooked':
      farmMessage(msg);
      break;
    case 'focuslist':
      focusRooms = msg.r;
      renderFocus();
      break;
    case 'focusinv':
      focusInvited(msg);
      break;
    case 'focusdone':
      focusDone(msg);
      break;
    case 'guest':
      applyGuest(msg);
      break;
    case 'guestlast':
      applyGuestLast(msg);
      break;
    case 'guestnew':
      addChatLine(`${msg.n}님이 이 집 방명록에 글을 남겼어요. (G)`);
      guestOpen.classList.remove('ring');
      void guestOpen.offsetWidth;
      guestOpen.classList.add('ring');
      break;
    case 'drops':
      drops = msg.p.map(([id, kind, x, y, amount]) => ({ id, kind, x, y, amount }));
      break;
    case 'inv':
      setInventory(msg);
      break;
    case 'trade':
      handleTrade(msg);
      break;
    case 'hp':
      setHp(msg.v);
      if (msg.hit && me) addDamageFx(me.x, me.y - 46, `-${msg.hit}`, '#ff6a6a');
      if (msg.hit) Sound.play('hurt');
      break;
    case 'loot':
      addChatLine(msg.k === GOLD_DROP ? `${msg.n} 골드를 주웠습니다.` : `${ITEMS[msg.k + 1].name}을(를) 주웠습니다.`);
      break;
    case 'emote': {
      const e = entities.get(msg.id);
      if (e) {
        e.emote = msg.e;
        e.emoteAt = performance.now();
      }
      addChatLine(`${msg.n}님이 ${EMOTE_LINES[msg.e]}`);
      break;
    }
    case 'note':
      playPianoNote(msg.n);
      addNoteFx(msg.n);
      break;
    case 'myboard':
      applyMyBoard(msg);
      break;
    case 'boards':
      for (const [id, text, style] of msg.p) setBoard(id, text, style);
      break;
    case 'board':
      setBoard(msg.id, msg.m, msg.s);
      break;
    case 'room':
      applyZone(msg);
      break;
    case 'arcade':
      applyArcade(msg);
      break;
    case 'asy':
      applyArcadeSync(msg);
      break;
    case 'ain':
      if (msg.id === arcadeOpenId) arcadeGuest = { x: msg.x, fire: !!msg.f, at: performance.now() };
      break;
    case 'floor':
      if (msg.z === zone) {
        roomFloor = msg.m;
        roomFloorTint = msg.tint || '';
        refreshFloorShop();
      }
      break;
    case 'chat': {
      addChatLine(msg.m, msg.n, msg.c);
      if (msg.id !== myId && isChatCollapsed()) setUnread(unreadChats + 1);
      flowChat(msg.m, msg.id === myId);
      const e = entities.get(msg.id);
      if (e) {
        const chars = Array.from(msg.m);
        e.bubble = chars.length > BUBBLE_CHARS ? chars.slice(0, BUBBLE_CHARS).join('') + '…' : msg.m;
        e.bubbleUntil = performance.now() + BUBBLE_MS;
      }
      break;
    }
    case 'sys':
      addChatLine(msg.m);
      break;
    case 'state':
      receiveState(msg);
      break;
    default:
      break;
  }
}

function receiveState(msg) {
  const now = performance.now();
  lastStateAt = now;
  const seen = new Set();
  onlineCount = msg.on;
  // 서버 시각: 틱 번호 × 틱 길이. 가장 덜 늦게 도착한 메시지에 맞추고, 시계가 어긋나도 천천히 따라간다
  const tickMs = 1000 / world.tick;
  const serverMs = msg.k !== undefined ? msg.k * tickMs : null;
  if (serverMs !== null) {
    const sample = now - serverMs;
    if (stateClock === null || sample < stateClock || sample - stateClock > 1500) stateClock = sample;
    else stateClock += (sample - stateClock) * 0.01;
  }
  for (const p of msg.p) {
    seen.add(p.id);
    let e = entities.get(p.id);
    if (!e) {
      e = { x: p.x, y: p.y, dirX: 0, dirY: 1, moving: false, snaps: [] };
      entities.set(p.id, e);
    }
    const a = p.a || 0;
    e.name = p.n;
    e.color = p.c;
    e.arms = a % 3;
    e.legs = Math.floor(a / 3) % 3;
    e.limbColor = Math.floor(a / 9);
    if (p.id === myId) playSelfSounds(e, p.s || 0, p.f || 0);
    e.seat = p.s || 0;
    e.fish = p.f || 0;
    e.pet = p.pt ?? -1;
    e.focus = !!p.fc;
    e.bx = p.bx;
    e.by = p.by;
    // 다른 플레이어: 받은 위치를 시각과 함께 쌓아 두고 update 에서 조금 늦은 시각으로 이어 그린다
    const at = serverMs ?? now;
    if (!e.snaps) e.snaps = [];
    const last = e.snaps[e.snaps.length - 1];
    if (!last || at > last.t) {
      e.snaps.push({ t: at, x: p.x, y: p.y, d: p.d || 0 });
      if (e.snaps.length > 24) e.snaps.shift();
    }
    e.toX = p.x; e.toY = p.y;
    e.t0 = now;
    if (p.id === myId) reconcile(p.x, p.y);
  }
  for (const id of entities.keys()) if (!seen.has(id)) entities.delete(id);
}

// 내 캐릭터는 로컬에서 먼저 움직이고(예측), 서버 위치와 어긋나면 보정한다.
function reconcile(sx, sy) {
  if (!me) {
    me = { x: sx, y: sy, dirX: 0, dirY: 1 };
    return;
  }
  const dx = sx - me.x, dy = sy - me.y;
  if (Math.hypot(dx, dy) > 120) {   // 크게 어긋나면 즉시 서버 위치로
    me.x = sx; me.y = sy;
  } else if (input === 0 || isBusy()) {  // 멈춰 있을 땐 서버 위치로 부드럽게 수렴
    me.x += dx * 0.3;
    me.y += dy * 0.3;
  }
}

function enterZone(msg) {
  zone = msg.z;
  me = { x: msg.x, y: msg.y, dirX: 0, dirY: msg.z ? -1 : 1 };
  entities.clear();
  petFollowers.clear();
  clearLight();  // 조명이 있는 방이면 서버가 곧바로 light 메시지를 보낸다
  clearTv();     // 영상이 나오는 방이면 서버가 곧바로 tv 메시지를 보낸다
  clearJazz();
  clearDarts();  // 다트가 있는 방이면 서버가 곧바로 dart 메시지를 보낸다
  clearOmok();   // 오목판이 있는 방이면 서버가 곧바로 omok 메시지를 보낸다
  clearDecor();  // 집 안이면 서버가 곧바로 decor 메시지를 보낸다
  roomFloor = 0; // 집 안이면 서버가 곧바로 floor 메시지를 보낸다
  roomFloorTint = '';
  setDyeOpen(false);
  setFurnShop(false);
  setCinemaFull(false);
  noteFx = [];
  cats = [];     // 고양이는 구역마다 따로 받는다
  drops = [];    // 야외로 나오면 서버가 곧바로 drops 메시지를 보낸다
  closeShop();
}
