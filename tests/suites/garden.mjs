// 텃밭과 가방: 텃밭 가구를 집 안과 집 근처 마당에 놓고 심기·물 주기·거두기, 다시 켜도 남는 작물,
// 마당에 놓을 수 있는 것과 자리, 농장의 물건을 가방에서 버리고 줍고 교환하기.
// 화면: 가방에 보이는 농산물, 텃밭 앞에서 E 로 심고 거두기
import { Bot, enterGame, launchBrowser, serverWithAccounts, startServer, wait } from '../lib.mjs';

const RARA = 2;
const SPEED = 60;   // 당근 3초, 감자 5초
const env = { MMO_FARM_SPEED: String(SPEED) };
const CARROT = 0, POTATO = 1, SEED = 10, DISH = 18;
const PLOT = 62, WOOD = 63, FENCE = 69, CHAIR = 0;
const BAG = 13;     // 가방에서 농장의 물건이 시작하는 번호 (물고기 3, 전리품 2, 매점 8 다음)
const goods = (list) => Array.from({ length: 30 }, (_, i) => list[i] || 0).join(',');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const last = (bot, type) => bot.events.filter((e) => e.t === type).at(-1);
const have = (bot, good) => last(bot, 'goods')?.g[good];
const beds = (bot) => last(bot, 'decor')?.p.filter((d) => d[1] >= PLOT && d[1] < PLOT + 6) || [];
const crop = (bot, id) => last(bot, 'garden')?.p.find((g) => g[0] === id);
const pause = () => wait(280);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [RARA, 200, 230, { goods: goods({ [SEED + CARROT]: 2, [SEED + POTATO]: 2 }), f62: 2, f63: 1 }],
    b: [RARA, 230, 240, { goods: goods({ [SEED + CARROT]: 1 }) }],
    yard: [0, 300, 1440, { goods: goods({ [SEED + CARROT]: 1 }), f62: 2, f69: 9, f0: 1 }],
    plaza: [0, 820, 620, { f62: 1, goods: goods({ [CARROT]: 5, [DISH]: 2 }) }],
    picker: [0, 900, 620],
  }, { env });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  let a = await enter('a');
  const b = await enter('b'), yard = await enter('yard'), plaza = await enter('plaza'), picker = await enter('picker');
  t.check('the catalog has garden beds that lie flat', a.map.catalog[PLOT]?.k === 'plot_soil' && a.map.catalog[PLOT].place === 2 && a.map.catalog[FENCE]?.k === 'garden_fence' && a.map.farm.yard > 0);

  // ---- 집 안의 텃밭
  a.send(`decor place ${PLOT} 200 200`);
  await b.until(() => beds(b).length === 1, 1500);
  const bed = beds(a)[0]?.[0];
  t.check('a bed is placed inside a house', beds(a).length === 1 && beds(b).length === 1);
  await pause();
  b.send(`garden plant ${bed} ${POTATO}`);
  await b.until(() => says(b, '씨앗이 없어요'), 1000);
  a.send(`garden plant ${bed} 9`);
  await pause();
  t.check('planting needs a seed and a real crop', !crop(a, bed));
  a.send(`garden plant ${bed} ${CARROT}`);
  await b.until(() => crop(b, bed), 1500);
  t.check('a planted bed shows to everyone with its owner', crop(a, bed)?.[1] === CARROT && crop(a, bed)[5] === 1 && crop(b, bed)[5] === 0 && crop(b, bed)[4] === 'a' && have(a, SEED + CARROT) === 1, JSON.stringify(crop(b, bed)));
  await pause();
  a.send(`garden plant ${bed} ${POTATO}`);
  await a.until(() => says(a, '이미 무언가'), 1000);
  const before = crop(b, bed)[2];
  b.send(`garden water ${bed}`);
  await a.until(() => says(a, 'b님이 내 당근에 물을'), 1500);
  t.check('anyone can water and the owner hears of it', says(a, 'b님이 내 당근에 물을') && crop(b, bed)[2] <= before && crop(b, bed)[6] > 0, JSON.stringify(crop(b, bed)));
  await pause();
  b.send(`decor take ${bed}`);
  await pause();
  t.check('a guest cannot take the bed', beds(a).length === 1);
  await wait(3200);
  b.send(`garden harvest ${bed}`);
  await b.until(() => says(b, '심은 작물'), 1000);
  t.check('only the planter harvests', says(b, '심은 작물') && !have(b, CARROT));
  a.send(`garden harvest ${bed}`);
  await a.until(() => last(a, 'harvest'), 1500);
  t.check('harvesting fills the storehouse and empties the bed', last(a, 'harvest')?.bed === bed && have(a, CARROT) >= 2 && !crop(a, bed), JSON.stringify(last(a, 'harvest')));

  // ---- 다시 켜도 남는다, 내 작물은 밭과 함께 치운다
  await pause();
  a.send(`garden plant ${bed} ${POTATO}`);
  await a.until(() => crop(a, bed), 1500);
  await wait(400);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir, env });
  a = await Bot.enter(again, 'a', { id: ids.a });
  await a.until(() => last(a, 'garden'), 1500);
  const kept = beds(a)[0]?.[0];
  t.check('a growing bed survives a restart', beds(a).length === 1 && crop(a, kept)?.[1] === POTATO && crop(a, kept)[5] === 1, JSON.stringify(last(a, 'garden')));
  a.send(`decor take ${kept}`);
  await a.until(() => beds(a).length === 0, 1500);
  t.check('taking my bed clears my crop with it', beds(a).length === 0 && last(a, 'garden').p.length === 0 && last(a, 'inv').f[PLOT] === 2);
  a.close();
  await again.stop();

  const second = await startServer({ dataDir: server.dataDir, env });
  const enter2 = async (name) => {
    const bot = await Bot.enter(second, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const y = await enter2('yard'), p = await enter2('plaza'), k = await enter2('picker');

  // ---- 마당
  p.send(`decor place ${PLOT} 820 660`);
  await p.until(() => says(p, '집 근처 마당에만'), 1000);
  y.send(`decor place ${CHAIR} 290 1450`);
  await y.until(() => says(y, '집 안에서만'), 1000);
  y.send(`decor place ${PLOT} 449 1316`);
  await pause();
  y.send(`decor place ${PLOT} 449 1420`);
  await y.until(() => says(y, '문 앞에는'), 1000);
  t.check('yards are near a house, off buildings and doorways, and for garden things only', says(p, '집 근처 마당에만') && says(y, '집 안에서만') && says(y, '문 앞에는') && beds(y).length === 0);
  await pause();
  y.send(`decor place ${PLOT} 290 1450`);
  await y.until(() => beds(y).length === 1, 1500);
  await pause();
  y.send(`decor place ${PLOT} 300 1460`);
  await y.until(() => says(y, '겹칩니다'), 1000);
  t.check('a bed goes down in the yard, and not on top of another', beds(y).length === 1 && says(y, '겹칩니다'));
  const out = beds(y)[0][0];
  await pause();
  y.send(`garden plant ${out} ${CARROT}`);
  await y.until(() => crop(y, out), 1500);
  await wait(3300);
  y.send(`garden harvest ${out}`);
  await y.until(() => last(y, 'harvest'), 1500);
  t.check('crops grow in the yard too', have(y, CARROT) >= 2);
  for (let i = 0; i < 9; i++) {
    y.send(`decor place ${FENCE} ${i < 7 ? 130 + i * 30 : 200 + (i - 7) * 30} ${i < 7 ? 1395 : 1340}`);
    await pause();
  }
  await y.until(() => says(y, '8개까지'), 1000);
  t.check('a yard holds eight things a person', last(y, 'decor').p.length === 8 && says(y, '8개까지'), last(y, 'decor').p.length);

  // ---- 가방: 버리고, 줍고, 교환한다
  const dropsOf = (bot) => bot.drops || [];
  p.send(`drop ${BAG + CARROT} 2`);
  await p.until(() => have(p, CARROT) === 3 && dropsOf(p).length > 0, 1500);
  t.check('farm goods drop on the ground from the bag', dropsOf(p).some((d) => d[1] === BAG + CARROT && d[4] === 2), JSON.stringify(dropsOf(p)));
  await k.walkTo(820, 632, 10, 6000);
  await k.until(() => have(k, CARROT) === 2, 3000);
  t.check('and someone else picks them up', have(k, CARROT) === 2 && k.events.some((e) => e.t === 'loot' && e.k === BAG + CARROT));
  await pause();
  k.send(`trade ask ${p.id}`);
  await p.until(() => p.events.some((e) => e.t === 'trade' && e.a === 'ask'), 1000);
  p.send(`trade yes ${k.id}`);
  await p.until(() => p.events.some((e) => e.t === 'trade' && e.a === 'state'), 1000);
  await pause();
  p.send(`trade item ${BAG + DISH} 5`);
  await k.until(() => last(k, 'trade')?.theirs?.i[BAG + DISH] === 2, 1500);
  t.check('dishes go on the trade table, capped at what I have', last(k, 'trade').theirs.i.length === 43 && last(k, 'trade').theirs.i[BAG + DISH] === 2);
  await pause();
  p.send('trade ready');
  await pause();
  k.send('trade ready');
  await k.until(() => have(k, DISH) === 2, 1500);
  t.check('and change hands', have(k, DISH) === 2 && have(p, DISH) === 0 && have(p, CARROT) === 3);

  await second.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({
    g: [RARA, 200, 250, { goods: goods({ [SEED + CARROT]: 2, [CARROT]: 4, [DISH]: 1 }), f63: 1, hp: 50 }],
  }, { env });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g' });
  await page.waitForFunction(() => zone === 2 && myGoods[0] === 4, null, { timeout: 4000 });
  await page.keyboard.press('KeyI');
  await page.waitForSelector('#bag:visible');
  const names = await page.$$eval('.bag-slot.filled', (els) => els.map((e) => ITEMS[Number(e.dataset.kind)].name));
  t.check('the bag shows crops, seeds and dishes', ['당근', '당근 씨앗', '채소 샐러드'].every((n) => names.includes(n)) && (await page.$$('.bag-slot')).length === 48, JSON.stringify(names));
  const dish = await page.evaluate(() => ITEMS.findIndex((item) => item.name === '채소 샐러드'));
  await page.click(`.bag-slot[data-kind="${dish}"]`);
  await page.waitForFunction(() => myGoods[18] === 0, null, { timeout: 3000 });
  t.check('clicking a dish in the bag eats it', await page.evaluate(() => myGoods[18]) === 0);
  await page.keyboard.press('Escape');

  await page.evaluate(() => ws.send('decor place 63 200 190'));
  await page.waitForFunction(() => decorItems.some((d) => d.info.k === 'plot_wood'), null, { timeout: 3000 });
  await wait(300);
  t.check('E offers to plant at an empty bed', (await page.evaluate(() => useChoice(selfNow())?.label)) === '씨앗 심기');
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#farm-pick:visible');
  await page.click('#farm-pick-list [data-crop="0"]');
  await page.waitForFunction(() => gardenBeds.size === 1, null, { timeout: 3000 });
  await page.waitForFunction(() => useChoice(selfNow())?.label.includes('거두기'), null, { timeout: 8000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => myGoods[0] >= 6, null, { timeout: 3000 });
  t.check('the crop grows and E harvests it', await page.evaluate(() => myGoods[0] >= 6 && gardenBeds.size === 0));
  t.check('no script errors in the garden', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
