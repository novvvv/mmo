// 로그인, 자동 가입, 저장
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Bot, startServer, uniqueId, wait } from '../lib.mjs';

export default async function run(t) {
  const server = await startServer();

  // ---- 로그인 전에는 아무것도 할 수 없다
  const anon = await Bot.connect(server);
  for (const m of ['join 1 1 1 0 해커', 'in 8', 'chat hi', 'use', 'fish', 'pet', 'feed', 'nonsense']) anon.send(m);
  await wait(200);
  t.check('commands before login get no response', anon.events.length === 0 && anon.stateCount === 0, JSON.stringify(anon.events));

  // ---- 입력 검증
  for (const [id, label] of [['a', 'too short'], ['abcdefghijklmnopqrstu', 'too long'], ['bad!id', 'symbol'], ['../etc', 'path'], ['a.b', 'dot']]) {
    const auth = await anon.login(id, 'password1');
    t.check(`rejects id: ${label}`, auth && auth.ok === false, JSON.stringify(auth));
  }
  anon.send('login onlyid');
  await wait(100);
  t.check('rejects missing password', anon.lastEvent('auth').ok === false);
  t.check('rejects short password', (await anon.login(uniqueId(), 'abc')).ok === false);
  t.check('rejects very long password', (await anon.login(uniqueId(), 'x'.repeat(129))).ok === false);

  // ---- 자동 가입
  const id = uniqueId('New');
  const lower = id.toLowerCase();
  const first = await Bot.connect(server);
  const created = await first.login(id, 'correct horse');
  t.check('unknown id signs up automatically', created?.ok === true && created.new === true, JSON.stringify(created));
  t.check('ascii ids are lowercased', created.id === lower, created.id);
  t.check('new account has no character yet', created.h === '' && created.nick === '');
  await first.join({ hue: '#2a9d8f', arms: 2, legs: 0, limb: 2, nick: '철수' });
  t.check('join enters the world', !!first.welcome && !!first.me && first.me.n === '철수');

  // ---- 파일에 비밀번호 원문이 없다
  await wait(250);
  const files = readdirSync(server.dataDir).filter((f) => f.endsWith('.acc'));
  t.check('account file exists', files.length === 1, files.join());
  const filePath = path.join(server.dataDir, files[0]);
  const stored = readFileSync(filePath, 'utf8');
  t.check('password is not stored', !stored.includes('correct horse') && /hash=[0-9a-f]{64}/.test(stored) && /salt=[0-9a-f]{32}/.test(stored), stored);
  t.check('account file is private', (statSync(filePath).mode & 0o077) === 0, (statSync(filePath).mode & 0o777).toString(8));

  // ---- 비밀번호 확인
  const other = await Bot.connect(server);
  const wrong = await other.login(id, 'wrong horse');
  t.check('wrong password rejected', wrong?.ok === false && wrong.m.includes('틀렸'), JSON.stringify(wrong));
  t.check('same connection stays open after a miss', !other.closed);
  const tail = await other.login(id, 'correct horse ');
  t.check('trailing space is part of the password', tail?.ok === false, JSON.stringify(tail));
  const ok = await other.login(id.toUpperCase(), 'correct horse');
  t.check('existing account logs in (case-insensitive id)', ok?.ok === true && ok.new === false, JSON.stringify(ok));
  t.check('saved look comes back', ok.h === '#2a9d8f' && ok.arms === 2 && ok.legs === 0 && ok.limb === 2 && ok.nick === '철수', JSON.stringify(ok));

  // ---- 중복 로그인: 이전 연결을 끊는다
  await first.until(() => first.closed, 2000);
  t.check('previous session is kicked', first.closed && first.events.some((e) => e.t === 'kick'), JSON.stringify(first.events.at(-1)));
  await other.join({ hue: '#2a9d8f', arms: 2, legs: 0, limb: 2, nick: '철수' });
  t.check('new session can enter', !!other.me && other.me.n === '철수');
  await wait(100);
  t.check('only one player for one account', other.others.filter((p) => p.n === '철수').length === 1);

  // ---- 한글 아이디와 공백 있는 비밀번호
  const korean = `한글${Date.now() % 100000}`;
  const k1 = await Bot.connect(server);
  t.check('korean id signs up', (await k1.login(korean, '띄어 쓰기 비번 123')).ok === true);
  k1.close();
  await wait(100);
  const k2 = await Bot.connect(server);
  t.check('korean id logs in', (await k2.login(korean, '띄어 쓰기 비번 123')).ok === true);
  k2.close();

  // ---- join 값 검증
  const clampBot = await Bot.connect(server);
  await clampBot.login(uniqueId(), 'password1');
  clampBot.send('join abc');
  await wait(100);
  t.check('malformed join ignored', !clampBot.welcome);
  clampBot.send('join 9999 77 -5 9 "악\\성"닉네임이아주아주아주길다');
  await clampBot.until(() => clampBot.me, 2000);
  t.check('look values are clamped', clampBot.me.c === '#df494b' && clampBot.me.a === 2 + 0 * 3 + 2 * 9, JSON.stringify(clampBot.me));
  t.check('nickname is sanitized', Array.from(clampBot.me.n).length <= 12 && !/["\\]/.test(clampBot.me.n), clampBot.me.n);
  const statesBefore = clampBot.stateCount;
  clampBot.send('join 1 1 1 0 다시입장');
  await wait(200);
  t.check('second join ignored', clampBot.me.n !== '다시입장' && clampBot.stateCount > statesBefore);
  clampBot.close();

  // ---- 잠금: 같은 계정을 연속으로 틀리면 잠시 잠긴다
  const lockId = uniqueId('lock');
  const owner = await Bot.connect(server);
  await owner.login(lockId, 'rightpass');
  owner.close();
  await wait(100);
  const guesser = await Bot.connect(server);
  for (let i = 0; i < 5; i++) await guesser.login(lockId, `guess-${i}`);
  const locked = await guesser.login(lockId, 'rightpass');
  t.check('account locks after 5 misses', locked?.ok === false && locked.m.includes('너무 많습니다'), JSON.stringify(locked));
  const elsewhere = await Bot.connect(server, { ip: '203.0.113.77' });
  const fromElsewhere = await elsewhere.login(lockId, 'rightpass');
  t.check('a lock does not shut out the owner on another IP', fromElsewhere?.ok === true, JSON.stringify(fromElsewhere));
  elsewhere.close();
  await wait(100);

  // ---- 한 연결에서 10번 틀리면 끊는다
  const secondLock = uniqueId('lock');
  const owner2 = await Bot.connect(server);
  await owner2.login(secondLock, 'rightpass');
  owner2.close();
  await wait(100);
  for (let i = 0; i < 5; i++) await guesser.login(secondLock, `guess-${i}`);
  await guesser.until(() => guesser.closed, 2000);
  t.check('connection closes after 10 misses', guesser.closed);

  await wait(30500);
  const afterLock = await Bot.connect(server);
  const unlocked = await afterLock.login(lockId, 'rightpass');
  t.check('lock expires after 30s', unlocked?.ok === true, JSON.stringify(unlocked));
  afterLock.close();

  // ---- 동시에 같은 아이디로 가입
  const raceId = uniqueId('race');
  const [r1, r2] = await Promise.all([Bot.connect(server), Bot.connect(server)]);
  const [a1, a2] = await Promise.all([r1.login(raceId, 'password1'), r2.login(raceId, 'password1')]);
  t.check('concurrent signup resolves', [a1, a2].filter((a) => a?.ok).length >= 1, JSON.stringify([a1, a2]));
  await wait(200);
  const accountsFor = readdirSync(server.dataDir).filter((f) => f === Buffer.from(raceId).toString('hex') + '.acc');
  t.check('concurrent signup makes one file', accountsFor.length === 1, accountsFor.join());
  r1.close();
  r2.close();

  // ---- 서버를 다시 켜도 그대로 (정상 종료)
  const saveId = uniqueId('save');
  const saver = await Bot.enter(server, '저장왕', { id: saveId, hue: '#c87828', arms: 1, legs: 2, limb: 1 });
  await saver.walkTo(870, 560, 10);
  const savedPos = { x: saver.me.x, y: saver.me.y };
  saver.close();

  // 물가에 딱 붙어 있던 위치도 그대로 되살아나야 한다 (반올림되면 물 안으로 판정되어 시작 지점으로 돌아간다)
  const bankIds = [];
  const bankPositions = [];
  for (const x of [360, 420, 480, 920, 1020]) {
    const id = uniqueId('bank');
    const bankBot = await Bot.enter(server, '물가저장', { id });
    await bankBot.toNorthField(x);
    bankBot.send('in 2');
    await bankBot.until(() => bankBot.me.y >= bankBot.top(bankBot.me.x) - bankBot.map.margin - 0.2, 6000);
    await wait(150);
    bankBot.send('in 0');
    await wait(120);
    bankIds.push(id);
    bankPositions.push({ x: bankBot.me.x, y: bankBot.me.y });
    bankBot.close();
  }
  await wait(150);
  await server.stop();

  const restarted = await startServer({ dataDir: server.dataDir });
  const back = await Bot.connect(restarted);
  const again = await back.login(saveId);
  t.check('account survives restart', again?.ok === true && again.new === false, JSON.stringify(again));
  t.check('look survives restart', again.h === '#c87828' && again.arms === 1 && again.legs === 2 && again.limb === 1 && again.nick === '저장왕', JSON.stringify(again));
  await back.join({ hue: '#c87828', arms: 1, legs: 2, limb: 1, nick: '저장왕' });
  t.check('position survives restart', Math.hypot(back.me.x - savedPos.x, back.me.y - savedPos.y) < 1, `${JSON.stringify(savedPos)} vs ${back.me.x},${back.me.y}`);
  for (let i = 0; i < bankIds.length; i++) {
    const bankBack = await Bot.connect(restarted);
    await bankBack.login(bankIds[i]);
    await bankBack.join({ nick: '물가저장' });
    t.check(`riverbank position ${i} survives restart`, Math.hypot(bankBack.me.x - bankPositions[i].x, bankBack.me.y - bankPositions[i].y) < 0.2, `${JSON.stringify(bankPositions[i])} vs ${bankBack.me.x},${bankBack.me.y}`);
    bankBack.close();
  }

  // ---- 강제 종료돼도 자동 저장분은 남는다
  await back.walkTo(900, 610, 10);
  const autoPos = { x: back.me.x, y: back.me.y };
  await wait(21000);  // 자동 저장 주기 20초
  await restarted.stop('SIGKILL');
  const third = await startServer({ dataDir: server.dataDir });
  const b3 = await Bot.connect(third);
  await b3.login(saveId);
  await b3.join({ nick: '저장왕' });
  t.check('autosave survives a crash', Math.hypot(b3.me.x - autoPos.x, b3.me.y - autoPos.y) < 1, `${JSON.stringify(autoPos)} vs ${b3.me.x},${b3.me.y}`);
  b3.close();
  await third.stop();

  // ---- 가입 수 제한
  const limited = await startServer({ env: { MMO_SIGNUP_LIMIT: '2' } });
  const names = [uniqueId('lim'), uniqueId('lim'), uniqueId('lim')];
  const results = [];
  for (const name of names) {
    const b = await Bot.connect(limited);
    results.push(await b.login(name, 'password1'));
    b.close();
    await wait(50);
  }
  t.check('signups per IP are limited', results[0].ok && results[1].ok && results[2].ok === false && results[2].m.includes('너무 많이'), JSON.stringify(results));
  const existing = await Bot.connect(limited);
  t.check('existing accounts still log in over the limit', (await existing.login(names[0], 'password1')).ok === true);
  existing.close();
  await limited.stop();

  // ---- 실제 반복 횟수로도 게임 루프가 멈추지 않는다
  const real = await startServer({ env: { MMO_AUTH_ITERATIONS: '600000' } });
  const watcher = await Bot.enter(real, '관찰', { id: uniqueId(), password: 'password1' });
  const hasher = await Bot.connect(real);
  await wait(500);
  const n0 = watcher.stateCount, t0 = Date.now();
  const auth = await hasher.login(uniqueId('real'), 'password1');
  const elapsed = (Date.now() - t0) / 1000;
  await wait(1000);
  const rate = (watcher.stateCount - n0) / ((Date.now() - t0) / 1000);
  t.check('600k PBKDF2 login succeeds', auth?.ok === true, JSON.stringify(auth));
  t.check('game keeps ticking during hashing', rate > 18 && rate < 22, `${rate.toFixed(1)}/s, login took ${elapsed.toFixed(2)}s`);
  console.log(`      600k PBKDF2 login: ${elapsed.toFixed(2)}s (this machine)`);
  hasher.close();

  // ---- 종료 신호가 오면 밀린 해시를 기다리지 않고 저장을 끝낸다
  const stayId = watcher.accountId;
  await watcher.walkTo(890, 580, 10);
  const stayPos = { x: watcher.me.x, y: watcher.me.y };
  const queued = await Promise.all(Array.from({ length: 12 }, (_, i) => Bot.connect(real, { ip: `198.51.100.${i + 10}` })));
  queued.forEach((b) => b.send(`login ${uniqueId('queue')} password1`));
  await wait(100);
  const stopStart = Date.now();
  await real.stop();
  const stopSec = (Date.now() - stopStart) / 1000;
  t.check('shutdown does not wait for queued hashes', stopSec < 2.5, `${stopSec.toFixed(2)}s`);

  const reread = await startServer({ dataDir: real.dataDir });
  const stayBack = await Bot.connect(reread);
  await stayBack.login(stayId, 'password1');
  await stayBack.join({ nick: '관찰' });
  t.check('shutdown saves online players', Math.hypot(stayBack.me.x - stayPos.x, stayBack.me.y - stayPos.y) < 1, `${JSON.stringify(stayPos)} vs ${stayBack.me.x},${stayBack.me.y}`);
  stayBack.close();
  await reread.stop();
}
