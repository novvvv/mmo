'use strict';
// 오목 창.

// ------------------------------------------------------------ 오목

const omokEl = document.getElementById('omok');
const omokBoard = document.getElementById('omok-board');
const omokStatus = document.getElementById('omok-status');
const omokBlack = document.getElementById('omok-black');
const omokWhite = document.getElementById('omok-white');
const omokSit = document.getElementById('omok-sit');
const omokLeave = document.getElementById('omok-leave');
const omokAgain = document.getElementById('omok-again');
const OMOK_SIZE = 15, OMOK_REACH = 90;
const omokWatchers = document.getElementById('omok-watchers');
const omokChip = document.getElementById('omok-chip');
const OMOK_WHY = { five: '다섯 줄', resign: '기권', time: '시간 초과', leave: '자리를 떠남', draw: '' };
let omokState = null;   // 서버의 omok 메시지 + 받은 시각

function applyOmok(msg) {
  if (msg.off) {   // 이 방의 오목판을 치웠다
    clearOmok();
    return;
  }
  const before = omokState;
  omokState = { ...msg, at: performance.now() };
  if (mySide() >= 0) omokWatching = false;   // 앉으면 관전자에서 빠진다
  syncOmokChip();
  if (before && msg.play && msg.last !== before.last && msg.last >= 0) Sound.play('place');
  renderOmok();
}

function clearOmok() {
  omokState = null;
  omokWatching = false;   // 방을 옮기면 서버가 관전자에서 뺀다
  omokEl.hidden = true;
  omokChip.hidden = true;
}

// 창을 열면 관전자로 이름을 올리고, 닫으면 내린다. 앉아서 두는 사람은 관전자가 아니다.
let omokWatching = false;
function setOmokOpen(open) {
  const wasHidden = omokEl.hidden;
  omokEl.hidden = !open;
  if (open && wasHidden) restoreWindow(omokEl, 'omok');
  const watch = open && !!omokState && mySide() < 0;
  if (watch !== omokWatching && ws && ws.readyState === WebSocket.OPEN) ws.send(watch ? 'omok watch' : 'omok unwatch');
  omokWatching = watch;
  syncOmokChip();
  renderOmok();
}

// 대국 중인데 창이 닫혀 있으면 방 어디서든 다시 열 수 있게 위쪽에 알림을 띄운다.
function syncOmokChip() {
  omokChip.hidden = !(omokState?.play && omokEl.hidden);
  omokChip.textContent = mySide() >= 0 ? '● 오목 두는 중 · 판 보기' : '● 오목 대국 중 · 관전하기';
}

function mySide() {
  if (!omokState) return -1;
  return omokState.p[0][0] === myId ? 0 : omokState.p[1][0] === myId ? 1 : -1;
}

function renderOmok() {
  if (omokEl.hidden) return;
  const g = omokState;
  const side = mySide();
  omokBlack.textContent = `● 흑 ${g?.p[0][1] || '빈자리'}`;
  omokWhite.textContent = `${g?.p[1][1] || '빈자리'} 백 ○`;
  omokBlack.classList.toggle('turn', !!g?.play && g.turn === 1);
  omokWhite.classList.toggle('turn', !!g?.play && g.turn === 2);
  const seated = !!g && (g.p[0][0] || g.p[1][0]);
  omokSit.hidden = !g || side >= 0 || g.play || (g.p[0][0] && g.p[1][0]);
  omokLeave.hidden = side < 0;
  omokLeave.textContent = g?.play ? '기권' : '일어나기';
  omokAgain.hidden = !(g && side >= 0 && !g.play && g.win && g.p[0][0] && g.p[1][0]);
  let text = '';
  if (!g) text = '오목판을 불러오는 중...';
  else if (g.play) {
    const left = Math.max(0, Math.ceil(g.left - (performance.now() - g.at) / 1000));
    text = (side === g.turn - 1 ? '내 차례! ' : `${g.turn === 1 ? '흑' : '백'} 차례 · `) + `남은 시간 ${left}초`;
  } else if (g.win === 3) text = '비겼습니다. 한 판 더 할까요?';
  else if (g.win) text = `${g.win === 1 ? '흑' : '백'} ${g.p[g.win - 1][1] || ''} 승리! ${OMOK_WHY[g.why] ? `(${OMOK_WHY[g.why]})` : ''}`;
  else if (seated) text = '상대를 기다리는 중입니다. 다른 사람이 앉으면 시작해요.';
  else text = '빈 오목판입니다. 앉기를 누르면 흑으로 앉아요.';
  omokStatus.textContent = text;
  const watchers = g?.w || [];
  omokWatchers.textContent = watchers.length ? `관전 ${watchers.length}명: ${watchers.join(', ')}` : '';
  omokStatus.classList.toggle('mine', !!g?.play && side === g.turn - 1);
  drawOmokBoard();
}

function drawOmokBoard() {
  const c = omokBoard.getContext('2d');
  const W = omokBoard.width, pad = 22, step = (W - pad * 2) / (OMOK_SIZE - 1);
  c.fillStyle = '#e3b86e';
  c.fillRect(0, 0, W, W);
  c.strokeStyle = 'rgba(70, 40, 14, 0.8)';
  c.lineWidth = 1.4;
  c.beginPath();
  for (let i = 0; i < OMOK_SIZE; i++) {
    c.moveTo(pad + i * step, pad);
    c.lineTo(pad + i * step, W - pad);
    c.moveTo(pad, pad + i * step);
    c.lineTo(W - pad, pad + i * step);
  }
  c.stroke();
  c.fillStyle = 'rgba(70, 40, 14, 0.9)';
  for (const [i, j] of [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]) {   // 화점
    c.beginPath();
    c.arc(pad + i * step, pad + j * step, 4, 0, TAU);
    c.fill();
  }
  if (!omokState) return;
  for (let k = 0; k < OMOK_SIZE * OMOK_SIZE; k++) {
    const stone = omokState.b[k];
    if (stone === '0') continue;
    const x = pad + (k % OMOK_SIZE) * step, y = pad + Math.floor(k / OMOK_SIZE) * step;
    const grad = c.createRadialGradient(x - 4, y - 5, 2, x, y, step * 0.46);
    if (stone === '1') {
      grad.addColorStop(0, '#5a5a62');
      grad.addColorStop(1, '#15141a');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#d8d2c4');
    }
    c.fillStyle = grad;
    c.beginPath();
    c.arc(x, y, step * 0.45, 0, TAU);
    c.fill();
    if (k === omokState.last) {   // 마지막 수 표시
      c.fillStyle = '#ff5d5d';
      c.beginPath();
      c.arc(x, y, 4, 0, TAU);
      c.fill();
    }
  }
}

omokBoard.addEventListener('click', (e) => {
  const g = omokState;
  if (!g?.play || mySide() !== g.turn - 1) return;
  const r = omokBoard.getBoundingClientRect();
  const W = omokBoard.width, pad = 22, step = (W - pad * 2) / (OMOK_SIZE - 1);
  const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * W;
  const i = Math.round((x - pad) / step), j = Math.round((y - pad) / step);
  if (i < 0 || j < 0 || i >= OMOK_SIZE || j >= OMOK_SIZE || g.b[j * OMOK_SIZE + i] !== '0') return;
  ws.send(`omok put ${j * OMOK_SIZE + i}`);
});
omokSit.addEventListener('click', () => ws.send('omok sit'));
omokLeave.addEventListener('click', () => ws.send('omok leave'));
omokAgain.addEventListener('click', () => ws.send('omok again'));
document.getElementById('omok-close').addEventListener('click', () => setOmokOpen(false));
omokChip.addEventListener('click', () => {
  omokChip.hidden = true;
  setOmokOpen(true);
});
makeMovable(omokEl, document.getElementById('omok-head'), 'omok');
// 스크립트가 모두 실행된 뒤에 시작한다 (먼저 시작하면 아직 불러오지 않은 파일의 값을 쓰다 멈출 수 있다)
document.addEventListener('DOMContentLoaded', () => setInterval(() => {   // 남은 시간 표시
  if (!omokEl.hidden && omokState?.play) renderOmok();
}, 500));
