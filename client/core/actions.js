'use strict';
// E 로 하는 일: 지금 자리에서 할 수 있는 것 중 가장 가까운 것을 골라 서버에 보낸다.

// ------------------------------------------------------------ E 로 하는 일

function selfNow() {
  const e = entities.get(myId);
  return terrain && me && e ? { ...e, x: me.x, y: me.y } : null;
}

// E 로 할 일 하나. 문 앞이면 문이고, 아니면 자리, 매점, 레코드판, 다트, 주민 중 가장 가까운 것이다.
// 스탠드(L)와 TV(T)는 키가 따로라 여기에 없다. 앉아 있으면 일어나기다.
function useChoice(self) {
  if (!terrain) return null;
  if (self.seat) return atPiano(self) ? null : { kind: 'sit', label: '일어나기', dist: 0 };
  const options = [];
  const near = (kind, label, x, y, reach, extra = {}) => {
    const dist = Math.hypot(x - self.x, y - self.y);
    if (dist <= reach) options.push({ kind, label, dist, ...extra });
  };
  if (!(hompyMode && zone > 0)) {
    // 지금 있는 곳에 문이 난 건물들: 마을의 건물, 극장 안의 특별관
    for (const b of terrain.buildings) if (b.room >= 0 && (b.in || 0) === zone) near('door', b.in ? `${b.name} 들어가기` : '들어가기', b.door[0], b.door[1], terrain.doorReach);
    if (zone > 0) near('door', '나가기', terrain.zones[zone].door[0], terrain.zones[zone].door[1], terrain.doorReach + 8);
  }
  terrain.seats.forEach((s, i) => {
    if (!seatFreeInReach(self, s, i)) return;
    near('sit', i === terrain.pianoSeat ? '피아노 치기' : s.lie ? '눕기' : '앉기', s.x, s.y, Infinity);
  });
  const counter = shopFurniture();
  if (counter) near('shop', counter.k === 'bartender' ? '바텐더에게 주문' : '매점', counter.x, counter.y, terrain.shopReach);
  for (const f of terrain.furnByZone[zone]) if (f.k === 'record_player') near('record', jazzPanelOpen ? '곡 목록 닫기' : '레코드판', f.x, f.y, terrain.tvReach);
  const line = dartLine();
  if (line) near('darts', dartsEl.hidden ? '다트' : '다트 창 닫기', line.x, line.y, terrain.dartReach);
  for (const f of terrain.furnByZone[zone]) if (f.k === 'omok_table') near('omok', omokEl.hidden ? '오목' : '오목 창 닫기', f.x, f.y, OMOK_REACH);
  for (const f of terrain.furnByZone[zone]) {
    if (f.decor && ARCADE_KINDS[f.k] !== undefined) {
      const name = f.k === 'arcade_chess' ? '체스' : '오락기';
      near('arcade', arcadeOpenId === f.decor.id ? `${name} 창 닫기` : name, f.x, f.y, ARCADE_REACH, { decorId: f.decor.id });
    }
  }
  farmChoices(self, near);
  options.sort((a, b) => (a.kind === 'door') - (b.kind === 'door') || a.dist - b.dist);
  return options.find((o) => o.kind === 'door') || options[0] || null;
}

function useNearest() {
  const self = selfNow();
  if (!self || !ws || ws.readyState !== WebSocket.OPEN) return;
  const choice = useChoice(self);
  if (!choice) {
    if (hompyMode && nearRoomDoor()) addChatLine('미니홈피에서는 오른쪽 탭으로 다른 집에 갑니다.');
    return;
  }
  if (choice.kind === 'door') ws.send('use door');
  else if (choice.kind === 'sit') ws.send('use sit');
  else if (choice.kind === 'shop') (shopEl.hidden ? openShop : closeShop)();
  else if (choice.kind === 'record') setJazzPanel(!jazzPanelOpen);
  else if (choice.kind === 'darts') setDartsOpen(dartsEl.hidden);
  else if (choice.kind === 'omok') setOmokOpen(omokEl.hidden);
  else if (choice.kind === 'arcade') setArcadeOpen(arcadeOpenId === choice.decorId ? null : choice.decorId);
  else farmUse(choice);
}
