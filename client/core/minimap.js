'use strict';
// 오른쪽 아래 월드맵과 접고 펴기.

// ------------------------------------------------------------ 월드맵

const MINIMAP_LABELS = { 재즈바: '재즈바', 극장: '극장', 카페: '카페', 카지노: '카지노', 몰쟈: '몰쟈', 랏라: '랏라', 캬캬: '캬캬' };
const MINIMAP_COLORS = { theater: '#a32229', cafe: '#d98a3a', jazz: '#b0528f', casino: '#e8b830' };

// 변하지 않는 지형은 입장할 때 한 번만 그려 둔다.
function buildMinimap() {
  minimap.height = Math.round(minimap.width * world.h / world.w);   // 마을 모양 그대로 (가로세로 비율)
  minimapBase.width = minimap.width;
  minimapBase.height = minimap.height;
  const c = minimapBase.getContext('2d');
  const scale = minimap.width / world.w;
  c.fillStyle = CHRISTMAS ? '#e3ebf3' : '#4a8c47';
  c.fillRect(0, 0, minimap.width, minimap.height);
  c.fillStyle = '#3a7bb0';
  c.beginPath();
  terrain.top.forEach((y, i) => c.lineTo(i * terrain.step * scale, y * scale));
  for (let i = terrain.bot.length - 1; i >= 0; i--) c.lineTo(i * terrain.step * scale, terrain.bot[i] * scale);
  c.closePath();
  c.fill();
  c.fillStyle = '#b98a58';
  const [bl, br] = terrain.bridge;
  c.fillRect(bl * scale, Math.min(...terrain.top) * scale - 8, (br - bl) * scale, (Math.max(...terrain.bot) - Math.min(...terrain.top)) * scale + 16);
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.font = `700 20px ${FONT}`;
  for (const b of terrain.buildings) {
    if (b.in) continue;   // 다른 건물 안에 있는 방은 그 건물 자리에 함께 표시된다
    const x = b.x * scale, y = b.y * scale;
    c.fillStyle = MINIMAP_COLORS[b.k] ?? '#f3ecdc';
    c.fillRect(x - 11, y - 9, 22, 18);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    const name = MINIMAP_LABELS[b.name] ?? b.name;
    const labelX = clamp(x, 32, minimap.width - 32), labelY = Math.max(y - 11, 22);
    c.strokeText(name, labelX, labelY);
    c.fillStyle = '#ffffff';
    c.fillText(name, labelX, labelY);
  }
}

// 접속한 친구가 지도의 어디에 있는지: 건물 안이면 그 입구(inside), 마을에 함께 있으면 그 자리.
// 내가 실내에 있으면 마을에 있는 친구의 자리는 받지 못하므로 x, y 없이 돌려준다.
function friendMapMarks() {
  const marks = [];
  for (const [name, id, z] of myFriends) {
    if (!id || z < 0) continue;
    const at = z === 0 ? (zone === 0 ? entities.get(id) : null) : terrain.buildings[terrain.zones[z]?.b];
    if (at) marks.push({ name, x: at.x, y: at.y, inside: z !== 0 });
    else if (z === 0) marks.push({ name });
  }
  return marks;
}

const FRIEND_MAP_COLOR = '#ff7eb6';
function drawMinimapFriends(c, scale) {
  const marks = friendMapMarks();
  if (!marks.length) return;
  c.save();
  c.font = `700 18px ${FONT}`;
  c.textBaseline = 'top';
  c.lineWidth = 4;
  c.lineJoin = 'round';
  const write = (text, x, y, align) => {
    c.textAlign = align;
    c.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    c.strokeText(text, x, y);
    c.fillStyle = FRIEND_MAP_COLOR;
    c.fillText(text, x, y);
  };
  const stacked = new Map();   // 같은 건물에 여럿이면 이름을 아래로 쌓는다
  for (const { name, x, y, inside } of marks) {
    if (x === undefined) continue;
    const px = x * scale, py = y * scale, key = inside ? `${x},${y}` : name;
    const row = stacked.get(key) ?? 0;
    stacked.set(key, row + 1);
    if (!row) {
      c.fillStyle = FRIEND_MAP_COLOR;
      c.strokeStyle = '#1b1b1b';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, 7, 0, TAU);
      c.fill();
      c.stroke();
      c.lineWidth = 4;
    }
    write(name, clamp(px, 40, minimap.width - 40), py + 11 + row * 19, 'center');
  }
  const somewhere = marks.filter((m) => m.x === undefined).map((m) => m.name);
  if (somewhere.length) write(`마을에 있는 친구: ${somewhere.join(', ')}`, 8, minimap.height - 26, 'left');
  c.restore();
}

function drawMinimap(now) {
  if (mapWin.hidden || !mapOpen || !terrain || !me) return;
  const c = minimapCtx, scale = minimap.width / world.w;
  c.drawImage(minimapBase, 0, 0);
  if (zone === 0) {
    c.fillStyle = CHRISTMAS ? '#3a6fd0' : '#ffffff';
    for (const [id, e] of entities) {
      if (id === myId) continue;
      c.beginPath();
      c.arc(e.x * scale, e.y * scale, 5, 0, TAU);
      c.fill();
    }
  }
  drawMinimapFriends(c, scale);
  // 집이나 극장 같은 건물 안에 있으면 그 입구에 표시한다.
  const place = zone === 0 ? me : terrain.buildings[terrain.zones[zone].b];
  const px = place.x * scale, py = place.y * scale;
  c.fillStyle = 'rgba(255, 224, 102, 0.35)';
  c.beginPath();
  c.arc(px, py, 12 + Math.sin(now / 260) * 3, 0, TAU);
  c.fill();
  c.fillStyle = '#ffe066';
  c.strokeStyle = '#1b1b1b';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(px, py, 7, 0, TAU);
  c.fill();
  c.stroke();
}

// ------------------------------------------------------------ 지도 접고 펴기

const mapToggle = document.getElementById('map-toggle');
let mapOpen = false;
try { mapOpen = localStorage.getItem('mmo.mapOpen') === '1'; } catch { /* 기본은 접힌 상태 */ }

function setMapOpen(open) {
  mapOpen = open;
  mapWin.classList.toggle('open', open);
  mapToggle.textContent = open ? '▾' : '▴';
  mapToggle.setAttribute('aria-expanded', String(open));
  mapToggle.setAttribute('aria-label', open ? '지도 접기' : '지도 펴기');
  try { localStorage.setItem('mmo.mapOpen', open ? '1' : '0'); } catch { /* 이번 접속에만 적용 */ }
}
document.getElementById('map-head').addEventListener('click', () => setMapOpen(!mapOpen));
setMapOpen(mapOpen);
