// 집 안의 강아지: 캬캬 집의 뭉치, 몰쟈 집의 재롱이
import { Bot, enterGame, launchBrowser, serverWithAccounts, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, KYAKYA = 3;
const catEvents = (bot) => bot.events.filter((e) => e.t === 'cat');

async function reachPet(bot) {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    const [cx, cy] = bot.cats[0];
    if (Math.hypot(cx - bot.me.x, cy - bot.me.y) < 45) {
      bot.send('in 0');
      await wait(100);
      const [ax, ay] = bot.cats[0];
      if (Math.hypot(ax - bot.me.x, ay - bot.me.y) < 60) return true;
    }
    await bot.walkTo(cx + 26, cy + 10, 10, 3000);
  }
  return false;
}

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({
    owner: [KYAKYA, 790, 150, { c0: 1 }], guest: [KYAKYA, 660, 200], molja: [MOLJA, 250, 300], rara: [RARA, 300, 200], outside: [0, 820, 620],
  }, { env: { MMO_CAT_NAP: '0' } });   // 돌아다니는 것을 보는 시험이라 낮잠은 끈다
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const owner = await enter('owner');
  const guest = await enter('guest');
  const molja = await enter('molja');
  const rara = await enter('rara');
  const outside = await enter('outside');
  await owner.until(() => owner.cats && molja.cats && outside.cats, 1000);
  await wait(400);

  t.check('one dog lives in 캬캬 house', owner.cats?.length === 1, JSON.stringify(owner.cats));
  t.check('one dog lives in 몰쟈 house', molja.cats?.length === 1, JSON.stringify(molja.cats));
  t.check('랏라 house has no pets', !rara.cats, JSON.stringify(rara.cats));
  t.check('outdoor cats are still five', outside.cats?.length === 5, JSON.stringify(outside.cats));

  // ---- 방 안을 돌아다니되 벽과 가구 안으로 들어가지 않는다
  const room = owner.map.zones[KYAKYA];
  const solids = owner.map.solids.filter((s) => s[0] === KYAKYA);
  const start = owner.catSamples.length;
  await wait(14000);
  const samples = owner.catSamples.slice(start);
  const inside = samples.every(({ p }) => p.every(([x, y]) => x >= 16 && y >= 16 && x <= room.w - 16 && y <= room.h - 16));
  const clear = samples.every(({ p }) => p.every(([x, y]) => !solids.some(([, x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)));
  const moved = samples.some(({ p }) => Math.hypot(p[0][0] - samples[0].p[0][0], p[0][1] - samples[0].p[0][1]) > 20);
  t.check('dog stays inside the room', inside);
  t.check('dog does not walk through furniture', clear);
  t.check('dog wanders around', moved);

  // ---- 쓰다듬기와 먹이
  t.check('reached the dog', await reachPet(owner));
  const before = catEvents(guest).length;
  owner.send('pet');
  await guest.until(() => catEvents(guest).length > before, 1000);
  const pet = catEvents(guest).at(-1);
  t.check('petting works indoors', pet?.act === 'pet' && pet.i === 0 && pet.id === owner.id, JSON.stringify(pet));
  await wait(60);
  t.check('other zones do not hear about it', catEvents(molja).length === 0 && catEvents(outside).length === 0);

  await wait(700);
  await reachPet(owner);
  const feedBefore = catEvents(guest).length;
  owner.send('feed');
  await guest.until(() => catEvents(guest).length > feedBefore, 1000);
  const fed = catEvents(guest).at(-1);
  t.check('feeding uses up a fish', fed?.act === 'feed' && fed.c[0] === 0, JSON.stringify(fed));
  await wait(150);
  await owner.walkTo(700, 300, 12);
  await wait(2200);
  const [fx, fy] = owner.cats[0];
  t.check('fed dog follows around the room', Math.hypot(fx - owner.me.x, fy - owner.me.y) < 90, Math.hypot(fx - owner.me.x, fy - owner.me.y));

  // ---- 화면: 이름과 그림
  guest.close();
  molja.close();
  await wait(150);
  const browser = await launchBrowser();
  const kyakya = await enterGame(browser, server, ids.guest, { name: 'guest' });
  const moljaPage = await enterGame(browser, server, ids.molja, { name: 'molja' });
  await kyakya.waitForFunction(() => cats.length === 1, null, { timeout: 2000 });
  await moljaPage.waitForFunction(() => cats.length === 1, null, { timeout: 2000 });
  t.check('캬캬 dog is called 뭉치', await kyakya.evaluate(() => cats[0].coat.name === '뭉치' && cats[0].coat.dog === true));
  t.check('몰쟈 dog is called 재롱이', await moljaPage.evaluate(() => cats[0].coat.name === '재롱이' && cats[0].coat.dog === true));
  const drawn = await moljaPage.evaluate(() => new Promise((resolve) => {
    const original = drawDog;
    window.drawDog = (d, now) => { window.drawDog = original; original(d, now); resolve(true); };
    setTimeout(() => resolve(false), 1000);
  }));
  t.check('dogs are drawn as dogs', drawn);
  await moljaPage.evaluate(() => { const c = cats[0]; c.fromX = c.toX = 380; c.fromY = c.toY = 300; c.x = 380; c.y = 300; });
  await wait(60);
  await moljaPage.screenshot({ path: new URL('../.screenshots/dog_molja.png', import.meta.url).pathname });
  t.check('dog barks when petted', await moljaPage.evaluate(() => { handleCatEvent({ i: 0, act: 'pet', id: myId, n: 'x' }); return cats[0].says === '멍멍!'; }));
  const problems = [...kyakya.problems, ...moljaPage.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();

  for (const bot of [owner, rara, outside]) bot.close();
  await wait(100);
  await server.stop();
}
