// 농장과 요리: 씨앗 사기, 심기·물 주기·거두기(심은 사람만), 닭장과 젖소, 출하, 다시 켜도 남는 밭과 곳간,
// 조리대 앞에서만 하는 요리(재료, 점수와 별, 너무 빠른 완성 거르기), 먹기.
// 화면: 빈 밭에서 E 로 씨앗 고르기, 자라는 작물과 거두기, 곳간(B), 요리 창과 썰기 놀이
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const FARM = 8;
const SPEED = 60;   // 당근 3초, 감자 5초, 물은 1초마다, 달걀 10초
const env = { MMO_FARM_SPEED: String(SPEED) };
const CARROT = 0, POTATO = 1, TOMATO = 2, CABBAGE = 3, EGG = 8, SEED = 10, DISH = 18;
const goods = (list) => Array.from({ length: 30 }, (_, i) => list[i] || 0).join(',');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const last = (bot, type) => bot.events.filter((e) => e.t === type).at(-1);
const count = (bot, type) => bot.events.filter((e) => e.t === type).length;
const plot = (bot, i) => last(bot, 'farm')?.p[i];
const have = (bot, good) => last(bot, 'goods')?.g[good];
const pause = () => wait(280);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    f: [FARM, 170, 280, { goods: goods({ [SEED + CARROT]: 2, [SEED + POTATO]: 3 }) }],
    g: [FARM, 200, 285],
    shopper: [FARM, 980, 230],
    seller: [FARM, 900, 480, { goods: goods({ [CARROT]: 3, [SEED + CARROT]: 4 }), gold: 10 }],
    keeper: [FARM, 960, 690],
    chef: [FARM, 1070, 390, { goods: goods({ [TOMATO]: 3, [CABBAGE]: 2 }) }],
    out: [0, 820, 620],
  }, { env });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  let f = await enter('f');
  const g = await enter('g'), shopper = await enter('shopper'), seller = await enter('seller'), keeper = await enter('keeper'), chef = await enter('chef'), out = await enter('out');
  const info = f.map.farm;
  t.check('the map describes the farm', info?.zone === FARM && info.plots.length === 24 && info.seed.length === 8 && info.sell.length === 30 && f.map.zones.length === 10, JSON.stringify(info));
  t.check('the village has a farm gate', f.map.buildings.some((b) => b.k === 'farm' && b.name === '농장' && b.room === FARM));
  t.check('entering the farm shows empty plots and my storehouse', plot(f, 0)?.[0] === -1 && have(f, SEED + CARROT) === 2 && have(g, SEED + CARROT) === 0);

  // ---- 씨앗 가게
  f.send(`farm buy ${CARROT} 1`);
  await f.until(() => says(f, '씨앗 가게 앞에서만'), 1000);
  shopper.send(`farm buy ${TOMATO} 5`);
  shopper.send('farm buy 8 1');
  await shopper.until(() => have(shopper, SEED + TOMATO) === 5, 1000);
  t.check('seeds are bought at the stall only', have(f, SEED + CARROT) === 2 && have(shopper, SEED + TOMATO) === 5);

  // ---- 심기, 물 주기, 거두기
  g.send(`farm plant 0 ${CARROT}`);
  await g.until(() => says(g, '씨앗이 없어요'), 1000);
  f.send(`farm plant 23 ${CARROT}`);
  await f.until(() => says(f, '더 가까이'), 1000);
  out.send(`farm plant 0 ${CARROT}`);
  await out.until(() => says(out, '농장에서만'), 1000);
  t.check('planting needs a seed, the farm, and being at the plot', plot(f, 0)[0] === -1);
  f.send(`farm plant 0 ${CARROT}`);
  await g.until(() => plot(g, 0)?.[0] === CARROT, 1000);
  t.check('a planted crop shows to everyone with its owner', plot(f, 0)[4] === 1 && plot(g, 0)[4] === 0 && plot(g, 0)[3] === 'f' && plot(f, 0)[2] === 180 / SPEED && have(f, SEED + CARROT) === 1, JSON.stringify(plot(g, 0)));
  await pause();
  f.send(`farm plant 0 ${POTATO}`);
  await f.until(() => says(f, '이미 무언가'), 1000);
  f.send('farm harvest 0');
  await wait(150);
  t.check('a growing plot cannot be replanted or harvested', plot(f, 0)[0] === CARROT && have(f, CARROT) === 0);
  await wait(1100);   // 초 단위 시각이 넘어가 남은 시간이 줄어든 것을 볼 수 있게
  const before = count(g, 'farm');
  g.send('farm water 0');
  await g.until(() => count(g, 'farm') > before, 1000);
  t.check('anyone can water, and it speeds the crop up', plot(g, 0)[1] <= 1 && plot(g, 0)[5] > 0 && says(f, 'g님이 내 당근에 물을'), JSON.stringify(plot(g, 0)));
  g.send('farm water 0');
  await wait(1700);
  g.send('farm harvest 0');
  await g.until(() => says(g, 'f님이 심은'), 1000);
  t.check('only the planter harvests', plot(g, 0)[0] === CARROT && have(g, CARROT) === 0);
  f.send('farm harvest 0');
  await f.until(() => last(f, 'harvest'), 1000);
  t.check('harvesting gives the crop and frees the plot', have(f, CARROT) >= 2 && last(f, 'harvest').n === have(f, CARROT) && last(f, 'harvest').crop === CARROT && plot(g, 0)[0] === -1, JSON.stringify(last(f, 'harvest')));
  await pause();
  f.send(`farm plant 0 ${POTATO}`);
  await f.until(() => plot(f, 0)?.[0] === POTATO, 1000);

  // ---- 닭장, 출하
  keeper.send('farm egg');
  await keeper.until(() => have(keeper, EGG) === 2, 1000);
  await pause();
  keeper.send('farm egg');
  await keeper.until(() => says(keeper, '아직 알을'), 1000);
  t.check('the coop gives eggs, then needs a rest', have(keeper, EGG) === 2 && last(keeper, 'goods').egg > 0);
  f.send(`farm sell ${CARROT} 1`);
  await f.until(() => says(f, '출하 상자 앞에서만'), 1000);
  seller.send(`farm sell ${CARROT} 2`);
  seller.send(`farm sell ${CARROT} 99`);
  seller.send(`farm sell ${SEED + CARROT} 4`);
  await seller.until(() => last(seller, 'inv')?.g === 10 + 3 * info.sell[CARROT] + 4 * info.sell[SEED + CARROT], 1500);
  t.check('the shipping box pays for what you put in', have(seller, CARROT) === 0 && have(seller, SEED + CARROT) === 0 && info.sell[CARROT] === 18, JSON.stringify([last(seller, 'inv')?.g, last(seller, 'goods')?.g]));

  // ---- 요리
  f.send('cook start 0');
  await f.until(() => says(f, '조리대 앞에서만'), 1000);
  chef.send('cook start 3');
  await chef.until(() => says(chef, '재료가 모자라요'), 1000);
  chef.send('cook start 0');
  await chef.until(() => last(chef, 'cook')?.r === 0, 1000);
  chef.send('cook done 100');
  await wait(300);
  t.check('a dish finished too fast is thrown away', !last(chef, 'cooked') && have(chef, TOMATO) === 3 && !have(chef, DISH));
  chef.send('cook done 100');
  await wait(200);
  t.check('and cannot be finished without starting again', !last(chef, 'cooked'));
  chef.send('cook start 0');
  await wait(3200);
  chef.send('cook done 95');
  await chef.until(() => last(chef, 'cooked'), 1000);
  t.check('a perfect dish uses the ingredients and gives two plates', last(chef, 'cooked').stars === 3 && last(chef, 'cooked').n === 2 && have(chef, DISH) === 2 && have(chef, TOMATO) === 2 && have(chef, CABBAGE) === 1, JSON.stringify(last(chef, 'cooked')));
  t.check('people nearby hear about it', says(shopper, 'chef님이 *** 채소 샐러드를 완벽하게'));
  chef.send('cook start 0');
  await wait(3200);
  chef.send('cook done 40');
  await chef.until(() => count(chef, 'cooked') === 2, 1000);
  t.check('a clumsy one still makes a plate', last(chef, 'cooked').stars === 1 && have(chef, DISH) === 3 && have(chef, CABBAGE) === 0);
  const emotes = count(shopper, 'emote');
  chef.send(`farm eat ${DISH}`);
  chef.send(`farm eat ${TOMATO}`);
  await chef.until(() => have(chef, DISH) === 2, 1000);
  await wait(150);
  t.check('dishes can be eaten, raw crops cannot', have(chef, TOMATO) === 1 && count(shopper, 'emote') === emotes + 1, JSON.stringify([have(chef, TOMATO), emotes, count(shopper, 'emote'), shopper.zone, chef.zone]));
  chef.send('stats');
  await chef.until(() => last(chef, 'stats'), 1000);
  t.check('cooking is kept in the profile', last(chef, 'stats').s[21] === 2 && last(chef, 'stats').s[22] === 1, JSON.stringify(last(chef, 'stats').s));

  // ---- 다시 켜도 남는다
  const carrots = have(f, CARROT);
  for (const bot of [f, g, shopper, seller, keeper, chef, out]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir, env });
  f = await Bot.enter(again, 'f', { id: ids.f });
  await f.until(() => last(f, 'farm'), 1000);
  t.check('the field and the storehouse survive a restart', plot(f, 0)?.[0] === POTATO && plot(f, 0)[4] === 1 && have(f, CARROT) === carrots && have(f, SEED + POTATO) === 2, JSON.stringify([plot(f, 0), last(f, 'goods')?.g]));
  f.close();
  await again.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({
    farmer: [FARM, 170, 280, { goods: goods({ [SEED + CARROT]: 2 }) }],
    cook: [FARM, 1070, 390, { goods: goods({ [TOMATO]: 2, [CABBAGE]: 2 }) }],
  }, { env });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.farmer, { name: 'farmer' });
  await page.waitForFunction(() => zone === 8 && farmPlots.length === 24, null, { timeout: 4000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#farm-pick:visible');
  t.check('E at an empty plot offers my seeds', (await page.textContent('#farm-pick-list')).includes('당근') && (await page.$$('.seed-pick')).length === 1);
  await page.click('.seed-pick');
  await page.waitForFunction(() => farmPlots[0]?.crop === 0, null, { timeout: 2000 });
  t.check('picking one plants it', !(await page.isVisible('#farm-pick')) && await page.evaluate(() => farmPlots[0].mine && myGoods[10] === 1));
  await wait(700);
  await page.screenshot({ path: path.join(SHOTS, 'farm_planted.png') });
  await page.waitForFunction(() => plotStage(farmPlots[0], performance.now()) === 3, null, { timeout: 6000 });
  t.check('the hint turns to harvesting when it is ripe', await page.evaluate(() => useChoice(selfNow())?.label === '당근 거두기'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => myGoods[0] >= 2, null, { timeout: 2000 });
  t.check('E harvests into the storehouse', await page.evaluate(() => farmPlots[0].crop === -1));
  await page.keyboard.press('KeyB');
  await page.waitForSelector('#farm:visible');
  t.check('B opens the storehouse', (await page.textContent('#farm-list')).includes('당근') && (await page.getAttribute('#farm-tabs [data-tab="store"]', 'aria-selected')) === 'true');
  await page.click('#farm-tabs [data-tab="seeds"]');
  t.check('the seed tab lists every crop', (await page.$$('#farm-list .good-row')).length === 8);
  await page.screenshot({ path: path.join(SHOTS, 'farm_window.png') });
  t.check('no script errors on the farm', page.problems.length === 0, page.problems.join(' | '));
  await page.close();

  // ---- 요리: 실제로 썰어 본다
  const chef = await enterGame(browser, server, ids.cook, { name: 'cook' });
  await chef.waitForFunction(() => zone === 8 && myGoods[2] === 2, null, { timeout: 4000 });
  await chef.keyboard.press('KeyE');
  await chef.waitForSelector('#cook:visible');
  const rows = await chef.$$eval('#cook-list .good-row', (els) => els.map((e) => e.querySelector('button').disabled));
  t.check('the cooking window lists recipes and what I can make', rows.length === 12 && rows[0] === false && rows.slice(1).every(Boolean), JSON.stringify(rows));
  await chef.screenshot({ path: path.join(SHOTS, 'cook_list.png') });
  await chef.click('#cook-list [data-recipe="0"] button');
  await chef.waitForFunction(() => cook?.phase === 'play', null, { timeout: 4000 });
  t.check('starting shows the steps', (await chef.textContent('#cook-steps')).includes('썰기') && (await chef.textContent('#cook-steps')).includes('담기') && await chef.isVisible('#cook-canvas'));
  for (let cut = 0; cut < 6; cut++) {
    await chef.waitForFunction((done) => cook.index === 0 && cook.state.cut.length === done && cook.state.marks.some((m, i) => !cook.state.cut.includes(i) && Math.abs(m - cook.state.knife) < 0.015), cut, { timeout: 6000, polling: 'raf' });
    await chef.keyboard.press('Space');
  }
  await chef.waitForFunction(() => cook?.index === 1, null, { timeout: 3000 });
  const chop = await chef.evaluate(() => cook.scores[0]);
  t.check('chopping on the marks scores well', chop >= 60, chop);
  const walked = await chef.evaluate(() => ({ x: me.x, y: me.y }));
  await chef.waitForFunction(() => cook?.phase === 'play', null, { timeout: 3000 });
  await chef.keyboard.press('KeyD');
  await wait(200);
  t.check('keys do not walk the character while cooking', JSON.stringify(await chef.evaluate(() => ({ x: me.x, y: me.y }))) === JSON.stringify(walked));
  await chef.screenshot({ path: path.join(SHOTS, 'cook_play.png') });
  await chef.evaluate(() => finishCookStep(96));
  await chef.waitForSelector('#cook-result:visible', { timeout: 6000 });
  t.check('the result shows stars and adds the dish', (await chef.textContent('#cook-result-text')).includes('채소 샐러드') && (await chef.textContent('#cook-result-text')).includes('★') && await chef.evaluate(() => myGoods[18] >= 1 && myGoods[2] === 1));
  await chef.screenshot({ path: path.join(SHOTS, 'cook_result.png') });
  await chef.click('#cook-again');
  t.check('and returns to the recipes', await chef.isVisible('#cook-list'));
  await chef.keyboard.press('Escape');
  t.check('Esc closes the cooking window', !(await chef.isVisible('#cook')));
  t.check('no script errors while cooking', chef.problems.length === 0, chef.problems.join(' | '));

  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await screen(t);
}
