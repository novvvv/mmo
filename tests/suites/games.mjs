// 게임 가구(오목판, 다트판)와 집에 풀어놓는 펫
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageWalkTo, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2;
const DART_STAND = 46, OMOK = 47;
const shot = (name) => path.join(SHOTS, name);
const decor = (bot) => bot.lastEvent('decor');
const inv = (bot) => bot.lastEvent('inv');
const omok = (bot) => bot.lastEvent('omok');
const dart = (bot) => bot.lastEvent('dart');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const pause = () => wait(260);   // 행동 제한에 걸리지 않게
const at = (x, y) => y * 15 + x;

async function omokGame(t) {
  const { server, ids } = await serverWithAccounts({
    a: [MOLJA, 400, 320, { f47: 1, f46: 1 }], b: [MOLJA, 450, 320], c: [MOLJA, 480, 330], far: [MOLJA, 120, 400],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a'), b = await enter('b'), c = await enter('c'), far = await enter('far');
  await wait(150);
  t.check('the catalog sells game furniture', a.map.catalog[DART_STAND]?.k === 'dart_stand' && a.map.catalog[OMOK]?.k === 'omok_table');
  a.send('omok sit');
  await wait(200);
  t.check('no omok without a board', !omok(a));

  a.send(`decor place ${OMOK} 420 268`);
  await b.until(() => omok(b), 1500);
  t.check('placing a board brings omok to the room', omok(b)?.b.length === 225 && !omok(b).play);
  await pause();
  far.send('omok sit');
  await wait(200);
  t.check('you sit only next to the board', omok(far).p.every(([id]) => id !== far.id));
  a.send('omok sit');
  await a.until(() => omok(a).p[0][0] === a.id, 1500);
  await pause();
  b.send('omok sit');
  await a.until(() => omok(a).play, 1500);
  t.check('two seated players start a game', omok(a).p[1][0] === b.id && omok(a).turn === 1);
  // 관전: 같은 방이면 오목판에서 멀리 있어도 볼 수 있고, 이름이 관전자로 오른다
  far.send('omok watch');
  await a.until(() => omok(a).w?.includes('far'), 1500);
  t.check('anyone in the room can watch', omok(a).w.includes('far'));
  await pause();
  far.send('omok unwatch');
  await a.until(() => !omok(a).w.includes('far'), 1500);
  t.check('closing the board stops watching', true);
  await pause();
  a.send('omok watch');
  await wait(150);
  t.check('players are not listed as watchers', !omok(a).w.includes('a'));
  await pause();
  c.send('omok sit');
  await c.until(() => says(c, '판이 끝나면'), 1500);
  t.check('a third player waits', omok(c).p.every(([id]) => id !== c.id));

  b.send(`omok put ${at(0, 0)}`);
  await wait(150);
  t.check('only the player to move can play', omok(a).b[at(0, 0)] === '0');
  // 흑(a)이 가로로 다섯, 백(b)은 위쪽에
  for (let i = 0; i < 5; i++) {
    a.send(`omok put ${at(5 + i, 7)}`);
    await a.until(() => omok(a).b[at(5 + i, 7)] === '1', 1500);
    if (i === 0) {
      a.send(`omok put ${at(14, 14)}`);
      await wait(120);
      t.check('you cannot play twice in a row', omok(a).b[at(14, 14)] === '0' && omok(a).turn === 2);
      b.send(`omok put ${at(5, 7)}`);
      await wait(120);
      t.check('taken points stay taken', omok(a).b[at(5, 7)] === '1' && omok(a).turn === 2);
    }
    if (i < 4) {
      b.send(`omok put ${at(i, 0)}`);
      await a.until(() => omok(a).b[at(i, 0)] === '2', 1500);
    }
  }
  await a.until(() => !omok(a).play, 1500);
  t.check('five in a row wins', omok(a).win === 1 && omok(a).why === 'five' && says(c, '흑 a 승리'), JSON.stringify(omok(a)));
  await pause();
  b.send('omok again');
  await a.until(() => omok(a).play, 1500);
  t.check('another game swaps colours', omok(a).p[0][0] === b.id && omok(a).p[1][0] === a.id && omok(a).b === '0'.repeat(225));
  await pause();
  b.send('omok leave');
  await a.until(() => !omok(a).play, 1500);
  t.check('getting up mid-game resigns', omok(a).win === 2 && omok(a).why === 'resign' && omok(a).p[0][0] === 0);
  // 상태창의 전적: a 는 두 판을 이겼고 b 는 두 판을 졌다
  await pause();
  a.send('stats');
  await a.until(() => a.lastEvent('stats'), 1500);
  t.check('the profile counts omok wins', a.lastEvent('stats').s.slice(0, 3).join() === '2,0,0' && a.lastEvent('stats').self === true && a.lastEvent('stats').g >= 0, JSON.stringify(a.lastEvent('stats')));
  await pause();
  c.send(`stats ${b.id}`);
  await c.until(() => c.lastEvent('stats'), 1500);
  t.check('anyone can see losses too, but not the gold', c.lastEvent('stats').s.slice(0, 3).join() === '0,2,0' && c.lastEvent('stats').n === 'b' && c.lastEvent('stats').g === undefined, JSON.stringify(c.lastEvent('stats')));

  // ---- 집의 다트판
  await pause();
  a.send(`decor place ${DART_STAND} 600 340`);
  await b.until(() => dart(b), 1500);
  t.check('a dart stand brings darts to the house', dart(b).st === 0);
  await a.walkTo(600, 380, 10);
  await b.walkTo(560, 380, 10);
  a.send('dart new 2');
  await b.until(() => dart(b).st === 1, 1500);
  await pause();
  b.send('dart join');
  await a.until(() => dart(a).st === 2, 1500);
  t.check('two can play darts at home', dart(a).players.length === 2);
  await pause();
  a.send(`decor take ${decor(a).p.find((d) => d[1] === DART_STAND)[0]}`);
  await b.until(() => dart(b).st === 0, 1500);
  t.check('taking the stand ends the darts', dart(b).players.length === 0);
  await pause();
  a.send(`decor take ${decor(a).p.find((d) => d[1] === OMOK)[0]}`);
  await b.until(() => omok(b)?.off, 1500);
  t.check('taking the board ends omok', omok(b).off === true);
  a.close();
  await wait(250);
  const back = await Bot.enter(server, 'a', { id: ids.a });
  await wait(100);
  back.send('stats');
  await back.until(() => back.lastEvent('stats'), 1500);
  t.check('the record stays after reconnecting', back.lastEvent('stats').s[0] === 2);
  for (const bot of [back, b, c, far]) bot.close();
  await server.stop();
}

async function pets(t) {
  const { server, ids } = await serverWithAccounts({ owner: [MOLJA, 300, 380, { pets: 6, pet: 1 }], guest: [MOLJA, 480, 380], out: [0, 820, 620, { pets: 1 }] });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const owner = await enter('owner'), guest = await enter('guest'), out = await enter('out');
  await wait(150);
  const petsIn = (bot) => (bot.cats || []).filter((c) => c.length > 2);
  out.send('releasepet 0');
  await out.until(() => says(out, '집 안에만'), 1500);
  t.check('pets are released only in houses', inv(out)?.freed?.length ?? 0 === 0);
  owner.send('releasepet 1');
  await guest.until(() => petsIn(guest).some((c) => c[2] === 1), 2000);
  t.check('a released pet roams the house', petsIn(guest).some((c) => c[2] === 1));
  await owner.until(() => inv(owner)?.freed?.length === 1, 1500);
  t.check('it is no longer by my side', inv(owner).pet === -1 && JSON.stringify(inv(owner).freed) === JSON.stringify([[1, MOLJA]]));
  await pause();
  owner.send('releasepet 3');
  await wait(200);
  t.check('only owned pets can be released', inv(owner).freed.length === 1);
  owner.send('releasepet 2');
  await guest.until(() => petsIn(guest).length === 2, 2000);
  t.check('two pets can play at home', petsIn(guest).map((c) => c[2]).sort().join() === '1,2');
  // 쓰다듬기
  const roaming = guest.cats.findIndex((c) => c[2] === 1);
  await guest.walkTo(guest.cats[roaming][0], guest.cats[roaming][1] + 20, 24);
  guest.send('pet');
  await guest.until(() => guest.lastEvent('cat'), 1500);
  t.check('visitors can pet a released pet', guest.lastEvent('cat')?.act === 'pet');

  // 다시 켜도 집에 있다
  for (const bot of [owner, guest, out]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'owner', { id: ids.owner });
  await back.until(() => (back.cats || []).filter((c) => c.length > 2).length === 2, 2500);
  t.check('released pets stay after a restart', petsIn(back).length === 2);
  back.send('callpet 1');
  await back.until(() => inv(back)?.pet === 1, 1500);
  await back.until(() => petsIn(back).length === 1, 2000);
  t.check('calling a pet brings it back to my side', inv(back).freed.length === 1 && petsIn(back)[0][2] === 2);
  await pause();
  back.send('walkpet 2');
  await back.until(() => inv(back).pet === 2 && inv(back).freed.length === 0, 1500);
  t.check('walking with a released pet calls it back too', petsIn(back).length === 0 || await back.until(() => petsIn(back).length === 0, 2000) !== false);
  back.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ one: [MOLJA, 400, 320, { f47: 1, pets: 2, pet: 1 }], two: [MOLJA, 450, 320] });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await page.waitForFunction(() => zone === 1 && decorItems.length > 0, null, { timeout: 4000 });
    return page;
  };
  const one = await open('one'), two = await open('two');
  await one.click('#shop-open');
  t.check('game furniture is tagged in the shop', (await one.textContent('#furn-list')).includes('게임 · 오목') && (await one.textContent('#furn-list')).includes('게임 · 다트'));
  await one.click('#furn-close');

  await one.evaluate((kind) => ws.send(`decor place ${kind} 420 268`), OMOK);
  await one.waitForFunction(() => omokState !== null, null, { timeout: 3000 });
  await pageWalkTo(one, 440, 300, 8);   // 소파 자리보다 오목판이 가까운 곳
  t.check('E reaches the omok board', (await one.evaluate(() => actionHint({ ...entities.get(myId), x: me.x, y: me.y }))).includes('E: 오목'));
  await one.keyboard.press('KeyE');
  await one.click('#omok-sit');
  await two.waitForFunction(() => omokState?.p[0][0] > 0, null, { timeout: 3000 });
  await two.keyboard.press('KeyE');
  await two.click('#omok-sit');
  await one.waitForFunction(() => omokState?.play, null, { timeout: 3000 });
  t.check('my turn is announced', (await one.textContent('#omok-status')).includes('내 차례'));
  const box = await one.locator('#omok-board').boundingBox();
  const step = (box.width * (480 - 44) / 480) / 14, pad = box.width * 22 / 480;
  await one.mouse.click(box.x + pad + 7 * step, box.y + pad + 7 * step);
  await two.waitForFunction(() => omokState?.b[112] === '1', null, { timeout: 3000 });
  t.check('clicking the board places a stone for both', (await two.textContent('#omok-status')).includes('내 차례'));
  await two.click('#omok-close');
  t.check('a closed board leaves a chip to reopen it', await two.isVisible('#omok-chip'));
  await two.click('#omok-chip');
  t.check('the chip reopens the board', await two.isVisible('#omok'));
  await one.click('#profile-open');
  await one.waitForSelector('#profile:not([hidden])', { timeout: 2000 });
  t.check('the profile window shows the omok record', (await one.textContent('#profile-stats')).includes('오목') && (await one.textContent('#profile-name')) === 'one');
  await one.click('#profile-close');
  await one.screenshot({ path: shot('omok.png') });
  await one.keyboard.press('Escape');

  // 펫 풀어놓기
  await one.keyboard.press('KeyI');
  await one.click('#bag-tab-pets');
  t.check('the pet tab offers releasing here', (await one.textContent('#pet-free')) === '이 집에 풀어놓기' && !(await one.isDisabled('#pet-free')));
  await one.click('#pet-free');
  await two.waitForFunction(() => cats.some((c) => c.coat === PET_KINDS[1]), null, { timeout: 3000 });
  t.check('the released pet shows to others', true);
  await one.waitForFunction(() => document.getElementById('bag-pet-list').textContent.includes('노는 중'), null, { timeout: 2000 });
  t.check('the bag says where it plays', (await one.textContent('#pet-walk')) === '불러오기');
  await wait(300);
  await two.screenshot({ path: shot('pet_released.png') });
  const problems = [...one.problems, ...two.problems];
  t.check('no script errors', problems.length === 0, problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([omokGame(t), pets(t), browser(t)]);
}
