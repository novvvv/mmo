'use strict';
// 건물 그림: 집(모양·벽·지붕·문·장식), 카페, 극장, 카지노, 재즈바.

// ---- 집 외관: 벽 색, 지붕 색, 문, 장식. 번호 0 은 원래 모습이다. 서버 core/rules.hpp 의 kExterior* 와 개수가 같다.
const EXT_WALLS = [['원래 색', ''], ['크림', '#eadbb8'], ['분홍', '#f2b8c6'], ['하늘', '#9cc7e8'], ['민트', '#a8d8b0'], ['노랑', '#f4d35e'], ['보라', '#9a86c8'], ['차콜', '#5a5f6b'], ['흰색', '#f8f6f0']];
const EXT_ROOFS = [['원래 색', ''], ['빨강', '#c8423a'], ['파랑', '#3d6fb6'], ['초록', '#3f8a4f'], ['갈색', '#7a4a2a'], ['검정', '#34353c'], ['분홍', '#e27fa4'], ['보라', '#6d4fa0'], ['하늘', '#6fb7e0']];
const EXT_DOORS = ['원래 문', '아치 나무문', '빨간 대문', '유리문', '동그란 문', '창호 미닫이', '파란 쌍문', '하트 창 문'];
const EXT_DECOS = ['화단', '울타리', '우체통', '등불', '화분', '꼬마전구'];
// 집의 생김새. 0 은 그 집의 원래 모양이고, 나머지는 어느 집이든 고를 수 있다. 서버 core/rules.hpp 의 kExteriorForms 와 개수가 같다
const EXT_FORMS = ['원래 모양', '벽돌집', '통나무집', '박공집', '버섯집', '기와집', '이층집', '돔집', '풍차집'];
const NO_EXT = { wall: 0, roof: 0, door: 0, deco: 0, form: 0 };

function shade(color, t) { return t < 0 ? mixColor(color, '#000000', -t) : mixColor(color, '#ffffff', t); }

// 문 디자인 (w, h 는 문틀까지 포함한 크기). 집 밖의 문과 집 안의 문이 같은 모양을 쓴다.
function drawDoorStyle(style, x, ground, w, h, lit) {
  const left = x - w / 2, top = ground - h, glass = lit ? '#ffd98a' : '#bfe0f0';
  if (style === 1) {          // 아치 나무문: 둥근 윗머리, 세로 널빤지, 쇠 경첩
    box(left, top, w, h, '#3f2410', [w / 2, w / 2, 0, 0]);
    box(left + 4, top + 4, w - 8, h - 4, '#9a6a3c', [w / 2 - 4, w / 2 - 4, 0, 0]);
    strokeLines('#6e4423', 1.5, () => {
      for (let dx = -w / 2 + 4 + (w - 8) / 4; dx < w / 2 - 5; dx += (w - 8) / 4) {
        ctx.moveTo(x + dx, top + 8);
        ctx.lineTo(x + dx, ground);
      }
    });
    for (const y of [top + h * 0.32, top + h * 0.72]) box(left + 4, y, w * 0.45, 4, '#2e2f33', 1);
    fillCircles('#2e2f33', [[x + w * 0.28, top + h * 0.55, 3]]);
  } else if (style === 2) {   // 빨간 대문: 두 칸 판넬, 놋쇠 손잡이, 위의 채광창
    box(left, top, w, h, '#4a1b17', 2);
    box(left + 4, top + 4, w - 8, 12, glass, 1);
    box(left + 4, top + 19, w - 8, h - 19, '#c2352e', 1);
    for (const y of [top + 24, top + 24 + (h - 30) / 2]) box(left + 9, y, w - 18, (h - 36) / 2, '#a52923', 2);
    fillCircles('#f2d04b', [[x + w * 0.3, top + h * 0.6, 3]]);
  } else if (style === 3) {   // 유리문: 검은 금속 틀과 가로 손잡이
    box(left, top, w, h, '#26272b', 2);
    box(left + 5, top + 5, w - 10, h - 10, glass, 1);
    polygon([[left + 8, top + 8], [left + w * 0.45, top + 8], [left + 8, top + h * 0.45]], 'rgba(255, 255, 255, 0.45)');
    box(x - w * 0.3, top + h * 0.55, w * 0.6, 4, '#c9ccd2', 2);
  } else if (style === 4) {   // 동그란 문: 노란 반원 윗머리와 가운데 손잡이
    box(left - 2, top - 2, w + 4, h + 2, '#5a3a1e', [w / 2 + 2, w / 2 + 2, 0, 0]);
    box(left + 2, top + 2, w - 4, h - 2, '#f0c34a', [w / 2 - 2, w / 2 - 2, 0, 0]);
    strokeLines('#c9962c', 1.5, () => {
      for (let dx = -w / 2 + 10; dx < w / 2 - 6; dx += 8) {
        ctx.moveTo(x + dx, top + 10);
        ctx.lineTo(x + dx, ground);
      }
    });
    fillCircles('#5a3a1e', [[x, top + h * 0.58, 4]]);
    roundWindow(x, top + w * 0.42, w * 0.16, '#5a3a1e', lit);
  } else if (style === 5) {   // 창호 미닫이: 나무 살과 한지
    box(left, top, w, h, '#5a3a22', 1);
    box(left + 4, top + 4, w - 8, h - 8, lit ? '#fff1c8' : '#f6efdc', 1);
    strokeLines('#7a5232', 2, () => {
      for (let dx = -w / 2 + 4; dx <= w / 2 - 4; dx += (w - 8) / 4) {
        ctx.moveTo(x + dx, top + 4);
        ctx.lineTo(x + dx, ground - 4);
      }
      for (let y = top + 4; y <= ground - 4; y += (h - 8) / 6) {
        ctx.moveTo(left + 4, y);
        ctx.lineTo(left + w - 4, y);
      }
    });
    box(x - 1.5, top, 3, h, '#5a3a22');
  } else if (style === 6) {   // 파란 쌍문: 두 짝에 작은 유리
    box(left, top, w, h, '#1e2f4a', 2);
    for (const side of [-1, 1]) {
      const dl = side < 0 ? left + 4 : x + 1;
      box(dl, top + 4, w / 2 - 5, h - 4, '#3d6fb6', 1);
      for (let row = 0; row < 3; row++) box(dl + 4, top + 9 + row * ((h * 0.55) / 3), w / 2 - 13, (h * 0.55) / 3 - 4, glass, 1);
      fillCircles('#f2d04b', [[x + side * 4, top + h * 0.66, 2.4]]);
    }
  } else if (style === 7) {   // 하트 창 문: 분홍 문에 하트 모양 창
    box(left, top, w, h, '#7a3a52', [8, 8, 0, 0]);
    box(left + 4, top + 4, w - 8, h - 4, '#f29bbd', [6, 6, 0, 0]);
    drawHeart(x, top + h * 0.3, w * 0.028, lit ? '#ffe9a0' : '#ffffff');
    box(left + 9, top + h * 0.52, w - 18, h * 0.36, '#e682a8', 3);
    fillCircles('#ffffff', [[x + w * 0.3, top + h * 0.56, 2.8]]);
  }
}

// 꼬마전구, 화단 같은 장식. eave 는 지붕 아래 끝 [왼쪽, 오른쪽, 높이(ground 에서)]
function drawHouseDeco(b, ground, now, lit, ext, door, eave) {
  const { x } = b, has = (bit) => (ext.deco >> bit) & 1;
  if (has(1)) {   // 울타리: 집 양옆으로 하얀 말뚝 울타리
    for (const side of [-1, 1]) {
      const from = x + side * 92, to = x + side * 150;
      box(Math.min(from, to), ground - 14, Math.abs(to - from), 4, '#efe9dc', 1);
      box(Math.min(from, to), ground - 6, Math.abs(to - from), 4, '#efe9dc', 1);
      for (let px = Math.min(from, to) + 3; px < Math.max(from, to); px += 11) {
        polygon([[px - 3.5, ground], [px - 3.5, ground - 20], [px, ground - 25], [px + 3.5, ground - 20], [px + 3.5, ground]], '#fbf8f0');
        strokeLines('rgba(120, 110, 90, 0.5)', 1, () => { ctx.moveTo(px + 3.5, ground - 20); ctx.lineTo(px + 3.5, ground); });
      }
    }
  }
  if (has(0)) {   // 화단: 창 아래 땅에 꽃밭
    for (const side of [-1, 1]) {
      const cx = x + side * 58;
      box(cx - 26, ground - 7, 52, 9, '#7a4e2a', 3);
      box(cx - 24, ground - 9, 48, 5, '#5b3a1e', 2);
      const colors = ['#f06b8b', '#f2d04b', '#ffffff', '#b98cf0', '#ff9f5a'];
      for (let i = 0; i < 6; i++) {
        const fx = cx - 20 + i * 8, fy = ground - 13 - (i % 2) * 3;
        box(fx - 0.5, fy, 1.5, 6, '#3f8a4f');
        fillCircles(colors[(i + (side > 0 ? 2 : 0)) % colors.length], [[fx, fy, 3.2]]);
      }
    }
  }
  if (has(4)) {   // 화분: 문 양옆
    for (const side of [-1, 1]) {
      const px = x + side * (door.w / 2 + 13);
      polygon([[px - 8, ground - 14], [px + 8, ground - 14], [px + 6, ground], [px - 6, ground]], '#c46a3a');
      box(px - 9, ground - 16, 18, 4, '#a85420', 1);
      fillCircles('#3f8a4f', [[px, ground - 24, 8], [px - 6, ground - 19, 6], [px + 6, ground - 19, 6]]);
      fillCircles('#5fae55', [[px - 2, ground - 27, 4]]);
    }
  }
  if (has(3)) {   // 등불: 문 양옆 벽에 건 등
    for (const side of [-1, 1]) {
      const lx = x + side * (door.w / 2 + 9), ly = ground - door.h + 12;
      box(lx - 1, ly - 10, 2, 8, '#2e3238');
      box(lx - 6, ly - 3, 12, 15, '#2e3238', 2);
      box(lx - 4, ly - 1, 8, 11, lit ? '#ffe7a3' : '#d9d4c0', 1);
      if (lit) drawGlowSoft(lx, ly + 5, 22);
    }
  }
  if (has(2)) {   // 우체통: 오른쪽 앞
    const mx = x + 74, my = ground + 14;
    box(mx - 2, my - 24, 4, 24, '#6b4423');
    box(mx - 10, my - 36, 20, 13, '#d64545', [6, 6, 1, 1]);
    box(mx - 10, my - 26, 20, 3, '#a8322f');
    box(mx + 8, my - 40, 2, 12, '#2e3238');
    box(mx + 8, my - 40, 7, 5, '#f2d04b');
  }
  if (has(5)) {   // 꼬마전구: 지붕 끝을 따라 늘어진 줄
    const [l, r, hgt] = eave, y = ground - hgt, colors = ['#ff5a5a', '#ffd34d', '#5ad07a', '#5aa8ff', '#ff8ad8'];
    const sag = (t) => y + 4 + Math.sin(t * Math.PI) * 9;
    strokeLines('#2f3a33', 1, () => {
      ctx.moveTo(x + l, y + 4);
      for (let t = 0; t <= 1.001; t += 0.05) ctx.lineTo(x + l + (r - l) * t, sag(t));
    });
    const count = Math.floor((r - l) / 14);
    for (let i = 0; i <= count; i++) {
      const t = i / count, on = lit || (Math.floor(now / 500) + i) % 2 === 0;
      fillCircles(on ? colors[i % colors.length] : '#7a7f86', [[x + l + (r - l) * t, sag(t) + 3, 2.8]]);
    }
  }
}

function drawGlowSoft(x, y, r) {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, r);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.7)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// 몰쟈: 주황 기와지붕의 벽돌집
function drawBrickHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 176, H = 84, left = x - W / 2, top = ground - H;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#c77b57', roof = EXT_ROOFS[ext.roof]?.[1] || '#e8823a', trim = ext.roof ? shade(roof, -0.32) : '#a85420';

  box(left, top, W, H, wall);
  strokeLines('rgba(90, 40, 25, 0.35)', 1, () => {
    for (let row = 0, y = top + 9; y < ground - 8; y += 9, row++) {
      ctx.moveTo(left, y);
      ctx.lineTo(left + W, y);
      for (let bx = left + (row % 2 ? 12 : 0); bx < left + W; bx += 24) {
        ctx.moveTo(bx, y);
        ctx.lineTo(bx, y + 9);
      }
    }
  });
  box(left - 2, ground - 9, W + 4, 9, '#8d8377');

  box(x + 44, ground - 174, 24, 56, '#a65f45');
  box(x + 40, ground - 180, 32, 8, '#6f4030');
  for (let i = 0; i < 3; i++) {  // 굴뚝 연기
    const t = ((now / 2600) + i / 3) % 1;
    oval(x + 56 + Math.sin(t * 6 + i) * 6, ground - 186 - t * 40, 5 + t * 8, 4 + t * 6, `rgba(235, 235, 235, ${0.5 * (1 - t)})`);
  }

  polygon([[x - 104, ground - 82], [x + 104, ground - 82], [x + 72, ground - 152], [x - 72, ground - 152]], roof);
  strokeLines('rgba(80, 40, 20, 0.35)', 2, () => {
    for (let y = ground - 142; y < ground - 84; y += 12) {
      const inset = ((y - (ground - 152)) / 70) * 32;
      ctx.moveTo(x - 72 - inset, y);
      ctx.lineTo(x + 72 + inset, y);
    }
  });
  box(x - 76, ground - 156, 152, 7, trim, 3);
  box(x - 108, ground - 86, 216, 7, trim, 3);

  for (const side of [-1, 1]) {
    windowPane(x + side * 54 - 18, ground - 66, 36, 30, '#f2e6d0', lit);
    box(x + side * 54 - 24, ground - 32, 48, 9, '#7a4a24', 2);
    fillCircles('#f06b8b', [[x + side * 54 - 14, ground - 34, 4], [x + side * 54 + 14, ground - 34, 4]]);
    fillCircles('#f2d04b', [[x + side * 54, ground - 35, 4]]);
  }

  if (ext.door) drawDoorStyle(ext.door, x, ground, 38, 58, lit);
  else {
    box(x - 19, ground - 58, 38, 58, '#5a3418', [14, 14, 0, 0]);
    box(x - 15, ground - 54, 30, 54, '#7a4a24', [11, 11, 0, 0]);
    fillCircles('#f2d04b', [[x + 9, ground - 26, 2.6]]);
    windowPane(x - 8, ground - 48, 16, 12, '#5a3418', lit, 2);
  }
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-104, 104, 84]);

  signBoard(x, ground - 72, b.name, '#6b3f1d', '#ffe9c4', '#3f2410');
}

// 랏라: 초록 박공지붕의 통나무집
function drawCabin(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 176, H = 80, left = x - W / 2, top = ground - H;
  const log = EXT_WALLS[ext.wall]?.[1] || '#8a5a32', logDark = ext.wall ? shade(log, -0.1) : '#7a4e2a';
  const endLight = ext.wall ? shade(log, 0.28) : '#b98a58';
  const roof = EXT_ROOFS[ext.roof]?.[1] || '#3f8a4f', roofDark = ext.roof ? shade(roof, -0.18) : '#2f7a48', moss = ext.roof ? shade(roof, 0.14) : '#4f9c5c';

  for (let i = 0, y = top; y < ground; y += 13, i++) {
    box(left, y, W, 13, i % 2 ? log : logDark, 4);
    strokeLines('rgba(60, 34, 16, 0.5)', 1, () => {
      ctx.moveTo(left, y + 12.5);
      ctx.lineTo(left + W, y + 12.5);
    });
  }
  for (const side of [-1, 1]) {  // 통나무 끝
    for (let y = top + 6; y < ground; y += 13) {
      fillCircles(endLight, [[x + side * (W / 2 + 1), y, 6.5]]);
      fillCircles(log, [[x + side * (W / 2 + 1), y, 3]]);
    }
  }

  polygon([[x - 112, ground - 76], [x + 112, ground - 76], [x, ground - 176]], roofDark);
  polygon([[x - 94, ground - 76], [x + 94, ground - 76], [x, ground - 160]], roof);
  fillCircles(moss, [[x - 44, ground - 96, 10], [x + 30, ground - 112, 12], [x - 8, ground - 138, 8], [x + 62, ground - 88, 8]]);
  roundWindow(x, ground - 112, 13, '#6b4423', lit);

  for (const side of [-1, 1]) {
    const wx = x + side * 56;
    windowPane(wx - 15, ground - 60, 30, 28, '#5a3418', lit);
    box(wx - 26, ground - 62, 9, 32, '#2f6b45', 1);
    box(wx + 17, ground - 62, 9, 32, '#2f6b45', 1);
  }

  if (ext.door) drawDoorStyle(ext.door, x, ground, 38, 58, lit);
  else {
    box(x - 19, ground - 58, 38, 58, '#3f2410', 2);
    box(x - 15, ground - 54, 30, 54, '#2f6b45', 1);
    strokeLines('#23543a', 2, () => {
      for (let dx = -8; dx <= 8; dx += 8) {
        ctx.moveTo(x + dx, ground - 54);
        ctx.lineTo(x + dx, ground);
      }
    });
    fillCircles('#f2d04b', [[x + 9, ground - 26, 2.6]]);
  }

  box(x + 24, ground - 58, 3, 16, '#2e3238');  // 문 옆 등불
  box(x + 20, ground - 44, 11, 13, lit ? '#ffe7a3' : '#c9ccc4', 2);

  fillCircles('#3f8a4f', [[x - 70, ground - 2, 9], [x - 58, ground - 3, 7], [x + 62, ground - 2, 8], [x + 74, ground - 3, 9]]);
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-108, 108, 78]);
  signBoard(x, ground - 70, b.name, '#d9b77a', '#3f2410', '#6b4423');
}

// 캬캬: 분홍 돔 지붕의 파스텔 집
function drawLoftHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 172, H = 92, left = x - W / 2, top = ground - H;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#f2efe9', roof = EXT_ROOFS[ext.roof]?.[1] || '#8f8578';

  box(left, top, W, H, wall, 3);
  strokeLines('rgba(150, 142, 130, 0.38)', 1, () => {
    for (let row = 0, by = top + 8; by < ground; by += 8, row++) {
      ctx.moveTo(left, by);
      ctx.lineTo(left + W, by);
      for (let bx = left + (row % 2 ? 9 : 0); bx < left + W; bx += 18) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + 8);
      }
    }
  });
  box(left, ground - 10, W, 10, '#8b8074');

  // 낮은 박공지붕과 나무 보
  polygon([[left - 16, top + 2], [x, top - 66], [left + W + 16, top + 2]], roof);
  polygon([[left + 6, top + 2], [x, top - 46], [left + W - 6, top + 2]], wall);
  box(left - 20, top, W + 40, 9, '#6b5543', 2);
  for (const dx of [-62, -20, 20, 62]) box(x + dx - 3, top + 9, 6, 8, '#6b5543');

  // 검은 프레임의 큰 창
  for (const side of [-1, 1]) {
    const wx = x + side * 56;
    box(wx - 26, ground - 74, 52, 58, '#26262a', 2);
    box(wx - 22, ground - 70, 44, 50, lit ? '#ffd98a' : '#cfe3ee');
    strokeLines('#26262a', 2, () => {
      ctx.moveTo(wx, ground - 70);
      ctx.lineTo(wx, ground - 20);
      ctx.moveTo(wx - 22, ground - 46);
      ctx.lineTo(wx + 22, ground - 46);
    });
  }

  // 나무 문
  if (ext.door) drawDoorStyle(ext.door, x, ground, 44, 68, lit);
  else {
    box(x - 22, ground - 68, 44, 68, '#3a2c20', 2);
    box(x - 18, ground - 64, 36, 64, '#8a6a4c', 1);
    strokeLines('#6b5038', 1.5, () => {
      for (let dx = -10; dx <= 10; dx += 10) {
        ctx.moveTo(x + dx, ground - 62);
        ctx.lineTo(x + dx, ground - 2);
      }
    });
    fillCircles('#26262a', [[x + 11, ground - 30, 2.6]]);
  }
  drawHouseDeco(b, ground, now, lit, ext, { w: 44, h: 68 }, [-W / 2 - 18, W / 2 + 18, H - 4]);

  signBoard(x, ground - 80, b.name, '#f7f3ea', '#4a3a2c', '#8f8578');
}

// 문: 고른 문이 없으면 이 모양의 기본 문(나무 판문)
function plainDoor(ext, x, ground, lit, frame, panel) {
  if (ext.door) {
    drawDoorStyle(ext.door, x, ground, 38, 58, lit);
    return;
  }
  box(x - 19, ground - 58, 38, 58, frame, [10, 10, 0, 0]);
  box(x - 15, ground - 54, 30, 54, panel, [8, 8, 0, 0]);
  fillCircles('#f2d04b', [[x + 9, ground - 26, 2.6]]);
}

// 버섯집: 통통한 기둥 위에 물방울무늬 갓
function drawMushroomHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#f3e6cf', cap = EXT_ROOFS[ext.roof]?.[1] || '#d9463e';
  const wallDark = shade(wall, -0.14), capDark = shade(cap, -0.22);
  // 아래로 갈수록 살짝 넓어지는 기둥
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(x - 70, ground);
  ctx.quadraticCurveTo(x - 86, ground - 50, x - 62, ground - 96);
  ctx.lineTo(x + 62, ground - 96);
  ctx.quadraticCurveTo(x + 86, ground - 50, x + 70, ground);
  ctx.closePath();
  ctx.fill();
  strokeLines(wallDark, 2, () => {
    for (const dx of [-48, 46]) {
      ctx.moveTo(x + dx, ground - 86);
      ctx.quadraticCurveTo(x + dx * 1.16, ground - 46, x + dx * 1.08, ground - 6);
    }
  });
  box(x - 74, ground - 8, 148, 8, wallDark, 3);
  // 갓: 아래쪽 주름과 둥근 지붕
  oval(x, ground - 94, 106, 16, capDark);
  strokeLines('rgba(255, 255, 255, 0.35)', 1.5, () => {
    for (let dx = -84; dx <= 84; dx += 14) {
      ctx.moveTo(x + dx * 0.72, ground - 96);
      ctx.lineTo(x + dx, ground - 86 + Math.abs(dx) * 0.03);
    }
  });
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.moveTo(x - 112, ground - 96);
  ctx.bezierCurveTo(x - 112, ground - 196, x + 112, ground - 196, x + 112, ground - 96);
  ctx.quadraticCurveTo(x, ground - 84, x - 112, ground - 96);
  ctx.fill();
  fillCircles('rgba(255, 255, 255, 0.92)', [[x - 66, ground - 124, 13], [x - 18, ground - 154, 15], [x + 40, ground - 132, 12], [x + 76, ground - 110, 9], [x - 92, ground - 104, 7], [x + 8, ground - 114, 8]]);
  oval(x - 40, ground - 160, 26, 9, 'rgba(255, 255, 255, 0.18)');
  box(x + 52, ground - 190, 14, 30, wallDark, 2);   // 작은 굴뚝
  box(x + 49, ground - 194, 20, 6, capDark, 2);
  for (const side of [-1, 1]) roundWindow(x + side * 46, ground - 48, 14, '#8a5a32', lit);
  plainDoor(ext, x, ground, lit, '#6b4423', '#a9743f');
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-108, 108, 90]);
  signBoard(x, ground - 72, b.name, '#fbf3df', '#6b4423', capDark);
}

// 기와집: 흰 회벽과 나무 기둥, 끝이 살짝 들린 기와지붕
function drawTileHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 176, H = 78, left = x - W / 2, top = ground - H;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#f4efe2', roof = EXT_ROOFS[ext.roof]?.[1] || '#4a5360';
  const roofDark = shade(roof, -0.28), wood = '#6b4a2e';
  box(left - 8, ground - 10, W + 16, 10, '#9a9388', 2);   // 댓돌
  box(left, top, W, H - 10, wall);
  for (const dx of [-W / 2, -W / 4 - 6, W / 4 - 2, W / 2 - 8]) box(x + dx, top, 8, H - 10, wood);   // 기둥
  box(left, top, W, 7, wood);
  box(left, ground - 34, W, 5, wood);
  // 지붕: 가운데가 내려앉고 처마 끝이 들린 곡선
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 122, ground - 92);
  ctx.quadraticCurveTo(x - 96, ground - 84, x - 84, ground - 82);
  ctx.lineTo(x + 84, ground - 82);
  ctx.quadraticCurveTo(x + 96, ground - 84, x + 122, ground - 92);
  ctx.quadraticCurveTo(x + 76, ground - 104, x + 58, ground - 148);
  ctx.lineTo(x - 58, ground - 148);
  ctx.quadraticCurveTo(x - 76, ground - 104, x - 122, ground - 92);
  ctx.fill();
  strokeLines(roofDark, 2, () => {   // 기왓골
    for (let dx = -52; dx <= 52; dx += 13) {
      ctx.moveTo(x + dx, ground - 146);
      ctx.quadraticCurveTo(x + dx * 1.25, ground - 110, x + dx * 1.62, ground - 84);
    }
  });
  box(x - 62, ground - 156, 124, 10, roofDark, 4);   // 용마루
  fillCircles(roofDark, [[x - 62, ground - 152, 7], [x + 62, ground - 152, 7]]);
  for (let dx = -112; dx <= 112; dx += 16) fillCircles(roofDark, [[x + dx, ground - 82 - Math.max(0, Math.abs(dx) - 84) * 0.28, 4.2]]);   // 막새
  for (const side of [-1, 1]) {   // 창호 창
    const wx = x + side * 56;
    box(wx - 20, ground - 68, 40, 30, wood, 1);
    box(wx - 17, ground - 65, 34, 24, lit ? '#ffe6a8' : '#f6efdc');
    strokeLines('#8a6a48', 1.5, () => {
      for (let dx = -8.5; dx <= 8.5; dx += 8.5) {
        ctx.moveTo(wx + dx, ground - 65);
        ctx.lineTo(wx + dx, ground - 41);
      }
      ctx.moveTo(wx - 17, ground - 53);
      ctx.lineTo(wx + 17, ground - 53);
    });
  }
  if (ext.door) drawDoorStyle(ext.door, x, ground, 38, 58, lit);
  else drawDoorStyle(5, x, ground - 10, 38, 50, lit);
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-116, 116, 84]);
  signBoard(x, ground - 74, b.name, '#3a2c20', '#f4efe2', roofDark);
}

// 이층집: 좁고 높은 벽, 2층 발코니와 뾰족한 지붕
function drawTallHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 164, H = 158, left = x - W / 2, top = ground - H;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#e9d9b6', roof = EXT_ROOFS[ext.roof]?.[1] || '#3d6fb6';
  const trim = shade(wall, -0.3), roofDark = shade(roof, -0.25);
  box(left, top, W, H, wall);
  strokeLines('rgba(0, 0, 0, 0.1)', 1, () => {
    for (let y = top + 12; y < ground - 8; y += 12) {
      ctx.moveTo(left, y);
      ctx.lineTo(left + W, y);
    }
  });
  box(left - 2, ground - 9, W + 4, 9, '#8d8377');
  box(left - 6, ground - 84, W + 12, 6, trim, 2);   // 층 사이 띠
  // 굴뚝과 지붕
  box(x + 38, top - 78, 20, 44, shade(wall, -0.42));
  box(x + 34, top - 84, 28, 8, roofDark);
  polygon([[left - 18, top + 4], [x, top - 84], [left + W + 18, top + 4]], roof);
  strokeLines(roofDark, 2, () => {
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      ctx.moveTo(left - 18 + (x - left + 18) * t, top + 4 - 88 * t);
      ctx.lineTo(left + W + 18 - (left + W + 18 - x) * t, top + 4 - 88 * t);
    }
  });
  box(left - 22, top, W + 44, 8, roofDark, 3);
  roundWindow(x, top - 34, 12, trim, lit);
  // 2층: 창 둘과 가운데 발코니 문
  for (const side of [-1, 1]) {
    windowPane(x + side * 54 - 16, top + 22, 32, 38, trim, lit);
    box(x + side * 54 - 21, top + 60, 42, 5, trim, 1);
  }
  box(x - 15, top + 18, 30, 50, trim, [10, 10, 0, 0]);
  box(x - 12, top + 21, 24, 47, lit ? '#ffd98a' : '#bfe0f0', [8, 8, 0, 0]);
  box(x - 30, top + 66, 60, 5, trim, 1);
  strokeLines(trim, 2, () => {
    for (let dx = -26; dx <= 26; dx += 8.6) {
      ctx.moveTo(x + dx, top + 52);
      ctx.lineTo(x + dx, top + 68);
    }
    ctx.moveTo(x - 30, top + 52);
    ctx.lineTo(x + 30, top + 52);
  });
  // 1층
  for (const side of [-1, 1]) {
    windowPane(x + side * 54 - 17, ground - 66, 34, 30, trim, lit);
    box(x + side * 54 - 22, ground - 34, 44, 7, shade(roof, -0.1), 2);
    fillCircles('#f06b8b', [[x + side * 54 - 12, ground - 36, 3.6], [x + side * 54 + 12, ground - 36, 3.6]]);
    fillCircles('#ffffff', [[x + side * 54, ground - 37, 3.6]]);
  }
  plainDoor(ext, x, ground, lit, shade(roof, -0.45), roof);
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-W / 2 - 6, W / 2 + 6, 80]);
  signBoard(x, ground - 72, b.name, '#fbf6ea', '#3a2c20', trim);
}

// 돔집: 낮은 벽 위에 유리 띠를 두른 둥근 지붕
function drawDomeHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b, W = 176, H = 64, left = x - W / 2, top = ground - H;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#e8eef2', roof = EXT_ROOFS[ext.roof]?.[1] || '#6fb7e0';
  const roofDark = shade(roof, -0.24), trim = shade(wall, -0.35);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 92, top + 2);
  ctx.bezierCurveTo(x - 92, top - 122, x + 92, top - 122, x + 92, top + 2);
  ctx.closePath();
  ctx.fill();
  strokeLines(roofDark, 2, () => {   // 돔의 살
    for (const k of [-0.62, -0.22, 0.22, 0.62]) {
      ctx.moveTo(x + k * 20, top - 90);
      ctx.quadraticCurveTo(x + k * 110, top - 70, x + k * 138, top + 2);
    }
    ctx.moveTo(x - 86, top - 30);
    ctx.quadraticCurveTo(x, top - 46, x + 86, top - 30);
  });
  for (const k of [-0.5, 0, 0.5]) {   // 돔의 창
    const wx = x + k * 104, wy = top - 44 + Math.abs(k) * 16;
    oval(wx, wy, 13, 11, roofDark);
    oval(wx, wy, 10, 8, lit ? '#ffe7a3' : '#e9f6fd');
  }
  oval(x - 34, top - 76, 22, 8, 'rgba(255, 255, 255, 0.28)');
  box(x - 3, top - 108, 6, 16, trim);   // 꼭대기 안테나
  fillCircles(lit && Math.floor(now / 700) % 2 ? '#ff6a6a' : '#c84a4a', [[x, top - 110, 4.5]]);
  box(left, top, W, H, wall, [6, 6, 0, 0]);
  box(left - 4, top - 2, W + 8, 8, trim, 3);
  box(left - 2, ground - 8, W + 4, 8, trim);
  for (const side of [-1, 1]) {
    const wx = x + side * 56;
    box(wx - 24, ground - 52, 48, 28, trim, 14);
    box(wx - 21, ground - 49, 42, 22, lit ? '#ffd98a' : '#bfe0f0', 11);
  }
  plainDoor(ext, x, ground, lit, trim, roof);
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-94, 94, H]);
  signBoard(x, ground - 72, b.name, '#ffffff', '#2f4a5c', roofDark);
}

// 풍차집: 위로 좁아지는 탑과 천천히 도는 날개
function drawWindmillHouse(b, ground, now, lit, ext = NO_EXT) {
  const { x } = b;
  const wall = EXT_WALLS[ext.wall]?.[1] || '#f1e7d2', roof = EXT_ROOFS[ext.roof]?.[1] || '#a8473a';
  const wallDark = shade(wall, -0.16), roofDark = shade(roof, -0.25);
  polygon([[x - 84, ground], [x - 50, ground - 150], [x + 50, ground - 150], [x + 84, ground]], wall);
  strokeLines(wallDark, 1.5, () => {
    for (let y = ground - 20; y > ground - 150; y -= 20) {
      const inset = ((ground - y) / 150) * 34;
      ctx.moveTo(x - 84 + inset, y);
      ctx.lineTo(x + 84 - inset, y);
    }
  });
  box(x - 88, ground - 9, 176, 9, '#8d8377');
  // 둥근 지붕과 날개 축
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 58, ground - 148);
  ctx.bezierCurveTo(x - 54, ground - 204, x + 54, ground - 204, x + 58, ground - 148);
  ctx.closePath();
  ctx.fill();
  box(x - 62, ground - 152, 124, 7, roofDark, 3);
  roundWindow(x, ground - 96, 11, '#7a5a3a', lit);
  for (const side of [-1, 1]) windowPane(x + side * 50 - 13, ground - 62, 26, 28, '#7a5a3a', lit);
  plainDoor(ext, x, ground, lit, '#5a3a22', '#8a5f3a');
  drawHouseDeco(b, ground, now, lit, ext, { w: 38, h: 58 }, [-66, 66, 150]);
  signBoard(x, ground - 72, b.name, '#fbf3df', '#5a3a22', roofDark);
  // 날개: 간판보다 위에서 돈다
  ctx.save();
  ctx.translate(x, ground - 160);
  ctx.rotate(now / 2600);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    box(-2.5, -78, 5, 78, '#6b4a2e', 2);
    box(3, -76, 20, 52, 'rgba(250, 244, 230, 0.92)', 1);
    strokeLines('#8a6a48', 1, () => {
      for (let y = -76; y <= -24; y += 13) {
        ctx.moveTo(3, y);
        ctx.lineTo(23, y);
      }
      ctx.moveTo(13, -76);
      ctx.lineTo(13, -24);
      ctx.rect(3, -76, 20, 52);
    });
  }
  ctx.restore();
  fillCircles('#4a3320', [[x, ground - 160, 7]]);
  fillCircles('#d9b46a', [[x, ground - 160, 3]]);
}

function drawTheater(b, ground, now, lit) {
  const { x } = b, W = 340, H = 130, left = x - W / 2, top = ground - H;
  box(left, top, W, H, '#7a1f24', 3);
  for (let px = left + 20; px < left + W; px += 40) box(px - 3, top + 34, 6, H - 34, '#5e161b');
  box(left - 12, top - 26, W + 24, 34, '#9a2a2e', 4);
  box(left - 12, top - 4, W + 24, 8, '#d9b46a', 2);

  // 전구가 둘린 간판
  box(x - 86, top - 62, 172, 46, '#26181a', 6);
  box(x - 80, top - 56, 160, 34, lit ? '#ffe9b8' : '#f6e6c4', 4);
  label(b.name, x, top - 38.5, `800 22px ${FONT}`, '#7a1f24');
  const blink = Math.floor(now / 350) % 2;
  for (let i = 0; i < 11; i++) {
    const on = lit || (i + blink) % 2 === 0;
    fillCircles(on ? '#ffd76a' : '#b98d3e', [[x - 80 + i * 16, top - 60, 2.8], [x - 80 + i * 16, top - 19, 2.8]]);
  }

  // 양쪽 포스터와 문
  for (const side of [-1, 1]) {
    box(x + side * 112 - 26, ground - 96, 52, 76, '#26181a', 2);
    box(x + side * 112 - 22, ground - 92, 44, 68, side < 0 ? '#2f3f6e' : '#6e4a2f');
    fillCircles('#ffe9b8', [[x + side * 112, ground - 66, 11]]);
    box(x + side * 112 - 14, ground - 44, 28, 4, '#ffe9b8');
  }
  box(x - 54, ground - 78, 108, 78, '#26181a', 2);
  for (const side of [-1, 1]) box(x + side * 26 - 22, ground - 72, 44, 72, lit ? '#ffd98a' : '#8a5a3a', 2);
  fillCircles('#d9b46a', [[x - 7, ground - 34, 2.6], [x + 7, ground - 34, 2.6]]);
}

// 카지노: 금빛 테두리의 검보라 건물, 전구가 도는 간판, 붉은 카펫과 유리 쌍문
function drawCasino(b, ground, now, lit) {
  const { x } = b, W = 236, H = 118, left = x - W / 2, top = ground - H;
  box(left, top, W, H, '#2a1f3d', 3);
  for (const px of [left + 10, left + W - 22, x - 70, x + 58]) box(px, top + 8, 12, H - 8, '#3a2a55');
  box(left - 8, top - 10, W + 16, 14, '#1a1228', 3);
  box(left - 8, top + 2, W + 16, 3, '#e8b830');
  // 계단 모양 지붕 장식
  box(x - 70, top - 30, 140, 22, '#3a2a55', 3);
  box(x - 44, top - 46, 88, 18, '#3a2a55', 3);
  box(x - 70, top - 30, 140, 3, '#e8b830');
  box(x - 44, top - 46, 88, 3, '#e8b830');
  // 간판
  box(x - 92, top - 98, 184, 52, '#120c1c', 6);
  box(x - 86, top - 92, 172, 40, lit ? '#3a1050' : '#2a0c3a', 4);
  label(b.name, x, top - 71.5, `800 24px ${FONT}`, lit ? '#ffe28a' : '#e8b830');
  const chase = Math.floor(now / 160);
  for (let i = 0; i < 12; i++) {
    const on = (i + chase) % 3 === 0;
    fillCircles(on ? '#fff3b0' : '#b98d3e', [[x - 86 + i * 15.6, top - 95, 2.8], [x + 86 - i * 15.6, top - 49, 2.8]]);
  }
  // 네온 주사위와 스페이드
  const blink = Math.floor(now / 600) % 2;
  box(left + 20, top + 20, 30, 30, blink ? '#ff5aa8' : '#c03a7a', 5);
  fillCircles('#ffffff', [[left + 28, top + 28, 3], [left + 35, top + 35, 3], [left + 42, top + 42, 3]]);
  label('♠', left + W - 35, top + 36, `800 30px ${FONT}`, blink ? '#7ae0ff' : '#3a9ac0');
  // 창: 안쪽의 빠칭코 불빛
  for (const side of [-1, 1]) {
    const wx = x + side * 72;
    box(wx - 24, ground - 74, 48, 44, '#e8b830', [12, 12, 2, 2]);
    box(wx - 20, ground - 70, 40, 38, lit ? '#ffb85a' : '#7a3a8a', [10, 10, 1, 1]);
    for (let i = 0; i < 3; i++) fillCircles(['#ff5a5a', '#5ad07a', '#5aa8ff'][(i + chase) % 3], [[wx - 10 + i * 10, ground - 44, 2.4]]);
  }
  // 붉은 카펫과 유리 쌍문
  polygon([[x - 26, ground], [x + 26, ground], [x + 40, ground + 26], [x - 40, ground + 26]], '#b02a3a');
  box(x - 30, ground - 72, 60, 72, '#e8b830', [6, 6, 0, 0]);
  box(x - 26, ground - 68, 25, 68, lit ? '#ffe2a0' : '#a8c8e0', [4, 0, 0, 0]);
  box(x + 1, ground - 68, 25, 68, lit ? '#ffe2a0' : '#a8c8e0', [0, 4, 0, 0]);
  box(x - 6, ground - 40, 3, 14, '#8a6a20');
  box(x + 3, ground - 40, 3, 14, '#8a6a20');
  // 금빛 기둥과 붉은 줄
  for (const side of [-1, 1]) {
    const px = x + side * 50;
    box(px - 2, ground + 2, 4, 22, '#e8b830');
    fillCircles('#e8b830', [[px, ground + 2, 4]]);
  }
  strokeLines('#d6304a', 3, () => {
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * 50, ground + 6);
      ctx.quadraticCurveTo(x + side * 45, ground + 16, x + side * 40, ground + 10);
    }
  });
}

function drawJazzBar(b, ground, now, lit) {
  const { x } = b, W = 220, H = 118, left = x - W / 2, top = ground - H;
  box(left, top, W, H, '#4a1620', 3);
  strokeLines('#3a1018', 1, () => {
    for (let y = top + 14; y < ground; y += 14) {
      ctx.moveTo(left, y);
      ctx.lineTo(left + W, y);
    }
  });
  box(left - 8, top - 12, W + 16, 14, '#241014', 3);
  box(left - 8, top + 1, W + 16, 3, '#c19a55');

  // 네온 간판
  box(x - 72, top - 54, 144, 42, '#180b10', 6);
  box(x - 67, top - 49, 134, 32, lit ? '#3a1230' : '#2a0f22', 4);
  label(b.name, x, top - 32.5, `800 21px ${FONT}`, lit ? '#ffc4e6' : '#e59ac6');
  const beat = Math.floor(now / 500) % 2;
  label('♪', x - 50, top - 33, `800 16px ${FONT}`, beat ? '#ffd76a' : '#b98d3e');
  label('♫', x + 50, top - 33, `800 16px ${FONT}`, beat ? '#b98d3e' : '#ffd76a');

  // 양쪽 창, 안쪽의 램프가 비친다
  for (const side of [-1, 1]) {
    const cx = x + side * 72;
    box(cx - 27, ground - 92, 54, 62, '#241014', 2);
    box(cx - 23, ground - 88, 46, 54, lit ? '#f2b264' : '#a8622a');
    polygon([[cx - 9, ground - 74], [cx + 9, ground - 74], [cx + 14, ground - 60], [cx - 14, ground - 60]], lit ? '#fff0c8' : '#e8b264');
    box(cx - 1, ground - 60, 2, 22, '#241014');
    box(cx - 1, ground - 88, 2, 14, '#241014');
    box(cx - 30, ground - 30, 60, 5, '#c19a55', 1);
  }

  // 차양과 문
  box(x - 34, ground - 86, 68, 86, '#241014', 2);
  box(x - 29, ground - 80, 58, 80, '#5a2c1a', 2);
  box(x - 1, ground - 80, 2, 80, '#241014');
  for (const side of [-1, 1]) {
    fillCircles(lit ? '#ffd98a' : '#a8622a', [[x + side * 15, ground - 58, 9]]);
    fillCircles('#c19a55', [[x + side * 5, ground - 34, 2.6]]);
  }
  polygon([[x - 44, ground - 88], [x + 44, ground - 88], [x + 52, ground - 70], [x - 52, ground - 70]], '#7a2030');
  for (let i = 0; i < 4; i++) {
    const p = i * 26 - 39;
    polygon([[x + p - 6, ground - 88], [x + p + 6, ground - 88], [x + p * 1.18 + 7, ground - 70], [x + p * 1.18 - 7, ground - 70]], '#c9b08a');
  }
}

// 6 은 농장 입구(activity/farm.js 가 채움), 7 은 헤연의 집(기와집)
const HOUSE_STYLES = [drawBrickHouse, drawCabin, drawLoftHouse, drawTheater, drawCasino, drawJazzBar, null, drawTileHouse];
const HOUSE_FORMS = [null, drawBrickHouse, drawCabin, drawLoftHouse, drawMushroomHouse, drawTileHouse, drawTallHouse, drawDomeHouse, drawWindmillHouse];

// 건물의 겉모습: 집은 고른 모양이 있으면 그 모양으로, 없으면 원래 모양으로 그린다
function drawBuildingStyle(b, ground, now, lit, ext = NO_EXT) {
  (HOUSE_FORMS[ext.form] || HOUSE_STYLES[b.style])(b, ground, now, lit, ext);
}

// 지붕에 쌓인 눈처럼 집 모양에 맞춘 그림이 쓸 번호 (원래 세 집 0~2, 기와집 7). 그런 그림이 없는 모양은 -1
function houseShape(b) {
  const form = b.ext?.form || 0;
  return !form ? b.style : form <= 3 ? form - 1 : form === 5 ? 7 : -1;
}

// 잠시 ctx 를 다른 캔버스로 바꿔 가구 그림 함수를 그대로 쓴다.
function drawOn(target, paint) {
  const main = ctx;
  ctx = target;
  try {
    paint();
  } finally {
    ctx = main;
  }
}

function drawSleepZ(x, y, now) {
  for (let i = 0; i < 3; i++) {
    const p = ((now / 2100) + i / 3) % 1;
    ctx.globalAlpha = Math.min(1, (1 - p) * 1.8);
    label('Z', x + 18 + p * 18, y - 36 - p * 34, `700 ${11 + i * 2}px ${FONT}`, '#cfe2ff');
  }
  ctx.globalAlpha = 1;
}

// 왕국 주민. 역할에 맞는 모자와 소품을 얹는다.
const DART_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// 다트판. 고리의 크기는 서버 activity/darts.hpp 와 같아야 한다.
function drawDartBoard(c, x, y, R, numbers) {
  const step = TAU / 20;
  const ring = (inner, outer, even, odd) => {
    for (let i = 0; i < 20; i++) {
      const from = -Math.PI / 2 - step / 2 + i * step;
      c.fillStyle = i % 2 ? odd : even;
      c.beginPath();
      c.arc(x, y, outer * R, from, from + step);
      c.arc(x, y, inner * R, from + step, from, true);
      c.closePath();
      c.fill();
    }
  };
  const disc = (r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r * R, 0, TAU);
    c.fill();
  };
  disc(1.2, '#17130f');
  ring(0.14, 0.55, '#1d1a17', '#efe3c4');
  ring(0.55, 0.63, '#c9302c', '#2f8f4e');
  ring(0.63, 0.92, '#1d1a17', '#efe3c4');
  ring(0.92, 1, '#c9302c', '#2f8f4e');
  disc(0.14, '#2f8f4e');
  disc(0.06, '#c9302c');
  if (!numbers) return;
  c.fillStyle = '#f4efe6';
  c.font = `700 ${Math.round(R * 0.11)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  DART_NUMBERS.forEach((n, i) => {
    const a = -Math.PI / 2 + i * step;
    c.fillText(String(n), x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 1.1);
  });
}

// 판에 꽂힌 다트. (x, y) 가 촉의 위치다.
function drawDart(c, x, y, s, color) {
  c.strokeStyle = '#d8d8de';
  c.lineWidth = 1.6 * s;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + 7 * s, y - 9 * s);
  c.stroke();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x + 6 * s, y - 8 * s);
  c.lineTo(x + 14 * s, y - 10 * s);
  c.lineTo(x + 10 * s, y - 16 * s);
  c.closePath();
  c.fill();
}

const BAR_LAMPS = [-105, 60, 225];  // 바 위 램프의 자리. 바텐더 앞은 비워 둔다

// 재즈바의 갓 씌운 램프. y 는 램프 바닥이다.
function drawShadedLamp(x, y) {
  box(x - 6, y - 3, 12, 3, '#8a6a32', 1);
  box(x - 1.5, y - 22, 3, 20, '#8a6a32');
  polygon([[x - 7, y - 36], [x + 7, y - 36], [x + 13, y - 20], [x - 13, y - 20]], '#f0bb6e');
  polygon([[x - 5, y - 36], [x + 5, y - 36], [x + 6, y - 30], [x - 6, y - 30]], 'rgba(255, 244, 208, 0.65)');
  box(x - 13, y - 20, 26, 2, '#8a3a2a');
}

function drawDeck(b) {
  const [x0, y0, x1, y1] = b.deck;
  box(x0 - 2, y0 + 3, x1 - x0 + 4, y1 - y0, 'rgba(0, 0, 0, 0.2)', 6);
  box(x0, y0, x1 - x0, y1 - y0, '#b98a58', 5);
  strokeLines('#9a6b3c', 2, () => {
    for (let y = y0 + 13; y < y1; y += 13) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
  });
  strokeLines('#8a5a32', 3, () => ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 5));
}

function drawCafe(b, ground, now, lit) {
  const { x } = b, W = 226, H = 96, left = x - W / 2, top = ground - H;

  box(left, top, W, H, '#f2e4cc');
  box(left, ground - 12, W, 12, '#8a5a32');
  box(left - 6, top - 26, W + 12, 28, '#5b3a1e', 4);
  box(left - 2, top - 22, W + 4, 20, '#7a4e2a', 3);
  label(b.name, x, top - 11.5, `800 17px ${FONT}`, '#ffe9c4');
  // 커피잔 간판
  box(x - 66, top - 18, 14, 12, '#ffe9c4', [0, 0, 5, 5]);
  strokeLines('#ffe9c4', 2, () => ctx.arc(x - 51, top - 13, 3.5, -Math.PI / 2, Math.PI / 2));
  box(x + 52, top - 18, 14, 12, '#ffe9c4', [0, 0, 5, 5]);
  strokeLines('#ffe9c4', 2, () => ctx.arc(x + 67, top - 13, 3.5, -Math.PI / 2, Math.PI / 2));

  for (const side of [-1, 1]) {  // 큰 유리창
    const wx = x + side * 66;
    box(wx - 36, ground - 74, 72, 60, '#5b3a1e', 3);
    box(wx - 33, ground - 71, 66, 54, lit ? '#ffd98a' : '#bfe0f0', 2);
    strokeLines('#5b3a1e', 2, () => {
      ctx.moveTo(wx, ground - 71);
      ctx.lineTo(wx, ground - 17);
    });
    fillCircles(lit ? '#f7c56b' : '#9fc6da', [[wx - 16, ground - 56, 7], [wx + 16, ground - 56, 7]]);  // 안쪽 조명
    box(wx - 18, ground - 49, 2, 6, '#5b3a1e');
    box(wx + 14, ground - 49, 2, 6, '#5b3a1e');
  }

  box(x - 20, ground - 70, 40, 70, '#5b3a1e', 2);
  box(x - 16, ground - 66, 32, 66, lit ? '#ffd98a' : '#bfe0f0', 1);
  box(x + 8, ground - 36, 4, 12, '#5b3a1e', 2);

  // 줄무늬 차양
  const stripes = 13, stripeW = (W + 24) / stripes;
  for (let i = 0; i < stripes; i++) {
    const sx = left - 12 + i * stripeW;
    polygon([[sx + 8, ground - 92], [sx + stripeW + 8, ground - 92], [sx + stripeW, ground - 72], [sx, ground - 72]], i % 2 ? '#fdf8ee' : '#3f8a4f');
    fillCircles(i % 2 ? '#fdf8ee' : '#3f8a4f', [[sx + stripeW / 2, ground - 72, stripeW / 2]]);
  }

  // 테라스 위 전구줄
  const [dx0, dy0, dx1] = b.deck;
  const lights = 13;
  strokeLines('#3a3f47', 1.5, () => {
    ctx.moveTo(dx0 + 6, dy0 - 28);
    ctx.quadraticCurveTo(x, dy0 + 2, dx1 - 6, dy0 - 28);
  });
  for (let i = 1; i < lights; i++) {
    const t = i / lights;
    const bx = (1 - t) * (1 - t) * (dx0 + 6) + 2 * (1 - t) * t * x + t * t * (dx1 - 6);
    const by = (1 - t) * (1 - t) * (dy0 - 28) + 2 * (1 - t) * t * (dy0 + 2) + t * t * (dy0 - 28);
    fillCircles(lit ? '#ffe7a3' : '#d8d8c8', [[bx, by + 3, 3]]);
  }
}
