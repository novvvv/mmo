// I 키로 여는 아이템창과 물고기 설명
import path from 'node:path';
import { enterGame, launchBrowser, openPage, pageSelf, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const KYAKYA = 3;
const isOpen = (page) => page.isVisible('#bag');
// 개수가 있는 칸만 (TV 리모컨과 체스 설명서 같은 도구는 빼고)
const filled = (page) => page.$$eval('.bag-slot.filled', (els) => els.filter((e) => e.querySelector('b')).map((e) => [Number(e.dataset.kind), Number(e.querySelector('b').textContent)]));

export default async function run(t) {
  const { server, ids } = await serverWithAccounts({
    rich: [0, 820, 620, { c0: 3, c1: 1, c2: 2 }],
    some: [0, 920, 620, { c0: 0, c1: 4, c2: 0 }],
    empty: [0, 720, 620],
    pianist: [KYAKYA, 590, 140, { c0: 1 }],
  });
  const browser = await launchBrowser();

  // 로그인 입력 중에는 열리지 않는다
  const login = await openPage(browser, server);
  await login.press('#auth-id', 'KeyI');
  t.check('I types into the login form', (await login.inputValue('#auth-id')) === 'i' && !(await isOpen(login)));
  await login.close();

  const page = await enterGame(browser, server, ids.rich, { name: 'rich' });
  await wait(150);

  // ---- 평소에는 물고기 목록이 없다
  t.check('fish list is gone from the screen', !(await isOpen(page)));
  t.check('fish counts are not shown elsewhere', !(await page.textContent('#hud')).includes('붕어'));

  // ---- 여닫기
  await page.keyboard.press('KeyI');
  t.check('I opens the item window', await isOpen(page));
  await page.screenshot({ path: path.join(SHOTS, 'inventory.png') });
  await page.keyboard.press('KeyI');
  t.check('I closes it again', !(await isOpen(page)));
  await page.keyboard.press('KeyI');
  await page.keyboard.press('Escape');
  t.check('Esc closes it', !(await isOpen(page)));
  await page.keyboard.press('KeyI');
  await page.click('#bag-close');
  t.check('the X button closes it', !(await isOpen(page)));
  await page.keyboard.press('KeyI');

  // ---- 칸
  t.check('window has item slots', (await page.$$('.bag-slot')).length === 48);
  t.check('fish fill the slots with counts', JSON.stringify(await filled(page)) === '[[1,3],[2,1],[3,2]]', JSON.stringify(await filled(page)));
  t.check('rare fish slot stands out', await page.$eval('.bag-slot[data-kind="3"]', (e) => e.classList.contains('rare')));
  t.check('board control lives in the window', await page.isVisible('#board-on') && await page.isVisible('#board-text'));

  // ---- 마우스를 올리면 설명
  t.check('no tooltip before hovering', !(await page.isVisible('#item-tip')));
  const expected = [['붕어', '일반', '흔하게'], ['메기', '고급', '수염'], ['황금잉어', '희귀', '금빛']];
  for (const [kind, [name, grade, word]] of expected.entries()) {
    await page.hover(`.bag-slot[data-kind="${kind + 1}"]`);
    const text = await page.textContent('#item-tip');
    t.check(`${name} tooltip explains the fish`, await page.isVisible('#item-tip') && text.includes(name) && text.includes(grade) && text.includes(word), text);
  }
  t.check('tooltip shows how many you have', (await page.textContent('#item-tip')).includes('보유 2마리'), await page.textContent('#item-tip'));
  await page.screenshot({ path: path.join(SHOTS, 'inventory_tooltip.png') });
  const tip = await page.evaluate(() => {
    const r = document.getElementById('item-tip').getBoundingClientRect();
    const b = document.getElementById('bag').getBoundingClientRect();
    return { apart: r.right <= b.left, inside: r.left >= 0 && r.top >= 0 && r.bottom <= innerHeight };
  });
  t.check('tooltip sits beside the window on screen', tip.apart && tip.inside, JSON.stringify(tip));
  await page.hover('.bag-slot:last-child');
  t.check('empty slots have no tooltip', !(await page.isVisible('#item-tip')));
  await page.hover('.bag-slot[data-kind="1"]');
  await page.mouse.move(300, 300);
  t.check('tooltip goes away with the mouse', !(await page.isVisible('#item-tip')));

  // 창을 닫으면 설명도 사라진다
  await page.hover('.bag-slot[data-kind="1"]');
  await page.keyboard.press('KeyI');
  t.check('closing hides the tooltip', !(await page.isVisible('#item-tip')));
  await page.keyboard.press('KeyI');

  // ---- 수량이 바뀌면 칸도 바뀐다
  await page.evaluate(() => setBag([3, 0, 2]));
  t.check('used-up fish leaves its slot', JSON.stringify(await filled(page)) === '[[1,3],[3,2]]', JSON.stringify(await filled(page)));
  await page.evaluate(() => setBag([3, 1, 2]));

  // ---- 드래그 앤 드롭
  const slotIndex = (kind) => page.$$eval('.bag-slot', (els, k) => els.findIndex((e) => e.dataset.kind === String(k)), kind);
  const dragTo = async (kind, target, hold) => {
    const from = await page.locator(`.bag-slot[data-kind="${kind}"]`).boundingBox();
    const to = await page.locator('.bag-slot').nth(target).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
    if (hold) await hold();
    await page.mouse.up();
    await wait(40);
  };
  t.check('the remote starts in the first slot', (await slotIndex(0)) === 0, await slotIndex(0));
  await dragTo(1, 7, async () => {
    t.check('a dragged item follows the mouse', await page.isVisible('#bag-ghost'));
    t.check('no tooltip while dragging', !(await page.isVisible('#item-tip')));
  });
  t.check('dragging moves an item to an empty slot', (await slotIndex(1)) === 7, await slotIndex(1));
  t.check('the ghost is gone after dropping', (await page.$('#bag-ghost')) === null);
  const beforeSwap = [await slotIndex(1), await slotIndex(3)];
  await dragTo(3, beforeSwap[0]);
  t.check('dropping on an item swaps them', (await slotIndex(3)) === beforeSwap[0] && (await slotIndex(1)) === beforeSwap[1], `${await slotIndex(3)},${await slotIndex(1)}`);
  const moved = await slotIndex(3);
  const box = await page.locator('.bag-slot[data-kind="3"]').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(300, 300, { steps: 4 });
  await page.mouse.up();
  t.check('dropping outside changes nothing', (await slotIndex(3)) === moved, await slotIndex(3));
  await page.evaluate(() => setBag([3, 2, 2]));
  t.check('positions survive a count change', (await slotIndex(3)) === moved && (await slotIndex(1)) === beforeSwap[1]);
  await page.evaluate(() => setBag([3, 1, 2]));
  await page.keyboard.press('KeyI');
  await page.keyboard.press('KeyI');

  // ---- 리모컨: 집 밖에서는 쓸 수 없다고 알려 준다
  await page.hover('.bag-slot[data-kind="0"]');
  t.check('the remote has a description', (await page.textContent('#item-tip')).includes('TV 리모컨'), await page.textContent('#item-tip'));
  await page.click('.bag-slot[data-kind="0"]');
  t.check('the remote needs a house', (await page.textContent('#chat-log')).includes('TV가 있는 집') && !(await page.isVisible('#tv')));

  // ---- 글자 입력 중의 I 는 글자다
  await page.keyboard.press('KeyI');
  await page.keyboard.press('Enter');
  await page.keyboard.type('hi');
  t.check('I in chat is just a letter', (await page.inputValue('#chat-input')) === 'hi' && !(await isOpen(page)));
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyI');
  await page.fill('#board-text', 'pizza');
  await page.press('#board-text', 'KeyI');
  t.check('I in the board box is just a letter', (await page.inputValue('#board-text')).endsWith('i') && await isOpen(page));
  await page.keyboard.press('Escape');

  // ---- 창이 열려도 걸어 다닐 수 있다
  const before = await pageSelf(page);
  await page.keyboard.down('KeyD');
  await wait(250);
  await page.keyboard.up('KeyD');
  await wait(100);
  t.check('can walk with the window open', (await pageSelf(page)).x > before.x + 15 && await isOpen(page));

  // ---- 없는 물고기는 칸을 차지하지 않고, 빈 가방도 정상
  const some = await enterGame(browser, server, ids.some, { name: 'some' });
  await some.keyboard.press('KeyI');
  t.check('only owned fish appear', JSON.stringify(await filled(some)) === '[[2,4]]', JSON.stringify(await filled(some)));
  await some.close();
  const empty = await enterGame(browser, server, ids.empty, { name: 'empty' });
  await empty.keyboard.press('KeyI');
  t.check('an empty bag shows empty slots', (await filled(empty)).length === 0 && (await empty.$$('.bag-slot')).length === 48);

  // ---- 피아노 앞에서: I 는 건반이 아니고, Esc 는 창부터 닫는다
  const pianist = await enterGame(browser, server, ids.pianist, { name: 'pianist' });
  await wait(150);
  await pianist.keyboard.press('KeyE');
  await pianist.waitForSelector('#piano:not([hidden])', { timeout: 2000 });
  await pianist.keyboard.press('KeyI');
  t.check('I opens the window at the piano', await isOpen(pianist));
  await pianist.keyboard.press('Escape');
  await wait(150);
  t.check('Esc closes the window before standing up', !(await isOpen(pianist)) && (await pageSelf(pianist)).seat > 0);

  // ---- 좁은 화면과 재접속
  const phone = await enterGame(browser, server, ids.empty, { name: 'empty', viewport: { width: 390, height: 720 } });
  await phone.keyboard.press('KeyI');
  const fits = await phone.evaluate(() => {
    const g = document.getElementById('bag').getBoundingClientRect();
    const h = document.getElementById('hud').getBoundingClientRect();
    return g.left >= 0 && g.right <= innerWidth && g.top >= h.bottom;
  });
  t.check('window fits a phone', fits);
  await page.evaluate(() => { closeMessage = ''; clearResume(); ws.close(); });   // 로그아웃 (그냥 끊기면 화면을 두고 다시 잇는다)
  await page.waitForSelector('#auth:not([hidden])');
  t.check('window closes on logout', !(await isOpen(page)));
  t.check('item layout is remembered', await page.evaluate((id) => JSON.parse(localStorage.getItem(`mmo.bag.${id}`))[1] !== undefined, ids.rich));

  const problems = [...page.problems, ...phone.problems, ...pianist.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}
