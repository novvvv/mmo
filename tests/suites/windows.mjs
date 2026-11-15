// 창 옮기기: 아이템창은 이동만, TV 창은 이동과 크기 조절
import { enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, stubYouTube, wait } from '../lib.mjs';

const MOLJA = 1;
const rect = (page, selector) => page.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

async function drag(page, selector, dx, dy) {
  const box = await rect(page, selector);
  const fromX = box.x + Math.min(box.w / 2, 40), fromY = box.y + box.h / 2;
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(fromX + dx / 2, fromY + dy / 2, { steps: 3 });
  await page.mouse.move(fromX + dx, fromY + dy, { steps: 3 });
  await page.mouse.up();
  await wait(60);
}

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({ host: [MOLJA, 340, 90, { c0: 1 }] });
  const browser = await launchBrowser();
  const page = await openPage(browser, server);
  await stubYouTube(page);
  await loginPage(page, ids.host);
  await enterPage(page, { name: 'host' });
  await wait(200);

  // ---- 아이템창은 이동만
  await page.keyboard.press('KeyI');
  const bag0 = await rect(page, '#bag');
  await drag(page, '#bag-head', -300, 120);
  const bag1 = await rect(page, '#bag');
  t.check('item window moves by its title bar', Math.abs(bag1.x - (bag0.x - 300)) < 2 && Math.abs(bag1.y - (bag0.y + 120)) < 2, JSON.stringify([bag0, bag1]));
  t.check('item window keeps its size', bag1.w === bag0.w && bag1.h === bag0.h, JSON.stringify([bag0, bag1]));
  t.check('item window has no resize handle', (await page.$('#bag [id$="resize"]')) === null && await page.$eval('#bag', (el) => getComputedStyle(el).resize === 'none'));

  await drag(page, '#bag-items', 200, 0);
  t.check('only the title bar drags', (await rect(page, '#bag')).x === bag1.x, JSON.stringify(await rect(page, '#bag')));

  // 설명 창이 옮긴 위치를 따라간다
  await page.hover('.bag-slot.filled');
  const tip = await rect(page, '#item-tip');
  t.check('tooltip follows the moved window', tip.x + tip.w <= bag1.x, JSON.stringify([tip, bag1]));

  // 화면 밖으로 나가지 않는다
  await drag(page, '#bag-head', -3000, -3000);
  const corner = await rect(page, '#bag');
  t.check('window stops at the screen edge', corner.x === 0 && corner.y === 0, JSON.stringify(corner));
  await drag(page, '#bag-head', 5000, 5000);
  const far = await rect(page, '#bag');
  t.check('title bar stays reachable', far.x + far.w <= 1100.5 && far.y <= 720 - 40 + 0.5, JSON.stringify(far));
  await drag(page, '#bag-head', -500, -400);
  const placed = await rect(page, '#bag');

  // 닫기 단추는 끌기로 잡히지 않고, 다시 열면 그 자리다
  await page.click('#bag-close');
  t.check('close button still closes', !(await page.isVisible('#bag')));
  await page.keyboard.press('KeyI');
  const reopened = await rect(page, '#bag');
  t.check('window reopens where it was left', Math.abs(reopened.x - placed.x) < 1 && Math.abs(reopened.y - placed.y) < 1, JSON.stringify([placed, reopened]));

  // 끌고 난 뒤에도 키보드는 게임으로 간다
  await page.keyboard.press('KeyI');
  t.check('keyboard works after dragging', !(await page.isVisible('#bag')));

  // ---- TV 창
  await page.keyboard.press('KeyT');
  await page.fill('#tv-url', 'dQw4w9WgXcQ');
  await page.press('#tv-url', 'Enter');
  await page.waitForFunction(() => tvPlayer && tvPlayerReady, null, { timeout: 3000 });
  const tv0 = await rect(page, '#tv');
  await drag(page, '#tv-head b', -180, 60);
  const tv1 = await rect(page, '#tv');
  t.check('TV window moves', Math.abs(tv1.x - (tv0.x - 180)) < 2 && Math.abs(tv1.y - (tv0.y + 60)) < 2 && tv1.w === tv0.w, JSON.stringify([tv0, tv1]));

  // 크기 조절: 영상 비율은 16:9 를 유지한다
  const grip = await rect(page, '#tv-resize');
  await page.mouse.move(grip.x + 10, grip.y + 10);
  await page.mouse.down();
  t.check('dragging does not lose the mouse to the video', await page.evaluate(() => {
    document.body.dispatchEvent(new Event('noop'));
    return document.body.classList.contains('dragging') && getComputedStyle(document.querySelector('#tv-video iframe')).pointerEvents === 'none';
  }));
  await page.mouse.move(grip.x + 130, grip.y + 90, { steps: 4 });
  await page.mouse.up();
  await wait(60);
  const bigger = await rect(page, '#tv');
  const screen = await rect(page, '#tv-screen');
  t.check('corner grip makes the TV bigger', bigger.w > tv1.w + 90, JSON.stringify([tv1, bigger]));
  t.check('top left stays in place while resizing', Math.abs(bigger.x - tv1.x) < 1 && Math.abs(bigger.y - tv1.y) < 1, JSON.stringify([tv1, bigger]));
  t.check('video keeps its shape', Math.abs(screen.w / screen.h - 16 / 9) < 0.02, JSON.stringify(screen));

  const grip2 = await rect(page, '#tv-resize');
  await page.mouse.move(grip2.x + 10, grip2.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip2.x - 2000, grip2.y, { steps: 4 });
  await page.mouse.up();
  await wait(60);
  const smallest = await rect(page, '#tv-screen');
  t.check('TV cannot shrink below the player minimum', smallest.h >= 200, JSON.stringify(smallest));

  const grip3 = await rect(page, '#tv-resize');
  await page.mouse.move(grip3.x + 10, grip3.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip3.x + 5000, grip3.y, { steps: 4 });
  await page.mouse.up();
  await wait(60);
  const largest = await rect(page, '#tv');
  t.check('TV cannot grow off the screen', largest.x + largest.w <= 1100.5 && largest.y + largest.h <= 720.5, JSON.stringify(largest));

  // 닫았다 열어도 크기와 위치가 그대로
  await page.click('#tv-close');
  await page.keyboard.press('KeyT');
  await page.waitForFunction(() => tvPlayer && tvPlayerReady, null, { timeout: 3000 });
  const again = await rect(page, '#tv');
  t.check('TV window reopens with the same size and place', Math.abs(again.w - largest.w) < 1 && Math.abs(again.x - largest.x) < 1, JSON.stringify([largest, again]));

  // 작은 창으로 줄이면 화면 안으로 들어온다
  await page.setViewportSize({ width: 700, height: 500 });
  await wait(100);
  const shrunk = await rect(page, '#tv');
  t.check('windows come back when the browser shrinks', shrunk.x + Math.min(shrunk.w, 700) <= 700.5 && shrunk.y <= 460.5, JSON.stringify(shrunk));

  t.check('no page errors', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}
