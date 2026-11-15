// 북쪽 극장, 월드맵
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageHint, pageSelf, serverWithAccounts, SHOTS, stubYouTube, wait } from '../lib.mjs';

const THEATER = 4;
const shot = (name) => path.join(SHOTS, name);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    door: [0, 720, 256], front: [THEATER, 500, 240], viewer: [THEATER, 410, 300], outside: [0, 820, 620], vip: [THEATER, 950, 30],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(80);
    return bot;
  };
  const door = await enter('door');
  const map = door.map;
  const theater = map.buildings.find((b) => b.k === 'theater');
  t.check('theater stands in the north', theater?.x === 720 && theater.y < 300 && theater.room === THEATER, JSON.stringify(theater));
  const seats = map.seats.filter((s) => s.z === THEATER);
  t.check('theater has rows of seats', seats.length === 60 && seats.every((s) => s.fy === -1), seats.length);
  t.check('theater has a big screen and a snack bar', map.furn.some((f) => f.z === THEATER && f.k === 'cinema_screen') && map.furn.some((f) => f.z === THEATER && f.k === 'snack_bar'));

  door.send('use');
  await door.until(() => door.zone === THEATER, 1000);
  t.check('the theater door works', door.zone === THEATER);
  await wait(120);
  door.send('use');
  await wait(100);
  await door.walkTo(map.zones[THEATER].door[0], map.zones[THEATER].door[1] - 30, 8);
  door.send('use');
  await door.until(() => door.zone === 0, 1000);
  t.check('the theater door leads back', door.zone === 0);

  // 극장의 스크린은 TV 처럼 함께 본다
  const front = await enter('front');
  const viewer = await enter('viewer');
  const outside = await enter('outside');
  front.send('tv play dQw4w9WgXcQ');
  await viewer.until(() => viewer.lastEvent('tv')?.v === 'dQw4w9WgXcQ', 1000);
  t.check('everyone in the theater gets the video', viewer.lastEvent('tv')?.v === 'dQw4w9WgXcQ');
  await wait(60);
  t.check('it stays in the theater', !outside.lastEvent('tv'));
  viewer.send('use');
  await wait(100);
  t.check('seats work', viewer.me.s > 0 && map.seats[viewer.me.s - 1].z === THEATER, JSON.stringify(viewer.me));

  // ---- 특별관: 극장 뒷벽의 문으로 들어가는 큰 스크린 방
  const vipPlace = map.buildings.find((b) => b.in === THEATER);
  const VIP = vipPlace?.room;
  t.check('a screening room opens off the theater', VIP === 7 && vipPlace.k === 'theater' && vipPlace.name === '특별관' && map.furn.some((f) => f.z === THEATER && f.k === 'cinema_door'), JSON.stringify(vipPlace));
  const vipSeats = map.seats.filter((s) => s.z === VIP);
  t.check('it has one three seat sofa and a much bigger screen', vipSeats.length === 3 && map.furn.some((f) => f.z === VIP && f.k === 'cinema_screen_big') && map.furn.some((f) => f.z === VIP && f.k === 'cinema_sofa'), vipSeats.length);
  const vip = await enter('vip');
  vip.send('use');
  await vip.until(() => vip.zone === VIP, 1000);
  t.check('its door works from inside the theater', vip.zone === VIP);
  await wait(120);
  vip.send('tv play 9bZkp7q19f0');
  await vip.until(() => vip.lastEvent('tv')?.v === '9bZkp7q19f0', 1000);
  await wait(60);
  t.check('it shows its own film, apart from the main hall', vip.lastEvent('tv')?.v === '9bZkp7q19f0' && front.lastEvent('tv')?.v === 'dQw4w9WgXcQ');
  await vip.walkTo(map.zones[VIP].door[0], 520, 8);
  vip.send('use');
  await wait(100);
  t.check('you can sit on the sofa', vip.me.s > 0 && map.seats[vip.me.s - 1].z === VIP, JSON.stringify(vip.me));
  vip.send('use');
  await wait(100);
  await vip.walkTo(map.zones[VIP].door[0], map.zones[VIP].door[1] - 30, 8);
  vip.send('use');
  await vip.until(() => vip.zone === THEATER, 1000);
  await vip.until(() => Math.abs(vip.me.x - 955) < 4, 1000);
  t.check('leaving puts you back in the theater by that door', vip.zone === THEATER && Math.abs(vip.me.x - 955) < 4 && vip.me.y < 60, JSON.stringify(vip.me));
  for (const bot of [door, front, viewer, outside, vip]) bot.close();
  await wait(100);
  await server.stop();
}

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    front: [THEATER, 500, 240], seat: [THEATER, 410, 470], outside: [0, 720, 300], bydoor: [THEATER, 940, 30], sofa: [7, 680, 500],
  });
  const browser = await launchBrowser();
  const open = async (name, options = {}) => {
    const page = await openPage(browser, server, options);
    await stubYouTube(page);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    return page;
  };
  const day = (page) => page.evaluate(() => { clockSync = { phase: 0, at: performance.now(), len: clockSync.len }; });
  const front = await open('front');
  const seat = await open('seat');
  await wait(250);

  t.check('HUD names the theater', (await front.textContent('#hud')).includes('극장') && !(await front.textContent('#hud')).includes('의 집'), await front.textContent('#hud'));
  t.check('no lamp switch in the theater', await front.isVisible('#light-room') && !(await front.isVisible('#light-lamp')));
  t.check('the stage front offers the screen', (await front.evaluate(() => actionHint({ ...entities.get(myId), x: me.x, y: me.y }))).includes('T: 스크린 조작'));

  await front.keyboard.press('KeyT');
  t.check('T opens the controls', await front.isVisible('#tv') && await front.isVisible('.tv-tile.youtube'));
  await front.fill('#tv-url', 'dQw4w9WgXcQ');
  await front.press('#tv-url', 'Enter');
  await seat.waitForFunction(() => tvState && tvPlayerReady, null, { timeout: 3000 });
  t.check('the theater does not pop up a window', !(await seat.isVisible('#tv')));
  await front.waitForFunction(() => tvState && tvPlayerReady, null, { timeout: 3000 });
  t.check('controls stay, the small preview hides', await front.isVisible('#tv-controls') && !(await front.isVisible('#tv-screen')));
  await front.click('#tv-close');
  await wait(100);

  const box = (page) => page.evaluate(() => {
    const r = document.getElementById('tv-video').getBoundingClientRect();
    const s = tvScreenRect(tvFurniture());
    const [camX, camY] = camera(innerWidth, innerHeight);
    return { ok: Math.abs(r.left - (s.x - camX)) < 1 && Math.abs(r.top - (s.y - camY)) < 1, w: r.width, h: r.height, inner: document.getElementById('tv-video').offsetWidth };
  });
  const big = await box(seat);
  t.check('the video fills the big screen', big.ok && big.w === 560 && big.h === 315 && big.inner === 560, JSON.stringify(big));

  // 앉으면 스크린이 온전히 보인다
  await seat.keyboard.press('KeyE');
  await seat.waitForFunction(() => entities.get(myId).seat > 0, null, { timeout: 2000 });
  await day(seat);
  await wait(250);
  const view = await seat.evaluate(() => {
    const [, camY] = camera(innerWidth, innerHeight);
    const r = tvScreenRect(tvFurniture());
    return { top: r.y - camY, bottom: r.y + r.h - camY, inner: innerHeight, me: me.y - camY };
  });
  t.check('a seated viewer sees the whole screen', view.top >= 0 && view.bottom <= view.inner && view.me > view.bottom, JSON.stringify(view));
  await seat.screenshot({ path: shot('theater_inside.png') });

  // ---- 특별관
  const bydoor = await open('bydoor');
  await wait(200);
  t.check('the door offers the screening room', String((await pageHint(bydoor))?.label ?? await pageHint(bydoor)).includes('특별관 들어가기'), JSON.stringify(await pageHint(bydoor)));
  await bydoor.screenshot({ path: shot('theater_vip_door.png') });
  const sofa = await open('sofa', { viewport: { width: 1440, height: 820 } });
  await sofa.evaluate(() => ws.send('use sit'));
  await sofa.evaluate(() => sendTv('play dQw4w9WgXcQ'));
  await sofa.waitForFunction(() => cinemaAvailable(), null, { timeout: 3000 });
  await wait(300);
  const vipScreen = await sofa.$eval('#tv-video', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  t.check('the film fills the bigger screen', vipScreen[0] === 980 && vipScreen[1] === 551, JSON.stringify(vipScreen));
  t.check('the map shows me at the theater', await sofa.evaluate(() => { const b = terrain.buildings[terrain.zones[zone].b]; return b.x === 720 && zoneLabel(zone) === '특별관'; }));
  await sofa.screenshot({ path: shot('theater_vip.png') });
  t.check('no script errors in the screening room', bydoor.problems.length === 0 && sofa.problems.length === 0, [...bydoor.problems, ...sofa.problems].join(' | '));

  // ---- 바깥과 월드맵
  const outside = await open('outside');
  await day(outside);
  await wait(200);
  await outside.screenshot({ path: shot('theater_outside.png') });
  t.check('the world map starts folded', await outside.isVisible('#map-win') && !(await outside.isVisible('#minimap')));
  await outside.click('#map-toggle');
  t.check('the world map unfolds', await outside.isVisible('#minimap') && (await outside.getAttribute('#map-toggle', 'aria-expanded')) === 'true');
  const mapBox = await outside.$eval('#map-win', (el) => { const r = el.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom, w: r.width }; });
  t.check('the map sits in the lower right', mapBox.right === 12 && mapBox.bottom === 12 && mapBox.w >= 180, JSON.stringify(mapBox));
  await seat.evaluate(() => setMapOpen(true));
  const marker = (page) => page.evaluate(() => {
    const scale = minimap.width / world.w;
    const place = zone === 0 ? me : terrain.buildings[terrain.zones[zone].b];
    const d = minimapCtx.getImageData(place.x * scale, place.y * scale, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  await wait(60);
  t.check('the map marks where I am', (await marker(outside)).join() === '255,224,102', (await marker(outside)).join());
  t.check('the map marks me inside a building too', (await marker(seat)).join() === '255,224,102', (await marker(seat)).join());

  const phone = await open('outside', { viewport: { width: 390, height: 720 } });
  await wait(150);
  t.check('the map hides on phones', !(await phone.isVisible('#map-win')));

  const problems = [...front.problems, ...seat.problems, ...outside.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
