// 줄인 마을, 예전 위치 옮기기, 강, 다리, 의자, 낚시 규칙
import { Bot, BRIDGE_X, serverWithAccounts, startServer, uniqueId, wait } from '../lib.mjs';

export default async function run(t) {
  const server = await startServer();
  const a = await Bot.enter(server, '강테스트');
  const map = a.map;
  const top = (x) => a.top(x), bot = (x) => a.bot(x);
  const bobberOk = (me) => me.by > top(me.bx) && me.by < bot(me.bx) && !(me.bx > map.bridge[0] - 6 && me.bx < map.bridge[1] + 6);

  // ---- 줄인 마을: 1440×1520 안에 건물이 서로 겹치지 않고 들어 있다
  t.check('the village is compact', a.welcome.w === 1440 && a.welcome.h === 1520, `${a.welcome.w}x${a.welcome.h}`);
  t.check('every building fits inside the village', map.buildings.every((b) => b.x - b.halfW >= 0 && b.x + b.halfW <= a.welcome.w && b.y - b.back - 80 >= 0 && b.door[1] + 40 <= a.welcome.h), JSON.stringify(map.buildings.map((b) => [b.k, b.x, b.y])));
  const boxes = map.buildings.filter((b) => !b.in).map((b) => [b.x - b.halfW, b.y - b.back - 100, b.x + b.halfW, b.y + b.front]);
  t.check('buildings do not overlap', boxes.every((p, i) => boxes.every((q, j) => i === j || p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1])));
  // 처음 세 집은 강 남쪽, 나중에 지은 헤연의 집은 강 북쪽 농장 문 옆에 있다
  t.check('houses sit south of the river and the rest north', map.buildings.every((b) => (b.k === 'house' && b.name !== '헤연') === (b.y > Math.max(...map.bot))));
  t.check('the places are theater, casino, jazz bar, cafe and the farm gate', JSON.stringify(map.buildings.filter((b) => b.k !== 'house' && !b.in).map((b) => b.k).sort()) === '["cafe","casino","farm","jazz","theater"]');
  t.check('river tables', map.top.length === 37 && map.bot.length === 37);
  t.check('river wide everywhere', Math.min(...map.top.map((v, i) => map.bot[i] - v)) >= 170);
  t.check('the bridge is in the middle', map.bridge[0] === BRIDGE_X - 40 && map.bridge[1] === BRIDGE_X + 40);
  const chairs = a.furniture('chair');
  t.check('6 chairs on land', chairs.length === 6 && chairs.every((c) => c.y < top(c.x) - map.margin));

  // ---- 강은 못 건넌다
  if (a.me.x >= 600 && a.me.x <= 840) await a.toNorthField(480);
  a.send('in 2');
  await a.until(() => a.me.y >= top(a.me.x) - map.margin - 0.2, 8000);
  await wait(500);
  a.send('in 0');
  const shore = a.me;
  t.check('walking south stops at the bank', Math.abs(shore.y - (top(shore.x) - map.margin)) < 0.3, `y=${shore.y} bank=${top(shore.x) - map.margin}`);

  a.history.length = 0;
  const x0 = a.me.x;
  a.send('in 8');
  await wait(600);
  a.send('in 0');
  await wait(100);
  t.check('slides along the curved bank', a.me.x - x0 > 90, `${x0} -> ${a.me.x}`);
  t.check('never enters water while sliding', a.history.every((s) => s.y <= top(s.x) - map.margin + 0.11));

  // ---- 물가를 따라 다리 입구를 지나간다
  const walker = await Bot.enter(server, '물가');
  for (const [label, startX, mask, done] of [['eastward', 600, 8, (x) => x > 840], ['westward', 840, 4, (x) => x < 600]]) {
    await walker.toNorthField(startX);
    walker.send('in 2');
    await walker.until(() => walker.me.y >= top(walker.me.x) - map.margin - 0.2, 6000);
    walker.send('in ' + mask);
    const passed = await walker.until(() => done(walker.me.x), 3000);
    walker.send('in 0');
    await wait(80);
    t.check(`north bank ${label} passes the bridge mouth`, passed, `x=${walker.me.x}`);
  }
  await walker.crossToSouth();
  await walker.walkTo(600, bot(600) + 80, 10);
  walker.send('in 1');
  await walker.until(() => walker.me.y <= bot(walker.me.x) + map.margin + 0.2, 4000);
  walker.send('in 8');
  t.check('south bank passes the bridge mouth', await walker.until(() => walker.me.x > 840, 3000), `x=${walker.me.x}`);
  walker.send('in 0');
  walker.close();

  // ---- 낚시 거리
  const far = await Bot.enter(server, '먼사람');
  await far.walkTo(870, 520);
  far.send('fish');
  await wait(150);
  t.check('cannot fish far from water', !far.me.f && far.events.some((e) => e.t === 'sys' && e.m.includes('물가에서만')));
  far.send('use');
  await wait(100);
  t.check('sit far from a chair is ignored', !far.me.s, JSON.stringify(far.me));
  far.close();

  // ---- 다리
  const b = await Bot.enter(server, '다리');
  await b.toNorthField(BRIDGE_X);
  await b.walkTo(BRIDGE_X, top(BRIDGE_X) - 40, 8);
  b.send('in 2');
  await b.until(() => b.me.y > (top(b.me.x) + bot(b.me.x)) / 2, 5000);
  b.send('in 0');
  await wait(120);
  t.check('bridge enters the river', b.me.y > top(b.me.x) && b.me.y < bot(b.me.x));
  const midY = b.me.y;
  b.send('in 8');
  await wait(700);
  b.send('in 0');
  await wait(100);
  t.check('cannot step off bridge east', b.me.x <= map.bridge[1] - map.margin + 0.01 && Math.abs(b.me.y - midY) < 0.01);
  b.send('fish');
  await wait(120);
  t.check('fishing from bridge lands in water', b.me.f === 1 && bobberOk(b.me));
  b.send('fish');
  await wait(100);
  t.check('F while waiting reels in', !b.me.f && !b.events.some((e) => e.t === 'catch'));
  b.send('in 4');
  await wait(700);
  b.send('in 0');
  await wait(100);
  t.check('cannot step off bridge west', b.me.x >= map.bridge[0] + map.margin - 0.01);
  b.send('in 2');
  await b.until(() => b.me.y > bot(b.me.x) + map.margin, 5000);
  await wait(150);
  b.send('in 0');
  await wait(100);
  t.check('bridge crosses to south bank', b.me.y > bot(b.me.x));
  await b.walkTo(480, bot(480) + 50, 10);
  b.send('fish');
  await wait(120);
  t.check('south bank casts north into water', b.me.f === 1 && bobberOk(b.me) && b.me.by < b.me.y);
  b.close();

  // ---- 다리 정면에서 던져도 찌는 물 위
  const c = await Bot.enter(server, '정면');
  await c.toNorthField(BRIDGE_X);
  await c.walkTo(BRIDGE_X, top(BRIDGE_X) - 40, 8);
  let frontOk = true;
  for (let i = 0; i < 12; i++) {
    c.send('fish');
    await wait(90);
    if (c.me.f !== 1 || !bobberOk(c.me)) frontOk = false;
    c.send('fish');
    await wait(90);
  }
  t.check('bobber never lands on the bridge', frontOk);
  c.close();

  // ---- 의자
  const chair = chairs[2];
  const seatIndex = a.seatIndexAt(chair.x, chair.y);
  const s1 = await Bot.enter(server, '앉기1');
  const s2 = await Bot.enter(server, '앉기2');
  await s1.toNorthField(chair.x - 30);
  await s1.walkTo(chair.x - 30, chair.y - 20, 8);
  s1.send('use');
  await wait(120);
  t.check('sit snaps to chair', s1.me.s === seatIndex + 1 && Math.abs(s1.me.x - chair.x) < 0.11 && Math.abs(s1.me.y - chair.y) < 0.11, JSON.stringify(s1.me));
  await s2.toNorthField(chair.x + 30);
  await s2.walkTo(chair.x + 30, chair.y - 20, 8);
  t.check('second player reached the chair', Math.hypot(s2.me.x - chair.x, s2.me.y - chair.y) < map.chairReach);
  s2.send('use');
  await wait(120);
  t.check('occupied chair cannot be taken', !s2.me.s);

  s1.send('use');
  await wait(100);
  t.check('E again stands up', !s1.me.s);
  s1.send('in 1');
  await wait(60);
  s1.send('use');
  await wait(150);
  const heldX = s1.me.x, heldY = s1.me.y;
  await wait(300);
  t.check('sit while holding a key stays seated', !!s1.me.s && s1.me.x === heldX && s1.me.y === heldY);
  s1.send('in 0');
  await wait(150);
  t.check('releasing that key keeps sitting', !!s1.me.s);
  s1.send('in 8');
  await wait(300);
  t.check('new key press stands and moves', !s1.me.s && s1.me.x > heldX + 20);
  s1.send('in 0');
  await s1.walkTo(chair.x, chair.y - 12, 8);
  s1.send('use');
  await wait(100);
  t.check('re-sit works', s1.me.s === seatIndex + 1);
  s1.close();
  await wait(200);
  s2.send('use');
  await wait(120);
  t.check('disconnect frees the chair', s2.me.s === seatIndex + 1, JSON.stringify(s2.me));

  // ---- 앉아서 낚시
  s2.send('fish');
  await wait(120);
  t.check('fish while seated', s2.me.f === 1 && s2.me.s === seatIndex + 1 && bobberOk(s2.me));
  const castAt = Date.now();
  const bit = await s2.until(() => s2.me.f === 2, 9000);
  const waited = (Date.now() - castAt) / 1000;
  t.check('bite within 2.5-7s', bit && waited > 2.2 && waited < 7.4, waited.toFixed(2));
  s2.send('fish');
  await s2.until(() => s2.events.some((e) => e.t === 'catch'), 1000);
  await wait(80);
  const caught = s2.events.find((e) => e.t === 'catch');
  t.check('catch event', caught && caught.id === s2.id && [0, 1, 2].includes(caught.k) && caught.c.reduce((x, y) => x + y) === 1, JSON.stringify(caught));
  t.check('still seated after catch', s2.me.s === seatIndex + 1 && !s2.me.f);

  s2.send('fish');
  await s2.until(() => s2.me.f === 2, 9000);
  const biteAt = Date.now();
  await s2.until(() => !s2.me.f, 3000);
  const windowSec = (Date.now() - biteAt) / 1000;
  await wait(60);
  t.check('bite window about 1.2s', windowSec > 1.0 && windowSec < 1.45, windowSec.toFixed(2));
  t.check('escape message', s2.events.some((e) => e.t === 'sys' && e.m.includes('달아났')));
  t.check('no extra catch', s2.events.filter((e) => e.t === 'catch').length === 1);

  s2.send('in 0');
  s2.send('use');
  await wait(80);
  t.check('stood up', !s2.me.s);
  s2.send('in 1');
  await wait(40);
  s2.send('fish');
  await wait(100);
  t.check('cast while holding a key', s2.me.f === 1, JSON.stringify(s2.me));
  const fx = s2.me.x, fy = s2.me.y;
  await wait(300);
  t.check('no movement while fishing', s2.me.x === fx && s2.me.y === fy);
  s2.send('in 0');
  await wait(100);
  t.check('releasing key keeps fishing', s2.me.f === 1);
  s2.send('in 4');
  await wait(200);
  t.check('new key cancels fishing', !s2.me.f);
  s2.send('in 0');
  s2.close();

  // ---- 잘못된 입력
  const raw = await Bot.enter(server, '이상한입력');
  for (const m of ['fish extra args', 'use 99', 'in abc', 'in -1', 'fishing', 'sitting', '', ' ', 'fish', 'fish', 'fish', 'use', 'use', 'use', 'pet x', 'feed y']) raw.send(m);
  await wait(200);
  t.check('garbage does not kill the connection', !raw.closed && raw.ws.readyState === WebSocket.OPEN);
  raw.close();

  // ---- 여러 명이 동시에: 어종 분포와 찌 위치
  const bots = [];  // 동시 로그인 제한(16건)에 걸리지 않게 나눠서 입장한다
  for (let i = 0; i < 40; i += 8) {
    bots.push(...await Promise.all(Array.from({ length: 8 }, (_, j) => Bot.enter(server, '봇' + (i + j), { id: uniqueId('many') }))));
  }
  t.check('spawns are on land and clear of buildings', bots.every((x) => x.me.y < top(x.me.x) - map.margin && !isBlocked(map, 0, x.me.x, x.me.y)));
  await Promise.all(bots.map(async (x) => {
    await x.walkTo(x.me.x, top(x.me.x) - 40, 20, 8000);
  }));
  let badBobbers = 0;
  const deadline = Date.now() + 26000;
  await Promise.all(bots.map(async (x) => {
    while (Date.now() < deadline) {
      x.send('fish');
      if (!await x.until(() => x.me.f === 1, 1000)) break;
      if (!bobberOk(x.me)) badBobbers++;
      if (!await x.until(() => x.me.f === 2, 9000)) break;
      x.send('fish');
      await x.until(() => !x.me.f, 1000);
      await wait(30);
    }
  }));
  await wait(300);
  const kinds = [0, 0, 0];
  let catches = 0;
  for (const e of bots[0].events) if (e.t === 'catch') { kinds[e.k]++; catches++; }
  t.check('every bobber on water', badBobbers === 0, badBobbers);
  t.check('species mix near 60/30/10', catches > 100 && kinds[0] > kinds[1] && kinds[1] > kinds[2] && kinds[2] > 0, `${catches}: ${kinds.join('/')}`);
  bots.forEach((x) => x.close());
  a.close();
  await server.stop();
  await oldPlaces(t);
}

// 예전 넓은 마을(map=1)에 저장된 위치: 강 근처부터 남쪽은 그대로 옮기고, 없어진 곳(슬라임 군락지 5, 왕국 7)은 광장에서 시작한다
async function oldPlaces(t) {
  const { server, ids } = await serverWithAccounts({
    plaza: [0, 1100, 1100, { map: 1 }], south: [0, 1250, 1700, { map: 1 }], colony: [5, 600, 500, { map: 1 }], kingdom: [7, 900, 1200, { map: 1 }],
    house: [1, 300, 330, { map: 1 }], fresh: [0, 1000, 600],
  });
  const bots = {};
  for (const name of Object.keys(ids)) bots[name] = await Bot.enter(server, name, { id: ids[name] });
  const at = (name) => [bots[name].zone, Math.round(bots[name].me.x), Math.round(bots[name].me.y)];
  t.check('an old village spot moves with the map', JSON.stringify(at('plaza')) === '[0,820,620]', JSON.stringify(at('plaza')));
  t.check('an old south bank spot moves with the map', JSON.stringify(at('south')) === '[0,970,1220]', JSON.stringify(at('south')));
  const spawn = (name) => at(name)[0] === 0 && Math.abs(at(name)[1] - 720) <= 112 && Math.abs(at(name)[2] - 560) <= 70;
  t.check('people from the slime colony start at the plaza', spawn('colony'), JSON.stringify(at('colony')));
  t.check('people from the kingdom start at the plaza', spawn('kingdom'), JSON.stringify(at('kingdom')));
  t.check('people inside a house stay in the house', JSON.stringify(at('house')) === '[1,300,330]', JSON.stringify(at('house')));
  t.check('a new save is not moved again', JSON.stringify(at('fresh')) === '[0,1000,600]', JSON.stringify(at('fresh')));
  for (const bot of Object.values(bots)) bot.close();
  await server.stop();
}

function isBlocked(map, zone, x, y) {
  return map.solids.some((s) => s[0] === zone && x > s[1] - map.body && x < s[3] + map.body && y > s[2] - map.body && y < s[4] + map.body);
}
