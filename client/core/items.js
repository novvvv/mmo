'use strict';
// 소지품과 아이템: 낚은 물고기, 아이템창, 매점, 떠오르는 글자와 바닥에 떨어진 아이템.

// ------------------------------------------------------------ 낚시 결과

drawBoardIcon(document.getElementById('board-icon').getContext('2d'));

function itemCounts() {
  return [1, ...myBag, ...myLoot, ...myShop, ...myGoods, 1];
}

function setInventory(msg) {
  myBag = FISH.map((_, i) => msg.c[i] || 0);
  myLoot = LOOT.map((_, i) => msg.l[i] || 0);
  myShop = SHOP.map((_, i) => msg.s[i] || 0);
  myWelcome = !!msg.w;
  myFurn = msg.f ? [...msg.f] : myFurn;
  if (msg.fd) {
    if (decorDyedIndex >= 0 && JSON.stringify(msg.fd) !== JSON.stringify(myDyed)) setDecorPlacing(-1);  // 칸 번호가 바뀌었을 수 있다
    myDyed = msg.fd;
  }
  if (msg.dye !== undefined) myDye = msg.dye;
  if (msg.pets !== undefined) myPets = msg.pets;
  if (msg.em !== undefined) myEmotes = msg.em;
  if (msg.pet !== undefined) myPet = msg.pet;
  if (msg.freed) myFreed = msg.freed;
  if (msg.floors !== undefined) {
    myFloors = msg.floors;
    refreshFloorShop();
  }
  if (msg.g !== undefined && msg.g !== myGold && inventoryLoaded) Sound.play('coin');
  inventoryLoaded = true;
  pachiServerGold = msg.g || 0;
  myGold = Math.max(0, (msg.g || 0) - (pachiOpen ? pachiHidden : 0));   // 빠칭코 숫자판이 멈추기 전의 상금은 아직 보이지 않는다
  bagGold.textContent = `${myGold.toLocaleString()} G`;
  shopGold.textContent = bagGold.textContent;
  furnGold.textContent = bagGold.textContent;
  renderDecorPanel();
  refreshFurnShop();
  refreshDyeShop();
  renderDyePanel();
  refreshPetShop();
  refreshEmoteShop();
  renderBagPets();
  renderBag();
  refreshShop();
  if (tradeState) renderTrade();
}

function refreshGoldDisplays() {
  bagGold.textContent = `${myGold.toLocaleString()} G`;
  shopGold.textContent = bagGold.textContent;
  furnGold.textContent = bagGold.textContent;
  refreshFurnShop();
  refreshShop();
}

function drawItemIcon(canvas, kind) {
  const c = canvas.getContext('2d');
  if (ITEMS[kind].book) drawChessBookIcon(c);
  else if (ITEMS[kind].good !== undefined) drawOn(c, () => drawGood(ITEMS[kind].good, 36, 21, 1.2));
  else if (ITEMS[kind].tool) drawRemote(c);
  else if (kind < FIRST_LOOT) drawFish(c, 28, 21, 2.4, ITEMS[kind].color);
  else if (kind < FIRST_SHOP) drawLoot(c, 36, 21, 1.9, kind - FIRST_LOOT);
  else drawShopItem(c, 36, 22, 1.5, kind - FIRST_SHOP);
}

function loadBagLayout(owner) {
  bagOwner = owner;
  bagSlots = {};
  try { bagSlots = JSON.parse(localStorage.getItem(`mmo.bag.${owner}`)) || {}; } catch { /* 저장된 배치가 없으면 앞쪽 칸부터 */ }
  renderBag();
}

function saveBagLayout() {
  try { localStorage.setItem(`mmo.bag.${bagOwner}`, JSON.stringify(bagSlots)); } catch { /* 저장을 막아 둔 브라우저에서는 이번 접속에만 적용 */ }
}

// 저장된 칸에 놓고, 칸이 없는 아이템은 빈칸을 앞에서부터 채운다. 다 쓴 아이템의 칸은 다음을 위해 남겨 둔다.
function renderBag() {
  hideItemTip();
  bagItems.textContent = '';
  const counts = itemCounts();
  const owned = ITEMS.map((_, kind) => kind).filter((kind) => counts[kind] > 0);
  const cells = new Array(BAG_SLOTS).fill(null);
  const reserved = new Set(Object.values(bagSlots));
  for (const kind of owned) {
    const saved = bagSlots[kind];
    if (saved >= 0 && saved < BAG_SLOTS && cells[saved] === null) cells[saved] = kind;
  }
  for (const kind of owned) {
    if (cells.includes(kind)) continue;
    let free = cells.findIndex((cell, i) => cell === null && !reserved.has(i));
    if (free < 0) free = cells.indexOf(null);
    cells[free] = kind;
    bagSlots[kind] = free;
  }
  cells.forEach((kind) => {
    const slot = document.createElement('div');
    slot.className = 'bag-slot';
    if (kind !== null) {
      slot.classList.add('filled');
      slot.classList.toggle('rare', !!ITEMS[kind].rare);
      slot.dataset.kind = kind;
      const icon = document.createElement('canvas');
      icon.width = 72;
      icon.height = 42;
      drawItemIcon(icon, kind);
      slot.append(icon);
      if (!ITEMS[kind].tool) {
        const count = document.createElement('b');
        count.textContent = counts[kind];
        slot.append(count);
      }
    }
    bagItems.append(slot);
  });
}

// 끌어다 놓은 칸의 아이템과 자리를 바꾼다.
function moveBagItem(kind, target) {
  const from = bagSlots[kind];
  if (from === target) return;
  for (const [other, slot] of Object.entries(bagSlots)) if (slot === target) bagSlots[other] = from;
  bagSlots[kind] = target;
  saveBagLayout();
  renderBag();
}

// ------------------------------------------------------------ 매점

const shopTitle = document.getElementById('shop-title');
const shopRows = [];
const shopButtons = SHOP.map((item, i) => {
  const row = document.createElement('div');
  shopRows.push(row);
  row.className = 'shop-row';
  const icon = document.createElement('canvas');
  icon.width = 72;
  icon.height = 42;
  drawShopItem(icon.getContext('2d'), 36, 22, 1.5, i);
  const text = document.createElement('div');
  text.textContent = item.name;
  const note = document.createElement('small');
  note.textContent = item.desc;
  text.append(note);
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.textContent = item.price ? `${item.price} G` : '무료';
  button.addEventListener('click', () => {
    ws.send(`buy ${FIRST_SHOP - 1 + i}`);
    button.blur();
  });
  row.append(icon, text, button);
  shopList.append(row);
  return button;
});

function refreshShop() {
  shopButtons.forEach((button, i) => {
    button.disabled = myGold < SHOP[i].price || (!!SHOP[i].welcome && !myWelcome);
    if (SHOP[i].welcome) button.textContent = myWelcome ? '무료' : '받음';
  });
}

// 카운터마다 파는 물건이 다르다.
function openShop() {
  const bar = shopFurniture().k === 'bartender';
  shopTitle.textContent = bar ? '재즈바' : '매점';
  shopRows.forEach((row, i) => { row.hidden = !!SHOP[i].bar !== bar; });
  refreshShop();
  shopEl.hidden = false;
}

function closeShop() {
  shopEl.hidden = true;
}

document.getElementById('shop-close').addEventListener('click', closeShop);

function shopFurniture() {
  return terrain.furnByZone[zone].find((f) => f.k === 'snack_bar' || f.k === 'bartender');
}

function shopInReach(self) {
  const counter = shopFurniture();
  return !!counter && Math.hypot(counter.x - self.x, counter.y - self.y) <= terrain.shopReach;
}

// ------------------------------------------------------------ 떠오르는 글자와 떨어진 아이템

function addDamageFx(x, y, text, color) {
  damageFx.push({ x, y, text, color, at: performance.now() });
}

function drawDamageFx(now) {
  damageFx = damageFx.filter((d) => now - d.at < DAMAGE_FX_MS);
  ctx.save();
  ctx.font = `800 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  for (const d of damageFx) {
    const t = (now - d.at) / DAMAGE_FX_MS;
    ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
    ctx.fillStyle = d.color;
    ctx.strokeText(d.text, d.x, d.y - t * 30);
    ctx.fillText(d.text, d.x, d.y - t * 30);
  }
  ctx.restore();
}

function drawDrop(d, now) {
  const bob = Math.sin(now / 320 + d.id) * 2.5;
  groundShadow(d.x, d.y + 7, 9, 3);
  const y = d.y - 5 + bob;
  if (d.kind === GOLD_DROP) drawCoins(d.x, y);
  else if (d.kind >= FIRST_GOOD - 1) drawGood(d.kind - FIRST_GOOD + 1, d.x, y - 2, 0.85);
  else if (d.kind < FIRST_LOOT - 1) drawFish(ctx, d.x - 5, y, 1, FISH[d.kind].color);
  else if (d.kind < FIRST_SHOP - 1) drawLoot(ctx, d.x, y, 1, d.kind - FIRST_LOOT + 1);
  else drawShopItem(ctx, d.x, y, 0.9, d.kind - FIRST_SHOP + 1);
}

function setBag(counts) {
  myBag = FISH.map((_, i) => counts[i] || 0);
  renderBag();
}

function setHp(value) {
  myHp = value;
  const ratio = value / (world.maxHp || 100);
  hpFill.style.width = `${ratio * 100}%`;
  hpFill.classList.toggle('low', ratio < 0.3);
  hpText.textContent = `${value}/${world.maxHp || 100}`;
}

// tab 을 주면 그 탭으로 연다 (H 는 가구 탭).
function setBagOpen(open, tab) {
  bagEl.hidden = !open;
  if (open) {
    setBagTab(tab || bagTab);
    restoreWindow(bagEl, 'bag');
    return;
  }
  decorPlacing = -1;
  setDecorTaking(false);
  setDecorMoving(false);
  setDecorTurning(false);
  hideItemTip();
  if (bagEl.contains(document.activeElement)) document.activeElement.blur();
}

function hideItemTip() {
  itemTip.hidden = true;
}

function showItemTip(slot) {
  const kind = Number(slot.dataset.kind), fish = ITEMS[kind];
  if (bagItems.classList.contains('moving')) return;
  const name = document.createElement('b');
  name.textContent = fish.name;
  name.style.color = fish.rare ? '#f5c518' : '';
  const grade = document.createElement('small');
  grade.textContent = fish.grade;
  const desc = document.createElement('p');
  desc.textContent = fish.desc;
  const owned = document.createElement('small');
  if (fish.book) owned.textContent = '클릭해서 펼쳐 보기';
  else if (fish.tool) owned.textContent = '클릭해서 사용';
  else if (fish.good !== undefined) owned.textContent = `보유 ${myGoods[fish.good]}개${fish.dish ? ' · 클릭해서 먹기' : ''} · 창 밖으로 끌면 버리기 · 교환할 수 있어요`;
  else if (fish.consumable) owned.textContent = `보유 ${myShop[kind - FIRST_SHOP]}개 · 클릭해서 사용 · 창 밖으로 끌면 버리기`;
  else owned.textContent = kind < FIRST_LOOT ? `보유 ${myBag[kind - FIRST_FISH]}마리 · 고양이나 강아지 옆에서 X를 누르면 먹이로 줍니다` : `보유 ${myLoot[kind - FIRST_LOOT]}개`;
  itemTip.replaceChildren(name, grade, desc, owned);
  itemTip.hidden = false;

  // 창 왼쪽에 자리가 있으면 왼쪽에, 없으면 칸 아래에 띄운다.
  const slotRect = slot.getBoundingClientRect(), bagRect = bagEl.getBoundingClientRect();
  const w = itemTip.offsetWidth, h = itemTip.offsetHeight;
  const beside = bagRect.left - w - 8 >= 8;
  itemTip.style.left = `${beside ? bagRect.left - w - 8 : clamp(slotRect.left, 8, innerWidth - w - 8)}px`;
  itemTip.style.top = `${clamp(beside ? slotRect.top : slotRect.bottom + 6, 8, innerHeight - h - 8)}px`;
}

bagItems.addEventListener('pointerover', (e) => {
  const slot = e.target.closest('.bag-slot.filled');
  if (slot) showItemTip(slot);
  else hideItemTip();
});
bagItems.addEventListener('pointerleave', hideItemTip);
bagClose.addEventListener('click', () => setBagOpen(false));
renderBag();

function handleCatch(msg) {
  const fish = FISH[msg.k];
  const e = entities.get(msg.id);
  if (e) {
    e.caught = fish;
    e.caughtAt = performance.now();
  }
  if (msg.id === myId) {
    Sound.play('catch');
    setBag(msg.c);
    addChatLine(`${fish.name}를 낚았습니다!`);
  } else if (fish.rare) {  // 다른 사람의 평범한 물고기까지 알리면 채팅이 묻힌다
    addChatLine(`${msg.n}님이 ${fish.name}를 낚았습니다!`);
  }
}
