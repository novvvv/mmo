// 머리 위 광고판: 프로토콜, 저장, 실제 Chrome 의 아이템창 조작과 그림
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  Bot, enterGame, enterPage, launchBrowser, loginPage, pageSelf, pageWalkTo, SHOTS, startServer, uniqueId, wait,
} from '../lib.mjs';

const shot = (name) => path.join(SHOTS, name);
const boardEvents = (bot) => bot.events.filter((e) => e.t === 'board');
const lastShown = (bot, id) => boardEvents(bot).filter((e) => e.id === id).at(-1)?.m;
const mine = (bot) => bot.lastEvent('myboard');
const tooFast = (bot) => bot.events.filter((e) => e.t === 'sys' && e.m.includes('너무 빠르게')).length;
const rest = () => wait(1100);  // 메시지 토큰이 하나 회복되는 시간

// 명령을 보내고 서버의 확인 응답까지 기다린다.
async function apply(bot, command) {
  const count = () => bot.events.filter((e) => e.t === 'myboard').length;
  const before = count();
  bot.send(command);
  await bot.until(() => count() > before, 1000);
  await wait(60);  // 다른 봇에게도 도착할 시간
}

async function protocol(t) {
  const server = await startServer();
  const accountA = uniqueId('board');
  const a = await Bot.enter(server, '광고주', { id: accountA });
  const b = await Bot.enter(server, '구경꾼');
  await a.until(() => mine(a) && a.lastEvent('boards'), 1000);

  t.check('new account starts with the board off', mine(a)?.on === false && mine(a)?.m === '', JSON.stringify(mine(a)));
  t.check('nobody has a board yet', a.lastEvent('boards')?.p.length === 0, JSON.stringify(a.lastEvent('boards')));

  // ---- 켜기
  const text = '같이 낚시할 사람';
  await apply(a, `board 1 ${text}`);
  t.check('everyone receives the board', lastShown(b, a.id) === text, lastShown(b, a.id));
  t.check('owner receives it too', lastShown(a, a.id) === text, lastShown(a, a.id));
  t.check('owner gets the saved state', mine(a).on === true && mine(a).m === text, JSON.stringify(mine(a)));

  await wait(100);
  const entry = b.others.find((p) => p.id === a.id);
  t.check('board text is not repeated in every state update', entry && !JSON.stringify(entry).includes('낚시'), JSON.stringify(entry));

  const late = await Bot.enter(server, '늦게옴');
  await late.until(() => late.lastEvent('boards'), 1000);
  t.check('late joiner receives current boards', JSON.stringify(late.lastEvent('boards').p) === JSON.stringify([[a.id, text, 0]]), JSON.stringify(late.lastEvent('boards')));
  late.close();

  // ---- 문구 정리
  await rest();
  const tricky = '"따옴표" \\ <b>x</b> 😀';
  await apply(a, `board 1 ${tricky}`);
  t.check('special characters survive as valid JSON', lastShown(b, a.id) === tricky, lastShown(b, a.id));

  await rest();
  const encode = (s) => new TextEncoder().encode(s);
  a.ws.send(new Uint8Array([...encode('board 1 bad'), 0xff, 0xc0, 0x80, 0x0a, 0x09, 0x22, ...encode('end')]));
  await a.until(() => mine(a).m.startsWith('bad'), 1000);
  await wait(60);
  t.check('invalid UTF-8 and control chars removed', lastShown(b, a.id) === 'bad"end', lastShown(b, a.id));

  await rest();
  await apply(a, `board 1 ${'가'.repeat(100)}`);
  t.check('long text capped at 30 chars', Array.from(lastShown(b, a.id)).length === 30, Array.from(lastShown(b, a.id)).length);

  await rest();
  await apply(a, 'board 1      ');
  t.check('blank text turns the board off', lastShown(b, a.id) === '' && mine(a).on === false && mine(a).m === '', JSON.stringify(mine(a)));

  // ---- 잘못된 명령은 무시
  const beforeBad = a.events.length + boardEvents(b).length;
  for (const bad of ['board', 'board 2 x', 'board 1x', 'board x y', 'board  y']) a.send(bad);
  await wait(150);
  t.check('malformed commands are ignored', a.events.length + boardEvents(b).length === beforeBad, a.events.slice(-3).map((e) => JSON.stringify(e)).join());
  t.check('sender stays connected', !a.closed);

  // ---- 끄기, 꺼 둔 채 고치기
  await rest();
  const kept = '꺼도 남는 문구';
  await apply(a, `board 1 ${kept}`);
  await rest();
  await apply(a, `board 0 ${kept}`);
  t.check('switching off hides it from everyone', lastShown(b, a.id) === '', lastShown(b, a.id));
  t.check('switching off keeps the text', mine(a).on === false && mine(a).m === kept, JSON.stringify(mine(a)));

  await rest();
  const shownBefore = boardEvents(b).length;
  await apply(a, 'board 0 몰래 고친 문구');
  t.check('editing while off stays private', boardEvents(b).length === shownBefore && mine(a).m === '몰래 고친 문구', boardEvents(b).length - shownBefore);

  const warnedBefore = tooFast(a);
  for (let i = 0; i < 20; i++) a.send('board 0 몰래 고친 문구');
  await wait(150);
  t.check('repeating the same state costs nothing', tooFast(a) === warnedBefore && boardEvents(b).length === shownBefore);

  // ---- 도배 제한: 거절돼도 내 화면의 상태는 서버와 같아야 한다
  await wait(5200);
  const delivered = boardEvents(b).length;
  for (let i = 0; i < 12; i++) a.send(`board 1 도배${i}`);
  await wait(200);
  const got = boardEvents(b).length - delivered;
  t.check('rate limit applies', got <= 6 && tooFast(a) - warnedBefore >= 6, `delivered=${got} warned=${tooFast(a) - warnedBefore}`);
  t.check('rejected change reports the real state', mine(a).m === lastShown(b, a.id), `${mine(a).m} vs ${lastShown(b, a.id)}`);

  // ---- 입장 전에는 쓸 수 없다
  const early = await Bot.connect(server);
  await early.login(uniqueId('early'));
  early.send('board 1 입장 전');
  await wait(100);
  t.check('board needs a joined character', !early.events.some((e) => e.t === 'myboard'));
  early.close();

  // ---- 나가면 사라지고, 다시 들어오면 돌아온다
  await wait(5200);
  const saved = 'a=b  "c" \\d 저장';
  await apply(a, `board 1 ${saved}`);
  const oldId = a.id;
  a.close();
  await b.until(() => lastShown(b, oldId) === '', 1000);
  t.check('leaving removes the board', lastShown(b, oldId) === '', lastShown(b, oldId));

  const a2 = await Bot.enter(server, '광고주', { id: accountA });
  await a2.until(() => mine(a2), 1000);
  t.check('board is restored on login', mine(a2)?.on === true && mine(a2)?.m === saved, JSON.stringify(mine(a2)));
  await b.until(() => lastShown(b, a2.id) === saved, 1000);
  t.check('others see the restored board', lastShown(b, a2.id) === saved, lastShown(b, a2.id));

  // ---- 다른 곳에서 로그인하면 이전 연결의 광고판은 사라진다
  const a3 = await Bot.connect(server);
  await a3.login(accountA);
  await b.until(() => lastShown(b, a2.id) === '', 1000);
  t.check('kicked session loses its board', lastShown(b, a2.id) === '', lastShown(b, a2.id));
  await a3.join({ nick: '광고주' });
  await b.until(() => lastShown(b, a3.id) === saved, 1000);
  t.check('new session shows it again', lastShown(b, a3.id) === saved, lastShown(b, a3.id));

  // ---- 꺼 둔 상태도 그대로 저장된다
  await a3.until(() => mine(a3), 1000);
  await wait(1100);
  await apply(a3, `board 0 ${saved}`);
  a3.close();
  await wait(150);
  const eventsBefore = boardEvents(b).length;
  const a4 = await Bot.enter(server, '광고주', { id: accountA });
  await a4.until(() => mine(a4), 1000);
  await wait(100);
  t.check('off state is restored', mine(a4)?.on === false && mine(a4)?.m === saved, JSON.stringify(mine(a4)));
  t.check('login with the board off announces nothing', boardEvents(b).length === eventsBefore, boardEvents(b).length - eventsBefore);

  // ---- 서버를 다시 시작해도 남는다
  await wait(1100);
  await apply(a4, `board 1 ${saved}`);
  b.close();
  a4.close();
  await wait(100);
  await server.stop();
  const restarted = await startServer({ dataDir: server.dataDir });
  const a5 = await Bot.enter(restarted, '광고주', { id: accountA });
  await a5.until(() => mine(a5), 1000);
  t.check('board survives a server restart', mine(a5)?.on === true && mine(a5)?.m === saved, JSON.stringify(mine(a5)));
  a5.close();
  await wait(100);
  await restarted.stop();

  // ---- 이 기능이 생기기 전에 만든 계정 파일도 그대로 읽힌다
  const file = path.join(server.dataDir, `${Buffer.from(accountA).toString('hex')}.acc`);
  const stored = readFileSync(file, 'utf8');
  t.check('account file stores the board', stored.includes('boardOn=1\n') && stored.includes(`board=${saved}\n`), stored);
  writeFileSync(file, stored.split('\n').filter((line) => !line.startsWith('board')).join('\n'));
  const legacy = await startServer({ dataDir: server.dataDir });
  const a6 = await Bot.enter(legacy, '광고주', { id: accountA });
  await a6.until(() => mine(a6), 1000);
  t.check('accounts from before the feature still log in', a6.me && mine(a6)?.on === false && mine(a6)?.m === '', JSON.stringify(mine(a6)));
  a6.close();
  await wait(100);
  await legacy.stop();
}

// 내 캐릭터 머리 위 영역에서 광고판 바탕색 픽셀 수를 센다.
const signPixels = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const [camX, camY] = camera(innerWidth, innerHeight);
    const dpr = window.devicePixelRatio || 1;
    const sx = (me.x - camX) * dpr, sy = (me.y - camY) * dpr;
    const data = ctx.getImageData(sx - 110 * dpr, sy - 140 * dpr, 220 * dpr, 120 * dpr).data;
    let cream = 0;
    for (let i = 0; i < data.length; i += 4) {  // 시작 위치가 무작위라 비슷한 색의 카페 파라솔과 구분되도록 #fff8e7 만 센다
      if (Math.abs(data[i] - 255) <= 1 && Math.abs(data[i + 1] - 248) <= 1 && Math.abs(data[i + 2] - 231) <= 1) cream++;
    }
    resolve(cream);
  }));
}));

const switchOn = (page) => page.isChecked('#board-on');
const boardValue = (page) => page.inputValue('#board-text');
const shownLines = (page, id) => page.evaluate((who) => boards.get(who)?.lines.join(' '), id);
const myIdOf = (page) => page.evaluate(() => myId);

async function ui(t) {
  const server = await startServer();
  const browser = await launchBrowser();
  const id = uniqueId('boardui');
  const page = await enterGame(browser, server, id, { name: '광고주', look: { arms: 1, legs: 1, limbColor: 0 } });
  const friend = await enterGame(browser, server, uniqueId('friend'), { name: '친구', look: { arms: 0, legs: 0, limbColor: 0 } });
  const pageId = await myIdOf(page);
  await page.keyboard.press('KeyI');
  await friend.keyboard.press('KeyI');
  await wait(200);

  t.check('item window shows the board control', await page.isVisible('#board-on') !== null && await page.isVisible('#board-text'));
  t.check('board starts off with no sign drawn', !(await switchOn(page)) && (await signPixels(page)) === 0);
  t.check('item slots show in the item window', (await page.$$('.bag-slot')).length === 48);

  // 문구 없이 켜면 입력부터 받는다
  await page.click('#board-on');
  await wait(100);
  t.check('switching on without text asks for text', !(await switchOn(page)) && await page.evaluate(() => document.activeElement === boardInput));

  // 입력 중의 글자는 게임 조작이 아니다
  const before = await pageSelf(page);
  await page.keyboard.type('wasd efcx');
  await wait(250);
  const during = await pageSelf(page);
  t.check('typing in the item window does not move', Math.hypot(during.x - before.x, during.y - before.y) < 1 && during.seat === 0 && during.fish === 0, JSON.stringify(during));
  t.check('letters reach the board input', (await boardValue(page)) === 'wasd efcx');

  // Esc 는 고치던 글자를 버린다
  await page.keyboard.press('Escape');
  await wait(100);
  t.check('Esc discards the edit', (await boardValue(page)) === '' && !(await switchOn(page)));
  t.check('Esc returns the keyboard to the game', await page.evaluate(() => document.activeElement === document.body));

  // Enter 로 바로 띄운다
  await page.fill('#board-text', '  같이 낚시 하실 분  ');
  await page.press('#board-text', 'Enter');
  await page.waitForFunction(() => boards.has(myId), null, { timeout: 2000 });
  t.check('Enter puts the text up and turns the switch on', (await switchOn(page)) && (await boardValue(page)) === '같이 낚시 하실 분');
  t.check('sign is drawn above my head', (await signPixels(page)) > 400, await signPixels(page));
  await friend.waitForFunction((who) => boards.has(who), pageId, { timeout: 2000 });
  t.check('friend sees the sign', (await shownLines(friend, pageId)) === '같이 낚시 하실 분', await shownLines(friend, pageId));

  await page.keyboard.down('KeyD');
  await wait(300);
  await page.keyboard.up('KeyD');
  await wait(100);
  t.check('keyboard moves the character after Enter', (await pageSelf(page)).x > during.x + 20, JSON.stringify(await pageSelf(page)));

  // 스위치로 끄고 켜기
  await page.click('#board-on');
  await page.waitForFunction(() => !boards.has(myId), null, { timeout: 2000 });
  t.check('switch off removes the sign', (await signPixels(page)) === 0, await signPixels(page));
  t.check('switch off keeps the text in the box', (await boardValue(page)) === '같이 낚시 하실 분');
  await friend.waitForFunction((who) => !boards.has(who), pageId, { timeout: 2000 });
  t.check('friend no longer sees it', (await shownLines(friend, pageId)) === undefined);
  t.check('keyboard stays with the game after clicking the switch', await page.evaluate(() => document.activeElement === document.body));

  await wait(1100);
  await page.click('#board-on');
  await page.waitForFunction(() => boards.has(myId), null, { timeout: 2000 });
  t.check('switch on brings the same text back', (await shownLines(page, pageId)) === '같이 낚시 하실 분' && (await switchOn(page)));

  // 다른 곳을 눌러 빠져나가도 고친 문구가 적용된다
  await wait(1100);
  await page.fill('#board-text', '바꾼 문구');
  await page.mouse.click(500, 300);
  await page.waitForFunction(() => boards.get(myId)?.lines[0] === '바꾼 문구', null, { timeout: 2000 });
  t.check('clicking away applies the edit', await page.evaluate(() => document.activeElement === document.body));

  // 문구를 지우면 꺼진다
  await wait(1100);
  await page.fill('#board-text', '');
  await page.press('#board-text', 'Enter');
  await page.waitForFunction(() => !boards.has(myId), null, { timeout: 2000 });
  t.check('clearing the text turns it off', !(await switchOn(page)));

  // 줄바꿈과 크기
  const layout = (text) => page.evaluate((s) => { const b = layoutBoard(s); return { lines: b.lines, w: b.w, h: b.h }; }, text);
  const hangul = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허기니';
  const wrapped = await layout(hangul);
  t.check('long Korean text wraps without losing characters', wrapped.lines.join('') === hangul && wrapped.lines.length <= 3 && wrapped.w <= 190, JSON.stringify(wrapped));
  const spaced = await layout('오늘 저녁 카페 테라스에서 다같이 수다 떨어요');
  t.check('wraps at spaces when it can', spaced.lines.length >= 2 && spaced.lines.every((l) => !l.startsWith(' ') && !l.endsWith(' ')) && spaced.lines.join(' ') === '오늘 저녁 카페 테라스에서 다같이 수다 떨어요', JSON.stringify(spaced));
  const wide = await layout('W'.repeat(30));
  t.check('wide letters stay inside the sign', wide.lines.length <= 3 && wide.w <= 190, JSON.stringify(wide));
  const emoji = await layout('👨‍👩‍👧'.repeat(60));
  t.check('too long text ends with an ellipsis', emoji.lines.length === 3 && emoji.lines[2].endsWith('…') && emoji.w <= 190 && !emoji.lines.join('').includes('‍‍'), JSON.stringify(emoji));
  const tiny = await layout('가');
  t.check('one letter keeps room for the tail', tiny.w >= 36 && tiny.lines.length === 1, JSON.stringify(tiny));

  // ---- 벤치에 나란히: 말풍선은 광고판 위로 쌓이고, 광고판은 자리를 옮기지 않는다
  await wait(1100);
  await page.fill('#board-text', '오늘 저녁 낚시 대회 참가자 모집 중!');
  await page.press('#board-text', 'Enter');
  await friend.fill('#board-text', '랏라네 놀러오세요');
  await friend.press('#board-text', 'Enter');
  await page.waitForFunction(() => boards.size === 2, null, { timeout: 2000 });

  const bench = await page.evaluate(() => terrain.furn.find((f) => f.k === 'bench' && f.x === 605));
  await pageWalkTo(page, (await pageSelf(page)).x, 670, 14);
  await pageWalkTo(page, bench.x + 30, bench.y - 24, 8);
  await pageWalkTo(friend, (await pageSelf(friend)).x, 670, 14);
  await pageWalkTo(friend, bench.x - 30, bench.y - 24, 8);
  await page.keyboard.press('KeyE');
  await wait(200);
  await friend.keyboard.press('KeyE');
  await wait(500);

  const stack = () => page.evaluate(() => {
    const e = { ...entities.get(myId), id: myId, x: me.x, y: me.y };
    return { head: bodyTop(e) - NAME_CLEARANCE, stack: headStack(e), h: boards.get(myId)?.h };
  });
  const seated = await stack();
  t.check('chat bubble stacks above the sign', seated.stack === seated.head - seated.h - BOARD_TAIL_FOR_TEST - 3, JSON.stringify(seated));
  await page.keyboard.press('Enter');
  await page.keyboard.type('안녕하세요');
  await page.keyboard.press('Enter');
  await wait(300);
  await page.screenshot({ path: shot('board_bench.png'), clip: { x: 300, y: 170, width: 500, height: 280 } });
  await page.screenshot({ path: shot('board_full.png') });
  t.check('sign stays put while chatting', Math.abs((await stack()).stack - seated.stack) < 1, JSON.stringify([await stack(), seated]));

  // 밤에도 광고판은 어둠에 묻히지 않는다
  await page.evaluate(() => { clockSync = { phase: clockSync.len * 1.5, at: performance.now(), len: clockSync.len }; });
  await wait(300);
  await page.screenshot({ path: shot('board_night.png'), clip: { x: 300, y: 170, width: 500, height: 280 } });
  t.check('sign is drawn at night', (await signPixels(page)) > 400, await signPixels(page));
  await page.evaluate(() => { clockSync = { phase: 0, at: performance.now(), len: clockSync.len }; });

  // ---- 다시 접속해도 그대로, 다른 사람의 광고판도 다시 받는다
  await page.evaluate(() => { closeMessage = ''; clearResume(); ws.close(); });   // 로그아웃 (그냥 끊기면 화면을 두고 다시 잇는다)
  await page.waitForSelector('#auth:not([hidden])');
  t.check('logout clears everything', await page.evaluate(() => boards.size === 0 && !boardSwitch.checked && boardInput.value === ''));
  await loginPage(page, id);
  await enterPage(page, {});
  await page.waitForFunction(() => boards.size === 2 && boardSwitch.checked, null, { timeout: 2000 });
  t.check('reconnect restores the switch and text', (await boardValue(page)) === '오늘 저녁 낚시 대회 참가자 모집 중!');

  // ---- 좁은 화면
  const phone = await enterGame(browser, server, uniqueId('phone'), { viewport: { width: 390, height: 720 }, name: '폰' });
  await phone.keyboard.press('KeyI');
  await phone.fill('#board-text', '폰에서도 잘 보여요');
  await phone.press('#board-text', 'Enter');
  await phone.waitForFunction(() => boards.has(myId), null, { timeout: 2000 });
  await phone.screenshot({ path: shot('board_phone.png') });
  const fits = await phone.evaluate(() => {
    const g = document.getElementById('bag').getBoundingClientRect();
    const c = document.getElementById('chat').getBoundingClientRect();
    return g.left >= 0 && g.right <= innerWidth && g.bottom < c.top;
  });
  t.check('item window fits a phone', fits);

  t.check('no page errors', page.problems.length + friend.problems.length + phone.problems.length === 0, [...page.problems, ...friend.problems, ...phone.problems].join(' | '));
  await browser.close();
  await server.stop();
}

const BOARD_TAIL_FOR_TEST = 6;

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
