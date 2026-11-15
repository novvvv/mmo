// 도트 데모 페이지(pixel.html): 캐릭터 만들기, 이동, 충돌. 로그인 화면의 선택지에서는 빠졌고 주소로만 연다
import path from 'node:path';
import { launchBrowser, openPage, SHOTS, startServer, uniqueId, wait } from '../lib.mjs';

const shot = (name) => path.join(SHOTS, name);

async function loginAsPixel(page, id) {
  await page.evaluate((user) => sessionStorage.setItem('mmo.pixel.user', JSON.stringify({ id: user, nick: '' })), id);
  await page.goto(page.url().replace(/index\.html$|\/$/, '/demo/pixel.html'));
  await page.waitForURL('**/demo/pixel.html', { timeout: 5000 });
  await page.waitForSelector('#creator:not([hidden])', { timeout: 15000 });
}

const hold = async (page, code, ms) => {
  await page.keyboard.down(code);
  await wait(ms);
  await page.keyboard.up(code);
};
const position = (page) => page.evaluate(() => ({ x: player.x, y: player.y, dir: player.dir }));
const moveTo = (page, x, y) => page.evaluate(([px, py]) => { player.x = px; player.y = py; }, [x, y]);

export default async function run(t) {
  const server = await startServer();
  const chrome = await launchBrowser();
  const page = await openPage(chrome, server);
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());   // 글꼴은 없어도 된다
  t.check('normal login stays the default', await page.isChecked('input[name="auth-mode"][value="normal"]'));
  t.check('the login screen no longer offers the pixel demo', !(await page.$('input[name="auth-mode"][value="pixel"]')));

  const direct = await openPage(chrome, server);
  await direct.goto(`${server.url}/demo/pixel.html`);
  await direct.waitForURL('**/index.html', { timeout: 3000 });
  t.check('the demo needs a login first', direct.url().endsWith('/index.html'), direct.url());

  const id = uniqueId('pix');
  await loginAsPixel(page, id);
  t.check('the demo page opens by its address', page.url().endsWith('/demo/pixel.html'), page.url());
  t.check('the account name is suggested', (await page.inputValue('#name')) === id.slice(0, 12), await page.inputValue('#name'));
  await page.click('[data-key="style"][data-value="long"]');
  await page.click('[data-key="hat"][data-value="beret"]');
  await page.click(`[data-key="cloth"][data-value="#3f7a4d"]`);
  t.check('options change the character', await page.evaluate(() => look.style === 'long' && look.hat === 'beret' && look.cloth === '#3f7a4d'));
  await page.fill('#name', '도트이름');
  await wait(200);
  await page.screenshot({ path: shot('pixel_creator.png') });
  await page.click('#start');
  await page.waitForSelector('#creator', { state: 'hidden', timeout: 2000 });
  t.check('the name floats over the character', (await page.textContent('#tag')) === '도트이름' && await page.isVisible('#tag'));
  t.check('the spawn point is walkable', await page.evaluate(() => feetFit(player.x, player.y)));

  const before = await position(page);
  await hold(page, 'KeyA', 350);
  const left = await position(page);
  t.check('walking moves the character', left.x < before.x - 10 && left.dir === 3, JSON.stringify(left));

  // 개울에는 들어갈 수 없다
  await moveTo(page, 660, 125);
  await hold(page, 'KeyS', 900);
  const bank = await position(page);
  t.check('the river stops the character', await page.evaluate(({ x, y }) => y < riverY(x) - riverHalf(x) && feetFit(x, y), bank), JSON.stringify(bank));

  // 다리는 끝에서 끝까지 걸을 수 있고, 난간은 넘을 수 없다
  const deck = await page.evaluate(() => {
    let blocked = 0;
    for (let t = 0; t <= 1; t += 0.01) if (!feetFit(bridgeX(t, 0.5), bridgeY(t, 0.5))) blocked++;
    return blocked;
  });
  t.check('the bridge is open from end to end', deck === 0, deck);
  await page.evaluate(() => { player.x = bridgeX(0.5, 0.5); player.y = bridgeY(0.5, 0.5); });
  await wait(150);
  t.check('the front railing covers feet on the bridge', await page.evaluate(() => behindParapet()));
  await hold(page, 'KeyS', 1100);
  t.check('the railing keeps the character on the bridge', await page.evaluate(() => {
    const t = (player.x - BRIDGE.x) / BRIDGE.dx;
    return player.y < bridgeY(t, 0);
  }), JSON.stringify(await position(page)));
  await page.screenshot({ path: shot('pixel_bridge.png') });
  await page.evaluate(() => { player.x = bridgeX(0.04, 0.5); player.y = bridgeY(0.04, 0.5); });
  await hold(page, 'KeyD', 2300);
  const crossed = await position(page);
  t.check('a character can walk across', crossed.x > 470, JSON.stringify(crossed));

  t.check('tree trunks are solid', await page.evaluate(() => { const tree = props.find((p) => p.art.h > 100); return !walkable(tree.x, tree.y); }));
  await page.reload();
  await page.waitForSelector('#creator:not([hidden])', { timeout: 15000 });
  t.check('the character is remembered', await page.evaluate(() => look.style === 'long' && nameInput.value === '도트이름'));
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}
