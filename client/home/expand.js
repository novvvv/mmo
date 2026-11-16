'use strict';
// 집 확장: 집 모양 위에서 20px 칸을 끌어 칠하면 바닥이 넓어지고, 지우기로 칠한 칸을 다시 없앤다.
// 원래 방 바로 위(뒷벽 자리)를 칠하면 그만큼 벽이 없어져 방이 이어진다. 벽이 필요하면 가구점의 「벽」을 세운다.

const expandMap = document.getElementById('expand-map');
const expandName = document.getElementById('expand-name');
const expandNote = document.getElementById('expand-note');
const expandCount = document.getElementById('expand-count');
const expandAddButton = document.getElementById('expand-add');
const expandEraseButton = document.getElementById('expand-erase');
const expandZoomButton = document.getElementById('expand-zoom');
let expandErasing = false;
let expandWhole = false;    // 넓힐 수 있는 범위 전체를 보는지 (아니면 지금 바닥 둘레만 크게)
let expandDrag = null;      // 끄는 중인 사각형: { a: [칸 x, 칸 y], b: [칸 x, 칸 y] }
let expandView = null;      // 지금 그린 화면의 배율과 원점: { scale, ox, oy }

function setExpandErasing(erasing) {
  expandErasing = erasing;
  expandAddButton.setAttribute('aria-pressed', String(!erasing));
  expandEraseButton.setAttribute('aria-pressed', String(erasing));
  renderExpandPane();
}
expandAddButton.addEventListener('click', () => setExpandErasing(false));
expandEraseButton.addEventListener('click', () => setExpandErasing(true));
expandZoomButton.addEventListener('click', () => {
  expandWhole = !expandWhole;
  expandZoomButton.setAttribute('aria-pressed', String(expandWhole));
  renderExpandPane();
});

function expandRoom() {
  const room = terrain && zone > 0 ? terrain.zones[zone] : null;
  return room?.base && room.reach ? room : null;   // reach 가 없으면 예전 서버(벽 뚫기 방식)다. 배포하는 사이에만 생긴다
}

function renderExpandPane() {
  if (furnShop.hidden || shopTab !== 'expand' || !terrain) return;
  const room = expandRoom();
  const price = terrain.expandPrice || 0;
  expandName.textContent = room ? `${terrain.buildings[room.b].name}의 집` : '집 밖';
  for (const button of [expandAddButton, expandEraseButton, expandZoomButton]) button.disabled = !room;
  expandCount.textContent = room ? `칠한 칸 ${room.cells} / ${room.maxCells}` : '';
  expandNote.textContent = room
    ? `한 칸은 ${room.cell}px예요. 끌어서 사각형으로 ${expandErasing ? '지우고' : '칠하고'}, 누르기만 하면 한 칸씩. 칠한 칸은 지금 바닥과 이어져야 해요. 원래 방 바로 위를 칠하면 그만큼 벽이 없어져 방이 이어지고, 벽이 필요한 곳에는 가구점의 「벽」을 세우면 돼요. 한 칸 ${price ? `${price} G` : '무료 (테스트 기간)'}. 가구가 있거나 사람이 서 있는 칸은 지울 수 없어요.`
    : '넓히고 싶은 집 안에서 열어 주세요.';
  drawExpandMap(room);
}

// 보여 줄 범위: 지금 바닥 둘레에 여유를 두고, 「전체 보기」면 넓힐 수 있는 범위 전체
function expandBounds(room) {
  const [rx0, ry0, rx1, ry1] = room.reach;
  if (expandWhole) return [rx0, ry0, rx1, ry1];
  const floors = room.floors || room.base;
  const margin = 260;
  return [
    Math.max(rx0, Math.min(...floors.map((f) => f[0])) - margin), Math.max(ry0, Math.min(...floors.map((f) => f[1])) - margin - WALL_HEIGHT),
    Math.min(rx1, Math.max(...floors.map((f) => f[2])) + margin), Math.min(ry1, Math.max(...floors.map((f) => f[3])) + margin),
  ];
}

function drawExpandMap(room) {
  const c = expandMap.getContext('2d');
  const W = expandMap.width, H = expandMap.height;
  c.clearRect(0, 0, W, H);
  expandView = null;
  if (!room) return;
  const [x0, y0, x1, y1] = expandBounds(room);
  const scale = Math.min(W / (x1 - x0), H / (y1 - y0));
  const ox = (W - (x1 - x0) * scale) / 2 - x0 * scale, oy = (H - (y1 - y0) * scale) / 2 - y0 * scale;
  expandView = { scale, ox, oy };
  const px = (x) => ox + x * scale, py = (y) => oy + y * scale;
  // 넓힐 수 있는 범위
  const [rx0, ry0, rx1, ry1] = room.reach;
  c.fillStyle = '#2a2b31';
  c.fillRect(px(rx0), py(ry0), (rx1 - rx0) * scale, (ry1 - ry0) * scale);
  // 칸 눈금: 너무 촘촘하면 다섯 칸마다
  const cell = room.cell, step = cell * scale >= 6 ? cell : cell * 5;
  c.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = Math.ceil(Math.max(x0, rx0) / step) * step; x <= Math.min(x1, rx1); x += step) {
    c.moveTo(Math.round(px(x)) + 0.5, py(Math.max(y0, ry0)));
    c.lineTo(Math.round(px(x)) + 0.5, py(Math.min(y1, ry1)));
  }
  for (let y = Math.ceil(Math.max(y0, ry0) / step) * step; y <= Math.min(y1, ry1); y += step) {
    c.moveTo(px(Math.max(x0, rx0)), Math.round(py(y)) + 0.5);
    c.lineTo(px(Math.min(x1, rx1)), Math.round(py(y)) + 0.5);
  }
  c.stroke();
  // 바닥: 원래 방은 진하게, 칠한 곳은 분홍
  const floors = room.floors || room.base;
  const isBase = (f) => room.base.some((b) => b[0] === f[0] && b[1] === f[1] && b[2] === f[2] && b[3] === f[3]);
  for (const f of floors) {
    c.fillStyle = isBase(f) ? '#c9b48e' : '#ff9cc4';
    c.fillRect(px(f[0]), py(f[1]), (f[2] - f[0]) * scale, (f[3] - f[1]) * scale);
  }
  c.strokeStyle = '#2a2a30';
  for (const f of room.base) c.strokeRect(px(f[0]) + 0.5, py(f[1]) + 0.5, (f[2] - f[0]) * scale - 1, (f[3] - f[1]) * scale - 1);
  // 놓은 벽 가구
  c.fillStyle = '#6e6658';
  for (const d of decorItems) {
    if (!WALL_PIECES.has(d.info.k)) continue;
    const vertical = d.rot % 2, half = (d.base || d.info).hw;
    const w = vertical ? WALL_PIECE_THICK : half * 2, len = vertical ? half * 2 : WALL_PIECE_THICK;
    c.fillRect(px(d.x - w / 2), py(d.y - len), Math.max(2, w * scale), Math.max(2, len * scale));
  }
  // 문과 나
  c.fillStyle = '#ffd24a';
  c.fillRect(px(room.door[0]) - 6, py(room.door[1]) - 3, 12, 5);
  if (me) {
    c.fillStyle = '#4fd27a';
    c.beginPath();
    c.arc(px(me.x), py(me.y), 3.5, 0, Math.PI * 2);
    c.fill();
  }
  // 끄는 중인 사각형
  if (expandDrag) {
    const ax = Math.min(expandDrag.a[0], expandDrag.b[0]), ay = Math.min(expandDrag.a[1], expandDrag.b[1]);
    const bx = Math.max(expandDrag.a[0], expandDrag.b[0]), by = Math.max(expandDrag.a[1], expandDrag.b[1]);
    c.fillStyle = expandErasing ? 'rgba(255, 90, 90, 0.4)' : 'rgba(120, 230, 150, 0.45)';
    c.strokeStyle = expandErasing ? '#ff6b6b' : '#7be29a';
    c.lineWidth = 2;
    c.fillRect(px(ax * cell), py(ay * cell), (bx - ax + 1) * cell * scale, (by - ay + 1) * cell * scale);
    c.strokeRect(px(ax * cell), py(ay * cell), (bx - ax + 1) * cell * scale, (by - ay + 1) * cell * scale);
    const w = (bx - ax + 1) * cell, h = (by - ay + 1) * cell;
    c.font = '700 11px sans-serif';
    c.fillStyle = '#fff';
    c.fillText(`${w}×${h}px`, 6, H - 8);
  }
}

// 캔버스 위의 점 → 칸
function expandCellAt(e) {
  const room = expandRoom();
  if (!room || !expandView) return null;
  const rect = expandMap.getBoundingClientRect();
  const x = ((e.clientX - rect.left) * expandMap.width / rect.width - expandView.ox) / expandView.scale;
  const y = ((e.clientY - rect.top) * expandMap.height / rect.height - expandView.oy) / expandView.scale;
  return [Math.floor(x / room.cell), Math.floor(y / room.cell)];
}

expandMap.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const at = expandCellAt(e);
  if (!at) return;
  e.preventDefault();
  expandMap.setPointerCapture(e.pointerId);
  expandDrag = { a: at, b: at };
  drawExpandMap(expandRoom());
});
expandMap.addEventListener('pointermove', (e) => {
  if (!expandDrag) return;
  const at = expandCellAt(e);
  if (at) expandDrag.b = at;
  drawExpandMap(expandRoom());
});
function finishExpandDrag(send) {
  if (!expandDrag) return;
  const { a, b } = expandDrag;
  expandDrag = null;
  if (send && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(`expand ${expandErasing ? 'remove' : 'add'} ${Math.min(a[0], b[0])} ${Math.min(a[1], b[1])} ${Math.max(a[0], b[0])} ${Math.max(a[1], b[1])}`);
  }
  drawExpandMap(expandRoom());
}
expandMap.addEventListener('pointerup', () => finishExpandDrag(true));
expandMap.addEventListener('pointercancel', () => finishExpandDrag(false));
