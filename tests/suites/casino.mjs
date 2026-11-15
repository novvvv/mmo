// 카지노와 빠칭코: 건물과 방, 앉아야 쏠 수 있음, 구슬 값과 상금 계산, 연사 제한, 골드 부족, 기록, 창(열기, 판 그리기, 숫자판이 멈춘 뒤에 보이는 대박 상금, Esc 로 일어나기)
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const CASINO = 5;
const shot = (name) => path.join(SHOTS, name);
const pachis = (bot) => bot.events.filter((e) => e.t === 'pachi');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    door: [0, 360, 256], player: [CASINO, 130, 236, { gold: 100 }], broke: [CASINO, 224, 236, { gold: 0 }], stand: [CASINO, 480, 560, { gold: 50 }],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const door = await enter('door');
  const map = door.map;
  const casino = map.buildings.find((b) => b.k === 'casino');
  t.check('the casino stands in the north of the village', casino?.room === CASINO && casino.name === '카지노' && casino.y < 300, JSON.stringify(casino));
  const machines = map.furn.filter((f) => f.z === CASINO && f.k === 'pachinko');
  t.check('eight pachinko machines with a seat each', machines.length === 8 && map.pachi.length === 8 && map.pachi.every((i) => map.seats[i].z === CASINO && map.seats[i].fy === -1), JSON.stringify(map.pachi));
  t.check('the casino has a roulette table and a cashier', ['roulette', 'cashier', 'casino_sign'].every((k) => map.furn.some((f) => f.z === CASINO && f.k === k)));
  t.check('the casino is dim with lights', map.zones[CASINO].style === 6);
  door.send('use');
  await door.until(() => door.zone === CASINO, 1500);
  t.check('the casino door works', door.zone === CASINO);

  const player = await enter('player');
  player.send('pachi shoot');
  await wait(200);
  t.check('you must sit at a machine to shoot', pachis(player).length === 0);
  player.send('use');
  await player.until(() => player.me.s > 0, 1500);
  t.check('sitting in front of a machine', map.pachi.includes(player.me.s - 1), JSON.stringify(player.me));

  // 한꺼번에 많이 쏘면 연사 제한(6개)에 걸린다
  for (let i = 0; i < 15; i++) player.send('pachi shoot');
  await wait(250);
  t.check('rapid fire is limited', pachis(player).length >= 5 && pachis(player).length <= 7, pachis(player).length);
  // 천천히 더 쏜다
  for (let i = 0; i < 24; i++) {
    player.send('pachi shoot');
    await wait(300);
  }
  await wait(200);
  const shots = pachis(player);
  const won = shots.reduce((sum, m) => sum + m.w, 0);
  t.check('every ball costs one gold and winnings add up', shots.at(-1).g === 100 - shots.length + won, `${shots.length} shots, won ${won}, gold ${shots.at(-1).g}`);
  const valid = shots.every((m) => {
    if (m.r === 0) return m.w === 0 && !m.d;
    if (m.r === 1 || m.r === 2) return m.w === 2;
    if (m.r !== 3 || m.d?.length !== 3 || !m.d.every((d) => d >= 1 && d <= 9)) return false;
    const jackpot = m.d[0] === m.d[1] && m.d[1] === m.d[2];
    return jackpot ? m.j === (m.d[0] === 7 ? 150 : 60) && m.w === 1 + m.j : m.j === 0 && m.w === 1;
  });
  t.check('results follow the pay table', valid, JSON.stringify(shots.filter((m) => m.r === 3).slice(0, 3)));
  t.check('most balls fall out', shots.filter((m) => m.r === 0).length > shots.length / 3, shots.map((m) => m.r).join(''));

  player.send('use');
  await player.until(() => !player.me.s, 1500);
  const before = pachis(player).length;
  player.send('pachi shoot');
  await wait(250);
  t.check('standing up stops the machine', pachis(player).length === before);
  player.send('stats');
  await player.until(() => player.lastEvent('stats'), 1500);
  t.check('the profile keeps pachinko records', player.lastEvent('stats').s.length >= 18);

  const broke = await enter('broke');
  broke.send('use');
  await broke.until(() => broke.me.s > 0, 1500);
  broke.send('pachi shoot');
  await broke.until(() => pachis(broke).length, 1500);
  t.check('no gold, no balls', pachis(broke)[0]?.e === 'gold' && !broke.events.some((e) => e.t === 'inv' && e.g < 0));

  const stand = await enter('stand');
  stand.send('use');   // 룰렛 옆 의자가 아닌 빈 곳: 앉을 자리가 멀다
  await wait(200);
  stand.send('pachi shoot');
  await wait(200);
  t.check('away from the machines nothing happens', pachis(stand).length === 0);
  for (const bot of [door, player, broke, stand]) bot.close();
  await server.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ gambler: [CASINO, 318, 236, { gold: 300 }] });
  const chrome = await launchBrowser();
  const page = await enterGame(chrome, server, ids.gambler, { name: '도박사', viewport: { width: 1200, height: 760 } });
  await wait(300);
  t.check('the HUD names the casino', (await page.textContent('#hud')).includes('카지노'), await page.textContent('#hud'));
  t.check('the casino has its own music', (await page.evaluate(() => musicKey())) === 'casino');
  t.check('the hint offers a seat', (await page.evaluate(() => actionHint({ ...entities.get(myId), x: me.x, y: me.y }))).includes('E: 앉기'));
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#pachi:not([hidden])', { timeout: 3000 });
  await wait(300);
  t.check('sitting opens the pachinko window', await page.isVisible('#pachi-board') && (await page.textContent('#pachi-gold')) === '300 G');
  const painted = await page.$eval('#pachi-board', (c) => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) colors.add((data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4));
    return colors.size;
  });
  t.check('the board is drawn', painted > 20, painted);

  // 물리로 굴린 길이 네 구멍에 모두 들어갈 수 있다 (화면은 서버의 결과에 맞는 길을 고른다)
  const reach = await page.evaluate(() => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const path = pachiSimulate(0.5);
      counts[path ? path.pocket : 4]++;
    }
    return counts;
  });
  t.check('balls can land in every pocket', reach[0] > 100 && reach[1] > 0 && reach[2] > 0 && reach[3] > 0 && reach[4] < 8, reach.join());

  await page.keyboard.down('Space');
  await page.waitForFunction(() => pachiBalls.length > 0, null, { timeout: 2000 });
  t.check('holding Space shoots balls', true);
  await wait(1500);
  await page.keyboard.up('Space');
  await page.screenshot({ path: shot('casino_pachinko.png') });
  await page.waitForFunction(() => pachiBalls.length === 0 && !pachiSpin && !pachiQueue.length, null, { timeout: 15000 });
  t.check('after the balls settle the gold matches the server', await page.evaluate(() => pachiHidden === 0 && myGold === pachiServerGold && pachiGold.textContent === `${pachiServerGold} G`));

  // 대박은 숫자판이 멈춘 뒤에야 골드에 보인다
  const start = await page.evaluate(() => myGold);
  await page.evaluate((g) => applyPachi({ t: 'pachi', r: 3, d: [7, 7, 7], j: 150, w: 151, g: g + 150 }), start);
  t.check('a jackpot is hidden while the ball rolls', await page.evaluate((g) => myGold === g && pachiHidden === 151, start));
  await page.waitForFunction(() => pachiSpin, null, { timeout: 8000 });
  t.check('the start pocket pays its one gold at once', await page.evaluate((g) => myGold === g && pachiHidden === 150, start));   // 구슬 값 1골드를 내고 1골드를 돌려받았다
  await page.waitForFunction(() => pachiFlash > performance.now(), null, { timeout: 8000 });
  await wait(200);
  await page.screenshot({ path: shot('casino_jackpot.png') });
  t.check('the jackpot shows when the reels stop', await page.evaluate((g) => myGold === g + 150 && pachiHidden === 0 && pachiDigits.join('') === '777', start));

  await page.keyboard.press('Escape');
  await page.waitForSelector('#pachi', { state: 'hidden', timeout: 2000 });
  t.check('Esc stands up and closes the window', !(await page.evaluate(() => entities.get(myId).seat)));
  t.check('no page errors in the casino', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t)]);
}
