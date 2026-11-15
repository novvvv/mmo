'use strict';
// 키보드와 마우스, 휴대폰의 조이스틱과 버튼.

// ------------------------------------------------------------ 입력

function setInput(next) {
  if (next === input) return;
  input = next;
  if (ws && ws.readyState === WebSocket.OPEN && myId !== null) ws.send('in ' + input);
}

// 글자를 입력하러 가거나 창을 떠나면 눌린 방향을 모두 놓는다.
function stopMoving() {
  keyBits = 0;
  releaseStick();
  setInput(0);
}

// 키보드와 터치 버튼이 함께 쓰는 키 처리. 터치 버튼은 code 와 key 만 채운 가짜 이벤트를 넘긴다.
function handleKey(e) {
  if (myId === null) return;
  const field = document.activeElement;
  if (field === chatInput || field === boardInput || field === tvUrl || field === tradeGold || field === jazzUrl || field === cinemaInput || field === todoInput || field === friendsName || field === guestText || field?.classList?.contains('todo-edit')) {  // 글자를 입력하는 중에는 WASD 가 글자로 입력되어야 한다
    if (e.key === 'Escape') {
      if (field === boardInput) boardInput.value = sentBoard.text;  // 고치던 문구를 버린다
      field.blur();
    }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;  // Cmd+F 같은 브라우저 단축키는 건드리지 않는다
  if (e.key === 'Escape' && !themeMenu.hidden) {   // 창 테마 메뉴부터 닫는다
    setThemeMenu(null);
    return;
  }
  if (e.key === 'Escape' && noticeShown) {   // 가운데 알림창: Esc 는 거절(알림이면 닫기)
    answerNotice(false);
    return;
  }
  if (e.key === 'Escape' && !friendsEl.hidden) {
    setFriendsOpen(false);
    return;
  }
  if (e.key === 'Escape' && !focusEl.hidden) {
    setFocusOpen(false);
    return;
  }
  if (e.key === 'Escape' && farmEscape()) return;
  if (e.key === 'Escape' && !guestEl.hidden) {
    setGuestOpen(false);
    return;
  }
  if (e.key === 'Escape' && !guideEl.hidden) {   // 체스판 창 위에 펼친 설명서를 먼저 닫는다
    setChessGuideOpen(false);
    return;
  }
  if (arcadeKey(e, true)) return;
  if (pachiKey(e, true)) return;
  if (field === lightLevel && e.code.startsWith('Arrow')) return;  // Tab 으로 슬라이더에 왔으면 방향키는 밝기 조절
  if (e.key === 'Enter') {
    e.preventDefault();  // 이 Enter 가 포커스된 입력창에서 바로 전송되지 않게
    if (cinemaFull && cinemaHud.hidden) {   // 채팅을 꺼 둔 채 Enter 를 누르면 다시 켠다
      cinemaChatHidden = false;
      saveSetting(CINEMA_CHAT_KEY, '0');
      paintCinemaMode();
    }
    (cinemaFull ? cinemaInput : chatInput).focus();
    return;
  }
  if (e.key === 'Escape' && !shareCropEl.hidden) {
    cancelShareCrop();
    return;
  }
  if (e.key === 'Escape' && cinemaFull) {
    setCinemaFull(false);
    return;
  }
  if (e.key === 'Escape' && !furnShop.hidden) {
    setFurnShop(false);
    return;
  }
  if (e.key === 'Escape' && moveItem) {   // 집어 든 가구만 내려놓고 옮기기 모드는 그대로
    moveItem = null;
    renderDecorPanel();
    return;
  }
  if (e.key === 'Escape' && (decorPlacing >= 0 || decorTaking || decorMoving || decorTurning || decorSizing)) {
    setDecorPlacing(-1);
    setDecorTaking(false);
    setDecorMoving(false);
    setDecorTurning(false);
    setDecorSizing(false);
    return;
  }
  if (e.key === 'Escape' && !posterView.hidden) {
    posterView.hidden = true;
    return;
  }
  if (e.key === 'Escape' && !shopEl.hidden) {
    closeShop();
    return;
  }
  if (e.key === 'Escape' && !omokEl.hidden) {
    setOmokOpen(false);
    return;
  }
  if (e.key === 'Escape' && !profileEl.hidden) {
    profileEl.hidden = true;
    return;
  }
  if (e.code === 'KeyP' && !atPiano(entities.get(myId))) {   // 내 정보 (피아노에 앉아 있으면 건반)
    if (!e.repeat) toggleProfile();
    return;
  }
  if (e.key === 'Escape' && !dartsEl.hidden) {
    setDartsOpen(false);
    return;
  }
  if (e.code === 'Space' && !dartsEl.hidden && myDartTurn()) {
    e.preventDefault();
    if (!e.repeat) dartLock();
    return;
  }
  if (e.key === 'Escape' && jazzPanelOpen) {
    setJazzPanel(false);
    return;
  }
  if (e.key === 'Escape' && !bagEl.hidden) {  // 다른 게임처럼 Esc 는 열린 창부터 닫는다
    setBagOpen(false);
    return;
  }
  if (e.code === 'KeyI') {  // 건반에도 쓰지 않는 키라 어디서나 열 수 있다
    if (!e.repeat) setBagOpen(bagEl.hidden);
    return;
  }
  if (atPiano(entities.get(myId))) {  // 의자에 앉아 있으면 글자 키는 게임 조작 대신 건반이다
    if (e.key === 'Escape') {
      if (!e.repeat && ws.readyState === WebSocket.OPEN) ws.send('use');
      return;
    }
    const note = PIANO_NOTE_BY_CODE.get(e.code);
    if (note !== undefined) {
      e.preventDefault();
      if (!e.repeat) pressPiano(note);
      return;
    }
  }
  if (e.code === 'KeyJ') {  // 할 일 공책 (피아노에 앉아 있으면 건반)
    if (!e.repeat) setTodoOpen(todoEl.hidden);
    return;
  }
  if (e.code === 'KeyG') {  // 방명록 (집 안이면 그 집의 것)
    if (!e.repeat) setGuestOpen(guestEl.hidden);
    return;
  }
  if (e.code === 'KeyB') {  // 곳간: 농장에서 거둔 것과 만든 요리
    if (!e.repeat) setFarmOpen(farmEl.hidden || farmTab !== 'store', 'store');
    return;
  }
  if (e.code === 'KeyN') {  // 친구 창
    if (!e.repeat) setFriendsOpen(friendsEl.hidden);
    return;
  }
  if (e.code === 'KeyH') {  // 소지품 창을 가구 탭으로 연다
    if (!e.repeat) setBagOpen(bagEl.hidden || bagTab !== 'furn', 'furn');
    return;
  }
  const action = ACTION_KEYS[e.code];
  if (action) {
    if (e.repeat) return;
    const self = selfNow();
    if (action === 'use') {
      useNearest();
    } else if (action === 'lamp') {  // 스탠드는 L: 의자 옆에 있어도 앉기와 겹치지 않는다
      if (self && lampHint(self) && ws.readyState === WebSocket.OPEN) ws.send('lamp');
    } else if (action === 'tv') {    // TV 는 T: 소파에 앉은 채로도 연다
      if (self && tvInReach(self)) {
        if (tvPanelOpen) closeTvPanel();
        else openTvPanel();
      }
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(action);
    }
    return;
  }
  const bit = KEYMAP[e.code];
  if (!bit) return;
  e.preventDefault();
  keyBits |= bit;
  setInput(keyBits | padBits);
}
addEventListener('keydown', handleKey);
addEventListener('keyup', (e) => {
  if (arcadeKey(e, false)) return;
  if (pachiKey(e, false)) return;
  const bit = KEYMAP[e.code];
  if (!bit) return;
  keyBits &= ~bit;
  setInput(keyBits | padBits);
});
addEventListener('blur', () => stopMoving());  // 창 포커스를 잃으면 키가 눌린 채로 남지 않게

// ------------------------------------------------------------ 터치 조작
// 휴대폰과 태블릿: 왼쪽 조이스틱으로 걷고, 오른쪽 버튼으로 E, F, Z 같은 키를 대신 누른다.
// 버튼은 캐릭터 아래에 뜨는 안내(actionHint)를 그대로 옮긴 것이라 키보드와 하는 일이 같다.

const touchPad = document.getElementById('touch-pad');
const stick = document.getElementById('stick');
const stickKnob = document.getElementById('stick-knob');
const touchActions = document.getElementById('touch-actions');
const STICK_DEAD = 12;   // 이만큼은 밀어야 걷기 시작한다 (px)
const STICK_REACH = 44;  // 손잡이가 움직이는 반경 (px)
const STICK_DIRS = [8, 2 | 8, 2, 2 | 4, 4, 1 | 4, 1, 1 | 8];  // 오른쪽부터 시계 방향 8방향. 비트는 KEYMAP 과 같다
const HINT_CODES = { E: 'KeyE', L: 'KeyL', T: 'KeyT', F: 'KeyF', C: 'KeyC', X: 'KeyX', H: 'KeyH', Esc: 'Escape' };
let touchMode = false;
let stickPointer = null;
let touchActionsKey = null;  // 지금 그려 둔 버튼 목록. 같으면 다시 만들지 않는다

function enableTouch() {
  if (touchMode) return;
  touchMode = true;
  document.body.classList.add('touch');
  chatInput.placeholder = '눌러서 채팅';
  cinemaInput.placeholder = '채팅';
}
if (matchMedia('(pointer: coarse)').matches) enableTouch();
addEventListener('touchstart', enableTouch, { once: true, passive: true });

// 조이스틱과 버튼은 채팅창 바로 위에, 좁은 화면의 위쪽 안내는 소리 버튼 왼쪽까지만 쓰도록 크기를 CSS 에 알려 준다.
new ResizeObserver(() => document.documentElement.style.setProperty('--chat-h', `${chatEl.offsetHeight}px`)).observe(chatEl);
new ResizeObserver(() => document.documentElement.style.setProperty('--sound-w', `${soundBar.offsetWidth}px`)).observe(soundBar);

function moveStick(e) {
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  padBits = d < STICK_DEAD ? 0 : STICK_DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  const k = d > STICK_REACH ? STICK_REACH / d : 1;
  stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  setInput(keyBits | padBits);
}

function releaseStick() {
  stickPointer = null;
  padBits = 0;
  stickKnob.style.transform = '';
  stick.classList.remove('held');
}

stick.addEventListener('pointerdown', (e) => {
  if (myId === null || stickPointer !== null) return;
  e.preventDefault();
  stickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  stick.classList.add('held');
  moveStick(e);
});
stick.addEventListener('pointermove', (e) => {
  if (e.pointerId === stickPointer) moveStick(e);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick.addEventListener(type, (e) => {
    if (e.pointerId !== stickPointer) return;
    releaseStick();
    setInput(keyBits);
  });
}

// 안내 문구 "E: 앉기 · F: 낚시" 를 [키, 글자] 목록으로 바꾼다.
function touchActionList(self) {
  if (self.fish === 2) return [['KeyF', '건지기!']];
  const list = [];
  for (const part of actionHint(self).split(' · ')) {
    const m = /^(\w+): (.+)$/.exec(part);
    if (m && HINT_CODES[m[1]]) list.push([HINT_CODES[m[1]], m[2]]);
  }
  return list;
}

function pressTouchKey(code) {
  handleKey({ code, key: code === 'Escape' ? 'Escape' : code.slice(3).toLowerCase(), repeat: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault() {} });
}

touchActions.addEventListener('pointerdown', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  e.preventDefault();  // 버튼이 포커스를 가져가거나 두 번 눌러 확대되지 않게
  pressTouchKey(button.dataset.code);
});

function syncTouchPad() {
  const field = document.activeElement;
  const typing = field && (field.tagName === 'TEXTAREA' || (field.tagName === 'INPUT' && !['range', 'checkbox', 'radio'].includes(field.type)));
  const show = touchMode && myId !== null && me !== null && !!terrain && !typing && !cinemaFull && !pachiOpen && !offline;
  if (touchPad.hidden === show) touchPad.hidden = !show;
  if (!show) {
    if (stickPointer !== null) {
      releaseStick();
      setInput(keyBits);
    }
    return;
  }
  const e = entities.get(myId);
  const list = e ? touchActionList({ ...e, x: me.x, y: me.y }) : [];
  const key = list.map(([code, label]) => code + label).join('|');
  if (key === touchActionsKey) return;
  touchActionsKey = key;
  touchActions.textContent = '';
  // 아래부터 쌓인다: 맨 아래가 엄지에 가장 가까운 주 동작이고, 맨 위는 가방이다.
  list.forEach(([code, label], i) => touchActions.append(touchButton(code, label, i === 0 ? (code === 'KeyF' && e.fish === 2 ? 'main urgent' : 'main') : '')));
  touchActions.append(touchButton('KeyI', '가방', 'bag'));
}

function touchButton(code, label, kind) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.dataset.code = code;
  button.className = kind;
  button.textContent = label;
  return button;
}
