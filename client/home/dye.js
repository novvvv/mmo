'use strict';
// 가구와 바닥 염색.

// ------------------------------------------------------------ 염색

// 염색 값 "rrggbb-명도-채도". 서버의 validTint 와 같은 규칙이다.
function parseTint(tint) {
  const m = /^([0-9a-f]{6})-(\d{1,3})-(\d{1,3})$/.exec(tint || '');
  if (!m) return null;
  const rgb = parseInt(m[1], 16);
  return { r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255, light: Number(m[2]), sat: Number(m[3]) };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

// 픽셀마다 색조는 염료 색으로, 채도는 염료 채도 × 채도 값으로 바꾼다. 밝기는 가구 전체의 평균 밝기를 염료 밝기로
// 옮기고 명암 차이는 남겨 두므로, 흰 소파도 짙은 원목도 고른 색에 가깝게 물든다. 반투명한 바닥 그림자는 그대로 둔다.
function applyTint(data, tint) {
  const t = parseTint(tint);
  if (!t) return;
  const [dh, ds, dl] = rgbToHsl(t.r, t.g, t.b);
  const sat = clamp(ds * t.sat / 100, 0, 1), lightK = t.light / 100;
  const shadow = (i, l) => data[i + 3] < 150 && l < 0.2;
  let sum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const l = rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
    if (shadow(i, l)) continue;
    sum += l;
    count++;
  }
  const mean = count ? sum / count : 0.5;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const l = rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
    if (shadow(i, l)) continue;
    const [r, g, b] = hslToRgb(dh, sat, clamp((dl + (l - mean) * 0.8) * lightK, 0, 1));
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

const SPRITE_W = 560, SPRITE_H = 440, SPRITE_X = 280, SPRITE_Y = 360;  // 가구 하나를 그려 둘 캔버스와 기준점
const tintedSprites = new Map();

// 염색한 가구 그림. 매 프레임 픽셀을 바꾸면 느리므로 (가구, 색, 밤 정도)마다 한 번 그려 둔다.
function tintedSprite(kind, tint, night) {
  const shade = Math.round(night * 4) / 4;
  const playing = kind === 'record_player' && jazzTrack() ? '|on' : '';   // 레코드는 틀었을 때 라벨과 바늘이 달라진다
  const key = `${kind}|${tint}|${shade}${playing}`;
  const cached = tintedSprites.get(key);
  if (cached) return cached;
  const sketch = document.createElement('canvas');
  sketch.width = SPRITE_W;
  sketch.height = SPRITE_H;
  const c = sketch.getContext('2d', { willReadFrequently: true });
  drawOn(c, () => FURNITURE[kind]({ k: kind, x: SPRITE_X, y: SPRITE_Y, noFx: true }, 0, shade));   // 움직이는 부분은 빼고 몸체만
  const image = c.getImageData(0, 0, SPRITE_W, SPRITE_H);
  let x0 = SPRITE_W, y0 = SPRITE_H, x1 = -1, y1 = -1;
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      if (image.data[(y * SPRITE_W + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  applyTint(image.data, tint);
  c.putImageData(image, 0, 0);
  const sprite = { canvas: document.createElement('canvas'), dx: 0, dy: 0 };
  if (x1 >= x0) {
    sprite.canvas.width = x1 - x0 + 1;
    sprite.canvas.height = y1 - y0 + 1;
    sprite.canvas.getContext('2d').drawImage(sketch, x0, y0, sprite.canvas.width, sprite.canvas.height, 0, 0, sprite.canvas.width, sprite.canvas.height);
    sprite.dx = x0 - SPRITE_X;
    sprite.dy = y0 - SPRITE_Y;
  }
  if (tintedSprites.size > 160) tintedSprites.clear();
  tintedSprites.set(key, sprite);
  return sprite;
}

// ---- 염색 창
const dyePreview = document.getElementById('dye-preview');
const dyeName = document.getElementById('dye-name');
const dyeSwatches = document.getElementById('dye-swatches');
const dyeLeft = document.getElementById('dye-left');
const dyeApply = document.getElementById('dye-apply');
const dyeMore = document.getElementById('dye-more');
const dyeInputs = ['dye-r', 'dye-g', 'dye-b', 'dye-light', 'dye-sat'].map((id) => document.getElementById(id));
const DYE_PRESETS = ['#d64545', '#e8833a', '#e8c547', '#5fae55', '#3c9fb5', '#3f5fc8', '#8a55c8', '#d6609a', '#8a5a3a', '#f2efe6', '#5a5a64', '#23202a'];
let dyeTarget = null;  // { kind, dyed }: 염색할 가구 번호와, 이미 염색한 가구면 소지품 칸 번호. 바닥이면 { floor: true }
let dyeFrame = 0;

function currentTint() {
  const [r, g, b, light, sat] = dyeInputs.map((input) => Number(input.value));
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `${hex}-${light}-${sat}`;
}

function setDyeOpen(open) {
  dyeEl.hidden = !open;
  if (!open) dyeTarget = null;
}

function openDye(kind, dyed) {
  dyeTarget = { kind, dyed };
  const old = dyed >= 0 ? parseTint(myDyed[dyed]?.[1]) : null;
  if (old) [old.r, old.g, old.b, old.light, old.sat].forEach((v, i) => { dyeInputs[i].value = v; });
  dyeName.textContent = DECOR_NAMES[terrain.catalog[kind].k] || terrain.catalog[kind].k;
  setDyeOpen(true);
  restoreWindow(dyeEl, 'dye');
  renderDyePanel();
}

// 방에 놓인 가구를 그 자리에서 염색한다
function openPlacedDye(item) {
  dyeTarget = { kind: item.kind, dyed: -1, placed: item.id };
  const old = parseTint(item.tint);
  if (old) [old.r, old.g, old.b, old.light, old.sat].forEach((v, i) => { dyeInputs[i].value = v; });
  dyeName.textContent = `${DECOR_NAMES[terrain.catalog[item.kind].k] || terrain.catalog[item.kind].k} (놓인 가구)`;
  setDyeOpen(true);
  restoreWindow(dyeEl, 'dye');
  renderDyePanel();
}

function renderDyePanel() {
  if (dyeEl.hidden || !dyeTarget || !terrain) return;
  for (const input of dyeInputs) input.nextElementSibling.textContent = input.value;
  const c = dyePreview.getContext('2d', { willReadFrequently: true });
  c.clearRect(0, 0, dyePreview.width, dyePreview.height);
  if (dyeTarget.floor) {   // 바닥: 지금 바닥재 견본을 물들여 보여 준다
    drawOn(c, () => (FLOOR_MATERIALS[roomFloor] ? paintFloorMaterial(roomFloor, dyePreview.width, dyePreview.height) : paintRoomFloorSample(dyePreview.width, dyePreview.height)));
    const image = c.getImageData(0, 0, dyePreview.width, dyePreview.height);
    applyTint(image.data, currentTint());
    c.putImageData(image, 0, 0);
  } else {
    c.drawImage(furnitureIcon(terrain.catalog[dyeTarget.kind].k, currentTint()), 0, 0);
  }
  dyeLeft.textContent = `염료 ${myDye}개`;
  dyeApply.disabled = myDye <= 0;
  dyeMore.hidden = myDye > 0;
  dyeMore.textContent = terrain.dyePrice ? `염료 사기 ${terrain.dyePrice} G` : '염료 받기 (무료)';
}

DYE_PRESETS.forEach((color) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.style.background = color;
  button.setAttribute('aria-label', `색 ${color}`);
  button.addEventListener('click', () => {
    const rgb = parseInt(color.slice(1), 16);
    [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].forEach((v, i) => { dyeInputs[i].value = v; });
    renderDyePanel();
  });
  dyeSwatches.append(button);
});
for (const input of dyeInputs) {
  input.addEventListener('input', () => {   // 끄는 동안에는 한 프레임에 한 번만 다시 그린다
    cancelAnimationFrame(dyeFrame);
    dyeFrame = requestAnimationFrame(renderDyePanel);
  });
}
dyeApply.addEventListener('click', () => {
  if (!dyeTarget || myDye <= 0) return;
  const tint = currentTint();
  if (dyeTarget.floor) ws.send(`floor dye ${tint}`);
  else if (dyeTarget.placed !== undefined) ws.send(`decor dyeplaced ${dyeTarget.placed} ${tint}`);
  else if (dyeTarget.dyed >= 0) ws.send(`decor redye ${dyeTarget.dyed} ${tint}`);
  else ws.send(`decor dye ${dyeTarget.kind} ${tint}`);
  Sound.play('place');
  setDyeOpen(false);
  setDecorPlacing(-1);
});
dyeMore.addEventListener('click', () => ws.send('decor buydye'));
document.getElementById('dye-close').addEventListener('click', () => setDyeOpen(false));
makeMovable(dyeEl, document.getElementById('dye-head'), 'dye');
