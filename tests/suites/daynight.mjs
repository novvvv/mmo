// 30분 주기 낮밤과 가로등
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageWalkTo, SHOTS, startServer, uniqueId, wait } from '../lib.mjs';

export default async function run(t) {
  // ---- 기본 주기
  const normal = await startServer();
  const bot = await Bot.enter(normal, '시계');
  await bot.until(() => bot.time, 1000);
  t.check('day and night last 30 minutes each', bot.time?.len === 1800, JSON.stringify(bot.time));
  t.check('clock phase is in range', bot.time.p >= 0 && bot.time.p < 3600, bot.time.p);
  const expected = (Date.now() / 1000) % 3600;
  t.check('clock follows wall time', Math.abs(bot.time.p - expected) < 2 || Math.abs(bot.time.p - expected) > 3598, `${bot.time.p} vs ${expected}`);
  bot.close();
  await normal.stop();

  // ---- 서버를 다시 켜도 주기가 이어진다 (실제 시각 기준)
  const s1 = await startServer();
  const b1 = await Bot.enter(s1, '시계1');
  await b1.until(() => b1.time, 1000);
  const phase1 = b1.time.p, at1 = b1.time.at;
  b1.close();
  await s1.stop();
  const s2 = await startServer();
  const b2 = await Bot.enter(s2, '시계2');
  await b2.until(() => b2.time, 1000);
  const advanced = b2.time.p - phase1, real = (b2.time.at - at1) / 1000;
  t.check('cycle continues across restarts', Math.abs(advanced - real) < 1, `${advanced} vs ${real}`);
  b2.close();
  await s2.stop();

  // ---- 짧은 주기로 실제 화면 확인 (낮 8초, 밤 8초)
  const server = await startServer({ env: { MMO_HALF_CYCLE_SEC: '8' } });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, uniqueId('night'), { name: '밤산책' });

  const lamp = await page.evaluate(() => terrain.lamps.find((l) => l.x === 548));
  await pageWalkTo(page, (await page.evaluate(() => me.x)), 670, 14);
  await pageWalkTo(page, lamp.x + 90, lamp.y - 30, 12);

  const amount = () => page.evaluate(() => nightAmount(performance.now()));
  const brightness = () => page.evaluate((l) => {
    const dpr = devicePixelRatio;
    const [camX, camY] = camera(innerWidth, innerHeight);
    const read = (wx, wy) => {
      const d = ctx.getImageData((wx - camX) * dpr, (wy - camY) * dpr, 6, 6).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4);
    };
    return { near: read(l.x - 40, l.y - 26), far: read(l.x - 330, l.y - 300) };  // far 는 어떤 조명도 닿지 않는 풀밭
  }, lamp);

  await page.waitForFunction(() => nightAmount(performance.now()) === 0, null, { timeout: 18000, polling: 30 });
  const day = await brightness();
  const dayHud = await page.$eval('#hud', (e) => e.textContent);
  t.check('HUD shows daytime', dayHud.includes('낮'), dayHud);
  t.check('lamps are off by day', await page.evaluate(() => nightAmount(performance.now()) <= 0.3));
  await page.screenshot({ path: path.join(SHOTS, 'day.png') });

  await page.waitForFunction(() => nightAmount(performance.now()) === 1, null, { timeout: 18000, polling: 30 });
  await wait(100);
  const night = await brightness();
  const nightHud = await page.$eval('#hud', (e) => e.textContent);
  t.check('HUD shows nighttime', nightHud.includes('밤'), nightHud);
  t.check('world gets dark at night', night.far < day.far * 0.65, `day ${day.far} night ${night.far}`);
  t.check('street lamp lights its surroundings', night.near > night.far * 1.5, `near ${night.near} far ${night.far}`);
  t.check('lamps turn on at night', await page.evaluate(() => nightAmount(performance.now()) > 0.3));
  await page.screenshot({ path: path.join(SHOTS, 'night.png') });

  // 낮 ↔ 밤이 번갈아 온다
  const samples = [];
  for (let i = 0; i < 34; i++) {
    samples.push(await amount());
    await wait(500);
  }
  const flips = samples.slice(1).filter((v, i) => (v > 0.5) !== (samples[i] > 0.5)).length;
  t.check('day and night keep alternating', flips >= 1 && samples.some((v) => v === 0) && samples.some((v) => v === 1), `flips=${flips}`);

  t.check('no page errors', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}
