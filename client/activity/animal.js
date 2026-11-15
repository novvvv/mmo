'use strict';
// 고양이와 강아지, 데리고 다니는 펫.

// ------------------------------------------------------------ 고양이

function receiveCats(list) {
  const now = performance.now();
  const coats = (zone === 0 ? CAT_COATS : ROOM_PETS[terrain.buildings[terrain.zones[zone].b].name]) || CAT_COATS;
  cats.length = Math.min(cats.length, list.length);   // 펫을 불러 가면 줄어든다
  list.forEach(([x, y, pet, asleep], i) => {
    const coat = pet >= 0 ? PET_KINDS[pet] : coats[i % coats.length];
    let c = cats[i];
    if (!c || c.coat !== coat) {   // 풀어놓은 펫이 빠지면 뒤의 번호가 바뀐다
      c = cats[i] = { x, y, toX: x, toY: y, dir: 1, moving: false, coat, heartsAt: -Infinity, says: '', saysUntil: 0 };
    }
    c.moving = x !== c.toX || y !== c.toY;
    c.asleep = !!asleep && !c.moving;
    if (x !== c.toX) c.dir = x > c.toX ? 1 : -1;
    c.fromX = c.x;
    c.fromY = c.y;
    c.toX = x;
    c.toY = y;
    c.t0 = now;
  });
}

function handleCatEvent(msg) {
  const c = cats[msg.i];
  if (!c) return;
  const now = performance.now();
  c.heartsAt = now;
  c.says = msg.act === 'feed' ? '냠냠!' : msg.woke ? '…음냐?' : c.coat.dog ? '멍멍!' : '야옹~';
  c.asleep = false;
  c.saysUntil = now + CAT_SAYS_MS;
  const e = entities.get(msg.id);
  if (e) c.dir = e.toX >= c.toX ? 1 : -1;  // 사람 쪽을 본다 (내 캐릭터의 e.x 는 갱신되지 않으므로 서버 좌표를 쓴다)

  if (msg.id !== myId) return;
  if (msg.act === 'feed') {
    setBag(msg.c);
    addChatLine(`${c.coat.name}에게 ${FISH[msg.k].name}를 주었습니다. 잠시 졸졸 따라옵니다!`);
  } else {
    addChatLine(`${c.coat.name}를 쓰다듬었습니다.`);
  }
}

function catInReach(self) {
  let best = null, bestDist = terrain.catReach;
  for (const c of cats) {
    const dist = Math.hypot(c.x - self.x, c.y - self.y);
    if (dist <= bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

// ------------------------------------------------------------ 펫

// 펫은 서버가 위치를 보내지 않는다. 주인 뒤쪽을 목표로 각자의 화면에서 따라 걷고, 멀어지면 주인 곁으로 옮겨 온다.
function updatePets(dt) {
  for (const [id, f] of petFollowers) {
    const e = entities.get(id);
    if (!e || !(e.pet >= 0)) petFollowers.delete(id);
  }
  for (const [id, e] of entities) {
    if (!(e.pet >= 0) || !PET_KINDS[e.pet]) continue;
    const mine = id === myId && me;
    const ox = mine ? me.x : e.x, oy = mine ? me.y : e.y, facing = (mine ? me.dirX : e.dirX) || 1;
    let f = petFollowers.get(id);
    if (!f || f.kind !== e.pet) {
      f = { kind: e.pet, coat: PET_KINDS[e.pet], x: ox - facing * 30, y: oy + 8, dir: facing > 0 ? 1 : -1, moving: false };
      petFollowers.set(id, f);
    }
    const tx = ox - (facing > 0 ? 1 : -1) * 30, ty = oy + 8;
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (d > 260) {   // 문을 지나거나 멀리 옮겨 갔다
      f.x = tx;
      f.y = ty;
      f.moving = false;
    } else if (d > 6) {
      const step = Math.min(d, PET_SPEED * dt * (d > 90 ? 1.8 : 1));
      f.x += (dx / d) * step;
      f.y += (dy / d) * step;
      f.moving = true;
      if (Math.abs(dx) > 1) f.dir = dx > 0 ? 1 : -1;
    } else {
      f.moving = false;
      f.dir = ox >= f.x ? 1 : -1;  // 멈추면 주인을 바라본다
    }
    // 주인이 한동안 앉거나 누워 있으면 곁에서 잠든다
    const resting = (mine ? entities.get(myId)?.seat : e.seat) > 0 && !f.moving;
    if (!resting) f.restSince = 0;
    else if (!f.restSince) f.restSince = performance.now();
    f.asleep = resting && performance.now() - f.restSince > PET_NAP_MS;
  }
}

function petPortrait(kind, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const coat = PET_KINDS[kind];
  drawOn(canvas.getContext('2d'), () => {
    ctx.save();
    ctx.scale(2, 2);
    (coat.dog ? drawDog : drawCat)({ x: w / 4, y: h / 2 - 6, dir: 1, moving: false, coat }, 0);
    ctx.restore();
  });
  return canvas;
}

const petList = document.getElementById('pet-list');
const bagPetList = document.getElementById('bag-pet-list');
const bagPetHint = document.getElementById('bag-pet-hint');
const petButtons = [];
const petWalk = document.getElementById('pet-walk');
const petFree = document.getElementById('pet-free');
petWalk.addEventListener('click', () => {
  const i = selectedPet;
  if (i < 0) return;
  if (myPet === i) ws.send('walkpet -1');
  else if (myFreed.some(([kind]) => kind === i)) ws.send(`callpet ${i}`);
  else ws.send(`walkpet ${i}`);
});
petFree.addEventListener('click', () => {
  if (selectedPet >= 0) ws.send(`releasepet ${selectedPet}`);
});

function buildPetShop() {
  if (petButtons.length || !terrain) return;
  PET_KINDS.forEach((coat, i) => {
    const cell = document.createElement('div');
    cell.className = 'furn-cell pet-cell';
    const name = document.createElement('div');
    name.textContent = coat.name;
    const kind = document.createElement('small');
    kind.textContent = coat.dog ? '강아지' : '고양이';
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn';
    button.addEventListener('click', () => ws.send(`buypet ${i}`));
    cell.append(petPortrait(i, 192, 144), name, kind, button);
    petList.append(cell);
    petButtons.push({ cell, button });
  });
}

function refreshPetShop() {
  const prices = terrain?.petPrices || [];
  petButtons.forEach(({ cell, button }, i) => {
    const owned = !!(myPets & (1 << i));
    cell.classList.toggle('owned', owned);
    button.disabled = owned || myGold < (prices[i] || 0);
    button.textContent = owned ? '함께하는 중' : prices[i] ? `${prices[i]} G` : '무료로 받기';
  });
}

// 소지품의 펫 탭: 펫을 고른 뒤 데리고 다니거나, 지금 있는 집에 풀어놓거나, 풀어놓은 펫을 불러온다.
function petStatus(i) {
  if (myPet === i) return '함께 걷는 중';
  const freed = myFreed.find(([kind]) => kind === i);
  if (freed && terrain) return `${terrain.buildings[terrain.zones[freed[1]].b].name} 집에서 노는 중`;
  return '집에서 쉬는 중';
}

function renderBagPets() {
  if (bagEl.hidden || bagTab !== 'pets') return;
  bagPetList.textContent = '';
  let any = false;
  if (selectedPet >= 0 && !(myPets & (1 << selectedPet))) selectedPet = -1;
  PET_KINDS.forEach((coat, i) => {
    if (!(myPets & (1 << i))) return;
    any = true;
    if (selectedPet < 0) selectedPet = i;
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'furn-cell';
    button.dataset.pet = String(i);
    button.setAttribute('aria-pressed', String(selectedPet === i));
    const name = document.createElement('span');
    name.textContent = coat.name;
    const status = document.createElement('small');
    status.textContent = petStatus(i);
    button.append(petPortrait(i, 128, 96), name, status);
    button.addEventListener('click', () => {
      selectedPet = i;
      renderBagPets();
    });
    bagPetList.append(button);
  });
  if (!any) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '아직 펫이 없습니다. 오른쪽 위 상점의 펫 탭에서 데려오세요.';
    bagPetList.append(empty);
  }
  const i = selectedPet;
  const freed = myFreed.find(([kind]) => kind === i);
  petWalk.disabled = i < 0;
  petWalk.textContent = i < 0 ? '데리고 다니기' : myPet === i ? '집에 두기' : freed ? '불러오기' : '데리고 다니기';
  petFree.disabled = i < 0 || !inHouse() || freed?.[1] === zone;
  petFree.textContent = freed?.[1] === zone ? '여기서 노는 중' : '이 집에 풀어놓기';
  bagPetHint.textContent = !any ? '' : inHouse() ? '풀어놓은 펫은 그 집을 혼자 돌아다니고, 누구나 쓰다듬고 먹이를 줄 수 있어요.' : '집 안에서는 펫을 풀어놓을 수 있어요.';
}
