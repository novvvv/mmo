'use strict';
// 두 사람의 교환 창.

// ------------------------------------------------------------ 교환

function tradeItemButton(kind, count, onClick) {
  const item = document.createElement(onClick ? 'button' : 'div');
  item.className = 'trade-item';
  if (onClick) {
    item.type = 'button';
    item.tabIndex = -1;
    item.addEventListener('click', onClick);
  }
  const icon = document.createElement('canvas');
  icon.width = 72;
  icon.height = 42;
  drawItemIcon(icon, kind);
  const label = document.createElement('b');
  label.textContent = count;
  item.title = ITEMS[kind].name;
  item.append(icon, label);
  return item;
}

function setTradeOffer(server, count) {
  ws.send(`trade item ${server} ${count}`);
}

function renderTrade() {
  const { mine, theirs } = tradeState;
  const counts = itemCounts();
  const offered = (side) => side.i.flatMap((n, server) => (n > 0 ? [[server, n]] : []));
  tradeMine.replaceChildren(...offered(mine).map(([server, n]) => tradeItemButton(server + 1, n, () => setTradeOffer(server, n - 1))));
  tradeTheirs.replaceChildren(...offered(theirs).map(([server, n]) => tradeItemButton(server + 1, n)));
  tradeBag.replaceChildren(...ITEMS.flatMap((item, kind) => {
    if (item.tool) return [];
    const left = counts[kind] - mine.i[kind - 1];
    return left > 0 ? [tradeItemButton(kind, left, () => setTradeOffer(kind - 1, mine.i[kind - 1] + 1))] : [];
  }));
  if (document.activeElement !== tradeGold) tradeGold.value = mine.g || '';
  tradeTheirGold.textContent = `${theirs.g.toLocaleString()} G`;
  document.getElementById('trade-mine-side').classList.toggle('ready', mine.r);
  document.getElementById('trade-theirs-side').classList.toggle('ready', theirs.r);
  tradeReady.disabled = mine.r;
  tradeReady.textContent = mine.r ? '상대 기다리는 중' : '확인';
}

function closeTrade() {
  tradeState = null;
  tradeEl.hidden = true;
  tradeGold.blur();
  tradeGold.value = '';
}

function handleTrade(msg) {
  if (msg.a === 'ask') {
    pushNotice({
      kind: 'trade', key: `trade:${msg.id}`, title: '교환 신청', text: `${msg.n}님이 교환을 신청했어요!`, sub: '수락하면 교환 창이 열려요.',
      look: (e) => e.id === msg.id, yes: () => ws.send(`trade yes ${msg.id}`), no: () => ws.send(`trade no ${msg.id}`),
    });
  } else if (msg.a === 'open') {
    for (const key of [...notices, noticeShown].filter(Boolean).map((n) => n.key).filter((k) => k?.startsWith('trade:'))) dropNotice(key);
    tradeName.textContent = ` · ${msg.n}님과`;
    tradeEl.hidden = false;
  } else if (msg.a === 'state') {
    tradeState = { mine: msg.mine, theirs: msg.theirs };
    renderTrade();
  } else if (msg.a === 'closed') {
    closeTrade();
    addChatLine(msg.m);
  }
}

tradeReady.addEventListener('click', () => ws.send('trade ready'));
document.getElementById('trade-cancel').addEventListener('click', () => ws.send('trade cancel'));
tradeGold.addEventListener('focus', () => stopMoving());
tradeGold.addEventListener('change', () => {
  ws.send(`trade gold ${Math.max(0, Math.floor(Number(tradeGold.value) || 0))}`);
  tradeGold.blur();
});

// 다른 캐릭터를 우클릭하면 (터치 화면에서는 누르면) 메뉴가 열린다. 캐릭터가 없는 곳이면 false.
function openPlayerMenu(screenX, screenY) {
  playerMenu.hidden = true;
  if (myId === null || !terrain) return false;
  const [camX, camY] = camera(innerWidth, innerHeight);
  const x = screenX + camX, y = screenY + camY;
  for (const [id, other] of entities) {
    if (id === myId || Math.hypot(other.x - x, other.y - bodyLift(other) - y) > RADIUS + 12) continue;
    menuTarget = id;
    playerTrade.textContent = `${other.name}님과 교환하기`;
    const already = myMates.some(([, mateId]) => mateId === id);
    playerMate.textContent = already ? `${other.name}님은 동거인입니다` : `${other.name}님에게 동거인 신청`;
    playerMate.disabled = already;
    const friend = myFriends.some(([, friendId]) => friendId === id);
    playerFriend.textContent = friend ? `${other.name}님은 친구예요` : `${other.name}님에게 친구 신청`;
    playerFriend.disabled = friend;
    playerMenu.style.left = `${Math.min(screenX, innerWidth - 170)}px`;
    playerMenu.style.top = `${Math.min(screenY, innerHeight - 50)}px`;
    playerMenu.hidden = false;
    return true;
  }
  return false;
}
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  openPlayerMenu(e.clientX, e.clientY);
});
document.getElementById('player-profile').addEventListener('click', () => {
  playerMenu.hidden = true;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`stats ${menuTarget}`);
});
playerMate.addEventListener('click', () => {
  playerMenu.hidden = true;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`mate ask ${menuTarget}`);
});
playerTrade.addEventListener('click', () => {
  playerMenu.hidden = true;
  ws.send(`trade ask ${menuTarget}`);
  addChatLine('교환을 신청했습니다.');
});
addEventListener('pointerdown', (e) => {
  if (!playerMenu.hidden && !playerMenu.contains(e.target)) playerMenu.hidden = true;
});

// 리모컨: TV 가 있는 집 안이면 어디서든 TV 창을 연다.
function useRemote() {
  if (!tvFurniture()) addChatLine('TV가 있는 집 안에서만 쓸 수 있습니다.');
  else if (tvPanelOpen) closeTvPanel();
  else openTvPanel();
}

bagItems.addEventListener('pointerdown', (e) => {
  const slot = e.target.closest('.bag-slot.filled');
  if (e.button !== 0 || !slot) return;
  e.preventDefault();
  const kind = Number(slot.dataset.kind);
  let ghost = null;
  const place = (ev) => { ghost.style.transform = `translate(${ev.clientX - 18}px, ${ev.clientY - 10}px)`; };
  const onMove = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 5) {
      ghost = document.createElement('canvas');
      ghost.id = 'bag-ghost';
      ghost.width = 72;
      ghost.height = 42;
      drawItemIcon(ghost, kind);
      document.body.append(ghost);
      slot.classList.add('lifted');
      bagItems.classList.add('moving');
      hideItemTip();
    }
    if (ghost) place(ev);
  };
  const finish = (ev) => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', finish);
    removeEventListener('pointercancel', finish);
    bagItems.classList.remove('moving');
    if (ghost) {
      ghost.remove();
      slot.classList.remove('lifted');
      const target = ev.type === 'pointerup' ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.bag-slot') : null;
      if (target && bagItems.contains(target)) moveBagItem(kind, [...bagItems.children].indexOf(target));
      else if (ev.type === 'pointerup' && !ITEMS[kind].tool && document.elementFromPoint(ev.clientX, ev.clientY) === canvas) {
        // 창 밖 바닥에 놓으면 버린다. Shift 를 누르고 있으면 전부 버린다.
        ws.send(`drop ${kind - 1} ${ev.shiftKey ? itemCounts()[kind] : 1}`);
      }
    } else if (ev.type === 'pointerup' && ITEMS[kind].book) {
      setChessGuideOpen(guideEl.hidden);
    } else if (ev.type === 'pointerup' && ITEMS[kind].tool) {
      useRemote();
    } else if (ev.type === 'pointerup' && ITEMS[kind].dish) {
      ws.send(`farm eat ${ITEMS[kind].good}`);
      Sound.play('eat');
    } else if (ev.type === 'pointerup' && ITEMS[kind].consumable) {
      ws.send(`eat ${kind - 1}`);
      Sound.play(kind === FIRST_SHOP ? 'eat' : 'drink');
    }
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', finish);
  addEventListener('pointercancel', finish);
});
