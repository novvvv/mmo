// 캬캬 집의 피아노: 프로토콜, 건반 창, 실제로 나는 소리
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageHint, pageSelf, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const RARA = 2, KYAKYA = 3;
const shot = (name) => path.join(SHOTS, name);
const notes = (bot) => bot.events.filter((e) => e.t === 'note');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    player: [KYAKYA, 590, 140], listener: [KYAKYA, 760, 330], beanbag: [KYAKYA, 864, 250], rara: [RARA, 300, 200], outside: [0, 720, 620],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const player = await enter('player');
  const listener = await enter('listener');
  const beanbag = await enter('beanbag');
  const rara = await enter('rara');
  const outside = await enter('outside');

  const seatIndex = player.map.pianoSeat;
  const stool = player.map.seats[seatIndex];
  t.check('map names the piano seat in 캬캬 house', stool?.z === KYAKYA && stool.x === 590 && stool.y === 110, JSON.stringify(stool));

  player.send('note 3');
  await wait(100);
  t.check('cannot play without sitting', notes(listener).length === 0);

  player.send('use');
  await wait(100);
  t.check('E sits at the piano', player.me.s === seatIndex + 1, JSON.stringify(player.me));

  player.send('note 9');
  await listener.until(() => notes(listener).length === 1, 1000);
  await wait(60);
  t.check('others in the room hear the note', notes(listener)[0]?.n === 9 && notes(listener)[0]?.id === player.id, JSON.stringify(notes(listener)));
  t.check('player gets no echo', notes(player).length === 0);
  t.check('other rooms hear nothing', notes(rara).length === 0);
  t.check('outdoors hears nothing', notes(outside).length === 0);

  player.send('note 0');
  player.send('note 16');
  await listener.until(() => notes(listener).length === 3, 1000);
  t.check('lowest and highest keys work', notes(listener).slice(1).map((n) => n.n).join() === '0,16', JSON.stringify(notes(listener)));

  const heard = notes(listener).length;
  for (const bad of ['note', 'note ', 'note -1', 'note 17', 'note 3x', 'note abc', 'note 1.5', 'note 99999999999999999999']) player.send(bad);
  await wait(120);
  t.check('invalid notes are ignored', notes(listener).length === heard, JSON.stringify(notes(listener).slice(heard)));
  t.check('sender stays connected', !player.closed);

  // ---- 다른 자리에 앉은 사람은 칠 수 없다
  beanbag.send('use');
  await wait(100);
  t.check('someone else sits elsewhere', beanbag.me.s > 0 && beanbag.me.s !== seatIndex + 1, JSON.stringify(beanbag.me));
  beanbag.send('note 5');
  await wait(100);
  t.check('another seat cannot play the piano', notes(listener).length === heard);

  // ---- 도배 제한
  await wait(1100);
  for (let i = 0; i < 100; i++) player.send(`note ${i % 17}`);
  await wait(200);
  const delivered = notes(listener).length - heard;
  t.check('rapid notes are limited', delivered >= 15 && delivered <= 26, delivered);
  t.check('rapid notes do not disconnect', !player.closed && !listener.closed);

  // ---- 일어나면 못 친다
  player.send('use');
  await wait(100);
  t.check('E stands up from the piano', !player.me.s);
  await wait(1100);
  const afterStand = notes(listener).length;
  player.send('note 4');
  await wait(100);
  t.check('cannot play after standing up', notes(listener).length === afterStand);

  for (const bot of [player, listener, beanbag, rara, outside]) bot.close();
  await wait(100);
  await server.stop();
}

// 소리 출력 직전에 분석기를 달아 실제로 만들어진 파형을 본다.
const attachAnalyser = (page) => page.evaluate(() => {
  const analyser = audio.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0;
  audioOut.connect(analyser);
  window.__analyser = analyser;
});
const heardPitch = (page) => page.evaluate(() => {
  const analyser = window.__analyser;
  const bins = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(bins);
  let best = 1;
  for (let i = 1; i < bins.length; i++) if (bins[i] > bins[best]) best = i;
  return { hz: Math.round((best * audio.sampleRate) / analyser.fftSize), db: Math.round(bins[best]) };
});
// 재생 함수 호출을 기록한다.
const recordNotes = (page) => page.evaluate(() => {
  window.__played = [];
  const original = playPianoNote;
  window.playPianoNote = (index) => { window.__played.push(index); original(index); };
});
const played = (page) => page.evaluate(() => window.__played);
const panelOpen = (page) => page.isVisible('#piano');

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    player: [KYAKYA, 590, 140], listener: [KYAKYA, 760, 330], rara: [RARA, 300, 200], phone: [KYAKYA, 590, 150],
  });
  const browser = await launchBrowser();
  const open = (name, options = {}) => enterGame(browser, server, ids[name], { name, ...options });
  const page = await open('player');
  const listener = await open('listener');
  const rara = await open('rara');
  await wait(250);

  t.check('panel is closed before sitting', !(await panelOpen(page)));
  t.check('hint offers the piano', (await pageHint(page)).includes('E: 피아노 치기'), await pageHint(page));
  t.check('sound is allowed after logging in', await listener.evaluate(() => audio?.state === 'running'), await listener.evaluate(() => audio?.state));

  await page.keyboard.press('KeyE');
  await page.waitForSelector('#piano:not([hidden])', { timeout: 2000 });
  const start = await pageSelf(page);
  t.check('sitting opens the keyboard', await panelOpen(page) && start.seat > 0);
  t.check('all 17 keys are on screen', (await page.$$('.piano-key')).length === 17);
  t.check('hint says how to leave', (await pageHint(page)).startsWith('Esc: 일어나기'), await pageHint(page));
  await wait(100);
  t.check('someone else does not get the keyboard', !(await panelOpen(listener)));

  // ---- 실제 소리: 친 사람과 듣는 사람 모두 같은 음높이
  await attachAnalyser(page);
  await attachAnalyser(listener);
  await attachAnalyser(rara);
  await recordNotes(listener);
  await recordNotes(rara);
  t.check('silence before anyone plays', (await heardPitch(listener)).db < -90, JSON.stringify(await heardPitch(listener)));

  await page.keyboard.press('KeyH');  // A4 = 440Hz
  await listener.waitForFunction(() => window.__played.length === 1, null, { timeout: 2000 });
  await wait(120);
  const mine = await heardPitch(page);
  const theirs = await heardPitch(listener);
  t.check('player hears A4', Math.abs(mine.hz - 440) < 10 && mine.db > -60, JSON.stringify(mine));
  t.check('listener hears the same note', Math.abs(theirs.hz - 440) < 10 && theirs.db > -60, JSON.stringify(theirs));
  t.check('other house stays silent', (await played(rara)).length === 0 && (await heardPitch(rara)).db < -90, JSON.stringify(await heardPitch(rara)));
  t.check('listener sees notes floating', await listener.evaluate(() => noteFx.length > 0));
  await page.screenshot({ path: shot('piano_playing.png') });

  await page.keyboard.press('KeyK');  // 한 옥타브 위의 C5 = 523Hz
  await wait(120);
  await listener.waitForFunction(() => window.__played.length === 2, null, { timeout: 2000 });
  t.check('each key has its own pitch', (await played(listener)).join() === '9,12', (await played(listener)).join());

  // ---- 게임 조작 키도 건반으로 쓰인다
  for (const key of ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyC', 'KeyX', 'Semicolon']) await page.keyboard.press(key);
  await wait(200);
  const still = await pageSelf(page);
  t.check('letter keys do not move or stand up', still.seat === start.seat && Math.hypot(still.sx - start.sx, still.sy - start.sy) < 0.5, JSON.stringify([still, start]));
  t.check('keys reach the right notes', (await played(listener)).slice(2).join() === '0,1,2,3,4,5,16', (await played(listener)).join());

  // ---- 화면의 건반을 마우스로
  const beforeClick = (await played(listener)).length;
  await page.click('.piano-key[data-note="7"]');
  await page.click('.piano-key[data-note="8"]');  // 검은 건반
  await listener.waitForFunction((n) => window.__played.length === n, beforeClick + 2, { timeout: 2000 });
  t.check('clicking keys plays them', (await played(listener)).slice(beforeClick).join() === '7,8', (await played(listener)).join());
  t.check('a pressed key lights up', await page.evaluate(() => { pressPiano(4); return pianoKeyEls[4].classList.contains('down'); }));
  await wait(250);
  t.check('the key is released again', await page.evaluate(() => !pianoKeyEls[4].classList.contains('down')));

  // ---- 앉은 채로 채팅
  const beforeChat = (await played(listener)).length;
  await page.keyboard.press('Enter');
  await page.keyboard.type('asdfgh');
  await page.keyboard.press('Enter');
  await listener.waitForFunction(() => document.getElementById('chat-log').textContent.includes('asdfgh'), null, { timeout: 2000 });
  t.check('typing a chat does not play notes', (await played(listener)).length === beforeChat, (await played(listener)).length - beforeChat);
  t.check('chat keeps the seat', (await pageSelf(page)).seat === start.seat);

  // ---- 화면 배치
  const layout = await page.evaluate(() => {
    const p = document.getElementById('piano').getBoundingClientRect();
    const c = document.getElementById('chat').getBoundingClientRect();
    return { apart: p.left >= c.right, inside: p.right <= innerWidth && p.bottom <= innerHeight };
  });
  t.check('keyboard does not cover the chat', layout.apart && layout.inside, JSON.stringify(layout));

  // ---- 일어나기
  await page.keyboard.press('Escape');
  await page.waitForSelector('#piano', { state: 'hidden', timeout: 2000 });
  t.check('Esc stands up and closes the keyboard', (await pageSelf(page)).seat === 0);
  const beforeWalk = await pageSelf(page);
  const countBefore = (await played(listener)).length;
  await page.keyboard.down('KeyS');
  await wait(250);
  await page.keyboard.up('KeyS');
  await wait(120);
  t.check('keys are for walking again', (await pageSelf(page)).y > beforeWalk.y + 15, JSON.stringify(await pageSelf(page)));
  t.check('walking plays no notes', (await played(listener)).length === countBefore);

  await pageWalkBack(page);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#piano:not([hidden])', { timeout: 2000 });
  await page.click('#piano-leave');
  await page.waitForSelector('#piano', { state: 'hidden', timeout: 2000 });
  t.check('the leave button works', (await pageSelf(page)).seat === 0);

  // 방향키로 걸어 나가도 건반 창이 닫힌다
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#piano:not([hidden])', { timeout: 2000 });
  await page.keyboard.down('ArrowDown');
  await page.waitForSelector('#piano', { state: 'hidden', timeout: 2000 });
  await page.keyboard.up('ArrowDown');
  t.check('walking away closes the keyboard', !(await panelOpen(page)));

  // ---- 좁은 화면
  await page.close();
  const phone = await open('phone', { viewport: { width: 390, height: 720 } });
  await wait(200);
  await phone.keyboard.press('KeyE');
  await phone.waitForSelector('#piano:not([hidden])', { timeout: 2000 });
  await phone.screenshot({ path: shot('piano_phone.png') });
  const fits = await phone.evaluate(() => {
    const p = document.getElementById('piano').getBoundingClientRect();
    const c = document.getElementById('chat').getBoundingClientRect();
    const g = document.getElementById('bag').getBoundingClientRect();
    return p.left >= 0 && p.right <= innerWidth && p.top >= g.bottom && p.bottom <= c.top;
  });
  t.check('keyboard fits a phone', fits);

  const problems = [...listener.problems, ...rara.problems, ...phone.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

// 건반에서 멀어진 만큼 의자 앞으로 되돌아온다.
async function pageWalkBack(page) {
  await page.keyboard.down('KeyW');
  await wait(250);
  await page.keyboard.up('KeyW');
  await wait(150);
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
