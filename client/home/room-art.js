'use strict';
// 방 그림: 바닥과 벽, 바닥재, 터프팅 러그.

// ------------------------------------------------------------ 집 내부

const WALL_HEIGHT = 124;
const SIDE_WALL = 22;

const ROOM_STYLES = [
  {  // 몰쟈: 짙은 회색 벽과 넓은 나무 바닥
    side: '#2e2f33',
    floor({ w, h }) {
      box(0, 0, w, h, '#7d5f45');
      strokeLines('#694e38', 2, () => {
        for (let y = 34, row = 0; y < h; y += 34, row++) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          for (let x = (row % 2 ? 80 : 0); x < w; x += 160) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 34);
          }
        }
      });
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#55585e');
      box(0, -10, w, 10, '#2e2f33');
    },
  },
  {  // 랏라: 통나무 벽과 밝은 소나무 바닥
    side: '#5b3a1e',
    floor({ w, h }) {
      box(0, 0, w, h, '#d9b77a');
      strokeLines('#c29c5e', 2, () => {
        for (let x = 40, col = 0; x < w; x += 40, col++) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          for (let y = (col % 2 ? 60 : 0); y < h; y += 120) {
            ctx.moveTo(x - 40, y);
            ctx.lineTo(x, y);
          }
        }
      });
    },
    wall({ w }) {
      for (let y = -WALL_HEIGHT, i = 0; y < 0; y += 20, i++) {
        box(0, y, w, 20, i % 2 ? '#8a5a32' : '#7a4e2a', 6);
        strokeLines('rgba(60, 34, 16, 0.5)', 1, () => {
          ctx.moveTo(0, y + 19.5);
          ctx.lineTo(w, y + 19.5);
        });
      }
      box(0, -7, w, 7, '#2f6b45');
    },
  },
  {  // 캬캬의 거실: 흰 벽돌과 나무 바닥
    side: '#8a7a68',
    floor({ w, h }) {
      box(0, 0, w, h, '#a58a6c');
      strokeLines('#8f7558', 2, () => {
        for (let y = 26, row = 0; y < h; y += 26, row++) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          for (let x = (row % 3) * 46; x < w; x += 138) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 26);
          }
        }
      });
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#f2efe9');
      strokeLines('rgba(155, 147, 135, 0.4)', 1, () => {
        for (let y = -WALL_HEIGHT + 10, row = 0; y < 0; y += 10, row++) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          for (let x = (row % 2 ? 14 : 0); x < w; x += 28) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 10);
          }
        }
      });
      box(0, -WALL_HEIGHT, w, 8, '#6b5543');
      box(0, -9, w, 9, '#6b5543');
    },
  },
  {  // 침실: 그레이지 벽과 짙은 나무 징두리
    side: '#7a6a58',
    floor({ w, h }) {
      box(0, 0, w, h, '#b59a7a');
      strokeLines('#a0866a', 2, () => {
        for (let x = 36; x < w; x += 36) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
      });
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#cfc6b6');
      box(0, -44, w, 44, '#6b5543');
      strokeLines('rgba(40, 30, 20, 0.35)', 1, () => {
        for (let x = 16; x < w; x += 16) {
          ctx.moveTo(x, -42);
          ctx.lineTo(x, 0);
        }
      });
      box(0, -48, w, 5, '#efeae0');
      box(0, -WALL_HEIGHT, w, 7, '#8a7a68');
    },
  },
  {  // 주방: 회갈색 바닥과 그레이지 벽
    side: '#7a6a58',
    floor({ w, h }) {
      const size = 64;
      box(0, 0, w, h, '#9a9184');
      strokeLines('rgba(120, 112, 100, 0.7)', 1.5, () => {
        for (let x = size; x < w; x += size) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = size; y < h; y += size) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
      });
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#d8d0c2');
      box(0, -8, w, 8, '#6b5543');
      box(0, -WALL_HEIGHT, w, 7, '#6b5543');
    },
  },
  {  // 극장: 붉은 벽과 어두운 바닥
    side: '#3a1216',
    floor({ w, h }) {
      box(0, 0, w, h, '#4a2528');
      strokeLines('rgba(30, 10, 12, 0.5)', 2, () => {
        for (let y = 40; y < h; y += 58) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
      });
      box(w / 2 - 34, 205, 68, h - 205, '#7a2a2f');   // 가운데 통로
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#7a1f24');
      strokeLines('rgba(40, 6, 10, 0.45)', 2, () => {
        for (let x = 12; x < w; x += 14) {
          ctx.moveTo(x, -WALL_HEIGHT);
          ctx.lineTo(x, 0);
        }
      });
      box(0, -WALL_HEIGHT, w, 7, '#d9b46a');
    },
  },
  {  // 카지노: 금빛 무늬의 붉은 카펫과 검보라 벽
    side: '#1a1228',
    floor({ w, h }) {
      box(0, 0, w, h, '#7a1a2c');
      ctx.fillStyle = '#8e2236';
      for (let y = 0, row = 0; y < h; y += 40, row++) {
        for (let x = (row % 2) * 40; x < w; x += 80) {
          ctx.beginPath();
          ctx.moveTo(x + 20, y);
          ctx.lineTo(x + 40, y + 20);
          ctx.lineTo(x + 20, y + 40);
          ctx.lineTo(x, y + 20);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(232, 184, 48, 0.55)';
      for (let y = 20, row = 0; y < h; y += 40, row++) for (let x = (row % 2) * 40 + 20; x < w; x += 80) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#2a1f3d');
      for (let x = 30; x < w; x += 60) box(x, -WALL_HEIGHT, 6, WALL_HEIGHT, '#3a2a55');
      box(0, -WALL_HEIGHT, w, 7, '#e8b830');
      box(0, -30, w, 30, '#1a1228');
      box(0, -32, w, 3, '#e8b830');
      box(0, -10, w, 10, '#120c1c');
    },
  },
  {  // 재즈바: 버건디 줄무늬 벽지와 짙은 나무 바닥
    side: '#241014',
    floor({ w, h }) {
      box(0, 0, w, h, '#3a2318');
      strokeLines('#2c1a12', 2, () => {
        for (let y = 30, row = 0; y < h; y += 30, row++) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          for (let x = (row % 2 ? 70 : 0); x < w; x += 140) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 30);
          }
        }
      });
    },
    wall({ w }) {
      box(0, -WALL_HEIGHT, w, WALL_HEIGHT, '#5c1a26');
      for (let x = 0; x < w; x += 28) box(x, -WALL_HEIGHT, 14, WALL_HEIGHT, '#6e2230');
      box(0, -WALL_HEIGHT, w, 7, '#c19a55');
      box(0, -36, w, 36, '#2e1712');
      box(0, -38, w, 3, '#c19a55');
      box(0, -10, w, 10, '#1a0d09');
    },
  },
];

// ---- 바닥재: 집마다 상점에서 고른 바닥. 번호 0 은 집의 원래 바닥이라 비워 둔다. 서버 home/decor.hpp 의 kFloorKinds 와 개수가 같다.
const FLOOR_NAMES = ['원래 바닥', '밝은 원목', '헤링본', '체크 타일', '대리석', '테라코타', '민트 카펫', '짙은 원목'];

// 좌표로 정해지는 잡음. 같은 집은 언제 그려도 같은 무늬가 된다.
function floorNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function paintPlanks(w, h, base, line, plank, length) {
  box(0, 0, w, h, base);
  for (let y = 0, row = 0; y < h; y += plank, row++) {
    for (let x = row % 2 ? -length / 2 : 0; x < w; x += length) {
      const n = floorNoise(x, row);
      ctx.fillStyle = `rgba(${n > 0.5 ? '255, 255, 255' : '0, 0, 0'}, ${0.03 + (n % 0.25) * 0.18})`;
      ctx.fillRect(x, y, length, plank);
    }
  }
  strokeLines(line, 1.5, () => {
    for (let y = plank, row = 1; y < h; y += plank, row++) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    for (let y = 0, row = 0; y < h; y += plank, row++) {
      for (let x = row % 2 ? length / 2 : length; x < w; x += length) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plank);
      }
    }
  });
}

const FLOOR_MATERIALS = [
  null,
  { paint: (w, h) => paintPlanks(w, h, '#d9b98c', '#bf9d70', 26, 150) },
  {
    paint(w, h) {   // 지그재그로 엇갈린 짧은 판
      box(0, 0, w, h, '#a8744a');
      const u = 18;
      for (let y = -u * 4, row = 0; y < h + u * 4; y += u, row++) {
        for (let x = -u * 4, col = 0; x < w + u * 4; x += u * 2, col++) {
          const n = floorNoise(col, row);
          ctx.fillStyle = n > 0.5 ? '#b5825a' : '#9c6a42';
          ctx.save();
          ctx.translate(x + (row % 2) * u, y);
          ctx.rotate((row % 2 ? -1 : 1) * Math.PI / 4);
          ctx.fillRect(0, 0, u * 2.6, u * 0.9);
          ctx.strokeStyle = '#7d5232';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, u * 2.6, u * 0.9);
          ctx.restore();
        }
      }
    },
  },
  {
    paint(w, h) {   // 흑백 체크 타일
      const u = 40;
      box(0, 0, w, h, '#f1ede4');
      ctx.fillStyle = '#2c2c34';
      for (let y = 0, j = 0; y < h; y += u, j++) for (let x = (j % 2) * u; x < w; x += u * 2) ctx.fillRect(x, y, u, u);
      strokeLines('rgba(0, 0, 0, 0.18)', 1, () => {
        for (let x = u; x < w; x += u) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = u; y < h; y += u) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      });
    },
  },
  {
    paint(w, h) {   // 흰 대리석: 큰 판과 회색 결
      const u = 120;
      box(0, 0, w, h, '#ece9e4');
      for (let y = 0, j = 0; y < h; y += u, j++) {
        for (let x = 0, i = 0; x < w; x += u, i++) {
          ctx.fillStyle = floorNoise(i, j) > 0.5 ? '#f3f1ed' : '#e5e1da';
          ctx.fillRect(x, y, u, u);
          ctx.strokeStyle = 'rgba(120, 118, 128, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          let vx = x, vy = y + floorNoise(i + 3, j) * u;
          ctx.moveTo(vx, vy);
          for (let k = 1; k <= 6; k++) {
            vx = x + (u / 6) * k;
            vy += (floorNoise(i * 7 + k, j * 5) - 0.5) * 22;
            ctx.lineTo(vx, vy);
          }
          ctx.stroke();
        }
      }
      strokeLines('rgba(150, 146, 140, 0.45)', 1, () => {
        for (let x = u; x < w; x += u) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = u; y < h; y += u) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      });
    },
  },
  {
    paint(w, h) {   // 테라코타: 붉은 육각 느낌의 엇갈린 타일
      const u = 34;
      box(0, 0, w, h, '#e2d3c0');
      for (let y = 0, j = 0; y < h; y += u, j++) {
        for (let x = (j % 2) * (u / 2) - u, i = 0; x < w; x += u, i++) {
          const n = floorNoise(i, j);
          ctx.fillStyle = n > 0.66 ? '#c4643e' : n > 0.33 ? '#b9593a' : '#cf714a';
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, u - 4, u - 4, 5);
          ctx.fill();
        }
      }
    },
  },
  {
    paint(w, h) {   // 민트 카펫: 부드러운 점무늬
      box(0, 0, w, h, '#9fd8c5');
      for (let y = 0, j = 0; y < h; y += 12, j++) {
        for (let x = (j % 2) * 6, i = 0; x < w; x += 12, i++) {
          ctx.fillStyle = floorNoise(i, j) > 0.5 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(40, 120, 100, 0.14)';
          ctx.fillRect(x, y, 3, 3);
        }
      }
    },
  },
  { paint: (w, h) => paintPlanks(w, h, '#5a3a26', '#3f281a', 30, 180) },
];

function paintFloorMaterial(index, w, h) {
  FLOOR_MATERIALS[index].paint(w, h);
}

// 상점의 "원래 바닥" 칸: 비스듬한 줄무늬로 '기본'을 나타낸다
function paintOriginalFloorSwatch(w, h) {
  box(0, 0, w, h, '#efe6cf');
  strokeLines('#d2c4a2', 6, () => {
    for (let x = -h; x < w; x += 20) {
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
    }
  });
}

// 바닥 그림은 넓어서 매 프레임 그리면 느리다. (재질, 크기)마다 한 번 그려 두고 붙인다.
const floorCanvases = new Map();
function drawFloorMaterial(index, w, h) {
  const key = `${index}|${w}|${h}`;
  let canvas = floorCanvases.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    drawOn(canvas.getContext('2d'), () => paintFloorMaterial(index, w, h));
    if (floorCanvases.size > 24) floorCanvases.clear();
    floorCanvases.set(key, canvas);
  }
  ctx.drawImage(canvas, 0, 0);
}

// 고른 바닥재가 있으면 그것을, 없으면 방 꾸밈의 원래 바닥을 깐다. 염색한 바닥은 물들인 그림을 한 번 만들어 붙인다.
const tintedFloors = new Map();
function paintRoomFloor(style, size) {
  const chosen = typeof roomFloor === 'number' && FLOOR_MATERIALS[roomFloor];
  const tint = typeof roomFloorTint === 'string' ? roomFloorTint : '';
  if (!tint) {
    if (chosen) drawFloorMaterial(roomFloor, size.w, size.h);
    else style.floor(size);
    return;
  }
  const w = Math.ceil(size.w), h = Math.ceil(size.h);
  const key = `${roomFloor}|${ROOM_STYLES.indexOf(style)}|${tint}|${w}|${h}`;
  let canvas = tintedFloors.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    drawOn(c, () => (chosen ? paintFloorMaterial(roomFloor, w, h) : style.floor({ w, h })));
    const image = c.getImageData(0, 0, w, h);
    applyTint(image.data, tint);
    c.putImageData(image, 0, 0);
    if (tintedFloors.size > 12) tintedFloors.clear();
    tintedFloors.set(key, canvas);
  }
  ctx.drawImage(canvas, 0, 0);
}

// ---- 터프팅 러그
// 바닥에 눕혀 보이도록 세로를 눌러 그린다. 모양 조각마다 테두리 색으로 한 번 크게, 바탕색으로 한 번 그리면
// 조각이 이어진 두툼한 테두리가 생긴다. 다 그린 뒤 픽셀마다 조금씩 밝기를 흔들어 털 질감을 낸다.
const RUG_W = 340, RUG_H = 190, RUG_SQUASH = 0.56;
const rugCanvases = new Map();

function rugShapes(parts, pad, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  for (const p of parts) {
    ctx.beginPath();
    if (p.c) ctx.arc(p.c[0], p.c[1], p.c[2] + pad, 0, TAU);
    else if (p.e) ctx.ellipse(p.e[0], p.e[1], p.e[2] + pad, p.e[3] + pad, p.e[4] || 0, 0, TAU);
    else if (p.r) ctx.roundRect(p.r[0] - pad, p.r[1] - pad, p.r[2] + pad * 2, p.r[3] + pad * 2, (p.r[4] || 0) + pad);
    else if (p.poly || p.path) {
      if (p.poly) {
        p.poly.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.closePath();
      } else {
        p.path();
      }
      if (pad > 0) {
        ctx.lineWidth = pad * 2;
        ctx.stroke();
      }
    }
    ctx.fill();
  }
}

function tuftedRug(parts, fill, edge, pad) {
  rugShapes(parts, pad, edge);
  rugShapes(parts, 0, fill);
}

function rugEyeRing(cx, cy, r, color) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
}

function rugLine(color, width, points) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
}

const RUG_DESIGNS = {
  rug_cat_black() {   // 엎드린 검은 고양이, 크림색 테두리와 주황 눈
    tuftedRug([
      { e: [-18, 14, 82, 44] }, { c: [70, -6, 40] },
      { poly: [[40, -30], [50, -72], [74, -40]] }, { poly: [[80, -42], [102, -70], [106, -22]] },
      { e: [-104, -14, 16, 42, -0.35] }, { e: [-58, 56, 17, 12] }, { e: [12, 58, 17, 12] },
    ], '#1d1c22', '#f1e7d2', 9);
    rugEyeRing(56, -8, 9, '#f08a3a');
    rugEyeRing(88, -8, 9, '#f08a3a');
    rugLine('#f1e7d2', 3.5, [[-82, -6], [-66, 10]]);
    rugLine('#f1e7d2', 3.5, [[-82, 10], [-66, -6]]);
  },
  rug_cat_stand() {   // 꼬리를 세운 검은 고양이 실루엣과 동그란 흰 눈
    tuftedRug([
      { r: [-84, -34, 150, 64, 30] }, { c: [70, -46, 36] },
      { poly: [[42, -66], [48, -104], [70, -74]] }, { poly: [[76, -76], [98, -106], [102, -58]] },
      { r: [-78, 14, 22, 52, 11] }, { r: [-40, 14, 22, 52, 11] }, { r: [6, 14, 22, 52, 11] }, { r: [42, 14, 22, 52, 11] },
      { r: [-104, -118, 24, 104, 12] },
    ], '#17161b', '#3d3c44', 3);
    for (const ex of [56, 86]) {
      fillCircles('#f7f5ef', [[ex, -48, 11]]);
      fillCircles('#141417', [[ex + 1, -47, 4.5]]);
    }
  },
  rug_bunny() {   // 동그란 흰 토끼, 분홍 귀 하나
    tuftedRug([
      { e: [0, 16, 100, 62] }, { e: [44, -64, 17, 44, 0.3] }, { e: [86, -50, 15, 38, 0.75] },
    ], '#fbf8f1', '#ded7c9', 4);
    ctx.fillStyle = '#f4a7b9';
    ctx.beginPath();
    ctx.ellipse(44, -62, 7, 30, 0.3, 0, TAU);
    ctx.fill();
    fillCircles('#2a2a2e', [[50, 4, 4.5], [88, 2, 4.5]]);
    rugLine('#d9879b', 2.5, [[62, 16], [68, 21], [74, 16], [80, 21], [86, 16]]);
  },
  rug_long_cat() {   // 기지개 켜는 흰 고양이, 검은 선 그림
    tuftedRug([
      { r: [-84, -36, 196, 72, 36] }, { c: [-104, 0, 42] },
      { poly: [[-136, -26], [-140, -64], [-114, -40]] }, { poly: [[-94, -40], [-70, -62], [-74, -24]] },
      { r: [102, -36, 46, 26, 13] }, { r: [102, 10, 46, 26, 13] },
    ], '#fbfaf5', '#2b2b30', 3);
    rugLine('#2b2b30', 3, [[-122, -4], [-116, -10], [-110, -4]]);
    rugLine('#2b2b30', 3, [[-98, -4], [-92, -10], [-86, -4]]);
    rugLine('#2b2b30', 3, [[-108, 10], [-104, 14], [-100, 10]]);
    for (const py of [-22, 22]) {   // 가슴에 모은 앞발
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2b2b30';
      ctx.beginPath();
      ctx.ellipse(-50, py, 15, 10, 0, 0, TAU);
      ctx.stroke();
    }
  },
  rug_puppy() {   // 하늘색 쿠션 위의 흰 복슬 강아지
    tuftedRug([{ r: [-112, -62, 224, 124, 32] }], '#8fb3dd', '#f5f1e6', 8);
    const fur = [{ c: [-4, -20, 32] }, { c: [12, 28, 34] }, { c: [-26, -40, 14] }, { c: [18, -42, 14] }, { c: [-22, 54, 13] }, { c: [36, 56, 13] }];
    rugShapes(fur, 3, '#cfc6b5');
    rugShapes(fur, 0, '#fffdf8');
    rugShapes([{ e: [-40, -10, 13, 22, 0.25] }, { e: [32, -10, 13, 22, -0.25] }], 2, '#cfc6b5');   // 처진 귀
    rugShapes([{ e: [-40, -10, 13, 22, 0.25] }, { e: [32, -10, 13, 22, -0.25] }], 0, '#efe6d6');
    fillCircles('#1d1c22', [[-15, -22, 4.5], [7, -22, 4.5], [-4, -8, 5.5]]);
    box(0, 22, 20, 14, '#1d1c22', 6);
  },
  rug_8ball() {   // 검은 8볼
    tuftedRug([{ c: [0, 0, 104] }], '#141417', '#2c2c33', 4);
    fillCircles('#f7f5ef', [[0, -8, 46]]);
    ctx.fillStyle = '#141417';
    ctx.font = '800 66px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('8', 0, -4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    ctx.ellipse(-46, -50, 34, 16, -0.6, 0, TAU);
    ctx.fill();
  },
  rug_cloud() {   // 웃는 구름
    tuftedRug([
      { c: [-62, 10, 46] }, { c: [-10, -16, 60] }, { c: [56, 2, 50] }, { c: [94, 26, 34] }, { c: [-100, 28, 32] }, { r: [-112, 12, 214, 50, 25] },
    ], '#f5f9ff', '#a9cdf2', 5);
    fillCircles('#3a4a66', [[-20, 10, 5], [22, 10, 5]]);
    rugLine('#3a4a66', 3, [[-8, 26], [0, 32], [8, 26]]);
    ctx.fillStyle = 'rgba(255, 150, 180, 0.55)';
    for (const bx of [-40, 42]) {
      ctx.beginPath();
      ctx.ellipse(bx, 26, 11, 7, 0, 0, TAU);
      ctx.fill();
    }
  },
  rug_heart() {   // 분홍 하트
    const heart = () => {
      ctx.moveTo(0, 78);
      ctx.bezierCurveTo(-150, -6, -72, -120, 0, -46);
      ctx.bezierCurveTo(72, -120, 150, -6, 0, 78);
      ctx.closePath();
    };
    tuftedRug([{ path: heart }], '#ff8fb1', '#fff1f5', 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-46, -40, 20, 11, -0.6, 0, TAU);
    ctx.fill();
  },
};

function blitRug(kind, x, y) {
  let canvas = rugCanvases.get(kind);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = RUG_W;
    canvas.height = RUG_H;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    drawOn(c, () => {
      ctx.save();
      ctx.translate(RUG_W / 2, RUG_H / 2);
      ctx.scale(1, RUG_SQUASH);
      RUG_DESIGNS[kind]();
      ctx.restore();
    });
    const image = c.getImageData(0, 0, RUG_W, RUG_H);
    for (let py = 0; py < RUG_H; py++) {   // 털 질감
      for (let px = 0; px < RUG_W; px++) {
        const i = (py * RUG_W + px) * 4;
        if (image.data[i + 3] < 200) continue;
        const n = ((hash(px, py) % 23) - 11) * 0.9;
        image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
      }
    }
    c.putImageData(image, 0, 0);
    rugCanvases.set(kind, canvas);
  }
  ctx.drawImage(canvas, x - RUG_W / 2, y - RUG_H / 2);
}

// 집 안에서 본 문: 외관에서 고른 문과 같은 색과 무늬
const DOOR_INSIDE = [null, '#9a6a3c', '#c2352e', '#a8c8e0', '#f0c34a', '#f6efdc', '#3d6fb6', '#f29bbd'];

function drawRoomDoor(room) {
  const [dx, dy] = room.door, style = room.ext?.door || 0;
  box(dx - 40, dy - 2, 80, SIDE_WALL + 2, '#3f2410', 2);
  box(dx - 34, dy, 68, SIDE_WALL - 4, DOOR_INSIDE[style] || '#7a4a24', 2);
  if (style === 5 || style === 6 || style === 1) {   // 창호 살, 쌍문의 가운데, 널빤지
    strokeLines(style === 5 ? '#7a5232' : 'rgba(0, 0, 0, 0.35)', 1.5, () => {
      for (let x = dx - 34 + (style === 6 ? 34 : 11); x < dx + 34; x += style === 6 ? 68 : 11) {
        ctx.moveTo(x, dy);
        ctx.lineTo(x, dy + SIDE_WALL - 4);
      }
    });
  } else if (style === 7) {
    drawHeart(dx, dy + 8, 0.6, '#ffffff');
  } else if (style === 3) {
    box(dx - 30, dy + 3, 20, 3, 'rgba(255, 255, 255, 0.7)', 1);
  }
  box(dx - 44, dy - 34, 88, 28, '#8a7a5c', 4);
  box(dx - 39, dy - 30, 78, 20, '#a8976f', 3);
}

function drawWallShade(x, y, w) {  // 벽 아래 그림자
  const shade = ctx.createLinearGradient(0, y, 0, y + 26);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, 26);
}

// 바닥의 윗변 중에서 다른 바닥과 맞닿지 않아 벽이 서는 구간들
function exposedTop(floor, floors) {
  let spans = [[floor.x0, floor.x1]];
  for (const other of floors) {
    if (other === floor || other.y1 !== floor.y0) continue;
    spans = spans.flatMap(([a, b]) => [[a, Math.min(b, other.x0)], [Math.max(a, other.x1), b]]).filter(([a, b]) => b > a);
  }
  return spans;
}

// 복도로 이어진 집: 바닥마다 자기 무늬를 그리고, 복도가 뚫린 곳을 빼고 벽을 세운다.
function drawCarvedRooms(room) {
  const floors = room.floors.map(([x0, y0, x1, y1, style]) => ({ x0, y0, x1, y1, style: ROOM_STYLES[style] }));
  const wasSingle = room.base?.length === 1;
  for (const f of floors) box(f.x0 - SIDE_WALL, f.y0 - WALL_HEIGHT, f.x1 - f.x0 + SIDE_WALL * 2, f.y1 - f.y0 + WALL_HEIGHT + SIDE_WALL, f.style.side);
  for (const f of floors) {
    ctx.save();
    ctx.translate(f.x0, f.y0);
    ctx.beginPath();
    ctx.rect(0, 0, f.x1 - f.x0, f.y1 - f.y0);
    ctx.clip();
    paintRoomFloor(f.style, { w: f.x1 - f.x0, h: f.y1 - f.y0 });
    ctx.restore();
  }
  for (const f of floors) {
    for (const [a, b] of exposedTop(f, floors)) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(a, f.y0 - WALL_HEIGHT, b - a, WALL_HEIGHT);
      ctx.clip();
      ctx.translate(f.x0, f.y0);
      f.style.wall({ w: f.x1 - f.x0 });
      ctx.restore();
      const capA = wasSingle && a === f.x0 ? a - SIDE_WALL : a, capB = wasSingle && b === f.x1 ? b + SIDE_WALL : b;
      box(capA, f.y0 - WALL_HEIGHT - 8, capB - capA, 8, 'rgba(0, 0, 0, 0.35)');
      drawWallShade(a, f.y0, b - a);
    }
  }
  drawRoomDoor(room);
}

function drawRoomShell(room) {
  if (room.floors) {
    drawCarvedRooms(room);
    return;
  }
  const style = ROOM_STYLES[room.style];
  const { w, h } = room;
  paintRoomFloor(style, room);
  style.wall(room);

  box(-SIDE_WALL, -WALL_HEIGHT, SIDE_WALL, h + WALL_HEIGHT + SIDE_WALL, style.side);
  box(w, -WALL_HEIGHT, SIDE_WALL, h + WALL_HEIGHT + SIDE_WALL, style.side);
  box(-SIDE_WALL, h, w + SIDE_WALL * 2, SIDE_WALL, style.side);
  box(-SIDE_WALL, -WALL_HEIGHT - 8, w + SIDE_WALL * 2, 8, 'rgba(0, 0, 0, 0.35)');
  drawWallShade(0, 0, w);
  if (!style.noMat) drawRoomDoor(room);
}

function drawRoomFurniture(items, predicate, now, night) {
  for (const f of items) if (predicate(f.k)) drawFurniturePiece(f, now, night);  // 염색한 가구는 home/decor.js 의 drawFurniturePiece 가 물들여 그린다
}
