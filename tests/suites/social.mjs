// 친구와 할 일: 신청(접속 중·이름으로·접속하지 않은 사람), 수락과 거절, 끊기, 할 일 적기·고치기·지우기·공개,
// 날짜별 할 일(옮기기, 순서 바꾸기, 그날의 다 한 일 지우기, 예전 형식), 친구 목록의 오늘 진행, 친구의 할 일 보기(바로 바뀜), 저장, 집마다의 방명록(쓰기·지우기·알림·저장).
// 화면: 오른쪽 위 픽셀 아이콘 버튼과 빨간 N, 가운데 알림창, 친구 창, 달력이 있는 할 일 공책(끌어서 순서 바꾸기, 달력에 놓기)과 친구 탭, 방명록, 창 테마
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageWalkTo, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const RARA = 2;
const shot = (name) => path.join(SHOTS, name);
const pause = () => wait(150);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const last = (bot, type, pick = () => true) => bot.events.filter((e) => e.t === type && pick(e)).at(-1);
const count = (bot, type) => bot.events.filter((e) => e.t === type).length;
const DAY = 20261111, NEXT = 20261112;   // 할 일을 적는 날짜 (yyyymmdd)

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [RARA, 200, 230], b: [RARA, 260, 230], c: [0, 820, 620], d: [0, 870, 620], old: [0, 920, 620, { todo: '1옛날에 적은 일\t0아직 남은 일' }],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  // c 와 d 를 한 번 들여보내 이름을 계정에 남기고 내보낸다
  for (const name of ['c', 'd']) (await enter(name)).close();
  await wait(150);
  let a = await enter('a');
  const b = await enter('b');
  t.check('you start with an empty to-do list and no friends', last(a, 'todo').own === 1 && last(a, 'todo').i.length === 0 && last(a, 'friends').p.length === 0);

  // ---- 할 일
  for (const line of [`todo add ${DAY} 장보기`, `todo add ${DAY} 운동 30분`, `todo add ${DAY} ${'긴'.repeat(60)}`, `todo add ${DAY}    `, 'todo add 19990101 옛날', 'todo add 숫자없음', 'todo done 0']) {
    const before = count(a, 'todo');
    a.send(line);
    await a.until(() => count(a, 'todo') > before, 600).catch(() => {});
    await wait(200);   // 행동 제한(초당 4번)을 넘지 않게
  }
  const mine = last(a, 'todo');
  t.check('to-dos are added to a date, ticked, and capped at 40 characters', mine.i.length === 3 && mine.i[0][0] === '장보기' && mine.i[0][1] === 1 && mine.i[0][2] === DAY && mine.i[1][1] === 0 && [...mine.i[2][0]].length === 40, JSON.stringify(mine.i));
  a.send('todo edit 2 숙제');
  a.send('todo del 1');
  await a.until(() => last(a, 'todo').i.length === 2, 1500);
  t.check('a to-do can be renamed and deleted', JSON.stringify(last(a, 'todo').i) === `[["장보기",1,${DAY}],["숙제",0,${DAY}]]`, JSON.stringify(last(a, 'todo').i));
  await pause();
  for (const line of [`todo add ${NEXT} 내일 할 일`, 'todo done 2', `todo clear ${DAY}`]) {
    const before = count(a, 'todo');
    a.send(line);
    await a.until(() => count(a, 'todo') > before, 600).catch(() => {});
    await wait(200);   // 행동 제한(초당 4번)을 넘지 않게
  }
  t.check('clearing finished work only touches that day', JSON.stringify(last(a, 'todo').i) === `[["숙제",0,${DAY}],["내일 할 일",1,${NEXT}]]`, JSON.stringify(last(a, 'todo').i));
  for (const line of ['todo done 1', `todo date 1 ${DAY}`, `todo add ${DAY} 장보기`, 'todo done 2']) {
    const before = count(a, 'todo');
    a.send(line);
    await a.until(() => count(a, 'todo') > before, 600).catch(() => {});
    await wait(200);   // 행동 제한(초당 4번)을 넘지 않게
  }
  t.check('a to-do can move to another day', JSON.stringify(last(a, 'todo').i) === `[["숙제",0,${DAY}],["내일 할 일",0,${DAY}],["장보기",1,${DAY}]]`, JSON.stringify(last(a, 'todo').i));
  for (const line of ['todo move 2 0', 'todo move 0 1', 'todo move 1 9', 'todo move 1 1', 'todo move -1 0']) {
    const before = count(a, 'todo');
    a.send(line);
    await a.until(() => count(a, 'todo') > before, 600).catch(() => {});
    await pause();
  }
  t.check('to-dos can be put in a new order', JSON.stringify(last(a, 'todo').i) === `[["숙제",0,${DAY}],["장보기",1,${DAY}],["내일 할 일",0,${DAY}]]`, JSON.stringify(last(a, 'todo').i));
  a.send('todo move 2 1');   // 아래의 확인들이 기대하는 순서로 되돌린다
  await a.until(() => last(a, 'todo').i[1][0] === '내일 할 일', 1500);
  await pause();
  a.send('todo del 1');
  await a.until(() => last(a, 'todo').i.length === 2, 1500);
  const old = await enter('old');
  t.check('to-dos saved before dates load as undated', JSON.stringify(last(old, 'todo').i) === '[["옛날에 적은 일",1,0],["아직 남은 일",0,0]]', JSON.stringify(last(old, 'todo').i));
  old.close();

  // ---- 친구 신청과 수락
  await pause();
  a.send(`friend ask ${b.id}`);
  await b.until(() => last(b, 'friendask'), 1500);
  t.check('the other side is asked at once', last(b, 'friendask').n === 'a' && last(b, 'friends').q.join() === 'a');
  await pause();
  a.send(`friend ask ${b.id}`);
  await a.until(() => says(a, '이미 신청했어요'), 1500);
  t.check('asking twice is refused', true);
  a.send(`friend ask ${a.id}`);
  await wait(150);
  t.check('you cannot befriend yourself', !last(a, 'friends').q.length && !last(b, 'friends').p.length);
  await pause();
  b.send(`todo today ${DAY}`);
  await pause();
  b.send('friend yes 0');
  await a.until(() => last(a, 'friendok'), 1500);
  const seen = last(b, 'friends').p[0];
  t.check('accepting makes both friends and tells the asker', last(a, 'friends').p[0][0] === 'b' && last(b, 'friends').q.length === 0 && last(a, 'friendok').n === 'b');
  t.check('a friend shows online, where, and today\'s to-do progress', seen[0] === 'a' && seen[1] === a.id && seen[2] === RARA && seen[3] === 1 && seen[4] === 2 && seen[5] === 1, JSON.stringify(seen));

  // ---- 친구의 할 일
  await pause();
  b.send('friend todo 0');
  await b.until(() => last(b, 'todo', (e) => !e.own), 1500);
  t.check('you can open a friend\'s to-do list', JSON.stringify(last(b, 'todo', (e) => !e.own).i) === `[["숙제",0,${DAY}],["장보기",1,${DAY}]]` && last(b, 'todo', (e) => !e.own).n === 'a');
  await pause();
  a.send(`todo add ${DAY} 물 마시기`);
  await b.until(() => last(b, 'todo', (e) => !e.own)?.i.length === 3, 1500);
  t.check('it updates while you watch, and so does the friend list', last(b, 'friends').p[0][4] === 3);
  await pause();
  a.send('todo share 0');
  await b.until(() => last(b, 'todo', (e) => !e.own)?.sh === 0, 1500);
  t.check('a private list shows nothing to friends', last(b, 'todo', (e) => !e.own).i.length === 0 && last(b, 'friends').p[0][5] === 0 && last(b, 'friends').p[0][4] === 0);
  await pause();
  a.send('todo share 1');
  await a.until(() => last(a, 'todo').sh === 1, 1500);
  await pause();
  const lists = count(b, 'friends');
  b.send(`todo today ${NEXT}`);
  await b.until(() => count(b, 'friends') > lists, 1500);
  t.check('the friend list counts only the viewer\'s today', last(b, 'friends').p[0][4] === 0);
  await pause();
  b.send(`todo today ${DAY}`);
  await b.until(() => last(b, 'friends').p[0][4] === 3, 1500);

  // ---- 접속하지 않은 사람에게 이름으로 신청: 다음에 접속하면 도착한다
  await pause();
  a.send('friend name 없는사람');
  await a.until(() => says(a, '찾지 못했어요'), 1500);
  t.check('an unknown name is reported', true);
  await pause();
  a.send('friend name c');
  await a.until(() => says(a, '다음에 접속하면'), 1500);
  t.check('an offline player can be asked by name', true);
  const c = await enter('c');
  t.check('the request waits for them', last(c, 'friends').q.join() === 'a');
  await pause();
  c.send(`friend ask ${a.id}`);   // 서로 신청하면 바로 친구
  await a.until(() => last(a, 'friends').p.length === 2, 1500);
  t.check('asking someone who already asked you makes you friends', last(c, 'friends').p[0][0] === 'a' && last(c, 'friends').q.length === 0);
  await pause();
  c.send('friend remove 0');
  await a.until(() => last(a, 'friends').p.length === 1, 1500);
  t.check('removing a friend takes you off both lists', last(c, 'friends').p.length === 0);
  await pause();
  a.send('friend name d');
  await a.until(() => says(a, '다음에 접속하면'), 1500);

  // ---- 거절과 저장
  const d = await enter('d');
  await pause();
  d.send('friend no 0');
  await a.until(() => says(a, '거절했어요'), 1500);
  t.check('declining tells the asker', last(d, 'friends').q.length === 0);
  a.close();
  await b.until(() => last(b, 'friends').p[0][1] === 0, 1500);
  t.check('a friend who leaves shows offline', last(b, 'friends').p[0][2] === -1 && last(b, 'friends').p[0][4] === 3);
  a = await enter('a');
  t.check('friends and to-dos are kept', last(a, 'friends').p[0][0] === 'b' && last(a, 'todo').i.length === 3 && last(a, 'todo').i.some(([, done, date]) => done === 1 && date === DAY));
  for (const bot of [a, b, c, d]) bot.close();
  await server.stop();
}

// 방명록: 집마다 따로, 누구나 쓰고 쓴 사람만 지운다. 그 집에 있는 사람에게 알리고, 서버를 다시 켜도 남는다
async function guestbook(t) {
  const { server, ids } = await serverWithAccounts({ host: [RARA, 200, 230], guest: [RARA, 260, 230], away: [0, 820, 620] });
  const enter = async (srv, name) => {
    const bot = await Bot.enter(srv, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const book = (bot, zone) => last(bot, 'guest', (e) => e.z === zone);
  const host = await enter(server, 'host'), guest = await enter(server, 'guest'), away = await enter(server, 'away');
  host.send(`guest look ${RARA}`);
  await host.until(() => book(host, RARA), 1500);
  t.check('a house guestbook starts empty', book(host, RARA).n === 0 && book(host, RARA).e.length === 0);
  t.check('everyone is told the newest entry of every house', last(away, 'guestlast')?.p.length === 3 && last(away, 'guestlast').p.every(([, id]) => id === 0));
  away.send(`guest write ${RARA}   다녀갑니다~ 집이 예뻐요`);
  await away.until(() => book(away, RARA)?.n === 1, 1500);
  const entry = book(away, RARA).e[0];
  t.check('anyone can write from anywhere, with their look', entry[1] === 'away' && entry[2] === '다녀갑니다~ 집이 예뻐요' && entry[5] === 1 && entry[4].split(',').length === 4 && Math.abs(entry[3] - Date.now() / 1000) < 60, JSON.stringify(entry));
  await host.until(() => book(host, RARA)?.n === 1, 1500);
  t.check('people watching get the new entry, marked as not theirs', book(host, RARA).e[0][5] === 0);
  await guest.until(() => last(guest, 'guestnew'), 1500);
  t.check('people in the house are told', last(guest, 'guestnew').n === 'away' && !last(away, 'guestnew'));
  t.check('everyone learns there is a new entry', last(guest, 'guestlast').p.find(([z]) => z === RARA)[1] === entry[0]);
  await pause();
  away.send(`guest write ${RARA} 또 왔어요`);
  await away.until(() => says(away, '조금 있다가'), 1500);
  t.check('writing again right away is refused', book(away, RARA).n === 1);
  away.send('guest write 0 바깥');
  away.send(`guest write 1 ${'가'.repeat(150)}`);
  await away.until(() => book(away, 1), 1500).catch(() => {});
  await wait(150);
  t.check('only houses have guestbooks, one per house', !book(away, 0) && book(host, RARA).n === 1);
  await pause();
  host.send(`guest del ${entry[0]}`);
  await wait(200);
  t.check('only the writer can delete', book(host, RARA).n === 1);
  await pause();
  guest.send(`guest look ${RARA}`);
  await guest.until(() => book(guest, RARA), 1500);
  host.send(`guest write ${RARA} 방명록 남겨 주셔서 고마워요!`);
  await guest.until(() => book(guest, RARA)?.n === 2, 1500);
  t.check('newest entries come first', book(guest, RARA).e[0][2] === '방명록 남겨 주셔서 고마워요!' && book(guest, RARA).e[1][1] === 'away');
  await pause();
  away.send(`guest del ${entry[0]}`);
  await guest.until(() => book(guest, RARA)?.n === 1, 1500);
  t.check('the writer deletes their entry', book(guest, RARA).e[0][1] === 'host');
  for (const bot of [host, guest, away]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await enter(again, 'guest');
  back.send(`guest look ${RARA}`);
  await back.until(() => book(back, RARA), 1500);
  t.check('entries survive a restart', book(back, RARA).n === 1 && book(back, RARA).e[0][2] === '방명록 남겨 주셔서 고마워요!');
  back.close();
  await again.stop();
}

async function screens(t) {
  const { server, ids } = await serverWithAccounts({ alice: [RARA, 250, 230], bob: [RARA, 320, 230] });
  const browser = await launchBrowser();
  const alice = await enterGame(browser, server, ids.alice, { name: 'alice' });
  const bob = await enterGame(browser, server, ids.bob, { name: 'bob' });
  await alice.waitForFunction(() => entities.size === 2, null, { timeout: 3000 });
  t.check('the top bar has guestbook, to-do and friend buttons left of info', await alice.evaluate(() => {
    const order = [...document.querySelectorAll('#sound-bar button:not([hidden])')].map((b) => b.id);
    return order.indexOf('guest-open') < order.indexOf('todo-open') && order.indexOf('todo-open') < order.indexOf('friends-open') && order.indexOf('friends-open') === order.indexOf('profile-open') - 1;
  }));
  t.check('every top button has a pixel icon and a label', await alice.evaluate(() => [...document.querySelectorAll('#sound-bar button')].every((b) => b.querySelector('canvas.hud-icon') && b.querySelector('.hud-label')?.textContent && b.title)));

  // ---- 우클릭으로 친구 신청: 받는 쪽 가운데에 알림창
  const target = await alice.evaluate(() => {
    const [cx, cy] = camera(innerWidth, innerHeight);
    for (const [id, e] of entities) if (id !== myId) return [e.x - cx, e.y - bodyLift(e) - cy];
  });
  await alice.mouse.click(target[0], target[1], { button: 'right' });
  t.check('the player menu offers a friend request', (await alice.textContent('#player-friend')).includes('친구 신청'));
  await alice.click('#player-friend');
  await bob.waitForSelector('#notice-layer:not([hidden])', { timeout: 2000 });
  await wait(450);   // 튀어나오는 움직임이 끝난 뒤에 잰다
  t.check('the request pops up in the middle with the sender', (await bob.textContent('#notice-title')) === '친구 신청' && (await bob.textContent('#notice-text')).includes('alice') && await bob.evaluate(() => {
    const r = document.getElementById('notice').getBoundingClientRect();
    return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 4 && Math.abs(r.top + r.height / 2 - innerHeight / 2) < 4;
  }));
  t.check('the friend button shows a red N for a waiting request', (await bob.textContent('#friends-badge')) === 'N' && await bob.isVisible('#friends-badge') && await bob.$eval('#friends-badge', (b) => getComputedStyle(b).animationName === 'hud-new'));
  await bob.screenshot({ path: shot('social_friend_ask.png') });
  await bob.click('#notice-yes');
  await alice.waitForSelector('#notice-layer:not([hidden])', { timeout: 2000 });
  t.check('the asker is told it was accepted', (await alice.textContent('#notice-text')).includes('bob'));
  await alice.click('#notice-yes');
  t.check('the notice closes', await alice.isHidden('#notice-layer'));

  // ---- 할 일 공책: 적어도 캐릭터는 움직이지 않는다
  await alice.keyboard.press('KeyJ');
  await alice.waitForSelector('#todo:not([hidden])', { timeout: 2000 });
  const x0 = await alice.evaluate(() => me.x);
  await alice.click('#todo-input');
  await alice.keyboard.type('물 마시기');
  await alice.keyboard.press('Enter');
  await alice.keyboard.type('daily');
  await alice.keyboard.press('Enter');
  await alice.waitForFunction(() => myTodo.i.length === 2, null, { timeout: 2000 });
  t.check('typing a to-do adds it without walking', (await alice.textContent('#todo-list')).includes('물 마시기') && Math.abs((await alice.evaluate(() => me.x)) - x0) < 1);
  t.check('to-dos go on today in the calendar', await alice.evaluate(() => myTodo.i.every(([, , d]) => d === todayNumber()) && document.querySelector('.todo-cell.today b')?.textContent === '2' && document.querySelector('.todo-cell.today').getAttribute('aria-selected') === 'true'));
  await alice.click('#todo-list li:first-child .todo-check');
  await alice.waitForFunction(() => myTodo.i[0][1] === 1, null, { timeout: 2000 });
  t.check('ticking shows progress', (await alice.textContent('#todo-progress')).includes('1 / 2') && await alice.$eval('#todo-list li:first-child', (li) => li.classList.contains('done')));
  await alice.dblclick('#todo-list li:last-child .todo-text');
  await alice.fill('.todo-edit', '산책');
  await alice.keyboard.press('Enter');
  await alice.waitForFunction(() => myTodo.i[1][0] === '산책', null, { timeout: 2000 });
  t.check('double-click renames a to-do', true);
  await alice.hover('#todo-list li:last-child');
  await alice.click('#todo-list li:last-child .todo-move');
  await alice.waitForFunction(() => myTodo.i[1][2] === shiftDay(todayNumber(), 1), null, { timeout: 2000 });
  t.check('» moves a to-do to tomorrow', (await alice.textContent('#todo-list')).indexOf('산책') < 0 && await alice.evaluate(() => document.querySelector('.todo-cell.today b').textContent === '✓'));
  await alice.click(`.todo-cell[data-date="${await alice.evaluate(() => shiftDay(todayNumber(), 1))}"]`).catch(async () => {   // 오늘이 그달의 마지막 날이면 다음 달로
    await alice.click('#todo-next');
    await alice.click(`.todo-cell[data-date="${await alice.evaluate(() => shiftDay(todayNumber(), 1))}"]`);
  });
  t.check('picking a day shows that day\'s list', (await alice.textContent('#todo-list')).includes('산책') && !(await alice.textContent('#todo-date')).includes('오늘'));
  await alice.click('#todo-today');
  await alice.click('#todo-cal-toggle');
  t.check('the calendar folds into a one-line day picker', await alice.isHidden('#todo-grid') && (await alice.textContent('#todo-label')).includes('일 ('));
  await alice.click('#todo-cal-toggle');
  await alice.screenshot({ path: shot('social_todo.png') });

  // ---- 친구 창에서 친구의 할 일을 본다
  await bob.keyboard.press('KeyN');
  await bob.waitForSelector('#friends:not([hidden])', { timeout: 2000 });
  await bob.waitForFunction(() => myFriends.length === 1 && myFriends[0][4] === 1, null, { timeout: 2000 });   // 산책은 내일로 옮겼다
  t.check('the friend window lists the friend online with today\'s progress', (await bob.textContent('#friends-list')).includes('alice') && (await bob.textContent('#friends-list')).includes('할 일 1/1') && (await bob.textContent('#friends-list')).includes('랏라의 집'));
  await bob.click('#friends-list .friend-actions .rbtn:first-child');
  await bob.waitForSelector('#todo:not([hidden])', { timeout: 2000 });
  await bob.waitForFunction(() => friendTodo?.i.length === 2 && !friendTodo.loading, null, { timeout: 2000 });
  t.check('a friend\'s list opens read-only on their tab', (await bob.textContent('#todo-title')).includes('alice') && await bob.isHidden('#todo-form') && await bob.$eval('.todo-check', (b) => b.disabled)
    && (await bob.textContent('#todo-tabs .rtab[aria-selected="true"]')) === 'alice');
  await alice.click('#todo-input');
  await alice.keyboard.type('숙제');
  await alice.keyboard.press('Enter');
  await bob.waitForFunction(() => friendTodo?.i.length === 3, null, { timeout: 2000 });
  t.check('the friend sees new to-dos right away', (await bob.textContent('#todo-list')).includes('숙제'));
  await bob.screenshot({ path: shot('social_friends.png') });
  await bob.click('#todo-tabs .rtab:first-child');
  t.check('the 나 tab returns to my own list', (await bob.textContent('#todo-title')) === '할 일' && await bob.isVisible('#todo-form'));
  await bob.click('#todo-tabs .rtab:nth-child(2)');
  await bob.waitForFunction(() => friendTodo?.n === 'alice' && !friendTodo.loading, null, { timeout: 2000 });
  t.check('friend tabs switch straight to their list', (await bob.textContent('#todo-list')).includes('숙제'));
  await bob.click('#todo-tabs .rtab:first-child');
  await bob.keyboard.press('Escape');
  t.check('Esc closes the friend window', await bob.isHidden('#friends'));

  // ---- 할 일 끌어 옮기기: ⋮⋮ 를 잡고 위로 끌면 순서가 바뀌고, 달력의 날짜에 놓으면 그날로 간다
  const todayTexts = () => alice.$$eval('#todo-list .todo-text', (els) => els.map((el) => el.textContent));
  const dragGrip = async (row, to) => {
    const box = await alice.$eval(`#todo-list li:nth-child(${row}) .todo-grip`, (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await alice.mouse.move(box[0], box[1]);
    await alice.mouse.down();
    for (let k = 1; k <= 10; k++) await alice.mouse.move(box[0] + ((to[0] ?? box[0]) - box[0]) * k / 10, box[1] + ((to[1] ?? box[1]) - box[1]) * k / 10);
    await alice.mouse.up();
  };
  t.check('own to-dos have a drag handle', (await todayTexts()).join() === '물 마시기,숙제' && (await alice.$$('#todo-list .todo-grip')).length === 2);
  const top = await alice.$eval('#todo-list li:first-child', (li) => li.getBoundingClientRect().y);
  await dragGrip(2, [undefined, top - 4]);
  await alice.waitForFunction(() => myTodo.i.findIndex(([text]) => text === '숙제') < myTodo.i.findIndex(([text]) => text === '물 마시기'), null, { timeout: 2000 });
  t.check('dragging a to-do up puts it first', (await todayTexts()).join() === '숙제,물 마시기');
  const next = await alice.evaluate(() => shiftDay(todayNumber(), 1));
  const nextCell = await alice.$eval(`.todo-cell[data-date="${next}"]`, (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }).catch(() => null);
  if (nextCell) {   // 오늘이 그달의 마지막 날이면 달력에 내일이 없다
    await dragGrip(2, nextCell);
    await alice.waitForFunction((d) => myTodo.i.find(([text]) => text === '물 마시기')?.[2] === d, next, { timeout: 2000 });
    t.check('dropping a to-do on a calendar day moves it there', (await todayTexts()).join() === '숙제');
  }

  // ---- 창 테마: 어느 창에서 골라도 모든 창, 화면 위 버튼, 채팅창이 한꺼번에 바뀐다
  t.check('every closable window has a theme button', await alice.$$eval('.rwin-title', (heads) => heads.every((h) => !h.querySelector('.rwin-x:not(.rwin-theme)') || h.querySelector('.rwin-theme'))));
  const looks = () => alice.evaluate(() => {
    const bg = (id) => getComputedStyle(document.getElementById(id)).backgroundColor;
    return { root: document.documentElement.dataset.uiTheme, todo: bg('todo'), bag: bg('bag'), hud: bg('profile-open'), chat: chatEl.className, menu: themeMenu.hidden, saved: localStorage.getItem('mmo.uiTheme') };
  });
  await alice.click('#todo-head .rwin-theme');
  await alice.waitForSelector('#theme-menu:not([hidden])', { timeout: 1000 });
  t.check('the theme menu lists eight themes with the current one ticked', (await alice.$$('#theme-list button')).length === 8
    && (await alice.textContent('#theme-list button[aria-checked="true"]')) === '레트로');
  await alice.click('#theme-list button:has-text("밤하늘")');
  const night = await looks();
  t.check('picking a theme recolours every window, the buttons and the chat at once', night.root === 'night' && night.todo === 'rgb(45, 42, 85)' && night.bag === night.todo && night.hud === night.todo
    && night.chat.includes('skin-retro') && night.menu && night.saved === 'night', JSON.stringify(night));
  await alice.screenshot({ path: shot('social_theme.png') });
  await alice.click('#todo-head .rwin-theme');
  await alice.keyboard.press('Escape');
  t.check('Esc closes the theme menu first', await alice.isHidden('#theme-menu') && await alice.isVisible('#todo'));
  await alice.click('#todo-head .rwin-theme');
  await alice.click('#theme-list button:has-text("유리")');
  const glass = await alice.evaluate(() => { const s = getComputedStyle(todoEl), b = getComputedStyle(document.getElementById('bag')); return { radius: s.borderRadius, blur: s.backdropFilter, bag: b.borderRadius, chat: chatEl.classList.contains('skin-glass') }; });
  t.check('the glass theme turns every window and the chat into blurred panes', glass.radius === '22px' && glass.blur.includes('blur') && glass.bag === '22px' && glass.chat, JSON.stringify(glass));
  await alice.screenshot({ path: shot('social_theme_glass.png') });
  await alice.click('#chat-skin');
  await alice.click('#chat-skins button[data-skin="messenger"]');
  t.check('picking a chat skin changes the windows too', (await looks()).root === 'messenger' && await alice.evaluate(() => chatEl.classList.contains('skin-messenger')));
  await alice.click('#chat-skin');
  await alice.click('#chat-skins button[data-skin=""]');
  const basic = await looks();
  t.check('the plain chat skin has a matching dark theme for every window', basic.root === 'basic' && basic.todo === 'rgba(14, 17, 23, 0.86)' && basic.bag === basic.todo
    && await alice.evaluate(() => getComputedStyle(todoEl).borderRadius === '10px' && !/skin-/.test(chatEl.className)), JSON.stringify(basic));
  await alice.screenshot({ path: shot('social_theme_basic.png') });
  await alice.click('#todo-head .rwin-theme');
  await alice.click('#theme-list button:has-text("레트로")');
  t.check('the classic theme comes back', await alice.evaluate(() => !document.documentElement.dataset.uiTheme && getComputedStyle(todoEl).backgroundColor === 'rgb(239, 230, 207)' && getComputedStyle(document.getElementById('bag')).backgroundColor === 'rgb(239, 230, 207)'));

  // ---- 교환 신청도 가운데 알림창. Esc 는 거절
  await alice.evaluate(() => ws.send(`trade ask ${[...entities.keys()].find((id) => id !== myId)}`));
  await bob.waitForSelector('#notice-layer:not([hidden])', { timeout: 2000 });
  t.check('a trade request uses the same notice', (await bob.textContent('#notice-title')) === '교환 신청');
  await bob.keyboard.press('Escape');
  t.check('Esc declines it', await bob.isHidden('#notice-layer'));
  // ---- 방명록: 집 안에서 G 로 연다. 남기면 쓴 사람의 캐릭터와 함께 올라오고, 같은 집의 친구에게 알린다
  t.check('the guestbook button shows inside a house', await alice.isVisible('#guest-open'));
  await alice.evaluate(() => document.activeElement.blur());   // 할 일 입력 칸에 있던 커서를 빼야 G 가 단축키가 된다
  await alice.keyboard.press('KeyG');
  await alice.waitForSelector('#guest:not([hidden])', { timeout: 2000 });
  await alice.waitForFunction(() => guestBook, null, { timeout: 2000 });
  t.check('G opens this house\'s guestbook', (await alice.textContent('#guest-title')).includes('랏라의 집 방명록') && (await alice.$$('#guest-tabs .rtab')).length === 3);
  const before = await alice.evaluate(() => me.x);
  await alice.click('#guest-text');
  await alice.keyboard.type('놀러 왔다 갑니다 :)');
  await alice.keyboard.press('Enter');
  await alice.waitForFunction(() => guestBook?.n === 1, null, { timeout: 2000 });
  t.check('writing posts an entry with a little character, without walking', (await alice.textContent('#guest-list')).includes('놀러 왔다 갑니다') && (await alice.textContent('#guest-list')).includes('No.1') && !!(await alice.$('.guest-entry .guest-face')) && Math.abs((await alice.evaluate(() => me.x)) - before) < 1);
  await bob.waitForFunction(() => [...document.querySelectorAll('#chat-log div')].some((d) => d.textContent.includes('방명록')), null, { timeout: 2000 });
  t.check('someone in the same house is told', true);
  await bob.waitForSelector('#guest-new:not([hidden])', { timeout: 2000 });
  t.check('a new entry puts a red N on the guestbook button', (await bob.textContent('#guest-new')) === 'N' && await alice.isHidden('#guest-new'));
  await bob.screenshot({ path: shot('social_new_badges.png'), clip: { x: 500, y: 0, width: 600, height: 60 } });
  await bob.click('#guest-open');
  await bob.waitForFunction(() => guestBook?.n === 1, null, { timeout: 2000 });
  t.check('reading the guestbook clears the N', await bob.isHidden('#guest-new'));
  await bob.keyboard.press('Escape');
  await alice.screenshot({ path: shot('social_guestbook.png') });
  await alice.click('#guest-tabs .rtab:first-child');
  await alice.waitForFunction(() => guestBook && guestBook.z !== zone, null, { timeout: 2000 });
  t.check('tabs show another house\'s guestbook', (await alice.textContent('#guest-title')).includes('캬캬'));
  await alice.keyboard.press('Escape');
  t.check('Esc closes the guestbook', await alice.isHidden('#guest'));

  const door = await alice.evaluate(() => terrain.zones[zone].door);   // 친구가 방을 나가면 있는 곳이 바로 바뀐다
  await alice.evaluate(() => document.activeElement.blur());   // 입력 칸에서 빠져나와야 걷는다
  await pageWalkTo(alice, door[0], door[1] - 24, 10, 6000);
  await alice.evaluate(() => ws.send('use'));
  await bob.waitForFunction(() => myFriends[0][2] === 0, null, { timeout: 3000 }).catch(() => {});
  t.check('the guestbook button stays outside too', await alice.evaluate(() => zone === 0) && await alice.isVisible('#guest-open'));
  t.check('a friend moving elsewhere updates where they are', await bob.evaluate(() => myFriends[0][2] === 0), await bob.evaluate(() => JSON.stringify(myFriends)));
  t.check('no script errors', alice.problems.length + bob.problems.length === 0, [...alice.problems, ...bob.problems].join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), guestbook(t), screens(t)]);
}
