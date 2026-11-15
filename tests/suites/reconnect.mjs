// 이어 들어오기와 부드러운 움직임: 로그인 표, 고친 표 거절, 서버를 다시 켜도 쓰는 표, 끊기면 화면 유지와 오프라인 표시, 같은 자리로 자동 복귀,
// 새로 연 창의 이어 들어가기 단추, 로그아웃과 다른 곳 로그인은 이어 들어오지 않음, 틱 번호와 누른 방향, 다른 사람의 고른 움직임
import path from 'node:path';
import { Bot, enterGame, launchBrowser, openPage, serverWithAccounts, SHOTS, startServer, uniqueId, wait } from '../lib.mjs';

const shot = (name) => path.join(SHOTS, name);

async function protocol(t) {
  const server = await startServer();
  const id = uniqueId('resume');
  const first = await Bot.connect(server);
  const auth = await first.login(id);
  t.check('logging in hands out a resume token', typeof auth?.rt === 'string' && auth.rt.split('.').length === 3, JSON.stringify(auth));
  await first.join({ nick: '표' });
  await wait(150);
  const states = first.events.length;   // state 는 events 에 쌓이지 않으므로 직접 센다
  const ticks = [];
  first.ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.t === 'state') ticks.push(m); });
  first.send('in 8');
  await wait(400);
  first.send('in 0');
  await wait(200);
  const moving = ticks.filter((m) => m.p.some((p) => p.id === first.id && p.d === 8));
  t.check('state messages carry a tick number', ticks.length > 5 && ticks.every((m, i) => i === 0 || m.k === ticks[i - 1].k + 1), ticks.slice(0, 4).map((m) => m.k).join());
  t.check('state tells which way people are pressing', moving.length > 3 && ticks.at(-1).p.find((p) => p.id === first.id).d === undefined, states);
  first.close();
  await wait(150);

  const again = await Bot.connect(server);
  again.send(`resume ${auth.rt}`);
  await again.until(() => again.lastEvent('auth'), 2000);
  t.check('the token logs in without a password', again.lastEvent('auth')?.ok === true && again.lastEvent('auth').id === id && !!again.lastEvent('auth').rt);
  again.close();

  const forged = await Bot.connect(server);
  const parts = auth.rt.split('.');
  for (const bad of [`${parts[0]}.${Number(parts[1]) + 1}.${parts[2]}`, `${Buffer.from('someone').toString('hex')}.${parts[1]}.${parts[2]}`, 'garbage', `${parts[0]}.1.${parts[2]}`]) {
    forged.send(`resume ${bad}`);
    await wait(80);
  }
  await wait(150);
  const answers = forged.events.filter((e) => e.t === 'auth');
  t.check('changed or expired tokens are refused', answers.length === 4 && answers.every((a) => a.ok === false && a.resume === true), JSON.stringify(answers));
  forged.close();

  await server.stop();
  const restarted = await startServer({ dataDir: server.dataDir });
  const back = await Bot.connect(restarted);
  back.send(`resume ${auth.rt}`);
  await back.until(() => back.lastEvent('auth'), 2000);
  t.check('the token still works after a restart', back.lastEvent('auth')?.ok === true);
  back.close();
  await restarted.stop();
  const other = await startServer();
  const elsewhere = await Bot.connect(other);
  elsewhere.send(`resume ${auth.rt}`);
  await elsewhere.until(() => elsewhere.lastEvent('auth'), 2000);
  t.check('a token from another server is refused', elsewhere.lastEvent('auth')?.ok === false);
  elsewhere.close();
  await other.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ me: [0, 900, 600], walker: [0, 960, 620] });
  const chrome = await launchBrowser();
  const page = await enterGame(chrome, server, ids.me, { name: '돌아옴' });
  await page.keyboard.press('KeyI');
  await page.keyboard.down('KeyD');
  await wait(300);
  await page.keyboard.up('KeyD');
  await wait(300);
  const before = await page.evaluate(() => ({ x: Math.round(me.x), y: Math.round(me.y), zone }));

  // ---- 다른 사람의 움직임은 고르게 그린다
  const walker = await Bot.enter(server, 'walker', { id: ids.walker });
  await page.waitForFunction((id) => entities.has(id), walker.id, { timeout: 2000 });
  await page.evaluate((id) => {
    window.__track = [];
    const loop = (ts) => {
      const e = entities.get(id);
      if (e) window.__track.push([ts, e.x, e.y, e.dirX, e.dirY]);
      if (window.__track.length < 90) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, walker.id);
  walker.send('in 1');
  await wait(1100);
  walker.send('in 0');
  await page.waitForFunction(() => window.__track.length >= 90, null, { timeout: 5000 });
  const track = await page.evaluate(() => window.__track);
  const speeds = [];
  for (let i = 1; i < track.length; i++) {
    const v = Math.hypot(track[i][1] - track[i - 1][1], track[i][2] - track[i - 1][2]) / Math.max(1, track[i][0] - track[i - 1][0]) * 1000;
    if (v > 1) speeds.push(v);
  }
  const steady = speeds.slice(2, -2);
  t.check('other people walk at an even speed', steady.length > 20 && steady.every((v) => v > 180 && v < 260), steady.map(Math.round).join(' '));
  t.check('other people face the way they walk', track.filter((r) => r[3] !== undefined && r[4] < -0.9).length > 20 && track.every((r) => r[3] === 0 || Math.abs(r[3]) < 0.01));
  walker.close();

  // ---- 서버가 꺼지면 화면은 그대로 두고 오프라인 띠
  await server.stop();
  await page.waitForSelector('#offline:not([hidden])', { timeout: 5000 });
  await wait(300);
  await page.screenshot({ path: shot('reconnect_offline.png') });
  t.check('a lost connection keeps the game on screen', await page.evaluate(() => authEl.hidden && charEl.hidden && !!terrain && myId !== null && document.body.classList.contains('offline')));
  t.check('the offline bar says it is reconnecting', (await page.textContent('#offline')).includes('오프라인'));
  const frozen = await page.evaluate(() => me.x);
  await page.keyboard.down('KeyD');
  await wait(300);
  await page.keyboard.up('KeyD');
  t.check('you cannot walk while offline', await page.evaluate((x) => me.x === x, frozen));

  const restarted = await startServer({ dataDir: server.dataDir, port: server.port });
  await page.waitForSelector('#offline', { state: 'hidden', timeout: 15000 });
  await wait(500);
  const after = await page.evaluate(() => ({ x: Math.round(me.x), y: Math.round(me.y), zone, bag: !bagEl.hidden, log: chatLog.textContent }));
  t.check('it comes back by itself at the same place', after.zone === before.zone && Math.abs(after.x - before.x) <= 1 && Math.abs(after.y - before.y) <= 1, JSON.stringify([before, after]));
  t.check('open windows stay open', after.bag);
  t.check('the chat keeps its lines and says so', after.log.includes('다시 연결되었습니다') && after.log.includes('돌아옴님이 입장했습니다'));
  await page.keyboard.down('KeyD');
  await wait(300);
  await page.keyboard.up('KeyD');
  await wait(200);
  t.check('you can walk again', await page.evaluate((x) => me.x > x + 20, after.x));

  // ---- 새로 연 창: 이어 들어가기 단추
  const tab = await page.context().newPage();
  tab.problems = [];
  tab.on('pageerror', (e) => tab.problems.push(e.message));
  await tab.goto(restarted.url);
  t.check('a new tab offers to continue', await tab.isVisible('#auth-resume') && (await tab.textContent('#auth-resume')).includes('돌아옴'));
  await tab.click('#auth-resume');
  await tab.waitForFunction(() => myId !== null && me && terrain, null, { timeout: 8000 });
  t.check('continuing enters the game directly', await tab.evaluate(() => authEl.hidden && charEl.hidden && zone === 0));
  // 다른 곳에서 들어오면 앞의 창은 이어 들어오지 않고 접속 화면으로
  await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('다른 곳에서'), null, { timeout: 5000 });
  await wait(1500);
  t.check('the kicked tab does not fight back', await page.isVisible('#auth-form') && await tab.evaluate(() => myId !== null && !offline));

  // ---- 로그아웃하면 표를 지운다
  await tab.evaluate(() => { closeMessage = ''; clearResume(); ws.close(); });
  await tab.waitForSelector('#auth:not([hidden])');
  t.check('logging out forgets the token', !(await tab.isVisible('#auth-resume')) && await tab.evaluate(() => !loadResume()));
  const fresh = await openPage(chrome, restarted);
  t.check('another browser has nothing to continue', !(await fresh.isVisible('#auth-resume')));
  const problems = [...page.problems, ...tab.problems];
  t.check('no page errors around reconnecting', problems.length === 0, problems.join(' | '));
  await chrome.close();
  await restarted.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t)]);
}
