// 도트 데모. 서버 없이 이 브라우저 안에서만 돈다. 모든 그림은 이 파일이 픽셀 단위로 직접 찍는다.
'use strict';

const WORLD_W = 960, WORLD_H = 720;
const TAU = Math.PI * 2;
const WALK_SPEED = 76;   // 초당 픽셀
const USER_KEY = 'mmo.pixel.user';

// ------------------------------------------------------------ 기본 도구

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x, y, s) => valueNoise(x, y, s) * 0.6 + valueNoise(x * 2.1, y * 2.1, s + 1) * 0.3 + valueNoise(x * 4.3, y * 4.3, s + 2) * 0.1;

function makeRandom(seed) {
  let n = seed;
  return () => {
    n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const colorCache = new Map();
function rgb(hex) {
  let value = colorCache.get(hex);
  if (value === undefined) {
    const n = parseInt(hex.slice(1), 16);
    value = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
    colorCache.set(hex, value);
  }
  return value;
}

function shade(c, f) {
  const r = Math.min(255, (c & 0xff) * f), g = Math.min(255, ((c >> 8) & 0xff) * f), b = Math.min(255, ((c >> 16) & 0xff) * f);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

const pick = (list, n) => rgb(list[clamp(Math.floor(n * list.length), 0, list.length - 1)]);

class Pix {
  constructor(w, h) {
    this.w = Math.ceil(w);
    this.h = Math.ceil(h);
    this.d = new Uint32Array(this.w * this.h);
  }
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  canvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.d.buffer), this.w, this.h), 0, 0);
    return canvas;
  }
}

// 돌멩이와 잎 뭉치의 무늬를 만드는 보로노이 셀. 결과 객체는 호출마다 다시 쓴다.
function voronoi(cell, seed, jitter = 0.85) {
  const out = { d1: 0, d2: 0, cx: 0, cy: 0, h: 0 };
  return (x, y) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let d1 = 1e9, d2 = 1e9;
    for (let j = gy - 1; j <= gy + 1; j++) {
      for (let i = gx - 1; i <= gx + 1; i++) {
        const px = (i + 0.5 + (hash2(i, j, seed) - 0.5) * jitter) * cell;
        const py = (j + 0.5 + (hash2(i, j, seed + 7) - 0.5) * jitter) * cell;
        const d = Math.hypot(px - x, py - y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          out.cx = px;
          out.cy = py;
          out.h = hash2(i, j, seed + 13);
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    out.d1 = d1;
    out.d2 = d2;
    return out;
  };
}

// ------------------------------------------------------------ 팔레트

const GRASS = ['#5f6423', '#716f27', '#85802b', '#99902f', '#ada135', '#c0b03f'];
const DIRT = ['#683529', '#774130', '#864c35', '#94583b', '#a26542'];
const WATER = ['#4a5a47', '#4f604b', '#55674f', '#5b6e54', '#617558', '#687c5e'];
const WATER_BLUE = ['#3e8a90', '#59a4a3'];
const BANK = ['#3a2329', '#4a2d33', '#5b3a3c', '#6b4646', '#7c5750'];
const COBBLE = ['#a96c36', '#b97a3c', '#c98a45', '#d99a4e', '#e3ab5c', '#eebb70'];
const WALL = ['#7a4030', '#8c4c37', '#9e5a41', '#b26a4c', '#c07a58'];
const ARCH_STONE = ['#b57a58', '#c48a64', '#d19b74'];
const LEAF_FALL = ['#e0701c', '#c8451c', '#f0a02a', '#a83218', '#f3c23c'];

const RAMPS = {
  orange: ['#4a2314', '#7a3513', '#a84f14', '#d2701a', '#ee9722', '#fbc044', '#ffe07a'],
  red: ['#45151a', '#6e1d1c', '#9b2a1b', '#c43d1d', '#e25a25', '#f5853a', '#ffb061'],
  yellow: ['#5a3a12', '#86591a', '#ad7f1e', '#d3a526', '#eccb3a', '#f9e36a', '#fff3a0'],
  rust: ['#3d1c17', '#64291a', '#8b3b1b', '#b0521e', '#cc6f26', '#e59238', '#f5b860'],
  green: ['#22331c', '#354a22', '#4c6128', '#667a2e', '#849337', '#a6ad48', '#c7c667'],
};

// ------------------------------------------------------------ 지형의 모양

const riverY = (x) => 560 - 0.46 * x + 14 * Math.sin(x / 70 + 1) + 7 * Math.sin(x / 31);
const riverHalf = (x) => 70 + 8 * Math.sin(x / 53 + 2);

// 다리: L 이 앞쪽 난간의 시작점, D 가 길이 방향, P 가 너비 방향이다. 가운데가 lift 만큼 솟는다.
const BRIDGE = { x: 314, y: 304, dx: 250, dy: 120, px: 72, py: -40, lift: 18 };
BRIDGE.length = Math.hypot(BRIDGE.dx, BRIDGE.dy);
BRIDGE.width = Math.hypot(BRIDGE.px, BRIDGE.py);
const ARCHES = [{ at: 0.36, half: 40 }, { at: 0.71, half: 38 }];
const ARCH_SPRING = 36, ARCH_RISE = 26;

const bridgeLift = (t) => BRIDGE.lift * Math.sin(Math.PI * clamp(t, 0, 1));
const bridgeX = (t, s) => BRIDGE.x + t * BRIDGE.dx + s * BRIDGE.px;
const bridgeY = (t, s) => BRIDGE.y + t * BRIDGE.dy + s * BRIDGE.py - bridgeLift(t);

const PATHS = [
  [[150, -30], [205, 90], [262, 190], [332, 262], [352, 286]],
  [[598, 404], [690, 452], [800, 470], [990, 520]],
];
const PATH_WIDTH = 22;

function pathDistance(x, y) {
  let best = 1e9;
  for (const path of PATHS) {
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i], [bx, by] = path[i + 1];
      const lx = bx - ax, ly = by - ay;
      const t = clamp(((x - ax) * lx + (y - ay) * ly) / (lx * lx + ly * ly), 0, 1);
      best = Math.min(best, Math.hypot(ax + lx * t - x, ay + ly * t - y));
    }
  }
  return best;
}

// ------------------------------------------------------------ 소품

function makeCanopy(pix, cx, cy, R, ramp, seed) {
  const random = makeRandom(seed);
  const leafCell = 3.6, clumpCell = Math.max(6, R / 3.4);   // 작은 잎이 모여 덩어리를 이룬다
  const lobes = [{ x: cx, y: cy, r: R * 0.72 }];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + random() * 0.5;
    lobes.push({ x: cx + Math.cos(a) * R * (0.5 + random() * 0.15), y: cy + Math.sin(a) * R * (0.42 + random() * 0.14), r: R * (0.36 + random() * 0.14) });
  }
  const inside = (x, y) => lobes.some((l) => Math.hypot(x - l.x, y - l.y) <= l.r);
  const leaves = voronoi(leafCell, seed, 1), clumps = voronoi(clumpCell, seed + 5);
  for (let y = Math.floor(cy - R * 1.15); y <= cy + R * 1.15; y++) {
    for (let x = Math.floor(cx - R * 1.2); x <= cx + R * 1.2; x++) {
      const leaf = leaves(x, y);
      if (!inside(leaf.cx, leaf.cy)) continue;
      const clump = clumps(leaf.cx, leaf.cy);
      const nx = (clump.cx - cx) / R, ny = (clump.cy - cy) / R;
      const sphere = -0.62 * ny - 0.28 * nx + (clump.h - 0.5) * 0.3;
      const onClump = -((leaf.cx - clump.cx) * 0.3 + (leaf.cy - clump.cy) * 0.95) / clumpCell;
      const onLeaf = -((x - leaf.cx) * 0.3 + (y - leaf.cy) * 0.9) / leafCell;
      let level = sphere * 0.42 + onClump * 0.72 + onLeaf * 0.14 + (leaf.h - 0.5) * 0.16 + 0.5;
      if (leaf.d2 - leaf.d1 < 0.8) level -= 0.07;
      pix.set(x, y, pick(ramp, level));
    }
  }
}

function makeTree(R, rampName, seed) {
  const ramp = RAMPS[rampName];
  const w = Math.ceil(R * 2.5), h = Math.ceil(R * 2.65);
  const pix = new Pix(w, h);
  const cx = w / 2, cy = R * 1.1, half = Math.max(3, Math.round(R * 0.13));
  const trunk = rgb('#4c2c1d'), trunkLight = rgb('#6f4429'), trunkDark = rgb('#2f1b14');
  for (let y = Math.floor(cy); y < h; y++) {
    const flare = Math.max(0, (y - (h - 9)) * 0.6);
    for (let x = -half - flare; x <= half + flare; x++) {
      const side = x / (half + flare);
      pix.set(cx + x, y, side < -0.45 ? trunkLight : side > 0.5 ? trunkDark : trunk);
    }
  }
  makeCanopy(pix, cx, cy, R, ramp, seed);
  return { canvas: pix.canvas(), w, h };
}

function makeBush(R, rampName, seed, flowers) {
  const ramp = RAMPS[rampName];
  const w = Math.ceil(R * 2.6), h = Math.ceil(R * 2.1);
  const pix = new Pix(w, h);
  makeCanopy(pix, w / 2, h - R * 0.95, R, ramp, seed);
  if (flowers) {
    const random = makeRandom(seed + 1);
    for (let i = 0; i < R; i++) {
      const a = random() * TAU, d = random() * R * 0.8, x = w / 2 + Math.cos(a) * d, y = h - R * 0.95 + Math.sin(a) * d * 0.7;
      if (!pix.get(x | 0, y | 0)) continue;
      pix.rect(x, y, 2, 2, rgb('#f6e6b0'));
      pix.set(x, y, rgb('#e89a3c'));
    }
  }
  return { canvas: pix.canvas(), w, h };
}

function makeFern(seed) {
  const random = makeRandom(seed);
  const w = 34, h = 24;
  const pix = new Pix(w, h);
  const colors = RAMPS.green.slice(2).concat('#c7a93c');
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * (0.12 + (i / 10) * 0.76), length = 14 + random() * 7, color = rgb(colors[Math.floor(random() * colors.length)]);
    for (let d = 0; d < length; d += 0.5) {
      const bend = (d / length) ** 2 * 7;
      const x = w / 2 + Math.cos(a) * d, y = h - 1 + Math.sin(a) * d + bend;
      pix.set(x, y, color);
      if (d > 3 && Math.floor(d) % 2 === 0) pix.set(x + (Math.cos(a) > 0 ? 1 : -1), y + 1, shade(color, 0.72));
    }
  }
  return { canvas: pix.canvas(), w, h };
}

function makeRock(R, seed) {
  const w = R * 2 + 2, h = Math.ceil(R * 1.5) + 2;
  const pix = new Pix(w, h);
  const ramp = ['#59504e', '#736a63', '#8d837a', '#a79c90', '#c4b9aa'];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / R, ny = (y - h / 2) / (h / 2 - 1);
      if (nx * nx + ny * ny > 1 - hash2(x, y, seed) * 0.08) continue;
      pix.set(x, y, pick(ramp, 0.55 - ny * 0.4 - nx * 0.25 + (hash2(x >> 1, y >> 1, seed) - 0.5) * 0.18));
    }
  }
  return { canvas: pix.canvas(), w, h };
}

function makeMushrooms(seed) {
  const random = makeRandom(seed);
  const pix = new Pix(16, 11);
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 4 + Math.floor(random() * 2), tall = 3 + Math.floor(random() * 2);
    pix.rect(x + 1, 10 - tall, 2, tall, rgb('#e9dcc0'));
    pix.rect(x, 8 - tall, 4, 2, rgb('#c9743a'));
    pix.rect(x + 1, 7 - tall, 2, 1, rgb('#e8a15a'));
  }
  return { canvas: pix.canvas(), w: 16, h: 11 };
}

function makeBench() {
  const pix = new Pix(40, 22);
  const plank = rgb('#7c4a26'), light = rgb('#a06a35'), dark = rgb('#4c2c1d');
  pix.rect(2, 2, 36, 3, light);
  pix.rect(2, 5, 36, 1, dark);
  pix.rect(2, 7, 36, 3, plank);
  pix.rect(2, 10, 36, 1, dark);
  pix.rect(2, 12, 36, 4, light);
  pix.rect(2, 16, 36, 1, dark);
  for (const x of [5, 32]) {
    pix.rect(x, 0, 3, 16, dark);
    pix.rect(x, 16, 3, 6, dark);
  }
  return { canvas: pix.canvas(), w: 40, h: 22 };
}

function makeDuck(male) {
  const body = rgb(male ? '#8a7a68' : '#8a6a44'), wing = rgb(male ? '#6a5a4c' : '#6e5232');
  const head = rgb(male ? '#2f6b45' : '#7a5a38'), breast = rgb(male ? '#5a3226' : '#8a6a44');
  const frames = [];
  for (let frame = 0; frame < 2; frame++) {
    const pix = new Pix(14, 10);
    const y = frame;
    pix.rect(2, 4 + y, 9, 4, body);
    pix.rect(4, 4 + y, 5, 2, wing);
    pix.rect(9, 5 + y, 3, 3, breast);
    pix.rect(0, 3 + y, 3, 2, rgb('#e9e2cf'));
    pix.rect(9, 1 + y, 4, 3, head);
    if (male) pix.rect(9, 4 + y, 3, 1, rgb('#f1ece0'));
    pix.rect(13, 2 + y, 1, 1, rgb('#e3b23c'));
    pix.set(11, 2 + y, rgb('#17130f'));
    pix.rect(1, 8 + y, 12, 1, rgb('#a7bdaa'));
    frames.push(pix.canvas());
  }
  return frames;
}

// ------------------------------------------------------------ 맵 굽기

let groundCanvas = null;       // 움직이지 않는 땅 전체
let parapetCanvas = null;      // 캐릭터를 가리는 앞쪽 난간
let mask = null;               // 1 이면 걸을 수 있다
const props = [];              // 앞뒤로 정렬해 그리는 나무와 소품
const shimmers = [];
const ducks = [];

function walkable(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H && mask[y * WORLD_W + x] === 1;
}

function paintTerrain(ground, water) {
  const cellsWater = voronoi(10.5, 21), cellsBank = voronoi(8, 33);
  const gap = rgb('#3d4b40');
  const foam = rgb('#dbe4d2');
  const centres = new Float32Array(WORLD_W), halves = new Float32Array(WORLD_W);
  for (let x = 0; x < WORLD_W; x++) {
    centres[x] = riverY(x);
    halves[x] = riverHalf(x);
  }
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const index = y * WORLD_W + x, ry = y - centres[x], hw = halves[x];
      const edge = fbm(x / 11, y / 9, 40);
      const fromNorth = ry + hw, fromSouth = hw - ry;
      let c;
      if (Math.abs(ry) < hw) {
        const v = cellsWater(x, y * 1.3);
        c = v.h > 0.93 ? pick(WATER_BLUE, (v.h - 0.93) / 0.07) : pick(WATER, v.h / 0.93);
        if (v.d2 - v.d1 < 1.3 || v.d1 > 6.1) c = gap;
        else if (y * 1.3 - v.cy < -v.d1 * 0.4 && v.d1 > 3) c = shade(c, 1.08);
        if (fromNorth < 9 || (fromNorth < 20 && (x + y) % 2 === 0)) c = shade(c, 0.7);
        if ((fromNorth < 1.6 || fromSouth < 1.4) && fbm(x / 5, y / 3, 44) > 0.5) c = foam;
        water[index] = 1;
      } else if (ry < 0 && -fromNorth < 13 + edge * 9) {
        const v = cellsBank(x, y * 1.35);
        c = v.d2 - v.d1 < 1.3 || v.d1 > 5 ? rgb('#27171c') : pick(BANK, v.h * 0.72 + (0.28 * (-fromNorth)) / 20);
        if (y * 1.35 - v.cy < -v.d1 * 0.45) c = shade(c, 1.22);
      } else if (ry > 0 && -fromSouth < 3 + edge * 5) {
        c = pick(['#2f2a18', '#3f3a1f', '#4b4524'], (hash2(x >> 1, y >> 1, 5)));
      } else {
        const q = x & ~1, r = y & ~1;
        const distance = pathDistance(x, y) + (fbm(x / 13, y / 13, 5) - 0.5) * 16;
        if (distance < PATH_WIDTH) {
          c = pick(DIRT, fbm(q / 9, r / 7, 6) + (hash2(q, r, 7) - 0.5) * 0.18);
        } else {
          const n = fbm(q / 28, r / 22, 8) * 0.7 + fbm(q / 6, r / 5, 9) * 0.3 + (hash2(q, r, 10) - 0.5) * 0.12;
          c = pick(GRASS, (n - 0.25) * 2);
        }
        mask[index] = 1;
      }
      ground.d[index] = c;
    }
  }
}

function isOpenLand(x, y, clearance) {
  if (!walkable(x, y) || pathDistance(x, y) < PATH_WIDTH + clearance) return false;
  const dx = x - (BRIDGE.x + BRIDGE.dx / 2 + BRIDGE.px / 2), dy = y - (BRIDGE.y + BRIDGE.dy / 2 + BRIDGE.py / 2);
  return Math.hypot(dx, dy * 1.2) > 190;
}

function addProp(art, x, y, solidW, solidH) {
  props.push({ art, x: Math.round(x), y: Math.round(y) });
  for (let j = -solidH; j <= solidH; j++) {
    for (let i = -solidW; i <= solidW; i++) {
      const px = Math.round(x) + i, py = Math.round(y) + j;
      if ((i * i) / (solidW * solidW + 1) + (j * j) / (solidH * solidH + 1) <= 1 && px >= 0 && py >= 0 && px < WORLD_W && py < WORLD_H) mask[py * WORLD_W + px] = 0;
    }
  }
}

function placeProps(random) {
  const trees = [
    [70, 150, 54, 'orange'], [140, 70, 44, 'yellow'], [38, 280, 48, 'red'], [122, 270, 34, 'orange'], [262, 44, 34, 'red'],
    [386, 96, 32, 'yellow'], [484, 60, 40, 'rust'], [604, 112, 36, 'orange'], [712, 72, 48, 'red'], [842, 60, 44, 'yellow'],
    [704, 628, 58, 'red'], [806, 650, 62, 'rust'], [620, 690, 46, 'orange'], [906, 610, 54, 'orange'], [512, 650, 40, 'yellow'],
    [428, 700, 44, 'orange'], [304, 660, 48, 'red'], [186, 690, 54, 'orange'], [70, 668, 50, 'rust'], [918, 330, 46, 'red'],
    [860, 420, 34, 'yellow'], [196, 268, 50, 'orange'], [304, 122, 30, 'rust'], [522, 188, 44, 'yellow'], [612, 150, 38, 'rust'],
    [566, 612, 46, 'orange'], [250, 604, 50, 'orange'], [150, 610, 36, 'red'], [720, 395, 38, 'red'], [800, 400, 30, 'yellow'],
  ];
  trees.forEach(([x, y, R, ramp], i) => addProp(makeTree(R, ramp, 100 + i), x, y, 7, 3));

  const ramps = ['green', 'green', 'green', 'yellow', 'rust'];
  const taken = trees.map(([x, y, R]) => [x, y, R]);
  for (let tries = 0, made = 0; tries < 900 && made < 44; tries++) {
    const x = 20 + random() * (WORLD_W - 40), y = 20 + random() * (WORLD_H - 30), R = 11 + Math.floor(random() * 11);
    if (!isOpenLand(x, y, 12) || taken.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < (tr + R) * 0.8)) continue;
    addProp(makeBush(R, ramps[Math.floor(random() * ramps.length)], 300 + made, random() < 0.45), x, y, Math.round(R * 0.8), 3);
    taken.push([x, y, R]);
    made++;
  }
  const scatter = (count, clearance, build) => {
    for (let tries = 0, made = 0; tries < count * 12 && made < count; tries++) {
      const x = 12 + random() * (WORLD_W - 24), y = 12 + random() * (WORLD_H - 24);
      if (!isOpenLand(x, y, clearance) || taken.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < tr * 0.55 + 8)) continue;
      build(x, y, made);
      made++;
    }
  };
  scatter(42, 4, (x, y, i) => addProp(makeFern(500 + i), x, y, 0, 0));
  scatter(26, 4, (x, y, i) => addProp(makeRock(4 + (i % 5), 700 + i), x, y, 4, 2));
  scatter(18, 4, (x, y, i) => addProp(makeMushrooms(800 + i), x, y, 0, 0));
  addProp(makeBench(), 345, 548, 18, 3);
}

function paintShadows(ground) {
  for (const prop of props) {
    const rx = prop.art.w * 0.42, ry = Math.max(3, prop.art.w * 0.14);
    for (let y = -Math.ceil(ry); y <= ry; y++) {
      for (let x = -Math.ceil(rx); x <= rx; x++) {
        const px = prop.x + x + Math.round(rx * 0.2), py = prop.y + y + 1;
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1 || px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) continue;
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 0.72 && (px + py) % 2) continue;
        ground.d[py * WORLD_W + px] = shade(ground.d[py * WORLD_W + px], 0.76);
      }
    }
  }
}

function paintLitter(ground, random) {
  const put = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H) ground.d[y * WORLD_W + x] = c;
  };
  for (let i = 0; i < 16000; i++) {
    const x = Math.floor(random() * WORLD_W), y = Math.floor(random() * WORLD_H);
    if (!walkable(x, y)) continue;
    const onPath = pathDistance(x, y) < PATH_WIDTH - 6;
    if (onPath && random() < 0.9) continue;
    const tall = 2 + Math.floor(random() * 3), color = shade(pick(GRASS, 0.55 + random() * 0.5), 1.06);
    for (let j = 0; j < tall; j++) put(x + (j === tall - 1 && random() < 0.5 ? 1 : 0), y - j, j === 0 ? shade(color, 0.76) : color);
  }
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(random() * WORLD_W), y = Math.floor(random() * WORLD_H);
    if (!walkable(x, y)) continue;
    const color = rgb(LEAF_FALL[Math.floor(random() * LEAF_FALL.length)]);
    put(x, y, color);
    put(x + 1, y, color);
    put(x, y + 1, shade(color, 0.7));
  }
}

function paintBridgeWall(ground, water) {
  const cells = voronoi(7, 51), ring = voronoi(9, 57);
  const hole = rgb('#1b2c28');
  for (let u = 0; u <= BRIDGE.length; u += 0.35) {
    const t = u / BRIDGE.length;
    const edge = Math.min(1, t / 0.12, (1 - t) / 0.12);
    const bottom = (ARCH_SPRING + BRIDGE.lift * Math.sin(Math.PI * t)) * edge;
    for (let h = 0; h <= bottom; h += 0.5) {
      const x = Math.floor(bridgeX(t, 0)), y = Math.floor(bridgeY(t, 0) + h);
      const index = y * WORLD_W + x;
      if (index < 0 || index >= mask.length) continue;
      let color = null;
      for (const arch of ARCHES) {
        const dx = (u - arch.at * BRIDGE.length) / arch.half;
        if (Math.abs(dx) >= 1.16) continue;
        const crown = ARCH_SPRING + BRIDGE.lift * Math.sin(Math.PI * t) - ARCH_RISE * Math.sqrt(Math.max(0, 1 - dx * dx)) - 2;
        if (Math.abs(dx) < 1 && h >= crown) color = shade(hole, 1 + clamp((h - crown) / ARCH_RISE, 0, 1) * 0.65);
        else if (h >= crown - 6) {
          const v = ring(u, h);
          color = v.d2 - v.d1 < 1 ? rgb('#5a3226') : pick(ARCH_STONE, v.h);
        }
      }
      if (color === null) {
        const v = cells(u, h * 1.1);
        color = v.d2 - v.d1 < 1 || v.d1 > 4.4 ? rgb('#4f2a22') : pick(WALL, v.h * 0.8 + clamp(1 - h / 40, 0, 1) * 0.2);
        if (h * 1.1 - v.cy < -v.d1 * 0.4) color = shade(color, 1.16);
      }
      ground.d[index] = color;
      mask[index] = 0;
      water[index] = 0;
    }
  }
}

function paintDeck(ground, water) {
  const cells = voronoi(9.5, 61);
  const mortar = rgb('#7d4a28');
  for (let u = 0; u <= BRIDGE.length; u += 0.4) {
    const t = u / BRIDGE.length;
    for (let w = 0; w <= BRIDGE.width; w += 0.4) {
      const s = w / BRIDGE.width;
      const x = Math.floor(bridgeX(t, s)), y = Math.floor(bridgeY(t, s));
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) continue;
      const v = cells(u, w * 1.25);
      const inGap = v.d2 - v.d1 < 1.25 || v.d1 > 5.5;
      let color = inGap ? mortar : pick(COBBLE, v.h * 0.72 + 0.2 + Math.cos(Math.PI * t) * 0.08);
      if (!inGap && w * 1.25 - v.cy < -v.d1 * 0.42) color = shade(color, 1.1);
      const edge = Math.min(s, 1 - s);
      if (edge < 0.1) color = shade(color, 0.86);
      const fade = Math.min(t, 1 - t);
      if (fade < 0.05 && hash2(x, y, 66) > fade / 0.05) continue;     // 길과 자연스럽게 만난다
      ground.d[y * WORLD_W + x] = color;
      mask[y * WORLD_W + x] = 1;
      water[y * WORLD_W + x] = 0;
    }
  }
}

function paintParapet(pix, s, seed) {
  const top = ['#d3bd9b', '#e2cfb0', '#efe0c6'];
  let next = 0, blockStart = 0, blockIndex = 0;
  for (let u = 0; u <= BRIDGE.length; u += 0.4) {
    if (u >= next) {
      blockStart = u;
      blockIndex++;
      next = u + 13 + hash2(blockIndex, seed, 3) * 7;
    }
    const t = u / BRIDGE.length;
    const x = Math.floor(bridgeX(t, s)), y = Math.floor(bridgeY(t, s));
    const seam = u - blockStart < 1 || next - u < 1;
    const tint = hash2(blockIndex, seed, 9);
    for (let h = -7; h <= 3; h++) {
      if (seam && h <= -6) continue;   // 돌 끝을 둥글게 깎는다
      let color;
      if (h <= -2) color = pick(top, tint * 0.75 + (h === -7 ? 0.3 : 0));
      else if (h <= 1) color = rgb(tint > 0.5 ? '#ad8b6e' : '#a07f64');
      else color = rgb('#6f5240');
      if (seam) color = shade(color, 0.68);
      pix.set(x, y + h, color);
      const index = (y + h) * WORLD_W + x;
      if (h >= -4 && index >= 0 && index < mask.length) mask[index] = 0;
    }
  }
}

function paintBridgeLitter(ground, random) {
  for (let i = 0; i < 210; i++) {
    const t = random(), s = 0.06 + random() * 0.88;
    const x = Math.floor(bridgeX(t, s)), y = Math.floor(bridgeY(t, s));
    const color = rgb(LEAF_FALL[Math.floor(random() * LEAF_FALL.length)]);
    ground.d[y * WORLD_W + x] = color;
    ground.d[y * WORLD_W + x + 1] = shade(color, 0.76);
  }
}

// 물가에 모인 낙엽 뭉치.
function paintLeafRafts(ground, water, random) {
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(random() * WORLD_W);
    const top = random() < 0.5;
    const y = Math.floor(riverY(x) + (top ? -1 : 1) * (riverHalf(x) - 6 - random() * 14));
    for (let j = 0; j < 12; j++) {
      const px = x + Math.floor(random() * 22 - 11), py = y + Math.floor(random() * 8 - 4);
      if (px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H || !water[py * WORLD_W + px]) continue;
      const color = rgb(LEAF_FALL[Math.floor(random() * 4)]);
      ground.d[py * WORLD_W + px] = color;
      if (px + 1 < WORLD_W) ground.d[py * WORLD_W + px + 1] = shade(color, 0.76);
    }
  }
}

function collectShimmers(water, random) {
  for (let tries = 0; tries < 8000 && shimmers.length < 800; tries++) {
    const x = Math.floor(random() * WORLD_W), y = Math.floor(random() * WORLD_H);
    if (y >= 0 && water[y * WORLD_W + x] && !mask[y * WORLD_W + x]) shimmers.push({ x, y, phase: random() * TAU, speed: 0.0012 + random() * 0.0016, length: 2 + Math.floor(random() * 4) });
  }
}

function placeDucks() {
  const male = makeDuck(true), female = makeDuck(false);
  [[150, 10, 9, male], [190, -18, 7, female], [730, -10, 8, female], [770, 16, 10, male], [840, -4, 6, male]].forEach(([x, offset, speed, frames], i) => {
    ducks.push({ x, offset, speed, frames, dir: i % 2 ? 1 : -1, from: x < 400 ? 70 : 660, to: x < 400 ? 300 : 920, phase: i });
  });
}

function buildWorld() {
  const random = makeRandom(2026);
  const ground = new Pix(WORLD_W, WORLD_H), parapet = new Pix(WORLD_W, WORLD_H);
  const water = new Uint8Array(WORLD_W * WORLD_H);
  mask = new Uint8Array(WORLD_W * WORLD_H);
  paintTerrain(ground, water);
  placeProps(random);
  paintShadows(ground);
  paintLitter(ground, random);
  paintLeafRafts(ground, water, random);
  paintDeck(ground, water);
  paintBridgeLitter(ground, random);
  paintBridgeWall(ground, water);
  paintParapet(ground, 1, 71);
  paintParapet(parapet, 0, 73);
  collectShimmers(water, random);
  placeDucks();
  props.sort((a, b) => a.y - b.y);
  groundCanvas = ground.canvas();
  parapetCanvas = parapet.canvas();
}

// ------------------------------------------------------------ 캐릭터

const LOOK_OPTIONS = {
  hair: ['#3b2a22', '#6b3f22', '#b5712a', '#d8b05a', '#8a2f2a', '#3f4a78'],
  skin: ['#f8d8bb', '#efc39b', '#d59f73', '#9e6d4a'],
  cloth: ['#c8541c', '#a8322b', '#3f7a4d', '#3a6a96', '#7a4c9a', '#d6c28e'],
  style: [['short', '단발'], ['long', '긴머리'], ['bun', '올림']],
  hat: [['none', '없음'], ['beret', '베레모'], ['beanie', '비니']],
};
const SPRITE_W = 20, SPRITE_H = 26;
const DIR_DOWN = 0, DIR_UP = 1, DIR_RIGHT = 2, DIR_LEFT = 3;

function drawHair(pix, dir, look, bob) {
  const hair = rgb(look.hair), light = shade(hair, 1.28), dark = shade(hair, 0.72);
  const r = (x, y, w, h, c = hair) => pix.rect(x, y + bob, w, h, c);
  if (dir === DIR_DOWN) {
    r(4, 3, 12, 3);
    r(5, 2, 10, 1);
    r(7, 3, 5, 1, light);
    for (const x of [5, 6, 8, 11, 13, 14]) r(x, 6, 1, 1);
    r(4, 6, 1, 3, dark);
    r(15, 6, 1, 3, dark);
    if (look.style === 'long') {
      r(3, 5, 2, 12, dark);
      r(15, 5, 2, 12, dark);
    }
  } else if (dir === DIR_UP) {
    r(4, 3, 12, 8);
    r(5, 2, 10, 1);
    r(7, 3, 5, 2, light);
    r(5, 11, 10, 1, dark);
    if (look.style === 'long') r(4, 11, 12, 6, dark);
  } else {
    r(5, 3, 11, 3);
    r(6, 2, 9, 1);
    r(4, 4, 5, 6);
    r(9, 3, 4, 1, light);
    r(5, 10, 3, 1, dark);
    if (look.style === 'long') r(4, 10, 4, 7, dark);
  }
  if (look.style === 'bun' && look.hat === 'none') {
    const x = dir === DIR_RIGHT ? 4 : 8;
    r(x, 0, 4, 2, dark);
    r(x + 1, 0, 2, 1, light);
  }
}

function drawHat(pix, dir, look, bob) {
  if (look.hat === 'none') return;
  const cloth = rgb(look.cloth), dark = shade(cloth, 0.68), light = shade(cloth, 1.25);
  const r = (x, y, w, h, c = cloth) => pix.rect(x, y + bob, w, h, c);
  if (look.hat === 'beret') {
    r(4, 1, 13, 3);
    r(5, 0, 10, 1, light);
    r(4, 4, 12, 1, dark);
    r(9, -1, 2, 1, dark);
  } else {
    r(4, 1, 12, 4);
    r(5, 0, 10, 1, light);
    r(4, 4, 12, 1, dark);
    for (let x = 5; x < 16; x += 2) r(x, 2, 1, 2, dark);
  }
}

function drawHero(pix, dir, frame, look) {
  const skin = rgb(look.skin), skinDark = shade(skin, 0.82), cloth = rgb(look.cloth), clothDark = shade(cloth, 0.72), clothLight = shade(cloth, 1.2);
  const pants = rgb('#4a4160'), boots = rgb('#5a3a28'), eye = rgb('#2b1b22');
  const bob = frame % 2 ? -1 : 0, stepL = frame === 1, stepR = frame === 3;
  const side = dir === DIR_RIGHT;
  // 다리
  if (side) {
    const front = stepL ? 3 : stepR ? -2 : 0, back = -front;
    pix.rect(8 + back, 19, 3, 4, shade(pants, 0.78));
    pix.rect(8 + back, 23, 4, 1, shade(boots, 0.78));
    pix.rect(9 + front, 19, 3, 4, pants);
    pix.rect(9 + front, 23, 4, 1, boots);
  } else {
    pix.rect(6, 19, 3, stepL ? 3 : 4, pants);
    pix.rect(6, stepL ? 22 : 23, 3, 1, boots);
    pix.rect(11, 19, 3, stepR ? 3 : 4, pants);
    pix.rect(11, stepR ? 22 : 23, 3, 1, boots);
    pix.rect(9, 19, 2, 2, pants);
  }
  // 몸통과 팔
  const body = (x, y, w, h, c = cloth) => pix.rect(x, y + bob, w, h, c);
  if (side) {
    body(7, 13, 7, 6);
    body(7, 18, 7, 1, clothDark);
    const swing = stepL ? 2 : stepR ? -2 : 0;
    body(9 + swing, 14, 3, 4, clothDark);
    body(9 + swing, 18, 3, 1, skin);
  } else {
    body(6, 13, 8, 6);
    body(6, 18, 8, 1, clothDark);
    if (dir === DIR_DOWN) body(9, 13, 2, 2, clothLight);
    const left = stepL ? -1 : stepR ? 1 : 0;
    body(4, 14 + left, 2, 4, clothDark);
    body(4, 18 + left, 2, 1, skin);
    body(14, 14 - left, 2, 4, clothDark);
    body(14, 18 - left, 2, 1, skin);
  }
  // 머리
  const face = (x, y, w, h, c = skin) => pix.rect(x, y + bob, w, h, c);
  if (side) {
    face(6, 4, 10, 8);
    face(7, 3, 8, 10);
    face(14, 8, 2, 1, skinDark);
    face(13, 7, 1, 2, eye);
    face(13, 10, 2, 1, rgb('#e8917a'));
  } else {
    face(5, 4, 10, 8);
    face(6, 3, 8, 10);
    face(6, 12, 8, 1, skinDark);
    if (dir === DIR_DOWN) {
      face(7, 7, 1, 2, eye);
      face(12, 7, 1, 2, eye);
      face(6, 10, 2, 1, rgb('#e8917a'));
      face(12, 10, 2, 1, rgb('#e8917a'));
      face(9, 10, 2, 1, skinDark);
    }
  }
  drawHair(pix, dir, look, bob);
  drawHat(pix, dir, look, bob);
}

function addOutline(pix) {
  const outline = rgb('#2b1b22');
  const source = pix.d.slice();
  const opaque = (x, y) => x >= 0 && y >= 0 && x < pix.w && y < pix.h && source[y * pix.w + x] !== 0;
  for (let y = 0; y < pix.h; y++) {
    for (let x = 0; x < pix.w; x++) {
      if (!opaque(x, y) && (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1))) pix.d[y * pix.w + x] = outline;
    }
  }
}

function buildHeroFrames(look) {
  const frames = [];
  for (const dir of [DIR_DOWN, DIR_UP, DIR_RIGHT]) {
    frames[dir] = [0, 1, 2, 3].map((frame) => {
      const pix = new Pix(SPRITE_W + 2, SPRITE_H + 2);
      const inner = new Pix(SPRITE_W, SPRITE_H);
      drawHero(inner, dir, frame, look);
      for (let y = 0; y < inner.h; y++) for (let x = 0; x < inner.w; x++) pix.d[(y + 2) * pix.w + x + 1] = inner.d[y * inner.w + x];
      addOutline(pix);
      return pix.canvas();
    });
  }
  frames[DIR_LEFT] = frames[DIR_RIGHT].map((canvas) => {
    const flipped = document.createElement('canvas');
    flipped.width = canvas.width;
    flipped.height = canvas.height;
    const c = flipped.getContext('2d');
    c.translate(canvas.width, 0);
    c.scale(-1, 1);
    c.drawImage(canvas, 0, 0);
    return flipped;
  });
  return frames;
}

// ------------------------------------------------------------ 화면과 이동

const view = document.getElementById('view');
const ctx = view.getContext('2d');
const tag = document.getElementById('tag');
const hud = document.getElementById('hud');
const statusEl = document.getElementById('status');

const player = { x: 334, y: 268, dir: DIR_DOWN, moving: false, walked: 0 };
const keys = new Set();
const fallingLeaves = [];
let heroFrames = null;
let viewW = 360, viewH = 240, scale = 3;
let started = false;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

function resize() {
  scale = Math.max(1, Math.round(Math.min(innerWidth / 400, innerHeight / 250)));
  viewW = Math.ceil(innerWidth / scale);
  viewH = Math.ceil(innerHeight / scale);
  view.width = viewW;
  view.height = viewH;
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

addEventListener('keydown', (e) => {
  if (!started || !MOVE_KEYS[e.code]) return;
  e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// 발이 차지하는 네 모서리가 모두 걸을 수 있는 곳이어야 한다.
function feetFit(x, y) {
  return walkable(x - 4, y - 1) && walkable(x + 4, y - 1) && walkable(x - 4, y + 2) && walkable(x + 4, y + 2);
}

function tryMove(x, y) {
  if (!feetFit(x, y)) return false;
  player.x = x;
  player.y = y;
  return true;
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;
  for (const code of keys) {
    dx += MOVE_KEYS[code][0];
    dy += MOVE_KEYS[code][1];
  }
  dx = clamp(dx, -1, 1);
  dy = clamp(dy, -1, 1);
  player.moving = dx !== 0 || dy !== 0;
  if (!player.moving) return;
  const length = Math.hypot(dx, dy), step = (WALK_SPEED * dt) / length;
  if (dx > 0) player.dir = DIR_RIGHT;
  else if (dx < 0) player.dir = DIR_LEFT;
  else player.dir = dy > 0 ? DIR_DOWN : DIR_UP;
  // 한 방향만 누르다 비스듬한 난간이나 나무에 막히면 면을 타고 미끄러진다.
  const slide = Math.max(1.5, step * 0.7);    // 계단처럼 찍힌 면을 넘으려면 1픽셀보다 커야 한다
  if (dx && !tryMove(player.x + dx * step, player.y) && !dy) tryMove(player.x + dx * step, player.y + slide) || tryMove(player.x + dx * step, player.y - slide);
  if (dy && !tryMove(player.x, player.y + dy * step) && !dx) tryMove(player.x + slide, player.y + dy * step) || tryMove(player.x - slide, player.y + dy * step);
  player.walked += WALK_SPEED * dt;
}

function camera() {
  return {
    x: clamp(Math.round(player.x - viewW / 2), 0, Math.max(0, WORLD_W - viewW)),
    y: clamp(Math.round(player.y - viewH / 2), 0, Math.max(0, WORLD_H - viewH)),
  };
}

function drawShimmer(cam, now) {
  ctx.fillStyle = '#c9dccb';
  for (const s of shimmers) {
    const x = s.x - cam.x, y = s.y - cam.y;
    if (x < -8 || y < -2 || x > viewW || y > viewH) continue;
    if (Math.sin(now * s.speed + s.phase) > 0.62) ctx.fillRect(x, y, s.length, 1);
  }
}

function drawDucks(cam, now, dt) {
  for (const duck of ducks) {
    duck.x += duck.dir * duck.speed * dt;
    if (duck.x < duck.from || duck.x > duck.to) {
      duck.dir *= -1;
      duck.x = clamp(duck.x, duck.from, duck.to);
    }
    const x = Math.round(duck.x - cam.x), y = Math.round(riverY(duck.x) + duck.offset - cam.y);
    if (x < -20 || y < -20 || x > viewW + 20 || y > viewH + 20) continue;
    const art = duck.frames[Math.floor(now / 500 + duck.phase) % 2];
    if (duck.dir > 0) {
      ctx.drawImage(art, x, y);
    } else {
      ctx.save();
      ctx.translate(x + art.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(art, 0, 0);
      ctx.restore();
    }
  }
}

function drawPlayer(cam, now) {
  const frame = player.moving ? Math.floor(player.walked / 7) % 4 : 0;
  const art = heroFrames[player.dir][frame];
  const x = Math.round(player.x - cam.x), y = Math.round(player.y - cam.y);
  ctx.fillStyle = 'rgba(30, 16, 10, 0.32)';
  ctx.fillRect(x - 6, y + 1, 12, 2);
  ctx.fillRect(x - 4, y, 8, 4);
  ctx.drawImage(art, x - art.width / 2, y - art.height + 3);
  tag.style.left = `${(x + 0.5) * scale}px`;
  tag.style.top = `${(y - 26) * scale}px`;
}

function drawFallingLeaves(dt, now) {
  while (fallingLeaves.length < 26) {
    fallingLeaves.push({ x: Math.random() * viewW, y: Math.random() * viewH, speed: 9 + Math.random() * 12, sway: Math.random() * TAU, color: LEAF_FALL[Math.floor(Math.random() * LEAF_FALL.length)] });
  }
  for (const leaf of fallingLeaves) {
    leaf.y += leaf.speed * dt;
    leaf.x += (Math.sin(now / 700 + leaf.sway) * 12 - 5) * dt;
    if (leaf.y > viewH) {
      leaf.y = -3;
      leaf.x = Math.random() * viewW;
    }
    if (leaf.x < -3) leaf.x = viewW;
    ctx.fillStyle = leaf.color;
    ctx.fillRect(Math.round(leaf.x), Math.round(leaf.y), 2, Math.sin(now / 240 + leaf.sway) > 0 ? 2 : 1);
  }
}

// 앞쪽 난간보다 안쪽(다리 위)에 있으면 난간이 발을 가린다.
function behindParapet() {
  const t = (player.x - BRIDGE.x) / BRIDGE.dx;
  return t >= 0 && t <= 1 && player.y < bridgeY(t, 0);
}

let lastFrame = performance.now();
function render(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (started) updatePlayer(dt);
  const cam = camera();
  ctx.drawImage(groundCanvas, -cam.x, -cam.y);
  drawShimmer(cam, now);
  drawDucks(cam, now, dt);
  const covered = started && behindParapet();
  if (!covered) ctx.drawImage(parapetCanvas, -cam.x, -cam.y);
  let drawn = !started;
  for (const prop of props) {
    if (!drawn && prop.y > player.y) {
      drawPlayer(cam, now);
      drawn = true;
    }
    const x = prop.x - prop.art.w / 2 - cam.x, y = prop.y - prop.art.h - cam.y + 2;
    if (x + prop.art.w < 0 || y + prop.art.h < 0 || x > viewW || y > viewH) continue;
    ctx.drawImage(prop.art.canvas, Math.floor(x), Math.floor(y));
  }
  if (!drawn) drawPlayer(cam, now);
  if (covered) ctx.drawImage(parapetCanvas, -cam.x, -cam.y);
  drawFallingLeaves(dt, now);
  ctx.fillStyle = 'rgba(255, 168, 70, 0.05)';
  ctx.fillRect(0, 0, viewW, viewH);
  requestAnimationFrame(render);
}

// ------------------------------------------------------------ 캐릭터 만들기

const creator = document.getElementById('creator');
const optionsEl = document.getElementById('options');
const nameInput = document.getElementById('name');
const previewCtx = document.getElementById('preview').getContext('2d');
let account = { id: 'guest', nick: '' };
let look = { hair: LOOK_OPTIONS.hair[1], skin: LOOK_OPTIONS.skin[0], cloth: LOOK_OPTIONS.cloth[0], style: 'short', hat: 'none' };
let previewFrames = null;

function refreshPreview() {
  previewFrames = buildHeroFrames(look);
}

function drawPreview(now) {
  if (creator.hidden) return;
  const dir = Math.floor(now / 1200) % 4, frame = Math.floor(now / 170) % 4;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, 28, 36);
  previewCtx.drawImage(previewFrames[dir][frame], 3, 5);
  requestAnimationFrame(drawPreview);
}

function addOptionRow(title, key, values, isColor) {
  const row = document.createElement('div');
  row.className = 'option-row';
  row.textContent = title;
  const choices = document.createElement('div');
  choices.className = 'choices';
  values.forEach((option) => {
    const [value, text] = isColor ? [option, ''] : option;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.key = key;
    button.dataset.value = value;
    button.textContent = text;
    if (isColor) {
      button.style.background = value;
      button.setAttribute('aria-label', `${title} ${value}`);
    }
    button.setAttribute('aria-pressed', String(look[key] === value));
    button.addEventListener('click', () => {
      look[key] = value;
      choices.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      refreshPreview();
    });
    choices.append(button);
  });
  row.append(choices);
  optionsEl.append(row);
}

function readAccount() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(USER_KEY));
    return saved && saved.id ? saved : null;
  } catch {
    return null;
  }
}

function loadLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(`mmo.pixel.look.${account.id}`));
    if (saved) look = { ...look, ...saved.look };
    if (saved?.name) nameInput.value = saved.name;
  } catch { /* 저장된 모습이 없으면 기본값으로 시작한다 */ }
}

function saveLook(name) {
  try {
    localStorage.setItem(`mmo.pixel.look.${account.id}`, JSON.stringify({ look, name }));
  } catch { /* 저장은 편의 기능이다 */ }
}

creator.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  saveLook(name);
  heroFrames = buildHeroFrames(look);
  tag.textContent = name;
  tag.hidden = false;
  hud.hidden = false;
  creator.hidden = true;
  nameInput.blur();
  started = true;
});

function start() {
  account = readAccount();
  if (!account) {    // 로그인 화면을 거쳐서 와야 한다
    location.replace('index.html');
    return;
  }
  nameInput.value = (account.nick || account.id).slice(0, 12);
  loadLook();
  addOptionRow('머리색', 'hair', LOOK_OPTIONS.hair, true);
  addOptionRow('피부색', 'skin', LOOK_OPTIONS.skin, true);
  addOptionRow('옷 색', 'cloth', LOOK_OPTIONS.cloth, true);
  addOptionRow('머리 모양', 'style', LOOK_OPTIONS.style, false);
  addOptionRow('모자', 'hat', LOOK_OPTIONS.hat, false);
  refreshPreview();
  setTimeout(() => {   // 안내가 먼저 그려지도록 한 박자 쉰다
    buildWorld();
    statusEl.hidden = true;
    creator.hidden = false;
    requestAnimationFrame(drawPreview);
    requestAnimationFrame(render);
  }, 30);
}

start();
