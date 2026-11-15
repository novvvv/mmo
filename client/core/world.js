'use strict';
// 지형(서버가 보낸 지도)과 낮밤.

// ------------------------------------------------------------ 지형

function setTerrain(m) {
  terrain = m;
  shopOpenButton.hidden = !m.shopAnywhere;
  riverPath = new Path2D();
  m.top.forEach((y, i) => riverPath.lineTo(i * m.step, y));
  for (let i = m.bot.length - 1; i >= 0; i--) riverPath.lineTo(i * m.step, m.bot[i]);
  riverPath.closePath();
  riverNorth = Math.min(...m.top);
  riverSouth = Math.max(...m.bot);

  // 구역별로 찾아 쓰는 목록을 미리 나눠 둔다.
  m.furnByZone = m.zones.map((_, i) => m.furn.filter((f) => f.z === i));
  m.solidsByZone = m.zones.map((_, i) => m.solids.filter((s) => s[0] === i));
  m.staticFurn = m.furnByZone.slice();
  m.staticSolids = m.solidsByZone.slice();
  m.staticSeats = m.seats.length;
  applyExteriors();
  buildMinimap();
}

// bankAt ~ stepMove 는 서버의 River, World::move 와 같은 계산이다.
// 내 캐릭터의 예측 이동이 서버 판정과 어긋나지 않게 맞춘다.
function bankAt(table, x) {
  const pos = clamp(x / terrain.step, 0, table.length - 1);
  const i = Math.min(Math.floor(pos), table.length - 2);
  return table[i] + (table[i + 1] - table[i]) * (pos - i);
}

function overWater(x, y) {
  return y > bankAt(terrain.top, x) && y < bankAt(terrain.bot, x);
}

function inChannel(x, y) {
  return y > bankAt(terrain.top, x) - terrain.margin && y < bankAt(terrain.bot, x) + terrain.margin;
}

function onBridge(x) {
  return x >= terrain.bridge[0] + terrain.margin && x <= terrain.bridge[1] - terrain.margin;
}

function blockedAt(z, x, y) {
  const m = terrain.body;
  return terrain.solidsByZone[z].some((s) => x > s[1] - m && x < s[3] + m && y > s[2] - m && y < s[4] + m);
}

function stepMove(pos, nx, ny) {
  if (terrain) {
    if (zone === 0) {
      if (overWater(pos.x, pos.y) && onBridge(pos.x)) {
        nx = clamp(nx, terrain.bridge[0] + terrain.margin, terrain.bridge[1] - terrain.margin);
      }
      if (inChannel(nx, ny) && !onBridge(nx)) {
        const t = bankAt(terrain.top, nx) - terrain.margin;
        const b = bankAt(terrain.bot, nx) + terrain.margin;
        ny = ny < (t + b) / 2 ? t : b;
      }
    }
    if (!blockedAt(zone, pos.x, pos.y)) {
      if (blockedAt(zone, nx, pos.y)) nx = pos.x;
      if (blockedAt(zone, nx, ny)) ny = pos.y;
    }
  }
  pos.x = nx;
  pos.y = ny;
}

function waterDistance(x, y) {
  const top = bankAt(terrain.top, x), bot = bankAt(terrain.bot, x);
  if (y < top) return top - y;
  if (y > bot) return y - bot;
  return 0;
}

// 앉아 있거나 낚시 중이면 서버가 캐릭터를 움직이지 않는다.
function isBusy() {
  const e = entities.get(myId);
  return offline || (!!e && (e.seat > 0 || e.fish > 0));
}

// ------------------------------------------------------------ 낮과 밤

function dayPhase(now) {
  if (!clockSync) return 0;
  return (clockSync.phase + (now - clockSync.at) / 1000) % (clockSync.len * 2);
}

// 0(낮) ~ 1(밤). 바뀌기 전에 천천히 어두워지거나 밝아진다.
function nightAmount(now) {
  if (!clockSync) return 0;
  const p = dayPhase(now), L = clockSync.len;
  const fade = Math.min(NIGHT_FADE_SEC, L / 4);
  if (p < L - fade) return 0;
  if (p < L) return (p - (L - fade)) / fade;
  if (p < 2 * L - fade) return 1;
  return 1 - (p - (2 * L - fade)) / fade;
}

function timeLabel(now) {
  if (!clockSync) return '';
  const p = dayPhase(now), L = clockSync.len;
  const isDay = p < L;
  const remain = Math.ceil(((isDay ? L : 2 * L) - p) / 60);
  return isDay ? `낮 · 밤까지 ${remain}분` : `밤 · 낮까지 ${remain}분`;
}
