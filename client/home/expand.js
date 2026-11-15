'use strict';
// 집 확장: 벽 뚫기, 통로 폭, 붙인 방의 크기.

// ---- 집 확장: 지금 있는 집의 벽을 상하좌우로 하나씩 뚫어 방을 붙인다. 원래 방은 그대로다
const expandMap = document.getElementById('expand-map');
const expandName = document.getElementById('expand-name');
const expandNote = document.getElementById('expand-note');
const expandButtons = [...document.querySelectorAll('#expand-pad .rbtn')];
const EXPAND_DIRS = ['위', '아래', '왼쪽', '오른쪽'];
const EXPAND_ARROWS = ['▲', '▼', '◀', '▶'];
for (const button of expandButtons) {
  button.addEventListener('click', () => {
    const room = terrain?.zones[zone];
    if (!room?.base) return;
    const dir = Number(button.dataset.dir);
    const open = room.open.some(([d]) => d === dir);
    ws.send(open ? `expand close ${dir}` : `expand open ${dir} ${expandWidth.value}`);
  });
}
// 뚫는 폭: 슬라이더로 고르고, 이미 뚫어 둔 통로는 아래 버튼으로 그 폭에 맞춘다
const expandWidth = document.getElementById('expand-width');
const expandWidthValue = document.getElementById('expand-width-value');
const expandResize = document.getElementById('expand-resize');
const EXPAND_WIDTH_KEY = 'mmo.expandWidth';
try { expandWidth.value = parseInt(localStorage.getItem(EXPAND_WIDTH_KEY), 10) || 120; } catch { /* 기본 폭 */ }
expandWidth.addEventListener('input', () => {
  try { localStorage.setItem(EXPAND_WIDTH_KEY, expandWidth.value); } catch { /* 이번 접속에만 */ }
  renderExpandPane();
});
expandWidth.addEventListener('change', () => releaseFocus(expandWidth));
document.getElementById('expand-width-max').addEventListener('click', (e) => {
  e.currentTarget.blur();
  expandWidth.value = expandWidth.max;
  expandWidth.dispatchEvent(new Event('input'));
});

function renderExpandPane() {
  if (furnShop.hidden || shopTab !== 'expand' || !terrain) return;
  const room = zone > 0 ? terrain.zones[zone] : null;
  const here = !!room?.base;
  const price = terrain.expandPrice || 0;
  expandName.textContent = here ? `${terrain.buildings[room.b].name}의 집` : '집 밖';
  for (const button of expandButtons) {
    const dir = Number(button.dataset.dir);
    const open = here && room.open.some(([d]) => d === dir);
    button.disabled = !here;
    button.classList.toggle('open', open);
    button.innerHTML = `<b>${EXPAND_ARROWS[dir]} ${EXPAND_DIRS[dir]}</b><br>${open ? '방 막기' : '넓히기'}`;
  }
  const widest = here && room.omax ? Math.max(...room.omax) : 560;
  expandWidth.max = widest;
  expandWidth.disabled = !here;
  const width = Number(expandWidth.value);
  expandWidthValue.textContent = `${width}px${width >= widest ? ' (전체)' : ''}`;
  expandResize.replaceChildren(...(here ? room.open : []).map(([dir, , now]) => {
    const limit = room.omax?.[dir] ?? 560, target = Math.min(width, limit);
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn';
    button.dataset.dir = dir;
    button.textContent = `${EXPAND_ARROWS[dir]} ${EXPAND_DIRS[dir]} 통로 ${now}px → ${target}px`;
    button.disabled = target === now;
    button.addEventListener('click', () => ws.send(`expand width ${dir} ${target}`));
    return button;
  }));
  renderExpandSizes(here ? room : null);
  expandNote.textContent = here
    ? `벽을 뚫어 방을 하나 붙입니다. 붙인 방은 아래에서 가로와 세로를 20px 단위로 줄이고 늘릴 수 있어요. 한 방향에 한 번씩, ${price ? `${price} G` : '테스트 기간이라 무료'}. 「뚫는 폭」으로 문만큼 좁게도, 벽 전체를 터서 한 공간처럼도 만들 수 있고, 뚫은 뒤에도 폭을 바꿀 수 있어요. 붙인 방이 비어 있으면 다시 막을 수 있어요.`
    : '넓히고 싶은 집 안에서 열어 주세요.';
  drawExpandMap(here ? room : null);
}

// 붙인 방마다 가로·세로를 고르는 막대. 고르는 동안의 값은 expandDraft 에 두고, 서버의 크기가 바뀌면 거기에 맞춘다
const expandSizes = document.getElementById('expand-sizes');
const expandDraft = {};   // 방향 → { key, len, deep }
function renderExpandSizes(room) {
  const open = room ? room.open.filter((o) => o.length >= 5) : [];
  const [minLen, maxLen, minDeep, maxDeep] = room?.osize || [200, 900, 200, 700];
  expandSizes.replaceChildren(...open.map(([dir, , width, len, deep]) => {
    const key = `${zone}:${len}:${deep}`;
    if (expandDraft[dir]?.key !== key) expandDraft[dir] = { key, len, deep };
    const draft = expandDraft[dir], vertical = dir < 2;   // 위아래로 붙인 방은 벽과 나란한 쪽이 가로다
    const row = document.createElement('div');
    row.className = 'expand-size-row';
    row.dataset.dir = dir;
    const title = document.createElement('b');
    title.textContent = `${EXPAND_ARROWS[dir]} ${EXPAND_DIRS[dir]} 방`;
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.tabIndex = -1;
    apply.className = 'rbtn';
    const sync = () => {
      apply.disabled = draft.len === len && draft.deep === deep;
      apply.textContent = apply.disabled ? '지금 크기' : '이 크기로';
    };
    const slider = (label, field, min, max) => {
      const wrap = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'range';
      input.tabIndex = -1;
      input.min = min;
      input.max = max;
      input.step = 20;
      input.value = draft[field];
      input.dataset.field = field;
      const out = document.createElement('output');
      out.textContent = `${draft[field]}px`;
      input.addEventListener('input', () => {
        draft[field] = Number(input.value);
        out.textContent = `${draft[field]}px`;
        sync();
      });
      input.addEventListener('change', () => releaseFocus(input));
      wrap.append(label, input, out);
      return wrap;
    };
    const lenMin = Math.max(minLen, Math.ceil(width / 20) * 20);   // 방은 통로보다 좁아질 수 없다
    row.append(title, slider(vertical ? '가로' : '세로', 'len', lenMin, maxLen), slider(vertical ? '세로' : '가로', 'deep', minDeep, maxDeep), apply);
    apply.addEventListener('click', () => ws.send(`expand size ${dir} ${draft.len} ${draft.deep}`));
    sync();
    return row;
  }));
}

// 집 모양 미리보기: 원래 방은 진하게, 넓힌 곳은 분홍으로, 문은 노랗게
function drawExpandMap(room) {
  const c = expandMap.getContext('2d');
  c.clearRect(0, 0, expandMap.width, expandMap.height);
  if (!room) return;
  const floors = room.floors || [[0, 0, room.w, room.h, room.style]];
  const x0 = Math.min(...floors.map((f) => f[0])), y0 = Math.min(...floors.map((f) => f[1]));
  const x1 = Math.max(...floors.map((f) => f[2])), y1 = Math.max(...floors.map((f) => f[3]));
  const pad = 14, scale = Math.min((expandMap.width - pad * 2) / (x1 - x0), (expandMap.height - pad * 2) / (y1 - y0));
  const ox = (expandMap.width - (x1 - x0) * scale) / 2 - x0 * scale, oy = (expandMap.height - (y1 - y0) * scale) / 2 - y0 * scale;
  const isBase = (f) => room.base.some((b) => b[0] === f[0] && b[1] === f[1] && b[2] === f[2] && b[3] === f[3]);
  for (const f of floors) {
    c.fillStyle = isBase(f) ? '#c9b48e' : '#ff9cc4';
    c.fillRect(ox + f[0] * scale, oy + f[1] * scale, (f[2] - f[0]) * scale, (f[3] - f[1]) * scale);
  }
  c.strokeStyle = '#2a2a30';
  c.lineWidth = 1;
  for (const f of room.base) c.strokeRect(ox + f[0] * scale + 0.5, oy + f[1] * scale + 0.5, (f[2] - f[0]) * scale - 1, (f[3] - f[1]) * scale - 1);
  c.fillStyle = '#ffd24a';
  c.fillRect(ox + room.door[0] * scale - 6, oy + room.door[1] * scale - 3, 12, 5);
  if (me && zone > 0) {
    c.fillStyle = '#4fd27a';
    c.beginPath();
    c.arc(ox + me.x * scale, oy + me.y * scale, 3.5, 0, Math.PI * 2);
    c.fill();
  }
}
