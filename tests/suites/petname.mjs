// 펫 이름 짓기: 내 펫에게만 이름을 지어 줄 수 있고, 데리고 다니거나 풀어놓은 펫의 이름이 모두에게 보이며, 다시 접속해도 남는다.
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const HEYEON = 9;
const CHEESE = 0, RAGDOLL = 8;
const inv = (bot) => bot.lastEvent('inv') || {};
const otherPet = (bot, id) => bot.others?.find((p) => p.id === id);

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    a: [HEYEON, 320, 380, { pets: 1 << CHEESE }],
    b: [HEYEON, 360, 380, {}],
  });
  let a = await Bot.enter(server, 'a', { id: ids.a });
  const b = await Bot.enter(server, 'b', { id: ids.b });
  await wait(100);

  a.send(`petname ${CHEESE} 나비`);
  await a.until(() => inv(a).pn?.[CHEESE] === '나비', 1500);
  t.check('naming my pet updates my inventory', inv(a).pn?.[CHEESE] === '나비', JSON.stringify(inv(a).pn));

  a.send(`petname ${RAGDOLL} 남의펫`);
  await wait(250);
  t.check('a pet I do not own cannot be named', !inv(a).pn?.[RAGDOLL], JSON.stringify(inv(a).pn));

  a.send(`walkpet ${CHEESE}`);
  await b.until(() => otherPet(b, a.id)?.pn === '나비', 1500);
  t.check('others see the name of the pet I walk', otherPet(b, a.id)?.pn === '나비', JSON.stringify(otherPet(b, a.id)));

  await wait(300);
  a.send(`petname ${CHEESE} "꼬\\리"가아주아주긴이름`);
  await a.until(() => inv(a).pn?.[CHEESE] !== '나비', 1500);
  const long = inv(a).pn?.[CHEESE] || '';
  t.check('names keep quotes safely and stop at 8 characters', [...long].length === 8 && long.startsWith('"꼬\\리"'), long);

  await wait(300);
  a.send(`petname ${CHEESE} 치즈냥`);
  await wait(300);
  a.send(`releasepet ${CHEESE}`);
  await b.until(() => (b.cats || []).some((c) => c[2] === CHEESE && c[5] === '치즈냥'), 2000);
  t.check('a released pet carries its name to everyone in the house', (b.cats || []).some((c) => c[2] === CHEESE && c[5] === '치즈냥'), JSON.stringify(b.cats));

  await wait(300);
  a.send(`petname ${CHEESE} 노랑이`);
  await b.until(() => (b.cats || []).some((c) => c[2] === CHEESE && c[5] === '노랑이'), 2000);
  t.check('renaming a released pet shows at once', (b.cats || []).some((c) => c[2] === CHEESE && c[5] === '노랑이'), JSON.stringify(b.cats));

  // 다시 접속해도 이름이 남는다
  a.close();
  await wait(400);
  a = await Bot.enter(server, 'a', { id: ids.a });
  const kept = (a.welcome?.pn || [])[CHEESE];
  t.check('the name is remembered after logging in again', kept === '노랑이', JSON.stringify(kept));

  await wait(300);
  a.send(`petname ${CHEESE}`);
  await a.until(() => inv(a).pn?.[CHEESE] === '', 1500);
  await b.until(() => (b.cats || []).some((c) => c[2] === CHEESE && c.length < 6), 2000);
  t.check('clearing the name goes back to the kind name', inv(a).pn?.[CHEESE] === '' && (b.cats || []).some((c) => c[2] === CHEESE && c.length < 6), JSON.stringify(b.cats));
  a.close();
  b.close();
  await server.stop();
}

async function screen(t) {
  const { server, ids } = await serverWithAccounts({ g: [HEYEON, 320, 380, { pets: 1 << RAGDOLL }] });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.g, { name: 'g', viewport: { width: 1000, height: 720 } });
  await page.evaluate((k) => ws.send(`walkpet ${k}`), RAGDOLL);
  await page.waitForFunction(() => petFollowers.size === 1, null, { timeout: 3000 });
  await page.keyboard.press('KeyI');
  await page.click('#bag-tab-pets');
  t.check('the name box starts empty with the kind name as a hint', await page.$eval('#pet-name', (el) => el.value === '' && el.placeholder.includes('랙돌') && !el.disabled));
  await page.click('#pet-name');
  await page.keyboard.type('wasd구름');
  t.check('typing in the name box does not move me', await page.$eval('#pet-name', (el) => el.value === 'wasd구름'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => myPetNames[8] === 'wasd구름', null, { timeout: 2000 }).catch(() => {});
  const shown = await page.evaluate(() => ({ list: document.querySelector('#bag-pet-list [data-pet="8"] span')?.textContent, follower: [...petFollowers.values()][0].name }));
  t.check('the new name shows in the bag and on the walking pet', shown.list === 'wasd구름' && shown.follower === 'wasd구름', JSON.stringify(shown));
  await page.screenshot({ path: path.join(SHOTS, 'pet_name.png') });
  t.check('no script errors around pet names', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), screen(t)]);
}
