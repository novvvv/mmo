'use strict';
// 가구 상점과 집 꾸미기: 소지품의 가구 탭, 놓기·치우기·옮기기·돌리기·크기.

// ------------------------------------------------------------ 가구점과 하우징

const DECOR_NAMES = {
  dining_chair: '나무 의자', white_chair: '흰 의자', black_stool: '검은 스툴', bar_stool: '바 스툴', pouf: '푹신 방석', armchair: '안락의자', accent_chair: '포인트 의자',
  sofa_cream: '크림 소파', sofa_l: 'L자 소파', glass_table: '유리 탁자', coffee_round: '둥근 탁자', round_dining: '둥근 식탁', long_table: '긴 식탁',
  bed: '검은 침대', linen_bed: '리넨 침대', vanity: '화장대', bookshelf: '책장', wardrobe: '옷장', kitchen_counter: '주방 조리대', aquarium: '수족관', shade_lamp: '갓 스탠드',
  tall_plant: '키 큰 화분', monstera: '몬스테라', plant_small: '작은 화분', book_pile: '책 더미',
  rug_plain: '민무늬 카펫', rug_diamond: '다이아 카펫', rug_shag: '털 러그', rug_leaf: '나뭇잎 러그',
  wall_frames: '액자 세트', round_mirror: '둥근 거울', window: '창문', wall_clock: '벽시계',
  record_player: '레코드 플레이어', kitchen_bar: '주방 바', dining_table: '식탁', stool: '나무 스툴', kitchen_island: '아일랜드 식탁',
  floor_lamp: '스탠드 조명', lantern_lamp: '랜턴 조명', glass_partition: '유리 칸막이', big_window: '큰 창', sheer_window: '커튼 창',
  fireplace: '벽난로', tv_wall: '벽걸이 TV', tv: 'TV 수납장', dart_stand: '다트판', omok_table: '오목판',
  rug_cat_black: '엎드린 고양이 러그', rug_cat_stand: '검은 고양이 러그', rug_bunny: '토끼 러그', rug_long_cat: '기지개 고양이 러그',
  rug_puppy: '강아지 쿠션 러그', rug_8ball: '8볼 러그', rug_cloud: '구름 러그', rug_heart: '하트 러그',
  pendant_frame: '나무 틀 펜던트', pendant_cone: '검은 펜던트',
  arcade_shooter: '별똥 슈팅 오락기', arcade_bricks: '벽돌깨기 오락기', arcade_mines: '지뢰찾기 오락기', arcade_chess: '체스판',
};
const HANGING = { pendant_frame: 106, pendant_cone: 96 };  // 매달린 조명: 놓을 때 갓이 마우스 자리에 오도록 기준점을 이만큼 아래로
const GAME_FURNITURE = { dart_stand: '다트', omok_table: '오목' };  // 놓으면 그 방에서 게임을 할 수 있는 가구
const DECOR_WALL = 1, DECOR_FLAT = 2, DECOR_WALL_TOP = 112, DECOR_WALL_BOTTOM = 16;
const ICON_W = 176, ICON_H = 128, ICON_SKETCH_W = 460, ICON_SKETCH_H = 340;

const furnShop = document.getElementById('furn-shop');
const furnList = document.getElementById('furn-list');
const arcadeList = document.getElementById('arcade-list');   // 상점의 오락기 탭
const furnGold = document.getElementById('furn-gold');
const furnSale = document.getElementById('furn-sale');
const shopOpenButton = document.getElementById('shop-open');
const decorList = document.getElementById('decor-list');
const decorHint = document.getElementById('decor-hint');
const decorTakeButton = document.getElementById('decor-take');
const decorDyeButton = document.getElementById('decor-dye');
const decorMoveButton = document.getElementById('decor-move');
const decorTurnButton = document.getElementById('decor-turn');
const decorSizeButton = document.getElementById('decor-size');
const decorSizeRow = document.getElementById('decor-size-row');
const decorSizeRange = document.getElementById('decor-size-range');
const decorSizeVal = document.getElementById('decor-size-val');
const decorDyes = document.getElementById('decor-dyes');
const iconCache = new Map();
const furnButtons = [];
let myFurn = [];
let decorItems = [];
let decorPlacing = -1;   // 놓으려고 고른 가구 번호. 없으면 -1
let decorDyedIndex = -1; // 고른 것이 염색한 가구면 소지품의 칸 번호
let decorTaking = false;
let decorMoving = false;  // 옮기기 모드
let decorTurning = false; // 돌리기 모드
let moveItem = null;      // 옮기려고 집어 든 가구
let decorSizing = false;  // 크기 모드
let sizeItem = null;      // 크기를 바꾸려고 고른 가구
let sizePreviewTimer = 0;
let mouseWorld = null;
let bagTab = 'items';          // 소지품 창의 탭: 'items' 또는 'furn'
let decorNotice = '';          // 집 밖에서 가구를 눌렀을 때처럼 잠깐 보여 줄 안내

// 가구 그림을 큰 캔버스에 그린 뒤 그림이 있는 곳만 잘라 작은 아이콘을 만든다. tint 가 있으면 물들인다.
function furnitureIcon(kind, tint = '') {
  const key = tint ? `${kind}|${tint}` : kind;
  if (iconCache.has(key)) return iconCache.get(key);
  if (tint) {
    const icon = document.createElement('canvas');
    icon.width = ICON_W;
    icon.height = ICON_H;
    const c = icon.getContext('2d', { willReadFrequently: true });
    c.drawImage(furnitureIcon(kind), 0, 0);
    const image = c.getImageData(0, 0, ICON_W, ICON_H);
    applyTint(image.data, tint);
    c.putImageData(image, 0, 0);
    if (iconCache.size > 400) iconCache.clear();
    iconCache.set(key, icon);
    return icon;
  }
  const sketch = document.createElement('canvas');
  sketch.width = ICON_SKETCH_W;
  sketch.height = ICON_SKETCH_H;
  const c = sketch.getContext('2d', { willReadFrequently: true });
  drawOn(c, () => FURNITURE[kind]({ k: kind, x: ICON_SKETCH_W / 2, y: ICON_SKETCH_H - 40 }, 0, 0));
  const { data } = c.getImageData(0, 0, ICON_SKETCH_W, ICON_SKETCH_H);
  let x0 = ICON_SKETCH_W, y0 = ICON_SKETCH_H, x1 = 0, y1 = 0;
  for (let y = 0; y < ICON_SKETCH_H; y++) {
    for (let x = 0; x < ICON_SKETCH_W; x++) {
      if (data[(y * ICON_SKETCH_W + x) * 4 + 3] < 20) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const icon = document.createElement('canvas');
  icon.width = ICON_W;
  icon.height = ICON_H;
  if (x1 > x0 && y1 > y0) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1, scale = Math.min((ICON_W - 8) / w, (ICON_H - 8) / h, 2);
    icon.getContext('2d').drawImage(sketch, x0, y0, w, h, (ICON_W - w * scale) / 2, (ICON_H - h * scale) / 2, w * scale, h * scale);
  }
  iconCache.set(key, icon);
  return icon;
}

function iconCopy(kind, tint = '') {
  const copy = document.createElement('canvas');
  copy.width = ICON_W;
  copy.height = ICON_H;
  copy.getContext('2d').drawImage(furnitureIcon(kind, tint), 0, 0);
  return copy;
}

const FURN_PAGE = 12;   // 상점의 가구 한 쪽
const BAG_FURN_PAGE = 9;   // 소지품 가구 탭의 한 쪽 (3줄)

function buildFurnShop() {
  if (furnButtons.length) return;
  terrain.catalog.forEach((item, i) => {
    const cell = document.createElement('div');
    cell.className = 'furn-cell';
    const name = document.createElement('div');
    name.textContent = DECOR_NAMES[item.k] || item.k;
    const owned = document.createElement('small');
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn';
    button.textContent = item.price ? `${item.price} G` : '무료로 받기';
    button.addEventListener('click', () => ws.send(`decor buy ${i}`));
    const arcade = ARCADE_KINDS[item.k] !== undefined;
    if (GAME_FURNITURE[item.k] || arcade) {
      const tag = document.createElement('small');
      tag.className = 'game-tag';
      tag.textContent = item.k === 'arcade_chess' ? '게임 · 1~2인 대국' : arcade ? `게임 · 1~2인 ${ARCADE_KINDS[item.k] < 2 ? '협동' : '대결'}` : `게임 · ${GAME_FURNITURE[item.k]}`;
      cell.append(iconCopy(item.k), name, tag, owned, button);
    } else if (isGardenKind(item.k)) {
      const tag = document.createElement('small');
      tag.className = 'game-tag';
      tag.textContent = isPlotKind(item.k) ? '텃밭 · 집 안과 마당에' : '마당 꾸미기';
      cell.append(iconCopy(item.k), name, tag, owned, button);
    } else {
      cell.append(iconCopy(item.k), name, owned, button);
    }
    (arcade ? arcadeList : furnList).append(cell);
    furnButtons.push({ button, owned, price: item.price });
  });
}

function refreshFurnShop() {
  furnButtons.forEach(({ button, owned, price }, i) => {
    button.disabled = myGold < price;
    owned.textContent = `보유 ${myFurn[i] || 0}개`;
  });
}

function setFurnShop(open, anywhere = false) {
  if (open) {
    buildFurnShop();
    refreshFurnShop();
    paginate(furnList, FURN_PAGE);
    furnSale.textContent = terrain.catalog.every((item) => item.price === 0) ? '테스트 기간 · 전부 0원' : '';
    Sound.play('page');
  }
  furnShop.hidden = !open;
  if (open) {
    setShopTab(shopTab);
    restoreWindow(furnShop, 'shop');
  }
}
document.getElementById('furn-close').addEventListener('click', () => setFurnShop(false));
shopOpenButton.addEventListener('click', () => setFurnShop(furnShop.hidden, true));

function inHouse() {
  return !!terrain && zone > 0 && terrain.buildings[terrain.zones[zone].b].k === 'house';
}

// 집 문 근처(그 집의 마당)에 서 있는지
function nearHouseDoor(self) {
  return terrain.buildings.some((b) => b.k === 'house' && !b.in && Math.hypot(b.door[0] - self.x, b.door[1] - self.y) < (terrain.farm?.yard || 300));
}

// 가구를 놓을 수 있는 곳: 집 안, 그리고 텃밭과 마당 꾸미기를 놓는 마을(집 근처 마당)
function canDecorate() {
  return inHouse() || (!!terrain && zone === 0);
}

// 소지품 창의 가구 탭: 가진 가구를 보여 주고, 집 안에서 골라 방을 누르면 놓는다.
// 염색한 가구는 색마다 한 칸씩 따로 보이고, 칸 오른쪽 아래에 물방울 표시가 붙는다.
function renderDecorPanel() {
  const total = myFurn.reduce((sum, n) => sum + (n || 0), 0) + myDyed.length;
  bagFurnCount.textContent = total ? String(total) : '';
  if (bagEl.hidden || bagTab !== 'furn' || !terrain) return;
  decorList.textContent = '';
  const cell = (kind, label, dyedIndex, tint) => {
    const item = terrain.catalog[kind];
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.dataset.kind = String(kind);
    if (dyedIndex >= 0) button.dataset.dyed = String(dyedIndex);
    button.className = dyedIndex >= 0 ? 'furn-cell dyed' : 'furn-cell';
    button.title = dyedIndex >= 0 ? '염색한 가구' : '';
    button.setAttribute('aria-pressed', String(decorPlacing === kind && decorDyedIndex === dyedIndex));
    const name = document.createElement('span');
    name.textContent = label;
    button.append(iconCopy(item.k, tint), name);
    button.addEventListener('click', () => pickFurniture(kind, dyedIndex));
    decorList.append(button);
  };
  terrain.catalog.forEach((item, i) => {
    if (myFurn[i]) cell(i, `${DECOR_NAMES[item.k] || item.k} ×${myFurn[i]}`, -1, '');
  });
  myDyed.forEach(([kind, tint], i) => cell(kind, DECOR_NAMES[terrain.catalog[kind].k] || terrain.catalog[kind].k, i, tint));
  if (!total) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '가진 가구가 없습니다. 오른쪽 위 상점에서 받아 오세요.';
    decorList.append(empty);
  }
  paginate(decorList, BAG_FURN_PAGE);
  decorTakeButton.disabled = !canDecorate();
  decorMoveButton.disabled = !canDecorate();
  decorTurnButton.disabled = !canDecorate();
  decorSizeButton.disabled = !canDecorate();
  decorDyeButton.disabled = decorPlacing < 0;
  syncSizeRow();
  decorDyes.textContent = `염료 ${myDye}개`;
  decorHint.textContent = decorSizing ? (sizeItem ? `${DECOR_NAMES[sizeItem.info.k] || sizeItem.info.k}: 막대나 −, +로 크기를 바꿉니다. 이 가구는 ${sizeItem.info.smin}~${sizeItem.info.smax}%까지 돼요.` : '크기를 바꿀 가구를 누르세요. 가구마다 바꿀 수 있는 범위가 달라요.')
    : decorTurning ? '돌릴 가구를 누르세요. 침대·깔개·텃밭은 누를 때마다 90도씩 돌고, 그 밖의 가구는 좌우로 뒤집혀요.'
    : decorMoving ? (moveItem ? '놓을 곳을 누르세요. Esc로 내려놓기를 취소합니다.' : '옮길 가구를 누르세요. 내 가구, 집 가구, 동거인의 가구를 옮길 수 있어요.')
    : decorTaking ? '내 가구, 집 가구, 동거인의 가구를 누르면 치웁니다. 동거인의 가구는 주인에게 돌아가요.'
    : decorPlacing >= 0 ? (inHouse() ? '방을 눌러 놓습니다. 염색을 누르면 색을 바꿉니다. Esc로 취소합니다.'
      : zone === 0 && isGardenKind(terrain.catalog[decorPlacing].k) ? '집 근처 마당을 눌러 놓습니다. 집 문에서 가까운 빈 땅이면 돼요. Esc로 취소합니다.'
        : zone === 0 ? '이 가구는 집 안에 놓아요. 텃밭과 마당 꾸미기는 집 근처 마당에도 놓을 수 있어요.' : '집 안에서 방을 누르면 놓을 수 있습니다. 염색은 어디서나 됩니다.')
      : total ? '가구를 고른 뒤 방을 눌러 배치하거나 염색합니다.' : '';
}

function pickFurniture(kind, dyedIndex = -1) {
  if (decorPlacing === kind && decorDyedIndex === dyedIndex) setDecorPlacing(-1);
  else setDecorPlacing(kind, dyedIndex);
}

function setDecorPlacing(kind, dyedIndex = -1) {
  decorPlacing = kind;
  decorDyedIndex = kind >= 0 ? dyedIndex : -1;
  if (kind >= 0) {
    setDecorTaking(false);
    if (decorMoving) setDecorMoving(false);
    if (decorTurning) setDecorTurning(false);
    stopSizing();
  }
  renderDecorPanel();
}

function setDecorTaking(on) {
  decorTaking = on;
  decorTakeButton.setAttribute('aria-pressed', String(on));
  if (on) {
    decorPlacing = -1;
    decorDyedIndex = -1;
    setDecorMoving(false);
    setDecorTurning(false);
    stopSizing();
  }
  renderDecorPanel();
}

// 옮기기: 가구를 눌러 집어 들고, 놓을 곳을 누른다. 내 것, 집 가구, 동거인의 것만 옮길 수 있다.
function setDecorMoving(on) {
  decorMoving = on;
  moveItem = null;
  decorMoveButton.setAttribute('aria-pressed', String(on));
  if (on) {
    stopSizing();
    decorTurning = false;
    decorTurnButton.setAttribute('aria-pressed', 'false');
    decorPlacing = -1;
    decorDyedIndex = -1;
    decorTaking = false;
    decorTakeButton.setAttribute('aria-pressed', 'false');
  }
  renderDecorPanel();
}
decorMoveButton.addEventListener('click', () => setDecorMoving(!decorMoving));

// 돌리기: 누른 가구를 좌우로 돌린다. 옮기기와 같은 가구만 돌릴 수 있다.
function setDecorTurning(on) {
  decorTurning = on;
  decorTurnButton.setAttribute('aria-pressed', String(on));
  if (on) {
    stopSizing();
    decorPlacing = -1;
    decorDyedIndex = -1;
    decorTaking = false;
    decorTakeButton.setAttribute('aria-pressed', 'false');
    decorMoving = false;
    moveItem = null;
    decorMoveButton.setAttribute('aria-pressed', 'false');
  }
  renderDecorPanel();
}
decorTurnButton.addEventListener('click', () => setDecorTurning(!decorTurning));

// 크기: 가구를 눌러 고르고, 막대나 −, + 로 키우거나 줄인다. 범위는 가구마다 서버가 정한다.
function setDecorSizing(on) {
  decorSizing = on;
  sizeItem = null;
  decorSizeButton.setAttribute('aria-pressed', String(on));
  if (on) {
    decorPlacing = -1;
    decorDyedIndex = -1;
    decorTaking = false;
    decorTakeButton.setAttribute('aria-pressed', 'false');
    decorMoving = false;
    moveItem = null;
    decorMoveButton.setAttribute('aria-pressed', 'false');
    decorTurning = false;
    decorTurnButton.setAttribute('aria-pressed', 'false');
  }
  renderDecorPanel();
}
function stopSizing() {
  if (!decorSizing) return;
  decorSizing = false;
  if (sizeItem) sizeItem.preview = undefined;
  sizeItem = null;
  decorSizeButton.setAttribute('aria-pressed', 'false');
}
decorSizeButton.addEventListener('click', () => setDecorSizing(!decorSizing));

function syncSizeRow() {
  decorSizeRow.hidden = !decorSizing || !sizeItem;
  if (decorSizeRow.hidden) return;
  decorSizeRange.min = String(sizeItem.info.smin);
  decorSizeRange.max = String(sizeItem.info.smax);
  const shown = sizeItem.preview ?? sizeItem.scale;
  decorSizeRange.value = String(shown);
  decorSizeVal.textContent = `${shown}%`;
  decorSizeButton.setAttribute('aria-pressed', 'true');
}

// 막대를 끄는 동안은 그 크기로 미리 그리고, 놓으면 서버에 보낸다. 서버가 거절하면 원래 크기로 돌아온다.
function sendSize(percent) {
  if (!sizeItem) return;
  const value = Math.max(sizeItem.info.smin, Math.min(sizeItem.info.smax, Math.round(percent)));
  sizeItem.preview = value;
  syncSizeRow();
  if (value !== sizeItem.scale) ws.send(`decor scale ${sizeItem.id} ${value}`);
  clearTimeout(sizePreviewTimer);
  const item = sizeItem;
  sizePreviewTimer = setTimeout(() => {
    item.preview = undefined;
    if (item === sizeItem) syncSizeRow();
  }, 800);
}
decorSizeRange.addEventListener('input', () => {
  if (!sizeItem) return;
  sizeItem.preview = Number(decorSizeRange.value);
  decorSizeVal.textContent = `${decorSizeRange.value}%`;
});
decorSizeRange.addEventListener('change', () => sendSize(Number(decorSizeRange.value)));
document.getElementById('decor-size-down').addEventListener('click', () => sizeItem && sendSize((sizeItem.preview ?? sizeItem.scale) - 5));
document.getElementById('decor-size-up').addEventListener('click', () => sizeItem && sendSize((sizeItem.preview ?? sizeItem.scale) + 5));

// 놓인 가구의 배율. 크기 막대를 끄는 중이면 미리 보는 크기.
// 90도씩 돌려 놓을 수 있는 가구: 깔개와 텃밭, 침대 (서버 home/decor.hpp 의 rotatable 과 같다)
function canRotate(item) {
  return item.place === DECOR_FLAT || item.k === 'bed' || item.k === 'linen_bed';
}

// 돌린 가구의 치수: 가로와 세로가 바뀐다 (서버 home/decor.hpp 의 turned 와 같다)
function turnedInfo(item, rot) {
  if (!(rot % 2)) return item;
  return item.place === DECOR_FLAT ? { ...item, hw: item.d, d: item.hw } : { ...item, hw: item.d / 2, d: item.hw * 2 };
}

// 돌린 가구를 그릴 자리: 지금 모양의 가운데(cy)와, 돌리기 전 그림의 기준점(ay)
function turnedPivot(decor, y) {
  const base = decor.base, s = decorScale(decor);
  if (base.place === DECOR_FLAT) return { cy: y, ay: y };
  const cy = y - turnedInfo(base, decor.rot).d * s / 2;
  return { cy, ay: cy + base.d * s / 2 };
}

function decorScale(d) {
  return d ? (d.preview ?? d.scale ?? 100) / 100 : 1;
}

// 크기를 바꾸는 기준점: 바닥 기준점. 매달린 조명은 갓 자리를 기준으로 커지고 작아진다.
function scalePivotY(k, y) {
  return y - (HANGING[k] || 0);
}

// 돌려 놓은 가구는 그림 범위도 좌우로 뒤집히고, 크기를 바꾼 가구는 범위도 같이 커진다.
// mw, mh 는 원래 크기의 그림 칸(누른 곳 판정용)이다.
function itemBounds(d) {
  const b = spriteBounds(d.info.k);
  const s = decorScale(d), lift = HANGING[d.info.k] || 0;
  if (d.rot) {   // 돌린 가구: 그림 범위를 가운데를 중심으로 돌린다. 누른 곳은 범위로만 본다
    const { cy, ay } = turnedPivot(d, d.y);
    let x0 = b.dx * s, y0 = b.dy * s + ay - cy, x1 = x0 + b.w * s, y1 = y0 + b.h * s;
    for (let k = 0; k < d.rot; k++) [x0, y0, x1, y1] = [-y1, x0, -y0, x1];
    return { dx: x0, dy: y0 + cy - d.y, w: x1 - x0, h: y1 - y0, s, mask: null, mw: 0, mh: 0 };
  }
  const w = b.w * s, h = b.h * s;
  let dx = b.dx * s;
  const dy = (b.dy + lift) * s - lift;
  if (d.flip) dx = -(dx + w);
  return { dx, dy, w, h, s, mask: b.mask, mw: b.w, mh: b.h };
}
decorTakeButton.addEventListener('click', () => setDecorTaking(!decorTaking));
decorDyeButton.addEventListener('click', () => {
  if (decorPlacing < 0) return;
  const kind = decorPlacing, dyed = decorDyedIndex;
  setDecorPlacing(-1);  // 염색하는 동안 방을 눌러도 놓이지 않게
  openDye(kind, dyed);
});

// 가구를 놓거나 회수하는 중인지: 소지품 창의 가구 탭이 집 안에서 열려 있어야 한다.
function decorMode() {
  return canDecorate() && !bagEl.hidden && bagTab === 'furn';
}

function setBagTab(tab) {
  bagTab = tab;
  bagTabItems.setAttribute('aria-selected', String(tab === 'items'));
  bagTabFurn.setAttribute('aria-selected', String(tab === 'furn'));
  bagTabPets.setAttribute('aria-selected', String(tab === 'pets'));
  bagTabMates.setAttribute('aria-selected', String(tab === 'mates'));
  bagPaneMates.hidden = tab !== 'mates';
  if (tab === 'mates') renderBagMates();
  bagPaneItems.hidden = tab !== 'items';
  bagPaneFurn.hidden = tab !== 'furn';
  bagPanePets.hidden = tab !== 'pets';
  if (tab === 'pets') renderBagPets();
  if (tab !== 'furn') {
    decorPlacing = -1;
    setDecorTaking(false);
    setDecorMoving(false);
    setDecorTurning(false);
    stopSizing();
  }
  hideItemTip();
  renderDecorPanel();
}
bagTabItems.addEventListener('click', () => setBagTab('items'));
bagTabFurn.addEventListener('click', () => setBagTab('furn'));
bagTabPets.addEventListener('click', () => setBagTab('pets'));
bagTabMates.addEventListener('click', () => setBagTab('mates'));

// 스탠드 스위치는 방에 스탠드가 있을 때만. 설치형 스탠드는 조명 메시지 뒤에 오는 decor 로 알게 되므로 그때도 다시 본다.
function syncLampRow() {
  if (!terrain || lightPanel.hidden) return;
  lightLamp.closest('.bag-row').hidden = !terrain.furnByZone[zone].some((f) => f.k === 'floor_lamp' || f.k === 'lantern_lamp');
}

function applyDecor(msg) {
  if (msg.z !== zone || !terrain) return;
  const changed = decorItems.length !== msg.p.length;
  // turn 은 한 숫자에 좌우 뒤집기(1)와 90도씩 돌린 횟수(×2). info 는 돌린 모양의 치수, base 는 원래 치수다
  decorItems = msg.p.map(([id, kind, x, y, mine, seats, tint, turn, scale]) => ({ id, kind, x, y, mine: mine > 0, own: mine === 1, mate: mine === 3, seats, tint: tint || '', flip: !!(turn & 1), rot: turn >> 1, scale: scale || 100, info: turnedInfo(terrain.catalog[kind], turn >> 1), base: terrain.catalog[kind] }));
  terrain.furnByZone[zone] = terrain.staticFurn[zone].concat(decorItems.map((d) => ({ k: d.info.k, z: zone, x: d.x, y: d.y, decor: d })));
  rebuildZoneSolids();
  terrain.seats.length = terrain.staticSeats;
  for (const d of decorItems) {
    for (const [index, x, y, fy, lie, side, sy, fx] of d.seats) terrain.seats[index] = { z: zone, x, y, fx: fx || 0, fy, side, lie, sy };
  }
  if (moveItem) moveItem = decorItems.find((d) => d.id === moveItem.id && d.mine) || null;
  if (sizeItem) {
    sizeItem = decorItems.find((d) => d.id === sizeItem.id && d.mine) || null;
    syncSizeRow();
  }
  if (changed && decorSeen) Sound.play('place');
  decorSeen = true;
  syncLampRow();
}
let decorSeen = false;

// 방의 고정 충돌 영역(벽, 고정 가구) 위에 놓인 가구의 충돌 영역을 더한다. 깔개는 밟고 지나간다.
function rebuildZoneSolids() {
  terrain.solidsByZone[zone] = terrain.staticSolids[zone].concat(decorItems.filter((d) => d.info.hw > 0 && d.info.place !== DECOR_FLAT).map((d) => {
    const s = d.scale / 100;
    return [zone, d.x - d.info.hw * s, d.y - d.info.d * s, d.x + d.info.hw * s, d.y];
  }));
}

// 누가 집을 넓히거나 막았다: 그 구역의 모습과 벽을 바꾼다. 지금 있는 방이면 바로 보인다.
function applyZone(msg) {
  if (!terrain) return;
  terrain.zones[msg.z] = msg.zone;
  terrain.staticSolids[msg.z] = msg.solids;
  terrain.solidsByZone[msg.z] = msg.solids.slice();
  terrain.staticFurn[msg.z] = msg.furn;   // 뚫은 벽에 걸려 있던 고정 장식은 빠져 있다
  terrain.furnByZone[msg.z] = msg.furn.slice();
  if (msg.z === zone) {
    rebuildZoneSolids();
    terrain.furnByZone[zone] = terrain.staticFurn[zone].concat(decorItems.map((d) => ({ k: d.info.k, z: zone, x: d.x, y: d.y, decor: d })));
  }
  renderExpandPane();
}

function clearDecor() {
  decorItems = [];
  decorSeen = false;
  if (terrain) terrain.seats.length = terrain.staticSeats;
  decorPlacing = -1;
  decorDyedIndex = -1;
  setDecorTaking(false);
  setDecorMoving(false);
  setDecorTurning(false);
  stopSizing();
}

// 벽걸이는 벽 높이로 맞춰 주고, 매달린 조명은 갓이 누른 곳에 오도록 기준점(바닥)을 아래로 내린다.
function decorPoint(item, x, y) {
  if (HANGING[item.k]) return { x, y: y + HANGING[item.k] };
  if (item.place !== DECOR_WALL) return { x, y };
  const room = terrain.zones[zone];
  const floor = (room.floors || []).filter((f) => x >= f[0] && x <= f[2]).sort((a, b) => Math.abs(a[1] - y) - Math.abs(b[1] - y))[0];
  const top = floor ? floor[1] : 0;
  return { x, y: Math.min(top - DECOR_WALL_BOTTOM - 40, Math.max(top - DECOR_WALL_TOP + 40, y)) };
}

// 치우거나 옮길 가구 고르기: 누른 곳에 실제로 그려진 가구 중 화면 맨 앞(아래쪽)에 있는 것을 고른다.
// 깔개는 늘 맨 아래로 친다. 그림이 없는 곳이면 그림 범위가 가장 작은 가구를 고른다.
function decorAtPoint(x, y) {
  let best = null, bestRank = -Infinity, fallback = null, fallbackArea = Infinity;
  for (const d of decorItems) {
    if (!d.mine) continue;
    const b = itemBounds(d);
    const ox = x - (d.x + b.dx), oy = y - (d.y + b.dy);
    if (ox < -4 || oy < -4 || ox > b.w + 4 || oy > b.h + 4) continue;
    const area = b.w * b.h;
    if (area < fallbackArea) {
      fallback = d;
      fallbackArea = area;
    }
    const lx = Math.floor(ox / b.s), ly = Math.floor(oy / b.s);
    if (b.mask && (lx < 0 || ly < 0 || lx >= b.mw || ly >= b.mh || !b.mask[ly * b.mw + (d.flip ? b.mw - 1 - lx : lx)])) continue;
    const rank = (FLOOR_FURNITURE.has(d.info.k) ? -10000 : 0) + d.y;
    if (rank > bestRank) {
      best = d;
      bestRank = rank;
    }
  }
  return best || fallback;
}

function handleDecorClick(screenX, screenY) {
  if (!decorMode() || !dyeEl.hidden || (decorPlacing < 0 && !decorTaking && !decorMoving && !decorTurning && !decorSizing)) return false;
  const [camX, camY] = camera(innerWidth, innerHeight);
  const x = screenX + camX, y = screenY + camY;
  if (decorSizing) {
    const item = decorAtPoint(x, y);
    if (item) {
      if (sizeItem && sizeItem !== item) sizeItem.preview = undefined;
      sizeItem = item;
      Sound.play('page');
    }
    renderDecorPanel();
    return true;
  }
  if (decorTurning) {
    const item = decorAtPoint(x, y);
    if (item) ws.send(`decor turn ${item.id}`);
    return true;
  }
  if (decorMoving) {
    if (!moveItem) {
      moveItem = decorAtPoint(x, y);
      if (moveItem) Sound.play('page');
    } else {
      const point = decorPoint(moveItem.info, x, y);
      ws.send(`decor move ${moveItem.id} ${Math.round(point.x)} ${Math.round(point.y)}`);
      moveItem = null;
    }
    renderDecorPanel();
    return true;
  }
  if (decorTaking) {
    const item = decorAtPoint(x, y);
    if (item) ws.send(`decor take ${item.id}`);
    return true;
  }
  const point = decorPoint(terrain.catalog[decorPlacing], x, y);
  if (decorDyedIndex >= 0) {  // 염색한 가구는 한 칸에 하나뿐이다
    ws.send(`decor placedyed ${decorDyedIndex} ${Math.round(point.x)} ${Math.round(point.y)}`);
    setDecorPlacing(-1);
    return true;
  }
  ws.send(`decor place ${decorPlacing} ${Math.round(point.x)} ${Math.round(point.y)}`);
  if (myFurn[decorPlacing] <= 1) setDecorPlacing(-1);
  return true;
}

function drawDecorOverlay(now, night) {
  if (!decorMode()) return;
  if (decorTaking || decorMoving || decorTurning || decorSizing) {   // 치우거나 옮기거나 돌릴 수 있는 가구에 테두리. 동거인의 가구는 하늘색, 크기를 고르는 가구는 분홍
    ctx.lineWidth = 2;
    for (const d of decorItems) {
      if (!d.mine || d === moveItem) continue;
      const b = itemBounds(d);
      ctx.lineWidth = d === sizeItem ? 3 : 2;
      ctx.strokeStyle = d === sizeItem ? '#ff6fb5' : d.mate ? '#7fc8ff' : decorMoving ? '#9be27f' : '#ffd24a';
      ctx.strokeRect(d.x + b.dx, d.y + b.dy, b.w, b.h);
    }
  }
  if (moveItem && mouseWorld) {   // 집어 든 가구를 마우스 자리에 흐리게
    const { x, y } = decorPoint(moveItem.info, mouseWorld.x, mouseWorld.y);
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawFurniturePiece({ k: moveItem.info.k, x, y, decor: { tint: moveItem.tint, flip: moveItem.flip, scale: moveItem.scale, rot: moveItem.rot, base: moveItem.base } }, now, night);
    ctx.restore();
    const b = itemBounds(moveItem);
    ctx.strokeStyle = '#9be27f';
    ctx.lineWidth = 2;
    ctx.strokeRect(moveItem.x + b.dx, moveItem.y + b.dy, b.w, b.h);
  }
  if (decorPlacing < 0 || !mouseWorld) return;
  const item = terrain.catalog[decorPlacing], { x, y } = decorPoint(item, mouseWorld.x, mouseWorld.y);
  ctx.save();
  ctx.globalAlpha = 0.68;
  drawFurniturePiece({ k: item.k, x, y, decor: decorDyedIndex >= 0 ? { tint: myDyed[decorDyedIndex]?.[1] } : null }, now, night);
  ctx.restore();
  if (item.hw > 0) {
    ctx.fillStyle = 'rgba(79, 200, 140, 0.26)';
    if (item.place === DECOR_FLAT) ctx.fillRect(x - item.hw, y - item.d, item.hw * 2, item.d * 2);
    else ctx.fillRect(x - item.hw, y - item.d, item.hw * 2, item.d);
  }
}

// 가구 그림이 기준점(x, y)에서 차지하는 범위. 회수할 때 누를 곳과 표시 상자에 쓴다.
const spriteBoundsCache = new Map();
function spriteBounds(kind) {
  const cached = spriteBoundsCache.get(kind);
  if (cached) return cached;
  const sketch = document.createElement('canvas');
  sketch.width = SPRITE_W;
  sketch.height = SPRITE_H;
  const c = sketch.getContext('2d', { willReadFrequently: true });
  drawOn(c, () => FURNITURE[kind]({ k: kind, x: SPRITE_X, y: SPRITE_Y }, 0, 0));
  const { data } = c.getImageData(0, 0, SPRITE_W, SPRITE_H);
  let x0 = SPRITE_W, y0 = SPRITE_H, x1 = -1, y1 = -1;
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      if (data[(y * SPRITE_W + x) * 4 + 3] < 40) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const bounds = x1 >= x0 ? { dx: x0 - SPRITE_X, dy: y0 - SPRITE_Y, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { dx: -20, dy: -40, w: 40, h: 44 };
  bounds.mask = new Uint8Array(bounds.w * bounds.h);   // 그림이 있는 칸 (누른 곳 판정)
  if (x1 >= x0) {
    for (let y = 0; y < bounds.h; y++) {
      for (let x = 0; x < bounds.w; x++) bounds.mask[y * bounds.w + x] = data[((y + y0) * SPRITE_W + x + x0) * 4 + 3] >= 40 ? 1 : 0;
    }
  }
  spriteBoundsCache.set(kind, bounds);
  return bounds;
}

// 방과 장면이 가구를 그릴 때 거치는 곳. 염색한 가구는 물들인 그림과 오른쪽 아래 물방울 표시로 그린다.
function drawFurniturePiece(f, now, night) {
  const s = decorScale(f.decor);
  if (f.decor?.rot) {   // 90도씩 돌려 놓은 깔개, 텃밭, 침대: 가운데를 중심으로 돌려 그린다
    const { cy, ay } = turnedPivot(f.decor, f.y);
    ctx.save();
    ctx.translate(f.x, cy);
    ctx.rotate(f.decor.rot * Math.PI / 2);
    ctx.translate(-f.x, -cy);
    ctx.translate(f.x, ay);
    ctx.scale(s, s);
    ctx.translate(-f.x, -ay);
    drawFurnitureImage({ ...f, y: ay }, now, night);
    ctx.restore();
    return;
  }
  if (f.decor?.flip || s !== 1) {   // 돌려 놓았거나 크기를 바꾼 가구: 기준점을 중심으로 뒤집고 키워 그린다
    const py = scalePivotY(f.k, f.y);
    ctx.save();
    ctx.translate(f.x, py);
    ctx.scale(f.decor.flip ? -s : s, s);
    ctx.translate(-f.x, -py);
    drawFurnitureImage(f, now, night);
    ctx.restore();
    return;
  }
  drawFurnitureImage(f, now, night);
}

function drawFurnitureImage(f, now, night) {
  const tint = f.decor?.tint;
  if (!tint) {
    FURNITURE[f.k](f, now, night);
    return;
  }
  const sprite = tintedSprite(f.k, tint, night);
  if (sprite.canvas.width) ctx.drawImage(sprite.canvas, f.x + sprite.dx, f.y + sprite.dy);
  FURNITURE_FX[f.k]?.(f, now, night);   // 음표, 불꽃, 물고기, 시계 바늘, TV 화면은 물들이지 않고 매 프레임 움직인다
}
