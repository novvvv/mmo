'use strict';
// 방명록.

// ------------------------------------------------------------ 방명록
// 집마다 방명록이 있다. 집 안에서는 오른쪽 위 「방명록」(G)으로 그 집의 것을 열고, 위의 탭으로 다른 집의 방명록도 보고 남긴다.
// 글마다 쓴 사람의 작은 캐릭터(쓸 때의 모양)를 붙인다. 내 글만 지울 수 있고, 창을 열어 두면 새 글이 바로 올라온다.

const guestEl = document.getElementById('guest');
const guestOpen = document.getElementById('guest-open');
const guestTitle = document.getElementById('guest-title');
const guestTabs = document.getElementById('guest-tabs');
const guestText = document.getElementById('guest-text');
const guestCount = document.getElementById('guest-count');
const guestList = document.getElementById('guest-list');
const guestMe = document.getElementById('guest-me');
const guestNew = document.getElementById('guest-new');
let guestLast = new Map();   // 집 구역 → 가장 최근 글 번호 (서버가 알려 준다)
let guestSeenMap = null;     // 집 구역 → 내가 본 가장 최근 글 번호 (이 브라우저에 계정마다)
let guestZone = 0;       // 보고 있는 방명록의 집 (구역)
let guestBook = null;    // 서버가 보낸 방명록 {z, n, e}
let guestSeen = new Set();   // 처음 그린 뒤 새로 올라온 글을 반짝이려고 기억한다

function guestHouses() {
  return hompyHouses().length ? hompyHouses() : [];
}

function setGuestOpen(open, zoneWanted) {
  if (!open) {
    if (!guestEl.hidden && ws && ws.readyState === WebSocket.OPEN) ws.send('guest close');
    guestEl.hidden = true;
    if (guestEl.contains(document.activeElement)) document.activeElement.blur();
    return;
  }
  const houses = guestHouses();
  if (!houses.length) return;
  const unseen = houses.find((h) => guestUnseen(h.zone));
  const target = zoneWanted ?? (houses.some((h) => h.zone === zone) && !(unseen && !guestUnseen(zone)) ? zone : unseen ? unseen.zone : houses.some((h) => h.zone === guestZone) ? guestZone : houses[0].zone);
  if (guestEl.hidden) restoreWindow(guestEl, 'guest');
  guestEl.hidden = false;
  showGuestHouse(target);
  Sound.play('page');
}

function showGuestHouse(target) {
  if (target !== guestZone) {
    guestBook = null;
    guestSeen = new Set();
  }
  guestZone = target;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`guest look ${target}`);
  renderGuest();
}

// 집에 들어갔을 때 방명록이 열려 있으면 그 집의 것으로 바꾼다
function guestZoneChanged() {
  if (!guestEl.hidden && guestZone !== zone && guestHouses().some((h) => h.zone === zone)) showGuestHouse(zone);
}

// 본 글 번호는 이 브라우저에 계정마다 남긴다. 처음 들어오면 그때까지의 글은 본 것으로 친다
function guestSeenKey() {
  return `mmo.guest.seen.${bagOwner}`;
}
function saveGuestSeen() {
  try { localStorage.setItem(guestSeenKey(), JSON.stringify(guestSeenMap)); } catch { /* 이번 접속에만 */ }
}
const guestUnseen = (z) => (guestLast.get(z) || 0) > (guestSeenMap?.[z] || 0);

function applyGuestLast(msg) {
  guestLast = new Map(msg.p);
  if (!guestSeenMap) {
    try { guestSeenMap = JSON.parse(localStorage.getItem(guestSeenKey())); } catch { guestSeenMap = null; }
    if (!guestSeenMap) {
      guestSeenMap = Object.fromEntries(msg.p);
      saveGuestSeen();
    }
  }
  updateGuestNew();
}

function updateGuestNew() {
  const any = guestHouses().some((h) => guestUnseen(h.zone)) || [...guestLast.keys()].some(guestUnseen);
  guestNew.hidden = !any;
  if (!guestEl.hidden) renderGuest();
}

function applyGuest(msg) {
  if (msg.z !== guestZone || guestEl.hidden) return;
  if (msg.e.length) {   // 이 집의 글을 다 봤다
    guestSeenMap = guestSeenMap || {};
    guestSeenMap[msg.z] = Math.max(guestSeenMap[msg.z] || 0, msg.e[0][0]);
    saveGuestSeen();
    guestNew.hidden = ![...guestLast.keys()].some(guestUnseen);
  }
  const first = !guestBook;
  guestBook = msg;
  if (first) guestSeen = new Set(msg.e.map(([id]) => id));
  renderGuest();
}

function guestTime(seconds) {
  const d = new Date(seconds * 1000), two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// 쓴 사람의 작은 캐릭터. look 은 "rgb,팔,다리,팔다리색"
function drawGuestFace(canvas, look) {
  const [rgb, arms, legs, limbColor] = look;
  const c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.setTransform(1.9, 0, 0, 1.9, canvas.width / 2, canvas.height * 0.8);
  drawCharacter(c, { x: 0, y: 0, color: `#${(rgb >>> 0).toString(16).padStart(6, '0')}`, arms, legs, limbColor, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: 0, emote: -1 });
}

function renderGuest() {
  if (guestEl.hidden) return;
  const houses = guestHouses(), house = houses.find((h) => h.zone === guestZone);
  guestTitle.textContent = `${house ? `${house.name}의 집` : ''} 방명록${guestBook ? ` (${guestBook.n})` : ''}`;
  guestTabs.replaceChildren(...houses.map((h) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.tabIndex = -1;
    tab.className = 'rtab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(h.zone === guestZone));
    tab.innerHTML = `${h.name}<small>의 집</small>`;
    if (guestUnseen(h.zone) && h.zone !== guestZone) tab.append(Object.assign(document.createElement('b'), { className: 'tab-new', textContent: 'N' }));
    tab.addEventListener('click', () => showGuestHouse(h.zone));
    return tab;
  }));
  const self = entities.get(myId);
  if (self) {
    const rgb = parseInt(String(self.color || '#ffffff').slice(1), 16);
    drawGuestFace(guestMe, [rgb, self.arms, self.legs, self.limbColor]);
  }
  guestCount.textContent = `${[...guestText.value].length} / 100`;
  if (!guestBook) {
    guestList.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: '불러오는 중…' }));
    return;
  }
  const entries = guestBook.e;
  guestList.replaceChildren(...(entries.length ? entries.map(([id, name, text, time, look, mine], i) => {
    const card = document.createElement('article');
    card.className = 'guest-entry';
    if (!guestSeen.has(id)) {
      card.classList.add('new');
      guestSeen.add(id);
    }
    const head = document.createElement('header');
    const no = document.createElement('b');
    no.textContent = `No.${guestBook.n - i}`;
    const who = document.createElement('span');
    who.textContent = name;
    const when = document.createElement('time');
    when.textContent = guestTime(time);
    head.append(no, who, when);
    if (mine) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.tabIndex = -1;
      remove.className = 'rbtn';
      remove.textContent = '삭제';
      remove.addEventListener('click', () => pushNotice({
        kind: 'info', title: '방명록', text: '이 글을 지울까요?', sub: text.length > 30 ? `${text.slice(0, 30)}…` : text, quiet: true,
        yesLabel: '지우기', noLabel: '취소', yes: () => ws.send(`guest del ${id}`),
      }));
      head.append(remove);
    }
    const body = document.createElement('div');
    body.className = 'guest-body';
    const face = document.createElement('canvas');
    face.className = 'guest-face';
    face.width = face.height = 96;
    drawGuestFace(face, look.split(',').map(Number));
    const p = document.createElement('p');
    p.textContent = text;
    body.append(face, p);
    card.append(head, body);
    return card;
  }) : [Object.assign(document.createElement('div'), { className: 'empty', textContent: '아직 방명록이 비어 있어요. 첫 글을 남겨 보세요!' })]));
}

function sendGuest() {
  const text = guestText.value.replace(/\s+/g, ' ').trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(`guest write ${guestZone} ${text}`);
  guestText.value = '';
  guestCount.textContent = '0 / 100';
}

guestOpen.addEventListener('click', () => setGuestOpen(guestEl.hidden));
document.getElementById('guest-close').addEventListener('click', () => setGuestOpen(false));
document.getElementById('guest-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sendGuest();
});
guestText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) {   // 한글을 조합하는 중의 Enter 는 글자를 끝내는 것
    e.preventDefault();
    sendGuest();
  } else if (e.key === 'Escape') {
    guestText.blur();
  }
});
guestText.addEventListener('input', () => { guestCount.textContent = `${[...guestText.value].length} / 100`; });
guestText.addEventListener('focus', () => stopMoving());
makeMovable(guestEl, document.getElementById('guest-head'), 'guest');
