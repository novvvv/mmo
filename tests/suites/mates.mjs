// 동거인: 신청과 수락, 서로의 가구 옮기기와 치우기(주인에게 돌려보냄), 해제, 저장
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1, PLANT = 21, STOOL = 2;
const shot = (name) => path.join(SHOTS, name);
const decor = (bot) => bot.lastEvent('decor');
const inv = (bot) => bot.lastEvent('inv');
const mates = (bot) => bot.lastEvent('mates');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const pause = () => wait(260);   // 행동 제한에 걸리지 않게
const item = (bot, kind, owner) => decor(bot)?.p.find((d) => d[1] === kind && (owner === undefined || d[4] === owner));

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [MOLJA, 300, 410, { f21: 3, f2: 1 }], b: [MOLJA, 480, 410], c: [MOLJA, 560, 410],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  let a = await enter('a');
  const b = await enter('b'), c = await enter('c');
  await wait(150);
  a.send(`decor place ${PLANT} 200 400`);
  await b.until(() => item(b, PLANT, 0), 1500);
  const plant = item(b, PLANT, 0);
  b.send(`decor move ${plant[0]} 600 320`);
  await b.until(() => says(b, '동거인이 놓은 가구만 옮길'), 1500);
  t.check('strangers cannot move my furniture', item(a, PLANT, 1)[2] === 200);
  await pause();
  b.send(`decor take ${plant[0]}`);
  await b.until(() => says(b, '동거인이 놓은 가구만 치울'), 1500);
  t.check('strangers cannot take it either', !!item(a, PLANT, 1));
  const sofa = decor(c).p.find((d) => d[1] === 7);   // 집에 원래 있던 소파
  c.send(`decor move ${sofa[0]} 340 380`);
  await c.until(() => decor(c).p.find((d) => d[0] === sofa[0])?.[3] === 380, 1500);
  t.check('anyone can move the house furniture', true);

  // ---- 동거인 맺기
  await pause();
  a.send(`mate ask ${b.id}`);
  await b.until(() => b.lastEvent('mateask'), 1500);
  t.check('a housemate request arrives', b.lastEvent('mateask').n === 'a' && b.lastEvent('mateask').id === a.id);
  await pause();
  c.send(`mate yes ${a.id}`);
  await wait(200);
  t.check('only the asked person can accept', !(mates(c)?.p.length));
  b.send(`mate yes ${a.id}`);
  await a.until(() => mates(a)?.p.length === 1, 1500);
  await b.until(() => mates(b)?.p.length === 1, 1500);
  t.check('both become housemates', mates(a).p[0][0] === 'b' && mates(b).p[0][0] === 'a' && mates(a).p[0][1] === b.id);
  await b.until(() => item(b, PLANT, 3), 1500);
  t.check('a housemate sees my furniture as theirs to manage', !!item(b, PLANT, 3));

  // ---- 옮기기
  await pause();
  b.send(`decor move ${plant[0]} 600 320`);
  await a.until(() => item(a, PLANT, 1)?.[2] === 600, 1500);
  t.check('a housemate can move my furniture', item(a, PLANT, 1)[3] === 320);
  t.check('it stays mine after the move', item(a, PLANT, 1)[4] === 1 && item(c, PLANT, 0)[0] === plant[0]);
  await pause();
  const door = a.map.zones[MOLJA].door;
  b.send(`decor move ${plant[0]} ${door[0]} ${door[1] - 20}`);
  await b.until(() => says(b, '문 앞에는'), 1500);
  t.check('a move follows the placing rules', item(a, PLANT, 1)[2] === 600);
  await pause();
  a.send(`decor place ${STOOL} 540 380`);
  await a.until(() => item(a, STOOL, 1), 1500);
  const stool = item(a, STOOL, 1);
  await c.walkTo(540, 400, 10);
  c.send('use');
  await c.until(() => c.me.s > 0, 1500);
  await pause();
  b.send(`decor move ${stool[0]} 400 380`);
  await b.until(() => says(b, '누가 앉아'), 1500);
  t.check('furniture someone sits on stays put', item(a, STOOL, 1)[2] === 540);
  c.send('use');

  // ---- 치우기: 주인에게 돌아간다
  await pause();
  const plantsBefore = inv(a)?.f?.[PLANT] ?? a.welcome.f[PLANT];
  b.send(`decor take ${plant[0]}`);
  await a.until(() => inv(a)?.f?.[PLANT] === plantsBefore + 1, 1500);
  t.check('a housemate clears it back to the owner', !decor(a).p.some((d) => d[0] === plant[0]) && (inv(b)?.f?.[PLANT] ?? 0) === 0);

  // 주인이 접속해 있지 않아도
  await pause();
  a.send(`decor place ${PLANT} 200 400`);
  await b.until(() => item(b, PLANT, 3), 1500);
  const offline = item(b, PLANT, 3);
  const plantsLeft = inv(a).f[PLANT];
  a.close();
  await b.until(() => mates(b).p[0][1] === 0, 1500);
  t.check('the list shows a housemate going offline', mates(b).p[0][1] === 0);
  b.send(`decor take ${offline[0]}`);
  await b.until(() => !decor(b).p.some((d) => d[0] === offline[0]), 1500);
  await wait(200);
  a = await Bot.enter(server, 'a', { id: ids.a });
  await a.until(() => a.welcome, 1500);
  t.check('it reaches the owner even while away', a.welcome.f[PLANT] === plantsLeft + 1, `${plantsLeft} -> ${a.welcome.f[PLANT]}`);
  await a.until(() => mates(a), 1500);
  t.check('housemates are kept', mates(a).p[0][0] === 'b');

  // ---- 해제
  await pause();
  b.send('mate remove 0');
  await a.until(() => mates(a).p.length === 0, 1500);
  t.check('removing ends it for both', mates(b).p.length === 0);
  await pause();
  a.send(`decor place ${PLANT} 200 400`);
  await b.until(() => item(b, PLANT, 0), 1500);
  b.send(`decor move ${item(b, PLANT, 0)[0]} 600 320`);
  await b.until(() => says(b, '동거인이 놓은 가구만 옮길'), 1500);
  t.check('former housemates cannot move it any more', true);
  for (const bot of [a, b, c]) bot.close();
  await wait(300);
  await server.stop();

  // 다시 켜도 남는다 (해제 전 상태를 새로 만들어 본다)
  const fresh = await serverWithAccounts({ x: [MOLJA, 300, 410], y: [MOLJA, 480, 410] });
  const x = await Bot.enter(fresh.server, 'x', { id: fresh.ids.x });
  const y = await Bot.enter(fresh.server, 'y', { id: fresh.ids.y });
  await wait(150);
  x.send(`mate ask ${y.id}`);
  await y.until(() => y.lastEvent('mateask'), 1500);
  y.send(`mate yes ${x.id}`);
  await x.until(() => mates(x)?.p.length === 1, 1500);
  x.close();
  y.close();
  await wait(300);
  await fresh.server.stop();
  const again = await startServer({ dataDir: fresh.server.dataDir });
  const back = await Bot.enter(again, 'x', { id: fresh.ids.x });
  await back.until(() => mates(back), 1500);
  t.check('housemates survive a restart', mates(back).p[0]?.[0] === 'y');
  back.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ one: [MOLJA, 300, 410, { f21: 1 }], two: [MOLJA, 380, 410] });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await page.waitForFunction(() => zone === 1 && decorItems.length > 0, null, { timeout: 4000 });
    return page;
  };
  const one = await open('one'), two = await open('two');
  await one.evaluate((kind) => ws.send(`decor place ${kind} 200 400`), PLANT);
  await two.waitForFunction(() => decorItems.some((d) => d.info.k === 'tall_plant' && d.x === 200), null, { timeout: 3000 });

  // 우클릭 메뉴에서 동거인 신청
  const other = await one.evaluate(() => {
    const [cx, cy] = camera(innerWidth, innerHeight);
    for (const [id, e] of entities) if (id !== myId) return [e.x - cx, e.y - bodyLift(e) - cy];
  });
  await one.mouse.click(other[0], other[1], { button: 'right' });
  t.check('the player menu offers housemates', (await one.textContent('#player-mate')).includes('동거인 신청'));
  await one.click('#player-mate');
  await two.waitForSelector('#notice-layer:not([hidden])', { timeout: 3000 });
  t.check('the other side is asked', (await two.textContent('#notice-text')).includes('one'));
  await two.click('#notice-yes');
  await one.waitForFunction(() => myMates.length === 1, null, { timeout: 3000 });
  await two.keyboard.press('KeyI');
  await two.click('#bag-tab-mates');
  t.check('the bag lists housemates', (await two.textContent('#bag-mate-list')).includes('one'));

  // 옮기기 모드: 동거인의 화분을 집어 다른 곳에 놓는다
  await two.click('#bag-tab-furn');
  await two.click('#decor-move');
  const [from, to] = await two.evaluate(() => {
    const [cx, cy] = camera(innerWidth, innerHeight);
    const d = decorItems.find((x) => x.info.k === 'tall_plant' && x.mate);
    return [[d.x - cx, d.y - 30 - cy], [600 - cx, 320 - cy]];
  });
  await two.mouse.click(...from);
  t.check('clicking picks the furniture up', await two.evaluate(() => moveItem?.info.k === 'tall_plant'));
  await two.mouse.move(...to);
  await wait(100);
  await two.screenshot({ path: shot('decor_move.png') });
  await two.mouse.click(...to);
  await one.waitForFunction(() => decorItems.some((d) => d.info.k === 'tall_plant' && d.own && d.x === 600), null, { timeout: 3000 });
  t.check('the furniture moves for everyone', true);

  // 크기 모드: 가구를 눌러 고르고 + 버튼과 막대로 키운다
  await two.click('#decor-size');
  const plant = await two.evaluate(() => {
    const [cx, cy] = camera(innerWidth, innerHeight);
    const d = decorItems.find((x) => x.info.k === 'tall_plant' && x.x === 600);
    return [d.x - cx, d.y - 30 - cy];
  });
  await two.mouse.click(...plant);
  await two.waitForSelector('#decor-size-row:not([hidden])', { timeout: 2000 });
  t.check('picking a piece shows its size range', (await two.evaluate(() => [decorSizeRange.min, decorSizeRange.max, decorSizeVal.textContent].join())) === '60,160,100%');
  await two.click('#decor-size-up');
  await one.waitForFunction(() => decorItems.some((d) => d.info.k === 'tall_plant' && d.x === 600 && d.scale === 105), null, { timeout: 3000 });
  t.check('the + button makes it bigger for everyone', true);
  await wait(300);
  await two.evaluate(() => {
    decorSizeRange.value = '150';
    decorSizeRange.dispatchEvent(new Event('input'));
    decorSizeRange.dispatchEvent(new Event('change'));
  });
  await one.waitForFunction(() => decorItems.some((d) => d.info.k === 'tall_plant' && d.x === 600 && d.scale === 150), null, { timeout: 3000 });
  const grown = await one.evaluate(() => {
    const d = decorItems.find((x) => x.info.k === 'tall_plant' && x.x === 600);
    return [itemBounds(d).h / spriteBounds('tall_plant').h, terrain.solidsByZone[zone].some((s) => Math.abs((s[3] - s[1]) - d.info.hw * 3) < 0.5)];
  });
  t.check('a bigger piece is drawn and blocks bigger', Math.abs(grown[0] - 1.5) < 0.01 && grown[1], JSON.stringify(grown));
  await wait(900);
  await two.screenshot({ path: shot('decor_size.png') });
  const problems = [...one.problems, ...two.problems];
  t.check('no script errors', problems.length === 0, problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t)]);
}
