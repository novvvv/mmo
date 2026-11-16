// 집 확장: 원래 방 바깥을 20px 칸으로 칠해 바닥을 넓히고, 칠한 칸을 지운다.
// 칠한 칸은 지금 바닥과 이어져야 하고, 문 앞과 넓힐 수 있는 범위 밖은 칠하지 않는다. 가구나 사람이 있는 칸은 지울 수 없다.
// 원래 방 바로 위를 칠하면 그 벽이 없어지고(벽에 붙은 고정 장식은 숨는다), 서버를 다시 켜도 남는다. 예전 방식의 저장 파일은 칸으로 옮긴다.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, KYAKYA = 3, THEATER = 4, HEYEON = 9;
const PLANT = 21, WALL = 71;
const pause = () => wait(260);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const room = (bot, z) => bot.events.filter((e) => e.t === 'room' && e.z === z).at(-1)?.zone;
const decor = (bot) => bot.lastEvent('decor');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [MOLJA, 340, 300, { f21: 3, f71: 1 }], walker: [MOLJA, 600, 240], out: [0, 820, 620], c: [RARA, 300, 420],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a'), walker = await enter('walker'), out = await enter('out'), c = await enter('c');
  const zones = a.map.zones;
  t.check('the four houses can be expanded and other places cannot', [MOLJA, RARA, KYAKYA, HEYEON].every((z) => zones[z].base && zones[z].cells === 0) && !zones[THEATER].base);
  t.check('the map says the cell size, the limit and how far a house can grow', zones[MOLJA].cell === 20 && zones[MOLJA].maxCells === 10000 && zones[MOLJA].reach.join() === '-800,-800,1480,1240', JSON.stringify(zones[MOLJA]));
  t.check('an unexpanded one-room house still draws as one room', !zones[MOLJA].floors && zones[KYAKYA].floors.length === 5);
  t.check('the map says what a cell costs', a.map.expandPrice === 0);

  // ---- 오른쪽에 방 하나: 원래 방(680×440) 오른쪽 x 680~1000, y 100~340
  a.send('expand add 34 5 49 16');
  await out.until(() => room(out, MOLJA)?.cells, 1500);
  const right = room(out, MOLJA);
  t.check('painting reaches everyone, even outside', right?.cells === 16 * 12, JSON.stringify(right));
  t.check('the original room stays and the painted part is one more floor', JSON.stringify(right.floors) === JSON.stringify([[0, 0, 680, 440, 0], [680, 100, 1000, 340, 0]]), JSON.stringify(right.floors));
  t.check('the house grows to the right', right.w === 1000 && right.h === 440, JSON.stringify([right.w, right.h]));
  t.check('painting says how many cells were added', says(a, '192칸을 넓혔습니다'));

  walker.send('in 8');
  await walker.until(() => walker.me.x > 760, 2500);
  walker.send('in 0');
  t.check('you can walk into the painted part', walker.me.x > 760, JSON.stringify(walker.me));

  // ---- 이어지지 않은 칸, 문 앞, 범위 밖, 원래 방과 겹친 칸
  await pause();
  a.send('expand add 60 0 62 2');
  await a.until(() => says(a, '이어지게'), 1500);
  t.check('cells must connect to the floor', says(a, '이어지게') && room(out, MOLJA).cells === 192);
  await pause();
  a.send('expand add 15 22 18 26');   // 문(340, 440) 바로 아래
  await a.until(() => says(a, '문 앞은'), 1500);
  t.check('the outside of the door stays clear', says(a, '문 앞은') && room(out, MOLJA).cells === 192);
  await pause();
  a.send('expand add 50 5 95 6');   // 오른쪽 끝은 680 + 800 = 1480 (칸 73) 까지
  await out.until(() => room(out, MOLJA).cells > 192, 1500);
  t.check('painting stops at the edge of the reach', room(out, MOLJA).w === 1480, JSON.stringify(room(out, MOLJA).w));
  await pause();
  a.send('expand remove 50 5 95 6');
  await out.until(() => room(out, MOLJA).cells === 192, 1500);
  await pause();
  a.send('expand add 30 10 34 11');   // 원래 방 안의 칸(30~33)과 이미 칠한 칸(34)뿐이다
  await wait(400);
  t.check('cells already on the floor are skipped', room(out, MOLJA).cells === 192 && !says(a, '0칸'), room(out, MOLJA).cells);

  // ---- 지우기: 가구나 사람이 있으면 그대로, 바닥이 끊어지면 그대로
  await pause();
  a.send(`decor place ${PLANT} 900 300`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === PLANT && d[2] === 900), 1500);
  await pause();
  a.send('expand remove 34 5 49 16');
  await a.until(() => says(a, '가구를 먼저'), 1500);
  t.check('cells under furniture are kept', says(a, '가구를 먼저') && room(out, MOLJA).cells >= 192);
  await pause();
  a.send(`decor take ${decor(a).p.find((d) => d[1] === PLANT && d[2] === 900)[0]}`);
  await a.until(() => !decor(a)?.p.some((d) => d[1] === PLANT && d[2] === 900), 1500);
  await pause();
  a.send('expand remove 34 5 49 16');
  await a.until(() => says(a, '누가 있습니다'), 1500);
  t.check('cells someone stands on are kept', says(a, '누가 있습니다'));
  walker.send('in 4');
  await walker.until(() => walker.me.x < 640, 3000);
  walker.send('in 0');
  await pause();
  a.send('expand remove 34 5 35 16');   // 오른쪽 방을 원래 방과 떼어 놓는 줄
  await a.until(() => says(a, '끊어집니다'), 1500);
  t.check('a cut that would leave floor floating is refused', says(a, '끊어집니다'));
  await pause();
  a.send('expand remove 30 0 60 20');
  await out.until(() => room(out, MOLJA).cells === 0, 1500);
  t.check('erasing everything brings the house back to one room', room(out, MOLJA).cells === 0 && !room(out, MOLJA).floors && room(out, MOLJA).w === 680);

  // ---- 원래 방 위를 칠하면 뒷벽이 없어진다. 벽걸이가 걸린 자리는 먼저 옮겨야 한다
  await pause();
  a.send(`decor place ${PLANT} 300 200`);   // 바닥 가구는 상관없다
  await pause();
  a.send('expand add 0 -10 33 -1');   // 몰쟈의 집에는 큰 창(벽걸이)이 처음부터 걸려 있다
  await a.until(() => says(a, '벽걸이를 먼저'), 1500);
  t.check('painting over a wall with a hanging is refused', says(a, '벽걸이를 먼저'));
  c.send('expand add 0 -10 30 -1');   // 랏라의 집 벽의 창과 담쟁이는 고정 장식이다
  await out.until(() => room(out, RARA)?.cells === 31 * 10, 1500);
  const opened = room(out, RARA);
  t.check('painting above a room removes its back wall', opened.floors.length === 2 && opened.floors[1].join() === '0,-200,620,0,1', JSON.stringify(opened.floors));
  const rara = await Bot.enter(server, 'late');   // 나중에 들어온 사람은 지도에서 받는다
  await wait(100);
  t.check('fixed decorations on that wall are hidden', !rara.map.furn.some((f) => f.z === RARA && (f.k === 'window' || f.k === 'ivy')), JSON.stringify(rara.map.furn.filter((f) => f.z === RARA).map((f) => f.k)));
  rara.close();

  // ---- 벽 가구
  await pause();
  a.send(`decor place ${WALL} 520 380`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === WALL), 1500);
  t.check('a wall piece can be placed in a room', decor(a).p.some((d) => d[1] === WALL));
  await pause();
  a.send(`decor turn ${decor(a).p.find((d) => d[1] === WALL)[0]}`);
  await a.until(() => decor(a).p.find((d) => d[1] === WALL)?.[7] === 2, 1500);
  t.check('a wall piece turns to stand lengthwise', decor(a).p.find((d) => d[1] === WALL)?.[7] === 2, JSON.stringify(decor(a).p.find((d) => d[1] === WALL)));

  // ---- 밖에서는 못 한다
  out.send('expand add 0 -3 2 -1');
  await out.until(() => says(out, '집 안에서만'), 1500);
  t.check('expanding only works inside a house', says(out, '집 안에서만'));

  // ---- 다시 켜도 남는다
  await wait(300);
  await server.stop();
  const file = path.join(server.dataDir, 'expand.list');
  t.check('painted cells are saved as cells', /^2\tc\t0,-10 /m.test(readFileSync(file, 'utf8')), readFileSync(file, 'utf8').slice(0, 80));
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'back');
  await wait(100);
  t.check('painted cells survive a restart', back.map.zones[RARA].cells === 310 && back.map.zones[RARA].floors[1].join() === '0,-200,620,0,1');
  back.close();
  await again.stop();

  // ---- 예전 방식(벽을 뚫어 붙인 방)으로 저장된 집은 그 모양을 덮는 칸으로 옮긴다
  writeFileSync(file, '1\t3\t220.0\t60.0\t0.0\t0.0\n');   // 몰쟈의 집 오른쪽, 통로 가운데 y 220, 반폭 60, 기본 크기 방
  const old = await startServer({ dataDir: server.dataDir });
  const reader = await Bot.enter(old, 'reader');
  await wait(100);
  const moved = reader.map.zones[MOLJA];
  t.check('an old-style expansion becomes cells covering it', moved.cells > 0 && moved.w === 680 + 60 + 360 && moved.floors.some((f) => f[0] === 680 && f[1] <= 160 && f[3] >= 280), JSON.stringify(moved.floors));
  reader.close();
  await wait(300);
  await old.stop();
  t.check('and the file is rewritten as cells', /^1\tc\t/m.test(readFileSync(file, 'utf8')));
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({ g: [HEYEON, 320, 380] });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g', viewport: { width: 1200, height: 860 } });
  await page.waitForFunction(() => zone === 9, null, { timeout: 4000 });
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="expand"]');
  await page.waitForSelector('#expand-pane:not([hidden])', { timeout: 3000 });
  t.check('the expansion tab names the house and counts cells', (await page.textContent('#expand-name')) === '헤연의 집' && (await page.textContent('#expand-count')).includes('0 / 10000'));
  // 편집 화면에서 원래 방 오른쪽 바깥을 끌어 칠한다
  const box = await page.$eval('#expand-map', (el) => el.getBoundingClientRect().toJSON());
  const point = await page.evaluate(([wx, wy]) => {
    const r = expandMap.getBoundingClientRect();
    return [r.left + (expandView.ox + wx * expandView.scale) * r.width / expandMap.width, r.top + (expandView.oy + wy * expandView.scale) * r.height / expandMap.height];
  }, [650, 100]);
  const end = await page.evaluate(([wx, wy]) => {
    const r = expandMap.getBoundingClientRect();
    return [r.left + (expandView.ox + wx * expandView.scale) * r.width / expandMap.width, r.top + (expandView.oy + wy * expandView.scale) * r.height / expandMap.height];
  }, [830, 300]);
  await page.mouse.move(point[0], point[1]);
  await page.mouse.down();
  await page.mouse.move(end[0], end[1], { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(() => terrain.zones[9].cells > 0, null, { timeout: 3000 });
  const painted = await page.evaluate(() => terrain.zones[9].floors);
  t.check('dragging on the plan paints that rectangle', painted.length === 2 && painted[1][0] === 640 && painted[1][2] >= 820, JSON.stringify(painted) + JSON.stringify(box));
  t.check('the cell count updates', (await page.textContent('#expand-count')).includes(`${await page.evaluate(() => terrain.zones[9].cells)} / 10000`));
  await page.click('#expand-erase');
  // 칠한 뒤에는 바닥 둘레에 맞춰 보는 범위가 바뀌므로 화면 위치를 다시 잰다
  const [from, to] = await page.evaluate((spots) => spots.map(([wx, wy]) => {
    const r = expandMap.getBoundingClientRect();
    return [r.left + (expandView.ox + wx * expandView.scale) * r.width / expandMap.width, r.top + (expandView.oy + wy * expandView.scale) * r.height / expandMap.height];
  }), [[650, 100], [830, 300]]);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(() => terrain.zones[9].cells === 0, null, { timeout: 3000 });
  t.check('erasing on the plan takes the cells away', await page.evaluate(() => !terrain.zones[9].floors));
  await page.evaluate(() => { ws.send('expand add 32 2 45 15'); });
  await page.waitForFunction(() => terrain.zones[9].cells > 0, null, { timeout: 3000 });
  await page.evaluate(() => setFurnShop(false));
  await wait(300);
  await page.screenshot({ path: path.join(SHOTS, 'expand_cells.png') });
  t.check('no script errors while expanding', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
