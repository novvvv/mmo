// 휴대폰: 조이스틱으로 걷고, 캐릭터 아래 안내 대신 오른쪽 아래 버튼으로 E/F/Z 등을 누른다
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, pageSelf, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const shot = (name) => path.join(SHOTS, name);

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({ phone: [0, 720, 600], friend: [0, 790, 610], desk: [0, 620, 620] });
  const chrome = await launchBrowser();
  const openPhone = async (viewport) => {
    const context = await chrome.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.problems = [];
    page.on('pageerror', (e) => page.problems.push(e.message));
    await page.goto(server.url);
    await loginPage(page, ids.phone);
    await enterPage(page, { name: 'phone' });
    await page.waitForFunction(() => !document.getElementById('touch-pad').hidden, null, { timeout: 3000 });
    await wait(200);
    return page;
  };
  const friend = await Bot.enter(server, 'friend', { id: ids.friend });
  const phone = await openPhone({ width: 390, height: 844 });
  const actions = () => phone.locator('#touch-actions').innerText();

  t.check('a touch screen gets a joystick', await phone.isVisible('#stick'));
  t.check('the hint becomes buttons', (await actions()).includes('앉기') && (await actions()).includes('가방'), await actions());
  const hud = await phone.locator('#hud').boundingBox(), sound = await phone.locator('#sound-bar').boundingBox();
  t.check('the status line stays clear of the sound buttons', hud.x + hud.width <= sound.x, JSON.stringify([hud, sound]));
  const stick = await phone.locator('#stick').boundingBox(), chat = await phone.locator('#chat').boundingBox();
  t.check('the joystick sits above the chat', stick.y + stick.height <= chat.y, JSON.stringify([stick, chat]));
  await phone.screenshot({ path: shot('mobile_portrait.png') });

  // 다른 사람을 누르면 교환 메뉴가 열린다 (휴대폰에는 우클릭이 없다)
  const other = await phone.evaluate(() => {
    const [camX, camY] = camera(innerWidth, innerHeight);
    for (const [id, e] of entities) if (id !== myId) return [e.x - camX, e.y - bodyLift(e) - camY];
  });
  await phone.touchscreen.tap(other[0], other[1]);
  await wait(150);
  t.check('tapping someone opens the player menu', await phone.isVisible('#player-menu'));
  await phone.touchscreen.tap(60, 300);
  await wait(100);
  t.check('tapping elsewhere closes it', !(await phone.isVisible('#player-menu')));

  // 조이스틱: 오른쪽 위로 밀면 그쪽으로 걷고, 놓으면 선다
  const start = await phone.evaluate(() => ({ x: me.x, y: me.y }));
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await phone.mouse.move(cx, cy);
  await phone.mouse.down();
  await phone.mouse.move(cx + 60, cy - 10, { steps: 3 });
  await wait(600);
  const walking = await phone.evaluate(() => ({ x: me.x, y: me.y, input }));
  t.check('pushing the stick walks that way', walking.input === 8 && walking.x > start.x + 40 && Math.abs(walking.y - start.y) < 4, JSON.stringify([start, walking]));
  await phone.mouse.move(cx, cy - 60, { steps: 3 });
  await wait(300);
  t.check('the stick turns while held', (await phone.evaluate(() => input)) === 1);
  await phone.mouse.up();
  await wait(250);
  // 서버가 정한 위치로 본다. 화면의 내 위치는 멈춘 뒤 서버 위치로 몇 픽셀 부드럽게 맞춰 간다.
  const stopped = await phone.evaluate(() => ({ x: entities.get(myId).x, y: entities.get(myId).y, input }));
  await wait(400);
  const later = await phone.evaluate(() => ({ x: entities.get(myId).x, y: entities.get(myId).y }));
  t.check('letting go stops', stopped.input === 0 && Math.hypot(later.x - stopped.x, later.y - stopped.y) < 1, JSON.stringify([stopped, later]));

  // 동작 버튼: 의자 앞으로 돌아가 앉고 일어난다
  await walkBack(phone, stick, 1000, 1090, () => document.getElementById('touch-actions').innerText.includes('앉기'));
  await phone.waitForFunction(() => document.getElementById('touch-actions').innerText.includes('앉기'), null, { timeout: 6000 });
  await phone.locator('#touch-actions button.main').tap();
  await phone.waitForFunction(() => entities.get(myId)?.seat > 0, null, { timeout: 2000 });
  t.check('the main button sits down', (await pageSelf(phone)).seat > 0);
  await phone.waitForFunction(() => document.getElementById('touch-actions').innerText.includes('일어나기'), null, { timeout: 2000 });
  t.check('it then offers getting up', true);
  await phone.locator('#touch-actions button.main').tap();
  await phone.waitForFunction(() => !entities.get(myId)?.seat, null, { timeout: 2000 });
  t.check('and gets up again', true);

  await phone.locator('#touch-actions button.bag').tap();
  t.check('the bag button opens the bag', await phone.isVisible('#bag'));
  await phone.locator('#bag-close').tap();

  await phone.locator('#chat-input').tap();
  await wait(100);
  t.check('typing hides the controls', await phone.evaluate(() => document.getElementById('touch-pad').hidden));
  await phone.evaluate(() => chatInput.blur());
  await wait(100);
  t.check('they come back after typing', await phone.isVisible('#stick'));
  t.check('no script errors on the phone', phone.problems.length === 0, phone.problems.join(' | '));

  const wide = await openPhone({ width: 844, height: 390 });
  const wideStick = await wide.locator('#stick').boundingBox(), wideActions = await wide.locator('#touch-actions').boundingBox();
  t.check('a sideways phone fits the controls', wideStick.y >= 0 && wideActions.y >= 0 && wideActions.y + wideActions.height <= 390, JSON.stringify([wideStick, wideActions]));
  await wide.screenshot({ path: shot('mobile_landscape.png') });
  t.check('no script errors sideways', wide.problems.length === 0, wide.problems.join(' | '));

  const desk = await openPage(chrome, server);
  await loginPage(desk, ids.desk);
  await enterPage(desk, { name: 'desk' });
  await wait(200);
  t.check('a mouse and keyboard get no joystick', !(await desk.isVisible('#stick')) && !(await desk.isVisible('#touch-actions')));

  friend.close();
  await chrome.close();
  await server.stop();
}

// 조이스틱으로 목표 지점 쪽으로 걷다가 done() 이 참이 되면 멈춘다 (서버 판정을 거치므로 순간이동 없이)
async function walkBack(page, stick, tx, ty, done) {
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (const end = Date.now() + 12000; Date.now() < end;) {  // 동시에 여러 스위트가 돌면 느려지므로 횟수 대신 시간으로
    const p = await page.evaluate(() => ({ x: me.x, y: me.y }));
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 4 || await page.evaluate(done)) break;
    await page.mouse.move(cx + (dx / d) * 40, cy + (dy / d) * 40);
    await wait(50);
  }
  await page.mouse.up();
  await wait(200);
}
