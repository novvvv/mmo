// 크리스마스 장식: 야외에만 적용되고 집 안은 그대로
import path from 'node:path';
import { enterGame, launchBrowser, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const MOLJA = 1, THEATER = 4, CASINO = 5;
const shot = (name) => path.join(SHOTS, name);

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({
    plaza: [0, 850, 530], river: [0, 720, 700], homes: [0, 900, 1400], north: [0, 600, 300], room: [MOLJA, 250, 300], cinema: [THEATER, 500, 240], casino: [CASINO, 480, 560],
  });
  const browser = await launchBrowser();
  const open = async (name) => {
    const page = await enterGame(browser, server, ids[name], { name });
    await wait(200);
    return page;
  };
  const setTime = (page, night) => page.evaluate((isNight) => { clockSync = { phase: isNight ? clockSync.len * 1.5 : 0, at: performance.now(), len: clockSync.len }; }, night);
  // 한 프레임 동안 함수가 불리는지 본다.
  const calledInFrame = (page, name) => page.evaluate((fn) => new Promise((resolve) => {
    const original = window[fn];
    let called = false;
    window[fn] = (...args) => { called = true; return original(...args); };
    requestAnimationFrame(() => requestAnimationFrame(() => { window[fn] = original; resolve(called); }));
  }), name);
  const pixel = (page, x, y) => page.evaluate(([wx, wy]) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const [camX, camY] = camera(innerWidth, innerHeight);
    const list = [];
    for (let dy = -8; dy <= 8; dy += 4) for (let dx = -8; dx <= 8; dx += 4) list.push(ctx.getImageData(wx - camX + dx, wy - camY + dy, 1, 1).data);
    list.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const mid = list[Math.floor(list.length / 2)];
    resolve([mid[0], mid[1], mid[2]]);
  }))), [x, y]);

  const plaza = await open('plaza');
  await setTime(plaza, false);
  await wait(120);
  await plaza.screenshot({ path: shot('xmas_plaza.png') });

  // ---- 장식의 위치
  const invalid = await plaza.evaluate(() => XMAS_DECOR.filter((d) => {
    const z = d.z;
    const solid = terrain.solidsByZone[z].some((s) => d.x > s[1] - 12 && d.x < s[3] + 12 && d.y > s[2] - 12 && d.y < s[4] + 12);
    const water = z === 0 && d.y > bankAt(terrain.top, d.x) - 40 && d.y < bankAt(terrain.bot, d.x) + 40;
    const door = terrain.buildings.some((b) => z === 0 && b.room >= 0 && Math.hypot(b.door[0] - d.x, b.door[1] - d.y) < terrain.doorReach + 20);
    return solid || water || door;
  }));
  t.check('decorations stay clear of buildings, water and doors', invalid.length === 0, JSON.stringify(invalid));
  t.check('every building has roof decorations', await plaza.evaluate(() => terrain.buildings.every((b) => typeof XMAS_ROOFS[b.k === 'cafe' ? 'cafe' : b.style] === 'function')));

  // ---- 야외
  t.check('it snows in the village', await calledInFrame(plaza, 'drawSnowfall'));
  const ground = await pixel(plaza, 820, 600);
  t.check('the ground is covered with snow', Math.min(...ground) > 200, ground.join());
  t.check('the village has decorations', await plaza.evaluate(() => XMAS_DECOR.some((d) => d.k === 'tree' && d.z === 0) && XMAS_DECOR.filter((d) => d.k === 'snowman').length >= 5));
  const treeDrawn = await calledInFrame(plaza, 'drawChristmasTree');
  t.check('the big tree is drawn', treeDrawn);
  await plaza.evaluate(() => setMapOpen(true));   // 지도는 처음에 접혀 있다
  await wait(80);
  const mapColor = await plaza.evaluate(() => Array.from(minimapCtx.getImageData(20, 20, 1, 1).data).slice(0, 3));
  t.check('the world map is snowy too', Math.min(...mapColor) > 200, mapColor.join());

  await setTime(plaza, true);
  await wait(200);
  await plaza.screenshot({ path: shot('xmas_plaza_night.png') });
  await setTime(plaza, false);

  for (const [name, file] of [['river', 'xmas_river.png'], ['homes', 'xmas_homes.png'], ['north', 'xmas_north.png']]) {
    const page = await open(name);
    await setTime(page, false);
    await wait(120);
    await page.screenshot({ path: shot(file) });
    await page.close();
  }

  // ---- 카지노, 집과 극장 안은 그대로
  const casino = await open('casino');
  t.check('no snow inside the casino', !(await calledInFrame(casino, 'drawSnowfall')));

  const room = await open('room');
  t.check('no snow inside a house', !(await calledInFrame(room, 'drawSnowfall')));
  t.check('no decorations inside a house', !(await calledInFrame(room, 'drawDecor')));
  const wood = await pixel(room, 60, 420);
  t.check('house floors keep their color', wood[0] < 180, wood.join());
  const cinema = await open('cinema');
  t.check('no snow inside the theater', !(await calledInFrame(cinema, 'drawSnowfall')));

  const problems = [...plaza.problems, ...casino.problems, ...room.problems, ...cinema.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}
