'use strict';
// 상점 창의 탭 (가구, 바닥재, 염료 …).

// ------------------------------------------------------------ 상점 탭: 가구, 바닥재, 염료

const shopTabs = [...document.querySelectorAll('#shop-tabs .rtab')];
const shopPanes = [...document.querySelectorAll('#furn-shop .shop-pane')];
const floorList = document.getElementById('floor-list');
const floorDyeButton = document.getElementById('floor-dye');
const floorUndyeButton = document.getElementById('floor-undye');
const floorTintSwatch = document.getElementById('floor-tint-swatch');
const floorTintText = document.getElementById('floor-tint-text');
floorDyeButton.addEventListener('click', openFloorDye);
floorUndyeButton.addEventListener('click', () => ws.send('floor undye'));
const dyeOwn = document.getElementById('dye-own');
const dyeBuy = document.getElementById('dye-buy');
let shopTab = 'furn';
const floorButtons = [];

function setShopTab(tab) {
  shopTab = tab;
  for (const button of shopTabs) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  for (const pane of shopPanes) pane.hidden = pane.dataset.pane !== tab;
  furnSale.hidden = tab !== 'furn';
  if (tab === 'floor') buildFloorShop();
  if (tab === 'pets') buildPetShop();
  if (tab === 'emotes') buildEmoteShop();
  if (tab === 'expand') renderExpandPane();
  if (tab === 'ext') renderExtPane();
  refreshPagers();
  refreshFloorShop();
  refreshDyeShop();
  refreshPetShop();
  refreshEmoteShop();
}
for (const button of shopTabs) button.addEventListener('click', () => setShopTab(button.dataset.tab));

function buildFloorShop() {
  if (floorButtons.length || !terrain) return;
  for (let i = 0; i < (terrain.floorKinds || FLOOR_MATERIALS.length); i++) {
    const cell = document.createElement('div');
    cell.className = 'furn-cell floor-cell';
    const swatch = document.createElement('canvas');
    swatch.width = 192;
    swatch.height = 128;
    drawOn(swatch.getContext('2d'), () => (FLOOR_MATERIALS[i] ? paintFloorMaterial(i, 192, 128) : paintOriginalFloorSwatch(192, 128)));
    const name = document.createElement('div');
    name.textContent = FLOOR_NAMES[i];
    const owned = document.createElement('small');
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn';
    button.addEventListener('click', () => ws.send(`floor ${i}`));
    cell.append(swatch, name, owned, button);
    floorList.append(cell);
    floorButtons.push({ cell, button, owned });
  }
}

// 산 바닥재(myFloors)는 어느 집에나 무료로 깐다. 안 산 것은 사면서 지금 집에 깐다(집 밖이면 사기만).
// 집의 원래 바닥 견본: 방 꾸밈의 바닥을 그대로 작게 그린다
function paintRoomFloorSample(w, h) {
  const room = terrain.zones[zone];
  const style = ROOM_STYLES[room.floors ? room.floors[0][4] : room.style];
  style.floor({ w, h });
}

function openFloorDye() {
  if (!inHouse()) return;
  dyeTarget = { floor: true };
  const old = parseTint(roomFloorTint);
  if (old) [old.r, old.g, old.b, old.light, old.sat].forEach((v, i) => { dyeInputs[i].value = v; });
  dyeName.textContent = `바닥 · ${FLOOR_NAMES[roomFloor]}`;
  setDyeOpen(true);
  restoreWindow(dyeEl, 'dye');
  renderDyePanel();
}

function refreshFloorDyeBar() {
  const here = inHouse();
  floorDyeButton.disabled = !here;
  floorUndyeButton.disabled = !here || !roomFloorTint;
  const t = parseTint(roomFloorTint);
  floorTintSwatch.style.background = t ? `rgb(${t.r}, ${t.g}, ${t.b})` : '';
  floorTintText.textContent = !here ? '집 안에서 바닥을 염색할 수 있어요' : t ? '지금 바닥은 염색되어 있어요' : '지금 바닥은 원래 색이에요';
}

function refreshFloorShop() {
  refreshFloorDyeBar();
  floorButtons.forEach(({ cell, button, owned }, i) => {
    const have = i === 0 || !!(myFloors & (1 << i));
    const here = inHouse() && roomFloor === i;
    const price = terrain?.floorPrice || 0;
    cell.classList.toggle('current', here);
    cell.classList.toggle('owned', have && i > 0);
    owned.textContent = i === 0 ? '언제나 무료' : have ? '보유 중' : `${price} G`;
    if (have) {
      button.disabled = !inHouse() || here;
      button.textContent = here ? '사용 중' : inHouse() ? '깔기' : '집 안에서 깔기';
    } else {
      button.disabled = myGold < price;
      button.textContent = inHouse() ? '사서 깔기' : '사기';
    }
  });
}

function refreshDyeShop() {
  if (!terrain) return;
  dyeOwn.textContent = `보유 ${myDye}개`;
  dyeBuy.textContent = terrain.dyePrice ? `${terrain.dyePrice} G` : '무료로 받기';
  dyeBuy.disabled = myGold < (terrain.dyePrice || 0);
}
dyeBuy.addEventListener('click', () => ws.send('decor buydye'));
makeMovable(jazzEl, document.getElementById('jazz-head'), 'jazz');
makeMovable(furnShop, document.getElementById('furn-head'), 'shop');
