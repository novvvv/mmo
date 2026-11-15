'use strict';
// 가구 그림 (오락기 캐비닛 포함).

// ------------------------------------------------------------ 가구

function drawSeatFurniture({ x, y }, half) {
  groundShadow(x, y + 19, half, 6);

  const post = half - 4;  // 중심에서 기둥 바깥쪽까지의 거리
  ctx.fillStyle = '#6b4423';
  for (const px of [x - post, x + post - 6]) {
    ctx.fillRect(px, y + 8, 6, 12);   // 앞다리
    ctx.fillRect(px, y - 32, 6, 34);  // 등받이 기둥
  }
  if (half > CHAIR_HALF) ctx.fillRect(x - 3, y - 32, 6, 34);  // 벤치 가운데 기둥

  box(x - half + 2, y - 34, (half - 2) * 2, 9, '#9a6b3c', 3);  // 등받이
  box(x - post, y - 18, post * 2, 6, '#9a6b3c', 2);
  box(x - half, y, half * 2, 10, '#c08a4e', 3);                // 좌판
  if (CHRISTMAS && zone === 0) {  // 집 안의 벤치에는 눈이 없다
    snowAlong(x - half + 2, y - 35, x + half - 2, y - 35, 6);
    snowAlong(x - half, y - 1, x + half, y - 1, 5);
  }
}

function drawParasol(x, y) {
  box(x - 2, y - 122, 4, 102, '#e8e0d0');
  const baseY = y - 106, rx = 54, ry = 13, segments = 8;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI, a1 = ((i + 1) / segments) * Math.PI;
    polygon([
      [x, y - 146],
      [x + Math.cos(a0) * rx, baseY + Math.sin(a0) * ry],
      [x + Math.cos(a1) * rx, baseY + Math.sin(a1) * ry],
    ], i % 2 ? '#fdf8ee' : '#e0653f');
  }
  fillCircles('#b5482a', [[x, y - 147, 3]]);
  if (CHRISTMAS) {
    polygon([[x, y - 148], [x + 26, y - 124], [x - 26, y - 124]], SNOW);
    snowAlong(x - 26, y - 124, x + 26, y - 124, 7);
  }
}

// (x, y)는 양초의 윗면 가운데다.
function candleFlame(x, y, now) {
  box(x - 1, y - 3, 2, 3, '#3a2a1a');
  oval(x, y - 8, 4, 5.5, '#f7a93b');
  polygon([[x - 4, y - 9], [x + Math.sin(now / 130) * 1.3, y - 21], [x + 4, y - 9]], '#f7a93b');
  oval(x, y - 7, 2.2, 3.4, '#ffeeb0');
}

const POSTER = new Image();
POSTER.src = 'assets/poster_nimda.png';
const POSTER_SIZE = { w: 72, h: 103 };

// 실제 영상이 겹쳐 보일 TV 화면의 위치 (방 좌표)
function isCinemaScreen(kind) {
  return kind === 'cinema_screen' || kind === 'cinema_screen_big';
}

// 극장 무대: 붉은 막 사이의 스크린. half 는 무대의 반폭, inner 는 막이 시작하는 곳이다
function drawCinemaStage(kind, x, y, half, inner, now) {
  const r = tvScreenRect({ k: kind, x, y }), top = r.y - 4;
  box(x - half, y - 40, half * 2, 40, '#3a1216');
  box(x - half, y - 44, half * 2, 5, '#d9b46a');
  for (const side of [-1, 1]) {   // 양옆의 붉은 막
    polygon([[x + side * half, top], [x + side * inner, top], [x + side * (inner + 14), y - 44], [x + side * half, y - 44]], '#8e1e24');
    strokeLines('rgba(50, 8, 12, 0.5)', 2, () => {
      for (let dx = inner + 14; dx < half; dx += 22) {
        ctx.moveTo(x + side * dx, top);
        ctx.lineTo(x + side * (dx + 6), y - 44);
      }
    });
  }
  box(r.x - 8, r.y - 8, r.w + 16, r.h + 16, '#17181b', 4);
  if (tvState) {
    const hue = (now / 40) % 360;
    box(r.x, r.y, r.w, r.h, `hsl(${hue}, 45%, 30%)`);
  } else {
    box(r.x, r.y, r.w, r.h, '#e9e4d8');
    label('상영 준비 중', x, r.y + r.h / 2, `700 ${Math.round(r.w / 21.5)}px ${FONT}`, '#8a8378');
  }
}

function tvScreenRect(f) {
  if (f.k === 'cinema_screen_big') return { x: f.x - 490, y: f.y - 561, w: 980, h: 551 };   // 특별관: 가로세로 1.75배
  if (f.k === 'cinema_screen') return { x: f.x - 280, y: f.y - 325, w: 560, h: 315 };
  return f.k === 'tv_wall' ? { x: f.x - 40, y: f.y - 144, w: 80, h: 42 } : { x: f.x - 48, y: f.y - 92, w: 96, h: 54 };
}

// 아이템창의 리모컨 아이콘
function drawRemote(c) {
  c.fillStyle = '#2b2d33';
  c.beginPath();
  c.roundRect(27, 3, 18, 36, 5);
  c.fill();
  c.fillStyle = '#e5484d';
  c.beginPath();
  c.arc(36, 10, 3.2, 0, TAU);
  c.fill();
  c.fillStyle = '#cfd4dc';
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) c.fillRect(31.5 + col * 6, 18 + row * 6, 3.4, 3.4);
}

// 벽에 건 TV 화면. (x, top) 은 틀의 위쪽 가운데다.
function drawTvScreen(x, top, w, h, now) {
  box(x - w / 2, top, w, h, '#17181b', 3);
  const sx = x - w / 2 + 4, sy = top + 4, sw = w - 8, sh = h - 8;
  if (tvState) {
    const hue = (now / 40) % 360;
    const glow = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    glow.addColorStop(0, `hsl(${hue}, 70%, 58%)`);
    glow.addColorStop(1, `hsl(${(hue + 70) % 360}, 70%, 44%)`);
    ctx.fillStyle = glow;
    ctx.fillRect(sx, sy, sw, sh);
    const cy = top + h / 2;
    fillCircles('rgba(255, 255, 255, 0.85)', [[x, cy, 11]]);
    if (tvState.paused) {
      box(x - 5, cy - 6, 3.5, 12, '#2c2c34');
      box(x + 1.5, cy - 6, 3.5, 12, '#2c2c34');
    } else {
      polygon([[x - 4, cy - 7], [x + 7, cy], [x - 4, cy + 7]], '#2c2c34');
    }
  } else {
    box(sx, sy, sw, sh, '#2a3040');
    polygon([[sx + 8, sy + sh], [sx + 30, sy], [sx + 48, sy], [sx + 26, sy + sh]], 'rgba(255, 255, 255, 0.08)');
  }
}

// 키는 서버의 가구 종류 이름이다.
const FURNITURE = {
  chair: (f) => drawSeatFurniture(f, CHAIR_HALF),
  bench: (f) => drawSeatFurniture(f, BENCH_HALF),

  stool({ x, y }) {
    groundShadow(x, y + 11, 13, 4);
    box(x - 3, y + 2, 6, 9, '#7a5229');
    oval(x, y + 3, 14, 6, '#b5793f');
    oval(x, y + 1.5, 13, 5, '#e0a667');
  },

  cafe_table({ x, y }) {
    groundShadow(x, y + 9, 28, 8);
    oval(x, y + 8, 13, 4, '#5b3a1e');
    box(x - 3, y - 18, 6, 26, '#5b3a1e');
    oval(x, y - 18, 31, 15, '#a97a48');
    oval(x, y - 21, 31, 15, '#f4e8d2');
    for (const [dx, dy] of [[-15, -3], [15, -3], [-9, 6], [10, 6]]) {  // 커피잔
      oval(x + dx, y - 21 + dy, 5, 2.6, '#ffffff');
      oval(x + dx, y - 21.5 + dy, 3.5, 1.7, '#6f4a2a');
    }
    drawParasol(x, y);
  },

  menu_board({ x, y }) {
    groundShadow(x, y + 2, 18, 5);
    polygon([[x - 16, y], [x - 12, y - 42], [x + 12, y - 42], [x + 16, y]], '#7a4e2a');
    polygon([[x - 12, y - 5], [x - 9, y - 38], [x + 9, y - 38], [x + 12, y - 5]], '#2e3a33');
    label('MENU', x, y - 31, `700 8px ${FONT}`, '#f4e8d2');
    strokeLines('#d8e0d8', 1, () => {
      for (const dy of [-23, -17, -11]) {
        ctx.moveTo(x - 7, y + dy);
        ctx.lineTo(x + 7, y + dy);
      }
    });
  },

  planter({ x, y }) {
    groundShadow(x, y + 2, 22, 5);
    box(x - 20, y - 20, 40, 20, '#7a4e2a', 2);
    box(x - 20, y - 20, 40, 4, '#5b3a1e', 1);
    fillCircles('#3f8a4f', [[x - 12, y - 26, 9], [x + 12, y - 26, 9], [x, y - 31, 11]]);
    fillCircles('#f06b8b', [[x - 12, y - 30, 3.5], [x + 8, y - 34, 3.5]]);
    fillCircles('#f2d04b', [[x + 2, y - 26, 3.5], [x + 15, y - 28, 3]]);
    if (CHRISTMAS) snowAlong(x - 20, y - 20, x + 20, y - 20, 6);
  },

  // ---- 몰쟈의 집






  // ---- 몰쟈의 집: 통창과 콘크리트, 검은 프레임
  fireplace({ x, y, noFx }, now) {
    box(x - 78, y - 158, 156, 158, '#8d9095');
    strokeLines('rgba(50, 52, 56, 0.28)', 1, () => {
      for (const by of [y - 118, y - 78, y - 38]) {
        ctx.moveTo(x - 78, by);
        ctx.lineTo(x + 78, by);
      }
      ctx.moveTo(x, y - 158);
      ctx.lineTo(x, y - 94);
    });
    box(x - 88, y - 94, 176, 11, '#232427', 2);
    box(x - 48, y - 74, 96, 74, '#17171a', 4);
    box(x - 36, y - 10, 72, 8, '#3a3b40', 2);
    box(x - 62, y - 112, 14, 18, '#e8e0d0', 2);  // 촛불
    box(x + 50, y - 112, 12, 18, '#232427', 3);
    if (!noFx) FURNITURE_FX.fireplace({ x, y }, now);
  },

  big_window({ x, y }, now, night) {
    const w = 226, h = 112, left = x - w / 2, top = y - h / 2;
    box(left - 5, top - 5, w + 10, h + 10, '#1e1f22', 2);
    box(left, top, w, h, night > 0.5 ? '#14302a' : '#c9ead0');
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    const dark = night > 0.5;
    for (let i = 0; i < 26; i++) {  // 창밖의 숲
      const v = hash(i, Math.round(x));
      const px = left + (v % w), py = top + 34 + ((v >>> 8) % (h - 20)), r = 13 + ((v >>> 16) % 16);
      fillCircles(dark ? ['#1d4a3b', '#245745', '#173d31'][i % 3] : ['#4f9a56', '#6db567', '#3a8350'][i % 3], [[px, py, r]]);
    }
    for (let i = 0; i < 12; i++) {
      const v = hash(i + 40, Math.round(x));
      fillCircles(dark ? '#2f6a54' : '#9ed48c', [[left + (v % w), top + 24 + ((v >>> 8) % (h - 30)), 4 + ((v >>> 16) % 5)]]);
    }
    ctx.restore();
    strokeLines('#1e1f22', 4, () => {
      for (let dx = w / 4; dx < w; dx += w / 4) {
        ctx.moveTo(left + dx, top);
        ctx.lineTo(left + dx, top + h);
      }
      ctx.moveTo(left, top + 30);
      ctx.lineTo(left + w, top + 30);
    });
  },


  rug_plain({ x, y }) {
    box(x - 125, y - 62, 250, 124, '#d9d0bd', 4);
    box(x - 120, y - 57, 240, 114, '#e9e2d3', 3);
  },

  glass_table({ x, y }) {
    groundShadow(x, y + 2, 30, 7);
    box(x - 22, y - 18, 3, 20, '#232427');
    box(x + 19, y - 18, 3, 20, '#232427');
    oval(x, y - 20, 32, 13, 'rgba(190, 220, 228, 0.65)');
    ctx.strokeStyle = '#232427';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - 20, 32, 13, 0, 0, TAU);
    ctx.stroke();
    box(x - 8, y - 32, 16, 10, '#3a3b40', 2);   // 분재
    strokeLines('#5b4632', 2.5, () => {
      ctx.moveTo(x, y - 32);
      ctx.quadraticCurveTo(x + 6, y - 42, x - 3, y - 50);
    });
    fillCircles('#4f8a56', [[x - 7, y - 52, 8], [x + 5, y - 56, 9], [x + 11, y - 47, 6]]);
  },


  // TV 를 바라보는 소파: 카메라 쪽으로 등받이가 보인다. 앉은 사람의 뒤쪽 아래를 가린다.
  sofa_cream({ x, y }) {
    groundShadow(x, y + 5, 76, 7);
    box(x - 76, y - 26, 18, 30, '#d6caae', 8);
    box(x + 58, y - 26, 18, 30, '#d6caae', 8);
    box(x - 66, y - 24, 132, 30, '#e6dcc3', 8);
    box(x - 66, y - 24, 132, 7, '#efe6cf', 6);
    box(x - 20, y - 26, 44, 20, '#3a3b40', 4);    // 등받이에 걸친 담요
    strokeLines('rgba(120, 105, 75, 0.35)', 1.5, () => {
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x, y + 4);
    });
  },

  armchair({ x, y }) {
    groundShadow(x, y + 16, 30, 7);
    box(x - 26, y - 34, 52, 44, '#26272b', 10);
    box(x - 32, y - 12, 14, 28, '#1b1c1f', 6);
    box(x + 18, y - 12, 14, 28, '#1b1c1f', 6);
    box(x - 20, y - 4, 40, 18, '#35363b', 5);
    box(x - 24, y + 12, 5, 6, '#111113');
    box(x + 19, y + 12, 5, 6, '#111113');
  },

  black_stool({ x, y }) {
    groundShadow(x, y + 11, 13, 4);
    box(x - 10, y + 2, 3, 9, '#17171a');
    box(x + 7, y + 2, 3, 9, '#17171a');
    box(x - 14, y - 4, 28, 9, '#26272b', 4);
  },

  kitchen_bar({ x, y }) {
    groundShadow(x, y + 3, 76, 7);
    box(x - 70, y - 44, 140, 44, '#26272b', 2);
    strokeLines('#3f4046', 1.5, () => {
      for (const dx of [-35, 0, 35]) {
        ctx.moveTo(x + dx, y - 40);
        ctx.lineTo(x + dx, y);
      }
    });
    box(x - 75, y - 52, 150, 9, '#e9e6df', 2);
    strokeLines('rgba(130, 128, 122, 0.55)', 1, () => {
      ctx.moveTo(x - 62, y - 50);
      ctx.lineTo(x - 30, y - 46);
      ctx.moveTo(x + 14, y - 51);
      ctx.lineTo(x + 54, y - 45);
    });
    box(x - 34, y - 53, 34, 4, '#9aa0a6', 1);   // 개수대와 수도
    strokeLines('#6f7379', 2.5, () => {
      ctx.moveTo(x - 17, y - 53);
      ctx.quadraticCurveTo(x - 17, y - 70, x - 6, y - 66);
    });
    box(x + 18, y - 66, 16, 14, '#efe9dc', 3);
    box(x + 40, y - 62, 12, 10, '#3a3b40', 3);
  },

  dining_table({ x, y, noFx }, now) {
    groundShadow(x, y + 2, 66, 8);
    box(x - 56, y - 16, 7, 18, '#17171a');
    box(x + 49, y - 16, 7, 18, '#17171a');
    box(x - 62, y - 36, 124, 22, '#7d8084', 2);
    box(x - 62, y - 40, 124, 8, '#a2a5a9', 2);
    box(x - 44, y - 44, 30, 4, '#efe9dc', 1);
    box(x + 14, y - 44, 30, 4, '#efe9dc', 1);
    box(x - 4, y - 50, 8, 12, '#e8e0d0', 2);  // 촛불
    if (!noFx) FURNITURE_FX.dining_table({ x, y }, now);
  },

  // ---- 매달린 조명: 기준점(x, y)은 빛이 떨어지는 바닥이고, 갓은 그 위 천장에 매달려 있다
  pendant_frame({ x, y }) {   // 나무 틀 조명
    strokeLines('#232427', 1.2, () => {
      ctx.moveTo(x, y - 138);
      ctx.lineTo(x, y - 112);
    });
    strokeLines('#a97a48', 2.5, () => {
      ctx.strokeRect(x - 18, y - 112, 36, 12);
      ctx.strokeRect(x - 12, y - 100, 24, 10);
    });
  },

  pendant_cone({ x, y }) {   // 검은 원뿔 조명
    strokeLines('#26262a', 1.2, () => {
      ctx.moveTo(x, y - 136);
      ctx.lineTo(x, y - 104);
    });
    polygon([[x - 5, y - 104], [x + 5, y - 104], [x + 11, y - 86], [x - 11, y - 86]], '#26262a');
    fillCircles('#ffe2ae', [[x, y - 85, 4]]);
  },

  bed({ x, y }) {
    groundShadow(x, y + 4, 66, 9);
    box(x - 62, y - 118, 124, 24, '#232427', 3);
    strokeLines('#3f4046', 2, () => {
      for (let dx = -50; dx <= 50; dx += 20) {
        ctx.moveTo(x + dx, y - 116);
        ctx.lineTo(x + dx, y - 96);
      }
    });
    box(x - 58, y - 100, 116, 100, '#efe9dc', 5);
    box(x - 50, y - 96, 46, 24, '#ffffff', 7);
    box(x + 4, y - 96, 46, 24, '#c9c4b8', 7);
    box(x - 60, y - 66, 120, 66, '#4a4c52', 5);
    box(x - 60, y - 66, 120, 11, '#efe9dc', 3);
  },

  glass_partition({ x, y }) {
    const span = 190, rise = 96, top = y - span;
    box(x - 4, top - rise, 8, span + rise, 'rgba(190, 218, 228, 0.3)');
    strokeLines('#1e1f22', 2.5, () => {
      ctx.moveTo(x - 4, top - rise);
      ctx.lineTo(x - 4, y);
      ctx.moveTo(x + 4, top - rise);
      ctx.lineTo(x + 4, y);
      for (let py = top - rise; py <= y; py += 48) {
        ctx.moveTo(x - 4, py);
        ctx.lineTo(x + 4, py);
      }
    });
  },

  floor_lamp({ x, y }) {
    const lit = !roomLight || roomLight.lamp;
    groundShadow(x, y + 2, 13, 4);
    oval(x, y, 11, 4, '#232427');
    strokeLines('#232427', 3, () => {
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 6, y - 110, x + 14, y - 136, x + 36, y - 112);
    });
    polygon([[x + 24, y - 112], [x + 48, y - 112], [x + 56, y - 92], [x + 16, y - 92]], lit ? '#ffe7a3' : '#55585e');
    box(x + 16, y - 94, 40, 3, '#232427', 1);
  },

  monstera({ x, y }) {
    groundShadow(x, y + 2, 22, 5);
    polygon([[x - 15, y - 26], [x + 15, y - 26], [x + 11, y], [x - 11, y]], '#3a3b40');
    box(x - 17, y - 30, 34, 6, '#26272b', 2);
    for (const [dx, dy, r, a] of [[-20, -56, 19, -0.9], [20, -58, 19, 0.9], [0, -82, 22, 0], [-30, -30, 14, -1.4], [30, -32, 14, 1.4]]) {
      ctx.fillStyle = '#2f7a4a';
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, r * 0.72, r, a, 0, TAU);
      ctx.fill();
      strokeLines('#9ed48c', 1.3, () => {
        ctx.moveTo(x + dx - Math.sin(a) * r * 0.8, y + dy + Math.cos(a) * r * 0.8);
        ctx.lineTo(x + dx + Math.sin(a) * r * 0.8, y + dy - Math.cos(a) * r * 0.8);
      });
    }
  },

  // ---- 캬캬의 집: 흰 벽돌과 나무, 식물 없는 집
  sheer_window({ x, y }, now, night) {
    box(x - 44, y - 46, 88, 92, '#26262a', 2);
    box(x - 40, y - 42, 80, 84, night > 0.5 ? '#1f2a52' : '#d4e7f2');
    if (night > 0.5) fillCircles('#f5e5a0', [[x + 12, y - 16, 7]]);
    strokeLines('#26262a', 3, () => {
      ctx.moveTo(x, y - 42);
      ctx.lineTo(x, y + 42);
    });
    box(x - 58, y - 52, 116, 5, '#6b5543', 2);
    for (const side of [-1, 1]) {
      polygon([[x + side * 56, y - 48], [x + side * 18, y - 48], [x + side * 28, y + 58], [x + side * 56, y + 58]], 'rgba(250, 247, 240, 0.82)');
      strokeLines('rgba(170, 160, 145, 0.45)', 1.2, () => {
        for (const offset of [28, 38, 48]) {
          ctx.moveTo(x + side * offset, y - 46);
          ctx.lineTo(x + side * (offset + 3), y + 58);
        }
      });
    }
  },

  lantern_lamp({ x, y }) {
    const lit = !roomLight || roomLight.lamp;
    groundShadow(x, y + 2, 14, 4);
    box(x - 9, y - 6, 18, 6, '#6b5543', 2);
    box(x - 2, y - 18, 4, 14, '#6b5543');
    box(x - 12, y - 128, 24, 112, lit ? '#ffe2ae' : '#cfc6b4', 8);
    if (lit) box(x - 6, y - 118, 12, 92, '#fff4d8', 6);
    strokeLines('rgba(150, 120, 80, 0.3)', 1, () => {
      for (let py = y - 112; py < y - 22; py += 18) {
        ctx.moveTo(x - 12, py);
        ctx.lineTo(x + 12, py);
      }
    });
  },

  rug_diamond({ x, y }) {
    const w = 260, h = 124, left = x - w / 2, top = y - h / 2;
    box(left, top, w, h, '#efeae0', 3);
    box(left + 8, top + 8, w - 16, h - 16, '#d8d2c6', 2);
    strokeLines('#f7f3ea', 3, () => {
      for (let dx = 22; dx + 54 <= w - 8; dx += 54) {
        ctx.moveTo(left + dx, y);
        ctx.lineTo(left + dx + 27, top + 12);
        ctx.lineTo(left + dx + 54, y);
        ctx.lineTo(left + dx + 27, top + h - 12);
        ctx.closePath();
      }
    });
  },

  coffee_round({ x, y }) {
    groundShadow(x, y + 2, 32, 8);
    box(x - 20, y - 18, 40, 20, '#4a3a2c', 6);
    oval(x, y - 19, 31, 13, '#6b5038');
    oval(x, y - 21, 26, 10, '#8a6a4c');
    oval(x - 6, y - 23, 10, 5, '#efeae0');
    box(x + 6, y - 31, 10, 9, '#e8e0d0', 2);
  },


  sofa_l({ x, y }) {
    groundShadow(x, y + 5, 106, 7);
    box(x - 108, y - 26, 18, 30, '#e4dfd4', 8);
    box(x + 90, y - 26, 18, 30, '#e4dfd4', 8);
    box(x - 96, y - 24, 192, 30, '#f4f1ea', 8);
    box(x - 96, y - 24, 192, 7, '#fbf9f4', 6);
    box(x + 18, y - 26, 28, 26, '#8fa582', 3);    // 걸쳐 둔 담요
    strokeLines('rgba(150, 142, 128, 0.35)', 1.5, () => {
      for (const dx of [-32, 32]) {
        ctx.moveTo(x + dx, y - 14);
        ctx.lineTo(x + dx, y + 4);
      }
    });
  },

  round_dining({ x, y }) {
    groundShadow(x, y + 3, 44, 9);
    box(x - 5, y - 24, 10, 26, '#3a2c20');
    oval(x, y + 1, 18, 5, '#3a2c20');
    oval(x, y - 26, 44, 17, '#4a3a2c');
    oval(x, y - 29, 44, 17, '#7a5f47');
    oval(x, y - 30, 20, 8, '#b9c6d2');
    oval(x - 22, y - 32, 7, 3.5, '#efeae0');
    oval(x + 24, y - 27, 7, 3.5, '#efeae0');
  },

  dining_chair({ x, y }) {
    groundShadow(x, y + 11, 14, 4);
    box(x - 12, y - 28, 24, 6, '#7a5f47', 2);
    box(x - 11, y - 28, 3, 30, '#5f4835');
    box(x + 8, y - 28, 3, 30, '#5f4835');
    box(x - 13, y - 3, 26, 7, '#8a6a4c', 2);
    box(x - 11, y + 4, 3, 8, '#5f4835');
    box(x + 8, y + 4, 3, 8, '#5f4835');
  },

  book_pile({ x, y }) {
    groundShadow(x, y + 2, 22, 5);
    box(x - 20, y - 8, 40, 8, '#b9c6d2', 1);
    box(x - 17, y - 15, 34, 7, '#efeae0', 1);
    box(x - 19, y - 21, 36, 6, '#8a6a4c', 1);
    box(x - 8, y - 31, 14, 10, '#f4f1ea', 3);
  },

  linen_bed({ x, y }) {
    groundShadow(x, y + 4, 76, 9);
    box(x - 70, y - 132, 140, 26, '#6b5543', 4);
    box(x - 66, y - 110, 132, 110, '#f4f1ea', 6);
    box(x - 56, y - 104, 52, 26, '#ffffff', 8);
    box(x + 4, y - 104, 52, 26, '#ffffff', 8);
    box(x - 68, y - 72, 136, 72, '#c9bfae', 6);
    box(x - 68, y - 72, 136, 13, '#f4f1ea', 4);
    strokeLines('rgba(110, 96, 78, 0.3)', 1.5, () => {
      for (let by = y - 44; by < y; by += 15) {
        ctx.moveTo(x - 66, by);
        ctx.lineTo(x + 66, by);
      }
    });
  },

  nimda_poster({ x, y }) {
    const { w, h } = POSTER_SIZE;
    box(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, '#3a2c20', 2);
    if (POSTER.complete && POSTER.naturalWidth) ctx.drawImage(POSTER, x - w / 2, y - h / 2, w, h);
    else box(x - w / 2, y - h / 2, w, h, '#a9e0ea');
  },

  round_mirror({ x, y }) {
    fillCircles('#c9a56a', [[x, y, 42]]);
    fillCircles('#dcecf2', [[x, y, 37]]);
    polygon([[x - 18, y + 26], [x + 10, y - 32], [x + 24, y - 26], [x - 4, y + 32]], 'rgba(255, 255, 255, 0.55)');
  },

  vanity({ x, y }) {
    groundShadow(x, y + 2, 60, 7);
    box(x - 56, y - 42, 112, 42, '#f4f1ea', 3);
    box(x - 58, y - 46, 116, 6, '#c9a56a', 2);
    strokeLines('#d5cfc2', 1.5, () => {
      ctx.moveTo(x, y - 40);
      ctx.lineTo(x, y);
    });
    fillCircles('#c9a56a', [[x - 12, y - 20, 2], [x + 12, y - 20, 2]]);
    box(x - 40, y - 58, 10, 13, '#b9c6d2', 2);
    box(x - 24, y - 54, 8, 9, '#c9b89a', 2);
    box(x + 26, y - 53, 20, 8, '#efeae0', 3);
  },

  rug_shag({ x, y }) {
    const tufts = [];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU;
      tufts.push([x + Math.cos(a) * 118, y + Math.sin(a) * 60, 9]);
    }
    fillCircles('#e8e2d6', tufts);
    oval(x, y, 120, 62, '#f7f4ec');
    oval(x, y, 92, 46, '#fdfbf6');
  },

  // ---- 캐릭터 모양 터프팅 러그: 한 번 그려 둔 그림을 붙인다 (털 질감이 있어 매번 그리면 느리다)
  rug_cat_black: ({ x, y }) => blitRug('rug_cat_black', x, y),
  rug_cat_stand: ({ x, y }) => blitRug('rug_cat_stand', x, y),
  rug_bunny: ({ x, y }) => blitRug('rug_bunny', x, y),
  rug_long_cat: ({ x, y }) => blitRug('rug_long_cat', x, y),
  rug_puppy: ({ x, y }) => blitRug('rug_puppy', x, y),
  rug_8ball: ({ x, y }) => blitRug('rug_8ball', x, y),
  rug_cloud: ({ x, y }) => blitRug('rug_cloud', x, y),
  rug_heart: ({ x, y }) => blitRug('rug_heart', x, y),

  pouf({ x, y }) {
    groundShadow(x, y + 11, 18, 5);
    oval(x, y + 3, 19, 11, '#a98f6e');
    oval(x, y - 1, 18, 10, '#c9b18c');
  },

  accent_chair({ x, y }) {
    groundShadow(x, y + 16, 26, 6);
    box(x - 22, y - 32, 44, 42, '#efeae0', 14);
    box(x - 16, y - 4, 32, 18, '#fbf9f4', 6);
    box(x - 20, y + 12, 4, 7, '#6b5543');
    box(x + 16, y + 12, 4, 7, '#6b5543');
  },

  kitchen_counter({ x, y }) {
    groundShadow(x, y + 3, 134, 6);
    box(x - 130, y - 40, 260, 40, '#f4f1ea', 2);
    strokeLines('#d5cfc2', 1.5, () => {
      for (let dx = -130 + 52; dx < 130; dx += 52) {
        ctx.moveTo(x + dx, y - 38);
        ctx.lineTo(x + dx, y);
      }
    });
    box(x - 134, y - 46, 268, 8, '#d9d4c8', 2);
    box(x + 30, y - 40, 52, 40, '#26262a', 1);   // 오븐
    box(x + 36, y - 30, 40, 22, '#3f4046', 1);
    box(x + 30, y - 50, 52, 5, '#26262a', 1);
    box(x + 26, y - 108, 60, 44, '#a9a297', [14, 14, 0, 0]);  // 후드
    box(x - 120, y - 112, 120, 5, '#6b5543', 1);              // 선반과 그릇
    for (const dx of [-108, -82, -56, -30]) box(x + dx, y - 124, 16, 12, ['#efeae0', '#b9c6d2', '#c9b89a', '#efeae0'][(dx + 108) / 26], 3);
    box(x - 96, y - 58, 16, 12, '#c9a56a', 2);
    box(x - 40, y - 62, 10, 16, '#8a6a4c', 2);
  },

  kitchen_island({ x, y }) {
    groundShadow(x, y + 3, 68, 7);
    box(x - 62, y - 42, 124, 42, '#8a6a4c', 2);
    strokeLines('#6b5038', 1.5, () => {
      for (let dx = -48; dx <= 48; dx += 24) {
        ctx.moveTo(x + dx, y - 40);
        ctx.lineTo(x + dx, y);
      }
    });
    box(x - 68, y - 50, 136, 10, '#f4f1ea', 2);
    box(x - 20, y - 58, 40, 8, '#c9a56a', 3);
    for (const side of [-1, 1]) {                 // 전구 조명
      strokeLines('#26262a', 1.2, () => {
        ctx.moveTo(x + side * 34, y - 128);
        ctx.lineTo(x + side * 34, y - 104);
      });
      fillCircles('#ffe2ae', [[x + side * 34, y - 96, 9]]);
    }
  },

  bar_stool({ x, y }) {
    groundShadow(x, y + 13, 12, 4);
    box(x - 2, y - 2, 4, 15, '#6f6a62');
    oval(x, y + 12, 9, 3, '#6f6a62');
    oval(x, y - 3, 13, 6, '#9aa6b2');
  },

  long_table({ x, y }) {
    groundShadow(x, y + 3, 98, 8);
    box(x - 86, y - 18, 7, 20, '#6f6a62');
    box(x + 79, y - 18, 7, 20, '#6f6a62');
    box(x - 96, y - 28, 192, 12, '#e4dfd4', 2);
    box(x - 96, y - 32, 192, 7, '#f7f4ec', 2);
    for (const dx of [-62, 0, 62]) oval(x + dx, y - 34, 10, 4, '#efeae0');   // 접시 (조명은 pendant_cone 으로 따로)
  },

  white_chair({ x, y }) {
    groundShadow(x, y + 11, 15, 4);
    box(x - 14, y - 22, 28, 24, '#f7f4ec', 10);
    box(x - 12, y - 2, 24, 9, '#fdfbf6', 4);
    box(x - 11, y + 6, 3, 6, '#8a8378');
    box(x + 8, y + 6, 3, 6, '#8a8378');
  },




  tall_plant({ x, y }) {
    groundShadow(x, y + 2, 18, 5);
    polygon([[x - 14, y - 24], [x + 14, y - 24], [x + 10, y], [x - 10, y]], '#4a3a2c');
    box(x - 16, y - 28, 32, 6, '#5a4634', 2);
    strokeLines('#5b4632', 3, () => {
      ctx.moveTo(x, y - 28);
      ctx.bezierCurveTo(x - 10, y - 70, x + 12, y - 110, x + 2, y - 158);
    });
    const spray = (cx, cy, size) => {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        ctx.fillStyle = i % 2 ? '#3f6b48' : '#54855a';
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * size, cy + Math.sin(a) * size * 0.65, size * 0.75, size * 0.3, a, 0, TAU);
        ctx.fill();
      }
    };
    spray(x - 18, y - 74, 13);
    spray(x + 20, y - 104, 14);
    spray(x - 12, y - 132, 13);
    spray(x + 6, y - 164, 15);
  },





  wall_frames({ x, y }) {
    for (const [dx, dy, w, h, color] of [[-34, 0, 34, 44, '#7f9474'], [6, -8, 30, 30, '#d9b46a'], [8, 26, 26, 18, '#3f5a47']]) {
      box(x + dx - 2, y + dy - 2, w + 4, h + 4, '#5a412c', 1);
      box(x + dx + 2, y + dy + 2, w - 4, h - 4, '#f7f1e3');
      box(x + dx + 6, y + dy + 6, w - 12, h - 12, color);
    }
  },



  tv({ x, y, noFx }, now) {
    groundShadow(x, y + 2, 60, 6);
    box(x - 58, y - 22, 116, 22, '#6b5543', 2);
    box(x - 60, y - 25, 120, 5, '#8a6a4c', 2);
    strokeLines('#4a3a2c', 1.5, () => {
      for (const dx of [-29, 0, 29]) {
        ctx.moveTo(x + dx, y - 20);
        ctx.lineTo(x + dx, y - 2);
      }
    });
    if (!noFx) FURNITURE_FX.tv({ x, y }, now);
  },

  tv_wall({ x, y, noFx }, now) {
    if (!noFx) FURNITURE_FX.tv_wall({ x, y }, now);
  },

  // ---- 극장
  cinema_screen({ x, y }, now) {
    drawCinemaStage('cinema_screen', x, y, 420, 296, now);
  },

  cinema_screen_big({ x, y }, now) {
    drawCinemaStage('cinema_screen_big', x, y, 640, 506, now);
  },

  // 특별관의 3인용 소파. 자리는 x - 58, x, x + 58
  cinema_sofa({ x, y }) {
    box(x - 100, y - 26, 200, 30, '#5e161b', 12);          // 앉은 사람 얼굴이 보이도록 낮게, 팔걸이까지 한 덩어리
    box(x - 86, y - 23, 172, 23, '#a32229', 9);
    box(x - 86, y - 23, 172, 6, '#bf3038', 5);
    strokeLines('rgba(60, 10, 14, 0.55)', 2, () => {        // 세 자리를 나누는 솔기
      for (const dx of [-29, 29]) {
        ctx.moveTo(x + dx, y - 21);
        ctx.lineTo(x + dx, y - 3);
      }
    });
    box(x - 104, y - 22, 16, 26, '#7d1c22', 7);
    box(x + 88, y - 22, 16, 26, '#7d1c22', 7);
  },

  // 극장 뒷벽에 난 특별관 문
  cinema_door({ x, y }) {
    box(x - 30, y - 96, 60, 96, '#d9b46a', 3);
    box(x - 26, y - 92, 52, 92, '#2a0f12', 2);
    box(x - 21, y - 86, 42, 38, '#4a171c', 2);
    box(x - 21, y - 42, 42, 38, '#4a171c', 2);
    fillCircles('#d9b46a', [[x + 17, y - 45, 3]]);
    box(x - 34, y - 120, 68, 20, '#26181a', 4);
    label('특별관', x, y - 109.5, `800 13px ${FONT}`, '#ffd76a');
  },

  cinema_row({ x, y }) {
    const seat = (sx) => {
      box(sx - 25, y - 30, 50, 32, '#5e161b', 10);
      box(sx - 22, y - 28, 44, 26, '#a32229', 9);
      box(sx - 22, y - 28, 44, 6, '#bf3038', 5);
    };
    for (const side of [-1, 1]) {
      for (let col = 0; col < 6; col++) seat(x + side * (90 + 58 * col));
    }
  },

  snack_bar({ x, y }) {
    groundShadow(x, y + 3, 116, 8);
    box(x - 110, y - 46, 220, 46, '#6e1a20', 3);
    box(x - 116, y - 54, 232, 10, '#d9b46a', 2);
    box(x - 90, y - 118, 180, 30, '#26181a', 4);
    label('매점', x, y - 102.5, `800 17px ${FONT}`, '#ffd76a');
    box(x - 3, y - 90, 6, 38, '#3a1216');
    box(x - 96, y - 88, 40, 34, 'rgba(255, 244, 208, 0.9)', 3);   // 팝콘 기계
    fillCircles('#fff4d0', [[x - 84, y - 62, 6], [x - 74, y - 66, 7], [x - 66, y - 60, 6]]);
    drawShopItem(ctx, x + 40, y - 64, 0.9, 1);
    drawShopItem(ctx, x + 66, y - 66, 0.9, 2);
    drawShopItem(ctx, x + 90, y - 66, 0.9, 3);
  },

  // ---- 재즈바
  bottle_shelf({ x, y }) {
    const w = 220, h = 116, left = x - w / 2, top = y - h / 2;
    const colors = ['#2f6b3e', '#a8622a', '#d8c27a', '#7a2a35', '#3a5a8a', '#c9d6c5', '#8a4a1e', '#dcb34a'];
    box(left, top, w, h, '#22110b', 2);
    box(left, top, 5, h, '#5a2c1a');
    box(left + w - 5, top, 5, h, '#5a2c1a');
    for (let row = 0; row < 3; row++) {
      const shelf = top + 36 + row * 37;
      box(left + 4, shelf, w - 8, 4, '#c19a55');
      for (let col = 0; col < 10; col++) {
        const bx = left + 18 + col * 20.4, tall = 21 + ((col * 7 + row * 3) % 3) * 4, color = colors[(col * 3 + row * 5) % colors.length];
        box(bx - 5, shelf - tall + 10, 10, tall - 10, color, 2);
        box(bx - 2, shelf - tall, 4, 11, color);
        box(bx - 2, shelf - tall - 2, 4, 3, '#14090a');
        box(bx - 3.5, shelf - 11, 7, 6, 'rgba(255, 244, 214, 0.85)');
      }
    }
  },

  dart_board({ x, y }) {
    const R = 26;
    box(x - 38, y - 40, 76, 80, '#3e1f12', 3);
    box(x - 34, y - 36, 68, 72, '#22110b', 2);
    drawDartBoard(ctx, x, y, R, false);
    if (dartState?.st === 2) for (const [hx, hy] of dartState.hits) drawDart(ctx, x + hx * R, y + hy * R, 0.7, DART_COLORS[dartState.turn % DART_COLORS.length]);
  },

  // ---- 게임 가구
  dart_stand({ x, y }) {   // 세 다리 받침 위의 다트판
    groundShadow(x, y + 2, 26, 6);
    strokeLines('#4a2a18', 3, () => {
      ctx.moveTo(x, y - 44);
      ctx.lineTo(x - 15, y);
      ctx.moveTo(x, y - 44);
      ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 44);
      ctx.lineTo(x + 2, y + 3);
    });
    box(x - 27, y - 98, 54, 56, '#3e1f12', 4);
    box(x - 24, y - 95, 48, 50, '#22110b', 3);
    drawDartBoard(ctx, x, y - 70, 20, false);
    if (dartState?.st === 2) for (const [hx, hy] of dartState.hits) drawDart(ctx, x + hx * 20, y - 70 + hy * 20, 0.55, DART_COLORS[dartState.turn % DART_COLORS.length]);
  },

  arcade_shooter(f, now) { drawArcadeCabinet(f, now, 0); },
  arcade_bricks(f, now) { drawArcadeCabinet(f, now, 1); },
  arcade_mines(f, now) { drawArcadeCabinet(f, now, 2); },

  arcade_chess({ x, y }) {   // 다리가 짧은 나무 체스 탁자. 판 위에 흑(뒤)과 백(앞)의 말이 몇 개 서 있다
    groundShadow(x, y + 2, 44, 8);
    box(x - 33, y - 9, 7, 9, '#5a3a20', 1);
    box(x + 26, y - 9, 7, 9, '#5a3a20', 1);
    box(x - 36, y - 24, 72, 16, '#8a5a32', 2);
    box(x - 30, y - 18, 60, 2, 'rgba(255, 235, 200, 0.18)', 1);
    box(x - 36, y - 53, 72, 31, '#6e4424', 2);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) box(x - 32 + col * 8, y - 50 + row * 6.5, 8, 6.5, (row + col) % 2 ? '#b98a5e' : '#f2e2c4');
    }
    for (const [piece, col, row] of [['r', 0, 0], ['k', 4, 0], ['p', 2, 1], ['p', 5, 1], ['Q', 3, 3], ['N', 6, 3], ['P', 1, 2]]) {
      drawChessPiece(ctx, piece, x - 34 + col * 8, y - 59 + row * 6.5, 12);
    }
  },

  omok_table({ x, y }) {   // 다리가 짧은 나무 오목판과 흑백 돌 통
    groundShadow(x, y + 2, 44, 8);
    box(x - 33, y - 9, 7, 9, '#6e4a26', 1);
    box(x + 26, y - 9, 7, 9, '#6e4a26', 1);
    box(x - 36, y - 24, 72, 16, '#a86e34', 2);
    box(x - 36, y - 50, 72, 28, '#e3b86e', 2);
    strokeLines('rgba(70, 40, 14, 0.75)', 1, () => {
      for (let i = 0; i <= 8; i++) {
        ctx.moveTo(x - 31 + i * 7.75, y - 47);
        ctx.lineTo(x - 31 + i * 7.75, y - 25);
      }
      for (let j = 0; j <= 4; j++) {
        ctx.moveTo(x - 31, y - 47 + j * 5.5);
        ctx.lineTo(x + 31, y - 47 + j * 5.5);
      }
    });
    fillCircles('#1b1b1b', [[x - 7.5, y - 36, 2.6], [x + 8, y - 30.5, 2.6], [x + 15.5, y - 41.5, 2.6]]);
    fillCircles('#5a5a5a', [[x - 15.5, y - 30.5, 2.9], [x, y - 41.5, 2.9]]);
    fillCircles('#f6f2e8', [[x - 15.5, y - 30.5, 2.4], [x, y - 41.5, 2.4]]);
    for (const [bx, stone] of [[-48, '#1b1b1b'], [48, '#f6f2e8']]) {   // 돌 통
      oval(x + bx, y - 6, 10, 6, '#5a3a1e');
      oval(x + bx, y - 8, 8, 4, stone);
    }
  },

  dart_line({ x, y }) {
    box(x - 58, y - 2, 116, 5, '#c19a55', 1);
    label('던지는 선', x, y + 14, `700 10px ${FONT}`, 'rgba(255, 233, 184, 0.75)');
  },

  gold_frame({ x, y }) {
    box(x - 44, y - 34, 88, 68, '#c19a55', 2);
    box(x - 40, y - 30, 80, 60, '#8a6a32');
    if (x < 600) {        // 달과 도시의 밤
      box(x - 36, y - 26, 72, 52, '#1b2547');
      fillCircles('#ffe9b8', [[x + 18, y - 12, 8]]);
      for (const [dx, tall] of [[-34, 18], [-20, 30], [-8, 16], [6, 24], [20, 13]]) box(x + dx, y + 26 - tall, 13, tall, '#0d1226');
    } else {              // 색소폰
      box(x - 36, y - 26, 72, 52, '#5a1626');
      ctx.strokeStyle = '#e8c06a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 20);
      ctx.lineTo(x + 2, y + 8);
      ctx.quadraticCurveTo(x - 4, y + 22, x - 16, y + 12);
      ctx.stroke();
      ctx.lineCap = 'butt';
      fillCircles('#e8c06a', [[x - 19, y + 8, 7]]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 20);
      ctx.lineTo(x + 22, y - 22);
      ctx.stroke();
    }
  },

  bartender({ x, y: standY }, now) {
    const y = standY - 14;   // 바 상판 위로 몸이 보이도록 안쪽에 세운다
    drawCharacter(ctx, { x, y, color: '#f4efe6', arms: 1, legs: 1, limbColor: 1, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: now });
    polygon([[x - 7, y - 4], [x, y - 1], [x - 7, y + 2]], '#7a1420');
    polygon([[x + 7, y - 4], [x, y - 1], [x + 7, y + 2]], '#7a1420');
    label('바텐더', x, y - 42, `700 11px ${FONT}`, '#ffd76a');
  },

  bar_counter({ x, y }) {
    const left = x - 305, w = 610;
    box(left, y - 70, w, 30, '#6e3a1e');
    box(left, y - 70, w, 3, '#a8622a');
    box(left, y - 40, w, 40, '#3e1f12');
    box(left, y - 42, w, 5, '#c19a55');
    for (let px = left + 8; px < left + w - 40; px += 60) {
      box(px, y - 31, 50, 24, '#2c150c', 2);
      box(px + 3, y - 28, 44, 18, '#5a2432', 2);
    }
    box(left, y - 4, w, 4, '#1e0f0b');
    for (const dx of BAR_LAMPS) drawShadedLamp(x + dx, y - 50);
    drawShopItem(ctx, x - 250, y - 66, 0.75, 4);
    drawShopItem(ctx, x - 150, y - 66, 0.75, 5);
    drawShopItem(ctx, x + 150, y - 66, 0.75, 6);
    drawShopItem(ctx, x + 270, y - 64, 0.75, 7);
  },

  bar_counter_side({ x, y }) {
    box(x - 26, y - 200, 52, 158, '#6e3a1e');
    box(x - 26, y - 200, 3, 158, '#a8622a');
    box(x + 23, y - 200, 3, 158, '#a8622a');
    box(x - 26, y - 42, 52, 42, '#3e1f12');
    box(x - 26, y - 42, 52, 5, '#c19a55');
    box(x - 18, y - 31, 36, 24, '#5a2432', 2);
    box(x - 26, y - 4, 52, 4, '#1e0f0b');
  },

  plum_stool({ x, y }) {
    groundShadow(x, y + 17, 12, 4);
    box(x - 1.5, y + 3, 3, 13, '#c19a55');
    box(x - 9, y + 14, 18, 3, '#8a6a32', 1);
    oval(x, y + 1, 13, 7, '#54306f');
    oval(x, y - 1, 12, 5.5, '#8a56ad');
  },

  bar_table({ x, y }) {
    groundShadow(x, y + 3, 34, 6);
    box(x - 3, y - 30, 6, 30, '#22110b');
    box(x - 15, y - 3, 30, 4, '#22110b', 2);
    oval(x, y - 31, 37, 12, '#3e1f12');
    oval(x, y - 34, 35, 10, '#6e3a1e');
    drawShadedLamp(x, y - 34);
  },

  velvet_chair({ x, y }) {
    groundShadow(x, y + 14, 18, 5);
    box(x - 15, y - 26, 30, 30, '#3e2358', 7);
    box(x - 18, y - 2, 36, 14, '#6a3a8a', 4);
    box(x - 18, y - 2, 36, 4, '#8a56ad', 3);
    box(x - 15, y + 12, 4, 4, '#22110b');
    box(x + 11, y + 12, 4, 4, '#22110b');
  },

  record_player({ x, y, noFx }, now) {
    const playing = !!jazzTrack();
    groundShadow(x, y + 3, 48, 6);
    box(x - 44, y - 34, 88, 34, '#4a2818', 3);
    for (const dx of [-37, 7]) {
      box(x + dx, y - 28, 30, 22, '#22110b', 2);
      strokeLines('#6e3a1e', 1, () => {
        for (let ly = y - 24; ly < y - 8; ly += 4) {
          ctx.moveTo(x + dx + 3, ly);
          ctx.lineTo(x + dx + 27, ly);
        }
      });
    }
    box(x - 46, y - 54, 92, 22, '#6e3a1e', 3);
    box(x - 46, y - 54, 92, 3, '#a8622a', 2);
    oval(x - 10, y - 44, 26, 8.5, '#0e0e12');
    oval(x - 10, y - 44, 18, 5.8, '#26262e');
    oval(x - 10, y - 44, 8, 2.8, playing ? '#d9405a' : '#7a2a35');
    strokeLines('#d8c27a', 2, () => {
      ctx.moveTo(x + 28, y - 50);
      ctx.lineTo(x + 18, y - 42);
      ctx.lineTo(x + (playing ? 2 : 12), y - 42);
    });
    fillCircles('#c19a55', [[x + 28, y - 50, 4], [x + 36, y - 40, 3]]);
    if (!noFx) FURNITURE_FX.record_player({ x, y }, now);
  },

  // ---- 왕국
  // ---- 카지노
  pachinko({ x, y }, now) {   // 유리 안에 못이 박힌 세로 판, 가운데 숫자판, 아래 구슬 받이, 오른쪽 손잡이
    const seed = Math.round(x);
    groundShadow(x, y + 2, 36, 6);
    box(x - 34, y - 170, 68, 170, '#1a1228', 6);
    box(x - 31, y - 167, 62, 164, '#d6304a', 5);
    const t = Math.floor(now / 140);
    for (let i = 0; i < 10; i++) {   // 테두리 불빛
      const on = (i + t + seed) % 4 === 0;
      fillCircles(on ? '#fff3b0' : '#8a1c2c', [[x - 31 + 3, y - 160 + i * 12, 2.2], [x + 31 - 3, y - 160 + i * 12, 2.2]]);
    }
    box(x - 26, y - 160, 52, 98, '#bfe6ff', 4);   // 유리판
    box(x - 24, y - 158, 48, 94, '#f6f0ff', 3);
    ctx.fillStyle = '#9aa0ad';
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 6; col++) {
        const px = x - 20 + col * 8 + (row % 2) * 4, py = y - 152 + row * 10;
        if (Math.abs(px - x) < 11 && py > y - 128 && py < y - 100) continue;   // 숫자판 자리
        ctx.fillRect(px, py, 1.6, 1.6);
      }
    }
    box(x - 11, y - 128, 22, 16, '#14111c', 2);   // 숫자판
    const d = (k) => String(1 + ((Math.floor(now / 90) + seed * (k + 3)) % 9));
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`${d(0)}${d(1)}${d(2)}`, x, y - 119.5);
    oval(x, y - 104, 5, 3, '#e8b830');   // 시작 구멍
    box(x - 28, y - 60, 56, 26, '#e8b830', 4);   // 구슬 받이
    box(x - 24, y - 56, 48, 14, '#8a6a20', 3);
    fillCircles('#d8dde6', [[x - 14, y - 49, 3], [x - 7, y - 50, 3], [x, y - 49, 3], [x + 7, y - 50, 3]]);
    box(x + 22, y - 44, 12, 12, '#2a2a30', 6);   // 손잡이
    fillCircles('#c9ccd2', [[x + 28, y - 38, 4]]);
    box(x - 30, y - 30, 60, 26, '#2a1f3d', 3);
    label('PACHI', x - 4, y - 17, `800 9px ${FONT}`, '#ffd76a');
  },

  roulette({ x, y }, now) {   // 초록 천을 씌운 룰렛 테이블. 왼쪽 바퀴가 천천히 돈다
    groundShadow(x, y + 4, 100, 10);
    box(x - 98, y - 52, 196, 50, '#5a2c1a', 12);
    box(x - 92, y - 48, 184, 42, '#1f6b3d', 10);
    strokeLines('rgba(255, 255, 255, 0.55)', 1, () => {
      for (let i = 0; i <= 6; i++) {
        ctx.moveTo(x - 20 + i * 16, y - 42);
        ctx.lineTo(x - 20 + i * 16, y - 12);
      }
      ctx.moveTo(x - 20, y - 42); ctx.lineTo(x + 76, y - 42);
      ctx.moveTo(x - 20, y - 27); ctx.lineTo(x + 76, y - 27);
      ctx.moveTo(x - 20, y - 12); ctx.lineTo(x + 76, y - 12);
    });
    for (let i = 0; i < 12; i++) box(x - 18 + (i % 6) * 16, y - 40 + Math.floor(i / 6) * 15, 12, 11, i % 2 ? '#1b1b1b' : '#c8423a', 2);
    const cx = x - 58, cy = y - 28, spin = now / 900;
    fillCircles('#8a5a2a', [[cx, cy, 23]]);
    for (let i = 0; i < 16; i++) {
      const a0 = spin + (i / 16) * TAU, a1 = spin + ((i + 1) / 16) * TAU;
      ctx.fillStyle = i === 0 ? '#2f8f4e' : i % 2 ? '#1b1b1b' : '#c8423a';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 19, a0, a1);
      ctx.fill();
    }
    fillCircles('#e8b830', [[cx, cy, 6]]);
    fillCircles('#ffffff', [[cx + Math.cos(-spin * 1.7) * 15, cy + Math.sin(-spin * 1.7) * 15, 2.4]]);
    box(x - 98, y - 6, 196, 6, '#3a1c10', 3);
  },

  cashier({ x, y }) {   // 환전소: 유리창이 달린 금빛 카운터
    groundShadow(x, y + 3, 88, 8);
    box(x - 84, y - 96, 168, 62, '#2a1f3d', 4);
    box(x - 78, y - 90, 156, 50, '#bfe6ff', 3);
    for (const px of [x - 26, x + 26]) box(px - 1.5, y - 90, 3, 50, '#e8b830');
    box(x - 84, y - 100, 168, 8, '#e8b830', 3);
    label('환전소', x, y - 108, `800 14px ${FONT}`, '#ffd76a');
    box(x - 84, y - 36, 168, 36, '#5a2c1a', 3);
    box(x - 84, y - 38, 168, 5, '#e8b830', 2);
    for (let i = 0; i < 3; i++) box(x - 60 + i * 14, y - 50 - i * 4, 22, 8, '#f2d04b', 2);   // 금괴
    drawCoins(x + 50, y - 46);
  },

  casino_sign({ x, y }, now) {   // 뒷벽의 네온 간판
    const on = Math.floor(now / 700) % 2;
    box(x - 150, y - 34, 300, 64, '#120c1c', 8);
    box(x - 144, y - 28, 288, 52, '#2a0c3a', 6);
    label('★ 카지노 ★', x, y - 1, `800 30px ${FONT}`, on ? '#ffe28a' : '#ff8ad8');
    for (let i = 0; i < 18; i++) fillCircles((i + Math.floor(now / 200)) % 3 ? '#b98d3e' : '#fff3b0', [[x - 140 + i * 16.5, y - 31, 2.4], [x - 140 + i * 16.5, y + 27, 2.4]]);
  },

  bookshelf({ x, y }) {
    groundShadow(x, y + 3, 48, 6);
    box(x - 44, y - 112, 88, 112, '#6e4a2c', 3);
    box(x - 38, y - 106, 76, 100, '#3e2616', 2);
    const colors = ['#c23b4a', '#3a6a96', '#d9b46a', '#3f7a4d', '#7a4c9a', '#e0d2b4'];
    for (let row = 0; row < 3; row++) {
      const shelf = y - 74 + row * 33;
      box(x - 38, shelf, 76, 4, '#6e4a2c');
      for (let i = 0; i < 9; i++) box(x - 35 + i * 8, shelf - 24 + (i * 3 + row) % 4, 7, 24 - ((i * 3 + row) % 4), colors[(i + row * 2) % colors.length], 1);
    }
  },

  wardrobe({ x, y }) {
    groundShadow(x, y + 3, 48, 6);
    box(x - 44, y - 132, 88, 132, '#8a5a3a', 3);
    box(x - 48, y - 138, 96, 10, '#6e4a2c', 3);
    for (const side of [-1, 1]) {
      box(x + side * 21 - 18, y - 122, 36, 112, '#a06c46', 2);
      box(x + side * 21 - 12, y - 114, 24, 42, '#8a5a3a', 2);
      box(x + side * 21 - 12, y - 62, 24, 42, '#8a5a3a', 2);
      fillCircles('#d9b46a', [[x - side * 3, y - 70, 2.4]]);
    }
  },

  shade_lamp({ x, y }) {
    groundShadow(x, y + 2, 15, 4);
    box(x - 10, y - 5, 20, 5, '#54402c', 2);
    box(x - 2, y - 92, 4, 88, '#54402c');
    polygon([[x - 13, y - 122], [x + 13, y - 122], [x + 24, y - 88], [x - 24, y - 88]], '#f0d29a');
    polygon([[x - 9, y - 122], [x + 9, y - 122], [x + 11, y - 112], [x - 11, y - 112]], 'rgba(255, 248, 220, 0.75)');
  },

  wall_clock({ x, y, noFx }, now) {
    fillCircles('#6e4a2c', [[x, y, 26]]);
    fillCircles('#fbf4e0', [[x, y, 21]]);
    if (!noFx) FURNITURE_FX.wall_clock({ x, y }, now);
  },

  movie_poster({ x, y }) {
    groundShadow(x, y + 2, 26, 5);
    box(x - 26, y - 92, 52, 90, '#d9b46a', 2);
    box(x - 22, y - 88, 44, 82, '#2f3f6e');
    fillCircles('#ffe9b8', [[x, y - 58, 12]]);
    label('NOW', x, y - 26, `800 11px ${FONT}`, '#ffe9b8');
  },

  // ---- 슬라임 군락지
  plant({ x, y }) {
    groundShadow(x, y + 2, 20, 5);
    polygon([[x - 15, y - 26], [x + 15, y - 26], [x + 11, y], [x - 11, y]], '#b5683a');
    box(x - 17, y - 30, 34, 6, '#c97a48', 2);
    fillCircles('#2f7a48', [[x - 14, y - 44, 13], [x + 14, y - 44, 13], [x, y - 58, 15]]);
    fillCircles('#4f9c5c', [[x - 8, y - 50, 8], [x + 8, y - 56, 8], [x + 12, y - 42, 5]]);
  },

  plant_small({ x, y }) {
    groundShadow(x, y + 2, 14, 4);
    polygon([[x - 10, y - 16], [x + 10, y - 16], [x + 7, y], [x - 7, y]], '#b5683a');
    fillCircles('#3f8a4f', [[x - 7, y - 24, 8], [x + 7, y - 24, 8], [x, y - 32, 9]]);
  },


  // ---- 랏라의 집
  aquarium({ x, y, noFx }, now) {
    groundShadow(x, y + 3, 58, 8);
    box(x - 54, y - 18, 108, 20, '#5b3418', 2);
    box(x - 50, y - 84, 100, 66, '#5fb4d9', 3);
    box(x - 50, y - 84, 100, 8, '#a8def2');
    box(x - 50, y - 26, 100, 8, '#d9c48c');
    fillCircles('#3f8a4f', [[x - 34, y - 30, 7], [x + 36, y - 32, 8]]);
    if (!noFx) FURNITURE_FX.aquarium({ x, y }, now);
    strokeLines('#2e3238', 3, () => ctx.roundRect(x - 50, y - 84, 100, 66, 3));
  },

  hammock({ x, y }) {
    groundShadow(x, y + 16, 60, 6);
    box(x - 68, y - 50, 6, 66, '#6b4423');
    box(x + 62, y - 50, 6, 66, '#6b4423');
    ctx.fillStyle = '#6fbf8a';
    ctx.beginPath();
    ctx.moveTo(x - 62, y - 42);
    ctx.quadraticCurveTo(x, y + 44, x + 62, y - 42);
    ctx.quadraticCurveTo(x, y + 8, x - 62, y - 42);
    ctx.fill();
    strokeLines('#4f9c5c', 2, () => {
      ctx.moveTo(x - 62, y - 42);
      ctx.quadraticCurveTo(x, y + 26, x + 62, y - 42);
    });
  },

  stump({ x, y }) {
    groundShadow(x, y + 2, 26, 7);
    box(x - 22, y - 20, 44, 22, '#6b4423', 4);
    oval(x, y - 20, 22, 9, '#c79a64');
    strokeLines('#a97a48', 1.5, () => {
      ctx.ellipse(x, y - 20, 14, 5.5, 0, 0, TAU);
      ctx.moveTo(x + 7, y - 20);
      ctx.ellipse(x, y - 20, 7, 2.6, 0, 0, TAU);
    });
    box(x - 4, y - 30, 8, 8, '#f4efe2', 2);
  },

  potting_bench({ x, y }) {
    groundShadow(x, y + 2, 76, 7);
    box(x - 66, y - 18, 8, 20, '#5b3418');
    box(x + 58, y - 18, 8, 20, '#5b3418');
    box(x - 72, y - 34, 144, 18, '#8a5a32', 2);
    box(x - 72, y - 38, 144, 7, '#c79a64', 2);
    for (const dx of [-46, -8, 34]) {
      polygon([[x + dx - 10, y - 52], [x + dx + 10, y - 52], [x + dx + 7, y - 38], [x + dx - 7, y - 38]], '#b5683a');
      fillCircles('#3f8a4f', [[x + dx - 7, y - 58, 7], [x + dx + 7, y - 58, 7], [x + dx, y - 66, 8]]);
    }
  },

  // ---- 그 밖의 가구
  piano({ x, y }) {
    groundShadow(x, y + 3, 76, 8);
    box(x - 72, y - 118, 144, 100, '#4a3a2c', 6);
    box(x - 76, y - 40, 152, 38, '#3a2c20', 4);
    box(x - 68, y - 40, 136, 18, '#f7f1e3', 2);
    strokeLines('#c9c0ac', 1, () => {
      for (let kx = x - 68; kx <= x + 68; kx += 9) {
        ctx.moveTo(kx, y - 40);
        ctx.lineTo(kx, y - 22);
      }
    });
    ctx.fillStyle = '#1e2a23';
    for (let i = 0, kx = x - 62; kx < x + 62; i++, kx += 9) {
      if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(kx, y - 40, 5, 10);
    }
    box(x - 60, y - 108, 120, 2, '#d9b46a', 1);
    box(x - 20, y - 66, 40, 18, '#f7f1e3', 2);
  },





  // ---- 바닥에 까는 것

  rug_leaf({ x, y }) {
    box(x - 130, y - 62, 260, 124, '#2f7a48', 14);
    box(x - 118, y - 52, 236, 104, '#6fbf8a', 10);
    ctx.fillStyle = '#4f9c5c';
    for (const [dx, dy] of [[-84, -24], [-40, 26], [44, -28], [88, 22]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, 22, 9, -0.6, 0, TAU);
      ctx.fill();
    }
  },


  // ---- 벽에 거는 것
  window({ x, y }, now, night) {
    box(x - 39, y - 39, 78, 78, '#f4efe2', 4);
    box(x - 33, y - 33, 66, 66, night > 0.5 ? '#1f2a52' : '#a8d8f0', 2);
    if (night > 0.5) {
      fillCircles('#f5e5a0', [[x + 12, y - 12, 7]]);
      fillCircles('#ffffff', [[x - 18, y - 16, 1.2], [x - 6, y + 12, 1.2], [x + 20, y + 16, 1.2]]);
    } else {
      fillCircles('#ffffff', [[x - 12, y - 8, 7], [x - 2, y - 11, 8], [x + 8, y - 8, 6]]);
      box(x - 33, y + 18, 66, 15, '#6fbf8a');
    }
    strokeLines('#f4efe2', 3, () => {
      ctx.moveTo(x, y - 33);
      ctx.lineTo(x, y + 33);
      ctx.moveTo(x - 33, y);
      ctx.lineTo(x + 33, y);
    });
    box(x - 44, y + 38, 88, 7, '#c79a64', 2);
  },


  ivy({ x, y }) {
    strokeLines('#2f7a48', 3, () => {
      ctx.moveTo(x - 60, y);
      ctx.quadraticCurveTo(x, y + 18, x + 60, y);
      ctx.moveTo(x - 30, y + 8);
      ctx.lineTo(x - 34, y + 42);
      ctx.moveTo(x + 22, y + 9);
      ctx.lineTo(x + 26, y + 34);
    });
    ctx.fillStyle = '#4f9c5c';
    for (const [dx, dy] of [[-54, 6], [-32, 26], [-36, 42], [-12, 14], [22, 22], [26, 36], [42, 10], [58, 2]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, 8, 4.5, dx * 0.05, 0, TAU);
      ctx.fill();
    }
  },



};

// 빛을 내는 가구. r 은 밝기 100%일 때의 반경, power 는 따뜻한 빛의 세기다. 빛의 크기는 일렁이지 않고 고정이다.

// ---- 오락기: 게임마다 색과 간판이 다른 업라이트 캐비닛. 화면은 FX 로 매 프레임 움직인다
const ARCADE_LOOKS = [
  { body: '#2b2f6b', front: '#3c4396', panel: '#22254f', sign: '#ff5d9e', ink: '#ffffff', name: '별똥 슈팅' },
  { body: '#a8462c', front: '#c95a36', panel: '#7a3220', sign: '#ffd84d', ink: '#5a2414', name: '벽돌깨기' },
  { body: '#3f6b4c', front: '#4f8a5f', panel: '#2f5038', sign: '#e6e8ee', ink: '#2f5038', name: '지뢰찾기' },
];

function drawArcadeCabinet({ x, y, noFx }, now, game) {
  const look = ARCADE_LOOKS[game];
  groundShadow(x, y + 2, 38, 7);
  box(x - 32, y - 132, 64, 132, look.body, 4);
  box(x - 27, y - 124, 54, 122, look.front, 3);
  box(x - 30, y - 134, 60, 20, look.sign, 3);   // 불 들어오는 간판
  box(x - 30, y - 134, 60, 4, 'rgba(255, 255, 255, 0.45)', 2);
  label(look.name, x, y - 123, `700 10px ${FONT}`, look.ink);
  box(x - 25, y - 110, 50, 44, '#141418', 3);   // 화면 테두리
  box(x - 22, y - 107, 44, 38, '#05060c', 2);
  polygon([[x - 30, y - 64], [x + 30, y - 64], [x + 34, y - 50], [x - 34, y - 50]], look.panel);   // 조작판
  oval(x - 15, y - 56, 6, 2.6, '#18181c');
  box(x - 16.5, y - 66, 3, 10, '#d8d8de', 1.5);   // 조이스틱
  fillCircles('#ff4d6d', [[x - 15, y - 67, 3.6]]);
  fillCircles('#ffd84d', [[x + 6, y - 57, 3]]);
  fillCircles('#4fc3f7', [[x + 16, y - 57, 3]]);
  fillCircles('rgba(255, 255, 255, 0.5)', [[x - 16, y - 68, 1.2], [x + 5, y - 58, 1], [x + 15, y - 58, 1]]);
  box(x - 9, y - 42, 18, 22, '#202026', 2);   // 동전 넣는 곳
  box(x - 5, y - 38, 3, 6, '#ffd84d', 1);
  box(x + 2, y - 38, 3, 6, '#ffd84d', 1);
  box(x - 30, y - 8, 60, 8, 'rgba(0, 0, 0, 0.28)', 2);
  if (!noFx) FURNITURE_FX[ARCADE_FX_KINDS[game]]({ x, y }, now);
}
const ARCADE_FX_KINDS = ['arcade_shooter', 'arcade_bricks', 'arcade_mines'];

// 오락기 화면의 손님 끌기 화면 (x-22, y-107, 44×38)
function arcadeScreen(x, y, draw) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 22, y - 107, 44, 38);
  ctx.clip();
  draw(x - 22, y - 107);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let ly = y - 107; ly < y - 69; ly += 3) ctx.fillRect(x - 22, ly, 44, 1);   // 주사선
  ctx.restore();
}

// 가구의 움직이는 부분. 가구 그림이 그리는 것과 같고, 염색한 가구는 물들인 몸체 위에 이것만 매 프레임 그린다.
const FURNITURE_FX = {
  arcade_shooter({ x, y }, now) {
    arcadeScreen(x, y, (sx, sy) => {
      for (let i = 0; i < 9; i++) {
        const py = (sy + ((i * 13 + now / 40) % 38));
        box(sx + ((i * 17) % 42), py, 1, 1, '#ffffff');
      }
      const t = now / 500;
      for (let i = 0; i < 4; i++) fillCircles(i % 2 ? '#ff8fc0' : '#b48cff', [[sx + 8 + i * 9 + Math.sin(t) * 3, sy + 9, 2.6]]);
      const shipX = sx + 22 + Math.sin(now / 700) * 12;
      polygon([[shipX, sy + 28], [shipX + 3.5, sy + 34], [shipX - 3.5, sy + 34]], '#f6f1ff');
      if (Math.floor(now / 250) % 2) box(shipX - 0.5, sy + 18 + ((now / 30) % 8), 1, 3, '#fff7a8');
    });
  },
  arcade_bricks({ x, y }, now) {
    arcadeScreen(x, y, (sx, sy) => {
      const colors = ['#ff6b8a', '#ffd84d', '#7fdc7a', '#4fc3f7'];
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) if ((row * 6 + col + Math.floor(now / 900)) % 7) box(sx + 2 + col * 7, sy + 3 + row * 4, 6, 3, colors[row]);
      const t = (now / 1400) % 2, bx = sx + 4 + Math.abs(((now / 23) % 72) - 36), by = sy + 20 + Math.abs(t - 1) * 13;
      fillCircles('#ffffff', [[bx, by, 1.4]]);
      box(Math.max(sx + 1, Math.min(sx + 33, bx - 5)), sy + 34, 10, 2, '#f6f1ff');
    });
  },
  arcade_mines({ x, y }, now) {
    arcadeScreen(x, y, (sx, sy) => {
      box(sx, sy, 44, 38, '#c3c7cf');
      const open = Math.floor(now / 600) % 30;
      for (let i = 0; i < 30; i++) {
        const cx = sx + 2 + (i % 6) * 7, cy = sy + 2 + Math.floor(i / 6) * 7;
        box(cx, cy, 6, 6, i <= open && (i * 7) % 5 ? '#eceef2' : '#d7dae2');
        if (i === (open + 11) % 30) polygon([[cx + 2, cy + 1], [cx + 5, cy + 2.5], [cx + 2, cy + 4]], '#e0453a');
      }
    });
  },
  fireplace({ x, y }, now) {
    const flick = Math.sin(now / 90) * 3;
    polygon([[x - 28, y - 8], [x - 14, y - 40 - flick], [x - 2, y - 22], [x + 10, y - 50 + flick], [x + 26, y - 8]], '#e8653a');
    polygon([[x - 16, y - 8], [x - 6, y - 28 + flick], [x + 4, y - 18], [x + 10, y - 34 - flick], [x + 18, y - 8]], '#f7b23b');
    candleFlame(x - 55, y - 112, now);
  },
  dining_table({ x, y }, now) {
    candleFlame(x, y - 50, now);
  },
  tv({ x, y }, now) {
    drawTvScreen(x, y - 96, 104, 62, now);
  },
  tv_wall({ x, y }, now) {
    drawTvScreen(x, y - 148, 88, 50, now);
  },
  record_player({ x, y }, now) {
    if (!jazzTrack()) return;
    const a = now / 300;   // 도는 판 위의 빛
    fillCircles('rgba(255, 255, 255, 0.55)', [[x - 10 + Math.cos(a) * 18, y - 44 + Math.sin(a) * 5.8, 1.6]]);
    for (let i = 0; i < 3; i++) {   // 떠오르는 음표
      const p = ((now / 2600) + i / 3) % 1;
      ctx.globalAlpha = Math.min(1, (1 - p) * 2);
      label(i % 2 ? '♫' : '♪', x - 10 + Math.sin(p * 7 + i) * 18, y - 60 - p * 62, `700 ${14 + i}px ${FONT}`, '#ffd76a');
    }
    ctx.globalAlpha = 1;
  },
  wall_clock({ x, y }, now) {
    const date = new Date(now + performance.timeOrigin);
    const hands = [[(date.getHours() % 12 + date.getMinutes() / 60) / 12, 11, 3], [date.getMinutes() / 60, 16, 2]];
    ctx.strokeStyle = '#2b1b16';
    ctx.lineCap = 'round';
    for (const [turn, length, width] of hands) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(turn * TAU) * length, y - Math.cos(turn * TAU) * length);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    fillCircles('#2b1b16', [[x, y, 2.5]]);
  },
  aquarium({ x, y }, now) {
    const swim = (speed, offset, row, color) => {
      const t = Math.sin(now / speed + offset);
      ctx.save();
      ctx.translate(x + t * 34, y - row);
      ctx.scale(Math.cos(now / speed + offset) > 0 ? -1 : 1, 1);
      drawFish(ctx, 0, 0, 0.6, color);
      ctx.restore();
    };
    swim(1400, 0, 66, '#a9c4d6');
    swim(1900, 2, 50, '#a08c74');
    swim(1100, 4, 38, '#f5c518');
  },
};

const FURNITURE_LIGHTS = {
  fireplace: ({ x, y }) => [
    { x, y: y - 26, r: 300, power: 0.3, color: '255, 130, 50' },
    { x: x - 55, y: y - 122, r: 125, power: 0.5, color: '255, 190, 100' },  // 벽난로 위의 촛불
  ],
  dining_table: ({ x, y }) => [{ x, y: y - 58, r: 140, power: 0.42, color: '255, 190, 100' }],
  pendant_frame: ({ x, y }) => [{ x, y: y - 100, r: 110, power: 0.3, color: '255, 196, 120' }],
  pendant_cone: ({ x, y }) => [{ x, y: y - 84, r: 100, power: 0.32, color: '255, 214, 150' }],
  floor_lamp: ({ x, y }, state) => (state.lamp ? [{ x: x + 36, y: y - 96, r: 280, power: 0.28, color: '255, 214, 140' }] : []),
  cinema_screen: ({ x, y }) => [{ x, y: y - 168, r: 520, power: 0.2, color: '205, 215, 255' }],
  cinema_screen_big: ({ x, y }) => [{ x, y: y - 286, r: 860, power: 0.2, color: '205, 215, 255' }],
  cinema_door: ({ x, y }) => [{ x, y: y - 100, r: 90, power: 0.4, color: '255, 214, 150' }],
  snack_bar: ({ x, y }) => [{ x, y: y - 60, r: 230, power: 0.42, color: '255, 214, 150' }],
  shade_lamp: ({ x, y }) => [{ x, y: y - 100, r: 210, power: 0.42, color: '255, 214, 150' }],
  dart_board: ({ x, y }) => [{ x, y: y + 34, r: 130, power: 0.5, color: '255, 226, 180' }],
  bartender: ({ x, y }) => [{ x, y: y - 40, r: 120, power: 0.55, color: '255, 214, 160' }],
  bottle_shelf: ({ x, y }) => [{ x, y: y + 20, r: 210, power: 0.36, color: '255, 190, 120' }],
  bar_counter: ({ x, y }) => BAR_LAMPS.map((dx) => ({ x: x + dx, y: y - 76, r: 190, power: 0.5, color: '255, 196, 120' })),
  bar_table: ({ x, y }) => [{ x, y: y - 62, r: 165, power: 0.52, color: '255, 196, 120' }],
  record_player: ({ x, y }) => [{ x: x - 10, y: y - 50, r: 130, power: 0.34, color: '255, 200, 130' }],
  lantern_lamp: ({ x, y }, state) => (state.lamp ? [{ x, y: y - 76, r: 250, power: 0.36, color: '255, 204, 140' }] : []),
  pachinko: ({ x, y }) => [{ x, y: y - 100, r: 120, power: 0.5, color: '255, 160, 200' }],
  roulette: ({ x, y }) => [{ x, y: y - 80, r: 220, power: 0.45, color: '255, 214, 150' }],
  cashier: ({ x, y }) => [{ x, y: y - 70, r: 170, power: 0.45, color: '255, 226, 170' }],
  casino_sign: ({ x, y }) => [{ x, y: y + 60, r: 260, power: 0.4, color: '255, 140, 220' }],
};

const FLOOR_FURNITURE = new Set(['dart_line', 'rug_leaf', 'rug_plain', 'rug_diamond', 'rug_shag',
  'rug_cat_black', 'rug_cat_stand', 'rug_bunny', 'rug_long_cat', 'rug_puppy', 'rug_8ball', 'rug_cloud', 'rug_heart']);
const WALL_FURNITURE = new Set(['window', 'ivy', 'big_window', 'sheer_window', 'wall_frames', 'round_mirror', 'nimda_poster', 'bottle_shelf', 'gold_frame', 'dart_board', 'casino_sign', 'wall_clock']);
