'use strict';
// 함께 집중 창과 남은 시간 표시.

// ------------------------------------------------------------ 함께 집중
// 오른쪽 위 「집중」: 모임을 만들면 같은 곳에 있는 사람과 접속 중인 친구에게 모집 알림이 간다. 사람이 모이면 방장이 시간을 정해
// 시작하고, 모두 같은 타이머를 본다. 다른 탭에서 일하는 동안에도 탭 제목에 남은 시간이 보이고, 끝나면 소리와 알림으로 알린다.

const focusEl = document.getElementById('focus');
const focusOpenButton = document.getElementById('focus-open');
const focusChip = document.getElementById('focus-chip');
const focusClock = document.getElementById('focus-clock');
const focusLeft = document.getElementById('focus-left');
const focusState = document.getElementById('focus-state');
const focusBar = document.querySelector('#focus-bar i');
const focusSet = document.getElementById('focus-set');
const focusMin = document.getElementById('focus-min');
const focusMembers = document.getElementById('focus-members');
const focusMake = document.getElementById('focus-make');
const focusStart = document.getElementById('focus-start');
const focusInvite = document.getElementById('focus-invite');
const focusStop = document.getElementById('focus-stop');
const focusLeave = document.getElementById('focus-leave');
const focusOpenRooms = document.getElementById('focus-open-rooms');
const focusRoomsEl = document.getElementById('focus-rooms');
const focusHint = document.getElementById('focus-hint');
const FOCUS_MIN_KEY = 'mmo.focusMin';
const FOCUS_MAX_MIN = 180;
let focusRoom = null;    // 내가 들어가 있는 모임 { id, host, min, run, m: [[이름, 접속 중], ...], endAt }
let focusRooms = [];     // 들어갈 수 있는 모임 [[번호, 방장, 분, 사람 수, 도는 중, 남은 초], ...]
let focusListAt = 0;
let focusTitled = false; // 탭 제목에 남은 시간을 적어 둔 상태

try { focusMin.value = clamp(parseInt(localStorage.getItem(FOCUS_MIN_KEY), 10) || 25, 1, FOCUS_MAX_MIN); } catch { /* 기본 25분 */ }

function focusSend(text) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`focus ${text}`);
}

function focusMinutes() {
  return clamp(Math.round(Number(focusMin.value)) || 25, 1, FOCUS_MAX_MIN);
}

function clockText(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 끝났을 때 다른 탭에서도 알 수 있게, 모임에 들어가는 순간(버튼을 누른 때) 브라우저 알림을 허락받아 둔다
function askFocusAlert() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch { /* 알림이 없는 브라우저 */ }
}

function applyFocus(msg) {
  const was = focusRoom;
  focusRoom = msg.id ? { ...msg, endAt: performance.now() + msg.left * 1000 } : null;
  focusOpenButton.setAttribute('aria-pressed', String(!!focusRoom));
  if (focusRoom) {
    for (const n of [...notices, noticeShown]) if (n?.key?.startsWith('focus:inv')) dropNotice(n.key);
    if (!focusRoom.run && document.activeElement !== focusMin) focusMin.value = focusRoom.min;
    if (!was && focusEl.hidden) setFocusOpen(true);
  } else if (was && !focusEl.hidden) {
    requestFocusList();
  }
  renderFocus();
  tickFocus();
}

function focusInvited(msg) {
  if (focusRoom) return;
  addChatLine(`${msg.n}님이 ${msg.min}분 집중 모임을 모으고 있어요. (오른쪽 위 「집중」)`);
  pushNotice({
    kind: 'info', key: `focus:inv:${msg.id}`, title: '집중 모임', text: `${msg.n}님이 ${msg.min}분 동안 함께 집중할 사람을 모으고 있어요!`,
    sub: '같은 타이머를 켜고 각자 할 일을 해요. 끝나면 알려 드려요.', look: (e) => e.name === msg.n, yesLabel: '참가', noLabel: '다음에',
    yes: () => {
      askFocusAlert();
      focusSend(`join ${msg.id}`);
    },
  });
}

function focusDone(msg) {
  if (msg.cut) {
    addChatLine(`집중을 일찍 끝냈어요. ${msg.mine}분 동안 집중했어요.`);
    Sound.play('notify');
    return;
  }
  const hidden = document.hidden;
  addChatLine(`${msg.min}분 집중을 끝까지 해냈어요! (${msg.c}명이 함께)`);
  pushNotice({
    kind: 'info', key: 'focus:done', title: '집중 끝', text: `${msg.min}분 집중을 마쳤어요!`,
    sub: msg.c > 1 ? `${msg.c}명이 함께했어요. 잠깐 쉬고 한 번 더 할까요?` : '수고했어요. 잠깐 쉬고 한 번 더 할까요?', yesLabel: '좋아요', noLabel: null,
  });
  for (const delay of [350, 700]) setTimeout(() => Sound.play('notify'), delay);   // 다른 창에서 일하다가도 들리게 세 번
  try {
    if (hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('집중 끝!', { body: `${msg.min}분 집중을 마쳤어요.` });
  } catch { /* 알림을 만들 수 없는 브라우저 */ }
}

function requestFocusList() {
  focusListAt = performance.now();
  focusSend('list');
}

function setFocusOpen(open) {
  focusEl.hidden = !open;
  if (open) {
    restoreWindow(focusEl, 'focus');
    if (!focusRoom) requestFocusList();
    renderFocus();
    tickFocus();
    Sound.play('page');
  } else if (focusEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  tickFocus();
}

function renderFocus() {
  if (focusEl.hidden) return;
  const room = focusRoom, running = !!room?.run, host = !!room?.host;
  focusClock.hidden = !running;
  focusSet.hidden = running;
  focusMin.disabled = !!room && !host;
  for (const button of focusSet.querySelectorAll('[data-min]')) button.disabled = !!room && !host;
  focusMembers.hidden = !room;
  focusMembers.replaceChildren(...(room ? room.m.map(([name, on], i) => {
    const li = document.createElement('li');
    li.className = on ? '' : 'off';
    const dot = document.createElement('i');
    dot.className = `friend-dot${on ? ' on' : ''}`;
    const label = document.createElement('span');
    label.textContent = name;
    const note = document.createElement('small');
    note.textContent = `${i === 0 ? '방장' : ''}${on ? '' : `${i === 0 ? ' · ' : ''}잠시 끊김`}`;
    li.append(dot, label, note);
    return li;
  }) : []));
  focusMake.hidden = !!room;
  focusStart.hidden = !room || running || !host;
  focusInvite.hidden = !room || running || !host;
  focusStop.hidden = !running || !host;
  focusLeave.hidden = !room;
  focusOpenRooms.hidden = !!room;
  if (!room) {
    focusRoomsEl.replaceChildren(...(focusRooms.length ? focusRooms.map(([id, name, min, count, run, left]) => {
      const row = document.createElement('div');
      row.className = 'friend-row';
      const label = document.createElement('span');
      label.className = 'friend-name';
      label.textContent = `${name}님의 모임`;
      const where = document.createElement('small');
      where.className = 'friend-where';
      where.textContent = `${count}명 · ${run ? `${Math.ceil(left / 60)}분 남음` : `${min}분 · 모으는 중`}`;
      const actions = document.createElement('div');
      actions.className = 'friend-actions';
      actions.append(friendButton('참가', () => {
        askFocusAlert();
        focusSend(`join ${id}`);
      }));
      row.append(label, actions, where);
      return row;
    }) : [Object.assign(document.createElement('div'), { className: 'empty', textContent: '지금 열려 있는 모임이 없어요.' })]));
  }
  focusHint.textContent = !room ? '모임을 만들면 같은 곳에 있는 사람과 접속 중인 친구에게 모집 알림이 가요.'
    : running ? '다른 탭에서 일해도 괜찮아요. 탭 제목에 남은 시간이 보이고, 끝나면 소리로 알려 드려요.'
    : host ? '사람이 모이면 시간을 정하고 「집중 시작」을 눌러요. 혼자서도 시작할 수 있어요.'
    : `방장이 시작하면 ${room.min}분 타이머가 켜져요.`;
}

// 0.5초마다: 남은 시간을 창, 화면 위 표시, 탭 제목에 적는다. 다른 탭을 보고 있어도 돈다
function tickFocus() {
  const running = !!focusRoom?.run;
  const left = running ? (focusRoom.endAt - performance.now()) / 1000 : 0;
  const text = clockText(left);
  if (running && !focusEl.hidden) {
    focusLeft.textContent = text;
    focusState.textContent = `${focusRoom.min}분 집중하는 중 · ${focusRoom.m.length}명`;
    focusBar.style.width = `${clamp(100 - (left / (focusRoom.min * 60)) * 100, 0, 100)}%`;
  }
  const chip = running ? `⏱ ${text} 집중하는 중` : focusRoom && focusEl.hidden ? `집중 모임 ${focusRoom.m.length}명 · 모으는 중` : '';
  const showChip = !!chip && focusEl.hidden;
  if (focusChip.hidden === showChip) focusChip.hidden = !showChip;
  if (showChip && focusChip.textContent !== chip) focusChip.textContent = chip;
  if (running && !titleFlash) {
    document.title = `⏱ ${text} 집중 중`;
    focusTitled = true;
  } else if (focusTitled && !running) {
    focusTitled = false;
    if (!titleFlash) document.title = PAGE_TITLE;
  }
  if (!focusRoom && !focusEl.hidden && performance.now() - focusListAt > 5000) requestFocusList();
}
setInterval(tickFocus, 500);

function setFocusMinutes(value) {
  focusMin.value = clamp(Math.round(Number(value)) || 25, 1, FOCUS_MAX_MIN);
  try { localStorage.setItem(FOCUS_MIN_KEY, focusMin.value); } catch { /* 이번 접속에만 */ }
  if (focusRoom?.host && !focusRoom.run) focusSend(`mins ${focusMin.value}`);
}

focusOpenButton.addEventListener('click', () => setFocusOpen(focusEl.hidden));
focusChip.addEventListener('click', () => setFocusOpen(true));
document.getElementById('focus-close').addEventListener('click', () => setFocusOpen(false));
for (const button of focusSet.querySelectorAll('[data-min]')) {
  button.addEventListener('click', () => {
    button.blur();
    setFocusMinutes(button.dataset.min);
  });
}
focusMin.addEventListener('focus', () => stopMoving());
focusMin.addEventListener('change', () => setFocusMinutes(focusMin.value));
focusMin.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  focusMin.blur();   // change 가 값을 보낸다
});
focusMake.addEventListener('click', () => {
  focusMake.blur();
  askFocusAlert();
  setFocusMinutes(focusMin.value);
  focusSend(`open ${focusMinutes()}`);
});
focusStart.addEventListener('click', () => {
  focusStart.blur();
  askFocusAlert();
  focusSend(`start ${focusMinutes()}`);
});
focusInvite.addEventListener('click', () => {
  focusInvite.blur();
  focusSend('invite');
  addChatLine('모집 알림을 다시 보냈어요.');
});
focusStop.addEventListener('click', () => {
  focusStop.blur();
  pushNotice({ kind: 'info', key: 'focus:stop', title: '집중 끝내기', text: '모두의 타이머를 지금 끝낼까요?', sub: '지금까지 집중한 시간은 기록에 남아요.', quiet: true, yesLabel: '끝내기', noLabel: '계속하기', yes: () => focusSend('stop') });
});
focusLeave.addEventListener('click', () => {
  focusLeave.blur();
  focusSend('leave');
});
makeMovable(focusEl, document.getElementById('focus-head'), 'focus');
