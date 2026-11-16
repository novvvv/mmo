// 극장 옆 재즈바: 술과 웰컴 드링크, 끝없이 도는 레코드판
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageHint, pageSelf, pageWalkTo, serverWithAccounts, SHOTS, startServer, stubYouTube, wait } from '../lib.mjs';

const JAZZ = 6, WELCOME = 9, BEER = 10;
const A = 'AAAAAAAAAAA', B = 'BBBBBBBBBBB', C = 'CCCCCCCCCCC';
const shot = (name) => path.join(SHOTS, name);
const inv = (bot) => bot.lastEvent('inv');
const jazz = (bot) => bot.lastEvent('jazz');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));

async function until(bot, check) {
  await bot.until(check, 1500);
}

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    door: [0, 1080, 256, { gold: 25 }], bar: [JAZZ, 110, 170, { gold: 100 }], far: [JAZZ, 700, 500, { gold: 100 }], out: [0, 820, 620],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(100);
    return bot;
  };
  const door = await enter('door');
  const map = door.map;
  const theater = map.buildings.find((b) => b.k === 'theater');
  const bar = map.buildings.find((b) => b.k === 'jazz');
  t.check('the bar stands beside the theater', bar?.room === JAZZ && Math.abs(bar.y - theater.y) < 60 && bar.x - bar.halfW >= theater.x + theater.halfW, JSON.stringify(bar));
  t.check('the bar has a counter, a bartender and a record player', ['bar_counter', 'bartender', 'record_player'].every((k) => map.furn.some((f) => f.z === JAZZ && f.k === k)));
  t.check('the bar has stools and lounge seats', map.seats.filter((s) => s.z === JAZZ).length === 13);

  door.send('use');
  await until(door, () => door.zone === JAZZ);
  await until(door, () => jazz(door));
  t.check('the door leads in and the bar greets', door.zone === JAZZ && says(door, '웰컴 드링크') && inv(door).w === true, JSON.stringify(inv(door)));
  t.check('the record player starts empty', jazz(door).list.length === 0);

  const seller = await enter('bar');
  const stranger = await enter('far');
  const outside = await enter('out');

  // 바텐더에게서만 살 수 있고, 웰컴 드링크는 입장마다 한 잔이다.
  stranger.send(`buy ${BEER}`);
  await until(stranger, () => says(stranger, '바텐더 앞에서만'));
  t.check('drinks are sold only at the bartender', inv(stranger).s[5] === 0);
  seller.send(`buy ${WELCOME}`);
  await until(seller, () => inv(seller).s[4] === 1);
  t.check('the welcome drink is free', inv(seller).g === 100 && inv(seller).w === false, JSON.stringify(inv(seller)));
  await wait(260);
  seller.send(`buy ${WELCOME}`);
  await until(seller, () => says(seller, '한 잔만'));
  t.check('only one welcome drink per visit', inv(seller).s[4] === 1 && inv(seller).g === 100);
  await wait(260);
  seller.send(`buy ${BEER}`);
  await until(seller, () => inv(seller).s[5] === 1);
  t.check('beer costs gold', inv(seller).g === 80, JSON.stringify(inv(seller)));
  await wait(260);
  seller.send(`buy 5`);
  await until(seller, () => says(seller, '매점 앞에서만'));
  t.check('the bar does not sell popcorn', inv(seller).s[0] === 0);

  // 레코드판
  await wait(260);
  seller.send(`jazz add ${A} First "song"`);
  await until(door, () => jazz(door).list.length === 1);
  t.check('a track reaches everyone in the bar', jazz(door).list[0][0] === A && jazz(door).list[0][1] === 'First "song"', JSON.stringify(jazz(door)));
  t.check('people outside hear nothing', !jazz(outside));
  const first = jazz(door).gen;
  await wait(260);
  seller.send(`jazz add ${B}`);
  await until(door, () => jazz(door).list.length === 2);
  t.check('adding does not interrupt the song', jazz(door).gen === first && jazz(door).i === 0);
  await wait(260);
  seller.send('jazz add not-an-id');
  seller.send(`jazz add ${A}`);
  await wait(300);
  t.check('bad links and duplicates are refused', jazz(door).list.length === 2 && says(seller, '이미 등록'));

  door.send(`jazz next ${first}`);
  await wait(200);
  t.check('a song cannot be skipped the moment it starts', jazz(door).gen === first);
  await wait(2000);
  door.send(`jazz next ${first}`);
  seller.send(`jazz next ${first}`);
  await until(door, () => jazz(door).gen > first);
  await wait(200);
  t.check('two listeners finishing together advance once', jazz(door).i === 1 && jazz(door).gen === first + 1, JSON.stringify(jazz(door)));
  await wait(2100);
  door.send(`jazz next ${first + 1}`);
  await until(door, () => jazz(door).gen === first + 2);
  t.check('the list loops back to the first song', jazz(door).i === 0);
  outside.send(`jazz add ${C}`);
  await wait(200);
  t.check('only people in the bar can change it', jazz(door).list.length === 2);

  // 나갔다 다시 들어오면 한 잔을 더 받는다.
  await door.walkTo(map.zones[JAZZ].door[0], map.zones[JAZZ].door[1] - 30, 8);
  door.send('use');
  await until(door, () => door.zone === 0);
  await wait(200);
  door.send('use');
  await until(door, () => door.zone === JAZZ);
  await until(door, () => inv(door).w === true);
  t.check('coming back brings a new welcome drink', inv(door).w === true);

  await wait(300);
  seller.send(`jazz remove ${A}`);
  await until(door, () => jazz(door).list.length === 1);
  t.check('removing the current song plays the next', jazz(door).list[0][0] === B && jazz(door).i === 0);
  await wait(300);  // 파일에 쓸 시간
  for (const bot of [door, seller, stranger, outside]) bot.close();
  await wait(200);
  await server.stop();

  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'bar', { id: ids.bar });
  await until(back, () => jazz(back));
  t.check('registered songs survive a restart', jazz(back).list.length === 1 && jazz(back).list[0][0] === B, JSON.stringify(jazz(back)));
  back.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ guest: [JAZZ, 110, 170, { gold: 100 }] });
  const chrome = await launchBrowser();
  const page = await openPage(chrome, server);
  await stubYouTube(page);
  await page.route('https://www.youtube.com/oembed*', (route) => {
    const blocked = route.request().url().includes('blockedvide');
    route.fulfill({ status: blocked ? 401 : 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: blocked ? '{}' : JSON.stringify({ title: 'Take Five' }) });
  });
  await loginPage(page, ids.guest);
  await enterPage(page, { name: 'guest' });
  await page.waitForFunction(() => !!jazzState && zone === 6, null, { timeout: 3000 });
  t.check('the record card shows inside the bar', await page.isVisible('#jazz'));

  await wait(200);
  t.check('hint offers the bartender', (await pageHint(page)).includes('E: 바텐더에게 주문'), await pageHint(page));
  await page.keyboard.press('KeyE');
  const rows = await page.$$eval('.shop-row:not([hidden])', (els) => els.map((e) => e.querySelector('div').firstChild.textContent));
  t.check('the menu lists only drinks', rows.join() === '웰컴 드링크,맥주,칵테일,위스키', rows.join());
  t.check('the panel is titled for the bar', (await page.textContent('#shop-title')) === '재즈바');
  await page.screenshot({ path: shot('jazz_menu.png') });
  await page.click('.shop-row:nth-child(5) button');
  await page.waitForFunction(() => myShop[4] === 1 && !myWelcome, null, { timeout: 2000 });
  t.check('the welcome button marks it taken', await page.$eval('.shop-row:nth-child(5) button', (b) => b.disabled && b.textContent === '받음'));
  await page.keyboard.press('Escape');

  await pageWalkTo(page, 320, 205, 14);
  await wait(150);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!entities.get(myId).seat, null, { timeout: 2000 });
  await wait(150);
  await page.screenshot({ path: shot('jazz_stool.png') });
  t.check('a stool at the bar can be sat on', (await pageSelf(page)).seat > 0, JSON.stringify(await pageSelf(page)));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !entities.get(myId).seat, null, { timeout: 2000 });

  await pageWalkTo(page, 840, 285, 14);
  await wait(150);
  t.check('hint offers the record player', (await pageHint(page)).includes('E: 레코드판'), await pageHint(page));
  await page.keyboard.press('KeyE');
  t.check('E opens the song list', await page.isVisible('#jazz-form'));
  await page.fill('#jazz-url', 'https://youtu.be/blockedvide');
  await page.press('#jazz-url', 'Enter');
  await page.waitForFunction(() => document.getElementById('jazz-note').textContent.includes('막힌'), null, { timeout: 2000 });
  t.check('blocked videos are not registered', (await page.evaluate(() => jazzState.list.length)) === 0);
  await wait(260);
  await page.fill('#jazz-url', `https://www.youtube.com/watch?v=${A}`);
  await page.press('#jazz-url', 'Enter');
  await page.waitForFunction(() => window.__yt?.players.length === 1 && jazzPlayerReady, null, { timeout: 3000 });
  t.check('the song plays with its title', (await page.textContent('#jazz-now')).includes('Take Five') && await page.evaluate((id) => __yt.players[0].video === id, A));
  await page.screenshot({ path: shot('jazz_room.png') });

  // 곡이 끝나면 서버가 같은 곡을 다시 건다.
  const before = await page.evaluate(() => jazzState.gen);
  await wait(2100);
  await page.evaluate(() => { const p = __yt.players[0]; p.state = 0; p.options.events.onStateChange({ data: 0 }); });
  await page.waitForFunction((gen) => jazzState.gen > gen, before, { timeout: 2000 });
  await wait(50);
  t.check('a lone song repeats', await page.evaluate(() => __yt.players[0].calls.includes('load') && __yt.players[0].state === 1));

  // 접기: 제목 줄만 남고 음악은 그대로. 다시 펴면 돌아온다
  const fullHeight = await page.$eval('#jazz', (el) => el.getBoundingClientRect().height);
  await page.click('#jazz-mini');
  const miniHeight = await page.$eval('#jazz', (el) => el.getBoundingClientRect().height);
  t.check('the record card folds down to its title bar', miniHeight < 40 && fullHeight > 100 && await page.isVisible('#jazz-head') && await page.evaluate(() => !__yt.players[0].destroyed && __yt.players[0].state === 1), `${fullHeight} → ${miniHeight}`);
  await page.screenshot({ path: shot('jazz_mini.png') });
  await page.click('#jazz-mini');
  t.check('and unfolds again', (await page.$eval('#jazz', (el) => el.getBoundingClientRect().height)) > 100);

  await page.keyboard.press('KeyE');
  t.check('E closes the list but the music goes on', !(await page.isVisible('#jazz-form')) && await page.isVisible('#jazz-video'));
  await pageWalkTo(page, 450, 560, 14);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => zone === 0, null, { timeout: 2000 });
  t.check('leaving the bar stops the music', !(await page.isVisible('#jazz')) && await page.evaluate(() => __yt.players[0].destroyed));
  await wait(400);
  await page.screenshot({ path: shot('jazz_outside.png') });
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await browser(t);
}
