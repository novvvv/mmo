'use strict';
// 집 외관: 모양, 벽, 지붕, 문, 장식 고르기.

// ---- 집 외관: 벽 색, 지붕 색, 문, 장식을 골라 미리 본 뒤 꾸민다. 그 집 안이나 밖에서 그 집 문 앞에서
let exteriors = new Map();   // 집 구역 → { wall, roof, door, deco }
let extTarget = -1;          // 지금 꾸미는 집 (구역)
let extDraft = null;         // 고르는 중인 모습
const extPreview = document.getElementById('ext-preview');
const extName = document.getElementById('ext-name');
const extNote = document.getElementById('ext-note');
const extApply = document.getElementById('ext-apply');
const extReset = document.getElementById('ext-reset');
const extRows = { form: document.getElementById('ext-forms'), wall: document.getElementById('ext-walls'), roof: document.getElementById('ext-roofs'), door: document.getElementById('ext-doors'), deco: document.getElementById('ext-decos') };
const EXT_KEYS = ['wall', 'roof', 'door', 'deco', 'form'];

function applyExteriors() {
  if (!terrain) return;
  for (const b of terrain.buildings) if (b.k === 'house') b.ext = exteriors.get(b.room) || NO_EXT;
  terrain.zones.forEach((z, i) => { z.ext = exteriors.get(i) || null; });
}

function exteriorTarget() {
  if (!terrain || !me) return -1;
  if (zone > 0) return terrain.buildings[terrain.zones[zone].b]?.k === 'house' ? zone : -1;
  let best = -1, bestDistance = terrain.extReach || 150;
  for (const b of terrain.buildings) {
    if (b.k !== 'house') continue;
    const distance = Math.hypot(b.door[0] - me.x, b.door[1] - me.y);
    if (distance <= bestDistance) {
      best = b.room;
      bestDistance = distance;
    }
  }
  return best;
}

function extButton(row, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  row.append(button);
  return button;
}

function buildExtPane() {
  if (extRows.wall.childElementCount) return;
  for (const [key, list] of [['wall', EXT_WALLS], ['roof', EXT_ROOFS]]) {
    list.forEach(([label, color], i) => {
      const button = extButton(extRows[key], label, () => pickExt(key, i));
      if (color) button.style.background = color;
      else button.className = 'original';
    });
  }
  EXT_FORMS.forEach((label, i) => {   // 모양: 작은 집 그림 (원래 모양은 그 집의 것을 그릴 수 없어 글자로)
    const button = extButton(extRows.form, label, () => pickExt('form', i));
    if (!i) {
      button.textContent = '원래';
      return;
    }
    const icon = document.createElement('canvas');
    icon.width = 120;
    icon.height = 104;
    drawOn(icon.getContext('2d'), () => {
      ctx.setTransform(0.46, 0, 0, 0.46, 60, 98);
      HOUSE_FORMS[i]({ x: 0, name: '' }, 0, 0, false, { ...NO_EXT, form: i });
    });
    button.append(icon);
  });
  EXT_DOORS.forEach((label, i) => {
    const button = extButton(extRows.door, label, () => pickExt('door', i));
    const icon = document.createElement('canvas');
    icon.width = 52;
    icon.height = 72;
    drawOn(icon.getContext('2d'), () => {
      ctx.scale(2, 2);
      if (i) drawDoorStyle(i, 13, 36, 22, 32, false);
      else {
        box(2, 4, 22, 32, '#5a3418', [8, 8, 0, 0]);
        box(5, 7, 16, 29, '#7a4a24', [6, 6, 0, 0]);
      }
    });
    button.append(icon);
  });
  EXT_DECOS.forEach((label, bit) => {
    const button = extButton(extRows.deco, label, () => {
      if (!extDraft) return;
      extDraft.deco ^= 1 << bit;
      renderExtPane();
    });
    button.textContent = label;
  });
}

function pickExt(key, value) {
  if (!extDraft) return;
  extDraft[key] = value;
  renderExtPane();
}

function renderExtPane() {
  if (furnShop.hidden || shopTab !== 'ext' || !terrain) return;
  buildExtPane();
  const target = exteriorTarget();
  if (target !== extTarget) {
    extTarget = target;
    extDraft = target >= 0 ? { ...(exteriors.get(target) || NO_EXT) } : null;
  }
  const current = target >= 0 ? exteriors.get(target) || NO_EXT : NO_EXT;
  const draft = extDraft || NO_EXT;
  const building = target >= 0 ? terrain.buildings[terrain.zones[target].b] : null;
  extName.textContent = building ? `${building.name}의 집` : '꾸밀 집이 없어요';
  for (const key of ['form', 'wall', 'roof', 'door']) {
    [...extRows[key].children].forEach((button, i) => {
      button.setAttribute('aria-pressed', String(draft[key] === i));
      button.disabled = target < 0;
    });
  }
  [...extRows.deco.children].forEach((button, bit) => {
    button.setAttribute('aria-pressed', String(!!((draft.deco >> bit) & 1)));
    button.disabled = target < 0;
  });
  const changed = !!extDraft && EXT_KEYS.some((key) => extDraft[key] !== current[key]);
  const price = terrain.extPrice || 0;
  extApply.textContent = price ? `꾸미기 (${price} G)` : '꾸미기 (무료)';
  extApply.disabled = !changed || myGold < price;
  extReset.disabled = !changed;
  extNote.textContent = target >= 0
    ? `집 모양과 벽·지붕 색, 문, 장식을 골라 미리 보고 꾸미기를 누르세요. 마을의 모두에게 바뀐 집이 보이고, 집 안의 문도 같은 모양이 돼요.${price ? '' : ' 테스트 기간이라 무료예요.'}`
    : '꾸미고 싶은 집 안에 들어가거나, 마을에서 그 집 문 앞에 서서 열어 주세요.';
  drawExtPreview(performance.now());
}

function drawExtPreview(now) {
  const c = extPreview.getContext('2d');
  const w = extPreview.width, h = extPreview.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = CHRISTMAS ? '#dfe8f1' : '#4a8c47';
  c.fillRect(0, 0, w, h);
  c.fillStyle = CHRISTMAS ? '#f3f7fb' : '#3d7a3a';
  c.fillRect(0, h * 0.82, w, h * 0.18);
  if (extTarget < 0 || !terrain) {
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    c.font = `700 22px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('집 앞이나 집 안에서', w / 2, h / 2 - 12);
    c.fillText('꾸밀 수 있어요', w / 2, h / 2 + 18);
    return;
  }
  const building = terrain.buildings[terrain.zones[extTarget].b];
  const scale = Math.min(w / 340, h / 250);
  drawOn(c, () => {
    ctx.setTransform(scale, 0, 0, scale, w / 2, h * 0.85);
    groundShadow(0, 2, building.halfW + 14, 10);
    drawBuildingStyle({ ...building, x: 0 }, 0, now, nightAmount(now) > 0.3, extDraft || NO_EXT);
  });
}

extApply.addEventListener('click', () => {
  if (!extDraft || extTarget < 0 || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(`ext ${extTarget} ${extDraft.wall} ${extDraft.roof} ${extDraft.door} ${extDraft.deco} ${extDraft.form || 0}`);
  Sound.play('place');
});
extReset.addEventListener('click', () => {
  if (extTarget < 0) return;
  extDraft = { ...(exteriors.get(extTarget) || NO_EXT) };
  renderExtPane();
});
