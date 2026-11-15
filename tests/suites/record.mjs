// 집에 놓는 레코드 플레이어(방마다 따로 도는 곡 목록, 고르기, 정지), 소지품의 가구 탭, 오른쪽 위 상점, 레트로 접속 화면
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, startServer, stubYouTube, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, JAZZ = 6;
const A = 'aaaaaaaaaaa', B = 'bbbbbbbbbbb', C = 'ccccccccccc';
const RECORD = 33, SMALL_PLANT = 23;
const shot = (name) => path.join(SHOTS, name);
const jazz = (bot) => bot.lastEvent('jazz');
const pause = () => wait(260);   // 행동 제한에 걸리지 않게

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    owner: [MOLJA, 300, 410, { f33: 2 }], guest: [MOLJA, 480, 410], rara: [RARA, 300, 200], bar: [JAZZ, 450, 500],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const owner = await enter('owner'), guest = await enter('guest'), rara = await enter('rara'), bar = await enter('bar');
  await wait(150);
  t.check('a house without a record player has no record', !jazz(owner));
  guest.send(`jazz add ${A} Nope`);
  await wait(300);
  t.check('songs need a record player', !jazz(guest));

  owner.send(`decor place ${RECORD} 440 300`);
  await guest.until(() => jazz(guest), 1500);
  t.check('placing a record player starts the room record', jazz(guest)?.list.length === 0 && jazz(guest).stop === false, JSON.stringify(jazz(guest)));
  await pause();
  guest.send(`jazz add ${A} First`);
  await owner.until(() => jazz(owner)?.list?.length === 1, 1500);
  await pause();
  owner.send(`jazz add ${B} Second`);
  await guest.until(() => jazz(guest).list.length === 2, 1500);
  t.check('anyone in the house can add songs', jazz(guest).list.map((s) => s[1]).join() === 'First,Second', JSON.stringify(jazz(guest)));
  t.check('other rooms keep their own record', !rara.lastEvent('jazz') && !(jazz(bar)?.list ?? []).some(([id]) => id === A));

  await pause();
  owner.send(`jazz play ${B}`);
  await guest.until(() => jazz(guest).i === 1, 1500);
  t.check('picking a song plays it', jazz(guest).i === 1);
  await pause();
  guest.send('jazz stop');
  await owner.until(() => jazz(owner).stop === true, 1500);
  t.check('the record can be stopped', jazz(owner).stop === true);
  const stoppedGen = jazz(owner).gen;
  owner.send(`jazz next ${stoppedGen}`);   // 멈춘 동안 곡이 끝났다는 알림이 와도 넘어가지 않는다
  await wait(300);
  t.check('a stopped record does not advance', jazz(owner).gen === stoppedGen && jazz(owner).i === 1);
  guest.send('jazz resume');
  await owner.until(() => jazz(owner).stop === false, 1500);
  t.check('and plays again from the same song', jazz(owner).i === 1 && jazz(owner).gen > stoppedGen);

  await pause();
  owner.send(`decor take ${owner.lastEvent('decor').p.find((d) => d[1] === RECORD)[0]}`);
  await guest.until(() => jazz(guest)?.off, 1500);
  t.check('taking the record player turns the music off', jazz(guest)?.off === true);
  await pause();
  guest.send(`jazz add ${C} Third`);
  await wait(300);
  t.check('songs cannot be added without it', jazz(guest).off === true);
  await pause();
  owner.send(`decor place ${RECORD} 440 300`);
  await guest.until(() => jazz(guest)?.list?.length === 2, 1500);
  t.check('putting it back brings the same list', jazz(guest)?.list.map((s) => s[0]).join() === `${A},${B}`);

  for (const bot of [owner, guest, rara, bar]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'owner', { id: ids.owner });
  await back.until(() => jazz(back), 1500);
  t.check('the house list survives a restart', jazz(back)?.list.length === 2, JSON.stringify(jazz(back)));
  back.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ home: [MOLJA, 300, 380, { f33: 1, f21: 1, gold: 100 }] });
  const chrome = await launchBrowser();
  const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
  await stubYouTube(page);
  t.check('the login screen uses the pixel font', await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('12px Galmuri11') && getComputedStyle(document.getElementById('auth-submit')).fontFamily.includes('Galmuri11');
  }));
  await page.screenshot({ path: shot('login_retro.png') });
  await loginPage(page, ids.home);
  await page.screenshot({ path: shot('character_retro.png') });
  await enterPage(page, { name: 'home' });
  await page.waitForFunction(() => zone === 1, null, { timeout: 3000 });
  await wait(200);

  // 소지품: 아이템과 가구가 탭으로 나뉜다
  await page.keyboard.press('KeyI');
  t.check('the bag opens on items', await page.isVisible('#bag-items') && !(await page.isVisible('#decor-list')));
  t.check('the furniture tab shows how many I own', (await page.textContent('#bag-furn-count')) === '2');
  await page.click('#bag-tab-furn');
  t.check('furniture lives in its own tab', (await page.$$('#decor-list .furn-cell')).length === 2 && !(await page.isVisible('#bag-items')));
  await page.screenshot({ path: shot('bag_furniture.png') });

  // 가구 탭에서 레코드 플레이어를 놓으면 오른쪽에 레코드판이 뜬다
  await page.click(`#decor-list button[data-kind="${RECORD}"]`);
  const spot = await page.evaluate(() => {
    const [cx, cy] = camera(innerWidth, innerHeight);
    return [440 - cx, 300 - cy];
  });
  await page.mouse.click(...spot);
  await page.waitForFunction(() => !!jazzState, null, { timeout: 2000 });
  t.check('a placed record player shows the record panel', await page.isVisible('#jazz') && await page.isVisible('#jazz-controls'));
  const bagBox = await page.locator('#bag').boundingBox(), jazzBox = await page.locator('#jazz').boundingBox();
  t.check('the record panel steps aside for the bag', jazzBox.x + jazzBox.width <= bagBox.x, JSON.stringify([jazzBox, bagBox]));
  for (const [id, title] of [[A, 'Morning'], [B, 'Evening']]) {
    await page.evaluate(([video, name]) => sendJazz(`add ${video} ${name}`), [id, title]);
    await wait(300);
  }
  await page.click('#jazz-list-toggle');
  await page.waitForFunction(() => document.querySelectorAll('#jazz-list .jazz-track').length === 2, null, { timeout: 2000 });
  t.check('the list button shows the songs', await page.isVisible('#jazz-list'));
  await page.click('#jazz-list .jazz-track:nth-child(2) .jazz-title');
  await page.waitForFunction(() => jazzState.i === 1 && Sound.current() === null, null, { timeout: 3000 });
  t.check('clicking a song plays it', (await page.textContent('#jazz-now')).includes('Evening'));
  t.check('the record replaces the house music', (await page.evaluate(() => Sound.current())) === null);
  await pause();
  await page.click('#jazz-next');
  await page.waitForFunction(() => jazzState.i === 0, null, { timeout: 2000 });
  t.check('next goes round the list', (await page.textContent('#jazz-now')).includes('Morning'));
  const jazzPlayerNow = () => page.evaluate(() => { const p = window.__yt.players.filter((q) => !q.destroyed).at(-1); return p && { volume: p.volume, muted: p.muted }; });
  t.check('the record has a mute button next to the volume', await page.isVisible('#jazz-mute') && (await jazzPlayerNow())?.muted === false);
  await page.click('#jazz-mute');
  t.check('mute silences only my record player', (await jazzPlayerNow()).muted && await page.evaluate(() => !jazzState.stop && localStorage.getItem('mmo.jazzMuted') === '1'));
  await page.click('#jazz-mute');
  t.check('unmuting brings the sound back', !(await jazzPlayerNow()).muted && (await jazzPlayerNow()).volume === 60 && await page.evaluate(() => localStorage.getItem('mmo.jazzMuted') === '0'));
  await pause();
  await page.click('#jazz-toggle');
  await page.waitForFunction(() => jazzState.stop && Sound.current() === 'house', null, { timeout: 3000 });
  t.check('stop brings back the house music', (await page.evaluate(() => Sound.current())) === 'house' && (await page.textContent('#jazz-toggle')) === '재생');
  await page.screenshot({ path: shot('house_record.png') });

  // 오른쪽 위 상점: 어디서나 열리고 골드로 산다
  t.check('the shop button sits in the top-right', await page.isVisible('#shop-open'));
  await page.click('#shop-open');
  await page.waitForSelector('#furn-shop:not([hidden])', { timeout: 2000 });
  await page.evaluate((i) => showPageOf(furnList, furnList.children[i]), SMALL_PLANT);   // 상점은 12개씩 쪽을 나눈다
  const label = await page.textContent(`#furn-list .furn-cell:nth-child(${SMALL_PLANT + 1}) button`);
  t.check('the shop shows the price or free', label.endsWith(' G') || label === '무료로 받기', label);
  await page.click(`#furn-list .furn-cell:nth-child(${SMALL_PLANT + 1}) button`);
  await page.waitForFunction((kind) => myFurn[kind] === 1 && myGold === 100 - terrain.catalog[kind].price, SMALL_PLANT, { timeout: 2000 });
  t.check('the top-right shop sells right here', true);
  await page.screenshot({ path: shot('furniture_shop.png') });
  await page.click('#furn-close');
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t)]);
}
