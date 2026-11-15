// 화면 공유: 한 사람의 화면을 극장 스크린에 띄운다. 서버는 누가 공유하는지와 연결 정보만 전한다
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, stubYouTube, wait } from '../lib.mjs';

const THEATER = 4;

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({ host: [THEATER, 500, 240], guest: [THEATER, 410, 300], late: [THEATER, 940, 30], far: [0, 820, 620] });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(80);
    return bot;
  };
  const host = await enter('host');
  const guest = await enter('guest');
  const far = await enter('far');
  host.send('tv share');
  await guest.until(() => guest.lastEvent('tv')?.share === host.id, 1000);
  t.check('everyone in the room learns who is sharing', guest.lastEvent('tv')?.share === host.id && guest.lastEvent('tv').sn === 'host' && host.lastEvent('tv')?.share === host.id, JSON.stringify(guest.lastEvent('tv')));
  t.check('it stays in that room', !far.lastEvent('tv'));

  guest.send(`rtc ${host.id} {"t":"want"}`);
  await host.until(() => host.lastEvent('rtc'), 1000);
  t.check('a viewer can reach the sharer', host.lastEvent('rtc')?.from === guest.id && JSON.parse(host.lastEvent('rtc').d).t === 'want', JSON.stringify(host.lastEvent('rtc')));
  const sdp = JSON.stringify({ t: 'offer', sdp: 'v=0\r\na=quote "x" \\ back\r\n' });
  host.send(`rtc ${guest.id} ${sdp}`);
  await guest.until(() => guest.lastEvent('rtc'), 1000);
  t.check('connection details arrive unchanged', guest.lastEvent('rtc')?.d === sdp, guest.lastEvent('rtc')?.d);
  far.send(`rtc ${host.id} {"t":"want"}`);
  guest.send(`rtc ${far.id} {"t":"want"}`);
  await wait(150);
  t.check('nothing is relayed to or from another room', host.events.filter((e) => e.t === 'rtc').length === 1 && !far.lastEvent('rtc'));

  guest.send('tv pause');
  await wait(120);
  t.check('a share cannot be paused', guest.lastEvent('tv')?.share === host.id && !guest.lastEvent('tv').paused);
  const late = await enter('late');
  t.check('someone arriving later is told about the share', late.lastEvent('tv')?.share === host.id);

  // 공유하던 사람이 방을 나가면 끝난다
  await host.walkTo(host.map.zones[THEATER].door[0], host.map.zones[THEATER].door[1] - 30, 8);
  host.send('use door');
  await guest.until(() => guest.lastEvent('tv')?.v === '', 3000);
  t.check('the share ends when the sharer leaves the room', guest.lastEvent('tv')?.v === '' && !guest.lastEvent('tv').share);

  guest.send('tv share');
  await late.until(() => late.lastEvent('tv')?.share === guest.id, 1000);
  guest.close();
  await late.until(() => late.lastEvent('tv')?.v === '', 2000);
  t.check('and when the sharer disconnects', late.lastEvent('tv')?.v === '');
  late.send('tv share');
  await late.until(() => late.lastEvent('tv')?.share === late.id, 1000);
  late.send('tv play dQw4w9WgXcQ');
  await late.until(() => late.lastEvent('tv')?.v === 'dQw4w9WgXcQ', 1000);
  t.check('playing a video replaces the share', late.lastEvent('tv')?.v === 'dQw4w9WgXcQ' && !late.lastEvent('tv').share);
  for (const bot of [host, late, far]) bot.close();
  await wait(100);
  await server.stop();
}

async function ui(t) {
  const { server, ids } = await serverWithAccounts({ one: [THEATER, 410, 300], two: [THEATER, 470, 300] });
  const chrome = await launchBrowser();
  const open = async (name) => {
    const page = await openPage(chrome, server);
    await stubYouTube(page);
    await loginPage(page, ids[name]);
    await enterPage(page, { name });
    await page.waitForFunction(() => zone === 4, null, { timeout: 3000 });
    // 화면 고르기 창 대신 움직이는 그림을 화면으로 내준다
    await page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const g = canvas.getContext('2d');
        let n = 0;
        setInterval(() => {
          g.fillStyle = `hsl(${(n += 20) % 360}, 80%, 50%)`;
          g.fillRect(0, 0, 640, 360);
        }, 50);
        return canvas.captureStream(20);
      };
    });
    return page;
  };
  const one = await open('one');
  const two = await open('two');
  await one.evaluate(() => openTvPanel());
  t.check('the TV window offers screen sharing', await one.isVisible('#tv-tiles [data-source="share"]'));
  // 범위를 고르는 창이 먼저 뜨고, 취소하면 아무것도 보내지 않는다
  await one.click('#tv-tiles [data-source="share"]');
  await one.waitForSelector('#share-crop:not([hidden])', { timeout: 3000 });
  t.check('picking a screen first asks for the range, sending nothing yet', await one.evaluate(() => !tvState && !!shareRaw && canCropShare));
  await one.keyboard.press('Escape');
  t.check('cancelling lets go of the screen', !(await one.isVisible('#share-crop')) && await one.evaluate(() => !shareRaw && !shareStream && !tvState));

  await one.evaluate(() => { shareCrop = { x: 0, y: 0, w: 1, h: 1 }; });
  await one.click('#tv-tiles [data-source="share"]');
  await one.waitForSelector('#share-crop:not([hidden])', { timeout: 3000 });
  await one.waitForFunction(() => shareCropVideo.videoWidth > 0, null, { timeout: 3000 });
  const stage = await one.$eval('#share-crop-stage', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await one.mouse.move(stage.x + stage.w * 0.25, stage.y + stage.h * 0.25);   // 가운데 절반을 끌어서 고른다
  await one.mouse.down();
  await one.mouse.move(stage.x + stage.w * 0.5, stage.y + stage.h * 0.5, { steps: 4 });
  await one.mouse.move(stage.x + stage.w * 0.75, stage.y + stage.h * 0.75, { steps: 4 });
  await one.mouse.up();
  const drawn = await one.evaluate(() => cropDraft);
  t.check('dragging draws the range', Math.abs(drawn.x - 0.25) < 0.02 && Math.abs(drawn.y - 0.25) < 0.02 && Math.abs(drawn.w - 0.5) < 0.02 && Math.abs(drawn.h - 0.5) < 0.02, JSON.stringify(drawn));
  await one.mouse.move(stage.x + stage.w * 0.5, stage.y + stage.h * 0.5);     // 네모 안을 끌면 옮겨진다
  await one.mouse.down();
  await one.mouse.move(stage.x + stage.w * 0.25, stage.y + stage.h * 0.25, { steps: 4 });
  await one.mouse.up();
  const moved = await one.evaluate(() => cropDraft);
  t.check('dragging inside moves it', Math.abs(moved.x) < 0.02 && Math.abs(moved.y) < 0.02 && Math.abs(moved.w - 0.5) < 0.02, JSON.stringify(moved));
  await one.screenshot({ path: path.join(SHOTS, 'share_crop.png') });
  await one.click('#share-crop-ok');
  await one.waitForFunction(() => tvState?.share === myId && !!tvShareEl?.srcObject, null, { timeout: 3000 });
  t.check('the range is remembered', await one.evaluate(() => Math.abs(JSON.parse(localStorage.getItem('mmo.shareCrop')).w - 0.5) < 0.02));
  t.check('the sharer sees their own screen, muted', await one.evaluate(() => tvShareEl.muted && tvShareEl.srcObject === shareStream));
  t.check('the window shows a stop button and no seek bar', (await one.textContent('#tv-stop')) === '공유 끝내기' && !(await one.isVisible('#tv-time-bar')) && await one.isVisible('#tv-mute'));
  let arrived = true;
  await two.waitForFunction(() => tvShareEl?.videoWidth > 0, null, { timeout: 10000 }).catch(() => { arrived = false; });
  t.check('the other person receives the picture', arrived, JSON.stringify(await two.evaluate(() => ({ share: tvState?.share, peer: viewPeer?.connectionState, status: tvStatus.textContent }))));
  const half = await two.evaluate(() => [tvShareEl.videoWidth, tvShareEl.videoHeight]);
  t.check('only the chosen range is sent', half[0] === 320 && half[1] === 180, JSON.stringify(half));
  t.check('the sharer can change the range while sharing', await one.isVisible('#tv-crop') && !(await two.isVisible('#tv-crop')));
  await one.click('#tv-crop');
  await one.click('#share-crop-all');
  t.check('the button now says apply', (await one.textContent('#share-crop-ok')) === '적용');
  await one.click('#share-crop-ok');
  let widened = true;
  await two.waitForFunction(() => tvShareEl?.videoWidth === 640, null, { timeout: 5000 }).catch(() => { widened = false; });
  t.check('the new range reaches the viewer without restarting', widened && await one.evaluate(() => tvState?.share === myId), JSON.stringify(await two.evaluate(() => [tvShareEl?.videoWidth, tvShareEl?.videoHeight])));
  const sent = () => one.evaluate(() => { const p = [...sharePeers.values()][0].getSenders().find((x) => x.track?.kind === 'video').getParameters(); return [p.encodings[0].maxBitrate, p.degradationPreference]; });
  t.check('it starts in high quality, keeping the picture sharp', (await sent()).join() === '6000000,maintain-resolution', (await sent()).join());
  await one.click('#tv-crop');
  await one.selectOption('#share-quality', 'max');
  await one.selectOption('#share-prefer', 'smooth');
  await one.click('#share-crop-ok');
  await wait(150);
  t.check('the sharer can change quality while sharing, and it is remembered', (await sent()).join() === '12000000,maintain-framerate' && await one.evaluate(() => localStorage.getItem('mmo.shareQuality') === 'max' && localStorage.getItem('mmo.sharePrefer') === 'smooth'), (await sent()).join());
  t.check('it plays on the theater screen with the full screen buttons', await two.evaluate(() => cinemaAvailable()) && await two.isVisible('#cinema-go'));
  await two.evaluate(() => { tvMuted = true; applyTvSound(); });
  t.check('my mute applies to the shared screen', await two.evaluate(() => tvShareEl.muted));
  await wait(300);
  await two.screenshot({ path: path.join(SHOTS, 'share_viewer.png') });
  await one.click('#tv-stop');
  await two.waitForFunction(() => !tvState, null, { timeout: 2000 });
  await wait(100);
  t.check('ending the share clears the screen and stops capturing', await two.evaluate(() => !tvShareEl && !viewPeer) && await one.evaluate(() => !shareStream && sharePeers.size === 0));
  t.check('no script errors', one.problems.length === 0 && two.problems.length === 0, [...one.problems, ...two.problems].join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
