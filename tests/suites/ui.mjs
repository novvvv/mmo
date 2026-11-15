// 실제 Chrome 에서 키보드로 플레이: 로그인, 캐릭터 선택, 집, 카페, 고양이
import path from 'node:path';
import {
  enterGame, enterPage, launchBrowser, loginPage, openPage, pageHint, pageSelf, pageWalkTo, SHOTS, startServer, uniqueId, wait,
} from '../lib.mjs';

const shot = (name) => path.join(SHOTS, name);
const lines = (page) => page.$$eval('#chat-log > div', (els) => els.map((e) => e.textContent));
const bag = (page) => page.evaluate(() => myBag);

export default async function run(t) {
  const server = await startServer();
  const browser = await launchBrowser();

  // ---- 로그인 화면
  const id = uniqueId('ui');
  const page = await openPage(browser, server, { scale: 2 });
  t.check('login form is shown first', await page.isVisible('#auth-form'));
  t.check('character select starts hidden', !(await page.isVisible('#char-form')));
  t.check('password input is masked', (await page.getAttribute('#auth-pw', 'type')) === 'password');
  t.check('browser can autofill', (await page.getAttribute('#auth-id', 'autocomplete')) === 'username' && (await page.getAttribute('#auth-pw', 'autocomplete')) === 'current-password');

  await page.fill('#auth-id', 'a b');
  await page.fill('#auth-pw', 'password1');
  await page.press('#auth-pw', 'Enter');
  await wait(100);
  t.check('space in id is refused locally', (await page.textContent('#auth-status')).includes('공백'));

  await page.fill('#auth-id', '!');
  await page.press('#auth-pw', 'Enter');
  await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('아이디는'), null, { timeout: 5000 });
  t.check('server validation error is shown', await page.isVisible('#auth-form'));

  await loginPage(page, id);
  t.check('signup moves to character select', await page.isVisible('#char-form'));
  t.check('nickname defaults to the id', (await page.inputValue('#char-name')) === id);
  t.check('password is cleared after login', (await page.inputValue('#auth-pw')) === '');

  // ---- 캐릭터 선택: 팔다리 미리보기
  const previewPixels = async () => page.evaluate(() => new Promise((resolve) => {
    // 방금 고른 값이 그려진 다음 프레임에서 읽는다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const d = previewCtx.getImageData(0, 0, charPreview.width, charPreview.height).data;
      let whites = 0, painted = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 200) painted++;
        if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 200) whites++;
      }
      resolve({ whites, painted });
    }));
  }));
  await page.check('input[name="arms"][value="0"]', { force: true });
  await page.check('input[name="legs"][value="0"]', { force: true });
  await wait(100);
  const bare = await previewPixels();
  await page.check('input[name="arms"][value="2"]', { force: true });
  await page.check('input[name="legs"][value="2"]', { force: true });
  await page.check('input[name="limbColor"][value="0"]', { force: true });
  await wait(100);
  const full = await previewPixels();
  t.check('preview draws the character', bare.painted > 2000, bare.painted);
  t.check('preview shows chosen limbs', full.whites > bare.whites * 1.3 && full.painted > bare.painted, `${bare.whites} -> ${full.whites}`);
  await page.fill('#char-name', '몰쟈팔다리');
  await page.evaluate(() => {
    for (const [key, value] of [['r', 200], ['g', 120], ['b', 40]]) {
      const slider = document.getElementById(`char-${key}`);
      slider.value = value;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await wait(100);
  await page.screenshot({ path: shot('character_select.png') });

  await enterPage(page, {});
  t.check('login screens are gone', !(await page.isVisible('#char-form')) && !(await page.isVisible('#auth-form')));
  t.check('HUD shows position and time', /위치 \(\d+, \d+\)/.test(await page.textContent('#hud')));
  const look = await page.evaluate(() => { const e = entities.get(myId); return { arms: e.arms, legs: e.legs, limb: e.limbColor, color: e.color, name: e.name }; });
  t.check('chosen look reaches the world', look.arms === 2 && look.legs === 2 && look.limb === 0 && look.color === '#c87828' && look.name === '몰쟈팔다리', JSON.stringify(look));

  // 모든 가구에 그림이 있다
  const missing = await page.evaluate(() => terrain.furn.filter((f) => typeof FURNITURE[f.k] !== 'function').map((f) => f.k));
  t.check('every furniture kind has art', missing.length === 0, missing.join());

  // ---- 벤치에 나란히 앉기: 레퍼런스처럼 팔다리가 있는 캐릭터와 없는 캐릭터
  const friend = await enterGame(browser, server, uniqueId('friend'), { name: 'rara', look: { arms: 0, legs: 0, limbColor: 0 } });
  const bench = await page.evaluate(() => terrain.furn.find((f) => f.k === 'bench' && f.x === 605));
  await pageWalkTo(page, (await pageSelf(page)).x, 670, 14);
  await pageWalkTo(page, bench.x + 30, bench.y - 24, 8);
  await pageWalkTo(friend, (await pageSelf(friend)).x, 670, 14);
  await pageWalkTo(friend, bench.x - 30, bench.y - 24, 8);
  await page.keyboard.press('KeyE');
  await wait(200);
  await friend.keyboard.press('KeyE');
  await wait(900);
  const seated = await pageSelf(page);
  t.check('E sits on the bench', seated.seat > 0, JSON.stringify(seated));
  t.check('hint while seated', (await pageHint(page)).startsWith('E: 일어나기'), await pageHint(page));
  await page.screenshot({ path: shot('limbs_on_bench.png'), clip: { x: 400, y: 240, width: 300, height: 180 } });

  // 채팅 입력 중 e/f/c/x/wasd 는 게임 조작이 아니다
  await page.keyboard.press('Enter');
  await page.keyboard.type('efcxwasd');
  await wait(200);
  const typing = await pageSelf(page);
  t.check('typing in chat does not trigger actions', typing.seat === seated.seat && typing.fish === 0, JSON.stringify(typing));
  t.check('letters reach chat input', (await page.inputValue('#chat-input')) === 'efcxwasd');
  await page.keyboard.press('Enter');
  await wait(250);
  t.check('chat still works', (await lines(friend)).includes('몰쟈팔다리: efcxwasd'), JSON.stringify(await lines(friend)));

  // 앉아서 낚시
  await page.keyboard.press('KeyF');
  await wait(400);
  t.check('F casts while seated', (await pageSelf(page)).fish === 1);
  await page.screenshot({ path: shot('fishing_with_arms.png'), clip: { x: 380, y: 220, width: 340, height: 260 } });
  await page.waitForFunction(() => entities.get(myId).fish === 2, null, { timeout: 9000, polling: 20 });
  t.check('hint on bite', (await pageHint(page)) === '입질! F를 누르세요');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => entities.get(myId).caught, null, { timeout: 2000, polling: 20 });
  await wait(100);
  t.check('bag counts the fish', (await bag(page)).reduce((x, y) => x + y) === 1, (await bag(page)).join());

  // ---- 고양이
  await friend.close();
  await page.keyboard.press('KeyE');
  await wait(200);
  await page.evaluate(() => { window.__catIndex = 0; });
  const reachCat = async () => {
    const end = Date.now() + 25000;
    while (Date.now() < end) {
      const c = await page.evaluate(() => ({ x: cats[0].x, y: cats[0].y, near: !!catInReach({ x: me.x, y: me.y }) }));
      if (c.near) return true;
      await pageWalkTo(page, c.x + 30, c.y - 10, 16, 2500);
    }
    return false;
  };
  t.check('walks up to a cat', await reachCat());
  t.check('hint offers petting and feeding', /C: 쓰다듬기/.test(await pageHint(page)) && /X: 먹이 주기/.test(await pageHint(page)), await pageHint(page));
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => cats.some((c) => performance.now() - c.heartsAt < 1200), null, { timeout: 2000, polling: 20 });
  await wait(250);
  t.check('petting shows a chat line', (await lines(page)).some((l) => l.endsWith('를 쓰다듬었습니다.')), (await lines(page)).at(-1));
  await page.screenshot({ path: shot('cat_petting.png') });
  await wait(800);
  await reachCat();
  await page.keyboard.press('KeyX');
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('졸졸'), null, { timeout: 2000 });
  t.check('feeding uses up the fish', (await bag(page)).reduce((x, y) => x + y) === 0, (await bag(page)).join());

  // ---- 집과 카페 둘러보기
  const self = () => pageSelf(page);
  const buildings = await page.evaluate(() => terrain.buildings);
  const house = (name) => buildings.find((b) => b.name === name);
  const camShot = async (file) => { await wait(500); await page.screenshot({ path: shot(file) }); };

  const cafe = buildings.find((b) => b.k === 'cafe');
  await pageWalkTo(page, (await self()).x, 670, 14);
  await pageWalkTo(page, 820, 520, 14);
  await pageWalkTo(page, cafe.x, cafe.deck[3] + 30, 12);
  await camShot('cafe.png');
  const table = await page.evaluate(() => terrain.furn.find((f) => f.k === 'cafe_table'));
  await pageWalkTo(page, table.x - 62, table.y + 34, 8);
  t.check('hint offers a terrace seat', (await pageHint(page)).includes('E: 앉기'), await pageHint(page));
  await page.keyboard.press('KeyE');
  await wait(700);
  t.check('E sits at the terrace table', (await self()).seat > 0);
  await page.screenshot({ path: shot('cafe_table.png'), clip: { x: 300, y: 130, width: 500, height: 330 } });
  await page.keyboard.press('KeyE');
  await wait(200);

  const visit = async (name, route, exteriorShot, roomShot) => {
    const h = house(name);
    await pageWalkTo(page, (await self()).x, 670, 14);
    await pageWalkTo(page, 720, 670, 14);
    await pageWalkTo(page, 720, await page.evaluate(() => bankAt(terrain.top, 720) - 40), 8);
    await page.keyboard.down('KeyS');
    await page.waitForFunction(() => me.y > bankAt(terrain.bot, me.x) + 40, null, { timeout: 6000, polling: 20 });
    await page.keyboard.up('KeyS');
    for (const [x, y] of route) await pageWalkTo(page, x, y, 12);
    await pageWalkTo(page, h.door[0], h.door[1] + 30, 8);
    await camShot(exteriorShot);
    t.check(`${name}: door hint`, (await pageHint(page)).includes('E: 들어가기'), await pageHint(page));

    await page.keyboard.press('KeyE');
    await page.waitForFunction((room) => zone === room, h.room, { timeout: 2000, polling: 20 });
    await wait(400);
    await camShot(roomShot);
    t.check(`${name}: HUD names the house`, (await page.textContent('#hud')).includes(`${name}의 집`), await page.textContent('#hud'));
    t.check(`${name}: exit hint`, (await pageHint(page)).includes('E: 나가기'), await pageHint(page));
    const roomInfo = await page.evaluate((room) => terrain.zones[room], h.room);
    await pageWalkTo(page, roomInfo.door[0] - 60, roomInfo.door[1] - 110, 10);
    const pos = await self();
    await pageWalkTo(page, roomInfo.door[0], roomInfo.door[1] - 30, 8);
    t.check(`${name}: can walk inside`, pos.zone === h.room && Math.abs(pos.y - (roomInfo.door[1] - 110)) < 30, JSON.stringify(pos));
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => zone === 0, null, { timeout: 2000, polling: 20 });
    await wait(200);
    const out = await self();
    t.check(`${name}: door leads back`, Math.hypot(out.x - h.door[0], out.y - (h.door[1] + 24)) < 12, JSON.stringify(out));
    for (const [x, y] of [...route].reverse()) await pageWalkTo(page, x, y, 14);
    await pageWalkTo(page, 720, await page.evaluate(() => bankAt(terrain.bot, 720) + 40), 10);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => me.y < bankAt(terrain.top, me.x) - 40, null, { timeout: 6000, polling: 20 });
    await page.keyboard.up('KeyW');
  };
  await visit('몰쟈', [[970, 1220], [970, 1388]], 'house_molja.png', 'room_molja.png');
  await visit('랏라', [[320, 1220], [320, 1392]], 'house_rara.png', 'room_rara.png');
  await visit('캬캬', [[795, 1220], [795, 1468]], 'house_kyakya.png', 'room_kyakya.png');

  t.check('no page errors', page.problems.length === 0, page.problems.join(' | '));

  // ---- 다시 로그인하면 설정이 그대로 (로그아웃으로 끊으면 이어 들어오지 않고 접속 화면으로)
  await page.evaluate(() => { closeMessage = ''; clearResume(); ws.close(); });
  await page.waitForSelector('#auth:not([hidden])');
  t.check('disconnect returns to login', await page.isVisible('#auth-form'));
  t.check('bag hidden after disconnect', await page.$eval('#bag', (e) => e.hidden));
  await loginPage(page, id);
  t.check('saved nickname is shown', (await page.inputValue('#char-name')) === '몰쟈팔다리');
  t.check('saved arms are selected', await page.isChecked('input[name="arms"][value="2"]'));
  t.check('saved legs are selected', await page.isChecked('input[name="legs"][value="2"]'));
  t.check('saved color is shown', (await page.inputValue('#char-color')) === '#c87828' && (await page.inputValue('#char-r')) === '200');

  // 로그아웃
  await page.click('#char-logout');
  await page.waitForSelector('#auth:not([hidden])');
  t.check('logout shows no error', (await page.textContent('#auth-status')) === '', await page.textContent('#auth-status'));

  // 틀린 비밀번호
  await page.fill('#auth-id', id);
  await page.fill('#auth-pw', 'not-the-password');
  await page.press('#auth-pw', 'Enter');
  await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('틀렸'), null, { timeout: 5000 });
  t.check('wrong password stays on the login screen', await page.isVisible('#auth-form'));

  // 다른 곳에서 로그인되면 이유를 알려 준다
  await loginPage(page, id);
  await enterPage(page, {});
  const second = await openPage(browser, server);
  await loginPage(second, id);
  await page.waitForFunction(() => document.getElementById('auth-status').textContent.includes('다른 곳에서'), null, { timeout: 3000 });
  t.check('kicked session explains why', await page.isVisible('#auth-form'));
  await second.close();

  // ---- 좁은 화면
  const phone = await enterGame(browser, server, uniqueId('phone'), { viewport: { width: 390, height: 720 }, name: '폰' });
  await phone.keyboard.press('KeyI');
  await wait(100);
  await phone.screenshot({ path: shot('phone.png') });
  const overlap = await phone.evaluate(() => {
    const h = document.getElementById('hud').getBoundingClientRect();
    const g = document.getElementById('bag').getBoundingClientRect();
    return h.right > g.left && h.bottom > g.top;
  });
  t.check('HUD and bag do not overlap on a phone', !overlap);
  const phoneLogin = await openPage(browser, server, { viewport: { width: 360, height: 620 } });
  await loginPage(phoneLogin, uniqueId('phone'));
  await phoneLogin.screenshot({ path: shot('phone_character_select.png') });
  t.check('character select fits a phone', await phoneLogin.evaluate(() => document.getElementById('char-form').getBoundingClientRect().width <= innerWidth));
  await phoneLogin.close();
  t.check('phone: no page errors', phone.problems.length === 0, phone.problems.join(' | '));

  await browser.close();
  await server.stop();
}
