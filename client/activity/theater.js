'use strict';
// 극장 전체화면: 영상과 함께 사람들의 얼굴과 채팅.

// ------------------------------------------------------------ 극장 전체화면

const cinemaHud = document.getElementById('cinema-hud');
const cinemaPeople = document.getElementById('cinema-people');
const cinemaForm = document.getElementById('cinema-chat');
const cinemaInput = document.getElementById('cinema-input');
const cinemaFullButton = document.getElementById('cinema-full');
const cinemaExit = document.getElementById('cinema-exit');
const cinemaGo = document.getElementById('cinema-go');   // 스크린 귀퉁이의 큰 버튼들
const cinemaBar = document.getElementById('cinema-bar');
const cinemaFlow = document.getElementById('cinema-flow');
const cinemaChatOff = document.getElementById('cinema-chat-off');
const cinemaModeButtons = { flow: document.getElementById('cinema-mode-flow'), full: document.getElementById('cinema-mode-full') };
const CINEMA_MAX_PEOPLE = 10, CINEMA_DRAW_MS = 90;
const CINEMA_MODE_KEY = 'mmo.cinemaMode', CINEMA_CHAT_KEY = 'mmo.cinemaChatOff';
const FLOW_MS = 8000, FLOW_LANES = 9, FLOW_MAX = 60;   // 글 하나가 화면을 건너는 시간, 줄 수, 한꺼번에 떠 있는 글 수
const cinemaCards = new Map();
// 보는 방식: 'room' 은 객석(극장 모드), 'full' 은 전체화면에 사람들 얼굴, 'flow' 는 전체화면에 채팅이 흘러가는 티비플
let cinemaMode = 'room';
let cinemaFull = false;   // 전체화면인지 (full 이나 flow)
let cinemaLastMode = loadSetting(CINEMA_MODE_KEY) === 'flow' ? 'flow' : 'full';   // 위쪽 버튼 줄의 전체화면이 여는 방식
let cinemaChatHidden = loadSetting(CINEMA_CHAT_KEY) === '1';   // full 에서 사람들과 채팅을 숨겼는지
let cinemaDrawnAt = 0;
const flowLaneFree = new Array(FLOW_LANES).fill(0);

function cinemaAvailable() {
  return !!terrain && isCinema() && !!tvState && !!(tvPlayer || tvReelFrame || tvShareEl);
}

function paintCinemaMode() {
  cinemaBar.hidden = !cinemaFull;
  cinemaFlow.hidden = cinemaMode !== 'flow';
  cinemaHud.hidden = !cinemaFull || (cinemaMode === 'full' && cinemaChatHidden);
  cinemaHud.classList.toggle('flow', cinemaMode === 'flow');
  for (const [mode, button] of Object.entries(cinemaModeButtons)) button.setAttribute('aria-pressed', String(mode === cinemaMode));
  cinemaChatOff.hidden = cinemaMode !== 'full';   // 티비플은 채팅이 곧 화면이다
  cinemaChatOff.setAttribute('aria-pressed', String(cinemaChatHidden));
  cinemaChatOff.textContent = cinemaChatHidden ? '채팅 켜기' : '채팅 끄기';
}

function setCinemaMode(mode) {
  if (mode === cinemaMode) return;
  const wasFull = cinemaFull;
  cinemaMode = mode;
  cinemaFull = mode !== 'room';
  tvVideoLayout = '';
  cinemaInput.blur();
  cinemaFlow.textContent = '';
  flowLaneFree.fill(0);
  if (cinemaFull) {
    cinemaLastMode = mode;
    saveSetting(CINEMA_MODE_KEY, mode);
    if (!wasFull) document.documentElement.requestFullscreen?.().catch(() => { /* 안 되면 창 안에서만 크게 보여 준다 */ });
  } else {
    cinemaInput.value = '';
    cinemaPeople.textContent = '';
    cinemaCards.clear();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  paintCinemaMode();
}

function setCinemaFull(on) {
  setCinemaMode(on ? cinemaLastMode : 'room');
}

// 티비플: 채팅 한 줄을 화면 오른쪽에서 왼쪽으로 흘려보낸다. 빈 줄을 골라 서로 겹치지 않게 한다.
function flowChat(text, mine) {
  if (cinemaMode !== 'flow') return;
  while (cinemaFlow.childElementCount >= FLOW_MAX) cinemaFlow.firstChild.remove();
  const line = document.createElement('div');
  line.className = mine ? 'flow-line mine' : 'flow-line';
  line.textContent = text;
  cinemaFlow.append(line);
  const now = performance.now(), width = line.offsetWidth, travel = innerWidth + width;
  let lane = flowLaneFree.findIndex((free) => free <= now);
  if (lane < 0) lane = flowLaneFree.indexOf(Math.min(...flowLaneFree));
  flowLaneFree[lane] = now + (width + 60) / travel * FLOW_MS;   // 이 글의 꼬리가 화면에 다 들어올 때까지 그 줄은 비워 둔다
  line.style.top = `${9 + lane * 8}%`;   // 맨 윗줄이 오른쪽 위 버튼 줄과 겹치지 않게
  const move = line.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${travel}px)` }], { duration: FLOW_MS, easing: 'linear' });
  move.onfinish = () => line.remove();
}

cinemaFullButton.addEventListener('click', () => {
  cinemaFullButton.blur();
  setCinemaFull(true);
});
for (const [mode, buttons] of [['flow', ['cinema-go-flow', 'cinema-mode-flow']], ['full', ['cinema-go-full', 'cinema-mode-full']]]) {
  for (const id of buttons) {
    const button = document.getElementById(id);
    button.addEventListener('click', () => {
      button.blur();
      setCinemaMode(mode);
    });
  }
}
cinemaChatOff.addEventListener('click', () => {
  cinemaChatOff.blur();
  cinemaChatHidden = !cinemaChatHidden;
  saveSetting(CINEMA_CHAT_KEY, cinemaChatHidden ? '1' : '0');
  cinemaInput.blur();
  paintCinemaMode();
});
cinemaExit.addEventListener('click', () => setCinemaFull(false));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) setCinemaFull(false);
});
cinemaForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = cinemaInput.value.trim();
  if (text && ws && ws.readyState === WebSocket.OPEN) ws.send('chat ' + text);
  cinemaInput.value = '';
  cinemaInput.blur();
});
cinemaInput.addEventListener('focus', () => stopMoving());

function syncCinemaHud(now) {
  const available = cinemaAvailable();
  cinemaFullButton.hidden = !available;
  cinemaGo.hidden = !available || cinemaFull;
  if (!cinemaGo.hidden) {   // 스크린의 오른쪽 아래 귀퉁이를 따라다니되 화면 밖으로는 나가지 않는다
    const [camX, camY] = camera(innerWidth, innerHeight);
    const r = tvScreenRect(tvFurniture());
    cinemaGo.style.left = `${clamp(r.x + r.w - camX - 10, 190, innerWidth - 10)}px`;
    cinemaGo.style.top = `${clamp(r.y + r.h - camY - 10, 100, innerHeight - 10)}px`;
  }
  if (!cinemaFull) return;
  if (!cinemaAvailable()) {
    setCinemaFull(false);
    return;
  }
  if (cinemaHud.hidden || cinemaMode === 'flow') return;   // 얼굴을 보여 주지 않는 동안은 그리지 않는다
  const people = [...entities.entries()].sort(([a], [b]) => (b === myId) - (a === myId)).slice(0, CINEMA_MAX_PEOPLE);
  const ids = new Set(people.map(([id]) => id));
  for (const [id, card] of cinemaCards) {
    if (ids.has(id)) continue;
    card.root.remove();
    cinemaCards.delete(id);
  }
  const redraw = now - cinemaDrawnAt >= CINEMA_DRAW_MS;
  if (redraw) cinemaDrawnAt = now;
  for (const [id, e] of people) {
    let card = cinemaCards.get(id);
    if (!card) {
      const root = document.createElement('div');
      root.className = 'cinema-person';
      const bubble = document.createElement('div');
      bubble.className = 'cinema-bubble';
      bubble.hidden = true;
      const face = document.createElement('canvas');
      face.width = 144;
      face.height = 144;
      const name = document.createElement('span');
      root.append(bubble, face, name);
      cinemaPeople.append(root);
      card = { root, bubble, face, name, shown: '' };
      cinemaCards.set(id, card);
    }
    card.name.textContent = e.name;
    const speaking = e.bubble && now <= e.bubbleUntil;
    card.bubble.hidden = !speaking;
    if (speaking && card.shown !== e.bubble) {
      card.bubble.textContent = e.bubble;
      card.shown = e.bubble;
    }
    if (redraw) {
      const c = card.face.getContext('2d');
      const emoting = e.emoteAt !== undefined && now - e.emoteAt < EMOTE_MS;
      c.clearRect(0, 0, 144, 144);
      c.save();
      c.scale(3.2, 3.2);    // 얼굴이 동그라미를 채우도록 크게
      drawCharacter(c, { ...e, x: 22.5, y: 37, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: now, emote: emoting ? e.emote : -1, emoteT: now - e.emoteAt });
      c.restore();
    }
  }
}
