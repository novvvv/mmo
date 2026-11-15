'use strict';
// 카지노 빠칭코. 기계 앞 의자에 앉으면 창이 열린다.
// 구슬이 어디로 떨어질지와 숫자판의 결과는 서버가 정한다(구슬 하나에 1골드). 화면은 그 결과로 끝나는 길을
// 미리 굴려 둔 구슬 길 가운데서 골라 보여 준다. 길은 못과 벽에 부딪히는 실제 물리로 만든다.

const pachiEl = document.getElementById('pachi');
const pachiBoard = document.getElementById('pachi-board');
const pachiGold = document.getElementById('pachi-gold');
const pachiStatus = document.getElementById('pachi-status');
const pachiPower = document.getElementById('pachi-power');
const pachiShoot = document.getElementById('pachi-shoot');

const PACHI_W = 300, PACHI_H = 420;
const PACHI_BALL = 4, PACHI_PIN = 2.2;
const PACHI_CX = 150, PACHI_CY = 150, PACHI_ARC = 132;     // 위쪽 둥근 테두리
const PACHI_LEFT = 18, PACHI_RIGHT = 262, PACHI_FLOOR = 398;  // 오른쪽 끝은 구슬이 올라가는 길
const PACHI_LCD = { x0: 112, y0: 132, x1: 188, y1: 204 };
// 구멍: 0 아웃(아래), 1 왼쪽 튤립, 2 오른쪽 튤립, 3 가운데 시작 구멍. 입구의 가운데 x, 높이 y, 반폭
const PACHI_POCKETS = [null, { x: 64, y: 304, half: 8 }, { x: 236, y: 304, half: 8 }, { x: 150, y: 288, half: 8 }];
const PACHI_FIRE_MS = 300;       // 누르고 있으면 이 간격으로 쏜다 (서버는 초당 3.5개까지 받는다)
const PACHI_STEP = 1 / 240, PACHI_FRAME = 4;   // 물리 한 걸음, 화면 한 장에 몇 걸음
const PACHI_KEEP = 4;            // 구멍마다 미리 굴려 둘 길

const PACHI_PINS = (() => {
  const pins = [];
  const near = (x, y, px, py, r) => Math.hypot(x - px, y - py) < r;
  for (let row = 0; row < 21; row++) {
    const y = 50 + row * 17;
    for (let x = 30 + (row % 2) * 11; x <= 254; x += 22) {   // 벽과 첫 못 사이에 구슬이 끼지 않게 띄운다
      if (y < PACHI_CY && Math.hypot(x - PACHI_CX, y - PACHI_CY) > PACHI_ARC - 14) continue;
      if (x > PACHI_LCD.x0 - 14 && x < PACHI_LCD.x1 + 14 && y > PACHI_LCD.y0 - 14 && y < PACHI_LCD.y1 + 14) continue;
      if (PACHI_POCKETS.some((p) => p && near(x, y, p.x, p.y - 4, 15))) continue;
      if (y > PACHI_FLOOR - 14) continue;
      pins.push([x, y]);
    }
  }
  for (const p of PACHI_POCKETS) if (p) pins.push([p.x - p.half - 4, p.y - 6], [p.x + p.half + 4, p.y - 6]);   // 입구 양옆의 못
  return pins;
})();

let pachiOpen = false;
let pachiSeed = 1;
let pachiCache = [[], [], [], []];   // 구멍별로 미리 굴려 둔 길 { frames, power }
let pachiCachePower = -1;
let pachiBalls = [];                 // 지금 굴러가는 구슬 { frames, start, pocket, msg }
let pachiQueue = [];                 // 숫자판이 돌기를 기다리는 결과 (보류, 4개까지 보인다)
let pachiSpin = null;                // 지금 도는 숫자판 { d, start, reach, win }
let pachiDigits = [7, 7, 7];
let pachiFlash = 0;                  // 대박 불빛이 끝나는 때
let pachiPops = [];                  // 판 위에 떠오르는 +골드
let pachiTulip = [0, 0, 0];          // 튤립이 마지막으로 열린 때
let pachiHolding = false;
let pachiLastShot = -Infinity;
let pachiHidden = 0;                 // 아직 화면에서 보여 주지 않은 상금 (숫자판이 멈추기 전에 골드가 먼저 늘지 않게)
let pachiServerGold = 0;
let pachiBg = null;

function pachiRandom() {   // 길을 만들 때 쓰는 가벼운 난수
  pachiSeed = (pachiSeed * 1664525 + 1013904223) >>> 0;
  return pachiSeed / 4294967296;
}

// 구슬 하나를 굴린다. power 0~1 은 손잡이 세기(놓이는 자리), 결과는 { frames: [[x, y], ...], pocket }
function pachiSimulate(power) {
  const frames = [];
  // 1) 오른쪽 길을 따라 올라가 위쪽 테두리를 돌다가, 세기만큼 간 자리에서 판 안으로 떨어진다 (세면 왼쪽, 약하면 오른쪽)
  const release = -(0.12 + 0.78 * power) * Math.PI + (pachiRandom() - 0.5) * 0.1;
  for (let t = 0; t <= 1; t += 0.08) frames.push([280, 405 - t * (405 - PACHI_CY)]);
  const radius = PACHI_ARC - 10;
  for (let a = 0; a > release; a -= 0.11) frames.push([PACHI_CX + Math.cos(a) * radius, PACHI_CY + Math.sin(a) * radius]);
  let x = PACHI_CX + Math.cos(release) * radius, y = PACHI_CY + Math.sin(release) * radius;
  const speed = 50 + pachiRandom() * 70;
  let vx = Math.sin(release) * speed, vy = -Math.cos(release) * speed;   // 반시계 방향의 접선
  // 2) 못 사이로 떨어진다
  const g = 520;
  let slow = 0;
  for (let step = 0; step < 240 * 9; step++) {
    vy += g * PACHI_STEP;
    x += vx * PACHI_STEP;
    y += vy * PACHI_STEP;
    // 위쪽 둥근 테두리와 양옆 벽
    if (y < PACHI_CY) {
      const dx = x - PACHI_CX, dy = y - PACHI_CY, d = Math.hypot(dx, dy), limit = PACHI_ARC - PACHI_BALL;
      if (d > limit) {
        const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
        x = PACHI_CX + nx * limit;
        y = PACHI_CY + ny * limit;
        if (dot > 0) { vx -= 1.5 * dot * nx; vy -= 1.5 * dot * ny; }
      }
    }
    if (x < PACHI_LEFT + PACHI_BALL) { x = PACHI_LEFT + PACHI_BALL; vx = Math.max(Math.abs(vx) * 0.5, 30); }
    if (y >= PACHI_CY && x > PACHI_RIGHT - PACHI_BALL) { x = PACHI_RIGHT - PACHI_BALL; vx = -Math.max(Math.abs(vx) * 0.5, 30); }
    // 숫자판 상자
    if (x > PACHI_LCD.x0 - PACHI_BALL && x < PACHI_LCD.x1 + PACHI_BALL && y > PACHI_LCD.y0 - PACHI_BALL && y < PACHI_LCD.y1 + PACHI_BALL) {
      const pushL = x - (PACHI_LCD.x0 - PACHI_BALL), pushR = PACHI_LCD.x1 + PACHI_BALL - x;
      const pushT = y - (PACHI_LCD.y0 - PACHI_BALL), pushB = PACHI_LCD.y1 + PACHI_BALL - y;
      const least = Math.min(pushL, pushR, pushT, pushB);
      if (least === pushT) { y -= pushT; vy = -Math.abs(vy) * 0.4; vx += (x < PACHI_CX ? -1 : 1) * 30; }
      else if (least === pushB) { y += pushB; vy = Math.abs(vy) * 0.4; }
      else if (least === pushL) { x -= pushL; vx = -Math.abs(vx) * 0.5; }
      else { x += pushR; vx = Math.abs(vx) * 0.5; }
    }
    // 못
    for (const [px, py] of PACHI_PINS) {
      const dx = x - px, dy = y - py;
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) continue;
      const d = Math.hypot(dx, dy), limit = PACHI_BALL + PACHI_PIN;
      if (d >= limit || d === 0) continue;
      const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
      x = px + nx * limit;
      y = py + ny * limit;
      if (dot < 0) {
        vx -= 1.45 * dot * nx;
        vy -= 1.45 * dot * ny;
        vx += (pachiRandom() - 0.5) * 24;   // 못마다 조금씩 다르게 튄다
      }
    }
    vx *= 0.9995;
    slow = Math.hypot(vx, vy) < 25 ? slow + PACHI_STEP : 0;
    if (slow > 0.25) {   // 못 사이에 멈추면 살짝 튕겨 낸다
      vx += (pachiRandom() < 0.5 ? -1 : 1) * 70;
      vy -= 40;
      slow = 0;
    }
    // 구멍
    for (let k = 1; k <= 3; k++) {
      const p = PACHI_POCKETS[k];
      if (vy > 0 && Math.abs(x - p.x) < p.half - 1 && y >= p.y && y - vy * PACHI_STEP < p.y) {
        frames.push([x, y], [p.x, p.y + 6]);
        return { frames, pocket: k };
      }
    }
    if (y > PACHI_FLOOR) {
      for (let k = 0; k < 6; k++) frames.push([x + (PACHI_CX - x) * (k / 6) * 0.3, PACHI_FLOOR + k * 4]);
      return { frames, pocket: 0 };
    }
    if (step % PACHI_FRAME === 0) frames.push([x, y]);
  }
  return null;   // 못 사이에 끼었다
}

// 아래로 빠진 길 가운데 구멍 바로 위를 지나는 것은 그 구멍으로 들어가게 끝을 바꿀 수 있다.
function pachiSnapInto(path, pocket) {
  const p = PACHI_POCKETS[pocket];
  for (let i = 1; i < path.frames.length; i++) {
    const [x, y] = path.frames[i], [, py] = path.frames[i - 1];
    if (y > py && Math.abs(x - p.x) < 9 && y > p.y - 26 && y < p.y - 4) {
      const frames = path.frames.slice(0, i + 1);
      for (let k = 1; k <= 5; k++) frames.push([x + (p.x - x) * (k / 5), y + (p.y + 6 - y) * (k / 5)]);
      return { frames, pocket };
    }
  }
  return null;
}

function pachiPowerValue() { return Number(pachiPower.value) / 100; }

function pachiFill(budgetMs) {
  const power = pachiPowerValue();
  if (Math.abs(power - pachiCachePower) > 0.02) {   // 세기를 바꾸면 그 세기의 길로 새로 채운다 (예전 길은 하나씩만 남긴다)
    pachiCache = pachiCache.map((list) => list.slice(-1));
    pachiCachePower = power;
  }
  const end = performance.now() + budgetMs;
  while (performance.now() < end && pachiCache.some((list) => list.length < PACHI_KEEP)) {
    const path = pachiSimulate(Math.min(1, Math.max(0, power + (pachiRandom() - 0.5) * 0.06)));
    if (!path) continue;
    if (pachiCache[path.pocket].length < PACHI_KEEP) pachiCache[path.pocket].push(path);
    if (path.pocket === 0) {
      for (let k = 1; k <= 3; k++) {
        if (pachiCache[k].length >= PACHI_KEEP) continue;
        const snapped = pachiSnapInto(path, k);
        if (snapped) pachiCache[k].push(snapped);
      }
    }
  }
}

function pachiTake(pocket) {
  if (!pachiCache[pocket].length) {
    for (let tries = 0; tries < 400 && !pachiCache[pocket].length; tries++) {
      const path = pachiSimulate(pachiPowerValue());
      if (!path) continue;
      if (path.pocket === pocket) pachiCache[pocket].push(path);
      else if (path.pocket === 0 && pocket) {
        const snapped = pachiSnapInto(path, pocket);
        if (snapped) pachiCache[pocket].push(snapped);
      }
    }
  }
  if (pachiCache[pocket].length) return pachiCache[pocket].shift();
  const p = PACHI_POCKETS[pocket] || { x: PACHI_CX, y: PACHI_FLOOR + 10 };   // 끝내 못 찾으면 곧장 떨어지는 길
  const frames = [];
  for (let k = 0; k <= 40; k++) frames.push([280 - (280 - p.x) * (k / 40), 120 + (p.y - 120) * (k / 40)]);
  return { frames, pocket };
}

// ---- 서버와 주고받기

function pachiAtSeat() {
  const e = myId !== null ? entities.get(myId) : null;
  return !!(e && e.seat && terrain?.pachi?.includes(e.seat - 1));
}

let pachiFailed = false;
function syncPachinko(now) {
  const open = pachiAtSeat();
  if (open !== pachiOpen) setPachiOpen(open);
  if (!pachiOpen) return;
  try {   // 빠칭코 그림이 잘못되어도 게임 화면은 멈추지 않게
    pachiFill(3);
    if (pachiHolding && now - pachiLastShot >= PACHI_FIRE_MS) pachiFire(now);
    drawPachinko(now);
  } catch (err) {
    if (!pachiFailed) console.error(err);
    pachiFailed = true;
  }
}

function setPachiOpen(open) {
  pachiOpen = open;
  pachiEl.hidden = !open;
  pachiHolding = false;
  if (open) {
    pachiServerGold = myGold;
    pachiHidden = 0;
    pachiStatus.textContent = '';
    pachiShowGold();
    restoreWindow(pachiEl, 'pachi');
    Sound.play('page');
  } else {
    pachiBalls = [];
    pachiQueue = [];
    pachiSpin = null;
    if (pachiHidden) {   // 일어나면 아직 보여 주지 않은 상금도 바로 보인다
      pachiHidden = 0;
      myGold = pachiServerGold;
      if (typeof refreshGoldDisplays === 'function') refreshGoldDisplays();
    }
  }
}

function pachiFire(now) {
  pachiLastShot = now;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (pachiServerGold < (world.pachiCost || 1)) {
    pachiStatus.textContent = '골드가 모자라요.';
    pachiHolding = false;
    return;
  }
  ws.send('pachi shoot');
  Sound.play('launch');
}

function pachiShowGold() {
  pachiGold.textContent = `${Math.max(0, pachiServerGold - pachiHidden).toLocaleString()} G`;
}

function pachiReveal(amount) {
  pachiHidden = Math.max(0, pachiHidden - amount);
  myGold = pachiServerGold - pachiHidden;
  pachiShowGold();
  if (typeof refreshGoldDisplays === 'function') refreshGoldDisplays();
}

function applyPachi(msg) {
  if (msg.e === 'gold') {
    pachiStatus.textContent = '골드가 모자라요.';
    pachiHolding = false;
    return;
  }
  pachiServerGold = msg.g;
  pachiHidden += msg.w;
  pachiShowGold();
  if (!pachiOpen) {
    pachiReveal(pachiHidden);
    return;
  }
  const path = pachiTake(msg.r);
  pachiBalls.push({ frames: path.frames, start: performance.now(), pocket: msg.r, msg });
}

function pachiLanded(ball, now) {
  const { pocket, msg } = ball;
  if (pocket === 1 || pocket === 2) {
    pachiTulip[pocket] = now;
    pachiPops.push({ x: PACHI_POCKETS[pocket].x, y: PACHI_POCKETS[pocket].y - 10, text: `+${msg.w}`, at: now });
    pachiReveal(msg.w);
    Sound.play('pocket');
  } else if (pocket === 3) {
    pachiTulip[0] = now;
    const base = msg.w - (msg.j || 0);   // 시작 구멍의 1골드는 바로, 대박 상금(j)은 숫자판이 멈출 때
    pachiPops.push({ x: PACHI_CX, y: PACHI_POCKETS[3].y - 12, text: `+${base}`, at: now });
    pachiReveal(base);
    if (pachiQueue.length < 8) pachiQueue.push({ d: msg.d, win: msg.w - base });
    else pachiReveal(msg.w - base);
    Sound.play('pocket');
  }
}

// 숫자판: 왼쪽, 오른쪽, 가운데 순으로 멈춘다. 왼쪽과 가운데가 같으면 리치(가운데가 천천히 돈다)
const PACHI_STOPS = [700, 1200, 1900];
const PACHI_REACH_MS = 1500;

function pachiStepSpin(now) {
  if (!pachiSpin && pachiQueue.length) {
    const next = pachiQueue.shift();
    // 서버의 d = [왼쪽, 오른쪽, 가운데]. 왼쪽과 오른쪽이 같으면 리치
    pachiSpin = { d: next.d, win: next.win, start: now, reach: next.d[0] === next.d[1], announced: false };
  }
  if (!pachiSpin) return;
  const t = now - pachiSpin.start, s = pachiSpin;
  const end = PACHI_STOPS[2] + (s.reach ? PACHI_REACH_MS : 0);
  const rolling = (k) => 1 + Math.floor((now / (k === 2 && s.reach && t > PACHI_STOPS[1] ? 160 : 60) + k * 3)) % 9;
  pachiDigits = [t >= PACHI_STOPS[0] ? s.d[0] : rolling(0), t >= end ? s.d[2] : rolling(2), t >= PACHI_STOPS[1] ? s.d[1] : rolling(1)];
  if (s.reach && !s.announced && t >= PACHI_STOPS[1]) {
    s.announced = true;
    Sound.play('reach');
  }
  if (t < end) {
    if (Math.floor(t / 90) !== Math.floor((t - 16) / 90)) Sound.play('reel');
    return;
  }
  if (s.d[0] === s.d[1] && s.d[1] === s.d[2]) {
    pachiFlash = now + 2600;
    pachiPops.push({ x: PACHI_CX, y: PACHI_LCD.y1 + 26, text: `대박! +${s.win}`, at: now, big: true });
    pachiReveal(s.win);
    Sound.play('jackpot');
    if (me) addDamageFx(me.x, me.y - 70, `+${s.win}G`, '#ffd76a');
  }
  if (t > end + (s.d[0] === s.d[1] && s.d[1] === s.d[2] ? 1400 : 350)) pachiSpin = null;
}

// ---- 그리기

function pachiBackground() {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = PACHI_W * dpr;
  canvas.height = PACHI_H * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  const bg = c.createLinearGradient(0, 0, 0, PACHI_H);
  bg.addColorStop(0, '#3a1050');
  bg.addColorStop(1, '#1a0c2a');
  c.fillStyle = bg;
  c.fillRect(0, 0, PACHI_W, PACHI_H);
  // 판: 위는 둥글고 아래는 네모
  c.beginPath();
  c.arc(PACHI_CX, PACHI_CY, PACHI_ARC, Math.PI, 0);
  c.lineTo(PACHI_CX + PACHI_ARC, PACHI_FLOOR + 10);
  c.lineTo(PACHI_CX - PACHI_ARC, PACHI_FLOOR + 10);
  c.closePath();
  const field = c.createRadialGradient(PACHI_CX, 200, 20, PACHI_CX, 220, 240);
  field.addColorStop(0, '#fff6ff');
  field.addColorStop(1, '#c7b8f0');
  c.fillStyle = field;
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = '#e8b830';
  c.stroke();
  // 구슬이 올라가는 오른쪽 길
  c.fillStyle = 'rgba(40, 20, 60, 0.18)';
  c.fillRect(PACHI_RIGHT, PACHI_CY, 20, PACHI_FLOOR - PACHI_CY + 10);
  c.fillStyle = '#e8b830';
  c.fillRect(PACHI_RIGHT - 1, PACHI_CY + 14, 3, PACHI_FLOOR - PACHI_CY - 4);
  // 못
  c.fillStyle = '#8a8fa0';
  for (const [x, y] of PACHI_PINS) {
    c.beginPath();
    c.arc(x, y, PACHI_PIN, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#ffffff';
  for (const [x, y] of PACHI_PINS) c.fillRect(x - 1, y - 1.2, 1, 1);
  // 아래의 아웃 구멍
  c.fillStyle = '#2a1840';
  c.beginPath();
  c.ellipse(PACHI_CX, PACHI_FLOOR + 6, 22, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.font = `700 9px ${FONT}`;
  c.textAlign = 'center';
  c.fillStyle = '#c7b8f0';
  c.fillText('OUT', PACHI_CX, PACHI_FLOOR + 9);
  return canvas;
}

function drawPachiPocket(c, k, now) {
  const p = PACHI_POCKETS[k];
  const open = now - pachiTulip[k === 3 ? 0 : k] < 400;
  const color = k === 3 ? '#e8b830' : '#ff5aa8';
  c.fillStyle = '#2a1840';
  c.fillRect(p.x - p.half, p.y, p.half * 2, 10);
  c.fillStyle = color;
  const spread = open ? 7 : 2;
  c.beginPath();   // 튤립 날개
  c.moveTo(p.x - p.half, p.y);
  c.lineTo(p.x - p.half - spread, p.y - 10);
  c.lineTo(p.x - p.half - 3, p.y + 2);
  c.moveTo(p.x + p.half, p.y);
  c.lineTo(p.x + p.half + spread, p.y - 10);
  c.lineTo(p.x + p.half + 3, p.y + 2);
  c.fill();
  c.fillRect(p.x - p.half - 3, p.y + 8, p.half * 2 + 6, 4);
  c.font = `800 8px ${FONT}`;
  c.textAlign = 'center';
  c.fillStyle = '#4a2a60';
  c.fillText(k === 3 ? '시작' : '+2', p.x, p.y + 22);
}

function drawPachinko(now) {
  const dpr = window.devicePixelRatio || 1;
  if (pachiBoard.width !== PACHI_W * dpr) {
    pachiBoard.width = PACHI_W * dpr;
    pachiBoard.height = PACHI_H * dpr;
    pachiBg = null;
  }
  if (!pachiBg) pachiBg = pachiBackground();
  const c = pachiBoard.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(pachiBg, 0, 0);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let k = 1; k <= 3; k++) drawPachiPocket(c, k, now);

  pachiStepSpin(now);
  // 숫자판
  const { x0, y0, x1, y1 } = PACHI_LCD, flashing = now < pachiFlash;
  c.fillStyle = flashing && Math.floor(now / 120) % 2 ? '#ffe28a' : '#14111c';
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = '#e8b830';
  c.lineWidth = 3;
  c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const reachNow = pachiSpin && pachiSpin.reach && now - pachiSpin.start >= PACHI_STOPS[1] && now - pachiSpin.start < PACHI_STOPS[2] + PACHI_REACH_MS;
  pachiDigits.forEach((d, i) => {
    const cx = x0 + 16 + i * 30;
    c.fillStyle = '#26203a';
    c.fillRect(cx - 12, y0 + 12, 24, 40);
    c.font = `800 26px ${FONT}`;
    c.fillStyle = d === 7 ? '#ff5a5a' : flashing ? '#2a1840' : '#ffe066';
    c.fillText(String(d), cx, y0 + 33);
  });
  if (reachNow) {
    c.font = `800 13px ${FONT}`;
    c.fillStyle = Math.floor(now / 150) % 2 ? '#ff5aa8' : '#ffe066';
    c.fillText('리치!', PACHI_CX, y1 - 12);
  } else {
    for (let i = 0; i < 4; i++) {   // 보류: 기다리는 숫자판
      c.fillStyle = i < pachiQueue.length ? '#ffe066' : '#3a3050';
      c.beginPath();
      c.arc(PACHI_CX - 18 + i * 12, y1 - 12, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  // 구슬
  pachiBalls = pachiBalls.filter((ball) => {
    const i = Math.max(0, Math.floor((now - ball.start) / (1000 / 60)));   // 화면 시각이 구슬을 받은 때보다 조금 이를 수 있다
    if (i >= ball.frames.length) {
      pachiLanded(ball, now);
      return false;
    }
    const [x, y] = ball.frames[i];
    const shine = c.createRadialGradient(x - 1.3, y - 1.3, 0.5, x, y, PACHI_BALL);
    shine.addColorStop(0, '#ffffff');
    shine.addColorStop(1, '#8a92a6');
    c.fillStyle = shine;
    c.beginPath();
    c.arc(x, y, PACHI_BALL, 0, Math.PI * 2);
    c.fill();
    return true;
  });
  // 떠오르는 상금
  pachiPops = pachiPops.filter((p) => now - p.at < (p.big ? 2200 : 900));
  for (const p of pachiPops) {
    const t = (now - p.at) / (p.big ? 2200 : 900);
    c.globalAlpha = Math.min(1, (1 - t) * 2);
    c.font = `800 ${p.big ? 22 : 12}px ${FONT}`;
    c.lineWidth = 3;
    c.strokeStyle = '#2a1840';
    c.fillStyle = p.big ? '#ffe066' : '#ff5aa8';
    c.strokeText(p.text, p.x, p.y - t * 18);
    c.fillText(p.text, p.x, p.y - t * 18);
  }
  c.globalAlpha = 1;
  if (flashing) {   // 대박이면 테두리가 번쩍인다
    c.strokeStyle = Math.floor(now / 100) % 2 ? '#ffe066' : '#ff5aa8';
    c.lineWidth = 8;
    c.strokeRect(4, 4, PACHI_W - 8, PACHI_H - 8);
  }
}

// ---- 조작

function pachiKey(e, down) {
  if (!pachiOpen) return false;
  if (e.code === 'Space') {
    if (e.preventDefault) e.preventDefault();
    if (down && !pachiHolding) {
      pachiHolding = true;
      pachiFire(performance.now());
    } else if (!down) {
      pachiHolding = false;
    }
    return true;
  }
  if (down && e.key === 'Escape') {
    pachiLeave();
    return true;
  }
  return false;
}

function pachiLeave() {
  pachiHolding = false;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send('use sit');
}

pachiShoot.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pachiShoot.setPointerCapture(e.pointerId);
  pachiHolding = true;
  pachiFire(performance.now());
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pachiShoot.addEventListener(type, () => { pachiHolding = false; });
document.getElementById('pachi-leave').addEventListener('click', pachiLeave);
document.getElementById('pachi-close').addEventListener('click', pachiLeave);
pachiPower.addEventListener('change', () => pachiPower.blur());
