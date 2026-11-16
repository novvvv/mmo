// 하우징: 세 집의 위치, 문, 독립된 내부 공간
import { Bot, startServer, uniqueId, wait } from '../lib.mjs';

const ROUTES = {
  몰쟈: [[970, 1220], [970, 1388]],
  랏라: [[320, 1220], [320, 1392]],
  캬캬: [[795, 1220], [795, 1468]],
};

async function goToDoor(bot, house) {
  await bot.crossToSouth();
  for (const [x, y] of ROUTES[house.name]) await bot.walkTo(x, y, 12);
  await bot.walkTo(house.door[0], house.door[1] + 30, 8);
}

export default async function run(t) {
  const server = await startServer();
  const a = await Bot.enter(server, '집주인');
  const map = a.map;
  const houses = map.buildings.filter((b) => b.k === 'house');
  const byName = Object.fromEntries(houses.map((h) => [h.name, h]));

  t.check('four houses', houses.length === 4, houses.length);
  t.check('몰쟈 at (1105, 1309)', byName.몰쟈?.x === 1105 && byName.몰쟈?.y === 1309);
  t.check('랏라 at (449, 1316)', byName.랏라?.x === 449 && byName.랏라?.y === 1316);
  t.check('캬캬 at (676, 1391)', byName.캬캬?.x === 676 && byName.캬캬?.y === 1391);
  t.check('헤연 at (1150, 430)', byName.헤연?.x === 1150 && byName.헤연?.y === 430);
  t.check('every house looks different', new Set(houses.map((h) => h.style)).size === houses.length);
  t.check('every house has its own room', new Set(houses.map((h) => h.room)).size === houses.length && houses.every((h) => h.room > 0));
  t.check('houses do not overlap', houses.every((h, i) => houses.every((o, j) => i === j || Math.abs(h.x - o.x) > h.halfW + o.halfW || Math.abs(h.y - o.y) > h.back + o.front)));

  // 몰쟈와 캬캬의 가구는 처음 깔리는 설치형 가구(seeds)로 온다
  const roomKinds = houses.map((h) => new Set(map.furn.concat(map.seeds).filter((f) => f.z === h.room).map((f) => f.k)));
  const signature = roomKinds.map((set) => [...set].sort().join());
  t.check('interiors are furnished differently', new Set(signature).size === houses.length, signature.join(' | '));
  t.check('every room has several pieces', roomKinds.every((set) => set.size >= 6));
  const seatKinds = new Set(map.catalog.filter((c) => c.seats > 0).map((c) => c.k));
  t.check('every room has a place to sit', houses.every((h) => map.seats.some((s) => s.z === h.room) || map.seeds.some((s) => s.z === h.room && seatKinds.has(s.k))));
  const onSouthWall = (zone) => (zone.floors ? zone.floors.some(([x0, , x1, y1]) => y1 === zone.door[1] && zone.door[0] > x0 && zone.door[0] < x1) : zone.door[1] === zone.h);
  t.check('room doors are on a south wall', houses.every((h) => onSouthWall(map.zones[h.room])));

  // ---- 문 없이 들어갈 수 없다
  a.send('use');
  await wait(120);
  t.check('use far from a door does not teleport', a.zone === 0);

  // ---- 건물은 통과할 수 없다
  const house = byName.몰쟈;
  await goToDoor(a, house);
  t.check('reached the door', Math.hypot(a.me.x - house.door[0], a.me.y - house.door[1]) < map.doorReach, JSON.stringify(a.me));
  const wallStop = house.y + house.front + map.body;
  a.send('in 1');
  await wait(900);
  a.send('in 0');
  await wait(100);
  t.check('walls stop the player', a.me.y >= wallStop - 0.2, `${a.me.y} vs ${wallStop}`);
  const startX = a.me.x;
  a.send('in 8');
  await wait(400);
  a.send('in 0');
  await wait(80);
  t.check('slides along the wall', a.me.x > startX + 40 && a.me.y >= wallStop - 0.2);
  await a.walkTo(house.door[0], house.door[1] + 26, 8);

  // ---- 들어가기
  const outsider = await Bot.enter(server, '바깥사람');
  await outsider.crossToSouth();
  await outsider.walkTo(970, 1220);
  await outsider.walkTo(970, 1388);
  await outsider.walkTo(house.door[0] + 90, house.door[1] + 30, 10);
  t.check('outsider sees the owner outside', outsider.others.some((p) => p.id === a.id));

  a.send('use');
  await a.until(() => a.zone === house.room, 1000);
  await wait(120);
  const room = map.zones[house.room];
  t.check('door moves the player into the room', a.zone === house.room, a.zone);
  t.check('player starts just inside the door', Math.abs(a.me.x - room.door[0]) < 0.2 && Math.abs(a.me.y - (room.door[1] - 40)) < 0.2, JSON.stringify(a.me));
  await wait(100);
  t.check('outsider no longer sees the owner', !outsider.others.some((p) => p.id === a.id));
  t.check('owner no longer sees the outsider', !a.others.some((p) => p.id === outsider.id) && a.others.length === 1);
  t.check('online count still covers everyone', a.online >= 2, a.online);

  // ---- 같은 집이면 서로 보인다
  outsider.send('use');
  await wait(60);
  t.check('outsider too far from the door stays out', outsider.zone === 0);
  await outsider.walkTo(house.door[0], house.door[1] + 26, 8);
  outsider.send('use');
  await outsider.until(() => outsider.zone === house.room, 1000);
  await wait(120);
  t.check('two players in the same house see each other', a.others.some((p) => p.id === outsider.id) && outsider.others.some((p) => p.id === a.id));

  // ---- 채팅은 구역을 넘어 전달된다
  const hearing = await Bot.enter(server, '광장');
  a.send('chat 집에서 인사');
  await wait(150);
  t.check('chat reaches players outdoors', hearing.events.some((e) => e.t === 'chat' && e.m === '집에서 인사'));

  // ---- 방 안의 경계와 가구
  a.send('in 1');
  await wait(2200);
  a.send('in 0');
  await wait(120);
  const fireplace = map.furn.concat(map.seeds).find((f) => f.z === house.room && f.k === 'fireplace');
  t.check('furniture blocks the player', a.me.y >= fireplace.y + map.body - 0.2, `${a.me.y} vs ${fireplace.y + map.body}`);
  a.send('in 8');
  await wait(1900);
  a.send('in 0');
  await wait(120);
  t.check('east wall stops the player', a.me.x <= room.w - 16 + 0.01, a.me.x);
  await a.walkTo(room.w / 2, room.h - 60, 8);
  a.send('in 2');
  await wait(600);
  a.send('in 0');
  await wait(120);
  t.check('south wall stops the player', a.me.y <= room.h - 16 + 0.01, a.me.y);

  // ---- 방 안에서 할 수 없는 일
  await a.walkTo(room.w / 2 - 100, room.h - 120, 10);
  a.send('fish');
  await wait(120);
  t.check('no fishing indoors', !a.me.f && a.events.some((e) => e.t === 'sys' && e.m.includes('물가에서만')));
  // ---- 방 안의 자리
  // 몰쟈 집의 자리는 설치형 가구(검은 스툴)에 있어 방에 들어올 때 받은 가구 목록에서 찾는다
  const [seatIndex, seatX, seatY] = a.lastEvent('decor').p.find((d) => d[1] === 2)[5][0];
  const seat = { x: seatX, y: seatY };
  await a.walkTo(seat.x, seat.y + 26, 8);
  a.send('use');
  await wait(120);
  t.check('can sit indoors', a.me.s === seatIndex + 1 && Math.abs(a.me.x - seat.x) < 0.11, JSON.stringify(a.me));
  a.send('use');
  await wait(100);
  t.check('E stands up indoors', !a.me.s);

  // ---- 나가기
  await a.walkTo(room.door[0], room.door[1] - 30, 8);
  a.send('use');
  await a.until(() => a.zone === 0, 1000);
  await wait(120);
  t.check('door leads back outside', a.zone === 0);
  t.check('player stands in front of the house', Math.abs(a.me.x - house.door[0]) < 0.2 && Math.abs(a.me.y - (house.door[1] + 24)) < 0.2, JSON.stringify(a.me));
  const beforeX = a.me.x;
  a.send('in 8');
  await wait(250);
  a.send('in 0');
  t.check('player can walk after leaving', a.me.x > beforeX + 20);

  // ---- 앉아 있으면 E 는 문이 아니라 일어나기
  outsider.close();
  hearing.close();

  // ---- 나머지 두 집도 드나들 수 있고 서로 분리되어 있다
  const b1 = await Bot.enter(server, '랏라손님');
  const b2 = await Bot.enter(server, '캬캬손님');
  await goToDoor(b1, byName.랏라);
  await goToDoor(b2, byName.캬캬);
  b1.send('use');
  b2.send('use');
  await b1.until(() => b1.zone === byName.랏라.room, 1000);
  await b2.until(() => b2.zone === byName.캬캬.room, 1000);
  await wait(120);
  t.check('랏라 door opens its own room', b1.zone === byName.랏라.room, b1.zone);
  t.check('캬캬 door opens its own room', b2.zone === byName.캬캬.room, b2.zone);
  t.check('different houses are separate spaces', !b1.others.some((p) => p.id === b2.id) && !b2.others.some((p) => p.id === b1.id));

  // ---- 동물이 없는 집에서는 고양이 소식이 오지 않는다
  const catsBefore = b1.catSamples.length;
  const others = watchCount(b1);
  b1.send('pet');
  await wait(1200);
  t.check('no cat updates in a house without pets', b1.catSamples.length === catsBefore, b1.catSamples.length - catsBefore);
  t.check('cannot pet an outdoor cat from indoors', watchCount(b1) === others);

  // ---- 집 안에서 접속을 끊으면 다음에 집 안에서 시작한다
  const savedId = uniqueId('homebody');
  const c1 = await Bot.enter(server, '집순이', { id: savedId });
  await goToDoor(c1, byName.랏라);
  c1.send('use');
  await c1.until(() => c1.zone === byName.랏라.room, 1000);
  await wait(120);
  const saved = { x: c1.me.x, y: c1.me.y };
  c1.close();
  await wait(200);
  const c2 = await Bot.connect(server);
  await c2.login(savedId);
  await c2.join({ nick: '집순이' });
  await c2.until(() => c2.zone === byName.랏라.room, 1000);
  await wait(120);
  t.check('re-login returns to the room', c2.zone === byName.랏라.room && Math.hypot(c2.me.x - saved.x, c2.me.y - saved.y) < 1, JSON.stringify(c2.me));
  c2.close();

  b1.close();
  b2.close();
  a.close();
  await server.stop();
}

function watchCount(bot) {
  return bot.events.filter((e) => e.t === 'cat').length;
}
