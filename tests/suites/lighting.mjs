// 몰쟈 집의 조명: 방 불, 스탠드, 밝기, 난로와 촛불의 빛
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageHint, pageSelf, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2;
const shot = (name) => path.join(SHOTS, name);

const lights = (bot) => bot.events.filter((e) => e.t === 'light');
const last = (bot) => lights(bot).at(-1);
const state = (bot) => { const l = last(bot); return l ? `${l.on}/${l.lamp}/${l.lv}` : 'none'; };

async function change(actor, watcher, command) {
  const before = lights(watcher).length;
  actor.send(command);
  await watcher.until(() => lights(watcher).length > before, 1000);
}

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    near: [MOLJA, 520, 340], far: [MOLJA, 250, 300], door: [MOLJA, 340, 400], rara: [RARA, 300, 200], outside: [0, 720, 620], late: [MOLJA, 250, 360],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const near = await enter('near');
  const far = await enter('far');
  const rara = await enter('rara');
  const outside = await enter('outside');

  t.check('map tells the lamp reach', near.map.lampReach === 56, near.map.lampReach);
  t.check('molja room is where the test expects', near.map.buildings.find((b) => b.name === '몰쟈').room === MOLJA && near.zone === MOLJA);
  t.check('entering the room gives the light state', state(near) === 'true/true/100', state(near));
  t.check('other rooms have no light state', lights(rara).length === 0, state(rara));
  t.check('outdoors has no light state', lights(outside).length === 0, state(outside));

  // ---- 방 안의 모두에게 같은 상태
  await change(near, far, 'light room 0');
  t.check('room switch reaches everyone in the room', state(far) === 'false/true/100', state(far));
  t.check('sender gets the same state', state(near) === 'false/true/100', state(near));
  await change(near, far, 'light lamp 0');
  t.check('lamp switch works from anywhere', state(far) === 'false/false/100', state(far));
  await change(far, near, 'light level 40');
  t.check('anyone in the room can dim', state(near) === 'false/false/40', state(near));
  await wait(60);
  t.check('other rooms do not hear about it', lights(rara).length === 0 && lights(outside).length === 0);

  await change(near, far, 'light level 5');
  t.check('level has a floor', last(far).lv === 10, last(far).lv);
  await change(near, far, 'light level 999999999999999999999999');
  t.check('level has a ceiling', last(far).lv === 100, last(far).lv);

  // ---- 잘못된 명령과 방 밖의 명령
  const count = lights(far).length;
  for (const bad of ['light', 'light room', 'light room 2', 'light room -1', 'light lamp x', 'light level 4x', 'light level ', 'light nope 1', 'light room 1 1']) near.send(bad);
  rara.send('light room 1');
  outside.send('light room 1');
  await wait(120);
  t.check('malformed and outside commands are ignored', lights(far).length === count && state(far) === 'false/false/100', state(far));
  t.check('senders stay connected', !near.closed && !rara.closed && !outside.closed);

  await wait(150);
  const same = lights(far).length;
  near.send('light room 0');
  near.send('light level 100');
  await wait(100);
  t.check('setting the same value broadcasts nothing', lights(far).length === same);

  // ---- L 로 스탠드 켜고 끄기 (E 는 앉기와 문에만 쓴다)
  await change(near, far, 'lamp');
  t.check('L next to the lamp switches it', last(far).lamp === true, state(far));
  await change(near, far, 'lamp');
  t.check('L switches it back', last(far).lamp === false, state(far));
  const beforeFar = lights(near).length;
  far.send('lamp');
  await wait(100);
  t.check('L away from the lamp does nothing', lights(near).length === beforeFar && !far.me.s, state(near));

  // ---- 나중에 들어온 사람도 같은 상태를 본다
  await change(near, far, 'light level 55');
  const late = await enter('late');
  t.check('late joiner gets the current state', state(late) === 'false/false/55', state(late));

  // ---- 문으로 드나들 때
  const door = await enter('door');
  door.send('use');
  await door.until(() => door.zone === 0, 1000);
  const whileOut = lights(door).length;
  await change(near, far, 'light level 60');
  await wait(60);
  t.check('leaving stops the updates', lights(door).length === whileOut);
  door.send('use');
  await door.until(() => door.zone === MOLJA, 1000);
  await door.until(() => lights(door).length > whileOut, 1000);
  t.check('coming back gets the latest state', state(door) === 'false/false/60', state(door));

  // ---- 도배 제한: 거절돼도 보낸 사람의 상태는 실제와 같다
  await wait(1200);
  const heard = lights(far).length;
  for (let i = 0; i < 60; i++) near.send(`light level ${10 + (i % 91)}`);
  await wait(200);
  const delivered = lights(far).length - heard;
  t.check('rapid changes are limited', delivered >= 5 && delivered <= 16, delivered);
  await near.until(() => last(near).lv === last(far).lv, 500);
  t.check('rejected change reports the real state', last(near).lv === last(far).lv, `${last(near).lv} vs ${last(far).lv}`);
  t.check('rapid changes do not disconnect', !near.closed && !far.closed);

  // ---- 모두 나가도 불은 그대로
  await wait(1200);
  await change(near, far, 'light level 70');
  for (const bot of [near, far, late, door]) bot.close();
  await wait(150);
  const back = await enter('near');
  t.check('state stays while the room is empty', state(back) === 'false/false/70', state(back));
  for (const bot of [back, rara, outside]) bot.close();
  await wait(100);
  await server.stop();
}

// 방 좌표 지점들의 화면 밝기(0~255)를 읽는다.
const brightness = (page, points) => page.evaluate((list) => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const [camX, camY] = camera(innerWidth, innerHeight);
    const dpr = window.devicePixelRatio || 1;
    resolve(list.map(([x, y]) => {
      const { data } = ctx.getImageData((x - camX - 6) * dpr, (y - camY - 6) * dpr, 12 * dpr, 12 * dpr);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      return sum / (data.length / 4);
    }));
  }));
}), points);

// 시험 지점: 난로 앞 바닥, 어떤 빛도 닿지 않는 바닥, 스탠드 옆 바닥, 식탁 촛불 옆 바닥, 벽난로 촛불 옆 벽과 난로 반대편의 같은 벽
const POINTS = { fire: [340, 70], far: [30, 420], lamp: [590, 262], table: [150, 250], candle: [290, -114], mirror: [390, -114] };

// 몇 프레임 동안 그려진 빛의 반경을 모은다.
const glowRadii = (page, frames) => page.evaluate((count) => new Promise((resolve) => {
  const original = ctx.createRadialGradient.bind(ctx);
  let current = [];
  const seen = [];
  ctx.createRadialGradient = (...args) => { current.push(args[5]); return original(...args); };
  const tick = () => {
    seen.push(current);
    current = [];
    if (seen.length < count) { requestAnimationFrame(tick); return; }
    ctx.createRadialGradient = original;
    resolve(seen.slice(1));
  };
  requestAnimationFrame(tick);
}), frames);
const sample = async (page) => {
  const names = Object.keys(POINTS);
  const values = await brightness(page, names.map((n) => POINTS[n]));
  return Object.fromEntries(names.map((n, i) => [n, Math.round(values[i])]));
};
const roomState = (page) => page.evaluate(() => roomLight && { ...roomLight });
const waitLight = (page, predicate) => page.waitForFunction(predicate, null, { timeout: 2000, polling: 20 });
const setLevel = async (page, value) => {
  await page.$eval('#light-level', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

async function ui(t) {
  const { server, ids } = await serverWithAccounts({
    host: [MOLJA, 520, 340], guest: [MOLJA, 250, 360], door: [MOLJA, 340, 400], rara: [RARA, 300, 200], outside: [0, 720, 620],
  });
  const browser = await launchBrowser();
  const open = (name, options = {}) => enterGame(browser, server, ids[name], { name, ...options });
  const page = await open('host');
  const guest = await open('guest');
  await page.waitForFunction(() => roomLight !== null, null, { timeout: 2000 });
  await page.evaluate(() => { window.drawDog = () => {}; });  // 돌아다니는 강아지가 밝기 측정 지점을 가리지 않게
  await guest.waitForFunction(() => roomLight !== null, null, { timeout: 2000 });
  await wait(200);

  // ---- 조작부는 조명이 있는 방에서만
  t.check('light controls show in the room', await page.isVisible('#light-room') && await page.isVisible('#light-lamp') && await page.isVisible('#light-level'));
  t.check('controls start from the server state', await page.isChecked('#light-room') && await page.isChecked('#light-lamp') && (await page.inputValue('#light-level')) === '100');
  const rara = await open('rara');
  const outside = await open('outside');
  await wait(300);
  t.check('other rooms have no light controls', !(await rara.isVisible('#light-panel')));
  t.check('outdoors has no light controls', !(await outside.isVisible('#light-panel')));
  await rara.close();
  await outside.close();

  // ---- 불을 켠 방: 난로와 촛불, 스탠드가 주변보다 밝다
  const lit = await sample(page);
  await page.screenshot({ path: shot('light_on.png') });
  t.check('fire is brighter than the surroundings', lit.fire > lit.far + 25, JSON.stringify(lit));
  t.check('candle brightens the wall beside it', lit.candle > lit.mirror + 10, JSON.stringify(lit));
  t.check('lamp brightens the floor beside it', lit.lamp > lit.far + 15, JSON.stringify(lit));
  t.check('table candle brightens the floor beside it', lit.table > lit.far + 15, JSON.stringify(lit));
  const radii = await glowRadii(page, 25);
  t.check('all lights are drawn, with the two pendants over the table', radii.every((frame) => frame.length === 6), JSON.stringify(radii[0]));  // 벽난로 2, 식탁 촛불, 스탠드, 나무 틀 펜던트 2
  t.check('light circles keep their size', new Set(radii.map((frame) => frame.join())).size === 1, [...new Set(radii.map((frame) => frame.join()))].slice(0, 3).join(' | '));

  // ---- 방 불 끄기
  await page.click('#light-room');
  await guest.waitForFunction(() => roomLight.on === false, null, { timeout: 2000 });
  await wait(150);
  const dark = await sample(page);
  await page.screenshot({ path: shot('light_off.png') });
  t.check('turning the room off darkens it', dark.far < lit.far * 0.5, JSON.stringify({ lit: lit.far, dark: dark.far }));
  t.check('fire still lights the dark room', dark.fire > dark.far * 2, JSON.stringify(dark));
  t.check('candle still lights the dark room', dark.candle > dark.mirror + 10, JSON.stringify(dark));
  t.check('lamp still lights the dark room', dark.lamp > dark.far * 1.6, JSON.stringify(dark));
  t.check('table candle still lights the dark room', dark.table > dark.far * 1.6, JSON.stringify(dark));
  t.check('guest sees the same room', (await guest.isChecked('#light-room')) === false, JSON.stringify(await roomState(guest)));
  t.check('keyboard stays with the game after the switch', await page.evaluate(() => document.activeElement === document.body));

  // ---- 빛이 방 바깥으로 번지지 않는다
  const [outsideRoom] = await brightness(page, [[340, -160]]);
  t.check('light does not spill outside the walls', outsideRoom < 30, Math.round(outsideRoom));

  // ---- 스탠드: L 과 안내
  t.check('hint offers turning the lamp off', (await pageHint(page)).includes('L: 스탠드 끄기'), await pageHint(page));
  await page.keyboard.press('KeyL');
  await waitLight(page, () => roomLight.lamp === false);
  await wait(150);
  const lampOff = await sample(page);
  await page.screenshot({ path: shot('light_lamp_off.png') });
  t.check('lamp off darkens its corner', lampOff.lamp < dark.lamp * 0.7, JSON.stringify({ on: dark.lamp, off: lampOff.lamp }));
  t.check('lamp switch follows L', !(await page.isChecked('#light-lamp')));
  t.check('hint offers turning the lamp on', (await pageHint(page)).includes('L: 스탠드 켜기'), await pageHint(page));
  t.check('L did not sit or move', (await pageSelf(page)).seat === 0);
  t.check('the room panel explains resting and keys', (await page.textContent('#light-help')).includes('1분마다 1G'));

  await page.click('#light-lamp');
  await waitLight(page, () => roomLight.lamp === true);
  await guest.waitForFunction(() => roomLight.lamp === true, null, { timeout: 2000 });
  t.check('lamp switch in the item window works', await guest.isChecked('#light-lamp'));

  // ---- 밝기
  const dimmable = await sample(page);
  await setLevel(page, 10);
  await guest.waitForFunction(() => roomLight.level === 10, null, { timeout: 2000 });
  await wait(150);
  const dimmed = await sample(page);
  await page.screenshot({ path: shot('light_dim_dark.png') });
  t.check('dimming weakens the fire', dimmed.fire < dimmable.fire - 15, JSON.stringify({ full: dimmable.fire, dim: dimmed.fire }));
  t.check('dimming weakens the lamp', dimmed.lamp < dimmable.lamp - 15, JSON.stringify({ full: dimmable.lamp, dim: dimmed.lamp }));
  t.check('level label follows', (await page.textContent('#light-level-value')) === '10%' && (await guest.textContent('#light-level-value')) === '10%');

  await page.click('#light-room');
  await waitLight(page, () => roomLight.on === true);
  await wait(150);
  const lowOn = await sample(page);
  await page.screenshot({ path: shot('light_dim_on.png') });
  t.check('low level dims a lit room', lowOn.far < lit.far * 0.8 && lowOn.far > dark.far, JSON.stringify({ full: lit.far, low: lowOn.far, off: dark.far }));
  t.check('fire stays brighter than a dim room', lowOn.fire > lowOn.far + 15, JSON.stringify(lowOn));

  // 실제 마우스로 슬라이더 끌기: 보내는 횟수는 제한되고 끝난 값은 모두에게 간다
  await page.evaluate(() => {
    window.__levelSends = 0;
    const original = ws.send.bind(ws);
    ws.send = (message) => { if (String(message).startsWith('light level')) window.__levelSends++; original(message); };
  });
  const box = await page.locator('#light-level').boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(box.x + 4 + (box.width - 8) * (i / 30), box.y + box.height / 2);
    await wait(10);
  }
  t.check('my room follows the slider while dragging', (await roomState(page)).level === 100, JSON.stringify(await roomState(page)));
  await page.mouse.up();
  await guest.waitForFunction(() => roomLight.level === 100, null, { timeout: 2000 });
  const sends = await page.evaluate(() => window.__levelSends);
  t.check('dragging is throttled', sends >= 2 && sends <= 12, sends);
  t.check('dragging ends with the final value', (await page.inputValue('#light-level')) === '100');
  t.check('keyboard stays with the game after dragging', await page.evaluate(() => document.activeElement === document.body));
  const before = await pageSelf(page);
  await page.keyboard.down('KeyS');
  await wait(250);
  await page.keyboard.up('KeyS');
  await wait(100);
  t.check('keyboard moves the character afterwards', (await pageSelf(page)).y > before.y + 15, JSON.stringify(await pageSelf(page)));

  // ---- 문으로 나가면 조작부와 어둠이 사라지고, 다시 들어오면 돌아온다
  await page.click('#light-room');
  await waitLight(page, () => roomLight.on === false);
  const door = await open('door');
  await door.waitForFunction(() => roomLight && roomLight.on === false, null, { timeout: 2000 });
  await door.keyboard.press('KeyE');
  await door.waitForFunction(() => zone === 0, null, { timeout: 2000 });
  await wait(200);
  t.check('leaving hides the controls', !(await door.isVisible('#light-panel')) && (await roomState(door)) === null);
  await door.screenshot({ path: shot('light_left_room.png') });
  await door.keyboard.press('KeyE');
  await door.waitForFunction(() => zone === 1 && roomLight, null, { timeout: 2000 });
  t.check('coming back shows the current state', await door.isVisible('#light-panel') && !(await door.isChecked('#light-room')));

  // 다른 방은 영향을 받지 않고, 좁은 화면에서도 아이템창이 들어간다
  const phone = await enterGame(browser, server, ids.guest, { name: 'guest', viewport: { width: 390, height: 720 } });
  await phone.waitForFunction(() => roomLight !== null, null, { timeout: 2000 });
  await wait(200);
  await phone.screenshot({ path: shot('light_phone.png') });
  const fits = await phone.evaluate(() => {
    const l = document.getElementById('light-panel').getBoundingClientRect();
    const c = document.getElementById('chat').getBoundingClientRect();
    const h = document.getElementById('hud').getBoundingClientRect();
    return l.left >= 0 && l.right <= innerWidth && l.top >= h.bottom && l.bottom < c.top;
  });
  t.check('light controls fit a phone', fits);

  const problems = [...page.problems, ...door.problems, ...phone.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
