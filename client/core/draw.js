'use strict';
// 그림 도구: 상자, 타원, 다각형, 선, 글자, 그림자. 모든 그림 파일이 쓴다.

// 캔버스 그림 모음. 게임 상태는 몰라도 되도록 필요한 값을 인자로 받는다.
// ctx 는 core/state.js 의 메인 캔버스다. 미리보기처럼 다른 캔버스에도 그리는 함수는 c 를 인자로 받는다.

const TAU = Math.PI * 2;
const RADIUS = 16;
const SEAT_LIFT = 6;              // 앉으면 몸을 이만큼 올려 그린다
const ARM_LENGTH = [0, 15, 25];   // 설정값(없음, 기본, 길게)별 팔 길이
const LEG_LENGTH = [0, 13, 24];   // 설정값(없음, 기본, 길게)별 다리 길이
const CHAIR_HALF = 23;            // 1인용 의자 좌판의 절반 폭
const BENCH_HALF = 46;            // 2인용 벤치 좌판의 절반 폭
const FONT = 'system-ui, -apple-system, sans-serif';
const EMOTE_SLEEP = 90;  // 침대에 누웠을 때의 표정. 서버의 감정표현에는 없다
const EMOTE_CLAP = 0, EMOTE_YUM = 1, EMOTE_HAPPY = 2, EMOTE_CRY = 3, EMOTE_JOY = 4;  // 서버의 감정 번호
const EMOTE_HEART = 5, EMOTE_ANGRY = 6, EMOTE_SLEEPY = 7, EMOTE_SHOCK = 8, EMOTE_WAVE = 9;  // 여기부터는 상점에서 구한다
const EMOTE_DANCE = 10, EMOTE_SHY = 11, EMOTE_LAUGH = 12, EMOTE_WINK = 13, EMOTE_HMM = 14;

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function box(x, y, w, h, color, radius) {
  ctx.fillStyle = color;
  if (radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function oval(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function groundShadow(x, y, rx, ry) {
  oval(x, y, rx, ry, 'rgba(0, 0, 0, 0.22)');
}

function fillCircles(color, circles) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [cx, cy, r] of circles) {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, TAU);
  }
  ctx.fill();
}

function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function strokeLines(color, width, draw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  draw();
  ctx.stroke();
}

function label(text, x, y, font, fill) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
