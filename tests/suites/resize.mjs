// 가구 돌리기(깔개·텃밭·침대·벽은 90도씩, 그 밖의 가구는 좌우 뒤집기, 돌릴 자리가 없으면 그대로).
// 랏라의 집 오른쪽에 칸을 칠해 넓힌 방(x 680~1380, 원래 방과는 y 200~320 의 통로로 이어짐)에서 돌린다.
// 화면: 돌린 침대에 눕기, 벽 가구를 돌리면 세로 벽으로 그려진다
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const RARA = 2;
const CHAIR = 0, BED = 13, PLOT = 62, WALL = 72;
// 통로(620~680 × 200~320)와 오른쪽 방(680~1380 × -220~680)을 칠하는 명령
const PAINT = ['expand add 31 10 33 15', 'expand add 34 -11 68 33'];
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const room = (bot) => bot.events.filter((e) => e.t === 'room' && e.z === RARA).at(-1)?.zone;
const decor = (bot) => bot.events.filter((e) => e.t === 'decor').at(-1)?.p || [];
const item = (bot, kind) => decor(bot).find((d) => d[1] === kind);
const pause = () => wait(280);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({ a: [RARA, 200, 300, { f0: 2, f13: 1, f62: 1 }] });
  let a = await Bot.enter(server, 'a', { id: ids.a });
  await wait(60);
  for (const command of PAINT) {
    a.send(command);
    await pause();
  }
  await a.until(() => room(a)?.cells === 6 * 3 + 35 * 45, 1500);
  t.check('the test room is painted', room(a)?.cells === 6 * 3 + 35 * 45, JSON.stringify(room(a)));
  await pause();
  a.send(`decor place ${CHAIR} 1300 600`);
  await a.until(() => item(a, CHAIR), 1500);

  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  a = await Bot.enter(again, 'a', { id: ids.a });
  await wait(100);
  t.check('the painted room survives a restart', a.map.zones[RARA].cells === 6 * 3 + 35 * 45 && item(a, CHAIR), JSON.stringify(a.map.zones[RARA]));

  // ---- 가구 돌리기
  const turnOf = (kind) => item(a, kind)?.[7];
  a.send(`decor turn ${item(a, CHAIR)[0]}`);
  await a.until(() => turnOf(CHAIR) === 1, 1500);
  t.check('a chair flips left and right', turnOf(CHAIR) === 1);
  await pause();
  a.send(`decor place ${PLOT} 900 100`);
  await a.until(() => item(a, PLOT), 1500);
  for (const want of [2, 4, 6, 0]) {
    await pause();
    a.send(`decor turn ${item(a, PLOT)[0]}`);
    await a.until(() => turnOf(PLOT) === want, 1500);
  }
  t.check('a garden bed turns a quarter at a time and comes back round', turnOf(PLOT) === 0 && item(a, PLOT)[2] === 900 && item(a, PLOT)[3] === 100);
  await pause();
  a.send(`decor turn ${item(a, PLOT)[0]}`);
  await a.until(() => turnOf(PLOT) === 2, 1500);
  await pause();
  a.send(`decor move ${item(a, PLOT)[0]} 724 100`);   // 세로로 선 밭은 폭이 80 이라 붙인 방의 왼쪽 벽(680)에 붙는다
  await a.until(() => item(a, PLOT)[2] === 724, 1500);
  await pause();
  a.send(`decor turn ${item(a, PLOT)[0]}`);
  await a.until(() => says(a, '돌릴 수 없어요'), 1500);
  t.check('turning is refused where the turned shape does not fit', says(a, '돌릴 수 없어요') && turnOf(PLOT) === 2);
  await pause();
  a.send(`decor place ${BED} 1000 300`);
  await a.until(() => item(a, BED), 1500);
  const flat = item(a, BED);
  t.check('a bed starts with two places lying head up', flat[5].length === 2 && flat[5][0][4] === 1 && flat[5][0][7] === 0 && flat[5][0][3] === 1, JSON.stringify(flat[5]));
  await pause();
  a.send(`decor turn ${flat[0]}`);
  await a.until(() => turnOf(BED) === 2, 1500);
  const side = item(a, BED);
  t.check('a turned bed keeps its centre and turns the sleepers with it', side[3] === 303 && Math.abs(side[5][0][1] - 1009) < 1 && Math.abs(side[5][0][2] - 214) < 1 && side[5][0][7] === -1 && side[5][0][3] === 0, JSON.stringify(side));
  await again.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({ g: [RARA, 200, 300, { f13: 1, f72: 1 }] });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g', viewport: { width: 1200, height: 800 } });
  await page.waitForFunction(() => zone === 2, null, { timeout: 4000 });
  for (const command of PAINT) {
    await page.evaluate((c) => ws.send(c), command);
    await wait(280);
  }
  await page.waitForFunction(() => terrain.zones[2].cells > 1000, null, { timeout: 3000 });

  // 벽 가구: 돌리면 세로 벽(폭 20, 길이 200)이 되고, 그림 범위도 세로로 길어진다
  await page.evaluate((w) => ws.send(`decor place ${w} 1000 100`), WALL);
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'room_wall_long'), null, { timeout: 3000 });
  await wait(300);
  await page.evaluate(() => ws.send(`decor turn ${decorItems.find((d) => d.info.k === 'room_wall_long').id}`));
  await page.waitForFunction(() => decorItems.find((d) => d.info.k === 'room_wall_long')?.rot === 1, null, { timeout: 3000 });
  const wall = await page.evaluate(() => { const d = decorItems.find((x) => x.info.k === 'room_wall_long'); return { hw: d.info.hw, d: d.info.d, bounds: itemBounds(d) }; });
  t.check('a turned wall stands lengthwise', wall.hw === 10 && wall.d === 200 && wall.bounds.w === 20 && wall.bounds.h === 200 + 124, JSON.stringify(wall));

  await page.evaluate(() => ws.send('decor place 13 900 300'));
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'bed'), null, { timeout: 3000 });
  await wait(300);
  await page.evaluate(() => ws.send(`decor turn ${decorItems.find((d) => d.info.k === 'bed').id}`));
  await page.waitForFunction(() => decorItems.find((d) => d.info.k === 'bed')?.rot === 1, null, { timeout: 3000 });
  const bed = await page.evaluate(() => { const d = decorItems.find((x) => x.info.k === 'bed'); return { hw: d.info.hw, d: d.info.d, bounds: itemBounds(d) }; });
  t.check('a turned bed is drawn and bounded sideways', bed.hw === 59 && bed.d === 124 && bed.bounds.w > 100 && bed.bounds.h > 100 && bed.bounds.mask === null, JSON.stringify({ hw: bed.hw, d: bed.d, w: bed.bounds.w, h: bed.bounds.h }));
  await wait(300);
  await page.screenshot({ path: path.join(SHOTS, 'bed_turned.png') });
  const lying = await page.evaluate(() => {   // 돌린 침대의 자리에 누운 모습을 한 번 그려 본다
    const d = decorItems.find((x) => x.info.k === 'bed'), [index, x, y] = d.seats[0], seat = terrain.seats[index];
    drawPlayer({ ...entities.get(myId), seat: index + 1, x, y }, true, performance.now());
    return { lie: !!seat.lie, fx: seat.fx, fy: seat.fy };
  });
  t.check('the place on a turned bed lies sideways', lying.lie && lying.fx === -1 && lying.fy === 0, JSON.stringify(lying));
  t.check('no script errors while turning', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
