'use strict';
// 고양이와 강아지, 데리고 다니는 펫.

// ------------------------------------------------------------ 고양이

function receiveCats(list) {
  const now = performance.now();
  const coats = (zone === 0 ? CAT_COATS : ROOM_PETS[terrain.buildings[terrain.zones[zone].b].name]) || CAT_COATS;
  cats.length = Math.min(cats.length, list.length);   // 펫을 불러 가면 줄어든다
  list.forEach(([x, y, pet, asleep, perch, name], i) => {
    const coat = pet >= 0 ? PET_KINDS[pet] : coats[i % coats.length];
    let c = cats[i];
    if (!c || c.coat !== coat) {   // 풀어놓은 펫이 빠지면 뒤의 번호가 바뀐다
      c = cats[i] = { x, y, toX: x, toY: y, dir: 1, moving: false, coat, heartsAt: -Infinity, says: '', saysUntil: 0 };
    }
    c.perchId = perch ?? -1;   // 쓰고 있는 고양이 가구의 배치 번호
    c.name = name || '';       // 주인이 지어 준 이름
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
    addChatLine(`${c.name || c.coat.name}에게 ${FISH[msg.k].name}를 주었습니다. 잠시 졸졸 따라옵니다!`);
  } else {
    addChatLine(`${c.name || c.coat.name}를 쓰다듬었습니다.`);
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
    f.name = mine ? myPetNames[e.pet] || '' : e.petName;
    // 고양이 펫은 주인이 고양이 가구 곁에 잠시 서 있으면 그 가구를 쓴다. 주인이 멀어지면 내려와 따라간다
    const now = performance.now();
    if (!(Math.hypot(ox - f.ownerX, oy - f.ownerY) < 6)) {   // 서버 위치에 맞추느라 조금씩 흔들리는 것은 서 있는 것으로 친다
      f.ownerX = ox;
      f.ownerY = oy;
      f.ownerStill = now;
    }
    if (f.perchId >= 0) {
      const item = decorItems.find((d) => d.id === f.perchId);
      if (!item || Math.hypot(item.x - ox, item.y - oy) > PET_PERCH_LEAVE || Math.hypot(item.x - f.x, item.y + PET_PERCH_FRONT - f.y) > 2) f.perchId = -1;
      else {
        f.moving = false;
        continue;
      }
    }
    if (f.goalId === undefined) f.goalId = -1;
    if (f.goalId < 0 && !f.coat.dog && now - f.ownerStill > PET_PERCH_WAIT_MS) {
      const busy = new Set([...cats.map((c) => c.perchId), ...[...petFollowers.values()].map((o) => o.perchId ?? -1), ...[...petFollowers.values()].map((o) => o.goalId ?? -1)]);
      const near = decorItems.filter((d) => d.info.k.startsWith('cat_') && !busy.has(d.id) && Math.hypot(d.x - ox, d.y - oy) < PET_PERCH_REACH)
        .sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy))[0];
      if (near) f.goalId = near.id;
    }
    const goal = f.goalId >= 0 ? decorItems.find((d) => d.id === f.goalId) : null;
    if (f.goalId >= 0 && (!goal || Math.hypot(goal.x - ox, goal.y - oy) > PET_PERCH_LEAVE)) f.goalId = -1;
    const tx = goal ? goal.x : ox - (facing > 0 ? 1 : -1) * 30, ty = goal ? goal.y + PET_PERCH_FRONT : oy + 8;
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (goal && d <= 6) {   // 가구 앞에 닿았다 (아래의 따라 걷기는 6px 안이면 멈춘다)
      f.x = tx;
      f.y = ty;
      f.perchId = goal.id;
      f.goalId = -1;
      f.moving = false;
      continue;
    }
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

// 이름 짓기: 비워 두고 저장하면 종류 이름으로 돌아간다
const petNameForm = document.getElementById('pet-name-form');
const petNameInput = document.getElementById('pet-name');
const petNameSave = document.getElementById('pet-name-save');
let petNameFor = -1;   // 이름 칸이 보여 주는 펫
petNameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (selectedPet < 0 || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(`petname ${selectedPet} ${petNameInput.value.trim()}`.trimEnd());
  petNameInput.blur();
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
    name.textContent = myPetNames[i] || coat.name;
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
  petNameInput.disabled = petNameSave.disabled = i < 0;
  petNameInput.placeholder = i < 0 ? '펫 이름' : `${PET_KINDS[i].name} (지금 이름)`;
  if (document.activeElement !== petNameInput || petNameFor !== i) petNameInput.value = i < 0 ? '' : myPetNames[i] || '';
  petNameFor = i;
  petWalk.disabled = i < 0;
  petWalk.textContent = i < 0 ? '데리고 다니기' : myPet === i ? '집에 두기' : freed ? '불러오기' : '데리고 다니기';
  petFree.disabled = i < 0 || !inHouse() || freed?.[1] === zone;
  petFree.textContent = freed?.[1] === zone ? '여기서 노는 중' : '이 집에 풀어놓기';
  bagPetHint.textContent = !any ? '' : inHouse() ? '풀어놓은 펫은 그 집을 혼자 돌아다니고, 누구나 쓰다듬고 먹이를 줄 수 있어요.' : '집 안에서는 펫을 풀어놓을 수 있어요.';
}

// ------------------------------------------------------------ 고양이 가구 위의 고양이
// 고양이(c.perchId)나 따라다니는 펫(f.perchId)이 쓰는 가구를 찾아, 그 가구에 맞는 모습으로 그린다.
// 장면에서의 순서: 캣휠은 바퀴살 뒤(가구보다 먼저), 캣타워와 숨숨집은 가구 위(가구 다음)
const catPerchBusy = new Set();   // 지금 고양이가 쓰는 가구 번호. 캣휠이 돈다

function perchOf(a) {
  if (!(a.perchId >= 0)) return null;
  const item = decorItems.find((d) => d.id === a.perchId);
  return item && item.info.k.startsWith('cat_') ? item : null;
}

function perchedSceneY(item) {
  return item.info.k === 'cat_wheel' ? item.y - 2 : item.y + 0.5;
}

function drawPerched(a, item, now) {
  const s = (item.scale || 100) / 100, flip = item.flip ? -1 : 1;
  const coat = a.coat;
  if (item.info.k === 'cat_wheel') {   // 바퀴 안쪽 아래에서 달린다
    drawCat({ ...a, x: item.x, y: item.y - 13 * s, moving: true, asleep: false, dir: a.dir || 1 }, now);
  } else if (item.info.k === 'cat_tower') {   // 맨 위 방석에 앉는다
    drawCat({ ...a, x: item.x + 19 * s * flip, y: item.y - 129 * s, moving: false, dir: a.dir || 1 }, now);
  } else {   // 숨숨집: 입구에서 얼굴만 내민다. 자면 z 만 떠오른다
    if (a.asleep) {
      drawNapZ(item.x + 14 * s, item.y - 36 * s, now);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(item.x, item.y - 9 * s, 10 * s, 9 * s, 0, Math.PI, 0);
    ctx.lineTo(item.x + 10 * s, item.y - 1 * s);
    ctx.lineTo(item.x - 10 * s, item.y - 1 * s);
    ctx.closePath();
    ctx.clip();
    ctx.translate(item.x, item.y);
    ctx.scale(s * (a.dir || 1), s);
    drawCatHead(-3, -6, coat);   // 입구(바닥에서 18px 높이) 안에 얼굴이 오도록
    ctx.restore();
  }
}
