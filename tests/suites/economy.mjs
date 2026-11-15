// 골드, 아이템 버리기, 매점, 교환
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageSelf, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const THEATER = 4;
const FISH = 0, JELLY = 3, POPCORN = 5, POTION = 7, ELIXIR = 8;
const inv = (bot) => bot.lastEvent('inv');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const trade = (bot) => bot.events.filter((e) => e.t === 'trade');
const tradeState = (bot) => trade(bot).filter((e) => e.a === 'state').at(-1);
const closed = (bot) => trade(bot).filter((e) => e.a === 'closed').at(-1);

async function nextInv(bot, command) {
  const count = () => bot.events.filter((e) => e.t === 'inv').length;
  const before = count();
  bot.send(command);
  await bot.until(() => count() > before, 800);
}

async function dropping(t) {
  const { server, ids } = await serverWithAccounts({
    a: [0, 820, 620, { c0: 3, l0: 1, gold: 500, s0: 2 }], b: [0, 1020, 620],
  });
  const a = await Bot.enter(server, 'a', { id: ids.a });
  const b = await Bot.enter(server, 'b', { id: ids.b });
  await wait(100);
  t.check('gold and items load', a.welcome.g === 500 && a.welcome.s.join() === '2,0,0,0,0,0,0,0' && a.welcome.c[0] === 3, JSON.stringify(a.welcome));

  await nextInv(a, `drop ${FISH} 1`);
  t.check('dropping removes the item', inv(a).c[0] === 2, JSON.stringify(inv(a)));
  await b.until(() => b.drops?.length === 1, 800);
  const [, kind, x, y, amount] = b.drops[0];
  t.check('everyone sees it on the ground', kind === FISH && amount === 1 && Math.hypot(x - a.me.x, y - a.me.y) < 45, JSON.stringify(b.drops));
  await wait(400);
  t.check('it does not jump back to the dropper', inv(a).c[0] === 2 && a.drops.length === 1, JSON.stringify(a.drops));

  await b.walkTo(x, y, 8, 5000);
  await b.until(() => b.lastEvent('loot'), 2000);
  t.check('someone else can take it', b.lastEvent('loot')?.k === FISH && inv(b)?.c[0] === 1, JSON.stringify(inv(b)));
  await b.walkTo(1020, 620, 12, 5000);

  // 버린 사람은 한 번 멀어졌다 돌아오면 주울 수 있다
  await nextInv(a, `drop ${JELLY} 1`);
  await a.until(() => a.drops?.length === 1, 800);
  const [, , jx, jy] = a.drops[0];
  await a.walkTo(jx + 120, jy, 12, 4000);
  await a.walkTo(jx, jy, 8, 4000);
  await a.until(() => a.lastEvent('loot')?.k === JELLY, 2000);
  t.check('the dropper can come back for it', inv(a).l[0] === 1, JSON.stringify(inv(a)));

  // 잘못된 입력
  await wait(600);
  const events = a.events.filter((e) => e.t === 'inv').length;
  for (const bad of ['drop', 'drop x 1', 'drop 99 1', 'drop -1 1', `drop ${FISH} 0`, `drop ${FISH} -3`, 'drop 1 1']) a.send(bad);
  await wait(150);
  t.check('invalid drops are ignored', a.events.filter((e) => e.t === 'inv').length === events && !a.closed);

  await wait(1200);
  await nextInv(a, `drop ${FISH} 999`);
  t.check('dropping more than you have drops only what you have', inv(a).c[0] === 0 && a.drops.at(-1)[4] === 2, JSON.stringify([inv(a), a.drops]));

  // 재접속해도 그대로
  a.close();
  await wait(150);
  const back = await Bot.enter(server, 'a', { id: ids.a });
  t.check('inventory changes are saved', back.welcome.c[0] === 0 && back.welcome.g === 500, JSON.stringify(back.welcome));
  back.close();
  b.close();
  await wait(100);
  await server.stop();
}

async function shop(t) {
  const { server, ids } = await serverWithAccounts({
    rich: [THEATER, 840, 620, { gold: 130 }], poor: [THEATER, 780, 620, { gold: 5, s0: 1 }], away: [THEATER, 300, 600, { gold: 500 }],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(80);
    return bot;
  };
  const rich = await enter('rich');
  const poor = await enter('poor');
  const away = await enter('away');

  await nextInv(rich, `buy ${POPCORN}`);
  t.check('buying takes gold and gives the item', inv(rich).g === 115 && inv(rich).s[0] === 1, JSON.stringify(inv(rich)));
  await nextInv(rich, `buy ${ELIXIR}`);
  t.check('expensive items cost more', inv(rich).g === 15 && inv(rich).s[3] === 1, JSON.stringify(inv(rich)));
  rich.send(`buy ${POTION}`);
  await rich.until(() => says(rich, '골드가 부족'), 800);
  t.check('cannot buy without enough gold', says(rich, '골드가 부족') && inv(rich).g === 15);
  away.send(`buy ${POPCORN}`);
  await away.until(() => says(away, '매점 앞'), 800);
  t.check('cannot buy away from the counter', says(away, '매점 앞') && !inv(away));
  const count = rich.events.filter((e) => e.t === 'inv').length;
  for (const bad of ['buy', 'buy x', 'buy 0', 'buy 3', 'buy 9', 'buy -1']) rich.send(bad);
  await wait(150);
  t.check('only shop items can be bought', rich.events.filter((e) => e.t === 'inv').length === count && !rich.closed);

  // 먹기
  await wait(1500);
  rich.send(`eat ${ELIXIR}`);
  await rich.until(() => says(rich, 'HP가 가득'), 800);
  t.check('potions are not wasted at full health', says(rich, 'HP가 가득') && inv(rich).s[3] === 1);
  await nextInv(poor, `eat ${POPCORN}`);
  t.check('snacks can always be eaten', inv(poor).s[0] === 0, JSON.stringify(inv(poor)));
  await poor.until(() => poor.lastEvent('emote')?.e === 1, 500);
  t.check('eating shows a yummy face', poor.lastEvent('emote')?.e === 1);
  await wait(1100);
  const before = poor.events.filter((e) => e.t === 'inv').length;
  poor.send(`eat ${FISH}`);
  poor.send(`eat ${POPCORN}`);
  await wait(120);
  t.check('cannot eat fish or what you do not have', poor.events.filter((e) => e.t === 'inv').length === before);

  for (const bot of [rich, poor, away]) bot.close();
  await wait(100);
  await server.stop();
}

async function trading(t) {
  const { server, ids } = await serverWithAccounts({
    a: [0, 820, 620, { c0: 5, gold: 300 }], b: [0, 880, 620, { l1: 2, gold: 40 }], far: [0, 1420, 620], c: [0, 920, 620, { c1: 1 }],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(80);
    return bot;
  };
  const a = await enter('a');
  const b = await enter('b');
  const far = await enter('far');
  const c = await enter('c');

  // 신청
  far.send(`trade ask ${a.id}`);
  await far.until(() => says(far, '신청할 수 없습니다'), 800);
  t.check('too far away to trade', says(far, '신청할 수 없습니다') && trade(a).length === 0);
  b.send(`trade yes ${a.id}`);
  await wait(100);
  t.check('cannot accept what was not offered', trade(b).length === 0 && trade(a).length === 0);

  a.send(`trade ask ${b.id}`);
  await b.until(() => trade(b).some((e) => e.a === 'ask'), 800);
  t.check('the other player is asked', trade(b).at(-1).id === a.id && trade(b).at(-1).n === 'a', JSON.stringify(trade(b)));
  b.send(`trade no ${a.id}`);
  await a.until(() => says(a, '거절'), 800);
  t.check('refusing tells the asker', says(a, '거절'));

  a.send(`trade ask ${b.id}`);
  await b.until(() => trade(b).filter((e) => e.a === 'ask').length === 2, 800);
  b.send(`trade yes ${a.id}`);
  await a.until(() => tradeState(a), 800);
  t.check('both windows open', trade(a).some((e) => e.a === 'open' && e.n === 'b') && trade(b).some((e) => e.a === 'open' && e.n === 'a'));

  // 내놓기: 가진 것 이상은 안 된다
  const setItem = async (bot, command, other) => {
    const n = trade(other).length;
    bot.send(command);
    await other.until(() => trade(other).length > n, 800);
  };
  await setItem(a, `trade item ${FISH} 99`, b);
  t.check('cannot offer more than you have', tradeState(b).theirs.i[FISH] === 5, JSON.stringify(tradeState(b)));
  await setItem(a, `trade item ${FISH} 2`, b);
  t.check('the partner sees the offer', tradeState(b).theirs.i[FISH] === 2);
  await setItem(a, 'trade gold 100', b);
  await setItem(a, 'trade gold -50', b);
  t.check('negative gold becomes zero', tradeState(b).theirs.g === 0, JSON.stringify(tradeState(b)));
  await setItem(a, 'trade gold 999999', b);
  t.check('cannot offer more gold than you have', tradeState(b).theirs.g === 300, JSON.stringify(tradeState(b)));
  await setItem(a, 'trade gold 100', b);
  await setItem(b, 'trade item 4 1', a);

  // 교환 중에는 물건을 없앨 수 없다
  const countA = a.events.filter((e) => e.t === 'inv').length;
  a.send(`drop ${FISH} 5`);
  await wait(120);
  t.check('cannot drop while trading', a.events.filter((e) => e.t === 'inv').length === countA);

  // 내용이 바뀌면 확인이 풀린다
  await setItem(a, 'trade ready', b);
  t.check('ready is shown to the partner', tradeState(b).theirs.r === true);
  await setItem(b, 'trade item 4 2', a);
  t.check('a changed offer clears ready', tradeState(a).mine.r === false && tradeState(b).theirs.r === false, JSON.stringify(tradeState(a)));
  await setItem(b, 'trade item 4 1', a);

  // 완료
  await setItem(a, 'trade ready', b);
  await nextInv(b, 'trade ready');
  await a.until(() => closed(a), 800);
  await wait(60);
  t.check('giver loses and gains the right things', inv(a).c[0] === 3 && inv(a).g === 200 && inv(a).l[1] === 1, JSON.stringify(inv(a)));
  t.check('receiver loses and gains the right things', inv(b).c[0] === 2 && inv(b).g === 140 && inv(b).l[1] === 1, JSON.stringify(inv(b)));
  t.check('both windows close', closed(a)?.m.includes('마쳤') && closed(b)?.m.includes('마쳤'), JSON.stringify(closed(a)));

  // 취소와 끊김
  await wait(1200);
  a.send(`trade ask ${c.id}`);
  await c.until(() => trade(c).some((e) => e.a === 'ask'), 800);
  c.send(`trade yes ${a.id}`);
  await a.until(() => trade(a).filter((e) => e.a === 'open').length === 2, 800);
  a.send('trade cancel');
  await c.until(() => closed(c), 800);
  t.check('cancel closes both sides', !!closed(c)?.m.includes('취소'), JSON.stringify(closed(c)));
  await wait(60);
  t.check('cancel moves nothing', inv(a).c[0] === 3 && !c.events.some((e) => e.t === 'inv'));

  await wait(1200);
  a.send(`trade ask ${c.id}`);
  await c.until(() => trade(c).filter((e) => e.a === 'ask').length === 2, 800);
  c.send(`trade yes ${a.id}`);
  await a.until(() => trade(a).filter((e) => e.a === 'open').length === 3, 800);
  await setItem(a, `trade item ${FISH} 3`, c);
  const closedBefore = trade(a).filter((e) => e.a === 'closed').length;
  c.close();
  await a.until(() => trade(a).filter((e) => e.a === 'closed').length > closedBefore, 1000);
  t.check('a disconnect cancels the trade', closed(a).m.includes('접속을 끊어'), JSON.stringify(closed(a)));
  await wait(1100);
  await nextInv(a, `drop ${FISH} 1`);
  t.check('a cancelled trade frees the player', inv(a).c[0] === 2, JSON.stringify(inv(a)));

  // 재접속해도 교환 결과가 남는다
  b.close();
  await wait(150);
  const again = await Bot.enter(server, 'b', { id: ids.b });
  t.check('trade results are saved', again.welcome.g === 140 && again.welcome.c[0] === 2, JSON.stringify(again.welcome));
  for (const bot of [a, far, again]) bot.close();
  await wait(100);
  await server.stop();
}

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    alice: [0, 820, 620, { c0: 3, gold: 200 }], bob: [0, 910, 620, { l0: 1, gold: 10 }], buyer: [THEATER, 840, 620, { gold: 120 }],
  });
  const browser = await launchBrowser();
  const alice = await enterGame(browser, server, ids.alice, { name: 'alice' });
  const bob = await enterGame(browser, server, ids.bob, { name: 'bob' });
  await wait(250);
  const shown = (page) => page.evaluate(() => [[...myBag], [...myLoot], [...myShop], myGold]);

  await alice.keyboard.press('KeyI');
  t.check('gold shows in the item window', (await alice.textContent('#bag-gold')) === '200 G', await alice.textContent('#bag-gold'));

  // ---- 창 밖으로 끌어 버리기
  const from = await alice.locator('.bag-slot[data-kind="1"]').boundingBox();
  await alice.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await alice.mouse.down();
  await alice.mouse.move(400, 200, { steps: 6 });
  await alice.mouse.up();
  await alice.waitForFunction(() => myBag[0] === 2 && drops.length === 1, null, { timeout: 2000 });
  t.check('dragging out of the window drops one', true);
  await alice.screenshot({ path: path.join(SHOTS, 'economy_drop.png') });

  // ---- 우클릭으로 교환
  const target = await alice.evaluate(() => {
    const [camX, camY] = camera(innerWidth, innerHeight);
    const other = [...entities].find(([id]) => id !== myId)[1];
    return { x: other.x - camX, y: other.y - bodyLift(other) - camY };
  });
  await alice.mouse.click(target.x, target.y, { button: 'right' });
  t.check('right click opens the menu', await alice.isVisible('#player-menu') && (await alice.textContent('#player-trade')).includes('bob'), await alice.textContent('#player-trade'));
  await alice.mouse.click(40, 300);
  t.check('clicking elsewhere closes the menu', !(await alice.isVisible('#player-menu')));
  await alice.mouse.click(target.x, target.y, { button: 'right' });
  await alice.click('#player-trade');
  await bob.waitForSelector('#notice-layer:not([hidden])', { timeout: 2000 });
  t.check('the other player gets a prompt in the middle of the screen', (await bob.textContent('#notice-text')).includes('alice') && (await bob.textContent('#notice-title')) === '교환 신청');
  await bob.screenshot({ path: path.join(SHOTS, 'economy_trade_ask.png') });
  await bob.click('#notice-yes');
  await alice.waitForSelector('#trade:not([hidden])', { timeout: 2000 });
  await bob.waitForSelector('#trade:not([hidden])', { timeout: 2000 });
  await alice.waitForFunction(() => tradeState !== null, null, { timeout: 2000 });
  await alice.click('#trade-bag .trade-item');
  await bob.waitForFunction(() => tradeState.theirs.i[0] === 1, null, { timeout: 2000 });
  t.check('offered items show on the other side', (await bob.$$('#trade-theirs .trade-item')).length === 1);
  await alice.fill('#trade-gold', '50');
  await alice.press('#trade-gold', 'Enter');
  await alice.locator('#trade-gold').blur();
  await bob.waitForFunction(() => tradeState.theirs.g === 50, null, { timeout: 2000 });
  t.check('offered gold shows on the other side', (await bob.textContent('#trade-their-gold')) === '50 G');
  await alice.screenshot({ path: path.join(SHOTS, 'economy_trade.png') });
  const before = await pageSelf(alice);
  await alice.click('#trade-gold');
  await alice.keyboard.type('wa');
  await wait(150);
  t.check('typing gold does not move the character', Math.hypot((await pageSelf(alice)).x - before.x, (await pageSelf(alice)).y - before.y) < 1);
  await alice.fill('#trade-gold', '50');
  await alice.locator('#trade-gold').blur();
  await wait(100);
  await alice.click('#trade-ready');
  await bob.waitForFunction(() => tradeState.theirs.r === true, null, { timeout: 2000 });
  await bob.click('#trade-ready');
  await alice.waitForSelector('#trade', { state: 'hidden', timeout: 2000 });
  await bob.waitForFunction(() => myGold === 60, null, { timeout: 2000 });
  t.check('trade changes both inventories', JSON.stringify(await shown(alice)) === '[[1,0,0],[0,0],[0,0,0,0,0,0,0,0],150]' && JSON.stringify(await shown(bob)) === '[[1,0,0],[1,0],[0,0,0,0,0,0,0,0],60]', JSON.stringify([await shown(alice), await shown(bob)]));

  // ---- 매점
  const buyer = await enterGame(browser, server, ids.buyer, { name: 'buyer' });
  await wait(200);
  const hint = () => buyer.evaluate(() => actionHint({ ...entities.get(myId), x: me.x, y: me.y }));
  t.check('hint offers the shop', (await hint()).includes('E: 매점'), await hint());
  await buyer.keyboard.press('KeyE');
  t.check('E opens the shop', await buyer.isVisible('#shop') && (await buyer.$$('.shop-row:not([hidden])')).length === 4);
  await buyer.screenshot({ path: path.join(SHOTS, 'economy_shop.png') });
  await buyer.click('.shop-row:nth-child(1) button');
  await buyer.waitForFunction(() => myShop[0] === 1 && myGold === 105, null, { timeout: 2000 });
  t.check('shop shows the remaining gold', (await buyer.textContent('#shop-gold')) === '105 G', await buyer.textContent('#shop-gold'));
  await buyer.click('.shop-row:nth-child(4) button');
  await buyer.waitForFunction(() => myGold === 5, null, { timeout: 2000 });
  t.check('items you cannot afford are disabled', await buyer.isDisabled('.shop-row:nth-child(1) button'));
  await buyer.keyboard.press('Escape');
  t.check('Esc closes the shop', !(await buyer.isVisible('#shop')));

  // 아이템창에서 클릭해 먹기
  await buyer.keyboard.press('KeyI');
  await buyer.hover('.bag-slot[data-kind="6"]');
  t.check('shop items have descriptions', (await buyer.textContent('#item-tip')).includes('팝콘'), await buyer.textContent('#item-tip'));
  await buyer.click('.bag-slot[data-kind="6"]');
  await buyer.waitForFunction(() => myShop[0] === 0, null, { timeout: 2000 });
  t.check('clicking a snack eats it', true);

  const problems = [...alice.problems, ...bob.problems, ...buyer.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await dropping(t);
  await shop(t);
  await trading(t);
  await ui(t);
}
