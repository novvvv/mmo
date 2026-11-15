// 극장 전체화면: 영상이 화면을 채우고 왼쪽 아래에 같은 방 사람과 채팅이 뜬다
import path from 'node:path';
import { enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, stubYouTube, wait } from '../lib.mjs';

const THEATER = 4;
const VIDEO = 'dQw4w9WgXcQ';

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({ one: [THEATER, 410, 300], two: [THEATER, 470, 300] });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server);
    await stubYouTube(page);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await page.waitForFunction(() => zone === 4, null, { timeout: 3000 });
    return page;
  };
  const one = await open('one');
  const two = await open('two');
  t.check('no full screen button without a video', !(await one.isVisible('#cinema-full')));
  t.check('the theater has its own music', (await one.evaluate(() => Sound.current())) === 'theater');
  await one.evaluate((v) => sendTv(`play ${v}`), VIDEO);
  await one.waitForFunction(() => cinemaAvailable(), null, { timeout: 3000 });
  await two.waitForFunction(() => cinemaAvailable(), null, { timeout: 3000 });
  await wait(100);
  t.check('music stops for the movie', (await one.evaluate(() => Sound.current())) === null);
  t.check('the full screen button appears', await one.isVisible('#cinema-full'));

  const go = await one.$eval('#cinema-go', (e) => { const r = e.getBoundingClientRect(); return { shown: !e.hidden, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  t.check('a big full screen button sits on the screen', go.shown && go.in, JSON.stringify(go));
  await one.screenshot({ path: path.join(SHOTS, 'cinema_button.png') });
  await one.click('#cinema-go-full');
  await wait(150);
  const box = await one.$eval('#tv-video', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  const size = await one.evaluate(() => [innerWidth, innerHeight]);
  t.check('the video fills the window', Math.abs(box[2] - size[0]) < 2 && Math.abs(box[3] - size[1]) < 2, JSON.stringify([box, size]));
  t.check('both people show bottom left', (await one.$$('.cinema-person')).length === 2);
  const panel = await one.$eval('#cinema-hud', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.bottom]; });
  t.check('the avatars sit in the lower left', panel[0] < 60 && panel[1] > size[1] - 60, JSON.stringify(panel));

  await two.evaluate(() => ws.send('chat 이 장면 좋다'));
  await one.waitForFunction(() => [...document.querySelectorAll('.cinema-bubble')].some((b) => !b.hidden && b.textContent.includes('이 장면')), null, { timeout: 2000 });
  t.check('chat appears as a bubble', true);
  await one.keyboard.press('Enter');
  await one.keyboard.type('나도 좋아');
  await one.keyboard.press('Enter');
  await two.waitForFunction(() => chatLog.textContent.includes('나도 좋아'), null, { timeout: 2000 });
  t.check('you can chat in full screen', true);
  await wait(200);
  await one.screenshot({ path: path.join(SHOTS, 'cinema_full.png') });
  await one.keyboard.press('Escape');
  await wait(100);
  t.check('Esc leaves full screen', !(await one.isVisible('#cinema-hud')) && await one.evaluate(() => !cinemaFull));
  t.check('the button comes back after leaving', await one.isVisible('#cinema-go'));

  // ---- 보는 방식 고르기: 티비플, 전체화면(채팅 끄기), 극장
  await one.click('#cinema-go-full');
  await wait(100);
  await one.click('#cinema-chat-off');
  t.check('chat can be turned off in full screen', !(await one.isVisible('#cinema-hud')) && await one.evaluate(() => cinemaFull && localStorage.getItem('mmo.cinemaChatOff') === '1'));
  await one.screenshot({ path: path.join(SHOTS, 'cinema_chat_off.png') });
  await one.keyboard.press('Enter');
  t.check('Enter brings the chat back', await one.isVisible('#cinema-hud') && await one.evaluate(() => document.activeElement === cinemaInput));
  await one.keyboard.press('Escape');
  await one.click('#cinema-mode-flow');
  await wait(100);
  t.check('flow mode keeps the video full and hides the faces', await one.evaluate(() => cinemaMode === 'flow' && cinemaFull) && !(await one.isVisible('#cinema-people')) && await one.isVisible('#cinema-input') && !(await one.isVisible('#cinema-chat-off')));
  await two.evaluate(() => ws.send('chat ㅋㅋㅋㅋㅋ'));
  await one.keyboard.press('Enter');
  await one.keyboard.type('여기 명장면');
  await one.keyboard.press('Enter');
  await one.waitForFunction(() => document.querySelectorAll('.flow-line').length === 2, null, { timeout: 2000 });
  await wait(1500);
  const lines = await one.$$eval('.flow-line', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, mine: e.classList.contains('mine'), left: r.left, top: r.top }; }));
  t.check('chat flies in from the right, each on its own line', lines.length === 2 && lines.every((l) => l.left < 1100 && l.left > 0) && lines[0].top !== lines[1].top && lines.find((l) => l.text === '여기 명장면')?.mine === true, JSON.stringify(lines));
  await one.screenshot({ path: path.join(SHOTS, 'cinema_flow.png') });
  await one.click('#cinema-exit');
  await wait(100);
  t.check('the theater button goes back to the seats', await one.evaluate(() => cinemaMode === 'room' && !cinemaFull) && !(await one.isVisible('#cinema-bar')) && !(await one.isVisible('#cinema-flow')));
  await one.click('#cinema-full');
  await wait(100);
  t.check('the top button reopens the last mode', await one.evaluate(() => cinemaMode === 'flow'));
  await one.keyboard.press('Escape');
  await wait(100);

  // ---- 지도에 친구가 있는 곳
  const marks = await one.evaluate(() => {
    const two = [...entities.entries()].find(([, e]) => e.name === 'two')[0];
    myFriends = [['two', two, zone, 0, 0, 0], ['멀리', 9999, 0, 0, 0, 0], ['쉬는중', 0, -1, 0, 0, 0]];
    setMapOpen(true);
    return friendMapMarks();
  });
  const theater = await one.evaluate(() => { const b = terrain.buildings[terrain.zones[zone].b]; return [b.x, b.y]; });
  t.check('a friend indoors is marked at that building, an offline one is not', marks.length === 2 && marks[0].name === 'two' && marks[0].inside && marks[0].x === theater[0] && marks[0].y === theater[1], JSON.stringify(marks));
  t.check('a friend out in the village is listed without a spot while I am indoors', marks[1].name === '멀리' && marks[1].x === undefined);
  await wait(100);
  const pink = await one.evaluate(() => {   // 내 표시가 같은 입구를 덮으므로 이름 글씨에서 친구 색을 찾는다
    const scale = minimap.width / world.w, b = terrain.buildings[terrain.zones[zone].b];
    const d = minimapCtx.getImageData(Math.max(0, b.x * scale - 40), b.y * scale + 11, 80, 20).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 126 && d[i + 2] === 182) return true;
    return false;
  });
  t.check('the map writes the friend\'s name there', pink);
  await (await one.$('#map-win')).screenshot({ path: path.join(SHOTS, 'cinema_map_friends.png') });
  t.check('no script errors', one.problems.length === 0 && two.problems.length === 0, [...one.problems, ...two.problems].join(' | '));
  await chrome.close();
  await server.stop();
}
