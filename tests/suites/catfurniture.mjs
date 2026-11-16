// 고양이 가구: 집에 풀어놓은 고양이는 쉬다가 같은 방의 캣타워·캣휠·숨숨집을 쓰고, 쓰다듬으면 내려온다. 강아지는 쓰지 않는다.
// 데리고 다니는 고양이 펫은 주인이 고양이 가구 곁에 잠시 서 있으면 그 가구를 쓰고(캣휠은 돈다), 주인이 멀어지면 내려온다.
import path from 'node:path';
import { Bot, enterGame, launchBrowser, pageWalkTo, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const HEYEON = 9, RARA = 2;
const TOWER = 73, WHEEL = 74, HIDEOUT = 75;
const CHEESE = 0, CHOCO = 7, RAGDOLL = 8;
const ENV = { MMO_CAT_NAP: '0', MMO_CAT_FURNITURE: '100' };   // 쉬고 나면 늘 가구로 간다
const pause = () => wait(280);
const decor = (bot) => bot.lastEvent('decor')?.p || [];
const cats = (bot) => bot.cats || [];

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [HEYEON, 320, 380, { f73: 1, pets: 1 << CHEESE }],
    b: [RARA, 300, 420, { f73: 1, pets: 1 << CHOCO }],
  }, { env: ENV });
  const a = await Bot.enter(server, 'a', { id: ids.a });
  const b = await Bot.enter(server, 'b', { id: ids.b });
  await wait(100);
  a.send(`decor place ${TOWER} 400 330`);
  b.send(`decor place ${TOWER} 420 330`);
  await a.until(() => decor(a).some((d) => d[1] === TOWER), 1500);
  await b.until(() => decor(b).some((d) => d[1] === TOWER), 1500);
  const tower = decor(a).find((d) => d[1] === TOWER)[0], dogTower = decor(b).find((d) => d[1] === TOWER)[0];
  await pause();
  a.send(`releasepet ${CHEESE}`);
  b.send(`releasepet ${CHOCO}`);
  await a.until(() => cats(a).some((c) => c[4] === tower), 15000);
  const perched = cats(a).find((c) => c[4] === tower);
  t.check('a released cat climbs the cat tower in its room', !!perched && perched[2] === CHEESE, JSON.stringify(cats(a)));
  t.check('it stands just in front of the tower while it is up there', perched && perched[0] === 400 && perched[1] === 330 + 20, JSON.stringify(perched));
  t.check('a dog leaves the cat furniture alone', !cats(b).some((c) => c[4] === dogTower) && !b.catSamples.some((sample) => sample.p.some((c) => c[4] >= 0)), JSON.stringify(cats(b)));

  // 쓰다듬으면 내려온다 (주인이 고양이 곁으로 간다)
  a.send('in 8');
  await a.until(() => Math.hypot(a.me.x - 400, a.me.y - 350) < 60, 3000);
  a.send('in 0');
  await pause();
  a.send('pet');
  await a.until(() => a.events.some((e) => e.t === 'cat' && e.act === 'pet') && cats(a).every((c) => !(c[4] >= 0)), 3000);
  t.check('petting a cat on its tower brings it down', a.events.some((e) => e.t === 'cat' && e.act === 'pet') && cats(a).every((c) => !(c[4] >= 0)), JSON.stringify(cats(a)));

  // 가구를 치우면 내려온다
  await a.until(() => cats(a).some((c) => c[4] === tower), 15000);
  await pause();
  a.send(`decor take ${tower}`);
  await a.until(() => cats(a).length && cats(a).every((c) => !(c[4] >= 0)), 3000);
  t.check('taking the tower away brings the cat down', cats(a).every((c) => !(c[4] >= 0)), JSON.stringify(cats(a)));
  a.close();
  b.close();
  await server.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({ g: [HEYEON, 320, 380, { f74: 1, f75: 1, pets: 1 << RAGDOLL }] }, { env: ENV });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g', viewport: { width: 1100, height: 760 } });
  const send = (m) => page.evaluate((m) => ws.send(m), m);
  await send(`decor place ${WHEEL} 300 170`);
  await wait(300);
  await send(`decor place ${HIDEOUT} 470 330`);
  await wait(300);
  await send(`walkpet ${RAGDOLL}`);
  await page.waitForFunction(() => petFollowers.size === 1 && decorItems.length >= 2, null, { timeout: 3000 });
  await pageWalkTo(page, 360, 230, 10);
  await page.waitForFunction(() => [...petFollowers.values()][0].perchId >= 0, null, { timeout: 6000 }).catch(() => {});
  const onWheel = await page.evaluate(() => {
    const f = [...petFollowers.values()][0], wheel = decorItems.find((d) => d.info.k === 'cat_wheel');
    return { perch: f.perchId, wheel: wheel.id, spinning: catPerchBusy.has(wheel.id) };
  });
  t.check('a walked cat hops into the wheel when you stand by it, and the wheel turns', onWheel.perch === onWheel.wheel && onWheel.spinning, JSON.stringify(onWheel));
  await page.screenshot({ path: path.join(SHOTS, 'cat_wheel.png') });
  await pageWalkTo(page, 520, 380, 10);
  await page.waitForFunction(() => [...petFollowers.values()][0].perchId === decorItems.find((d) => d.info.k === 'cat_hideout').id, null, { timeout: 6000 }).catch(() => {});
  const inside = await page.evaluate(() => ({ perch: [...petFollowers.values()][0].perchId, hideout: decorItems.find((d) => d.info.k === 'cat_hideout').id, wheelStill: !catPerchBusy.has(decorItems.find((d) => d.info.k === 'cat_wheel').id) }));
  t.check('walking over to the hideout, it leaves the wheel and peeks out of the hideout', inside.perch === inside.hideout && inside.wheelStill, JSON.stringify(inside));
  await page.screenshot({ path: path.join(SHOTS, 'cat_hideout.png') });
  await pageWalkTo(page, 120, 380, 10);
  await page.waitForFunction(() => !([...petFollowers.values()][0].perchId >= 0), null, { timeout: 4000 }).catch(() => {});
  t.check('walking away, it comes down and follows again', await page.evaluate(() => !([...petFollowers.values()][0].perchId >= 0)));
  t.check('no script errors around cat furniture', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), screen(t)]);
}
