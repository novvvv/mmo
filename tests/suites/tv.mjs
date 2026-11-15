// 집마다 있는 TV: 같은 방 사람들과 유튜브 함께 보기
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageHint, pageSelf, serverWithAccounts, SHOTS, stubYouTube, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, KYAKYA = 3;
const VIDEO = 'dQw4w9WgXcQ', OTHER = 'jNQXAC9IVRw';
const tvs = (bot) => bot.events.filter((e) => e.t === 'tv');
const last = (bot) => tvs(bot).at(-1);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));

async function change(actor, watcher, command) {
  const before = tvs(watcher).length;
  actor.send(command);
  await watcher.until(() => tvs(watcher).length > before, 1000);
}

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [MOLJA, 250, 300], b: [MOLJA, 200, 260], late: [MOLJA, 250, 360], door: [MOLJA, 340, 400], rara: [RARA, 300, 200], outside: [0, 820, 620],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a');
  const b = await enter('b');
  const rara = await enter('rara');
  const outside = await enter('outside');

  const tvFurniture = a.map.furn.concat(a.map.seeds).filter((f) => f.k === 'tv' || f.k === 'tv_wall');  // 몰쟈·캬캬의 TV 는 설치형(seeds)
  t.check('every house has one TV', [MOLJA, RARA, KYAKYA].every((z) => tvFurniture.filter((f) => f.z === z).length === 1) && tvFurniture.length === 3, JSON.stringify(tvFurniture));
  t.check('map tells the TV reach', a.map.tvReach === 70, a.map.tvReach);
  t.check('nothing plays at first', tvs(a).length === 0);

  // ---- 틀기
  await change(a, b, `tv play ${VIDEO}`);
  t.check('the whole room gets the video', last(b)?.v === VIDEO && last(b)?.paused === false && last(a)?.v === VIDEO, JSON.stringify(last(b)));
  t.check('it starts from the beginning', last(b).pos < 0.2, last(b).pos);
  t.check('the room is told who turned it on', says(b, 'a님이 TV를 틀었습니다'));
  await wait(60);
  t.check('other houses are separate', tvs(rara).length === 0 && tvs(outside).length === 0);

  // ---- 잘못된 주소는 무시
  const count = tvs(b).length;
  for (const bad of ['tv', 'tv play', 'tv play short', 'tv play dQw4w9WgXcQQ', 'tv play dQw4w9WgX"Q', 'tv play dQw4w9WgX Q', 'tv play <script>a', 'tv nope', 'tv seek', 'tv seek abc', 'tv seek -5', 'tv seek nan', 'tv end']) a.send(bad);
  await wait(150);
  t.check('invalid commands are ignored', tvs(b).length === count, JSON.stringify(tvs(b).slice(count)));
  t.check('sender stays connected', !a.closed);
  outside.send(`tv play ${OTHER}`);
  await wait(100);
  t.check('no TV outdoors', tvs(outside).length === 0 && tvs(b).length === count);

  // ---- 나중에 들어온 사람은 지금 위치부터
  await wait(1500);
  const late = await enter('late');
  await late.until(() => last(late), 1000);
  t.check('late joiner gets the running position', last(late)?.v === VIDEO && last(late).pos > 1.3 && last(late).pos < 3, JSON.stringify(last(late)));

  // ---- 일시정지, 이어 보기, 이동
  await wait(3200);  // 도배 제한 토큰 회복
  await change(b, a, 'tv pause');
  const frozen = last(a);
  t.check('pause reaches everyone', frozen.paused === true && frozen.pos > 1, JSON.stringify(frozen));
  await wait(700);
  const door = await enter('door');
  await door.until(() => last(door), 1000);
  t.check('position is frozen while paused', Math.abs(last(door).pos - frozen.pos) < 0.05 && last(door).paused, JSON.stringify(last(door)));

  await change(a, b, 'tv resume');
  t.check('resume continues from the same spot', last(b).paused === false && Math.abs(last(b).pos - frozen.pos) < 0.1, JSON.stringify(last(b)));
  await change(a, b, 'tv seek 120.5');
  t.check('seek moves everyone', Math.abs(last(b).pos - 120.5) < 0.1, JSON.stringify(last(b)));
  await change(a, b, 'tv seek 999999999');
  t.check('seek has a limit', last(b).pos <= 86400.1, last(b).pos);
  await wait(2200);

  // ---- 방을 드나들 때
  door.send('use');
  await door.until(() => door.zone === 0, 1000);
  const whileOut = tvs(door).length;
  await change(a, b, 'tv seek 30');
  await wait(60);
  t.check('leaving stops the updates', tvs(door).length === whileOut);
  door.send('use');
  await door.until(() => door.zone === MOLJA, 1000);
  await door.until(() => tvs(door).length > whileOut, 1000);
  t.check('coming back joins at the current spot', Math.abs(last(door).pos - 30) < 3, JSON.stringify(last(door)));

  // ---- 끝났다는 알림은 현재 영상일 때만
  await wait(1000);
  const beforeEnd = tvs(b).length;
  a.send(`tv end ${OTHER}`);
  await wait(100);
  t.check('ending another video is ignored', tvs(b).length === beforeEnd);
  await change(a, b, `tv end ${VIDEO}`);
  t.check('a finished video turns the TV off', last(b).v === '', JSON.stringify(last(b)));
  t.check('finishing is silent', !says(b, 'TV를 껐습니다'));

  // ---- 끄기
  await wait(1000);
  await change(a, b, `tv play ${OTHER}`);
  await wait(600);
  await change(b, a, 'tv stop');
  t.check('anyone can turn it off', last(a).v === '', JSON.stringify(last(a)));
  t.check('the room is told it was turned off', says(a, 'b님이 TV를 껐습니다'));

  const afterStop = tvs(b).length;
  a.send('tv pause');
  a.send('tv seek 5');
  await wait(120);
  t.check('controls do nothing while off', tvs(b).length === afterStop);

  // ---- 도배 제한
  await wait(3200);
  const heard = tvs(b).length;
  for (let i = 0; i < 30; i++) a.send(`tv play ${i % 2 ? VIDEO : OTHER}`);
  await wait(200);
  const delivered = tvs(b).length - heard;
  t.check('rapid changes are limited', delivered >= 3 && delivered <= 8, delivered);
  await a.until(() => last(a).v === last(b).v, 500);
  t.check('rejected change reports the real video', last(a).v === last(b).v, `${last(a).v} vs ${last(b).v}`);

  // ---- 인스타 릴스
  await wait(3200);
  await change(a, b, 'tv reel DAbC_d-123');
  t.check('a reel reaches the room', last(b).v === 'DAbC_d-123' && last(b).reel === true, JSON.stringify(last(b)));
  const reelEvents = tvs(b).length;
  a.send('tv pause');
  a.send('tv seek 10');
  await wait(120);
  t.check('reels cannot be paused or moved', tvs(b).length === reelEvents);
  for (const bad of ['tv reel ab', 'tv reel ' + 'x'.repeat(65), 'tv reel a"b<cde', 'tv reel ']) a.send(bad);
  await wait(120);
  t.check('invalid reel codes are ignored', tvs(b).length === reelEvents && last(b).v === 'DAbC_d-123');
  await change(b, a, 'tv stop');
  t.check('a reel can be turned off', last(a).v === '', JSON.stringify(last(a)));
  await wait(600);
  await change(a, b, `tv play ${VIDEO}`);
  t.check('youtube is not marked as a reel', last(b).reel === false, JSON.stringify(last(b)));

  for (const bot of [a, b, late, door, rara, outside]) bot.close();
  await wait(100);
  await server.stop();
}

const players = (page) => page.evaluate(() => (window.__yt ? window.__yt.players.map((p) => ({ video: p.video, state: p.state, destroyed: p.destroyed, calls: p.calls, start: p.options.playerVars.start, volume: p.volume, muted: p.muted })) : []));
const live = async (page) => (await players(page)).filter((p) => !p.destroyed);
const panelOpen = (page) => page.isVisible('#tv');
const tvActive = (page, video) => page.waitForFunction((v) => tvState?.video === v && tvPlayer && tvPlayerReady, video, { timeout: 3000 });

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    host: [MOLJA, 340, 90], friend: [MOLJA, 250, 300], late: [MOLJA, 250, 360], door: [MOLJA, 340, 400], rara: [RARA, 420, 410],
  });
  const browser = await launchBrowser();
  const open = async (name, options = {}) => {  // 영상이 나오는 방에 들어가면 곧바로 API 를 부르므로 입장 전에 가짜를 설치한다
    const page = await openPage(browser, server, options);
    await stubYouTube(page);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    return page;
  };
  const page = await open('host');
  const friend = await open('friend');
  await wait(200);

  // ---- 주소 해석
  const parsed = await page.evaluate((list) => list.map(parseYouTubeId), [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'youtube.com/watch?list=x&v=dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ?feature=x', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ',
  ]);
  t.check('common YouTube links are understood', parsed.every((id) => id === VIDEO), parsed.join());
  const refused = await page.evaluate((list) => list.map(parseYouTubeId), ['https://evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'hello world', '', 'https://www.youtube.com/watch?v=short']);
  t.check('other links are refused', refused.every((id) => id === null), refused.join());

  // ---- 열기
  t.check('TV window starts closed', !(await panelOpen(page)));
  t.check('hint offers the TV', (await pageHint(page)).includes('T: TV 보기'), await pageHint(page));
  await page.keyboard.press('KeyT');
  t.check('T opens the TV window', await panelOpen(page));
  t.check('T did not sit down', (await pageSelf(page)).seat === 0);
  t.check('hint changes while open', (await pageHint(page)).includes('T: TV 창 닫기'), await pageHint(page));
  t.check('the empty TV offers YouTube and Reels', await page.isVisible('.tv-tile.youtube') && await page.isVisible('.tv-tile.reel') && !(await page.isVisible('#tv-controls')));
  await page.click('.tv-tile.reel');
  t.check('picking Reels asks for a Reels link', (await page.getAttribute('#tv-url', 'placeholder')).includes('릴스') && await page.evaluate(() => document.activeElement === tvUrl));
  await page.keyboard.press('Escape');
  await page.click('.tv-tile.youtube');
  t.check('picking YouTube asks for a YouTube link', (await page.getAttribute('#tv-url', 'placeholder')).includes('유튜브'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyT');
  t.check('T closes it again', !(await panelOpen(page)));
  await page.keyboard.press('KeyT');

  await page.fill('#tv-url', '아무 글자');
  await page.press('#tv-url', 'Enter');
  await wait(100);
  t.check('bad link shows a message', (await page.textContent('#tv-status')).includes('주소를 확인'), await page.textContent('#tv-status'));

  // 입력 중 키는 글자다
  const before = await pageSelf(page);
  await page.click('#tv-url');
  await page.fill('#tv-url', '');
  await page.keyboard.type('wasde');
  await wait(200);
  const typing = await pageSelf(page);
  t.check('typing a link does not move', Math.hypot(typing.x - before.x, typing.y - before.y) < 1 && (await page.inputValue('#tv-url')) === 'wasde' && await panelOpen(page));

  // ---- 틀면 방 안의 모두에게 열린다
  await page.fill('#tv-url', `https://www.youtube.com/watch?v=${VIDEO}`);
  await page.press('#tv-url', 'Enter');
  await tvActive(page, VIDEO);
  await tvActive(friend, VIDEO);
  t.check('host watches the video', (await live(page))[0]?.video === VIDEO, JSON.stringify(await live(page)));
  t.check('friend watches without doing anything', await panelOpen(friend) && (await live(friend))[0]?.video === VIDEO, JSON.stringify(await live(friend)));
  t.check('input is cleared and keyboard returned', (await page.inputValue('#tv-url')) === '' && await page.evaluate(() => document.activeElement === document.body));
  t.check('controls appear', await page.isVisible('#tv-controls') && !(await page.isVisible('#tv-empty')));
  await wait(1200);
  t.check('player is told to play', (await live(friend))[0].state === 1, JSON.stringify(await live(friend)));
  t.check('saved volume is applied', (await live(friend))[0].volume === 70, (await live(friend))[0].volume);
  await page.screenshot({ path: path.join(SHOTS, 'tv_playing.png') });

  // TV 화면도 켜진 모습이다
  const screenPixels = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const tv = terrain.furnByZone[zone].find((f) => f.k === 'tv_wall');
    const [camX, camY] = camera(innerWidth, innerHeight);
    resolve(Array.from(ctx.getImageData(tv.x - camX - 30, tv.y - camY - 125, 1, 1).data));
  }))));
  t.check('the TV in the room lights up', screenPixels[0] + screenPixels[1] + screenPixels[2] > 300, screenPixels.join());

  // ---- 리모컨: TV 에서 멀리 떨어진 friend 가 아이템창에서 창을 다시 연다
  await friend.click('#tv-close');
  await friend.keyboard.press('KeyI');
  await friend.click('.bag-slot[data-kind="0"]');
  t.check('the remote opens the TV from across the room', await panelOpen(friend) && !(await friend.evaluate(() => tvInReach({ x: me.x, y: me.y }))));
  await friend.keyboard.press('KeyI');

  // ---- 일시정지와 이동이 모두에게 간다
  await page.click('#tv-toggle');
  await friend.waitForFunction(() => tvState.paused, null, { timeout: 2000 });
  await wait(1200);
  t.check('pause reaches the friend', (await live(friend))[0].state === 2, JSON.stringify(await live(friend)));
  t.check('button follows the state', (await friend.textContent('#tv-toggle')) === '재생');
  await friend.click('#tv-toggle');
  await page.waitForFunction(() => !tvState.paused, null, { timeout: 2000 });
  await wait(1200);
  t.check('anyone can resume', (await live(page))[0].state === 1, JSON.stringify(await live(page)));

  await wait(1600);
  await page.evaluate(() => { tvBar.value = 200; tvBar.dispatchEvent(new Event('input')); tvBar.dispatchEvent(new Event('change')); });
  await friend.waitForFunction(() => Math.abs(tvExpected() - 200) < 3, null, { timeout: 2000 });
  await wait(1200);
  t.check('seek moves the friend too', Math.abs(await friend.evaluate(() => window.__yt.players.at(-1).time) - 200) < 3, await friend.evaluate(() => window.__yt.players.at(-1).time));

  // ---- 혼자 어긋나면 다시 맞춘다
  await friend.evaluate(() => { const p = window.__yt.players.at(-1); p.time += 30; });
  await wait(1300);
  const synced = await friend.evaluate(() => Math.abs(window.__yt.players.at(-1).time - tvExpected()));
  t.check('a drifting player is pulled back', synced < 2.5, synced);
  const seeks = () => friend.evaluate(() => window.__yt.players.at(-1).calls.filter((c) => c === 'seek').length);
  const seeksBefore = await seeks();
  await friend.evaluate(() => { tvSeekedAt = performance.now(); const p = window.__yt.players.at(-1); p.time = tvExpected() + 4; });  // 가짜 플레이어의 시간은 멈춰 있어 기다리는 동안 차이가 줄어든다
  await wait(1300);
  t.check('small drift is not corrected over and over', (await seeks()) === seeksBefore, (await seeks()) - seeksBefore);
  await friend.evaluate(() => { tvSeekedAt = -Infinity; });
  await wait(1300);
  t.check('small drift is corrected after a pause', (await seeks()) > seeksBefore, (await seeks()) - seeksBefore);
  await friend.evaluate(() => { window.__yt.players.at(-1).state = 2; });  // 영상을 눌러 혼자 멈춘 상황
  await wait(1300);
  t.check('a locally paused player resumes', (await live(friend))[0].state === 1, JSON.stringify(await live(friend)));

  // ---- 소리 크기는 나만
  await friend.evaluate(() => { tvVolume.value = 20; tvVolume.dispatchEvent(new Event('input')); tvVolume.dispatchEvent(new Event('change')); });
  t.check('volume changes only my player', (await live(friend))[0].volume === 20 && (await live(page))[0].volume === 70);
  await friend.click('#tv-mute');
  t.check('mute silences only my player and is remembered', (await live(friend))[0].muted && !(await live(page))[0].muted
    && await friend.evaluate(() => tvMute.getAttribute('aria-pressed') === 'true' && localStorage.getItem('mmo.tvMuted') === '1' && !tvState.paused));
  await friend.evaluate(() => { tvVolume.value = 40; tvVolume.dispatchEvent(new Event('input')); tvVolume.dispatchEvent(new Event('change')); });
  t.check('moving the volume unmutes', (await live(friend))[0].volume === 40 && !(await live(friend))[0].muted && await friend.evaluate(() => !tvMuted && localStorage.getItem('mmo.tvMuted') === '0'));

  // ---- 나중에 들어온 사람
  const late = await open('late');
  await tvActive(late, VIDEO);
  const lateInfo = await late.evaluate(() => ({ start: window.__yt.players[0].options.playerVars.start, expected: tvExpected() }));
  t.check('late joiner opens at the current spot', lateInfo.start >= 195 && Math.abs(lateInfo.start - lateInfo.expected) < 5, JSON.stringify(lateInfo));
  await late.close();

  // ---- 내 창만 닫기
  await friend.click('#tv-close');
  t.check('closing the window keeps the video on the room TV', !(await panelOpen(friend)) && (await live(friend)).length === 1 && await panelOpen(page));
  await wait(80);
  const mini = await friend.evaluate(() => {
    const r = document.getElementById('tv-video').getBoundingClientRect();
    const f = terrain.furnByZone[zone].find((x) => x.k === 'tv_wall');
    const s = tvScreenRect(f);
    const [camX, camY] = camera(innerWidth, innerHeight);
    return { ok: Math.abs(r.left - (s.x - camX)) < 1 && Math.abs(r.top - (s.y - camY)) < 1 && Math.abs(r.width - s.w) < 1 && Math.abs(r.height - s.h) < 1, inner: document.getElementById('tv-video').offsetWidth, events: getComputedStyle(document.getElementById('tv-video')).pointerEvents };
  });
  t.check('the video sits exactly on the room TV', mini.ok, JSON.stringify(mini));
  t.check('the small player keeps a real player size', mini.inner === 356, mini.inner);
  t.check('the small video does not catch the mouse', mini.events === 'none', mini.events);
  await wait(1100);
  await page.click('#tv-toggle');
  await friend.waitForFunction(() => tvState.paused, null, { timeout: 2000 });
  await wait(1100);
  t.check('same video stays closed for me', !(await panelOpen(friend)));
  await page.click('#tv-toggle');
  await friend.waitForFunction(() => !tvState.paused, null, { timeout: 2000 });

  // ---- 다른 영상을 틀면 다시 열리고, 열려 있던 사람은 영상만 바뀐다
  await wait(1100);
  await page.evaluate((id) => { tvUrl.value = id; tvForm.requestSubmit(); }, OTHER);
  await tvActive(friend, OTHER);
  t.check('a new video reopens the window', await panelOpen(friend) && (await live(friend))[0].video === OTHER, JSON.stringify(await live(friend)));
  await wait(1300);
  t.check('open players switch video', (await live(page))[0].video === OTHER && (await live(page))[0].calls.includes('load'), JSON.stringify(await live(page)));

  // ---- 영상을 못 트는 경우
  await page.evaluate(() => window.__yt.players.at(-1).options.events.onError({ data: 150 }));
  t.check('blocked videos are explained', (await page.textContent('#tv-status')).includes('외부 재생'), await page.textContent('#tv-status'));

  // ---- 인스타 릴스
  await wait(1100);
  const reelCodes = await page.evaluate((list) => list.map(parseReelCode), [
    'https://www.instagram.com/reel/DAbC_d-123/', 'instagram.com/reels/DAbC_d-123?igsh=x', 'https://www.instagram.com/p/DAbC_d-123/', 'https://www.instagram.com/someone/reel/DAbC_d-123/',
  ]);
  t.check('Reels links are understood', reelCodes.every((c) => c === 'DAbC_d-123'), reelCodes.join());
  const notReels = await page.evaluate((list) => list.map(parseReelCode), ['https://evil.example/reel/DAbC_d-123/', 'https://www.instagram.com/someone/', 'hello']);
  t.check('other links are not Reels', notReels.every((c) => c === null), notReels.join());
  await page.route('https://www.instagram.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>reel</p>' }));
  await friend.route('https://www.instagram.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>reel</p>' }));
  await page.evaluate(() => { setTvSource('reel'); tvUrl.value = 'https://www.instagram.com/reel/DAbC_d-123/'; tvForm.requestSubmit(); });
  await friend.waitForFunction(() => tvState?.reel && tvReelFrame, null, { timeout: 2000 });
  t.check('a reel reaches the room', (await friend.$eval('#tv-video iframe', (el) => el.src)) === 'https://www.instagram.com/reel/DAbC_d-123/embed/', await friend.$eval('#tv-video iframe', (el) => el.src));
  t.check('reels hide the sync controls', !(await friend.isVisible('#tv-toggle')) && await friend.isVisible('#tv-stop'));
  t.check('reels explain how to play', (await friend.textContent('#tv-status')).includes('각자'), await friend.textContent('#tv-status'));
  await page.evaluate(() => { setTvSource('youtube'); tvUrl.value = 'dQw4w9WgXcQ'; });
  await wait(1100);
  await page.evaluate(() => tvForm.requestSubmit());
  await tvActive(friend, VIDEO);
  t.check('switching back removes the reel', await friend.evaluate(() => tvReelFrame === null && !!tvPlayer));
  await wait(1200);
  await page.evaluate(() => { tvUrl.value = 'jNQXAC9IVRw'; tvForm.requestSubmit(); });
  await tvActive(friend, OTHER);
  await wait(1300);

  // ---- 끝까지 보면 꺼진다
  await wait(1100);
  await page.evaluate(() => { const p = window.__yt.players.at(-1); p.state = 0; p.options.events.onStateChange({ data: 0 }); });
  await friend.waitForFunction(() => tvState === null, null, { timeout: 2000 });
  t.check('the end of the video closes the TV', !(await panelOpen(friend)) && !(await panelOpen(page)));
  await wait(100);
  t.check('players are removed', (await live(page)).length === 0 && (await live(friend)).length === 0);

  // ---- TV 끄기
  await wait(1100);
  await page.keyboard.press('KeyT');
  await page.fill('#tv-url', VIDEO);
  await page.press('#tv-url', 'Enter');
  await tvActive(friend, VIDEO);
  await wait(1100);
  await friend.click('#tv-stop');
  await page.waitForFunction(() => tvState === null, null, { timeout: 2000 });
  await friend.waitForFunction(() => tvState === null, null, { timeout: 2000 });
  t.check('TV off closes it for everyone', !(await panelOpen(page)) && !(await panelOpen(friend)));

  // ---- 방을 나가면 꺼지고, 다른 집은 따로
  await wait(1100);
  const door = await open('door');
  await page.keyboard.press('KeyT');
  await page.fill('#tv-url', VIDEO);
  await page.press('#tv-url', 'Enter');
  await tvActive(door, VIDEO);
  await door.keyboard.press('KeyE');  // 문 앞에서 E 는 TV 가 아니라 문이다
  await door.waitForFunction(() => zone === 0, null, { timeout: 2000 });
  await wait(150);
  t.check('leaving the room closes the TV', !(await panelOpen(door)) && (await live(door)).length === 0);
  await door.close();
  const rara = await open('rara');
  await wait(300);
  t.check('other houses are not playing', !(await panelOpen(rara)));
  t.check('each house has its own TV hint', (await pageHint(rara)).includes('T: TV 보기'), await pageHint(rara));
  await rara.close();

  // ---- 좁은 화면
  const phoneFit = await open('friend', { viewport: { width: 390, height: 720 } });
  await phoneFit.waitForSelector('#tv:not([hidden])', { timeout: 3000 });
  const fits = await phoneFit.evaluate(() => {
    const b = document.getElementById('tv').getBoundingClientRect();
    return b.left >= 0 && b.right <= innerWidth && b.height < innerHeight;
  });
  t.check('TV window fits a phone', fits);

  const problems = [...page.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
