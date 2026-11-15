// 붙인 방의 크기 바꾸기(가로·세로, 범위, 가구가 걸치면 그대로, 다시 켜도 남는다)와
// 가구 돌리기(깔개·텃밭·침대는 90도씩, 그 밖의 가구는 좌우 뒤집기, 돌릴 자리가 없으면 그대로).
// 화면: 상점의 넓히기 탭에서 막대로 크기 바꾸기, 돌린 침대에 눕기
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const RARA = 2, RIGHT = 3, UP = 0;
const CHAIR = 0, BED = 13, PLOT = 62;
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const room = (bot) => bot.events.filter((e) => e.t === 'room' && e.z === RARA).at(-1)?.zone;
const decor = (bot) => bot.events.filter((e) => e.t === 'decor').at(-1)?.p || [];
const item = (bot, kind) => decor(bot).find((d) => d[1] === kind);
const pause = () => wait(280);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({ a: [RARA, 200, 300, { f0: 2, f13: 1, f62: 1 }] });
  let a = await Bot.enter(server, 'a', { id: ids.a });
  await wait(60);
  t.check('the map says how far a room can be resized', JSON.stringify(a.map.zones[RARA].osize) === '[200,900,200,700]');

  // ---- 방 크기
  a.send(`expand open ${RIGHT}`);
  await a.until(() => room(a)?.open.length === 1, 1500);
  const first = room(a).open[0];
  t.check('a new room starts at the usual size', first[3] === 440 && first[4] === 360, JSON.stringify(first));
  await pause();
  a.send(`expand size ${RIGHT} 300 500`);
  await a.until(() => room(a).open[0][4] === 500, 1500);
  const sized = room(a), added = sized.floors.at(-1);
  t.check('its length and depth change as asked', sized.open[0][3] === 300 && added[2] - added[0] === 500 && added[3] - added[1] === 300 && sized.w === 620 + 60 + 500, JSON.stringify(sized.floors));
  await pause();
  a.send(`expand size ${RIGHT} 50 5000`);
  await a.until(() => room(a).open[0][4] === 700, 1500);
  t.check('sizes are held to the limits', room(a).open[0][3] === 200 && room(a).open[0][4] === 700, JSON.stringify(room(a).open));
  await pause();
  a.send(`expand size ${RIGHT} 900 700`);
  await a.until(() => room(a).open[0][3] === 900, 1500);
  const big = room(a).floors.at(-1);
  t.check('a room longer than the wall centres on the house', big[1] === (460 - 900) / 2 && big[3] === (460 + 900) / 2, JSON.stringify(big));
  await pause();
  a.send(`decor place ${CHAIR} 1300 600`);
  await a.until(() => item(a, CHAIR), 1500);
  await pause();
  a.send(`expand size ${RIGHT} 400 400`);
  await a.until(() => says(a, '걸치는 가구'), 1500);
  t.check('furniture in the part being cut keeps the room as it is', says(a, '걸치는 가구') && room(a).open[0][3] === 900);
  await pause();
  a.send(`expand open ${UP} 120`);
  await a.until(() => room(a).open.length === 2, 1500);
  await pause();
  a.send(`expand size ${UP} 900 700`);
  await a.until(() => says(a, '겹칩니다'), 1500);
  t.check('a room cannot grow into another added room', says(a, '겹칩니다') && room(a).open.find((o) => o[0] === UP)[3] === 560, JSON.stringify(room(a).open));

  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  a = await Bot.enter(again, 'a', { id: ids.a });
  await wait(100);
  const kept = a.map.zones[RARA].open.find((o) => o[0] === RIGHT);
  t.check('room sizes survive a restart', kept?.[3] === 900 && kept[4] === 700, JSON.stringify(a.map.zones[RARA].open));

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
  const { server, ids } = await serverWithAccounts({ g: [RARA, 200, 300, { f13: 1 }] });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g', viewport: { width: 1200, height: 800 } });
  await page.waitForFunction(() => zone === 2, null, { timeout: 4000 });
  await page.evaluate(() => { ws.send('expand open 3'); });
  await page.waitForFunction(() => terrain.zones[2].open.length === 1, null, { timeout: 3000 });
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="expand"]');
  await page.waitForSelector('.expand-size-row', { timeout: 3000 });
  const labels = await page.$$eval('.expand-size-row label', (els) => els.map((e) => e.textContent));
  t.check('the expansion tab has length and depth sliders for the added room', labels.length === 2 && labels[0].includes('세로') && labels[0].includes('440px') && labels[1].includes('가로') && labels[1].includes('360px') && await page.isDisabled('.expand-size-row .rbtn'), JSON.stringify(labels));
  await page.$eval('.expand-size-row input[data-field="deep"]', (el) => { el.value = 520; el.dispatchEvent(new Event('input', { bubbles: true })); });
  t.check('moving a slider arms the button', !(await page.isDisabled('.expand-size-row .rbtn')) && (await page.textContent('.expand-size-row .rbtn')) === '이 크기로');
  await page.click('.expand-size-row .rbtn');
  await page.waitForFunction(() => terrain.zones[2].open[0][4] === 520, null, { timeout: 3000 });
  t.check('and applying resizes the room', await page.evaluate(() => terrain.zones[2].w === 620 + 60 + 520) && (await page.textContent('.expand-size-row .rbtn')) === '지금 크기');
  await page.screenshot({ path: path.join(SHOTS, 'expand_size.png') });
  await page.evaluate(() => setFurnShop(false));

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
  t.check('no script errors while resizing and turning', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
