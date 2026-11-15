// 재즈바 다트: 2인/3인 대기실, 턴과 점수, 나가기, 시간 초과
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageHint, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const JAZZ = 6, IDLE = 0, LOBBY = 1, PLAYING = 2, FINISHED = 3, AIM_X = 0, AIM_Y = 1, PAUSE = 2;  // 서버의 DartState, DartPhase
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const shot = (name) => path.join(SHOTS, name);
const dart = (bot) => bot.lastEvent('dart');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));

// 서버 계산과 따로 쓴 기준 점수표.
function expectedPoints(x, y) {
  const r = Math.hypot(x, y);
  if (r > 1) return 0;
  if (r <= 0.06) return 50;
  if (r <= 0.14) return 25;
  const degrees = (Math.atan2(x, -y) * 180 / Math.PI + 360 + 9) % 360;
  const number = SECTORS[Math.floor(degrees / 18)];
  if (r >= 0.92) return number * 2;
  return r >= 0.55 && r <= 0.63 ? number * 3 : number;
}

async function enterAll(server, ids) {
  const bots = {};
  for (const name of Object.keys(ids)) {
    bots[name] = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
  }
  await wait(100);
  return bots;
}

const until = (bot, check, ms = 1500) => bot.until(check, ms);
const aiming = (bot) => { const s = dart(bot); return s.st === PLAYING && s.phase !== PAUSE; };

// 조준선이 한가운데를 지나는 순간에 멈춘다.
async function lockAtCentre(bot, map) {
  await until(bot, () => aiming(bot), 3000);
  const state = dart(bot), got = Date.now(), phase = state.seq;
  const elapsed = () => state.age + (Date.now() - got) / 1000;
  const k = Math.ceil((state.off + (elapsed() + 0.08) / map.dartPeriod - 0.25) * 2);
  const target = (k / 2 + 0.25 - state.off) * map.dartPeriod;
  await wait(Math.max(0, (target - elapsed()) * 1000) + 15);
  bot.send(`dart lock ${phase} ${Math.round(target * 1000)}`);
  await until(bot, () => dart(bot).seq !== phase);
}

async function fullGame(t) {
  const { server, ids } = await serverWithAccounts({ a: [JAZZ, 735, 120], b: [JAZZ, 700, 130], far: [JAZZ, 450, 520], out: [0, 820, 620] });
  const { a, b, far, out } = await enterAll(server, ids);
  const map = a.map;
  t.check('the bar has a dart board and a throwing line', ['dart_board', 'dart_line'].every((k) => map.furn.some((f) => f.z === JAZZ && f.k === k)) && map.dartReach > 0);
  t.check('nothing is open at first', dart(a).st === IDLE);

  far.send('dart new 2');
  await wait(250);
  t.check('a game can only be opened at the line', dart(a).st === IDLE);
  a.send('dart new 5');
  await wait(250);
  t.check('only two or three players', dart(a).st === IDLE);
  a.send('dart new 2');
  await until(b, () => dart(b).st === LOBBY);
  t.check('the lobby is announced to the bar', says(b, '2인 다트') && dart(b).players.length === 1 && dart(b).size === 2);
  t.check('people outside are not told', !dart(out));
  await wait(260);
  far.send('dart join');
  await wait(250);
  t.check('joining needs the line too', dart(a).players.length === 1);
  await wait(260);
  b.send('dart new 3');
  await wait(250);
  t.check('a running lobby cannot be replaced', dart(a).size === 2);
  await wait(260);
  b.send('dart join');
  await until(a, () => dart(a).st === PLAYING);
  t.check('the game starts when the lobby is full', dart(a).players.map((p) => p[0]).join() === [a.id, b.id].join());

  await until(a, () => aiming(a), 2500);
  const before = dart(a).seq;
  b.send(`dart lock ${before} 100`);
  a.send(`dart lock ${before + 7} 100`);
  await wait(200);
  t.check('out of turn and stale throws are ignored', dart(a).seq === before && dart(a).phase === AIM_X);

  await lockAtCentre(a, map);
  t.check('the first stop fixes the horizontal aim', dart(a).phase === AIM_Y && Math.abs(dart(a).lx) < 0.05, JSON.stringify(dart(a)));
  await lockAtCentre(a, map);
  const first = dart(b).hits[0];
  t.check('aiming at the centre scores a bull', first?.[2] === 50 && first[3] === 'BULL', JSON.stringify(first));

  // 끝까지 빠르게 던진다.
  const end = Date.now() + 40000;
  const bots = { [a.id]: a, [b.id]: b };
  while (dart(a).st === PLAYING && Date.now() < end) {
    if (!aiming(a)) {
      await wait(20);
      continue;
    }
    const state = dart(a), player = bots[state.players[state.turn][0]];
    player.send(`dart lock ${state.seq} 0`);
    await a.until(() => dart(a).seq !== state.seq || dart(a).st !== PLAYING, 1200).catch(() => {});
  }
  const updates = a.events.filter((e) => e.t === 'dart');
  const totals = {}, thrown = {};
  let mismatched = 0, previous = 0, round = 1;
  for (const u of updates) {
    if (u.st === PLAYING && u.hits.length > previous) {
      const [x, y, points] = u.hits.at(-1), id = u.players[u.turn][0];
      totals[id] = (totals[id] ?? 0) + points;
      thrown[id] = (thrown[id] ?? 0) + 1;
      if (points !== expectedPoints(x, y)) mismatched++;
    }
    if (u.st === PLAYING) round = Math.max(round, u.round);
    previous = u.hits.length;
  }
  const result = dart(a);
  t.check('every throw is scored by the board', mismatched === 0, mismatched);
  t.check('four rounds of three darts each', result.st === FINISHED && thrown[a.id] === 12 && thrown[b.id] === 12 && round === 4, JSON.stringify(thrown));
  t.check('final scores add up', result.players.every(([id, , score]) => totals[id] === score), JSON.stringify([result.players, totals]));
  t.check('the best score wins', result.players[0][2] >= result.players[1][2] && result.win.includes(result.players[0][0]));
  t.check('the winner is announced', says(far, '다트 우승'));
  await wait(260);
  b.send('dart new 3');
  await until(a, () => dart(a).st === LOBBY);
  t.check('a new game can open from the result screen', dart(a).size === 3 && dart(a).players.length === 1);
  for (const bot of [a, b, far, out]) bot.close();
  await server.stop();
}

async function leaving(t) {
  const { server, ids } = await serverWithAccounts({ a: [JAZZ, 735, 120], b: [JAZZ, 700, 130], c: [JAZZ, 770, 130], door: [JAZZ, 450, 572] });
  const { a, b, c, door } = await enterAll(server, ids);
  a.send('dart new 3');
  await until(a, () => dart(a).st === LOBBY);
  await wait(260);
  b.send('dart join');
  await until(a, () => dart(a).players.length === 2);
  t.check('a three player game waits for the third', dart(a).st === LOBBY);
  await wait(260);
  b.send('dart leave');
  await until(a, () => dart(a).players.length === 1);
  await wait(260);
  b.send('dart join');
  await until(a, () => dart(a).players.length === 2);
  await wait(260);
  c.send('dart join');
  await until(a, () => dart(a).st === PLAYING);
  t.check('three players can play', dart(a).players.length === 3);

  await until(a, () => aiming(a), 2500);
  const started = Date.now();
  await a.until(() => dart(a).phase === AIM_Y, 9500);
  t.check('an idle player does not hold up the game', Date.now() - started > 7000, Date.now() - started);

  a.send('dart leave');
  await until(b, () => dart(b).players.length === 2);
  t.check('when the current player leaves the next one throws', dart(b).players[dart(b).turn][0] === b.id && dart(b).phase === AIM_X);
  c.close();
  await until(b, () => dart(b).players.length === 1 || dart(b).st === FINISHED);
  t.check('the last one standing wins', dart(b).st === FINISHED && dart(b).win.join() === String(b.id), JSON.stringify(dart(b)));

  // 대기실에 혼자 있던 사람이 문으로 나가면 게임이 닫힌다.
  await wait(260);
  b.send('dart new 2');
  await until(door, () => dart(door).st === LOBBY);
  await b.walkTo(b.map.zones[JAZZ].door[0], b.map.zones[JAZZ].door[1] - 30, 8);
  b.send('use');
  await until(b, () => b.zone === 0);
  await until(door, () => dart(door).st === IDLE);
  t.check('walking out of the bar leaves the game', dart(door).st === IDLE && dart(door).players.length === 0);
  for (const bot of [a, b, door]) bot.close();
  await server.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ host: [JAZZ, 735, 125], guest: [JAZZ, 700, 130] });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await page.waitForFunction(() => !!dartState && zone === 6, null, { timeout: 4000 });
    await wait(200);
    return page;
  };
  const host = await open('host');
  const guest = await open('guest');
  t.check('hint offers darts', (await pageHint(host)).includes('E: 다트'), await pageHint(host));
  await host.keyboard.press('KeyE');
  t.check('E opens the player count choice', (await host.$$eval('#darts-actions button', (b) => b.map((x) => x.textContent))).join() === '2인,3인');
  await host.screenshot({ path: shot('darts_lobby.png') });
  await host.click('#darts-actions button:first-child');
  await host.waitForFunction(() => dartState.st === 1, null, { timeout: 2000 });
  await guest.waitForFunction(() => dartState.st === 1, null, { timeout: 2000 });
  await guest.keyboard.press('KeyE');
  await guest.click('#darts-actions button:first-child');
  await host.waitForFunction(() => dartState.st === 2 && dartState.phase === 0, null, { timeout: 3000 });
  t.check('both see the board', await host.isVisible('#darts-board') && await guest.isVisible('#darts-board'));
  await wait(300);
  await host.keyboard.press('Space');
  await host.waitForFunction(() => dartState.phase === 1, null, { timeout: 1500 });
  await wait(250);
  await guest.screenshot({ path: shot('darts_aim.png') });
  await host.keyboard.press('Space');
  await host.waitForFunction(() => dartState.hits.length === 1, null, { timeout: 1500 });
  await guest.waitForFunction(() => dartState.hits.length === 1, null, { timeout: 1500 });
  t.check('the throw shows for both players', (await guest.evaluate(() => dartState.hits[0][3])) === (await host.evaluate(() => dartState.hits[0][3])));
  await wait(250);
  await host.screenshot({ path: shot('darts_game.png') });
  await guest.click('#darts-actions button:last-child');   // 기권
  await host.waitForFunction(() => dartState.st === 3, null, { timeout: 2000 });
  t.check('the result names the winner', (await host.textContent('#darts-status')).includes('host'), await host.textContent('#darts-status'));
  await host.keyboard.press('Escape');
  t.check('Esc closes the window', !(await host.isVisible('#darts')));
  t.check('no script errors', host.problems.length === 0 && guest.problems.length === 0, [...host.problems, ...guest.problems].join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([fullGame(t), leaving(t), browser(t)]);
}
