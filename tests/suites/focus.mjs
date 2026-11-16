// 함께 집중: 모임 만들기와 모집 알림(같은 곳·친구), 참가, 방장만 시작, 같은 타이머, 도중 참가, 끊겼다 돌아오기,
// 끝났을 때의 알림과 기록, 일찍 끝내기, 방장 넘기기, 방장이 나가면 해체, 모임이 사라지는 때.
// 화면: 오른쪽 위 「집중」 버튼과 창, 모집 알림창, 남은 시간(창·화면 위 표시·탭 제목), 머리 위 표시, 끝 알림
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const RARA = 2;
const MINUTE = 2;   // 시험에서는 1분이 2초
const env = { MMO_FOCUS_MINUTE_SEC: String(MINUTE) };
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const last = (bot, type) => bot.events.filter((e) => e.t === type).at(-1);
const count = (bot, type) => bot.events.filter((e) => e.t === type).length;
const room = (bot) => last(bot, 'focus');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({ a: [RARA, 200, 230], b: [RARA, 260, 230], c: [0, 820, 620], d: [0, 870, 620] }, { env });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a');
  let b = await enter('b');
  const c = await enter('c');
  const d = await enter('d');
  a.send(`friend ask ${d.id}`);
  await d.until(() => count(d, 'friendask') > 0, 1000);
  d.send('friend yes 0');
  await a.until(() => last(a, 'friends')?.p.length === 1, 1000);

  // ---- 모임 만들기와 모집
  a.send('focus open 0');
  a.send('focus open 999');
  await a.until(() => says(a, '1분부터'), 1000);
  t.check('minutes outside 1 to 180 are refused', !room(a));
  a.send('focus open 2');
  await a.until(() => room(a)?.id > 0, 1000);
  const id = room(a).id;
  t.check('opening a room makes me its host', room(a).host === 1 && room(a).min === 2 && room(a).run === 0 && JSON.stringify(room(a).m) === '[["a",1]]', JSON.stringify(room(a)));
  await wait(150);
  t.check('people in the same place and online friends are invited', last(b, 'focusinv')?.id === id && last(d, 'focusinv')?.n === 'a' && last(d, 'focusinv')?.min === 2 && !last(c, 'focusinv'));
  for (const bot of [c, d]) bot.send('focus list');
  await d.until(() => last(d, 'focuslist'), 1000);
  await wait(100);
  t.check('the list shows only rooms I may join', last(d, 'focuslist').r.length === 1 && last(d, 'focuslist').r[0][0] === id && last(c, 'focuslist').r.length === 0, JSON.stringify(last(d, 'focuslist')));
  c.send(`focus join ${id}`);
  await c.until(() => says(c, '없어졌어요'), 1000);
  t.check('a stranger elsewhere cannot join', !room(c));
  b.send(`focus join ${id}`);
  await b.until(() => room(b)?.id === id, 1000);
  await a.until(() => room(a).m.length === 2, 1000);
  t.check('joining shows everyone the members', room(b).host === 0 && JSON.stringify(room(a).m) === '[["a",1],["b",1]]' && says(a, 'b님이 집중 모임에 들어왔어요'));
  b.send('focus open 5');
  b.send('focus start');
  await b.until(() => says(b, '방장만'), 1000);
  t.check('only the host starts, and one room at a time', says(b, '이미 집중 모임') && room(a).run === 0);

  // ---- 타이머
  a.send('focus mins 3');
  await b.until(() => room(b).min === 3, 1000);
  a.send('focus start 2');
  await b.until(() => room(b).run === 1, 1000);
  t.check('starting gives everyone the same timer', room(a).run === 1 && room(b).min === 2 && Math.abs(room(b).left - 2 * MINUTE) < 0.3 && says(b, '2분 집중을 시작'), JSON.stringify(room(b)));
  await wait(150);
  const seen = a.others;
  t.check('others see who is focusing', seen.find((p) => p.id === a.id)?.fc === 1 && seen.find((p) => p.id === b.id)?.fc === 1 && !c.others.find((p) => p.id === c.id)?.fc);
  d.send(`focus join ${id}`);
  await d.until(() => room(d)?.run === 1, 1000);
  t.check('a friend can join while it runs', room(d).m.length === 3 && room(d).left < 2 * MINUTE);
  b.close();   // 끊겼다가 돌아온다
  await a.until(() => room(a).m[1][1] === 0, 1000);
  t.check('a dropped member keeps their place', room(a).m.length === 3);
  b = await enter('b');
  await b.until(() => room(b)?.run === 1, 1000);
  t.check('coming back resumes the running timer', room(b).id === id && room(b).left > 0 && room(b).left < 2 * MINUTE && room(a).m[1][1] === 1, JSON.stringify(room(b)));

  await a.until(() => last(a, 'focusdone'), 5000);
  await wait(150);
  t.check('everyone is told when it ends', [a, b, d].every((bot) => last(bot, 'focusdone')?.cut === 0 && last(bot, 'focusdone').min === 2 && last(bot, 'focusdone').c === 3) && !last(c, 'focusdone'));
  t.check('time is credited from when each joined', last(a, 'focusdone').mine === 2 && last(d, 'focusdone').mine <= 2, JSON.stringify([last(a, 'focusdone'), last(d, 'focusdone')]));
  t.check('the room stays for another round', room(a).run === 0 && room(a).m.length === 3 && !a.others.find((p) => p.id === a.id)?.fc);
  a.send('stats');
  await a.until(() => last(a, 'stats'), 1000);
  t.check('focus time is kept in the profile', last(a, 'stats').s[18] === 2 && last(a, 'stats').s[19] === 1, JSON.stringify(last(a, 'stats').s));

  // ---- 일찍 끝내기, 나가기
  await wait(600);
  a.send('focus start 5');
  await d.until(() => room(d).run === 1, 1000);
  const before = count(d, 'focusdone');
  d.send('focus stop');
  await wait(150);
  a.send('focus stop');
  await d.until(() => count(d, 'focusdone') > before, 1000);
  t.check('the host can end it early', last(d, 'focusdone').cut === 1 && room(d).run === 0 && says(d, '방장만'));
  // ---- 방장 넘기기
  await wait(300);
  a.send('focus host 1');
  await b.until(() => room(b).host === 1, 1000);
  t.check('the host can pass the room to another member', room(a).host === 0 && JSON.stringify(room(b).m) === '[["b",1],["a",1],["d",1]]' && says(d, 'a님이 b님에게 방장을 넘겼어요'), JSON.stringify(room(b)));
  await wait(300);
  a.send('focus host 1');
  await wait(200);
  t.check('only the host can pass it on', room(b).host === 1 && room(a).host === 0);
  d.send('focus leave');
  await b.until(() => room(b).m.length === 2, 1000);
  t.check('a member leaving keeps the room going', room(d).id === 0 && JSON.stringify(room(b).m) === '[["b",1],["a",1]]' && says(b, 'd님이 집중 모임에서 나갔어요'), JSON.stringify(room(b)));

  // ---- 방장이 나가면 모임이 해체된다
  await wait(300);
  b.send('focus leave');
  await a.until(() => room(a).id === 0, 1000);
  t.check('when the host leaves, the room is disbanded', room(a).id === 0 && room(b).id === 0 && says(a, '해체'), JSON.stringify(room(a)));
  await wait(300);
  a.send('focus list');
  await a.until(() => last(a, 'focuslist'), 1000);
  t.check('an empty room disappears', last(a, 'focuslist').r.length === 0);

  for (const bot of [a, b, c, d]) bot.close();
  await wait(100);
  await server.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({ alice: [RARA, 200, 230], bob: [RARA, 260, 230] }, { env });
  const browser = await launchBrowser();
  const alice = await enterGame(browser, server, ids.alice, { name: 'alice' });
  const bob = await enterGame(browser, server, ids.bob, { name: 'bob' });
  const aliceId = await alice.evaluate(() => myId);
  const title = await alice.title();

  await alice.click('#focus-open');
  t.check('the focus button opens the window', await alice.isVisible('#focus') && await alice.isVisible('#focus-make') && !(await alice.isVisible('#focus-start')) && !(await alice.isVisible('#focus-clock')));
  await alice.click('#focus-set [data-min="50"]');
  await alice.click('#focus-make');
  await alice.waitForSelector('#focus-members li');
  t.check('making a room lists me as host', (await alice.textContent('#focus-members')).includes('alice') && (await alice.textContent('#focus-members')).includes('방장') && await alice.isVisible('#focus-start') && !(await alice.isVisible('#focus-make')));
  await bob.waitForSelector('#notice:visible');
  t.check('the other player gets an invitation', (await bob.textContent('#notice-text')).includes('alice님이 50분'), await bob.textContent('#notice-text'));
  await bob.screenshot({ path: path.join(SHOTS, 'focus_invite.png') });
  await bob.click('#notice-yes');
  await bob.waitForSelector('#focus:visible');
  await alice.waitForFunction(() => document.querySelectorAll('#focus-members li').length === 2);
  t.check('accepting opens the room for the guest', (await bob.$$('#focus-members li')).length === 2 && !(await bob.isVisible('#focus-start')) && await bob.isVisible('#focus-leave') && await bob.isDisabled('#focus-min') && (await bob.inputValue('#focus-min')) === '50');
  await alice.screenshot({ path: path.join(SHOTS, 'focus_lobby.png') });

  await alice.fill('#focus-min', '1');
  await alice.press('#focus-min', 'Enter');
  await bob.waitForFunction(() => document.getElementById('focus-min').value === '1');
  await alice.click('#focus-start');
  await bob.waitForSelector('#focus-clock:visible');
  await wait(600);
  t.check('both see the countdown', /^00:0[0-2]$/.test(await bob.textContent('#focus-left')) && await alice.isVisible('#focus-clock') && !(await alice.isVisible('#focus-set')) && await alice.isVisible('#focus-stop') && !(await bob.isVisible('#focus-stop')), await bob.textContent('#focus-left'));
  t.check('the tab title counts down', (await bob.title()).startsWith('⏱ 00:0'), await bob.title());
  t.check('a badge marks who is focusing', await bob.evaluate((who) => entities.get(who)?.focus === true, aliceId));
  await bob.click('#focus-close');
  await wait(600);
  t.check('closing the window leaves the time on screen', await bob.isVisible('#focus-chip') && (await bob.textContent('#focus-chip')).includes('집중하는 중'));
  await bob.screenshot({ path: path.join(SHOTS, 'focus_running.png') });

  await bob.waitForFunction(() => document.getElementById('notice-title').textContent === '집중 끝' && !document.getElementById('notice-layer').hidden, null, { timeout: 4000 });
  t.check('the end is announced', (await bob.textContent('#notice-text')).includes('1분 집중을 마쳤어요') && (await bob.textContent('#chat-log')).includes('끝까지 해냈어요'));
  await bob.screenshot({ path: path.join(SHOTS, 'focus_done.png') });
  await bob.click('#notice-yes');
  await wait(700);
  t.check('afterwards the title and badge go back', (await bob.title()) === title && !(await bob.evaluate((who) => entities.get(who)?.focus, aliceId)) && (await bob.textContent('#focus-chip')).includes('모으는 중'), await bob.title());
  await alice.click('#notice-yes');
  t.check('the host sees a button to pass the room on, and the leave button says it disbands', await alice.isVisible('#focus-members .focus-pass') && (await alice.textContent('#focus-leave')) === '모임 해체하기' && !(await bob.isVisible('#focus-members .focus-pass')));
  await alice.click('#focus-members .focus-pass');
  await bob.waitForFunction(() => focusRoom?.host === 1);
  await bob.click('#focus-open');   // 아까 창을 닫아 두었다
  await bob.waitForSelector('#focus-start:visible', { timeout: 2000 }).catch(() => {});
  t.check('clicking it makes the other person host', await bob.isVisible('#focus-start') && !(await alice.isVisible('#focus-start')) && (await alice.textContent('#focus-leave')) === '모임 나가기');
  await alice.click('#focus-leave');
  await alice.waitForSelector('#focus-make:visible');
  await alice.waitForFunction(() => document.querySelectorAll('#focus-rooms .friend-row').length === 1, null, { timeout: 7000 });
  t.check('a room I left shows up as joinable', (await alice.textContent('#focus-rooms')).includes('bob님의 모임'));
  await alice.click('#focus-rooms .rbtn');
  await alice.waitForFunction(() => document.querySelectorAll('#focus-members li').length === 2);
  t.check('and can be joined from the list', (await alice.textContent('#focus-members li')).includes('bob'));
  await bob.click('#focus-leave');
  await bob.waitForFunction(() => document.getElementById('notice-title').textContent === '모임 해체' && !document.getElementById('notice-layer').hidden, null, { timeout: 3000 });
  await bob.screenshot({ path: path.join(SHOTS, 'focus_disband.png') });
  await bob.click('#notice-yes');
  await alice.waitForSelector('#focus-make:visible', { timeout: 3000 }).catch(() => {});
  await bob.waitForSelector('#focus-make:visible', { timeout: 3000 }).catch(() => {});
  t.check('the host confirms, and the room is gone for everyone', await alice.isVisible('#focus-make') && await bob.isVisible('#focus-make') && (await alice.textContent('#chat-log')).includes('해체'));

  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
