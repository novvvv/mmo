// 집 확장: 원래 방은 그대로 두고 상하좌우 벽을 하나씩 뚫어 방을 붙인다. 뚫은 자리는 가구를 피해 정해지고,
// 비어 있으면 다시 막고, 서버를 다시 켜도 남는다.
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, KYAKYA = 3, THEATER = 4;
const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const PLANT = 21, WINDOW = 31;
const shot = (name) => path.join(SHOTS, name);
const pause = () => wait(260);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const room = (bot, z) => bot.events.filter((e) => e.t === 'room' && e.z === z).at(-1)?.zone;
const decor = (bot) => bot.lastEvent('decor');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [MOLJA, 340, 300, { f21: 3 }], walker: [MOLJA, 650, 240], b: [RARA, 200, 300, { f31: 1, f21: 1 }], out: [0, 820, 620],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const a = await enter('a'), walker = await enter('walker'), b = await enter('b'), out = await enter('out');
  const zones = a.map.zones;
  t.check('the three houses can be expanded', [MOLJA, RARA, KYAKYA].every((z) => zones[z].base && zones[z].open.length === 0) && !zones[THEATER].base);
  t.check('an unexpanded one-room house still draws as one room', !zones[MOLJA].floors && !zones[RARA].floors && zones[KYAKYA].floors.length === 5);
  t.check('the map says what expanding costs', a.map.expandPrice === 0);

  // ---- 오른쪽: 침대를 피해 뚫고, 밖에 있는 사람에게도 알린다
  a.send(`expand open ${RIGHT}`);
  await out.until(() => room(out, MOLJA), 1500);
  const right = room(out, MOLJA);
  t.check('opening a wall reaches everyone, even outside', right?.open.length === 1 && right.open[0][0] === RIGHT, JSON.stringify(right?.open));
  t.check('the original room stays exactly as it was', JSON.stringify(right.floors[0]) === JSON.stringify([0, 0, 680, 440, 0]) && right.floors.length === 3, JSON.stringify(right.floors));
  t.check('a corridor and a new room are added to the right', right.w === 680 + 60 + 360 && JSON.stringify(right.floors[1].slice(0, 1)) === '[680]' && right.floors[2][0] === 740, JSON.stringify(right));
  const rightAt = right.open[0][1];
  t.check('the opening steers clear of the bed by the right wall', rightAt >= 240, rightAt);

  // 뚫린 통로로 걸어 들어간다
  walker.send('in 8');
  await walker.until(() => walker.me.x > 760, 2500);
  walker.send('in 0');
  t.check('you can walk through into the new room', walker.me.x > 760, JSON.stringify(walker.me));

  await pause();
  a.send(`decor place ${PLANT} 920 ${Math.round(rightAt)}`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === PLANT && d[2] === 920), 1500);
  t.check('furniture can go in the new room', decor(a).p.some((d) => d[1] === PLANT && d[2] === 920));
  await pause();
  a.send(`expand open ${RIGHT}`);
  await a.until(() => says(a, '이미 오른쪽'), 1500);
  t.check('each side opens only once', room(out, MOLJA).open.length === 1);

  // ---- 왼쪽: 원래 방 왼쪽은 음수 좌표가 된다
  await pause();
  a.send(`expand open ${LEFT}`);
  await out.until(() => room(out, MOLJA)?.open.length === 2, 1500);
  const left = room(out, MOLJA);
  t.check('the left room goes into negative x', left.x0 === -420 && left.w === 1100 && left.floors[0].join() === '0,0,680,440,0', JSON.stringify([left.x0, left.w, left.floors]));
  const leftAt = left.open.find(([d]) => d === LEFT)[1];
  t.check('the left opening avoids the monstera', Math.abs(leftAt - 200) > 70, leftAt);
  await pause();
  a.send(`decor place ${PLANT} -240 ${Math.round(leftAt)}`);
  await a.until(() => decor(a)?.p.some((d) => d[1] === PLANT && d[2] === -240), 1500);
  t.check('furniture can go in the left room', decor(a).p.some((d) => d[1] === PLANT && d[2] === -240));

  // ---- 위: 몰쟈의 뒷벽은 창과 벽난로로 덮여 있어 먼저 옮겨야 한다
  await pause();
  a.send(`expand open ${UP}`);
  await a.until(() => says(a, '먼저 옮겨'), 1500);
  t.check('a back wall covered by windows asks you to move them first', room(out, MOLJA).open.length === 2);

  // ---- 아래: 문 앞은 피한다
  await pause();
  a.send(`expand open ${DOWN}`);
  await out.until(() => room(out, MOLJA)?.open.length === 3, 1500);
  const down = room(out, MOLJA);
  const downAt = down.open.find(([d]) => d === DOWN)[1];
  t.check('the bottom opening keeps clear of the door', Math.abs(downAt - down.door[0]) >= 130 && down.h === 440 + 160 + 300, JSON.stringify([downAt, down.door, down.h]));

  // ---- 막기: 가구가 있으면 못 막고, 치우면 막힌다
  await pause();
  a.send(`expand close ${RIGHT}`);
  await a.until(() => says(a, '가구를 먼저 치워'), 1500);
  t.check('a furnished room cannot be closed', room(out, MOLJA).open.length === 3);
  await pause();
  a.send(`expand close ${DOWN}`);
  await out.until(() => room(out, MOLJA)?.open.length === 2, 1500);
  t.check('an empty room closes again', !room(out, MOLJA).open.some(([d]) => d === DOWN) && room(out, MOLJA).h === 440);

  // ---- 랏라: 뒷벽의 고정 장식(창, 담쟁이)은 뚫으면서 떼고, 뚫린 벽에는 벽걸이를 걸 수 없다
  await pause();
  const furnBefore = b.map.furn.filter((f) => f.z === RARA).length;
  b.send(`expand open ${UP}`);
  await out.until(() => room(out, RARA)?.open.length === 1, 1500);
  const raraUp = out.events.filter((e) => e.t === 'room' && e.z === RARA).at(-1);
  const upAt = raraUp.zone.open[0][1];
  t.check('the back wall opens upwards', raraUp.zone.y0 === -460 && raraUp.zone.floors.length === 3, JSON.stringify(raraUp.zone));
  t.check('the opening avoids the bench in front of the wall', Math.abs(upAt - 310) >= 100, upAt);
  t.check('fixed wall decorations over the opening come down', raraUp.furn.length < furnBefore && !raraUp.furn.some((f) => f.y < 0 && Math.abs(f.x - upAt) < 110), JSON.stringify(raraUp.furn.filter((f) => f.y < 0)));
  await pause();
  b.send(`decor place ${WINDOW} ${Math.round(upAt)} -62`);
  await b.until(() => says(b, '벽에만'), 1500);
  t.check('nothing can hang where the wall was cut', !decor(b)?.p.some((d) => d[1] === WINDOW));
  await pause();
  b.send(`decor place ${PLANT} ${Math.round(upAt)} -300`);
  await b.until(() => decor(b)?.p.some((d) => d[1] === PLANT), 1500);
  t.check('furniture can go in the upper room', decor(b).p.some((d) => d[1] === PLANT && d[3] === -300));
  await pause();
  b.send(`expand open ${DOWN}`);
  await out.until(() => room(out, RARA)?.open.length === 2, 1500);
  const raraDown = room(out, RARA).open.find(([d]) => d === DOWN)[1];
  t.check('the cabin door stays clear too', Math.abs(raraDown - 310) >= 130, raraDown);
  t.check('only people inside a house can expand it', (() => { out.send(`expand open ${LEFT}`); return true; })());
  await out.until(() => says(out, '집 안에서만'), 1500);
  t.check('outside you are told to go in', says(out, '집 안에서만'));

  // ---- 다시 켜도 남는다
  for (const bot of [a, walker, b, out]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'a', { id: ids.a });
  await back.until(() => decor(back), 1500);
  const molja = back.map.zones[MOLJA], rara = back.map.zones[RARA];
  t.check('openings survive a restart', molja.open.length === 2 && molja.x0 === -420 && rara.open.length === 2 && rara.y0 === -460, JSON.stringify([molja.open, rara.open]));
  t.check('furniture in the new rooms survives too', decor(back).p.some((d) => d[1] === PLANT && d[2] === -240));
  t.check('hidden wall decorations stay hidden', !back.map.furn.some((f) => f.z === RARA && f.y < 0 && Math.abs(f.x - upAt) < 110));
  back.close();
  await again.stop();
}

// 뚫는 폭을 고른다: 좁게, 벽 전체, 뚫은 뒤에 바꾸기
async function widths(t) {
  const { server, ids } = await serverWithAccounts({ w: [RARA, 200, 300, { f21: 2 }] });
  let w = await Bot.enter(server, 'w', { id: ids.w });
  await wait(60);
  const open = (dir) => room(w, RARA)?.open.find(([d]) => d === dir);
  t.check('the map says how wide each wall can open', JSON.stringify(w.map.zones[RARA].omax) === '[560,560,440,440]', JSON.stringify(w.map.zones[RARA].omax));
  w.send(`expand open ${UP} 9999`);
  await w.until(() => open(UP), 1500);
  const corridor = room(w, RARA).floors[1];
  t.check('a wall can be opened as wide as the new room', open(UP)[2] === 560 && corridor[2] - corridor[0] === 560, JSON.stringify([open(UP), corridor]));
  await pause();
  w.send(`expand open ${LEFT} 10`);
  await w.until(() => open(LEFT), 1500);
  t.check('or as narrow as a doorway', open(LEFT)[2] === 80, JSON.stringify(open(LEFT)));
  await pause();
  w.send(`expand width ${UP} 200`);
  await w.until(() => open(UP)?.[2] === 200, 1500);
  const narrow = room(w, RARA).floors.find((f) => f[3] === 0 && f[1] === -160);
  t.check('an opening can be narrowed afterwards', narrow[2] - narrow[0] === 200 && says(w, '통로의 폭을 바꿨습니다'), JSON.stringify(narrow));
  await pause();
  w.send(`decor place ${PLANT} ${narrow[0] + 30} -80`);
  await w.until(() => decor(w)?.p.some((d) => d[1] === PLANT && d[3] === -80), 1500);
  await pause();
  w.send(`expand width ${UP} 80`);
  await w.until(() => says(w, '통로 자리의 가구'), 1500);
  t.check('furniture in the way keeps it from narrowing', open(UP)[2] === 200);
  await pause();
  w.send(`expand width ${UP} 400`);
  await w.until(() => open(UP)?.[2] === 400, 1500);
  t.check('and widened again', open(UP)[2] === 400);
  await pause();
  w.send(`expand width ${RIGHT} 200`);
  await wait(200);
  t.check('a closed wall has no width to change', !open(RIGHT));
  w.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  w = await Bot.enter(again, 'w', { id: ids.w });
  t.check('widths survive a restart', JSON.stringify(w.map.zones[RARA].open.map((o) => [o[0], o[2]])) === `[[${UP},400],[${LEFT},80]]`, JSON.stringify(w.map.zones[RARA].open));
  w.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ one: [MOLJA, 600, 260] });
  const chrome = await launchBrowser();
  const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
  await loginPage(page, ids.one);
  await enterPage(page, { name: 'one' });
  await page.waitForFunction(() => zone === 1 && decorItems.length > 0, null, { timeout: 4000 });
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="expand"]');
  t.check('the shop has an expansion tab for this house', (await page.textContent('#expand-name')) === '몰쟈의 집' && !(await page.isDisabled('#expand-pad [data-dir="3"]')));
  await page.click('#expand-pad [data-dir="3"]');
  await page.waitForFunction(() => terrain.zones[zone].open.length === 1, null, { timeout: 3000 });
  t.check('the button turns into closing that side', (await page.textContent('#expand-pad [data-dir="3"]')).includes('막기'));
  await page.screenshot({ path: shot('expand_shop.png') });
  await page.click('#furn-close');
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => me.x > 760, null, { timeout: 4000 }).catch(() => {});
  await page.keyboard.up('KeyD');
  t.check('walking right goes into the new room', await page.evaluate(() => me.x > 760), String(await page.evaluate(() => me.x)));
  await wait(300);
  await page.screenshot({ path: shot('expand_room.png') });
  // 폭을 골라 벽 전체를 튼다
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="expand"]');
  await page.click('#expand-width-max');
  t.check('the width slider goes up to the whole wall', (await page.textContent('#expand-width-value')).includes('560px (전체)'), await page.textContent('#expand-width-value'));
  await page.evaluate(() => {
    const slider = document.getElementById('expand-width');
    slider.value = 80;
    slider.dispatchEvent(new Event('input'));
  });
  t.check('an open side offers to change its width', (await page.textContent('#expand-resize')).includes('오른쪽 통로 120px → 80px'), await page.textContent('#expand-resize'));
  await page.click('#expand-resize [data-dir="3"]');
  await page.waitForFunction(() => terrain.zones[zone].open.some(([d, , width]) => d === 3 && width === 80), null, { timeout: 3000 });
  t.check('after resizing there is nothing left to change', await page.isDisabled('#expand-resize [data-dir="3"]'));
  await page.screenshot({ path: shot('expand_width_shop.png') });
  await page.click('#furn-close');
  await wait(300);
  await page.screenshot({ path: shot('expand_wide.png') });
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), widths(t), browser(t)]);
}
