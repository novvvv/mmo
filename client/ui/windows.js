'use strict';
// 창 공통: 제목 줄을 끌어 옮기기와 위치 기억, 목록의 쪽 나누기.

// ------------------------------------------------------------ 창 옮기기

function placeWindow(win, left, top) {
  const { width } = win.getBoundingClientRect();
  win.style.left = `${clamp(left, 0, Math.max(0, innerWidth - width))}px`;
  win.style.top = `${clamp(top, 0, Math.max(0, innerHeight - 40))}px`;  // 제목 줄은 항상 화면 안에 남긴다
  win.style.right = 'auto';
  win.style.transform = 'none';
}

function saveWindow(win, name) {
  const { left, top, width } = win.getBoundingClientRect();
  try { localStorage.setItem(`mmo.window.${name}`, JSON.stringify({ left, top, width })); } catch { /* 저장을 막아 둔 브라우저에서는 이번 접속에만 적용 */ }
}

function restoreWindow(win, name) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(`mmo.window.${name}`)); } catch { /* 저장된 값이 없으면 기본 위치 */ }
  if (!saved) return;
  if (win === tvEl) win.style.width = `${clamp(saved.width, TV_MIN_WIDTH, Math.max(TV_MIN_WIDTH, innerWidth - 24))}px`;
  placeWindow(win, saved.left, saved.top);
}

// 포인터를 누른 동안만 onMove 를 부르고, 놓으면 위치를 저장한다.
function trackPointer(handle, e, win, name, onMove) {
  e.preventDefault();
  hideItemTip();
  handle.setPointerCapture(e.pointerId);
  document.body.classList.add('dragging');
  const finish = () => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', finish);
    handle.removeEventListener('pointercancel', finish);
    document.body.classList.remove('dragging');
    saveWindow(win, name);
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function makeMovable(win, handle, name) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const { left, top } = win.getBoundingClientRect();
    const offsetX = e.clientX - left, offsetY = e.clientY - top;
    trackPointer(handle, e, win, name, (move) => placeWindow(win, move.clientX - offsetX, move.clientY - offsetY));
  });
}

makeMovable(bagEl, bagHead, 'bag');
makeMovable(tvEl, tvHead, 'tv');
makeMovable(pachiEl, document.getElementById('pachi-head'), 'pachi');

// 오른쪽 아래 모서리를 끌면 영상 비율을 유지한 채 커지거나 작아진다.
tvResize.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const { left, top, width } = tvEl.getBoundingClientRect();
  placeWindow(tvEl, left, top);  // 가운데 정렬을 풀어 왼쪽 위를 고정한다
  const startX = e.clientX;
  trackPointer(tvResize, e, tvEl, 'tv', (move) => {
    const largest = Math.min(innerWidth - left, ((innerHeight - top - TV_CHROME_HEIGHT) * 16) / 9);
    tvEl.style.width = `${clamp(width + move.clientX - startX, TV_MIN_WIDTH, Math.max(TV_MIN_WIDTH, largest))}px`;
  });
});

addEventListener('resize', () => {
  for (const win of [bagEl, tvEl, jazzEl, furnShop, dyeEl, omokEl, arcadeEl, guideEl, todoEl, friendsEl, guestEl, pachiEl, focusEl]) {
    if (!win.hidden && win.style.left) placeWindow(win, parseFloat(win.style.left), parseFloat(win.style.top));
  }
});

// ---- 페이지 나누기: 목록의 칸을 한 쪽씩 보여 주고 아래에 ◀ 1 / 5 ▶ 를 단다
const pagers = new Map();   // 목록 → { page, size, bar, label, prev, next }

function paginate(list, size) {
  let pager = pagers.get(list);
  if (!pager) {
    const bar = document.createElement('div');
    bar.className = 'pager';
    const prev = document.createElement('button');
    const next = document.createElement('button');
    const label = document.createElement('b');
    for (const [button, text, aria] of [[prev, '◀', '앞쪽'], [next, '▶', '뒤쪽']]) {
      button.type = 'button';
      button.tabIndex = -1;
      button.className = 'rbtn';
      button.textContent = text;
      button.setAttribute('aria-label', aria);
    }
    bar.append(prev, label, next);
    list.after(bar);
    pager = { page: 0, size, bar, label, prev, next };
    pagers.set(list, pager);
    prev.addEventListener('click', () => { pager.page--; paginate(list, pager.size); Sound.play('page'); });
    next.addEventListener('click', () => { pager.page++; paginate(list, pager.size); Sound.play('page'); });
    list.addEventListener('wheel', (e) => {   // 목록 위에서 휠을 굴리면 쪽을 넘긴다 (넘칠 때만)
      if (pager.pages <= 1 || list.scrollHeight > list.clientHeight + 2) return;
      const step = Math.sign(e.deltaY);
      if (!step || (step < 0 && pager.page === 0) || (step > 0 && pager.page >= pager.pages - 1)) return;
      e.preventDefault();
      pager.page += step;
      paginate(list, pager.size);
    }, { passive: false });
  }
  pager.size = size;
  const cells = [...list.children].filter((cell) => !cell.classList.contains('empty'));
  pager.pages = Math.max(1, Math.ceil(cells.length / size));
  pager.page = clamp(pager.page, 0, pager.pages - 1);
  cells.forEach((cell, i) => { cell.hidden = Math.floor(i / size) !== pager.page; });
  pager.label.textContent = `${pager.page + 1} / ${pager.pages}`;
  pager.prev.disabled = pager.page === 0;
  pager.next.disabled = pager.page >= pager.pages - 1;
  pager.bar.hidden = pager.pages <= 1 || list.hidden;
}

function refreshPagers() {
  for (const [list, pager] of pagers) paginate(list, pager.size);
}

// 고른 가구가 있는 쪽으로 넘긴다
function showPageOf(list, cell) {
  const pager = pagers.get(list);
  if (!pager || !cell) return;
  const index = [...list.children].filter((c) => !c.classList.contains('empty')).indexOf(cell);
  if (index >= 0) {
    pager.page = Math.floor(index / pager.size);
    paginate(list, pager.size);
  }
}
