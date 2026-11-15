'use strict';
// 화면 가운데 알림창 (교환·동거인·친구 신청).

// ------------------------------------------------------------ 가운데 알림창
// 교환, 동거인, 친구 신청이 오면 화면 가운데에 튀어나오고 제목 줄이 깜박이며 소리가 난다. 여러 개가 오면 하나씩 차례로 띄운다.
// 다른 탭을 보고 있으면 브라우저 탭 제목도 깜박인다.

const noticeLayer = document.getElementById('notice-layer');
const noticeEl = document.getElementById('notice');
const noticeTitle = document.getElementById('notice-title');
const noticeText = document.getElementById('notice-text');
const noticeSub = document.getElementById('notice-sub');
const noticeMore = document.getElementById('notice-more');
const noticeIcon = document.getElementById('notice-icon');
const noticeYes = document.getElementById('notice-yes');
const noticeNo = document.getElementById('notice-no');
const notices = [];        // 기다리는 알림 { key, kind, title, text, sub, yesLabel, noLabel, yes, no, look }
let noticeShown = null;
let titleFlash = 0;
const PAGE_TITLE = document.title;

function pushNotice(notice) {
  if (notice.key) {   // 같은 사람의 같은 신청은 하나만
    const at = notices.findIndex((n) => n.key === notice.key);
    if (at >= 0) notices.splice(at, 1);
    if (noticeShown?.key === notice.key) noticeShown = null;
  }
  notices.push(notice);
  if (!noticeShown) showNextNotice();
  else noticeMore.hidden = false, noticeMore.textContent = `+${notices.length}`;
  if (!notice.quiet) {
    Sound.play('notify');
    flashPageTitle(notice.title);
  }
}

function showNextNotice() {
  noticeShown = notices.shift() || null;
  noticeLayer.hidden = !noticeShown;
  if (!noticeShown) return;
  const n = noticeShown;
  noticeTitle.textContent = n.title;
  noticeText.textContent = n.text;
  noticeSub.textContent = n.sub || '';
  noticeYes.textContent = n.yesLabel || '수락';
  noticeNo.textContent = n.noLabel || '거절';
  noticeNo.hidden = n.noLabel === null;
  noticeMore.hidden = !notices.length;
  noticeMore.textContent = `+${notices.length}`;
  drawNoticeIcon(n);
  noticeEl.classList.remove('blink');
  noticeEl.style.animation = 'none';
  void noticeEl.offsetWidth;   // 같은 애니메이션을 처음부터 다시
  noticeEl.style.animation = '';
  if (!n.quiet) noticeEl.classList.add('blink');
  stopMoving();
}

function answerNotice(yes) {
  const n = noticeShown;
  noticeShown = null;
  if (n && ws && ws.readyState === WebSocket.OPEN) (yes ? n.yes : n.no)?.();
  showNextNotice();
}

function dropNotice(key) {
  const at = notices.findIndex((n) => n.key === key);
  if (at >= 0) notices.splice(at, 1);
  if (noticeShown?.key === key) showNextNotice();
  else if (noticeShown) noticeMore.hidden = !notices.length, noticeMore.textContent = `+${notices.length}`;
}

function clearNotices() {
  notices.length = 0;
  noticeShown = null;
  noticeLayer.hidden = true;
}

// 다른 탭을 보고 있으면 탭 제목을 깜박여 알린다
function flashPageTitle(title) {
  if (!document.hidden || titleFlash) return;
  let on = false;
  titleFlash = setInterval(() => {
    on = !on;
    document.title = on ? `🔔 ${title}!` : PAGE_TITLE;
  }, 800);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !titleFlash) return;
  clearInterval(titleFlash);
  titleFlash = 0;
  document.title = PAGE_TITLE;
});

// 보낸 사람이 같은 방에 있으면 그 캐릭터를, 아니면 신청의 그림을 그린다. 오른쪽 아래에 작은 표시
function drawNoticeIcon(n) {
  const c = noticeIcon.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, noticeIcon.width, noticeIcon.height);
  const who = n.look ? [...entities.values()].find(n.look) : null;
  if (who) {
    c.setTransform(2.6, 0, 0, 2.6, 64, 108);
    drawCharacter(c, { ...who, x: 0, y: 0, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: 0, emote: -1 });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  const big = !who, s = big ? 2.4 : 1, x = big ? 64 : 104, y = big ? 64 : 104;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineWidth = 2;
  c.strokeStyle = '#23203a';
  if (n.kind === 'friend') {   // 하트
    c.fillStyle = '#ff5d9e';
    c.beginPath();
    c.moveTo(0, 10);
    c.bezierCurveTo(-16, -1, -9, -15, 0, -6);
    c.bezierCurveTo(9, -15, 16, -1, 0, 10);
    c.fill();
    c.stroke();
  } else if (n.kind === 'trade') {   // 동전
    c.fillStyle = '#ffd84d';
    c.beginPath();
    c.arc(0, 0, 11, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#9a6400';
    c.fillRect(-2, -6, 4, 12);
  } else if (n.kind === 'mate') {   // 집
    c.fillStyle = '#7fdc7a';
    c.beginPath();
    c.moveTo(-11, 0);
    c.lineTo(0, -11);
    c.lineTo(11, 0);
    c.lineTo(8, 0);
    c.lineTo(8, 10);
    c.lineTo(-8, 10);
    c.lineTo(-8, 0);
    c.closePath();
    c.fill();
    c.stroke();
  } else {   // 별
    c.fillStyle = '#ffd84d';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 5 : 12;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}

noticeYes.addEventListener('click', () => answerNotice(true));
noticeNo.addEventListener('click', () => answerNotice(false));
