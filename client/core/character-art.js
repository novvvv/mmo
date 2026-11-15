'use strict';
// 캐릭터 그림: 몸, 팔다리, 표정, 감정표현, 앉기와 눕기.

// ------------------------------------------------------------ 캐릭터

// '#rrggbb' 를 target 색 쪽으로 t(0~1) 만큼 섞는다.
function mixColor(color, target, t) {
  const channel = (hex, from) => parseInt(hex.slice(from, from + 2), 16);
  const part = (from) => Math.round(channel(color, from) + (channel(target, from) - channel(color, from)) * t).toString(16).padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

const outlineCache = new Map();
function outlineOf(color) {  // 매 프레임 불리므로 색마다 한 번만 계산한다
  let outline = outlineCache.get(color);
  if (!outline) {
    if (outlineCache.size > 256) outlineCache.clear();
    outline = mixColor(color, '#000000', 0.55);
    outlineCache.set(color, outline);
  }
  return outline;
}

function bodyLift(o) {
  if (o.seat) return SEAT_LIFT;
  return o.legs ? LEG_LENGTH[o.legs] - 2 : 0;
}

function limbStyle(o) {
  if (o.limbColor === 1) return { inner: '#26262b', outer: null };
  if (o.limbColor === 2) return { inner: o.color, outer: outlineOf(o.color) };
  return { inner: '#ffffff', outer: 'rgba(30, 24, 20, 0.85)' };
}

function strokeLimb(c, style, build) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (style.outer) {
    c.strokeStyle = style.outer;
    c.lineWidth = 5;
    c.beginPath();
    build();
    c.stroke();
  }
  c.strokeStyle = style.inner;
  c.lineWidth = style.outer ? 3 : 3.5;
  c.beginPath();
  build();
  c.stroke();
}

function drawLegs(c, o, bodyY, style) {
  const length = LEG_LENGTH[o.legs];
  const facing = Math.abs(o.dirX) > 0.3 ? Math.sign(o.dirX) : 0;
  for (const side of [-1, 1]) {
    const hipX = o.x + side * 7, hipY = bodyY + RADIUS - 3;
    let footX, footY;
    if (o.seat) {  // 앉으면 의자 앞으로 다리가 늘어져 살짝 흔들린다
      footX = hipX + side + Math.sin(o.t / 420 + side) * 2;
      footY = hipY + length + 2;
    } else {
      const phase = o.t / 85 + (side > 0 ? 0 : Math.PI);
      footX = hipX + (o.moving ? Math.sin(phase) * 7 : 0);
      footY = o.y + RADIUS * 0.85 - (o.moving ? Math.max(0, Math.cos(phase)) * 3 : 0);
    }
    strokeLimb(c, style, () => {
      c.moveTo(hipX, hipY);
      c.quadraticCurveTo(hipX + side * 2.5, (hipY + footY) / 2, footX, footY);
    });
    const toe = facing || side;
    strokeLimb(c, style, () => {
      c.moveTo(footX, footY);
      c.lineTo(footX + toe * 5, footY + 0.5);
    });
  }
}

function drawArms(c, o, bodyY, style) {
  const length = ARM_LENGTH[o.arms];
  for (const side of [-1, 1]) {
    const shoulderX = o.x + side * (RADIUS - 2), shoulderY = bodyY + 1;
    let handX, handY;
    if (o.grip === side) {  // 낚싯대를 잡은 손
      handX = o.x + side * 24;
      handY = bodyY + 3;
    } else {
      const swing = o.moving && !o.seat ? Math.sin(o.t / 85 + (side > 0 ? Math.PI : 0)) * 5 : Math.sin(o.t / 900 + side);
      handX = shoulderX + side * length * 0.62;
      handY = shoulderY + length * 0.78 + swing;
      if (o.swing !== undefined && o.swing >= 0 && side === o.swingSide) {  // 때리는 쪽 팔을 앞으로 뻗는다
        handX = o.x + side * (RADIUS + length);
        handY = bodyY - 4 + o.swing * 8;
      } else if (o.emote === EMOTE_CLAP) {  // 몸 앞에서 손뼉을 친다
        handX = o.x + side * (2 + Math.abs(Math.sin(o.emoteT / 110)) * 9);
        handY = bodyY + 10;
      } else if (o.emote === EMOTE_JOY) {  // 두 팔을 번쩍 든다
        handX = shoulderX + side * length * 0.5;
        handY = shoulderY - length * 0.9 + Math.sin(o.emoteT / 110 + side) * 3;
      } else if (o.emote === EMOTE_CRY) {  // 눈물을 훔친다
        handX = o.x + side * 11;
        handY = bodyY + 1 + Math.sin(o.emoteT / 140 + side) * 2;
      } else if (o.emote === EMOTE_HEART) {  // 가슴 앞에 두 손을 모은다
        handX = o.x + side * 4;
        handY = bodyY + 10 + Math.sin(o.emoteT / 300) * 1.5;
      } else if (o.emote === EMOTE_ANGRY) {  // 허리에 주먹
        handX = o.x + side * (RADIUS + 1);
        handY = bodyY + 9;
      } else if (o.emote === EMOTE_SHOCK) {  // 두 팔을 벌려 든다
        handX = shoulderX + side * length * 0.85;
        handY = shoulderY - length * 0.35;
      } else if (o.emote === EMOTE_WAVE && side === 1) {  // 한 손을 들어 흔든다
        handX = shoulderX + length * 0.55 + Math.sin(o.emoteT / 120) * 5;
        handY = shoulderY - length * 0.85;
      } else if (o.emote === EMOTE_DANCE) {  // 두 팔을 번갈아 올렸다 내린다
        const up = Math.sin(o.emoteT / 160) * side;
        handX = shoulderX + side * length * 0.7;
        handY = shoulderY + up * length * 0.75;
      } else if (o.emote === EMOTE_SHY) {  // 두 손으로 볼을 감싼다
        handX = o.x + side * 12;
        handY = bodyY + 4;
      } else if (o.emote === EMOTE_LAUGH) {  // 배를 잡고 웃는다
        handX = o.x + side * 7;
        handY = bodyY + 11 + Math.abs(Math.sin(o.emoteT / 90)) * 1.5;
      } else if (o.emote === EMOTE_HMM && side === 1) {  // 턱을 괸다
        handX = o.x + 7;
        handY = bodyY + 11;
      }
    }
    // 어깨에서 바깥으로 뻗었다가 아래로 휘어지는 팔
    strokeLimb(c, style, () => {
      c.moveTo(shoulderX, shoulderY);
      c.quadraticCurveTo(shoulderX + side * length * 0.85, shoulderY - 3, handX, handY);
    });
    strokeLimb(c, style, () => {
      c.moveTo(handX, handY);
      c.lineTo(handX + 0.1, handY + 0.1);
    });
  }
}

function closedEye(c, x, y, down) {  // down 이면 처진 눈, 아니면 웃는 눈
  c.beginPath();
  if (down) c.arc(x, y - 2, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
  else c.arc(x, y + 1, 3.4, 1.15 * Math.PI, 1.85 * Math.PI);
  c.stroke();
}

function faceSmile(c, fx, y, r) {
  c.beginPath();
  c.arc(fx, y, r, 0.12 * Math.PI, 0.88 * Math.PI);
  c.stroke();
}

function drawEmoteFace(c, o, fx, fy) {
  c.save();
  c.strokeStyle = '#1b1b1b';
  c.lineWidth = 2;
  c.lineCap = 'round';
  if (o.emote === EMOTE_SLEEP) {
    for (const s of [-1, 1]) closedEye(c, fx + s * 5.5, fy - 2, true);
    faceSmile(c, fx, fy + 4, 2.5);
  } else if (o.emote === EMOTE_CLAP) {
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(fx + s * 5.5, fy - 3, 4, 0, TAU);
      c.fill();
      c.fillStyle = '#1b1b1b';
      c.beginPath();
      c.arc(fx + s * 5.5, fy - 3, 2, 0, TAU);
      c.fill();
    }
    faceSmile(c, fx, fy + 3, 5);
  } else if (o.emote === EMOTE_YUM) {
    for (const s of [-1, 1]) closedEye(c, fx + s * 5.5, fy - 3, false);
    faceSmile(c, fx, fy + 2, 6);
    c.fillStyle = '#ef6f8c';  // 입맛을 다시는 혀
    c.beginPath();
    c.ellipse(fx + 3, fy + 8.5 + Math.abs(Math.sin(o.emoteT / 150)) * 1.5, 2.8, 3.4, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_HAPPY) {
    for (const s of [-1, 1]) {
      closedEye(c, fx + s * 5.5, fy - 3, false);
      c.fillStyle = 'rgba(244, 114, 140, 0.75)';
      c.beginPath();
      c.ellipse(fx + s * 10, fy + 3, 3.4, 2.2, 0, 0, TAU);
      c.fill();
    }
    faceSmile(c, fx, fy + 3, 4);
  } else if (o.emote === EMOTE_CRY) {
    for (const s of [-1, 1]) {
      closedEye(c, fx + s * 5.5, fy - 3, true);
      c.beginPath();  // 처진 눈썹
      c.moveTo(fx + s * 2.5, fy - 9.5);
      c.lineTo(fx + s * 8.5, fy - 7);
      c.stroke();
    }
    c.fillStyle = '#3a2230';  // 엉엉 벌린 입
    c.beginPath();
    c.ellipse(fx, fy + 7, 4.6, 3.4 + Math.abs(Math.sin(o.emoteT / 120)) * 1.6, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_JOY) {
    for (const s of [-1, 1]) closedEye(c, fx + s * 5.5, fy - 4, false);
    c.fillStyle = '#3a2230';  // 활짝 웃는 입
    c.beginPath();
    c.arc(fx, fy + 1, 8, 0, Math.PI);
    c.closePath();
    c.fill();
    c.fillStyle = '#ef6f8c';
    c.beginPath();
    c.ellipse(fx, fy + 7, 4, 2, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_HEART) {
    const beat = 0.62 + Math.abs(Math.sin(o.emoteT / 260)) * 0.14;
    for (const s of [-1, 1]) drawHeart(fx + s * 5.5, fy - 3, beat, '#f0567c', c);   // 하트 눈
    faceSmile(c, fx, fy + 3, 4.5);
  } else if (o.emote === EMOTE_ANGRY) {
    for (const s of [-1, 1]) {
      openEye(c, fx + s * 5.5, fy - 2, 3.4, 1.8, 0, 0);
      c.lineWidth = 2.4;
      c.beginPath();  // 치켜 올라간 눈썹
      c.moveTo(fx + s * 1.5, fy - 5);
      c.lineTo(fx + s * 9.5, fy - 9);
      c.stroke();
      c.lineWidth = 2;
    }
    c.beginPath();  // 꾹 다문 입
    c.arc(fx, fy + 9, 4, 1.15 * Math.PI, 1.85 * Math.PI);
    c.stroke();
  } else if (o.emote === EMOTE_SLEEPY) {
    for (const s of [-1, 1]) closedEye(c, fx + s * 5.5, fy - 2, true);
    const yawn = Math.max(0, Math.sin(o.emoteT / 480));   // 하품이 커졌다 닫힌다
    c.fillStyle = '#3a2230';
    c.beginPath();
    c.ellipse(fx, fy + 6, 1.6 + yawn * 2.2, 1.2 + yawn * 3.2, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_SHOCK) {
    for (const s of [-1, 1]) openEye(c, fx + s * 5.5, fy - 3, 5, 1.3, 0, 0);
    c.fillStyle = '#3a2230';
    c.beginPath();
    c.ellipse(fx, fy + 7, 2.4, 3.2, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_WAVE) {
    for (const s of [-1, 1]) openEye(c, fx + s * 5.5, fy - 3, 4, 2, 0.6, 0);
    faceSmile(c, fx, fy + 2.5, 5);
  } else if (o.emote === EMOTE_DANCE) {
    for (const s of [-1, 1]) closedEye(c, fx + s * 5.5, fy - 3, false);
    c.fillStyle = '#3a2230';
    c.beginPath();
    c.arc(fx, fy + 2, 5.5, 0, Math.PI);
    c.closePath();
    c.fill();
  } else if (o.emote === EMOTE_SHY) {
    for (const s of [-1, 1]) {
      c.fillStyle = 'rgba(244, 96, 124, 0.85)';
      c.beginPath();
      c.ellipse(fx + s * 9.5, fy + 3, 4.2, 2.8, 0, 0, TAU);
      c.fill();
      closedEye(c, fx + s * 5.5, fy - 2, true);
    }
    c.beginPath();  // 우물쭈물한 입
    c.moveTo(fx - 3, fy + 7);
    c.quadraticCurveTo(fx - 1.5, fy + 5.5, fx, fy + 7);
    c.quadraticCurveTo(fx + 1.5, fy + 8.5, fx + 3, fy + 7);
    c.stroke();
  } else if (o.emote === EMOTE_LAUGH) {
    for (const s of [-1, 1]) {  // > < 눈
      c.beginPath();
      c.moveTo(fx + s * 8.5, fy - 6);
      c.lineTo(fx + s * 3.5, fy - 3);
      c.lineTo(fx + s * 8.5, fy);
      c.stroke();
    }
    c.fillStyle = '#3a2230';
    c.beginPath();
    c.arc(fx, fy + 2.5, 7 + Math.abs(Math.sin(o.emoteT / 90)), 0, Math.PI);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(fx - 4.5, fy + 2.5, 9, 2.2);
  } else if (o.emote === EMOTE_WINK) {
    openEye(c, fx - 5.5, fy - 3, 4, 2, 0.5, 0);
    closedEye(c, fx + 5.5, fy - 3, false);
    faceSmile(c, fx, fy + 2.5, 5);
    c.fillStyle = '#ef6f8c';  // 살짝 내민 혀
    c.beginPath();
    c.ellipse(fx + 2.5, fy + 8, 2.2, 2.6, 0, 0, TAU);
    c.fill();
  } else if (o.emote === EMOTE_HMM) {
    for (const s of [-1, 1]) openEye(c, fx + s * 5.5, fy - 3, 4, 2, 1.6, -1.6);   // 위를 올려다본다
    c.beginPath();  // 한쪽만 올라간 눈썹
    c.moveTo(fx + 2.5, fy - 10.5);
    c.lineTo(fx + 9, fy - 12);
    c.moveTo(fx - 9, fy - 9);
    c.lineTo(fx - 2.5, fy - 9);
    c.moveTo(fx - 2.5, fy + 7.5);  // 비뚜름한 입
    c.lineTo(fx + 3.5, fy + 6);
    c.stroke();
  }
  c.restore();
}

// 뜬 눈: 흰자 반지름 r, 눈동자 반지름 pupil, 눈동자가 (lookX, lookY) 만큼 쏠린다
function openEye(c, x, y, r, pupil, lookX, lookY) {
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.arc(x + lookX, y + lookY, pupil, 0, TAU);
  c.fill();
}

// 머리 위로 떠오르는 글자 (Z, ?, ! 같은 것)
function emoteGlyph(c, text, x, y, size, color) {
  c.font = `800 ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 3;
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}

function sparkle(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, len = i % 2 ? r * 0.35 : r;
    c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  c.closePath();
  c.fill();
}

function drawEmoteEffects(c, o, fx, fy) {
  const t = o.emoteT;
  c.save();
  if (o.emote === EMOTE_CLAP && Math.abs(Math.sin(t / 110)) < 0.3) {  // 손이 맞닿는 순간
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    for (const a of [-2.3, -1.57, -0.85]) {
      c.moveTo(fx + Math.cos(a) * 7, fy + 9 + Math.sin(a) * 7);
      c.lineTo(fx + Math.cos(a) * 13, fy + 9 + Math.sin(a) * 13);
    }
    c.stroke();
  } else if (o.emote === EMOTE_YUM) {
    c.font = `700 11px ${FONT}`;
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    c.fillStyle = '#e8772e';
    const y = fy - 18 - ((t / 600) % 1) * 6;
    c.strokeText('냠', fx + 22, y);
    c.fillText('냠', fx + 22, y);
  } else if (o.emote === EMOTE_HAPPY) {
    for (let i = 0; i < 3; i++) {
      const p = (t / 1200 + i / 3) % 1;
      c.globalAlpha = Math.min(1, (1 - p) * 2);
      drawHeart(fx + [-20, 20, 0][i] + Math.sin(p * 7) * 3, fy - 16 - p * 26, 0.9, '#f0567c', c);
    }
  } else if (o.emote === EMOTE_CRY) {
    c.fillStyle = '#5db4ee';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const p = (t / 620 + i / 3 + (s > 0 ? 0.17 : 0)) % 1;
        c.globalAlpha = 1 - p * 0.6;
        c.beginPath();
        c.ellipse(fx + s * (8 + p * 7), fy - 1 + p * 24, 2, 3.2, 0, 0, TAU);
        c.fill();
      }
    }
  } else if (o.emote === EMOTE_JOY) {
    c.fillStyle = '#ffd24a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + t / 900;
      sparkle(c, fx + Math.cos(a) * 28, fy - 6 + Math.sin(a) * 20, 3 + Math.abs(Math.sin(t / 200 + i)) * 3.5);
    }
  } else if (o.emote === EMOTE_HEART) {  // 손에서 큰 하트가 부풀어 날아간다
    const p = (t / 1500) % 1;
    c.globalAlpha = Math.min(1, (1 - p) * 2.5);
    drawHeart(fx, fy - 18 - p * 24, 1 + p * 1.3, '#f0567c', c);
    c.globalAlpha = 1;
    for (const s of [-1, 1]) drawHeart(fx + s * 22, fy - 10 + Math.sin(t / 300 + s) * 3, 0.6, '#ff9db4', c);
  } else if (o.emote === EMOTE_ANGRY) {
    const pulse = 1 + Math.abs(Math.sin(t / 150)) * 0.25;
    c.strokeStyle = '#e03a3a';   // 불끈 솟은 화남 표시
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    const mx = fx + 15, my = fy - 17;
    c.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      c.moveTo(mx + sx * 1.6 * pulse, my + sy * 5.5 * pulse);
      c.quadraticCurveTo(mx + sx * 1.6 * pulse, my + sy * 1.6 * pulse, mx + sx * 5.5 * pulse, my + sy * 1.6 * pulse);
    }
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';  // 씩씩대는 콧김
    for (const s of [-1, 1]) {
      const p = (t / 500 + (s > 0 ? 0.5 : 0)) % 1;
      c.globalAlpha = 1 - p;
      c.beginPath();
      c.arc(fx + s * (10 + p * 12), fy + 6 + p * 2, 2 + p * 3, 0, TAU);
      c.fill();
    }
  } else if (o.emote === EMOTE_SLEEPY) {
    for (let i = 0; i < 3; i++) {
      const p = (t / 1800 + i / 3) % 1;
      c.globalAlpha = Math.min(1, (1 - p) * 2);
      emoteGlyph(c, 'Z', fx + 14 + p * 14 + Math.sin(p * 6) * 2, fy - 12 - p * 24, 8 + p * 8, '#5a78d8');
    }
  } else if (o.emote === EMOTE_SHOCK) {
    const pop = Math.min(1, t / 160);
    emoteGlyph(c, '!', fx + 1, fy - 24 - pop * 6, 12 + pop * 10, '#e03a3a');
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    for (const a of [-2.5, -2.05, -1.1, -0.65]) {
      c.moveTo(fx + Math.cos(a) * 20, fy + Math.sin(a) * 20);
      c.lineTo(fx + Math.cos(a) * (25 + pop * 3), fy + Math.sin(a) * (25 + pop * 3));
    }
    c.stroke();
  } else if (o.emote === EMOTE_WAVE) {
    if (o.arms) {   // 흔드는 손 옆의 움직임 선
      const hx = o.x + RADIUS + ARM_LENGTH[o.arms] * 0.55, hy = fy - ARM_LENGTH[o.arms] * 0.85;
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.lineWidth = 1.8;
      c.lineCap = 'round';
      c.beginPath();
      for (const s of [-1, 1]) c.arc(hx + 2, hy, 9 + (s > 0 ? 4 : 0), -0.9, -0.2);
      c.stroke();
    }
    emoteGlyph(c, '안녕!', fx - 22, fy - 20 + Math.sin(t / 250) * 2, 10, '#3f9a5c');
  } else if (o.emote === EMOTE_DANCE) {
    for (let i = 0; i < 4; i++) {
      const p = (t / 1300 + i / 4) % 1, s = i % 2 ? 1 : -1;
      c.globalAlpha = Math.min(1, (1 - p) * 2);
      emoteGlyph(c, i % 2 ? '♪' : '♫', fx + s * (20 + p * 8) + Math.sin(p * 8) * 3, fy - 4 - p * 28, 13, ['#e8548a', '#4d8fe8', '#f0a020', '#43b56a'][i]);
    }
  } else if (o.emote === EMOTE_SHY) {
    c.strokeStyle = 'rgba(244, 96, 124, 0.9)';   // 달아오른 볼의 빗금
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    c.beginPath();
    for (const s of [-1, 1]) {
      for (const dx of [-2.2, 0, 2.2]) {
        c.moveTo(fx + s * 9.5 + dx + 1, fy + 1.4);
        c.lineTo(fx + s * 9.5 + dx - 1, fy + 4.6);
      }
    }
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.8)';   // 머리 위로 피어오르는 김
    for (let i = 0; i < 3; i++) {
      const p = (t / 1100 + i / 3) % 1;
      c.globalAlpha = (1 - p) * 0.9;
      c.beginPath();
      c.arc(fx + [-7, 0, 7][i] + Math.sin(p * 6 + i) * 2, fy - 18 - p * 12, 2 + p * 2.5, 0, TAU);
      c.fill();
    }
  } else if (o.emote === EMOTE_LAUGH) {
    for (let i = 0; i < 2; i++) {
      const p = (t / 700 + i / 2) % 1, s = i ? 1 : -1;
      c.globalAlpha = Math.min(1, (1 - p) * 2);
      emoteGlyph(c, 'ㅋㅋ', fx + s * (24 + p * 6), fy - 12 - p * 14, 11, '#e8772e');
    }
    c.globalAlpha = 1;
    c.fillStyle = '#5db4ee';   // 웃다가 맺힌 눈물
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(fx + s * 10.5, fy - 1, 1.5, 2.2, 0, 0, TAU);
      c.fill();
    }
  } else if (o.emote === EMOTE_WINK) {
    const p = (t / 900) % 1;   // 윙크한 눈에서 별이 튄다
    c.globalAlpha = Math.min(1, (1 - p) * 2);
    c.fillStyle = '#ffd24a';
    sparkle(c, fx + 13 + p * 12, fy - 9 - p * 10, 3 + p * 4);
    c.globalAlpha = 1;
  } else if (o.emote === EMOTE_HMM) {
    emoteGlyph(c, '?', fx + 14, fy - 24 + Math.sin(t / 300) * 2.5, 20, '#5a78d8');
  }
  c.restore();
}

// 표정에 맞춰 몸이 들썩이는 높이
function emoteBounce(o) {
  if (o.emote === EMOTE_JOY) return Math.abs(Math.sin(o.emoteT / 130)) * (o.seat ? 3 : 9);
  if (o.emote === EMOTE_YUM) return Math.abs(Math.sin(o.emoteT / 200)) * 2;
  if (o.emote === EMOTE_DANCE) return Math.abs(Math.sin(o.emoteT / 160)) * (o.seat ? 2 : 5);
  if (o.emote === EMOTE_LAUGH) return Math.abs(Math.sin(o.emoteT / 90)) * 2.5;
  if (o.emote === EMOTE_SHOCK) return o.emoteT < 320 ? Math.sin((o.emoteT / 320) * Math.PI) * (o.seat ? 3 : 8) : 0;   // 처음에 펄쩍
  if (o.emote === EMOTE_ANGRY) return Math.abs(Math.sin(o.emoteT / 110)) * 1.5;
  if (o.emote === EMOTE_SLEEPY) return -Math.max(0, Math.sin(o.emoteT / 480)) * 1.5;   // 고개가 꾸벅 떨어진다
  return 0;
}

// 표정에 맞춰 몸이 좌우로 흔들리는 폭
function emoteSway(o) {
  if (o.emote === EMOTE_DANCE) return Math.sin(o.emoteT / 160) * 3.5;
  if (o.emote === EMOTE_ANGRY) return Math.sin(o.emoteT / 38) * 0.9;   // 부들부들
  if (o.emote === EMOTE_HMM) return Math.sin(o.emoteT / 600) * 1.5;    // 갸웃갸웃
  return 0;
}

// o: { x, y, color, arms, legs, limbColor, dirX, dirY, moving, seat, grip, t, emote, emoteT } emote 는 없거나 -1 이면 평소 얼굴
function drawCharacter(c, o) {
  const emoting = o.emote !== undefined && o.emote >= 0;
  const sway = emoting ? emoteSway(o) : 0;
  if (sway) {
    c.save();
    c.translate(sway, 0);
  }
  const bodyY = o.y - bodyLift(o) - (emoting ? emoteBounce(o) : 0);

  if (!o.seat) {
    c.fillStyle = 'rgba(0, 0, 0, 0.25)';
    c.beginPath();
    c.ellipse(o.x, o.y + RADIUS * 0.85, RADIUS * 0.9, RADIUS * 0.35, 0, 0, TAU);
    c.fill();
  }

  const style = limbStyle(o);
  if (o.legs) drawLegs(c, o, bodyY, style);

  c.fillStyle = o.color;
  c.strokeStyle = outlineOf(o.color);
  c.lineWidth = 3;
  c.beginPath();
  c.arc(o.x, bodyY, RADIUS, 0, TAU);
  c.fill();
  c.stroke();

  if (emoting) {
    drawEmoteFace(c, o, o.x, bodyY);
  } else {
    // 이동 방향을 바라보는 눈
    const ex = o.dirX * 5, ey = o.dirY * 4;
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(o.x + ex + s * 5.5, bodyY + ey - 3, 4, 0, TAU);
      c.fill();
      c.fillStyle = '#1b1b1b';
      c.beginPath();
      c.arc(o.x + ex * 1.35 + s * 5.5, bodyY + ey * 1.35 - 3, 2, 0, TAU);
      c.fill();
    }
  }

  if (o.arms) drawArms(c, o, bodyY, style);
  if (emoting) drawEmoteEffects(c, o, o.x, bodyY);
  if (sway) c.restore();
}

function drawFish(c, x, y, s, color) {
  c.fillStyle = color;
  c.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  c.lineWidth = s;
  c.beginPath();
  c.ellipse(x, y, 11 * s, 6 * s, 0, 0, TAU);
  c.moveTo(x + 9 * s, y);  // 꼬리
  c.lineTo(x + 17 * s, y - 6 * s);
  c.lineTo(x + 17 * s, y + 6 * s);
  c.closePath();
  c.stroke();
  c.fill();
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.arc(x - 6.5 * s, y - 1.2 * s, 1.2 * s, 0, TAU);
  c.fill();
}

// 아이템창의 광고판 아이콘
function drawBoardIcon(c) {
  c.fillStyle = '#fff8e7';
  c.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  c.lineWidth = 1.6;
  c.lineJoin = 'round';
  c.beginPath();
  c.roundRect(7, 2, 34, 18, 5);
  c.moveTo(19, 20);
  c.lineTo(24, 26);
  c.lineTo(29, 20);
  c.stroke();
  c.fill();
  c.fillStyle = '#8a6a3a';
  c.fillRect(13, 8, 22, 2.4);
  c.fillRect(13, 13, 15, 2.4);
}
