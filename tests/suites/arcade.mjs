// 오락기: 상점의 오락기 탭, 1P·2P 자리, 지뢰찾기 대전과 단계(서버가 판을 갖는다), 슈팅·벽돌깨기의 점수 심판과 협동 중계,
// 체스(규칙, 컴퓨터, 힌트, 무르기), 체스 설명서, 기록
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const RARA = 2;
const SHOOTER = 58, BRICKS = 59, MINES = 60, CHESS = 61;
const START = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';
const shot = (name) => path.join(SHOTS, name);
const pause = () => wait(260);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const decor = (bot) => bot.lastEvent('decor');
const arcade = (bot, id) => bot.events.filter((e) => e.t === 'arcade' && e.id === id).at(-1);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [RARA, 200, 230, { f58: 1, f59: 1, f60: 1, f61: 1 }], b: [RARA, 250, 230], far: [RARA, 560, 420],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a'), b = await enter('b'), far = await enter('far');
  t.check('the shop sells three arcade cabinets and a chess board', [SHOOTER, BRICKS, MINES, CHESS].map((k) => a.map.catalog[k].k).join() === 'arcade_shooter,arcade_bricks,arcade_mines,arcade_chess');
  a.send(`decor place ${MINES} 200 150`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === MINES), 1500);
  await pause();
  a.send(`decor place ${BRICKS} 420 150`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === BRICKS), 1500);
  const mines = decor(a).p.find((d) => d[1] === MINES)[0], bricks = decor(a).p.find((d) => d[1] === BRICKS)[0];

  // ---- 자리: 가까이 있어야 앉고, 한 자리에 한 명
  far.send(`arcade join ${mines} 0`);
  await far.until(() => says(far, '오락기 앞으로'), 1500);
  t.check('you sit only in front of the cabinet', true);
  await pause();
  a.send(`arcade join ${mines} 0`);
  await b.until(() => arcade(b, mines)?.p[0] === a.id, 1500);
  t.check('the room sees who sat at 1P', arcade(b, mines).p[0] === a.id && arcade(b, mines).n[0] === 'a' && arcade(b, mines).g === 2);
  await pause();
  b.send(`arcade join ${mines} 0`);
  await b.until(() => says(b, '1P 자리에 이미'), 1500);
  await pause();
  b.send(`arcade join ${mines} 1`);
  await a.until(() => arcade(a, mines)?.p[1] === b.id, 1500);

  // ---- 지뢰찾기 대전: 번갈아 열고, 지뢰를 찾으면 한 번 더, 반 넘게 찾으면 이긴다
  await pause();
  a.send(`arcade start ${mines}`);
  await b.until(() => arcade(b, mines)?.s === 1, 1500);
  const start = arcade(b, mines);
  t.check('two players start a versus board', start.vs === 1 && start.size === 13 && start.mc === 33 && start.b === '.'.repeat(169) && start.tn === 0, JSON.stringify(start));
  b.send(`arcade dig ${mines} 5`);
  await wait(150);
  t.check('you cannot dig out of turn', arcade(a, mines).b === '.'.repeat(169));
  let digs = 0;
  while (arcade(a, mines).s === 1 && digs < 200) {
    const st = arcade(a, mines), who = st.tn === 0 ? a : b;
    const before = st.b;
    who.send(`arcade dig ${mines} ${st.b.indexOf('.')}`);
    await a.until(() => arcade(a, mines).b !== before || arcade(a, mines).s !== 1, 1000);
    digs++;
  }
  const end = arcade(a, mines);
  t.check('the board plays out to a winner', end.s === 2 && (end.w === 0 || end.w === 1) && end.f[end.w] * 2 > 33 && end.why === 'mines', JSON.stringify({ w: end.w, f: end.f, why: end.why, digs }));
  t.check('found mines are marked with each player\'s flag', [...end.b].filter((c) => c === 'a').length === end.f[0] && [...end.b].filter((c) => c === 'b').length === end.f[1]);
  const winner = end.w === 0 ? a : b, loser = end.w === 0 ? b : a;
  await pause();
  winner.send('stats');
  await winner.until(() => winner.lastEvent('stats'), 1500);
  t.check('the winner\'s profile counts the arcade win', winner.lastEvent('stats').s[8] === 1 && winner.lastEvent('stats').s[9] === 1, JSON.stringify(winner.lastEvent('stats').s));
  await pause();
  loser.send('stats');
  await loser.until(() => loser.lastEvent('stats'), 1500);
  t.check('the loser\'s profile counts the game', loser.lastEvent('stats').s[8] === 0 && loser.lastEvent('stats').s[9] === 1);

  // ---- 혼자 하는 벽돌깨기: 점수는 서버가 받고, 말이 안 되게 오른 점수는 버린다
  await pause();
  a.send(`arcade leave ${mines}`);
  await a.until(() => arcade(a, mines)?.p[0] === 0, 1500);
  await pause();
  b.send(`arcade leave ${mines}`);
  await pause();
  a.send(`decor move ${bricks} 290 150`);
  await a.until(() => decor(a)?.p.some((d) => d[0] === bricks && d[2] === 290), 1500);
  await pause();
  a.send(`arcade join ${bricks} 0`);
  await a.until(() => arcade(a, bricks)?.p[0] === a.id, 1500);
  await pause();
  a.send(`arcade start ${bricks}`);
  await a.until(() => arcade(a, bricks)?.s === 1, 1500);
  t.check('one player starts a solo game with a seed', arcade(a, bricks).vs === 0 && arcade(a, bricks).seed > 0 && arcade(a, bricks).g === 1);
  a.send(`arcade score ${bricks} 120 3 0`);
  await a.until(() => arcade(a, bricks)?.sc[0] === 120, 1500);
  a.send(`arcade score ${bricks} 999999 3 0`);
  await wait(150);
  a.send(`arcade score ${bricks} 50 3 0`);
  await wait(150);
  t.check('impossible or falling scores are ignored', arcade(a, bricks).sc[0] === 120);
  a.send(`arcade score ${bricks} 300 0 1`);
  await a.until(() => arcade(a, bricks)?.s === 2, 1500);
  t.check('game over ends a solo game', arcade(a, bricks).why === 'over' && arcade(a, bricks).sc[0] === 300);
  await pause();
  const statsBefore = a.events.filter((e) => e.t === 'stats').length;
  a.send('stats');
  await a.until(() => a.events.filter((e) => e.t === 'stats').length > statsBefore, 1500);
  t.check('a solo game keeps the best score', a.lastEvent('stats').s[11] === 300, JSON.stringify(a.lastEvent('stats').s));

  // ---- 둘이 앉으면 한 판을 함께 한다: 1P 화면이 판을 중계하고 2P 는 조작을 보낸다
  await pause();
  b.send(`arcade join ${bricks} 1`);
  await a.until(() => arcade(a, bricks)?.p[1] === b.id, 1500);
  await pause();
  b.send(`arcade start ${bricks}`);
  await a.until(() => arcade(a, bricks)?.s === 1 && arcade(a, bricks).vs === 1, 1500);
  const coop = arcade(a, bricks);
  t.check('two seated players start one shared game', coop.co === 1 && coop.lv[0] === 3 && coop.lv[1] === 3, JSON.stringify(coop));
  a.send(`arcade sync ${bricks} {"sc":40,"p":[[80,44,3,0],[160,44,3,0]]}`);
  await b.until(() => b.events.some((e) => e.t === 'asy' && e.id === bricks), 1500);
  t.check('1P\'s screen is relayed to 2P', JSON.parse(b.events.find((e) => e.t === 'asy').d).sc === 40);
  b.send(`arcade in ${bricks} 150.5 1`);
  await a.until(() => a.events.some((e) => e.t === 'ain' && e.id === bricks), 1500);
  t.check('2P\'s paddle and button reach 1P', a.events.find((e) => e.t === 'ain').x === 150.5 && a.events.find((e) => e.t === 'ain').f === 1);
  b.send(`arcade sync ${bricks} {"sc":999}`);
  a.send(`arcade sync ${bricks} {"bad":"\u0001"}`);   // 제어 문자는 받지 않는다
  await wait(200);
  t.check('only 1P relays, and only plain text', !a.events.some((e) => e.t === 'asy') && b.events.filter((e) => e.t === 'asy').length === 1);
  far.send(`arcade look ${bricks}`);
  await a.until(() => arcade(a, bricks)?.wc === 1, 1500);
  a.send(`arcade sync ${bricks} {"sc":60}`);
  await far.until(() => far.events.some((e) => e.t === 'asy'), 1500);
  t.check('a watcher is counted and gets the relay too', JSON.parse(far.events.find((e) => e.t === 'asy').d).sc === 60);
  far.send(`arcade unlook ${bricks}`);
  await a.until(() => arcade(a, bricks)?.wc === 0, 1500);
  b.send(`arcade score ${bricks} 500 3 0`);
  a.send(`arcade score ${bricks} 80 3 0 2`);
  await a.until(() => arcade(a, bricks)?.sc[0] === 80, 1500);
  t.check('1P reports the team score and both players\' lives', arcade(a, bricks).sc[1] === 0 && arcade(a, bricks).lv[1] === 2);
  await pause();
  b.send(`arcade leave ${bricks}`);
  await a.until(() => arcade(a, bricks)?.p[1] === 0, 1500);
  t.check('when 2P gets up, 1P plays on alone', arcade(a, bricks).s === 1 && arcade(a, bricks).lv[1] === 0);
  await pause();
  a.send(`arcade leave ${bricks}`);
  await b.until(() => arcade(b, bricks)?.s === 2, 1500);
  t.check('when 1P gets up the shared game ends', arcade(b, bricks).why === 'leave' && arcade(b, bricks).w === -1);

  // ---- 오락기를 치우면 판도 사라진다
  await pause();
  a.send(`decor take ${bricks}`);
  await b.until(() => b.events.some((e) => e.t === 'arcade' && e.id === bricks && e.off), 1500);
  t.check('taking the cabinet away ends its game', true);
  for (const bot of [a, b, far]) bot.close();
  await server.stop();
}

// 이웃 칸 번호
function neighbours(i, n) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = (i % n) + dx, y = Math.floor(i / n) + dy;
      if ((dx || dy) && x >= 0 && y >= 0 && x < n && y < n) out.push(y * n + x);
    }
  }
  return out;
}

// 열린 숫자만 보고 확실히 안전한 칸과 지뢰를 찾는다. 막히면 아무 칸이나 연다.
function nextDig(board, n, mines) {
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < n * n; i++) {
      if (board[i] < '1' || board[i] > '8') continue;
      const around = neighbours(i, n), unknown = around.filter((j) => board[j] === '.' && !mines.has(j));
      const need = Number(board[i]) - around.filter((j) => mines.has(j)).length;
      if (!unknown.length) continue;
      if (need === 0) return unknown[0];
      if (need === unknown.length) {
        unknown.forEach((j) => mines.add(j));
        changed = true;
      }
    }
  }
  const left = [...board].map((c, i) => (c === '.' && !mines.has(i) ? i : -1)).filter((i) => i >= 0);
  return left[Math.floor(Math.random() * left.length)];
}

// 혼자 하는 지뢰찾기: 다 피하면 판이 커지는 다음 단계로 넘어간다
async function stages(t) {
  const { server, ids } = await serverWithAccounts({ m: [RARA, 200, 230, { f60: 1 }] });
  const m = await Bot.enter(server, 'm', { id: ids.m });
  await wait(60);
  m.send(`decor place ${MINES} 200 150`);
  await m.until(() => decor(m)?.p.some((d) => d[1] === MINES), 1500);
  const id = decor(m).p.find((d) => d[1] === MINES)[0];
  await pause();
  m.send(`arcade join ${id} 0`);
  await m.until(() => arcade(m, id)?.p[0] === m.id, 1500);
  let cleared = false, tries = 0;
  for (; tries < 25 && !cleared; tries++) {
    await pause();
    const startedAt = m.events.length;
    m.send(`arcade start ${id}`);
    await m.until(() => m.events.slice(startedAt).some((e) => e.t === 'arcade' && e.id === id && e.s === 1), 1500);
    const first = arcade(m, id);
    if (tries === 0) t.check('a solo board starts small at stage 1', first.size === 8 && first.mc === 8 && first.st === 1, JSON.stringify(first));
    const mines = new Set();
    for (let digs = 0; digs < 80; digs++) {
      const st = arcade(m, id);
      if (st.s !== 1 || st.nx) break;
      const cell = digs === 0 ? 27 : nextDig(st.b, st.size, mines);
      m.send(`arcade dig ${id} ${cell}`);
      await m.until(() => arcade(m, id).b !== st.b || arcade(m, id).s !== 1 || arcade(m, id).nx, 1000);
    }
    cleared = !!arcade(m, id).nx;
  }
  t.check('clearing a board shows it, then moves on', cleared, `tries ${tries}`);
  await m.until(() => arcade(m, id)?.st === 2, 3000);
  const next = arcade(m, id);
  t.check('the next stage is bigger with more mines', next.s === 1 && next.size === 9 && next.mc === 12 && !next.nx && next.b === '.'.repeat(81), JSON.stringify({ size: next.size, mc: next.mc, st: next.st }));
  await pause();
  m.send(`arcade leave ${id}`);
  await m.until(() => arcade(m, id)?.s === 2, 1500);
  await pause();
  m.send('stats');
  await m.until(() => m.lastEvent('stats'), 1500);
  const s = m.lastEvent('stats').s;
  t.check('the profile counts cleared boards and the best stage', s[12] >= 1 && s[15] === 2, JSON.stringify(s));
  m.close();
  await server.stop();
}

// 체스: 서버가 규칙을 보고 둘 수 있는 수만 받는다. 혼자면 컴퓨터가 두고 힌트와 무르기가 된다.
async function chess(t) {
  const { server, ids } = await serverWithAccounts({
    w: [RARA, 200, 230, { f61: 1 }], k: [RARA, 250, 230], pro: [RARA, 300, 230, { stats: '0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0' }],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const w = await enter('w'), k = await enter('k'), pro = await enter('pro');
  w.send(`decor place ${CHESS} 250 150`);
  await w.until(() => decor(w)?.p.some((d) => d[1] === CHESS), 1500);
  const id = decor(w).p.find((d) => d[1] === CHESS)[0];
  const state = () => arcade(w, id);
  const play = async (bot, from, to, promo = '') => {
    const before = state().np;
    bot.send(`arcade move ${id} ${from} ${to} ${promo}`.trim());
    await w.until(() => state().np !== before || state().s !== 1, 1500);
  };
  const begin = async () => {
    await pause();
    const at = w.events.length;
    w.send(`arcade start ${id}`);
    await w.until(() => w.events.slice(at).some((e) => e.t === 'arcade' && e.id === id && e.s === 1), 1500);
  };
  await pause();
  w.send(`arcade join ${id} 0`);
  await w.until(() => state()?.p[0] === w.id, 1500);
  await pause();
  k.send(`arcade join ${id} 1`);
  await w.until(() => state()?.p[1] === k.id, 1500);
  await begin();
  const first = state();
  t.check('two players start from the initial position, white to move', first.g === 3 && first.vs === 1 && first.cb === START && first.ct === 0 && first.cm.split(',').length === 20 && first.cm.includes('52.36') && first.tl > 170, JSON.stringify(first));
  k.send(`arcade move ${id} 12 28`);
  w.send(`arcade move ${id} 52 28`);
  await wait(200);
  t.check('moves out of turn or against the rules are refused', state().np === 0 && state().cb === START);

  // 바보의 수: 2수 만에 흑이 이긴다
  await play(w, 53, 45);
  await play(k, 12, 28);
  await play(w, 54, 38);
  await play(k, 3, 39);
  const mate = state();
  t.check('checkmate ends the game and names the winner', mate.s === 2 && mate.why === 'mate' && mate.w === 1 && mate.ck === 60 && mate.lm.join() === '3,39', JSON.stringify(mate));
  await pause();
  k.send('stats');
  await k.until(() => k.lastEvent('stats'), 1500);
  t.check('the winner\'s profile counts a chess win', k.lastEvent('stats').s[13] === 1 && k.lastEvent('stats').s[8] === 1, JSON.stringify(k.lastEvent('stats').s));

  // 프로모션: h 폰이 g8 의 나이트를 잡고 끝 줄에 닿는다
  await begin();
  for (const [bot, from, to] of [[w, 55, 39], [k, 14, 30], [w, 39, 30], [k, 15, 23], [w, 30, 23], [k, 12, 20], [w, 23, 15], [k, 5, 12]]) await play(bot, from, to);
  t.check('a pawn reaching the last rank offers a promotion', state().cm.split(',').includes('15.6p') && state().np === 8, state().cm);
  await play(w, 15, 6, 'n');
  t.check('it becomes the chosen piece', state().cb[6] === 'N' && state().cb[15] === '.' && state().ct === 1);
  await pause();
  k.send(`arcade leave ${id}`);
  await w.until(() => state().s === 2, 1500);
  t.check('getting up resigns the game', state().w === 0 && state().why === 'leave');

  // 혼자: 컴퓨터가 흑을 둔다. 힌트와 무르기
  await begin();
  const solo = state();
  t.check('alone you play white against the level-1 computer', solo.vs === 0 && solo.as === 1 && solo.ai === 1 && solo.ct === 0);
  await play(w, 52, 36);
  await w.until(() => state().np === 2, 5000);
  t.check('the computer answers with a move', state().np === 2 && state().ct === 0 && state().cb !== START);
  await pause();
  w.send(`arcade hint ${id}`);
  await w.until(() => state().hn[0] >= 0, 1500);
  const hinted = state();
  t.check('a hint points at a legal move', hinted.cm.split(',').some((mv) => mv.replace('p', '') === `${hinted.hn[0]}.${hinted.hn[1]}`), JSON.stringify(hinted.hn));
  await pause();
  w.send(`arcade undo ${id}`);
  await w.until(() => state().np === 0, 1500);
  t.check('undo takes back both my move and the computer\'s', state().cb === START && state().ct === 0 && state().hn[0] === -1);
  await pause();
  w.send(`arcade leave ${id}`);
  await w.until(() => state().p[0] === 0, 1500);

  // 컴퓨터를 여러 번 이긴 사람은 높은 단계와 둔다. 2P 에 혼자 앉으면 흑이고 컴퓨터가 먼저 둔다
  await pause();
  pro.send(`arcade join ${id} 1`);
  await w.until(() => state()?.p[1] === pro.id, 1500);
  await pause();
  pro.send(`arcade start ${id}`);
  await w.until(() => state().s === 1 && state().np === 1, 5000);
  t.check('a strong player meets level 3, and black waits for white', state().ai === 3 && state().as === 0 && state().ct === 1, JSON.stringify({ ai: state().ai, as: state().as }));
  for (const bot of [w, k, pro]) bot.close();
  await server.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ one: [RARA, 300, 230, { f58: 1, f60: 1, f61: 1 }] });
  const chrome = await launchBrowser();
  const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
  await loginPage(page, ids.one);
  await enterPage(page, { name: 'one' });
  await page.waitForFunction(() => zone === 2, null, { timeout: 4000 });

  // 게임 자체: 같은 씨앗과 같은 입력이면 같은 결과, 쏘고 맞히면 점수가 오른다
  const sims = await page.evaluate(() => {
    const run = (Game, seed, frames, input) => {
      const g = new Game(seed);
      for (let i = 0; i < frames; i++) g.step(1 / 60, [g.control(input(g, i), 0)]);
      return [g.score, g.lives, g.over];
    };
    const shooterInput = (g, i) => ({ left: i % 120 < 60, right: i % 120 >= 60, fire: true, pressed: false, pointerX: null });
    const bricksInput = (g) => ({ left: false, right: false, fire: true, pressed: false, pointerX: g.ball ? g.ball.x : 120 });
    return {
      shooter: run(ShooterGame, 7, 60 * 40, shooterInput), shooterAgain: run(ShooterGame, 7, 60 * 40, shooterInput),
      bricks: run(BricksGame, 9, 60 * 40, bricksInput), bricksAgain: run(BricksGame, 9, 60 * 40, bricksInput),
    };
  });
  t.check('the shooter scores and replays the same from a seed', sims.shooter[0] > 0 && sims.shooter.join() === sims.shooterAgain.join(), JSON.stringify(sims));
  t.check('the brick game scores and replays the same from a seed', sims.bricks[0] > 0 && sims.bricks.join() === sims.bricksAgain.join(), JSON.stringify(sims));

  // 함께 하는 판: 로켓·라켓이 둘이고, 중계한 판을 그대로 되살리며, 보여 주기만 하는 화면은 쏘지 않는다. 갈수록 빨라진다
  const coop = await page.evaluate(() => {
    const host = new ShooterGame(11, 2);
    for (let i = 0; i < 60 * 20; i++) host.step(1 / 60, [{ dx: i % 90 < 45 ? -1 : 1, x: null, fire: true }, { dx: 0, x: 60 + (i % 120), fire: i % 2 === 0 }]);
    const view = new ShooterGame(11, 2);
    view.remote = true;
    view.load(JSON.parse(JSON.stringify(host.save())));
    const same = JSON.stringify(view.save()) === JSON.stringify(host.save());
    const shotsBefore = view.shots.length, livesBefore = view.lives;
    for (let i = 0; i < 90; i++) view.step(1 / 60, [{ dx: 0, x: null, fire: true }, { dx: 0, x: null, fire: true }]);
    const bricks = new BricksGame(5, 2);
    for (let i = 0; i < 60 * 20; i++) bricks.step(1 / 60, bricks.balls.map((b) => ({ dx: 0, x: b ? b.x : 120, fire: true })));
    const bview = new BricksGame(5, 2);
    bview.remote = true;
    bview.load(JSON.parse(JSON.stringify(bricks.save())));
    const solo = new BricksGame(3);
    for (let i = 0; i < 60 * 6; i++) solo.step(1 / 60, [{ dx: 0, x: solo.ball ? solo.ball.x : 120, fire: true }]);
    const later = new ShooterGame(1);
    later.wave = 5;
    return {
      score: host.score, ships: host.ships.length, same, noShots: view.shots.length <= shotsBefore && view.lives === livesBefore,
      bricks: bricks.score, paddles: bricks.paddles.length, bsame: JSON.stringify(bview.save()) === JSON.stringify(bricks.save()),
      faster: solo.ball.v > solo.speed, waveSpeed: later.speed, size: JSON.stringify(host.save()).length,
    };
  });
  t.check('two ships share one shooter game and its relay restores it exactly', coop.ships === 2 && coop.score > 0 && coop.same && coop.noShots, JSON.stringify(coop));
  t.check('two paddles share one brick game and its relay restores it exactly', coop.paddles === 2 && coop.bricks > 0 && coop.bsame, JSON.stringify(coop));
  t.check('the ball speeds up as you hit it, slimes speed up each wave', coop.faster && coop.waveSpeed > 1.5 && coop.size < 6000, JSON.stringify(coop));

  // 상점의 오락기 탭
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="arcade"]');
  t.check('the shop has a separate arcade tab', (await page.$$('#arcade-list .furn-cell')).length === 4 && !(await page.textContent('#furn-list')).includes('오락기') && (await page.textContent('#arcade-list')).includes('체스판'));
  await page.screenshot({ path: shot('arcade_shop.png') });
  await page.click('#furn-close');

  // 슈팅 오락기를 놓고 E 로 열어 혼자 한다
  await page.evaluate((kind) => ws.send(`decor place ${kind} 300 170`), SHOOTER);
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'arcade_shooter'), null, { timeout: 3000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#arcade:not([hidden])', { timeout: 2000 });
  t.check('E in front of a cabinet opens it', (await page.textContent('#arcade-title')).includes('별똥 슈팅'));
  await page.click('#arcade-join1');
  await page.waitForSelector('#arcade-start:not([hidden])', { timeout: 2000 });
  t.check('a lone player can start alone', (await page.textContent('#arcade-start')) === '혼자 시작');
  await page.click('#arcade-start');
  await page.waitForFunction(() => arcadeState()?.s === 1 && arcadeSim, null, { timeout: 2000 });
  const x0 = await page.evaluate(() => me.x);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  await wait(1200);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('Space');
  const after = await page.evaluate(() => ({ ship: arcadeSim.sim.ship.x, x: me.x, shots: arcadeSim.sim.time }));
  t.check('arrow keys fly the ship instead of walking', after.ship < 100 && Math.abs(after.x - x0) < 1, JSON.stringify([x0, after]));
  await page.screenshot({ path: shot('arcade_shooter.png') });
  await page.waitForFunction(() => arcadeState()?.sc[0] >= 0 && performance.now() - arcadeState().at < 1000, null, { timeout: 2000 });
  t.check('the score is reported while playing', await page.evaluate(() => arcadeState().sc[0] === arcadeSim.sim.score || arcadeState().sc[0] >= 0));
  await page.click('#arcade-leave');
  await page.waitForFunction(() => arcadeState()?.p[0] === 0, null, { timeout: 2000 });
  t.check('getting up ends the solo game', await page.evaluate(() => arcadeState().s === 2));
  await page.keyboard.press('Escape');
  t.check('Esc closes the arcade window', await page.isHidden('#arcade'));

  // 지뢰찾기 혼자: 누르면 열린다
  await page.evaluate((kind) => ws.send(`decor place ${kind} 384 170`), MINES);
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'arcade_mines'), null, { timeout: 3000 });
  await page.evaluate(() => setArcadeOpen(decorItems.find((d) => d.info.k === 'arcade_mines').id));
  await page.waitForFunction(() => arcadeState(), null, { timeout: 2000 });
  await page.evaluate(() => ws.send(`arcade join ${arcadeOpenId} 0`));
  await page.waitForFunction(() => arcadeSide() === 0, null, { timeout: 2000 });
  await wait(300);
  await page.click('#arcade-start');
  await page.waitForFunction(() => arcadeState()?.s === 1 && arcadeState().b, null, { timeout: 2000 });
  const box = await page.$eval('#arcade-screen', (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await page.mouse.click(box[0] + box[2] / 2, box[1] + box[3] / 2);
  await page.waitForFunction(() => arcadeState().b.includes('0') || arcadeState().s === 2, null, { timeout: 2000 });
  t.check('clicking the board opens cells (the first click is always safe)', await page.evaluate(() => arcadeState().b.split('').filter((c) => c !== '.').length > 1 && arcadeState().s !== 2 || arcadeState().why === 'clear'));
  await page.mouse.click(box[0] + 20, box[1] + box[3] / 2 - box[2] / 2 + 40, { button: 'right' });
  await page.screenshot({ path: shot('arcade_mines.png') });

  // 체스판: 혼자 앉으면 컴퓨터와 둔다. 말을 누르면 설명과 갈 수 있는 칸이 보인다
  await page.evaluate(() => setArcadeOpen(null));
  await page.evaluate((kind) => ws.send(`decor place ${kind} 220 170`), CHESS);
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'arcade_chess'), null, { timeout: 3000 });
  await page.evaluate(() => setArcadeOpen(decorItems.find((d) => d.info.k === 'arcade_chess').id));
  await page.waitForFunction(() => arcadeState()?.g === 3, null, { timeout: 2000 });
  t.check('the chess board opens its own window', (await page.textContent('#arcade-title')) === '체스판' && (await page.textContent('#arcade-join1')).includes('백'));
  await page.click('#arcade-join1');
  await page.waitForFunction(() => arcadeSide() === 0, null, { timeout: 2000 });
  t.check('alone, starting means playing the computer', (await page.textContent('#arcade-start')) === '컴퓨터와 두기');
  await wait(300);
  await page.click('#arcade-start');
  await page.waitForFunction(() => arcadeState()?.s === 1 && arcadeState().cm, null, { timeout: 2000 });
  const clickSquare = async (sq) => {
    const [x, y] = await page.evaluate((at) => {
      const r = arcadeScreenEl.getBoundingClientRect(), [sx, sy] = chessSquareXY(at, arcadeSide() === 1);
      return [r.left + ((sx + 14) / ARCADE_W) * r.width, r.top + ((sy + 14) / ARCADE_H) * r.height];
    }, sq);
    await page.mouse.click(x, y);
  };
  await clickSquare(52);
  t.check('clicking a piece explains it and marks where it can go', (await page.textContent('#arcade-help')).includes('폰') && await page.evaluate(() => chessView(arcadeState(), 0, 0).targets.length === 2));
  await page.screenshot({ path: shot('chess_select.png') });
  await clickSquare(36);
  await page.waitForFunction(() => arcadeState().np === 2, null, { timeout: 6000 });
  t.check('the move is played and the computer replies', await page.evaluate(() => arcadeState().cb[36] === 'P' && arcadeState().ct === 0));
  await clickSquare(1);
  t.check('an opponent piece shows what it threatens', await page.evaluate(() => chessView(arcadeState(), 0, 0).pattern.length > 0) && (await page.textContent('#arcade-help')).includes('상대 말'));
  await page.click('#arcade-guide');
  await page.waitForSelector('#chess-guide:not([hidden])', { timeout: 2000 });
  t.check('the guide opens at the chosen piece', (await page.textContent('#chess-guide-title')).includes('나이트'));
  await page.screenshot({ path: shot('chess_guide.png') });
  await page.keyboard.press('Escape');
  t.check('Esc closes the guide before the board', (await page.isHidden('#chess-guide')) && !(await page.isHidden('#arcade')));

  // 아이템창의 체스 설명서
  await page.evaluate(() => setArcadeOpen(null));
  await page.keyboard.press('KeyI');
  await page.waitForSelector('#bag:not([hidden])', { timeout: 2000 });
  const book = await page.evaluate(() => ITEMS.length - 1);
  t.check('the item window holds the chess guide', !!(await page.$(`#bag-items .bag-slot[data-kind="${book}"]`)));
  await page.click(`#bag-items .bag-slot[data-kind="${book}"]`);
  await page.waitForSelector('#chess-guide:not([hidden])', { timeout: 2000 });
  await page.click('#chess-guide-tabs .rtab:first-child');
  await page.click('#chess-guide-next');
  t.check('the guide turns pages', (await page.textContent('#chess-guide-page')).startsWith('2 /') && (await page.textContent('#chess-guide-title')).includes('킹'));
  await page.screenshot({ path: shot('chess_bag_guide.png') });
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

// 두 사람이 한 슈팅 판을 함께: 1P 화면이 판을 돌리고, 2P 화면은 중계받은 판에 자기 로켓을 움직인다
async function coopBrowser(t) {
  const { server, ids } = await serverWithAccounts({ host: [RARA, 300, 230, { f58: 1 }], guest: [RARA, 340, 230] });
  const chrome = await launchBrowser();
  const one = await openPage(chrome, server, { viewport: { width: 1100, height: 780 } });
  const two = await openPage(chrome, server, { viewport: { width: 1100, height: 780 } });
  await loginPage(one, ids.host);
  await enterPage(one, { name: 'host' });
  await loginPage(two, ids.guest);
  await enterPage(two, { name: 'guest' });
  for (const page of [one, two]) await page.waitForFunction(() => zone === 2, null, { timeout: 4000 });
  await one.evaluate((kind) => ws.send(`decor place ${kind} 320 170`), SHOOTER);
  for (const [page, slot] of [[one, 0], [two, 1]]) {
    await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'arcade_shooter'), null, { timeout: 3000 });
    await page.evaluate(() => setArcadeOpen(decorItems.find((d) => d.info.k === 'arcade_shooter').id));
    await page.waitForFunction(() => arcadeState(), null, { timeout: 2000 });
    await page.evaluate((at) => ws.send(`arcade join ${arcadeOpenId} ${at}`), slot);
    await page.waitForFunction((at) => arcadeSide() === at, slot, { timeout: 2000 });
    await wait(300);
  }
  await one.waitForFunction(() => arcadeState().p[1], null, { timeout: 2000 });
  t.check('with both seats taken the button starts a shared game', (await one.textContent('#arcade-start')) === '같이 시작');
  await one.click('#arcade-start');
  await two.waitForFunction(() => arcadeView?.sim.ships.length === 2, null, { timeout: 3000 });
  t.check('2P receives the relayed game with two rockets', await one.evaluate(() => arcadeSim.sim.ships.length === 2));
  await two.keyboard.down('ArrowRight');
  await wait(900);
  await two.keyboard.up('ArrowRight');
  const guestX = await two.evaluate(() => arcadeView.sim.ships[1].x);
  await one.waitForFunction((x) => Math.abs(arcadeSim.sim.ships[1].x - x) < 4, guestX, { timeout: 2000 });
  t.check('2P flies their own rocket and 1P sees it there', guestX > 190, String(guestX));
  await two.keyboard.down('Space');
  await one.waitForFunction(() => arcadeSim.sim.shots.some((s) => s.o === 1), null, { timeout: 2000 });
  await two.keyboard.up('Space');
  t.check('2P\'s shots fly in 1P\'s game', true);
  await wait(1500);
  const [hostView, guestView] = await Promise.all([one, two].map((page) => page.evaluate(() => {
    const sim = arcadeSim?.sim.ships.length === 2 ? arcadeSim.sim : arcadeView.sim;
    return { score: sim.score, alive: sim.enemies.filter((e) => !e.dead).length };
  })));
  t.check('both screens show the same game', Math.abs(hostView.score - guestView.score) <= 60 && Math.abs(hostView.alive - guestView.alive) <= 2, JSON.stringify([hostView, guestView]));
  await one.screenshot({ path: shot('coop_host.png') });
  await two.screenshot({ path: shot('coop_guest.png') });
  t.check('no script errors in either screen', one.problems.length + two.problems.length === 0, [...one.problems, ...two.problems].join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), stages(t), chess(t), browser(t), coopBrowser(t)]);
}
