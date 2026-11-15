// 캬캬의 집: 복도로 이어진 거실, 침실, 주방
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageSelf, pageWalkTo, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const KYAKYA = 3;
const shot = (name) => path.join(SHOTS, name);
const BEDROOM = [0, 0, 400, 380], LIVING = [460, 0, 1120, 420], KITCHEN = [200, 580, 640, 900];
const PLANTS = ['plant', 'plant_small', 'tall_plant', 'monstera', 'ivy', 'potting_bench'];
const inRect = ([x0, y0, x1, y1], p) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    walker: [KYAKYA, 790, 200], lamp: [KYAKYA, 90, 330], ghost: [KYAKYA, 300, 480],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(80);
    return bot;
  };
  const walker = await enter('walker');
  const zone = walker.map.zones[KYAKYA];
  const house = walker.map.buildings.find((b) => b.name === '캬캬');

  t.check('캬캬 house is the carved zone', house.room === KYAKYA && zone.floors?.length === 5, JSON.stringify(zone));
  t.check('three rooms look different', new Set(zone.floors.filter((f) => f[2] - f[0] > 200).map((f) => f[4])).size === 3, JSON.stringify(zone.floors));
  t.check('the front door is in the living room', zone.door[0] === 790 && zone.door[1] === 420, JSON.stringify(zone.door));
  t.check('other houses stay single rooms', walker.map.zones.filter((z) => z.floors).length === 1);
  t.check('the lights start soft', walker.lastEvent('light')?.lv === 70, JSON.stringify(walker.lastEvent('light')));

  const inside = (rect, list) => list.filter(([, x, y]) => x > rect[0] && x < rect[2] && y > rect[1] && y < rect[3]);
  const furn = walker.map.furn.concat(walker.map.seeds).filter((f) => f.z === KYAKYA);  // 옮길 수 있는 가구는 seeds 로 온다
  const kindsIn = (rect) => new Set(furn.filter((f) => f.x > rect[0] && f.x < rect[2] && f.y > rect[1] - 130 && f.y < rect[3]).map((f) => f.k));
  const decorSeats = (walker.lastEvent('decor')?.p ?? []).flatMap((d) => d[5]).map((s) => [0, s[1], s[2]]);
  const seatsIn = (rect) => inside(rect, walker.map.seats.filter((s) => s.z === KYAKYA).map((s) => [0, s.x, s.y]).concat(decorSeats));
  t.check('bedroom has a bed and a vanity', kindsIn(BEDROOM).has('linen_bed') && kindsIn(BEDROOM).has('vanity'), [...kindsIn(BEDROOM)].join());
  t.check('kitchen has a counter and an island', kindsIn(KITCHEN).has('kitchen_counter') && kindsIn(KITCHEN).has('kitchen_island'), [...kindsIn(KITCHEN)].join());
  t.check('캬캬 house has no plants', !furn.some((f) => PLANTS.includes(f.k)), furn.map((f) => f.k).join());
  const molja = walker.map.furn.concat(walker.map.seeds).filter((f) => f.z === 1).map((f) => f.k);
  t.check('몰쟈 rug is plain', molja.includes('rug_plain'), molja.join());
  t.check('몰쟈 house has plants and big windows', molja.includes('monstera') && molja.includes('tall_plant') && molja.filter((k) => k === 'big_window').length === 2, molja.join());
  t.check('living room keeps the piano and TV', kindsIn(LIVING).has('piano') && kindsIn(LIVING).has('tv') && walker.map.furn.concat(walker.map.seeds).some((f) => f.z === 1 && f.k === 'tv_wall'), [...kindsIn(LIVING)].join());
  t.check('every room has a seat', seatsIn(BEDROOM).length >= 2 && seatsIn(LIVING).length >= 3 && seatsIn(KITCHEN).length >= 2);
  t.check('every room has a lamp', [BEDROOM, LIVING, KITCHEN].every((r) => kindsIn(r).has('lantern_lamp')));

  // ---- 복도로 걸어서 간다
  await walker.walkTo(520, 210, 10);
  await walker.walkTo(430, 210, 10);
  t.check('the left passage is open', walker.me.x < 460 && walker.me.x > 400, JSON.stringify(walker.me));
  await walker.walkTo(300, 210, 10);
  t.check('it leads to the bedroom', inRect(BEDROOM, walker.me), JSON.stringify(walker.me));

  // 벽을 뚫고 나갈 수 없다
  await walker.walkTo(300, 330, 10);
  walker.send('in 2');
  await wait(700);
  walker.send('in 0');
  await wait(100);
  t.check('bedroom south wall holds', walker.me.y <= 366.5, walker.me.y);

  await walker.walkTo(380, 210, 10);
  await walker.walkTo(520, 210, 10);
  await walker.walkTo(510, 380, 10);
  await walker.walkTo(510, 520, 10);
  t.check('the lower left passage is open', walker.me.y > 420 && walker.me.y < 580 && Math.abs(walker.me.x - 510) < 26, JSON.stringify(walker.me));
  walker.send('in 4');
  await wait(600);
  walker.send('in 0');
  await wait(100);
  t.check('corridor walls hold', walker.me.x >= 483.5, walker.me.x);
  await walker.walkTo(510, 660, 10);
  t.check('it leads to the kitchen', inRect(KITCHEN, walker.me), JSON.stringify(walker.me));

  // ---- 조명
  const lampBot = await enter('lamp');
  t.check('can start inside the bedroom', lampBot.zone === KYAKYA && inRect(BEDROOM, lampBot.me), JSON.stringify(lampBot.me));
  const before = lampBot.events.filter((e) => e.t === 'light').length;
  lampBot.send('lamp');   // 스탠드는 L 키 (E 는 앉기와 문)
  await lampBot.until(() => lampBot.events.filter((e) => e.t === 'light').length > before, 1000);
  t.check('L works on the lantern lamp', lampBot.lastEvent('light')?.lamp === false, JSON.stringify(lampBot.lastEvent('light')));

  // 벽 속 좌표에는 나타날 수 없다
  const ghost = await enter('ghost');
  t.check('a saved spot inside a wall is not used', ghost.zone === 0, JSON.stringify(ghost.me));

  for (const bot of [walker, lampBot, ghost]) bot.close();
  await wait(100);
  await server.stop();
}

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    living: [KYAKYA, 700, 350], bedroom: [KYAKYA, 200, 340], kitchen: [KYAKYA, 460, 680], outside: [0, 676, 1480], molja: [1, 300, 330],
  });
  const browser = await launchBrowser();
  const open = (name) => enterGame(browser, server, ids[name], { name });
  const day = (page) => page.evaluate(() => { clockSync = { phase: 0, at: performance.now(), len: clockSync.len }; });

  const living = await open('living');
  await living.waitForFunction(() => roomLight !== null && cats.length === 1, null, { timeout: 2000 });
  await day(living);
  await living.evaluate(() => { const c = cats[0]; c.fromX = c.toX = c.x = 720; c.fromY = c.toY = c.y = 320; });
  await wait(80);
  await living.screenshot({ path: shot('kyakya_living.png') });
  t.check('every piece of furniture has art', await living.evaluate(() => terrain.furn.every((f) => typeof FURNITURE[f.k] === 'function')));
  t.check('every room style exists', await living.evaluate(() => terrain.zones.every((z) => !z.floors || z.floors.every((f) => ROOM_STYLES[f[4]]))));
  t.check('the dog is white', await living.evaluate(() => cats[0].coat.body === '#fffdf8'));

  const bedroom = await open('bedroom');
  await day(bedroom);
  await wait(120);
  await bedroom.screenshot({ path: shot('kyakya_bedroom.png') });
  const kitchen = await open('kitchen');
  await day(kitchen);
  await wait(120);
  await kitchen.screenshot({ path: shot('kyakya_kitchen.png') });
  const molja = await open('molja');
  await day(molja);
  await wait(120);
  await molja.screenshot({ path: shot('molja_room.png') });
  const outside = await open('outside');
  await day(outside);
  await wait(120);
  await outside.screenshot({ path: shot('kyakya_outside.png') });

  // ---- 침실 벽의 포스터 (벽이 화면에 들어오도록 방 위쪽으로 걸어간다)
  await pageWalkTo(bedroom, 210, 180, 12);
  const posterPoint = await bedroom.evaluate(() => {
    const f = terrain.furnByZone[zone].find((x) => x.k === 'nimda_poster');
    const [camX, camY] = camera(innerWidth, innerHeight);
    return f && { x: f.x - camX, y: f.y - camY };
  });
  t.check('the poster hangs in the bedroom', !!posterPoint && await bedroom.evaluate(() => POSTER.complete && POSTER.naturalWidth === 269));
  await bedroom.evaluate(() => { const c = document.querySelector('#light-panel'); c.hidden = true; });
  await bedroom.screenshot({ path: shot('kyakya_poster.png'), clip: { x: Math.max(0, posterPoint.x - 170), y: Math.max(0, posterPoint.y - 70), width: 340, height: 150 } });
  await bedroom.mouse.click(posterPoint.x, posterPoint.y);
  t.check('clicking the poster enlarges it', await bedroom.isVisible('#poster-view img'));
  const big = await bedroom.$eval('#poster-view img', (el) => el.getBoundingClientRect().height);
  t.check('the enlarged poster is big', big > 500, big);
  await bedroom.screenshot({ path: shot('kyakya_poster_big.png') });
  await bedroom.keyboard.press('Escape');
  t.check('Esc closes the poster', !(await bedroom.isVisible('#poster-view')));
  await bedroom.mouse.click(posterPoint.x, posterPoint.y);
  await bedroom.click('#poster-view');
  t.check('clicking closes the poster', !(await bedroom.isVisible('#poster-view')));

  // 실제 키보드로 복도를 지날 때 위치가 튀지 않는다
  await pageWalkTo(living, 520, 210, 12);
  await pageWalkTo(living, 300, 210, 12);
  const moved = await pageSelf(living);
  t.check('keyboard walks through the passage', inRect(BEDROOM, moved), JSON.stringify(moved));
  t.check('prediction agrees with the server', Math.hypot(moved.x - moved.sx, moved.y - moved.sy) < 6, JSON.stringify(moved));
  t.check('camera follows into the new room', await living.evaluate(() => { const [cx] = camera(innerWidth, innerHeight); return me.x - cx > 100 && me.x - cx < innerWidth - 100; }));

  const problems = [...living.problems, ...bedroom.problems, ...kitchen.problems, ...outside.problems, ...molja.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
