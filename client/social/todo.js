'use strict';
// 날짜별 할 일 공책.

// ------------------------------------------------------------ 할 일
// 날짜마다 적는 할 일 공책. J 나 오른쪽 위 「할 일」로 켜고 끄며, 켜 둔 채 나가면 다음에 들어와도 켜져 있다.
// 위의 달력(▦ 로 접고 펴기)에서 날짜를 고르면 그날의 할 일을 보고 적는다. 달력 칸의 분홍 숫자는 남은 일, 초록 ✓ 는 다 한 날.
// 맨 위 탭은 「나」와 친구들: 누르면 그 친구의 달력과 할 일을 읽기 전용으로 보고, 친구가 고치면 바로 바뀐다.

const todoEl = document.getElementById('todo');
const todoOpen = document.getElementById('todo-open');
const todoTitle = document.getElementById('todo-title');
const todoTabs = document.getElementById('todo-tabs');
const todoCalToggle = document.getElementById('todo-cal-toggle');
const todoLabel = document.getElementById('todo-label');
const todoGrid = document.getElementById('todo-grid');
const todoDateEl = document.getElementById('todo-date');
const todoOwner = document.getElementById('todo-owner');
const todoProgress = document.getElementById('todo-progress');
const todoList = document.getElementById('todo-list');
const todoEmpty = document.getElementById('todo-empty');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoFoot = document.getElementById('todo-foot');
const todoShare = document.getElementById('todo-share');
const TODO_OPEN_KEY = 'mmo.todo.open';
const TODO_CAL_KEY = 'mmo.todo.calendar';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
let myTodo = { n: '', sh: 1, i: [] };   // 서버가 보낸 내 할 일. i 는 [글, 다 했는지, 날짜 yyyymmdd]
let friendTodo = null;                  // 보고 있는 친구의 할 일 (없으면 내 것)
let todoRestored = false;
let todoSentToday = 0;                  // 서버에 알린 오늘 (친구 목록의 "오늘 할 일" 을 센다)
const todoMoving = new Set();           // 날짜가 없던 예전 할 일을 오늘로 옮기는 중
let todoCalendar = true;
try { todoCalendar = localStorage.getItem(TODO_CAL_KEY) !== '0'; } catch { /* 저장을 막아 둔 브라우저 */ }
let todoDrag = null;                    // ⋮⋮ 를 잡고 끄는 중인 할 일 (startTodoDrag)

const dateNumber = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const todayNumber = () => dateNumber(new Date());
const dateOf = (n) => new Date(Math.floor(n / 10000), (Math.floor(n / 100) % 100) - 1, n % 100);
function shiftDay(n, days) {
  const d = dateOf(n);
  d.setDate(d.getDate() + days);
  return dateNumber(d);
}
function shiftMonth(ym, months) {
  const d = new Date(Math.floor(ym / 100), (ym % 100) - 1 + months, 1);
  return d.getFullYear() * 100 + d.getMonth() + 1;
}
function dayLabel(n) {
  const d = dateOf(n);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}
let todoDay = todayNumber();                 // 고른 날
let todoMonth = Math.floor(todoDay / 100);   // 달력에 보이는 달 (yyyymm)

// 자정이 지나면 서버에 새 오늘을 알리고, 오늘을 보고 있었으면 새 오늘로 넘긴다
function syncToday() {
  const today = todayNumber();
  if (today === todoSentToday || !ws || ws.readyState !== WebSocket.OPEN || myId === null) return;
  const was = todoSentToday;
  todoSentToday = today;
  ws.send(`todo today ${today}`);
  if (was && todoDay === was) {
    todoDay = today;
    todoMonth = Math.floor(today / 100);
    renderTodo();
  }
}
setInterval(syncToday, 30000);

function applyTodo(msg) {
  if (msg.own) {
    myTodo = msg;
    syncToday();
    // 날짜가 없던 예전 할 일은 오늘 할 일로 옮긴다
    msg.i.forEach(([, , date], i) => {
      if (date || todoMoving.has(i) || todoMoving.size >= 6) return;
      todoMoving.add(i);
      ws.send(`todo date ${i} ${todayNumber()}`);
    });
    if (!msg.i.some(([, , date]) => !date)) todoMoving.clear();
  } else if (!friendTodo || friendTodo.n === msg.n) {
    friendTodo = msg;
  }
  if (!todoRestored) {   // 접속하고 처음: 켜 두었던 공책을 다시 켠다
    todoRestored = true;
    let saved = false;
    try { saved = localStorage.getItem(TODO_OPEN_KEY) === '1'; } catch { /* 저장을 막아 둔 브라우저 */ }
    if (saved && todoEl.hidden) setTodoOpen(true, false);
  }
  renderTodo();
}

function setTodoOpen(open, remember = true) {
  if (!open && friendTodo) showMyTodo();
  if (open && todoEl.hidden) restoreWindow(todoEl, 'todo');
  todoEl.hidden = !open;
  todoOpen.setAttribute('aria-pressed', String(open));
  if (remember) {
    try { localStorage.setItem(TODO_OPEN_KEY, open ? '1' : '0'); } catch { /* 이번 접속에만 */ }
  }
  if (!open && todoEl.contains(document.activeElement)) document.activeElement.blur();
  renderTodo();
}

function showMyTodo() {
  if (!friendTodo) return;
  friendTodo = null;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send('friend unwatch');
  renderTodo();
}

function openFriendTodo(i) {
  const friend = myFriends[i];
  if (!friend || !ws || ws.readyState !== WebSocket.OPEN) return;
  friendTodo = { n: friend[0], on: friend[1] ? 1 : 0, sh: 1, i: [], loading: true };
  ws.send(`friend todo ${i}`);
  renderTodo();
}

function setTodoCalendar(on) {
  todoCalendar = on;
  try { localStorage.setItem(TODO_CAL_KEY, on ? '1' : '0'); } catch { /* 이번 접속에만 */ }
  if (on) todoMonth = Math.floor(todoDay / 100);
  renderTodo();
}

function pickTodoDay(day) {
  todoDay = day;
  todoMonth = Math.floor(day / 100);
  renderTodo();
}

function editTodo(text, i) {
  const input = document.createElement('input');
  input.className = 'todo-edit';
  input.maxLength = 40;
  input.value = myTodo.i[i][0];
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (save && value && value !== myTodo.i[i]?.[0]) ws.send(`todo edit ${i} ${value}`);
    renderTodo();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) finish(true);
    else if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
  text.replaceWith(input);
  stopMoving();
  input.focus();
  input.select();
}

function todoButton(className, label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

function renderTodoTabs() {
  const tabs = [{ label: '나', own: true }, ...myFriends.map(([name, id], i) => ({ label: name, on: !!id, friend: i }))];
  todoTabs.replaceChildren(...tabs.map((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rtab';
    button.setAttribute('role', 'tab');
    const selected = tab.own ? !friendTodo : friendTodo?.n === tab.label;
    button.setAttribute('aria-selected', String(selected));
    if (!tab.own) {
      const dot = document.createElement('i');
      dot.className = tab.on ? 'on' : '';
      button.append(dot);
    }
    button.append(tab.label);
    button.addEventListener('click', () => (tab.own ? showMyTodo() : openFriendTodo(tab.friend)));
    if (selected) requestAnimationFrame(() => button.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    return button;
  }));
}

function renderTodoGrid(items) {
  const year = Math.floor(todoMonth / 100), month = todoMonth % 100, today = todayNumber();
  const first = new Date(year, month - 1, 1).getDay(), days = new Date(year, month, 0).getDate();
  const byDay = new Map();
  for (const item of items) {
    if (Math.floor(item.date / 100) !== todoMonth) continue;
    const counts = byDay.get(item.date % 100) || { all: 0, done: 0 };
    counts.all++;
    if (item.done) counts.done++;
    byDay.set(item.date % 100, counts);
  }
  const cells = WEEKDAYS.map((name, i) => {
    const head = document.createElement('span');
    head.className = `dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`;
    head.textContent = name;
    return head;
  });
  for (let i = 0; i < first; i++) cells.push(Object.assign(document.createElement('span'), { className: 'todo-cell blank' }));
  for (let day = 1; day <= days; day++) {
    const date = todoMonth * 100 + day, weekday = (first + day - 1) % 7, counts = byDay.get(day);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.tabIndex = -1;
    cell.className = `todo-cell${weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : ''}${date === today ? ' today' : ''}`;
    cell.setAttribute('aria-selected', String(date === todoDay));
    cell.setAttribute('aria-label', `${month}월 ${day}일${counts ? ` 할 일 ${counts.all}개` : ''}`);
    cell.dataset.date = date;
    const number = document.createElement('span');
    number.textContent = day;
    cell.append(number);
    if (counts) {
      const mark = document.createElement('b');
      mark.className = counts.done === counts.all ? 'all' : '';
      mark.textContent = counts.done === counts.all ? '✓' : counts.all - counts.done;
      cell.append(mark);
    }
    cell.addEventListener('click', () => pickTodoDay(date));
    cells.push(cell);
  }
  todoGrid.replaceChildren(...cells);
}

// ---- 끌어서 순서 바꾸기: 줄 오른쪽의 ⋮⋮ 를 잡고 위아래로 끌면 그 자리로, 달력의 날짜에 놓으면 그날로 옮긴다.
// 끄는 동안 다른 줄이 비켜 서서 놓일 자리를 보여 주고, 손끝에는 그 일의 쪽지가 따라온다.
const todoGhost = document.getElementById('todo-ghost');

function startTodoDrag(e, li, order) {
  if (e.button !== 0 || friendTodo || todoDrag) return;
  const index = Number(li.dataset.index), item = myTodo.i[index];
  if (!item) return;
  e.preventDefault();
  const rows = [...todoList.children], from = rows.indexOf(li);
  todoDrag = {
    pointer: e.pointerId, li, index, order, item: item.slice(), rows, from, to: from,
    tops: rows.map((row) => row.offsetTop), heights: rows.map((row) => row.offsetHeight),
    startX: e.clientX, startY: e.clientY, moved: false, cell: null,
  };
  addEventListener('pointermove', moveTodoDrag);
  addEventListener('pointerup', endTodoDrag);
  addEventListener('pointercancel', endTodoDrag);
}

// 잡은 줄은 놓일 자리로, 그 사이의 줄들은 잡은 줄의 높이만큼 위나 아래로 비켜 선다
function layoutTodoDrag(drag) {
  const { from, to, rows, tops, heights } = drag, lifted = heights[from];
  rows.forEach((row, i) => {
    let dy = 0;
    if (i === from) dy = to > from ? tops[to] + heights[to] - tops[from] - lifted : to < from ? tops[to] - tops[from] : 0;
    else if (from < i && i <= to) dy = -lifted;
    else if (to <= i && i < from) dy = lifted;
    row.style.transform = dy ? `translateY(${dy}px)` : '';
  });
}

function moveTodoDrag(e) {
  const drag = todoDrag;
  if (!drag || e.pointerId !== drag.pointer) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
    drag.moved = true;
    drag.li.classList.add('lifted');
    todoList.classList.add('sorting');
    document.body.classList.add('dragging', 'todo-sorting');
    drag.label = document.createElement('small');
    todoGhost.replaceChildren(drag.item[0], drag.label);
    todoGhost.hidden = false;
  }
  todoGhost.style.transform = `translate(${Math.round(e.clientX + 14)}px, ${Math.round(e.clientY - 12)}px)`;
  const cell = todoCalendar ? document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.matches('.todo-cell[data-date]')) || null : null;
  if (cell !== drag.cell) {
    drag.cell?.classList.remove('drop');
    drag.cell = cell;
    cell?.classList.add('drop');
    drag.label.textContent = cell ? `→ ${dayLabel(Number(cell.dataset.date))}` : '';
  }
  const box = todoList.getBoundingClientRect();
  let to = drag.from;
  if (!cell && e.clientY >= box.top - 30 && e.clientY <= box.bottom + 30 && e.clientX >= box.left - 40 && e.clientX <= box.right + 40) {
    if (e.clientY < box.top + 14) todoList.scrollTop -= 8;        // 목록의 위아래 끝에 대면 그쪽으로 굴린다
    else if (e.clientY > box.bottom - 14) todoList.scrollTop += 8;
    const y = e.clientY - box.top - todoList.clientTop + todoList.scrollTop;
    to = drag.rows.reduce((count, row, i) => count + (i !== drag.from && drag.tops[i] + drag.heights[i] / 2 < y ? 1 : 0), 0);
  }
  if (to !== drag.to) {
    drag.to = to;
    layoutTodoDrag(drag);
  }
}

function endTodoDrag(e) {
  const drag = todoDrag;
  if (!drag || e.pointerId !== drag.pointer) return;
  removeEventListener('pointermove', moveTodoDrag);
  removeEventListener('pointerup', endTodoDrag);
  removeEventListener('pointercancel', endTodoDrag);
  todoDrag = null;
  drag.cell?.classList.remove('drop');
  todoGhost.hidden = true;
  todoList.classList.remove('sorting');
  document.body.classList.remove('dragging', 'todo-sorting');
  for (const row of drag.rows) row.style.transform = '';
  drag.li.classList.remove('lifted');
  const now = myTodo.i[drag.index];
  const same = now && now[0] === drag.item[0] && now[2] === drag.item[2];   // 끄는 사이에 목록이 바뀌지 않았다
  if (drag.moved && e.type === 'pointerup' && same && ws && ws.readyState === WebSocket.OPEN) {
    const date = drag.cell ? Number(drag.cell.dataset.date) : 0;
    if (date && date !== (drag.item[2] || todayNumber())) {
      ws.send(`todo date ${drag.index} ${date}`);
      now[2] = date;   // 서버의 답을 기다리지 않고 바로 옮겨 보인다
    } else if (!drag.cell && drag.to !== drag.from) {
      const to = drag.order[drag.to];
      ws.send(`todo move ${drag.index} ${to}`);
      myTodo.i.splice(to, 0, ...myTodo.i.splice(drag.index, 1));
    }
  }
  renderTodo();
}

function renderTodo() {
  if (todoEl.hidden) return;
  if (todoDrag) return;   // 끄는 동안 목록을 다시 그리면 잡은 줄이 사라진다: 놓은 뒤에 그린다 (endTodoDrag)
  renderTodoTabs();
  const own = !friendTodo, view = friendTodo || myTodo, today = todayNumber();
  const items = view.i.map(([text, done, date], index) => ({ text, done: !!done, date: date || today, index }));
  todoTitle.textContent = own ? '할 일' : `${view.n}님의 할 일`;
  todoCalToggle.setAttribute('aria-pressed', String(todoCalendar));
  todoCalToggle.setAttribute('aria-label', todoCalendar ? '달력 접기' : '달력 펴기');
  todoGrid.hidden = !todoCalendar;
  todoLabel.textContent = todoCalendar ? `${Math.floor(todoMonth / 100)}년 ${todoMonth % 100}월` : dayLabel(todoDay);
  if (todoCalendar) renderTodoGrid(items);
  const day = items.filter((item) => item.date === todoDay);
  const done = day.filter((item) => item.done).length;
  todoDateEl.textContent = `${dayLabel(todoDay)}${todoDay === today ? ' · 오늘' : ''}`;
  todoOwner.textContent = own ? '' : view.loading ? '불러오는 중…' : view.on ? '● 접속 중' : '오프라인';
  todoForm.hidden = todoFoot.hidden = !own;
  todoProgress.firstChild.style.width = day.length ? `${(done / day.length) * 100}%` : '0';
  todoProgress.lastChild.textContent = day.length ? `${done} / ${day.length}${done === day.length ? ' 다 했어요!' : ''}` : '';
  todoShare.checked = !!myTodo.sh;
  todoList.replaceChildren(...day.map(({ text, done: isDone, date, index }) => {
    const li = document.createElement('li');
    li.classList.toggle('done', isDone);
    const check = todoButton('todo-check', isDone ? '✓' : '', isDone ? '다 했음 취소' : '다 했음', () => ws.send(`todo done ${index}`));
    check.disabled = !own;
    const label = document.createElement('span');
    label.className = 'todo-text';
    label.textContent = text;
    li.append(check, label);
    if (own) {
      label.title = '두 번 누르면 고쳐요';
      label.addEventListener('dblclick', () => editTodo(label, index));
      if (!isDone) li.append(todoButton('todo-move', '»', '내일로 미루기', () => ws.send(`todo date ${index} ${shiftDay(date, 1)}`)));
      li.append(todoButton('todo-del', '✕', '지우기', () => ws.send(`todo del ${index}`)));
      if (day.length > 1 || todoCalendar) {
        const grip = todoButton('todo-grip', '', '끌어서 순서 바꾸기 (달력의 날짜에 놓으면 그날로 옮겨요)', () => {});
        grip.addEventListener('pointerdown', (e) => startTodoDrag(e, li, day.map((item) => item.index)));
        li.append(grip);
      }
      li.dataset.index = index;
    }
    return li;
  }));
  todoEmpty.hidden = day.length > 0;
  todoEmpty.textContent = own ? (todoDay < today ? '이날은 적어 둔 할 일이 없어요.' : '이날 할 일을 아래에 적어 보세요!')
    : view.loading ? '' : view.sh ? `${view.n}님은 이날 할 일이 없어요.` : `${view.n}님은 할 일을 공개하지 않았어요.`;
}

todoOpen.addEventListener('click', () => setTodoOpen(todoEl.hidden));
document.getElementById('todo-close').addEventListener('click', () => setTodoOpen(false));
todoCalToggle.addEventListener('click', () => setTodoCalendar(!todoCalendar));
document.getElementById('todo-prev').addEventListener('click', () => {
  if (todoCalendar) todoMonth = shiftMonth(todoMonth, -1);
  else todoDay = shiftDay(todoDay, -1);
  renderTodo();
});
document.getElementById('todo-next').addEventListener('click', () => {
  if (todoCalendar) todoMonth = shiftMonth(todoMonth, 1);
  else todoDay = shiftDay(todoDay, 1);
  renderTodo();
});
document.getElementById('todo-today').addEventListener('click', () => pickTodoDay(todayNumber()));
todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) {
    todoInput.blur();
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`todo add ${todoDay} ${text}`);
  todoInput.value = '';   // 이어서 적을 수 있게 입력 칸은 그대로 둔다
});
todoInput.addEventListener('focus', () => stopMoving());
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') todoInput.blur();
});
document.getElementById('todo-clear').addEventListener('click', () => ws.send(`todo clear ${todoDay}`));
todoShare.addEventListener('change', () => ws.send(`todo share ${todoShare.checked ? 1 : 0}`));
makeMovable(todoEl, document.getElementById('todo-head'), 'todo');
