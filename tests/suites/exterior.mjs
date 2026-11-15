// 집 외관: 집 안이나 그 집 문 앞에서만, 값 검사, 모두에게 알림, 다시 켜도 그대로. 화면: 상점의 외관 탭, 미리보기, 마을의 집과 집 안의 문
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, startServer, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2;
const shot = (name) => path.join(SHOTS, name);
const ext = (bot) => bot.lastEvent('ext');
const of = (bot, zone) => ext(bot)?.p.find((r) => r[0] === zone)?.slice(1);
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    inside: [MOLJA, 340, 360], porch: [0, 449, 1395], plaza: [0, 820, 620],
  });
  const inside = await Bot.enter(server, 'inside', { id: ids.inside });
  const porch = await Bot.enter(server, 'porch', { id: ids.porch });
  const plaza = await Bot.enter(server, 'plaza', { id: ids.plaza });
  await wait(100);
  t.check('everyone gets every house exterior on joining', ext(plaza)?.p.length === 3 && ext(plaza).p.every((r) => r.slice(1).join() === '0,0,0,0,0'), JSON.stringify(ext(plaza)));

  plaza.send(`ext ${MOLJA} 1 1 1 1`);
  await plaza.until(() => says(plaza, '문 앞에서만'), 1500);
  t.check('far from the house you cannot change it', of(plaza, MOLJA).join() === '0,0,0,0,0');

  inside.send(`ext ${MOLJA} 2 3 7 63`);
  await plaza.until(() => of(plaza, MOLJA)?.join() === '2,3,7,63,0', 1500);
  t.check('inside the house you can, and everyone sees it', of(plaza, MOLJA).join() === '2,3,7,63,0' && of(porch, MOLJA).join() === '2,3,7,63,0');

  porch.send(`ext ${RARA} 5 4 5 2`);
  await plaza.until(() => of(plaza, RARA)?.join() === '5,4,5,2,0', 1500);
  t.check('in front of the door you can too', of(plaza, RARA).join() === '5,4,5,2,0');
  await wait(250);
  porch.send(`ext ${MOLJA} 0 0 0 0`);
  await porch.until(() => says(porch, '문 앞에서만'), 1500);
  t.check('only the house whose door you stand at', of(porch, MOLJA).join() === '2,3,7,63,0');

  const count = inside.events.filter((e) => e.t === 'ext').length;
  for (const bad of [`ext ${MOLJA} 9 0 0 0`, `ext ${MOLJA} 0 9 0 0`, `ext ${MOLJA} 0 0 8 0`, `ext ${MOLJA} 0 0 0 64`, `ext ${MOLJA} -1 0 0 0`, 'ext 4 1 1 1 1', 'ext 1 x', 'ext', `ext ${MOLJA} 2 3 7 63`]) {
    inside.send(bad);
    await wait(40);
  }
  await wait(250);
  t.check('bad values and non-houses are ignored', inside.events.filter((e) => e.t === 'ext').length === count && !inside.closed);
  // 집 모양
  inside.send(`ext ${MOLJA} 2 3 7 63 8`);
  await plaza.until(() => of(plaza, MOLJA)[4] === 8, 1500);
  t.check('the shape of a house can change too', of(plaza, MOLJA).join() === '2,3,7,63,8');
  await wait(1100);
  inside.send(`ext ${MOLJA} 2 3 7 62`);
  await plaza.until(() => of(plaza, MOLJA)[3] === 62, 1500);
  t.check('an old client that sends no shape keeps it', of(plaza, MOLJA).join() === '2,3,7,62,8');
  await wait(1100);
  inside.send(`ext ${MOLJA} 2 3 7 63 9`);
  inside.send(`ext ${MOLJA} 2 3 7 63 0`);
  await plaza.until(() => of(plaza, MOLJA).join() === '2,3,7,63,0', 1500);
  t.check('unknown shapes are refused and the original comes back', of(plaza, MOLJA).join() === '2,3,7,63,0');
  await wait(1100);

  for (const bot of [inside, porch, plaza]) bot.close();
  await wait(200);
  await server.stop();
  t.check('exteriors are saved to a file', existsSync(path.join(server.dataDir, 'exteriors.list')));
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'back');
  await back.until(() => ext(back), 1500);
  t.check('exteriors survive a restart', of(back, MOLJA)?.join() === '2,3,7,63,0' && of(back, RARA)?.join() === '5,4,5,2,0', JSON.stringify(ext(back)));
  back.close();
  await again.stop();
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ painter: [0, 1105, 1395] });
  const chrome = await launchBrowser();
  const page = await enterGame(chrome, server, ids.painter, { name: '칠장이', viewport: { width: 1200, height: 800 } });
  await wait(300);
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="ext"]');
  await wait(200);
  t.check('the exterior tab finds the house at the door', (await page.textContent('#ext-name')) === '몰쟈의 집' && await page.evaluate(() => extTarget === 1));
  t.check('it offers walls, roofs, doors and decorations', (await page.$$('#ext-walls button')).length === 9 && (await page.$$('#ext-roofs button')).length === 9 && (await page.$$('#ext-doors button')).length === 8 && (await page.$$('#ext-decos button')).length === 6);
  t.check('it offers house shapes with pictures', (await page.$$('#ext-forms button')).length === 9 && (await page.$$('#ext-forms canvas')).length === 8);
  t.check('nothing to apply before picking', await page.isDisabled('#ext-apply'));
  await page.click('#ext-walls button:nth-child(4)');
  await page.click('#ext-roofs button:nth-child(2)');
  await page.click('#ext-doors button:nth-child(5)');
  await page.click('#ext-decos button:nth-child(2)');
  await page.click('#ext-decos button:nth-child(6)');
  t.check('picking previews without changing the house', await page.evaluate(() => JSON.stringify(extDraft) === '{"wall":3,"roof":1,"door":4,"deco":34,"form":0}' && terrain.buildings.find((b) => b.room === 1).ext.wall === 0));
  const preview = await page.$eval('#ext-preview', (c) => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - 0x9c) < 6 && Math.abs(data[i + 1] - 0xc7) < 6 && Math.abs(data[i + 2] - 0xe8) < 6) blue++;
    return blue;
  });
  t.check('the preview shows the picked wall color', preview > 500, preview);
  await page.screenshot({ path: shot('exterior_pane.png') });
  await page.click('#ext-apply');
  await page.waitForFunction(() => terrain.buildings.find((b) => b.room === 1).ext.wall === 3, null, { timeout: 2000 });
  t.check('applying changes the house in the village', await page.evaluate(() => JSON.stringify(terrain.buildings.find((b) => b.room === 1).ext) === '{"wall":3,"roof":1,"door":4,"deco":34,"form":0}') && await page.isDisabled('#ext-apply'));
  await page.click('#ext-walls button:nth-child(1)');
  await page.click('#ext-reset');
  t.check('reset returns to the current look', await page.evaluate(() => extDraft.wall === 3));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { me.y = 1330; });
  await wait(400);
  await page.screenshot({ path: shot('exterior_house.png') });

  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => zone === 1, null, { timeout: 3000 });
  t.check('the door inside matches', await page.evaluate(() => terrain.zones[1].ext?.door === 4));
  await page.evaluate(() => setFurnShop(true, true));
  t.check('the tab works from inside the house too', (await page.textContent('#ext-name')) === '몰쟈의 집');
  await page.keyboard.press('Escape');
  await wait(200);
  await page.screenshot({ path: shot('exterior_inside.png') });
  t.check('no page errors while decorating outside', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t)]);
}
