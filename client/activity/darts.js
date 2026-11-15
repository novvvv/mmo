'use strict';
// 다트 창: 대기실, 조준선, 점수표.

// ------------------------------------------------------------ 재즈바 다트

const dartsEl = document.getElementById('darts');
const dartsInfo = document.getElementById('darts-info');
const dartsScore = document.getElementById('darts-score');
const dartsBoard = document.getElementById('darts-board');
const dartsStatus = document.getElementById('darts-status');
const dartsActions = document.getElementById('darts-actions');
const DART_IDLE = 0, DART_LOBBY = 1, DART_PLAYING = 2, DART_FINISHED = 3;  // 서버의 DartState 와 같은 순서
const DART_AIM_X = 0, DART_AIM_Y = 1, DART_PAUSE = 2;                      // 서버의 DartPhase 와 같은 순서
const DART_COLORS = ['#4f8cff', '#ffb020', '#e5484d'];
const DART_FLY_MS = 160;

let dartState = null;       // 서버의 dart 메시지. 재즈바 안에서만 있다
let dartLockSent = false;   // 이번 단계에 이미 멈추기를 보냈다
let dartHitAt = 0;

function sendDart(command) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`dart ${command}`);
}

function amInDarts() {
  return !!dartState && dartState.players.some(([id]) => id === myId);
}

function myDartTurn() {
  const g = dartState;
  return !!g && g.st === DART_PLAYING && g.phase !== DART_PAUSE && g.players[g.turn][0] === myId;
}

function dartElapsed() {
  return dartState.age + (performance.now() - dartState.at) / 1000;
}

// 서버의 darts::sweep 과 같은 계산이다.
function dartSweep() {
  const u = dartState.off + dartElapsed() / terrain.dartPeriod;
  return terrain.dartAmp * (4 * Math.abs(u - Math.floor(u) - 0.5) - 1);
}

function dartLock() {
  if (!myDartTurn() || dartLockSent) return;
  dartLockSent = true;
  sendDart(`lock ${dartState.seq} ${Math.round(dartElapsed() * 1000)}`);
}

function setDartsOpen(open) {
  dartsEl.hidden = !open;
}

function dartButton(text, onClick, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  dartsActions.append(button);
}

function renderDartPlayers() {
  const g = dartState;
  dartsScore.textContent = '';
  g.players.forEach(([id, name, score], i) => {
    const row = document.createElement('div');
    row.className = 'darts-player';
    row.classList.toggle('turn', g.st === DART_PLAYING && i === g.turn);
    row.classList.toggle('win', g.st === DART_FINISHED && g.win.includes(id));
    const dot = document.createElement('span');
    dot.className = 'darts-dot';
    dot.style.background = DART_COLORS[i % DART_COLORS.length];
    const label = document.createElement('span');
    label.className = 'darts-name';
    label.textContent = name;
    const marks = document.createElement('span');
    marks.className = 'darts-marks';
    marks.textContent = g.st === DART_PLAYING && i === g.turn ? g.hits.map((h) => h[3]).join(' ') : '';
    const total = document.createElement('b');
    total.textContent = g.st === DART_LOBBY ? '' : String(score);
    row.append(dot, label, marks, total);
    dartsScore.append(row);
  });
}

function dartPlayStatus() {
  const g = dartState, name = g.players[g.turn][1];
  if (g.phase === DART_PAUSE) {
    const last = g.hits.at(-1);
    return last ? `${name}: ${last[3]} · ${last[2]}점` : `${name}님부터 시작합니다`;
  }
  if (!myDartTurn()) return `${name} 차례`;
  return g.phase === DART_AIM_X ? 'Space: 가로 위치 멈추기' : 'Space: 세로 위치 멈추기 (던지기)';
}

function renderDarts() {
  const g = dartState;
  dartsActions.textContent = '';
  if (!g) return;
  const mine = amInDarts(), playing = g.st === DART_PLAYING;
  dartsBoard.hidden = !playing;
  dartsInfo.textContent = playing ? `라운드 ${g.round}/${g.rounds} · ${Math.min(g.hits.length + 1, 3)}번째` : g.st === DART_LOBBY ? `${g.players.length}/${g.size}명` : '';
  renderDartPlayers();
  if (g.st === DART_IDLE || g.st === DART_FINISHED) {
    const winners = g.players.filter(([id]) => g.win.includes(id)).map(([, name]) => name).join(', ');
    dartsStatus.textContent = g.st === DART_FINISHED ? `우승: ${winners}` : '3발씩 4라운드, 합계 점수가 높은 사람이 이깁니다. 몇 명이서 겨룰까요?';
    dartButton('2인', () => sendDart('new 2'));
    dartButton('3인', () => sendDart('new 3'));
  } else if (g.st === DART_LOBBY) {
    dartsStatus.textContent = mine ? '다른 사람이 참가하기를 기다리는 중입니다' : `${g.size}인 게임에 참가할 수 있습니다`;
    if (mine) dartButton('나가기', () => sendDart('leave'));
    else dartButton('참가', () => sendDart('join'));
  } else {
    dartsStatus.textContent = dartPlayStatus();
    if (myDartTurn()) dartButton('멈추기', dartLock);
    if (mine) dartButton('기권', () => sendDart('leave'));
  }
}

function applyDart(msg) {
  const before = dartState;
  dartState = { ...msg, at: performance.now() };
  dartLockSent = false;
  if (msg.hits.length > (before ? before.hits.length : 0)) {
    dartHitAt = dartState.at;
    Sound.play('dart');
  }
  const myTurnBegins = msg.st === DART_PLAYING && msg.phase === DART_AIM_X && msg.hits.length === 0 && msg.players[msg.turn][0] === myId;
  if (myTurnBegins || (msg.st === DART_PLAYING && before?.st !== DART_PLAYING && amInDarts())) setDartsOpen(true);  // 창을 닫고 돌아다녀도 내 차례가 되면 다시 연다
  renderDarts();
}

function clearDarts() {
  dartState = null;
  setDartsOpen(false);
}

// 다트를 던지는 곳: 재즈바의 던지는 선, 집에 놓은 다트판
function dartLine() {
  return terrain.furnByZone[zone].find((f) => f.k === 'dart_line' || f.k === 'dart_stand');
}

function dartInReach(self) {
  const line = dartLine();
  return !!line && Math.hypot(line.x - self.x, line.y - self.y) <= terrain.dartReach;
}

function drawDartsPanel() {
  const g = dartState;
  if (dartsEl.hidden || !g || g.st !== DART_PLAYING) return;
  const c = dartsBoard.getContext('2d'), size = dartsBoard.width, mid = size / 2, R = size * 0.4, now = performance.now();
  c.clearRect(0, 0, size, size);
  drawDartBoard(c, mid, mid, R, true);
  g.hits.forEach(([x, y], i) => {
    const flying = i === g.hits.length - 1 ? Math.max(0, 1 - (now - dartHitAt) / DART_FLY_MS) : 0;
    drawDart(c, mid + x * R, mid + y * R, 2 + flying * 3, DART_COLORS[g.turn % DART_COLORS.length]);
  });
  if (g.phase === DART_PAUSE) return;
  const aim = dartSweep(), x = mid + (g.phase === DART_AIM_X ? aim : g.lx) * R;
  c.strokeStyle = '#ff4d6d';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, 0);
  c.lineTo(x, size);
  if (g.phase === DART_AIM_Y) {
    c.moveTo(0, mid + aim * R);
    c.lineTo(size, mid + aim * R);
  }
  c.stroke();
}

dartsEl.querySelector('#darts-close').addEventListener('click', () => setDartsOpen(false));
