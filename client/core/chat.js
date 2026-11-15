'use strict';
// 채팅, 감정표현, 머리 위 광고판(기본과 도트).

// ------------------------------------------------------------ 채팅

// name 이 없으면 시스템 메시지로 표시한다. 사용자 입력은 textContent 로만 넣는다.
// 어두운 채팅창에서도 읽히도록 어두운 색은 밝혀서 쓴다.
function chatNameColor(color) {
  const [r, g, b] = [1, 3, 5].map((from) => parseInt(color.slice(from, from + 2), 16));
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness < 150 ? mixColor(color, '#ffffff', (150 - brightness) / (255 - brightness)) : color;
}

function addChatLine(text, name, color) {
  const atBottom = isChatCollapsed() || chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 24;
  const line = document.createElement('div');
  if (name === undefined) {
    line.className = 'sys';
    line.textContent = text;
  } else {
    const who = document.createElement('b');
    who.textContent = name + ': ';
    who.style.color = chatNameColor(color);
    line.append(who, text);
  }
  chatLog.append(line);
  while (chatLog.childElementCount > MAX_CHAT_LINES) chatLog.firstElementChild.remove();
  if (atBottom) chatLog.scrollTop = chatLog.scrollHeight;
}

// 한글 조합 중 Enter 가 두 번 처리되지 않도록 keydown 대신 form submit 으로 전송한다.
chatEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text && ws && ws.readyState === WebSocket.OPEN) ws.send('chat ' + text);
  chatInput.value = '';
  chatInput.blur();
});
chatInput.addEventListener('focus', () => stopMoving());  // 이동 중에 채팅을 열면 멈춘다

function isChatCollapsed() {
  return chatEl.classList.contains('collapsed');
}

function setUnread(count) {
  unreadChats = count;
  chatUnread.hidden = count === 0;
  chatUnread.textContent = count > 99 ? '99+' : String(count);
}

function setChatCollapsed(collapsed) {
  chatEl.classList.toggle('collapsed', collapsed);
  const action = collapsed ? '채팅창 펼치기' : '채팅창 접기';
  chatToggle.title = action;
  chatToggle.setAttribute('aria-label', action);
  chatToggle.setAttribute('aria-expanded', String(!collapsed));
  if (!collapsed) {
    setUnread(0);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

// 마우스로 누른 컨트롤에 포커스가 남으면 다음 키 입력이 게임 대신 그 컨트롤로 간다.
function releaseFocus(el) {
  if (!el.matches(':focus-visible')) el.blur();
}

chatToggle.addEventListener('click', () => {
  const collapsed = !isChatCollapsed();
  setChatCollapsed(collapsed);
  try { localStorage.setItem(CHAT_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* 저장을 막아 둔 브라우저에서는 이번 접속에만 적용 */ }
  releaseFocus(chatToggle);
});

try { setChatCollapsed(localStorage.getItem(CHAT_COLLAPSED_KEY) === '1'); } catch { /* 저장을 막아 둔 브라우저는 펼친 채로 시작 */ }

// ------------------------------------------------------------ 광고판

const graphemes = typeof Intl.Segmenter === 'function'
  ? ((segmenter) => (text) => Array.from(segmenter.segment(text), (part) => part.segment))(new Intl.Segmenter('ko', { granularity: 'grapheme' }))
  : (text) => Array.from(text);

// 문구를 줄바꿈하고 크기를 계산해 둔다. 글자 폭을 재는 일은 문구가 바뀔 때만 한다.
// style 0 은 둥근 말풍선, 1 은 도트 글꼴의 각진 팻말이다. 모양마다 글자 폭이 달라 줄을 따로 나눈다.
function layoutBoard(text, style = 0) {
  ctx.font = style === 1 ? BOARD_PIXEL_FONT : BOARD_FONT;
  const chars = graphemes(text);
  const widthOf = (from, to, suffix = '') => ctx.measureText(chars.slice(from, to).join('') + suffix).width;
  const lines = [];
  let start = 0, lastStart = 0, lastEnd = 0;
  while (start < chars.length && lines.length < BOARD_MAX_LINES) {
    let end = start + 1;
    while (end < chars.length && widthOf(start, end + 1) <= BOARD_MAX_WIDTH) end++;
    if (end < chars.length) {
      const space = chars.lastIndexOf(' ', end);  // 되도록 띄어쓰기에서 끊는다
      if (space > start) end = space;
    }
    lines.push(chars.slice(start, end).join(''));
    lastStart = start;
    lastEnd = end;
    start = end;
    while (chars[start] === ' ') start++;
  }
  if (start < chars.length) {  // 다 못 담으면 마지막 줄을 말줄임으로 끝낸다
    let end = lastEnd;
    while (end > lastStart + 1 && widthOf(lastStart, end, '…') > BOARD_MAX_WIDTH) end--;
    lines[lines.length - 1] = chars.slice(lastStart, end).join('') + '…';
  }
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  return {
    lines,
    style,
    w: Math.max(BOARD_MIN_WIDTH, Math.ceil(widest) + BOARD_PAD_X * 2),
    h: lines.length * BOARD_LINE_HEIGHT + BOARD_PAD_Y * 2 + (style === 1 ? 3 : 0),
  };
}

function setBoard(id, text, style = 0) {
  if (text) boards.set(id, layoutBoard(text, style === 1 ? 1 : 0));
  else boards.delete(id);
}

// 서버가 확인해 준 내 광고판을 스위치와 입력창에 반영한다. 입력 중인 글자는 건드리지 않는다.
function applyMyBoard(msg) {
  sentBoard = { on: msg.on, text: msg.m };
  const style = document.querySelector(`input[name="board-style"][value="${msg.s === 1 ? 1 : 0}"]`);
  if (style) style.checked = true;
  boardSwitch.checked = msg.on;
  if (document.activeElement !== boardInput) boardInput.value = msg.m;
}

function sendBoard(on, text) {
  if (on === sentBoard.on && text === sentBoard.text) return;
  sentBoard = { on, text };
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`board ${on ? 1 : 0} ${text}`);
}

boardSwitch.addEventListener('change', () => {
  const text = boardInput.value.trim();
  if (boardSwitch.checked && !text) {  // 띄울 문구부터 입력받는다
    boardSwitch.checked = false;
    boardInput.focus();
    return;
  }
  sendBoard(boardSwitch.checked, text);
  releaseFocus(boardSwitch);
});

// 한글 조합 중 Enter 가 두 번 처리되지 않도록 채팅처럼 form submit 으로 받는다.
boardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = boardInput.value.trim();
  boardInput.value = text;
  boardSwitch.checked = !!text;
  sendBoard(!!text, text);
  boardInput.blur();
});
boardInput.addEventListener('focus', () => stopMoving());
boardInput.addEventListener('blur', () => {  // 다른 곳을 눌러 빠져나가도 고친 문구를 잃지 않는다
  const text = boardInput.value.trim();
  sendBoard(boardSwitch.checked && !!text, text);
});

// ------------------------------------------------------------ 도트 광고판

// 계단처럼 깎은 모서리, 굵은 테두리, 주인 몸 색의 띠와 작은 별·하트로 꾸민 팻말
function drawPixelBoard(e, board) {
  const { lines, w, h } = board;
  const side = seatSide(e);
  const left = Math.round(side < 0 ? e.x + 14 - w : side > 0 ? e.x - 14 : e.x - w / 2);
  const top = Math.round(headStack(e) + 1);
  const tipX = Math.round(clamp(e.x, left + 10, left + w - 10));
  const ink = '#23203a';
  const body = (dx, dy, color) => {   // 모서리를 2px 씩 깎은 사각형
    ctx.fillStyle = color;
    ctx.fillRect(left + dx + 4, top + dy, w - 8, h);
    ctx.fillRect(left + dx + 2, top + dy + 2, w - 4, h - 4);
    ctx.fillRect(left + dx, top + dy + 4, w, h - 8);
  };
  ctx.save();
  body(3, 3, 'rgba(20, 16, 40, 0.35)');          // 그림자
  ctx.fillStyle = ink;                             // 테두리: 같은 계단 모양을 2px 넓게
  ctx.fillRect(left + 2, top - 2, w - 4, h + 4);
  ctx.fillRect(left, top, w, h);
  ctx.fillRect(left - 2, top + 2, w + 4, h - 4);
  body(0, 0, '#fffbe6');
  ctx.fillStyle = e.color || '#ff5d9e';            // 위쪽 띠는 주인 몸 색
  ctx.fillRect(left + 4, top + 2, w - 8, 3);
  ctx.fillStyle = ink;                             // 계단 꼬리
  for (let i = 0; i < 4; i++) ctx.fillRect(tipX - 4 + i, top + h + i * 2, 8 - i * 2, 2);
  ctx.fillStyle = '#fffbe6';
  for (let i = 0; i < 3; i++) ctx.fillRect(tipX - 2 + i, top + h - 2 + i * 2, 4 - i * 2, 2);
  pixelIcon(PIXEL_HEART, left + 3, top - 5, '#ff5d9e');
  pixelIcon(PIXEL_STAR, left + w - 9, top - 5, '#ffd84d');
  ctx.font = BOARD_PIXEL_FONT;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, left + w / 2, top + 3 + BOARD_PAD_Y + BOARD_LINE_HEIGHT * (i + 0.5) + 0.5));
  ctx.restore();
}

const PIXEL_HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const PIXEL_STAR = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '#.....#'];
function pixelIcon(rows, x, y, color) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue;
      ctx.fillStyle = '#23203a';
      ctx.fillRect(x + i - 0.5, y + j - 0.5, 2, 2);
    }
  });
  ctx.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
  });
}

for (const input of document.querySelectorAll('input[name="board-style"]')) {
  input.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(`boardstyle ${input.value}`);
    releaseFocus(input);
  });
}

// ---- 감정표현: 상점의 감정표현 탭과 채팅창의 표정 버튼
const emoteList = document.getElementById('emote-list');
const chatEmoteButton = document.getElementById('chat-emote');
const chatEmoteMenu = document.getElementById('chat-emotes');
const emoteCells = [];
const EMOTE_PREVIEW_MS = 80;

function hasEmote(i) {
  return i < EMOTE_FREE || !!(myEmotes & (1 << i));
}

function doEmote(i) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`chat ${EMOTES[i][0]}`);
}

function buildEmoteShop() {
  if (emoteCells.length || !terrain) return;
  EMOTES.forEach(([cmd, line], i) => {
    const cell = document.createElement('div');
    cell.className = 'furn-cell emote-cell';
    const face = document.createElement('canvas');
    face.width = 168;
    face.height = 152;
    const name = document.createElement('div');
    name.textContent = cmd.slice(1);
    const what = document.createElement('small');
    what.textContent = line;
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn';
    button.addEventListener('click', () => {
      button.blur();
      if (hasEmote(i)) doEmote(i);
      else ws.send(`buyemote ${i}`);
    });
    cell.append(face, name, what, button);
    emoteList.append(cell);
    emoteCells.push({ cell, face, button });
  });
}

function refreshEmoteShop() {
  const prices = terrain?.emotePrices || [];
  emoteCells.forEach(({ cell, button }, i) => {
    const owned = hasEmote(i);
    cell.classList.toggle('owned', owned);
    button.disabled = !owned && myGold < (prices[i] || 0);
    button.textContent = owned ? '해 보기' : prices[i] ? `${prices[i]} G` : '무료로 받기';
  });
  renderEmoteMenu();
}

// 상점을 펴 둔 동안 내 캐릭터가 표정을 짓는 모습을 칸마다 보여 준다.
setInterval(() => {
  if (furnShop.hidden || shopTab !== 'emotes' || !emoteCells.length) return;
  const self = entities.get(myId);
  if (!self) return;
  const now = performance.now();
  emoteCells.forEach(({ face }, i) => {
    const c = face.getContext('2d');
    c.clearRect(0, 0, face.width, face.height);
    c.save();
    c.scale(2, 2);
    drawCharacter(c, { ...self, x: 42, y: 52, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: now, emote: i, emoteT: now % EMOTE_MS });
    c.restore();
  });
}, EMOTE_PREVIEW_MS);

function renderEmoteMenu() {
  if (chatEmoteMenu.hidden) return;
  chatEmoteMenu.textContent = '';
  EMOTES.forEach(([cmd], i) => {
    if (!hasEmote(i)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.setAttribute('role', 'menuitem');
    button.textContent = cmd.slice(1);
    button.addEventListener('click', () => {
      doEmote(i);
      setEmoteMenu(false);
    });
    chatEmoteMenu.append(button);
  });
  const more = document.createElement('button');
  more.type = 'button';
  more.tabIndex = -1;
  more.className = 'more';
  more.textContent = '상점에서 더 구하기 ›';
  more.addEventListener('click', () => {
    setEmoteMenu(false);
    shopTab = 'emotes';
    setFurnShop(true, true);
  });
  chatEmoteMenu.append(more);
}

function setEmoteMenu(open) {
  chatEmoteMenu.hidden = !open;
  chatEmoteButton.setAttribute('aria-expanded', String(open));
  if (open) {
    setChatSkinMenu(false);
    renderEmoteMenu();
  }
}
chatEmoteButton.addEventListener('click', () => {
  chatEmoteButton.blur();
  setEmoteMenu(chatEmoteMenu.hidden);
});
addEventListener('pointerdown', (e) => {
  if (!chatEmoteMenu.hidden && !chatEmoteMenu.contains(e.target) && e.target !== chatEmoteButton) setEmoteMenu(false);
});
