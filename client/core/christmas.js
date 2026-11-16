'use strict';
// 크리스마스 장식. 마을(야외)에만 적용되고 집과 극장, 카지노 안은 그대로다.
// 시즌이 끝나면 CHRISTMAS 를 false 로 바꾸면 평소 모습으로 돌아간다.
const CHRISTMAS = true;

const SNOW = '#f8fbff';
const SNOW_SHADE = 'rgba(150, 175, 205, 0.55)';
const BULB_COLORS = ['#ff5a5a', '#ffd34d', '#5ad07a', '#5aa8ff'];

// x, y 는 물건이 바닥에 닿는 지점이다. z 는 구역 (0 마을).
const XMAS_DECOR = [
  { k: 'tree', z: 0, x: 935, y: 500 },
  { k: 'tree', z: 0, x: 330, y: 1185 },
  { k: 'snowman', z: 0, x: 320, y: 540 },
  { k: 'snowman', z: 0, x: 1225, y: 645 },   // 헤연의 집을 피해 옮김
  { k: 'snowman', z: 0, x: 110, y: 560 },
  { k: 'snowman', z: 0, x: 900, y: 1290 },
  { k: 'snowman', z: 0, x: 150, y: 1300 },
  { k: 'gifts', z: 0, x: 905, y: 300 },
  { k: 'gifts', z: 0, x: 1365, y: 345 },
  { k: 'gifts', z: 0, x: 1290, y: 1330 },
  { k: 'gifts', z: 0, x: 120, y: 700 },
  { k: 'sleigh', z: 0, x: 210, y: 340 },
  ...[310, 360, 410].flatMap((y) => [{ k: 'cane', z: 0, x: 690, y }, { k: 'cane', z: 0, x: 750, y }]),
];

const SNOWFLAKES = Array.from({ length: 170 }, (_, i) => {
  const a = hash(i, 11), b = hash(i, 29);
  return { x: a % 2400, y: b % 2400, r: 1.2 + ((a >>> 10) % 22) / 10, fall: 26 + ((b >>> 8) % 46), phase: ((a >>> 16) % 628) / 100, sway: 6 + ((b >>> 18) % 16) };
});

// 카메라를 따라 화면 안에서 순환한다. 시간으로만 계산하므로 저장할 상태가 없다.
function drawSnowfall(camX, camY, vw, vh, now, areaW, areaH, top) {
  const t = now / 1000, wrap = (v, size) => ((v % size) + size) % size;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  for (const f of SNOWFLAKES) {
    const x = camX + wrap(f.x + Math.sin(t * 0.7 + f.phase) * f.sway - camX, vw + 24) - 12;
    const y = camY + wrap(f.y + t * f.fall - camY, vh + 24) - 12;
    if (x < 0 || x > areaW || y < top || y > areaH) continue;  // 맵 바깥의 빈 공간에는 내리지 않는다
    ctx.moveTo(x + f.r, y);
    ctx.arc(x, y, f.r, 0, TAU);
  }
  ctx.fill();
}

// 선을 따라 쌓인 눈. 아래쪽이 둥글게 늘어진다.
function snowAlong(ax, ay, bx, by, thick) {
  const steps = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 14));
  const trace = (offset) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay - thick * 0.45 + offset);
    ctx.lineTo(bx, by - thick * 0.45 + offset);
    ctx.lineTo(bx, by + thick * 0.4 + offset);
    ctx.lineTo(ax, ay + thick * 0.4 + offset);
    ctx.closePath();
    for (let i = 0; i < steps; i++) {
      const p = (i + 0.5) / steps, r = thick * (0.42 + ((i * 7) % 3) * 0.13);
      const cx = ax + (bx - ax) * p, cy = ay + (by - ay) * p + thick * 0.35 + offset;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TAU);
    }
  };
  ctx.fillStyle = SNOW_SHADE;
  trace(2);
  ctx.fill();
  ctx.fillStyle = SNOW;
  trace(0);
  ctx.fill();
}

function bulbsAlong(ax, ay, bx, by, now, gap = 15) {
  const count = Math.max(2, Math.floor(Math.hypot(bx - ax, by - ay) / gap));
  strokeLines('#2f3a33', 1, () => {
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  });
  const blink = Math.floor(now / 450);
  for (let i = 0; i <= count; i++) {
    const p = i / count, on = (blink + i) % 2 === 0;
    ctx.globalAlpha = on ? 1 : 0.45;
    fillCircles(BULB_COLORS[i % 4], [[ax + (bx - ax) * p, ay + (by - ay) * p + 2.5, on ? 3 : 2.4]]);
  }
  ctx.globalAlpha = 1;
}

function ribbonBow(x, y, color = '#d9302c') {
  polygon([[x, y], [x - 9, y - 5], [x - 9, y + 5]], color);
  polygon([[x, y], [x + 9, y - 5], [x + 9, y + 5]], color);
  polygon([[x - 2, y], [x + 2, y], [x + 5, y + 12], [x - 5, y + 12]], color);
  fillCircles('#a81f1c', [[x, y, 2.6]]);
}

function wreath(x, y, r) {
  ctx.strokeStyle = '#2f6b3e';
  ctx.lineWidth = r * 0.55;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 6; i++) fillCircles('#e5484d', [[x + Math.cos((i / 6) * TAU) * r, y + Math.sin((i / 6) * TAU) * r, 1.6]]);
  ribbonBow(x, y + r, '#d9302c');
}

// 건물별 지붕의 눈과 전구. 키는 외형 번호, 카페는 'cafe' 다.
const XMAS_ROOFS = {
  0(b, g, now) {  // 몰쟈
    const { x } = b;
    polygon([[x - 80, g - 152], [x + 80, g - 152], [x + 94, g - 118], [x - 94, g - 118]], SNOW);
    snowAlong(x - 94, g - 118, x + 94, g - 118, 11);
    snowAlong(x - 80, g - 155, x + 80, g - 155, 9);
    snowAlong(x + 40, g - 181, x + 72, g - 181, 8);
    bulbsAlong(x - 106, g - 80, x + 106, g - 80, now);
    wreath(x, g - 26, 8);  // 간판을 가리지 않도록 문에 건다
  },
  1(b, g, now) {  // 랏라
    const { x } = b;
    polygon([[x, g - 180], [x + 46, g - 134], [x - 46, g - 134]], SNOW);
    snowAlong(x - 46, g - 134, x + 46, g - 134, 9);
    snowAlong(x - 112, g - 77, x, g - 177, 7);
    snowAlong(x, g - 177, x + 112, g - 77, 7);
    bulbsAlong(x - 110, g - 73, x + 110, g - 73, now);
  },
  2(b, g, now) {  // 캬캬
    const { x } = b, top = g - 92;
    snowAlong(x - 102, top + 2, x, top - 66, 11);
    snowAlong(x, top - 66, x + 102, top + 2, 11);
    bulbsAlong(x - 104, top + 13, x + 104, top + 13, now);
    ribbonBow(x, g - 62);
  },
  3(b, g, now) {  // 극장
    const { x } = b, top = g - 130;
    snowAlong(x - 182, top - 26, x + 182, top - 26, 10);
    snowAlong(x - 86, top - 62, x + 86, top - 62, 8);
    bulbsAlong(x - 168, top + 10, x + 168, top + 10, now, 18);
    wreath(x - 112, g - 112, 11);
    wreath(x + 112, g - 112, 11);
  },
  4(b, g, now) {  // 카지노
    const { x } = b, top = g - 118;
    snowAlong(x - 126, top - 10, x + 126, top - 10, 9);
    snowAlong(x - 70, top - 30, x + 70, top - 30, 7);
    snowAlong(x - 92, top - 98, x + 92, top - 98, 8);
    bulbsAlong(x - 118, top + 12, x + 118, top + 12, now);
  },
  5(b, g, now) {  // 재즈바
    const { x } = b, top = g - 118;
    snowAlong(x - 118, top - 12, x + 118, top - 12, 9);
    snowAlong(x - 74, top - 54, x + 74, top - 54, 7);
    bulbsAlong(x - 106, top + 12, x + 106, top + 12, now);
  },
  7(b, g, now) {  // 헤연 (기와집)
    const { x } = b;
    polygon([[x - 60, g - 146], [x + 60, g - 146], [x + 74, g - 122], [x - 74, g - 122]], SNOW);
    snowAlong(x - 62, g - 157, x + 62, g - 157, 8);
    snowAlong(x - 74, g - 122, x + 74, g - 122, 9);
    bulbsAlong(x - 80, g - 92, x + 80, g - 92, now);  // 처마 밑. 간판을 가리지 않는다
  },
  cafe(b, g, now) {
    const { x } = b, top = g - 96;
    snowAlong(x - 119, top - 26, x + 119, top - 26, 9);
    bulbsAlong(x - 113, top + 4, x + 113, top + 4, now);
    wreath(x, g - 80, 9);
  },
};

function drawTreeSnow(x, y, s) {
  fillCircles(SNOW_SHADE, [[x - 26 * s, y - 76 * s, 15 * s], [x + 26 * s, y - 76 * s, 15 * s], [x, y - 106 * s, 21 * s]]);
  fillCircles(SNOW, [[x - 27 * s, y - 80 * s, 13 * s], [x + 27 * s, y - 80 * s, 13 * s], [x - 13 * s, y - 104 * s, 11 * s], [x + 13 * s, y - 104 * s, 11 * s], [x, y - 110 * s, 15 * s]]);
  const seed = hash(x | 0, y | 0);
  [[-20, -52], [18, -50], [-4, -66], [-32, -60], [30, -58], [6, -44]].forEach(([dx, dy], i) => {
    fillCircles(BULB_COLORS[(seed + i) % 4], [[x + dx * s, y + dy * s, 3 * s]]);
  });
}

function drawLampSnow(x, y) {
  fillCircles(SNOW, [[x - 6, y - 121, 4.5], [x + 6, y - 121, 4.5], [x, y - 123, 6]]);
  box(x - 3.5, y - 58, 7, 7, '#d9302c', 1);
  ribbonBow(x, y - 54);
}

function drawChristmasTree(x, y, now) {
  groundShadow(x, y + 2, 62, 13);
  box(x - 9, y - 22, 18, 24, '#6b4423');
  const tiers = [[0, 74], [46, 62], [88, 50], [126, 38]];
  tiers.forEach(([lift, half], i) => {
    const base = y - 18 - lift, tip = base - 76;
    polygon([[x - half, base], [x + half, base], [x, tip]], i % 2 ? '#2a6b3c' : '#2f7a44');
    snowAlong(x - half, base, x + half, base, 7);
  });
  const blink = Math.floor(now / 500);
  tiers.forEach(([lift, half], t) => {
    for (let i = 0; i < 6 - t; i++) {
      const dx = (i - (5 - t) / 2) * (half / 3.1), on = (blink + i + t) % 2 === 0;
      fillCircles(BULB_COLORS[(i + t) % 4], [[x + dx, y - 40 - lift - (i % 2) * 7, on ? 5 : 3.6]]);
    }
  });
  // 꼭대기의 별
  const cy = y - 214;
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 6.5 : 15;
    ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  drawGiftBox(x - 58, y + 8, 28, 22, '#d9302c', '#ffd34d');
  drawGiftBox(x + 54, y + 10, 26, 24, '#2f7fd0', '#ffffff');
  drawGiftBox(x + 26, y + 16, 20, 16, '#3fa35a', '#ffd34d');
}

function drawGiftBox(x, y, w, h, color, ribbon) {
  box(x - w / 2, y - h, w, h, color, 2);
  box(x - 2.5, y - h, 5, h, ribbon);
  box(x - w / 2 - 2, y - h - 3, w + 4, 6, color, 2);
  box(x - 2.5, y - h - 3, 5, 6, ribbon);
  fillCircles(ribbon, [[x - 5, y - h - 5, 4], [x + 5, y - h - 5, 4]]);
}

function drawSnowman(x, y) {
  groundShadow(x, y + 2, 28, 8);
  fillCircles('#d9e4ef', [[x, y - 22, 26], [x, y - 58, 19]]);
  fillCircles(SNOW, [[x - 1, y - 24, 24], [x - 1, y - 60, 17.5]]);
  strokeLines('#6b4423', 2.5, () => {
    ctx.moveTo(x - 17, y - 54);
    ctx.lineTo(x - 42, y - 68);
    ctx.moveTo(x + 17, y - 54);
    ctx.lineTo(x + 42, y - 66);
  });
  box(x - 15, y - 46, 30, 7, '#d9302c', 3);    // 목도리
  box(x + 6, y - 44, 8, 18, '#d9302c', 2);
  fillCircles('#26272b', [[x - 6, y - 64, 2.2], [x + 6, y - 64, 2.2], [x, y - 30, 2.4], [x, y - 20, 2.4], [x, y - 10, 2.4]]);
  polygon([[x, y - 60], [x, y - 55], [x + 14, y - 58]], '#ef8a2e');
  box(x - 18, y - 80, 36, 5, '#26272b', 2);    // 모자
  box(x - 11, y - 100, 22, 21, '#26272b', 2);
  box(x - 11, y - 85, 22, 4, '#d9302c');
}

function drawCandyCane(x, y) {
  groundShadow(x, y + 2, 9, 3);
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 54);
    ctx.arc(x + 10, y - 54, 10, Math.PI, 0);
  };
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  trace();
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#d9302c';
  ctx.setLineDash([7, 9]);
  trace();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSleigh(x, y) {
  groundShadow(x, y + 3, 74, 10);
  strokeLines('#d9b46a', 4, () => {
    ctx.moveTo(x - 66, y);
    ctx.lineTo(x + 56, y);
    ctx.quadraticCurveTo(x + 78, y - 2, x + 76, y - 24);
  });
  box(x - 46, y - 14, 5, 14, '#d9b46a');
  box(x + 30, y - 14, 5, 14, '#d9b46a');
  polygon([[x - 62, y - 14], [x + 54, y - 14], [x + 66, y - 50], [x + 34, y - 44], [x - 40, y - 44], [x - 62, y - 66]], '#c9272b');
  polygon([[x - 62, y - 14], [x + 54, y - 14], [x + 56, y - 20], [x - 62, y - 20]], '#d9b46a');
  drawGiftBox(x - 18, y - 42, 30, 26, '#3fa35a', '#ffd34d');
  drawGiftBox(x + 16, y - 42, 26, 20, '#2f7fd0', '#ffffff');
}

function drawDecor(d, now) {
  if (d.k === 'tree') drawChristmasTree(d.x, d.y, now);
  else if (d.k === 'snowman') drawSnowman(d.x, d.y);
  else if (d.k === 'gifts') {
    drawGiftBox(d.x - 20, d.y, 28, 24, '#d9302c', '#ffd34d');
    drawGiftBox(d.x + 18, d.y + 2, 24, 20, '#2f7fd0', '#ffffff');
    drawGiftBox(d.x + 2, d.y + 10, 20, 16, '#3fa35a', '#ffd34d');
  } else if (d.k === 'cane') drawCandyCane(d.x, d.y);
  else if (d.k === 'sleigh') drawSleigh(d.x, d.y);
}

function decorHere(d) {
  return d.z === zone;
}
