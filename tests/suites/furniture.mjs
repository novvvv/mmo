// 가구 상점(오른쪽 위, 쪽 나누기)과 하우징, 침대. 예전 왕국 스위트의 가구 검사를 옮겨 왔다
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageHint, pageSelf, pageWalkTo, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1;
const shot = (name) => path.join(SHOTS, name);
const decor = (bot) => bot.lastEvent('decor');
const inv = (bot) => bot.lastEvent('inv');
const furn = (bot) => (inv(bot) ?? bot.welcome).f;
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const pause = () => wait(260);   // 행동 제한에 걸리지 않게

async function shop(t) {
  const { server, ids } = await serverWithAccounts({
    buyer: [0, 760, 600, { gold: 500 }], poor: [0, 800, 600, { gold: 5 }], far: [0, 300, 1300, { gold: 500 }], out: [0, 820, 620],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const out = await enter('out');
  const map = out.map;
  t.check('the kingdom and the slime colony are gone', !map.buildings.some((b) => b.k === 'portal' || b.k === 'gate') && !map.npcs && map.zones.length === 10, map.zones.length);
  t.check('the catalog has many kinds of furniture', map.catalog.length >= 30, map.catalog.length);
  const buyer = await enter('buyer'), poor = await enter('poor'), far = await enter('far');
  await wait(100);
  // 오른쪽 위 상점(shopAnywhere)이 열려 있으면 어디서나 산다. 값은 목록의 골드 가격대로 받는다.
  const anywhere = buyer.map.shopAnywhere, chairPrice = buyer.map.catalog[0].price, bedPrice = buyer.map.catalog[13].price;
  t.check('the catalog lists the record player', buyer.map.catalog[33]?.k === 'record_player', JSON.stringify(buyer.map.catalog[33]));
  buyer.send('decor buy 0');
  await buyer.until(() => inv(buyer)?.f?.[0] === 1, 1500);
  t.check('buying charges the listed price', inv(buyer).g === 500 - chairPrice, JSON.stringify(inv(buyer)));
  far.send('decor buy 0');
  poor.send('decor buy 13');
  const free = buyer.map.catalog.every((item) => item.price === 0);   // 테스트 기간에는 전부 0원
  t.check('prices are all gold or all free', free || buyer.map.catalog.every((item) => item.price > 0));
  await far.until(() => inv(far)?.f?.[0] === 1, 1500);
  t.check('the corner shop sells anywhere', anywhere && inv(far)?.f[0] === 1 && inv(far).g === 500 - chairPrice);
  if (bedPrice > 5) {
    await poor.until(() => says(poor, '골드가 부족'), 1500);
    t.check('it needs enough gold', !inv(poor) || inv(poor).f[13] === 0);
  } else {
    await poor.until(() => inv(poor)?.f?.[13] === 1, 1500);
    t.check('free furniture needs no gold', inv(poor)?.f[13] === 1 && inv(poor).g === 5);
  }
  await pause();
  buyer.send('decor buy 999');
  await wait(200);
  t.check('unknown furniture is refused', inv(buyer).g === 500 - chairPrice && inv(buyer).f.every((n, i) => n === (i === 0 ? 1 : 0)));
  for (const bot of [out, buyer, poor, far]) bot.close();
  await server.stop();
}

async function housing(t) {
  // 몰쟈 집 900x? 안에 서고, 침대 2개와 스툴, 카펫, 시계를 갖고 시작한다
  const items = { f13: 2, f2: 1, f25: 1, f32: 1, f21: 3 };
  const { server, ids } = await serverWithAccounts({ owner: [MOLJA, 300, 410, { gold: 0, ...items }], guest: [MOLJA, 480, 410, { f21: 1 }], outside: [0, 820, 620, { f21: 1 }] });
  const owner = await Bot.enter(server, 'owner', { id: ids.owner });
  const guest = await Bot.enter(server, 'guest', { id: ids.guest });
  const outside = await Bot.enter(server, 'outside', { id: ids.outside });
  await wait(150);
  const zone = owner.map.zones[MOLJA];
  // 몰쟈 집에는 원래 있던 가구가 설치형으로 깔려 있다. 누구의 것도 아니라 누구나 회수할 수 있다(표시 2).
  const base = decor(owner)?.p.length ?? 0;
  t.check('a house starts with its own furniture anyone can take', base >= 10 && decor(owner).p.every((d) => d[4] === 2), JSON.stringify(decor(owner)));
  outside.send('decor place 21 300 300');
  await outside.until(() => says(outside, '집 안에서만'), 1500);
  t.check('furniture goes only in houses', true);

  owner.send('decor place 21 200 400');
  await guest.until(() => decor(guest).p.length === base + 1, 1500);
  await owner.until(() => inv(owner) && decor(owner).p.length === base + 1, 1500);
  t.check('placing shows to everyone in the house', furn(owner)[21] === 2 && decor(guest).p.at(-1)[4] === 0 && decor(owner).p.at(-1)[4] === 1, JSON.stringify(decor(owner).p.at(-1)));
  await pause();
  owner.send('decor place 21 200 400');
  await owner.until(() => says(owner, '겹칩니다'), 1500);
  t.check('furniture cannot overlap', furn(owner)[21] === 2);
  await pause();
  owner.send(`decor place 21 ${zone.door[0]} ${zone.door[1] - 20}`);
  await owner.until(() => says(owner, '문 앞에는'), 1500);
  t.check('the doorway stays clear', true);
  await pause();
  guest.send('decor place 21 480 416');
  await guest.until(() => says(guest, '사람이 서 있는'), 1500);
  t.check('furniture cannot land on a person', true);
  await pause();
  owner.send('decor place 32 300 -60');
  await owner.until(() => decor(owner).p.length === base + 2, 1500);
  t.check('wall items hang on the wall', decor(owner).p.some((d) => d[1] === 32));
  await pause();
  owner.send('decor place 25 560 400');
  await owner.until(() => decor(owner).p.length === base + 3, 1500);
  t.check('rugs lie on the floor', decor(owner).p.some((d) => d[1] === 25));
  await pause();
  guest.send(`decor take ${decor(guest).p.find((d) => d[4] === 0)[0]}`);
  await guest.until(() => says(guest, '동거인이 놓은 가구만 치울'), 1500);
  t.check('only the owner can take furniture back', decor(guest).p.length === base + 3);

  // 놓은 가구는 막히고, 스툴에는 앉을 수 있다
  await pause();
  owner.send('decor place 2 540 390');
  await owner.until(() => decor(owner).p.length === base + 4, 1500);
  const stool = decor(owner).p.at(-1);
  await owner.walkTo(540, 410, 10);
  owner.send('use');
  await owner.until(() => owner.me.s > 0, 1500);
  t.check('a placed stool can be sat on', owner.me.s - 1 === stool[5][0][0], JSON.stringify([owner.me, stool]));
  await pause();
  owner.send('use');
  await owner.until(() => !owner.me.s, 1500);
  await pause();
  owner.send('decor place 21 600 320');
  await owner.until(() => decor(owner).p.length === base + 5, 1500);
  await pause();
  const plant = decor(owner).p.at(-1);
  await owner.walkTo(600, 360, 8);
  owner.send('in 1');
  await wait(600);
  owner.send('in 0');
  await wait(120);
  t.check('placed furniture blocks walking', owner.me.y >= 320 + 13, JSON.stringify(owner.me));

  // 침대에 눕고 일어나면 침대 앞에 선다
  await pause();
  owner.send('decor place 13 440 300');
  await owner.until(() => decor(owner).p.length === base + 6, 1500);
  const bed = decor(owner).p.at(-1);
  t.check('a bed has two places to lie', bed[5].length === 2 && bed[5].every((s) => s[4] === 1), JSON.stringify(bed));
  await owner.walkTo(440, 322, 8);
  owner.send('use');
  await owner.until(() => owner.me.s > 0, 1500);
  t.check('you can lie on a bed', owner.me.s - 1 === bed[5][0][0] || owner.me.s - 1 === bed[5][1][0], JSON.stringify(owner.me));
  await pause();
  owner.send('use');
  await owner.until(() => !owner.me.s, 1500);
  await wait(120);
  t.check('getting up stands in front of the bed', owner.me.y > 300 + 13, JSON.stringify(owner.me));

  await pause();
  owner.send(`decor take ${plant[0]}`);
  await owner.until(() => decor(owner).p.length === base + 5, 1500);
  await wait(80);
  t.check('taking returns the item', furn(owner)[21] === 2, JSON.stringify(furn(owner)));

  await wait(300);
  for (const bot of [owner, guest, outside]) bot.close();
  await wait(200);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'owner', { id: ids.owner });
  await back.until(() => decor(back), 1500);
  t.check('placed furniture survives a restart', decor(back).p.length === base + 5 && decor(back).p.filter((d) => d[4] === 1).length === 5, JSON.stringify(decor(back).p.map((d) => d[1])));
  t.check('the house furniture is not laid twice after a restart', decor(back).p.filter((d) => d[4] === 2).length === base);
  t.check('furniture counts survive a restart', furn(back)[21] === 2, JSON.stringify(furn(back)));
  back.close();
  await again.stop();
}

async function roomCutoff(t) {
  // 방을 가로지르는 줄을 채우는 마지막 가구는 남은 방을 끊으므로 거절된다
  const { server, ids } = await serverWithAccounts({ a: [MOLJA, 300, 410, { f12: 5, f15: 5 }] });
  const a = await Bot.enter(server, 'a', { id: ids.a });
  await wait(120);
  for (const [kind, x] of [[12, 240], [12, 440], [15, 56]]) {
    a.send(`decor place ${kind} ${x} 372`);
    await pause();
  }
  const mine = () => (decor(a)?.p ?? []).filter((d) => d[4] === 1).length;
  t.check('a row can almost cross the room', mine() === 3, JSON.stringify(a.events.filter((e) => e.t === 'sys').map((e) => e.m).slice(-3)));
  a.send('decor place 15 604 372');
  await a.until(() => says(a, '길이 막혀'), 1500);
  t.check('furniture cannot wall off part of a room', mine() === 3);
  a.close();
  await server.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({
    shopper: [0, 820, 620, { gold: 800 }], decorator: [MOLJA, 300, 410, { gold: 0, f13: 1, f25: 1, f0: 1, f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f6: 1, f7: 1, f8: 1, f9: 1 }],
  });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await wait(300);
    return page;
  };
  const shopper = await open('shopper');
  await shopper.click('#shop-open');
  await shopper.waitForSelector('#furn-shop:not([hidden])', { timeout: 2000 });
  const cells = await shopper.evaluate(() => [...furnList.children].map((c) => !c.hidden));
  t.check('the shop lists the catalog twelve to a page', cells.length + await shopper.evaluate(() => arcadeList.children.length) === await shopper.evaluate(() => terrain.catalog.length) && cells.filter(Boolean).length === 12 && cells.slice(0, 12).every(Boolean));
  t.check('the pager shows the page count', (await shopper.textContent('#furn-list + .pager b')) === `1 / ${Math.ceil(cells.length / 12)}` && await shopper.isDisabled('#furn-list + .pager button:first-child'));
  await shopper.screenshot({ path: shot('furniture_shop.png') });
  await shopper.click('#furn-list .furn-cell:first-child button');
  await shopper.waitForFunction(() => myFurn[0] === 1, null, { timeout: 2000 });
  t.check('buying shows the count', (await shopper.textContent('#furn-list .furn-cell:first-child small')).includes('1개'));
  await shopper.click('#furn-list + .pager button:last-child');
  const second = await shopper.evaluate(() => [...furnList.children].map((c, i) => (c.hidden ? -1 : i)).filter((i) => i >= 0));
  t.check('the next page shows the next twelve', second[0] === 12 && second.length === Math.min(12, cells.length - 12), JSON.stringify(second));
  await shopper.click('#shop-tabs [data-tab="floor"]');
  t.check('the pager hides with its tab', await shopper.isHidden('#furn-list + .pager'));
  await shopper.click('#shop-tabs [data-tab="furn"]');
  t.check('the page is kept when coming back', (await shopper.textContent('#furn-list + .pager b')).startsWith('2 /'));
  await shopper.keyboard.press('Escape');
  t.check('the music matches the village', (await shopper.evaluate(() => Sound.current())) === 'village');
  t.check('no script errors in the shop', shopper.problems.length === 0, shopper.problems.join(' | '));

  const decorator = await open('decorator');
  await decorator.waitForFunction(() => zone === 1 && inHouse(), null, { timeout: 3000 });
  t.check('the music matches a house', (await decorator.evaluate(() => Sound.current())) === 'house');
  t.check('hint offers furniture placing', (await pageHint(decorator)).includes('H: 가구 배치'), await pageHint(decorator));
  await decorator.keyboard.press('KeyH');
  t.check('H opens the furniture tab of the bag', await decorator.isVisible('#bag-pane-furn') && !(await decorator.isVisible('#bag-items')) && (await decorator.$$('#decor-list button')).length === 12);
  t.check('the bag shows nine kinds a page', (await decorator.$$('#decor-list button:not([hidden])')).length === 9 && (await decorator.textContent('#decor-list + .pager b')) === '1 / 2');
  await decorator.click('#decor-list + .pager button:last-child');
  await decorator.click('#decor-list button[data-kind="13"]');   // 침대 (둘째 쪽)
  t.check('picking furniture on the second page keeps the page', (await decorator.textContent('#decor-list + .pager b')) === '2 / 2' && await decorator.evaluate(() => decorPlacing === 13));
  const place = await decorator.evaluate(() => { const [cx, cy] = camera(innerWidth, innerHeight); return [440 - cx, 300 - cy]; });
  await decorator.mouse.move(...place);
  await wait(100);
  await decorator.screenshot({ path: shot('decor_ghost.png') });
  await decorator.mouse.click(...place);
  await decorator.waitForFunction(() => decorItems.some((d) => d.own && d.info.k === 'bed'), null, { timeout: 2000 });
  t.check('clicking places the furniture', await decorator.evaluate(() => terrain.furnByZone[1].some((f) => f.k === 'bed' && f.decor)));
  await pageWalkTo(decorator, 440, 324, 10);
  await wait(150);
  t.check('hint offers lying down', (await pageHint(decorator)).includes('E: 눕기'), await pageHint(decorator));
  await decorator.keyboard.press('KeyE');
  await decorator.waitForFunction(() => !!terrain.seats[entities.get(myId).seat - 1]?.lie, null, { timeout: 2000 });
  await wait(200);
  await decorator.screenshot({ path: shot('decor_bed.png') });
  t.check('lying shows the player in bed', (await pageSelf(decorator)).seat > 0);
  await decorator.keyboard.press('KeyE');
  await decorator.waitForFunction(() => !entities.get(myId).seat, null, { timeout: 2000 });
  await decorator.click('#decor-take');
  const bedAt = await decorator.evaluate(() => { const [cx, cy] = camera(innerWidth, innerHeight); return [440 - cx, 270 - cy]; });
  await decorator.mouse.click(...bedAt);
  await decorator.waitForFunction(() => !decorItems.some((d) => d.own), null, { timeout: 2000 });
  t.check('take mode returns furniture', await decorator.evaluate(() => myFurn[13] === 1));
  await decorator.click('#music-toggle');
  t.check('BGM can be turned off from the corner', await decorator.evaluate(() => !Sound.isMusicOn()) && (await decorator.getAttribute('#music-toggle', 'aria-pressed')) === 'false');
  t.check('no script errors while decorating', decorator.problems.length === 0, decorator.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([shop(t), housing(t), roomCutoff(t), browser(t)]);
}
