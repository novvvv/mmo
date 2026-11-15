'use strict';
// 마을 그림: 강과 다리, 나무, 가로등, 야외 시설.

// ------------------------------------------------------------ 자연

function drawTree(t, hidingMe) {
  const { x, y } = t;
  const s = treeScale(t);

  ctx.save();
  if (hidingMe) ctx.globalAlpha = 0.5;  // 내 캐릭터가 나무 뒤에 있으면 비쳐 보이게
  groundShadow(x, y + 2, 32 * s, 10 * s);
  polygon([[x - 9 * s, y + 2], [x - 6 * s, y - 52 * s], [x + 6 * s, y - 52 * s], [x + 9 * s, y + 2]], '#6b4423');
  fillCircles('#2a5f2e', [
    [x - 26 * s, y - 62 * s, 25 * s], [x + 26 * s, y - 62 * s, 25 * s],
    [x, y - 54 * s, 24 * s], [x, y - 86 * s, 31 * s],
  ]);
  fillCircles('#37803b', [
    [x - 17 * s, y - 72 * s, 18 * s], [x + 15 * s, y - 76 * s, 18 * s], [x, y - 94 * s, 18 * s],
  ]);
  fillCircles('#4f9c4c', [
    [x - 15 * s, y - 86 * s, 8 * s], [x + 6 * s, y - 100 * s, 7 * s], [x + 21 * s, y - 80 * s, 6 * s],
  ]);
  if (CHRISTMAS) drawTreeSnow(x, y, s);
  ctx.restore();
}

function treeScale(t) {
  return 0.85 + (hash(t.x | 0, t.y | 0) % 35) / 100;  // 나무마다 크기가 조금 다르다
}

function drawCatHead(hx, hy, coat) {
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  for (const side of [-1, 1]) {  // 귀
    ctx.moveTo(hx + side * 7.5, hy - 2);
    ctx.lineTo(hx + side * 6.5, hy - 12);
    ctx.lineTo(hx + side, hy - 6.5);
    ctx.closePath();
  }
  ctx.fill();
  fillCircles(coat.body, [[hx, hy, 8]]);
  fillCircles(coat.eye, [[hx + 0.5, hy - 1, 1.5], [hx + 5.5, hy - 1, 1.5]]);
  fillCircles('#e58a9a', [[hx + 3, hy + 2.5, 1.2]]);  // 코
}

// 자는 동물 머리 위로 작게 떠오르는 z
function drawNapZ(x, y, now) {
  for (let i = 0; i < 2; i++) {
    const p = ((now / 2400) + i / 2) % 1;
    ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
    label('z', x + p * 10, y - p * 20, `700 ${9 + i * 3}px ${FONT}`, '#dfeaff');
  }
  ctx.globalAlpha = 1;
}

// 감은 눈: 아래로 휜 짧은 선
function closedEyes(color, eyes) {
  strokeLines(color, 1.2, () => {
    for (const [ex, ey] of eyes) {
      ctx.moveTo(ex - 1.8, ey);
      ctx.quadraticCurveTo(ex, ey + 1.6, ex + 1.8, ey);
    }
  });
}

// 식빵처럼 웅크리고 자는 고양이: 몸을 둥글게 말고 꼬리로 감싼다. 숨 쉴 때마다 등이 오르내린다
function drawCatAsleep(c, now) {
  const { coat } = c, breath = Math.sin(now / 900) * 0.8;
  ctx.save();
  ctx.translate(c.x, c.y);
  groundShadow(0, 1, 17, 4.5);
  ctx.scale(c.dir, 1);
  oval(-1, -7 - breath / 2, 15, 7.5 + breath, coat.body);
  ctx.lineCap = 'round';
  ctx.strokeStyle = coat.dark;
  ctx.lineWidth = 3.5;
  ctx.beginPath();   // 몸 앞으로 감은 꼬리
  ctx.moveTo(-14, -5);
  ctx.quadraticCurveTo(-16, 1, -4, 0);
  ctx.quadraticCurveTo(5, -0.5, 9, -2);
  ctx.stroke();
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(11 + side * 6.5, -8);
    ctx.lineTo(11 + side * 6, -16);
    ctx.lineTo(11 + side, -11.5);
    ctx.closePath();
  }
  ctx.fill();
  fillCircles(coat.body, [[11, -6.5, 7.5]]);
  closedEyes(coat.eye, [[9, -7], [14.5, -7]]);
  fillCircles('#e58a9a', [[12, -4.5, 1.1]]);
  ctx.restore();
  drawNapZ(c.x + c.dir * 16, c.y - 20, now);
}

// 엎드려 자는 강아지: 앞발 위에 턱을 괴고 납작 엎드린다
function drawDogAsleep(d, now) {
  const { coat } = d, breath = Math.sin(now / 1000) * 0.9;
  ctx.save();
  ctx.translate(d.x, d.y);
  groundShadow(0, 1, 21, 5);
  ctx.scale(d.dir, 1);
  fluff(coat, [[-17, -8, 5.5], [-20, -4, 5]]);   // 내려놓은 꼬리
  fluff(coat, [[-11, -7, 7.5], [-3, -9 - breath, 9], [5, -8 - breath, 8.5], [-8, -4, 6.5], [1, -4, 7]]);
  ctx.fillStyle = coat.dark;
  ctx.fillRect(8, -3, 9, 3.5);   // 앞으로 뻗은 앞발
  const hx = 13, hy = -9;
  const ruff = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ruff.push([hx + Math.cos(a) * 10, hy + Math.sin(a) * 8.5, 4.8]);
  }
  fluff(coat, ruff);
  fillCircles(coat.body, [[hx, hy, 10]]);
  fillCircles('#f7f1e6', [[hx + 3, hy + 3.5, 4.4]]);
  closedEyes('#1b1b1b', [[hx - 2, hy - 2], [hx + 6.5, hy - 2]]);
  fillCircles('#1b1b1b', [[hx + 3, hy + 2, 1.8]]);
  ctx.restore();
  drawNapZ(d.x + d.dir * 20, d.y - 24, now);
}

function drawCat(c, now) {
  if (c.asleep) {
    drawCatAsleep(c, now);
    return;
  }
  const { coat } = c;
  ctx.save();
  ctx.translate(c.x, c.y);
  groundShadow(0, 1, c.moving ? 18 : 13, 4.5);

  ctx.scale(c.dir, 1);  // 그림은 오른쪽을 보고 있다
  ctx.lineCap = 'round';
  ctx.strokeStyle = coat.dark;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (c.moving) {
    ctx.moveTo(-13, -14);
    ctx.quadraticCurveTo(-23, -15, -21 + Math.sin(now / 320) * 3, -28);
  } else {  // 앉아 있을 때는 꼬리를 바닥에 두고 끝만 살랑인다
    ctx.moveTo(-6, -3);
    ctx.quadraticCurveTo(-18, -1, -19, -8 + Math.sin(now / 700) * 2.5);
  }
  ctx.stroke();

  ctx.fillStyle = coat.dark;
  if (c.moving) {
    const stride = Math.sin(now / 85);
    for (const [lx, phase] of [[-10, 1], [-5, -1], [6, -1], [11, 1]]) {
      ctx.fillRect(lx, -9, 3.5, 9 - Math.max(0, stride * phase) * 3);
    }
    oval(0, -13, 15, 8.5, coat.body);
    drawCatHead(14, -21, coat);
  } else {
    oval(-1, -12, 9.5, 12, coat.body);
    ctx.fillStyle = coat.dark;
    ctx.fillRect(3, -11, 3.5, 11);  // 앞다리
    drawCatHead(2, -28, coat);
  }
  ctx.restore();
}

// 복슬복슬한 털: 살짝 어두운 원을 먼저 깔아 밝은 바닥에서도 윤곽이 보이게 한다.
function fluff(coat, circles) {
  fillCircles(coat.dark, circles.map(([x, y, r]) => [x, y, r + 1.3]));
  fillCircles(coat.body, circles);
}

// 복슬강아지: 귀 없이 얼굴을 감싸는 풍성한 털, 짧은 주둥이
function drawDogHead(hx, hy, coat) {
  const ruff = [];
  for (let i = 0; i < 12; i++) {  // 얼굴을 감싸는 털
    const a = (i / 12) * TAU;
    ruff.push([hx + Math.cos(a) * 10.5, hy + 1 + Math.sin(a) * 10, 5.2]);
  }
  fluff(coat, ruff);
  fillCircles(coat.body, [[hx, hy + 1, 10.5]]);
  fillCircles('#f7f1e6', [[hx + 3, hy + 4.5, 4.8]]);
  fillCircles('#1b1b1b', [[hx - 2, hy - 2, 2], [hx + 7, hy - 2, 2], [hx + 3, hy + 2.5, 1.9]]);
  fillCircles('#ffffff', [[hx - 1.4, hy - 2.7, 0.7], [hx + 7.6, hy - 2.7, 0.7]]);
  fillCircles('#ef8fa0', [[hx + 3, hy + 7, 1.7]]);
}

function drawDog(d, now) {
  if (d.asleep) {
    drawDogAsleep(d, now);
    return;
  }
  const { coat } = d;
  ctx.save();
  ctx.translate(d.x, d.y);
  groundShadow(0, 1, d.moving ? 19 : 15, 4.5);
  ctx.scale(d.dir, 1);  // 그림은 오른쪽을 보고 있다
  const wag = Math.sin(now / 90) * 2;  // 등 위로 말린 꼬리를 흔든다
  if (d.moving) {
    fluff(coat, [[-15, -20, 6], [-16 + wag * 0.5, -28, 7], [-10 + wag, -33, 6.5], [-4 + wag, -31, 5]]);
    const stride = Math.sin(now / 70);
    ctx.fillStyle = coat.dark;
    for (const [lx, phase] of [[-10, 1], [-5, -1], [5, -1], [10, 1]]) ctx.fillRect(lx, -7, 4, 7 - Math.max(0, stride * phase) * 2.5);
    fluff(coat, [[-10, -13, 8], [-3, -17, 9], [5, -16, 9], [11, -12, 8], [-7, -8, 6.5], [1, -8, 7.5], [8, -8, 6.5]]);
    drawDogHead(14, -25, coat);
  } else {
    fluff(coat, [[-13, -9, 6], [-17 + wag * 0.5, -16, 7], [-13 + wag, -23, 6.5], [-7 + wag, -24, 5]]);
    ctx.fillStyle = coat.dark;
    ctx.fillRect(-2, -7, 4, 7);
    ctx.fillRect(5, -7, 4, 7);  // 앞다리
    fluff(coat, [[-8, -7, 7.5], [2, -6, 8], [-7, -15, 8.5], [3, -15, 9], [-2, -22, 9]]);
    drawDogHead(3, -32, coat);
  }
  ctx.restore();
}

// 몬스터가 떨어뜨리는 아이템. kind 는 클라이언트의 LOOT 번호다.
function drawLoot(c, x, y, s, kind) {
  c.save();
  c.lineWidth = s;
  c.strokeStyle = 'rgba(20, 70, 30, 0.7)';
  if (kind === 0) {  // 슬라임 젤리
    c.fillStyle = '#7fdc7a';
    c.beginPath();
    c.moveTo(x - 9 * s, y + 5 * s);
    c.bezierCurveTo(x - 10 * s, y - 8 * s, x + 10 * s, y - 8 * s, x + 9 * s, y + 5 * s);
    c.quadraticCurveTo(x, y + 8 * s, x - 9 * s, y + 5 * s);
    c.closePath();
    c.stroke();
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    c.beginPath();
    c.ellipse(x - 3 * s, y - 2 * s, 2.6 * s, 1.7 * s, -0.5, 0, TAU);
    c.fill();
  } else {  // 초록 구슬
    c.fillStyle = '#23b56b';
    c.beginPath();
    c.arc(x, y, 7.5 * s, 0, TAU);
    c.stroke();
    c.fill();
    c.fillStyle = '#7ff0b2';
    c.beginPath();
    c.arc(x + 1.5 * s, y + 1.5 * s, 3.8 * s, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    c.beginPath();
    c.arc(x - 2.8 * s, y - 3 * s, 1.6 * s, 0, TAU);
    c.fill();
  }
  c.restore();
}

// 다리가 달린 칵테일 잔.
function drawCoupe(c, x, y, s, drink) {
  c.fillStyle = 'rgba(235, 240, 245, 0.9)';
  c.fillRect(x - 1 * s, y + 1 * s, 2 * s, 8 * s);
  c.fillRect(x - 5 * s, y + 8 * s, 10 * s, 2 * s);
  c.fillStyle = drink;
  c.beginPath();
  c.moveTo(x - 9 * s, y - 7 * s);
  c.lineTo(x + 9 * s, y - 7 * s);
  c.lineTo(x, y + 2 * s);
  c.closePath();
  c.fill();
}

// 매점 물건. i 는 클라이언트의 SHOP 번호다.
function drawShopItem(c, x, y, s, i) {
  c.save();
  if (i === 0) {           // 팝콘
    c.fillStyle = '#d9302c';
    c.beginPath();
    c.moveTo(x - 7 * s, y - 3 * s);
    c.lineTo(x + 7 * s, y - 3 * s);
    c.lineTo(x + 5 * s, y + 9 * s);
    c.lineTo(x - 5 * s, y + 9 * s);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff4d0';
    for (const [dx, dy, r] of [[-5, -5, 3.2], [0, -7, 3.6], [5, -5, 3.2], [-2, -3, 3], [3, -3, 3]]) {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
      c.fill();
    }
  } else if (i === 1) {    // 콜라
    c.fillStyle = '#5b2a1e';
    c.fillRect(x - 5 * s, y - 6 * s, 10 * s, 15 * s);
    c.fillStyle = '#f4f1ea';
    c.fillRect(x - 6 * s, y - 8 * s, 12 * s, 3 * s);
    c.strokeStyle = '#e5484d';
    c.lineWidth = 1.6 * s;
    c.beginPath();
    c.moveTo(x + 1 * s, y - 8 * s);
    c.lineTo(x + 4 * s, y - 13 * s);
    c.stroke();
  } else if (i === 4) {    // 웰컴 드링크
    drawCoupe(c, x, y, s, '#f2b64a');
    c.fillStyle = '#f58a2c';
    c.beginPath();
    c.arc(x + 7 * s, y - 8 * s, 3 * s, 0, TAU);
    c.fill();
  } else if (i === 5) {    // 맥주
    c.strokeStyle = 'rgba(235, 240, 245, 0.9)';
    c.lineWidth = 2 * s;
    c.beginPath();
    c.arc(x + 6 * s, y + 2 * s, 4 * s, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    c.fillStyle = '#e8a52e';
    c.fillRect(x - 6 * s, y - 5 * s, 12 * s, 14 * s);
    c.fillStyle = '#fff8e7';
    for (const [dx, r] of [[-4, 3], [0, 3.6], [4, 3]]) {
      c.beginPath();
      c.arc(x + dx * s, y - 6 * s, r * s, 0, TAU);
      c.fill();
    }
  } else if (i === 6) {    // 칵테일
    drawCoupe(c, x, y, s, '#d9305a');
    c.fillStyle = '#7a1420';
    c.beginPath();
    c.arc(x, y - 7 * s, 2.2 * s, 0, TAU);
    c.fill();
  } else if (i === 7) {    // 위스키
    c.fillStyle = 'rgba(235, 240, 245, 0.45)';
    c.fillRect(x - 8 * s, y - 6 * s, 16 * s, 15 * s);
    c.fillStyle = '#b5651d';
    c.fillRect(x - 7 * s, y, 14 * s, 8 * s);
    c.fillStyle = 'rgba(240, 248, 255, 0.85)';
    c.fillRect(x - 5 * s, y - 3 * s, 6 * s, 6 * s);
    c.fillRect(x + 1 * s, y - 1 * s, 5 * s, 5 * s);
  } else {                 // 물약
    c.fillStyle = i === 2 ? '#e5484d' : '#b05be0';
    c.beginPath();
    c.arc(x, y + 2 * s, 7 * s, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(240, 240, 240, 0.9)';
    c.fillRect(x - 2.5 * s, y - 9 * s, 5 * s, 6 * s);
    c.fillStyle = '#8a6a4c';
    c.fillRect(x - 3 * s, y - 11 * s, 6 * s, 3 * s);
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    c.beginPath();
    c.arc(x - 2.5 * s, y, 1.8 * s, 0, TAU);
    c.fill();
  }
  c.restore();
}

function drawCoins(x, y) {
  for (const [dx, dy] of [[-5, 2], [5, 2], [0, -3]]) {
    oval(x + dx, y + dy + 1.5, 6.5, 3.5, '#a9791a');
    oval(x + dx, y + dy, 6.5, 3.5, '#f5c518');
  }
}

function drawHeart(x, y, s, color, c = ctx) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + 4 * s);
  c.bezierCurveTo(x - 8 * s, y - 2 * s, x - 3 * s, y - 7 * s, x, y - 3 * s);
  c.bezierCurveTo(x + 3 * s, y - 7 * s, x + 8 * s, y - 2 * s, x, y + 4 * s);
  c.fill();
}

// ------------------------------------------------------------ 야외 시설

function drawLamp(l, on) {
  const { x, y } = l;
  groundShadow(x, y + 2, 11, 4);
  box(x - 6, y - 5, 12, 6, '#2e3238', 2);
  box(x - 2.5, y - 92, 5, 88, '#3a3f47');
  box(x - 8, y - 95, 16, 4, '#2e3238', 2);
  box(x - 7, y - 112, 14, 18, on ? '#ffe7a3' : '#c9ccc4', 3);
  polygon([[x - 10, y - 112], [x + 10, y - 112], [x + 4, y - 120], [x - 4, y - 120]], '#2e3238');
  if (on) {
    const glow = ctx.createRadialGradient(x, y - 103, 2, x, y - 103, 34);
    glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
    glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 103, 34, 0, TAU);
    ctx.fill();
  }
  if (CHRISTMAS) drawLampSnow(x, y);
}

function windowPane(x, y, w, h, frame, lit, radius = 2) {
  box(x - 3, y - 3, w + 6, h + 6, frame, radius + 2);
  box(x, y, w, h, lit ? '#ffd98a' : '#bfe0f0', radius);
  strokeLines(frame, 2, () => {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
  });
}

function roundWindow(x, y, r, frame, lit) {
  fillCircles(frame, [[x, y, r + 3]]);
  fillCircles(lit ? '#ffd98a' : '#cfe6f5', [[x, y, r]]);
  strokeLines(frame, 2, () => {
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
  });
}

function signBoard(x, y, text, board, ink, trim) {
  ctx.font = `800 15px ${FONT}`;
  const w = Math.max(58, ctx.measureText(text).width + 26);
  box(x - w / 2 - 2, y - 15, w + 4, 30, trim, 7);
  box(x - w / 2, y - 13, w, 26, board, 6);
  label(text, x, y + 0.5, `800 15px ${FONT}`, ink);
}
