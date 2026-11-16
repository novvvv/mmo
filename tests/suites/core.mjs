// server-core 와 모듈 예시 서버: core 만으로 로그인·입장·이동·채팅이 되고, 모듈이 없으면 콘텐츠 명령은 무시되며,
// 모르는 계정 키(다른 모듈의 값)를 지우지 않는다. core 의 소스가 콘텐츠 헤더를 포함하지 않는지도 본다.
// 예시 모듈(server-core/examples/hello): 명령 등록, 계정 파일의 자기 키에 저장하고 다시 켜도 남는다.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Bot, ROOT, startServer, uniqueId, wait } from '../lib.mjs';

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(cpp|hpp)$/.test(name) ? [full] : [];
  });
}

const accountFile = (dir, id) => path.join(dir, `${Buffer.from(id).toString('hex')}.acc`);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));

export default async function run(t) {
  // ---- core 는 콘텐츠를 모른다
  const bad = sources(path.join(ROOT, 'server-core', 'src')).flatMap((file) => readFileSync(file, 'utf8').split('\n')
    .filter((line) => /#include "(game|home|activity|social|example)\//.test(line)).map((line) => `${path.relative(ROOT, file)}: ${line}`));
  t.check('server-core includes nothing from game content', bad.length === 0, bad.join(' | '));

  execFileSync('make', ['-s'], { cwd: path.join(ROOT, 'server-core'), stdio: 'inherit' });
  execFileSync('make', ['-s'], { cwd: path.join(ROOT, 'server-core', 'examples', 'hello'), stdio: 'inherit' });

  // ---- core 만으로 도는 최소 서버
  const server = await startServer({ binary: 'server-core/core_server' });
  const a = await Bot.enter(server, 'a');
  const b = await Bot.enter(server, 'b');
  t.check('the core alone logs in and enters', !!(a.welcome && a.map && a.me && b.me));
  t.check('its map is the bare village: one zone, the river, no buildings', a.map.zones.length === 1 && a.map.buildings.length === 0 && a.map.top.length > 0 && a.map.seats.length > 0);
  t.check('welcome carries only the core fields', JSON.stringify(Object.keys(a.welcome).sort()) === JSON.stringify(['h', 'id', 'speed', 't', 'tick', 'w']), Object.keys(a.welcome).join());
  const x0 = a.me.x;
  a.send('in 8');
  await wait(500);
  a.send('in 0');
  await wait(150);
  t.check('walking moves the player on the server', a.me.x > x0 + 60, `${x0} -> ${a.me.x}`);
  await b.until(() => b.others.some((p) => p.id === a.id && Math.abs(p.x - a.me.x) < 1), 1500);
  t.check('others in the zone see the move', b.others.some((p) => p.id === a.id && Math.abs(p.x - a.me.x) < 1));
  a.send('chat 안녕');
  await b.until(() => b.events.some((e) => e.t === 'chat' && e.m === '안녕'), 1500);
  t.check('chat reaches everyone', b.events.some((e) => e.t === 'chat' && e.m === '안녕' && e.n === 'a'));
  a.send('farm buy 0 1');
  a.send('decor buy 0');
  a.send('/박수');
  await wait(300);
  t.check('content commands are ignored without their modules', !a.events.some((e) => ['goods', 'inv', 'farm', 'decor'].includes(e.t)));
  a.close();
  b.close();
  await wait(200);

  // ---- 모르는 계정 키는 그대로 남는다 (지금 게임의 계정 파일을 core 만으로 열어도 지워지지 않게)
  const keeper = uniqueId('keep');
  (await Bot.enter(server, 'k', { id: keeper })).close();
  await wait(300);
  await server.stop();
  appendFileSync(accountFile(server.dataDir, keeper), 'gold=1234\nc0=5\n');
  const again = await startServer({ binary: 'server-core/core_server', dataDir: server.dataDir });
  const k = await Bot.enter(again, 'k', { id: keeper });
  k.send('in 2');
  await wait(300);
  k.send('in 0');
  k.close();
  await wait(300);
  await again.stop();
  const saved = readFileSync(accountFile(server.dataDir, keeper), 'utf8');
  t.check('keys of other modules survive a save by the core', /^gold=1234$/m.test(saved) && /^c0=5$/m.test(saved) && /^nick=k$/m.test(saved), saved.split('\n').slice(5, 12).join(' '));

  // ---- 모듈 예시 서버
  const example = await startServer({ binary: 'server-core/examples/hello/hello_server' });
  const id = uniqueId('hello');
  const c = await Bot.enter(example, 'c', { id });
  await c.until(() => says(c, "ws.send('hello')"), 1500);
  t.check('a module can talk to a player on entry', says(c, "ws.send('hello')"));
  c.send('hello');
  c.send('hello 반가워');
  await c.until(() => says(c, '2번째 인사'), 1500);
  t.check('a module registers its own command', says(c, '1번째 인사') && says(c, '2번째 인사') && says(c, '덧붙인 말: 반가워'));
  c.close();
  await wait(300);
  await example.stop();
  const example2 = await startServer({ binary: 'server-core/examples/hello/hello_server', dataDir: example.dataDir });
  const c2 = await Bot.enter(example2, 'c', { id });
  c2.send('hello');
  await c2.until(() => says(c2, '3번째 인사'), 1500);
  c2.close();
  await wait(300);
  await example2.stop();
  t.check('a module keeps its value in the account file across restarts', says(c2, '3번째 인사') && /^hello=3$/m.test(readFileSync(accountFile(example.dataDir, id), 'utf8')));
}
