// 채팅의 입력 정리와 도배 방지, 채팅창 화면
import path from 'node:path';
import { Bot, enterGame, enterPage, launchBrowser, loginPage, SHOTS, startServer, uniqueId, wait } from '../lib.mjs';

const lineCount = (page) => page.$$eval('#chat-log > div', (els) => els.length);
const logHeight = (page) => page.$eval('#chat-log', (el) => el.getBoundingClientRect().height);
// 접고 펼치는 애니메이션은 화면 갱신이 느리면 늦게 끝나므로 고정 시간 대신 끝날 때까지 기다린다.
const settled = (page, height) => page.waitForFunction((h) => document.getElementById('chat-log').getBoundingClientRect().height === h, height, { timeout: 3000 }).then(() => true, () => false);
const unread = (page) => page.$eval('#chat-unread', (el) => (el.hidden ? '' : el.textContent));
const atBottom = (page) => page.$eval('#chat-log', (el) => el.scrollHeight - el.scrollTop - el.clientHeight < 2);

// 스크롤바는 DOM 으로 색을 읽을 수 없어(getComputedStyle 은 늘 기본값) 실제 스크린샷의 픽셀로 검사한다.
// 스크롤바 영역을 바로 왼쪽 열과 줄마다 비교해, 뒤에 비치는 게임 화면의 색과 막대를 구분한다.
async function scrollbarPixels(page) {
  const box = await page.$eval('#chat-log', (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.right - 20), y: Math.round(r.top), width: 20, height: Math.round(r.height) };
  });
  const png = await page.screenshot({ clip: box });
  return page.evaluate(async (base64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, img.width, img.height);
    const luma = (x, y) => {
      const i = (y * img.width + x) * 4;
      return (data[i] + data[i + 1] + data[i + 2]) / 3;
    };
    const barX = img.width - 5;  // 8px 영역 안에서 막대가 그려지는 곳
    const beside = img.width - 14;
    let brightest = 0, thumbRows = 0;
    for (let y = 0; y < img.height; y++) {
      // 위 10줄은 채팅창의 둥근 모서리 바깥이라 뒤의 게임 화면(눈, 가로등 불빛)이 비친다
      if (y >= 10) for (let x = img.width - 8; x < img.width; x++) brightest = Math.max(brightest, luma(x, y));
      if (luma(barX, y) - luma(beside, y) > 20) thumbRows++;
    }
    return { rows: img.height, brightest: Math.round(brightest), thumbRows };
  }, png.toString('base64'));
}

async function chatWindow(t) {
  const server = await startServer();
  const browser = await launchBrowser({ realScrollbars: true });
  const id = uniqueId('chatui');
  const page = await enterGame(browser, server, id, { name: '채팅창' });
  const other = await Bot.enter(server, '말동무');
  await wait(150);

  // ---- 스크롤바: 기본 흰색 막대 대신 얇고 은은한 막대
  await page.evaluate(() => { for (let i = 0; i < 40; i++) addChatLine(`긴 대화 ${i}번째 줄입니다`, '테스트', '#4fa3e0'); });
  await wait(50);
  t.check('log scrolls when it is full', await page.$eval('#chat-log', (el) => el.scrollHeight > el.clientHeight + 100));
  t.check('new lines keep the log at the bottom', await atBottom(page));
  const gutter = await page.$eval('#chat-log', (el) => el.offsetWidth - el.clientWidth);
  t.check('scrollbar is a thin custom bar', gutter === 8, gutter);
  const bar = await scrollbarPixels(page);
  t.check('scrollbar has nothing white', bar.brightest < 200, JSON.stringify(bar));
  t.check('scrollbar thumb is visible', bar.thumbRows >= 20 && bar.thumbRows < bar.rows - 20, JSON.stringify(bar));
  await page.screenshot({ path: path.join(SHOTS, 'chat_open.png'), clip: { x: 0, y: 440, width: 460, height: 280 } });

  // ---- 접기
  const open = await logHeight(page);
  t.check('log starts expanded', open > 100, open);
  await page.click('#chat-toggle');
  t.check('toggle collapses the log', await settled(page, 0), await logHeight(page));
  t.check('input stays visible when collapsed', await page.isVisible('#chat-input'));
  t.check('button reports the collapsed state', (await page.getAttribute('#chat-toggle', 'aria-expanded')) === 'false' && (await page.getAttribute('#chat-toggle', 'aria-label')) === '채팅창 펼치기');
  t.check('keyboard stays with the game after the click', await page.evaluate(() => document.activeElement === document.body));
  await page.screenshot({ path: path.join(SHOTS, 'chat_collapsed.png'), clip: { x: 0, y: 440, width: 460, height: 280 } });

  // 접어 둔 동안
  await page.keyboard.press('Enter');
  await page.keyboard.type('접어도 보내짐');
  await page.keyboard.press('Enter');
  await other.until(() => other.events.some((e) => e.t === 'chat' && e.m === '접어도 보내짐'), 1000);
  t.check('Enter still sends while collapsed', other.events.some((e) => e.t === 'chat' && e.m === '접어도 보내짐'));
  await wait(100);
  t.check('my own message is not unread', (await unread(page)) === '', await unread(page));
  other.send('chat 안 읽은 말 1');
  other.send('chat 안 읽은 말 2');
  await wait(200);
  t.check('messages from others are counted', (await unread(page)) === '2', await unread(page));
  await page.evaluate(() => addChatLine('시스템 안내'));
  t.check('system lines are not counted', (await unread(page)) === '2', await unread(page));
  await page.evaluate(() => setUnread(120));
  t.check('badge stays short', (await unread(page)) === '99+', await unread(page));
  await page.evaluate(() => setUnread(2));
  await page.screenshot({ path: path.join(SHOTS, 'chat_unread.png'), clip: { x: 0, y: 640, width: 460, height: 80 } });

  // ---- 펼치기
  await page.click('#chat-toggle');
  t.check('toggle expands the log', await settled(page, open), await logHeight(page));
  t.check('expanding clears the badge', (await unread(page)) === '');
  t.check('expanding shows the newest line', await atBottom(page));

  // 위로 올려 읽는 중에는 끌어내리지 않는다
  await page.$eval('#chat-log', (el) => { el.scrollTop = 0; });
  other.send('chat 읽는 중 도착');
  await wait(200);
  t.check('reading older lines is not interrupted', await page.$eval('#chat-log', (el) => el.scrollTop === 0));
  t.check('expanded chat has no unread badge', (await unread(page)) === '');

  // ---- 다음 접속에도 접은 상태 유지
  await page.$eval('#chat-log', (el) => { el.scrollTop = el.scrollHeight; });
  await page.click('#chat-toggle');
  await wait(250);
  await page.reload();
  await loginPage(page, id);
  await enterPage(page, {});
  await wait(300);
  t.check('collapsed state is remembered', (await logHeight(page)) === 0 && (await page.getAttribute('#chat-toggle', 'aria-expanded')) === 'false');
  await page.click('#chat-toggle');
  await wait(300);
  t.check('history-free log expands normally', (await logHeight(page)) > 0, await logHeight(page));
  await page.reload();
  await loginPage(page, id);
  await enterPage(page, {});
  await wait(200);
  t.check('expanded state is remembered too', (await page.getAttribute('#chat-toggle', 'aria-expanded')) === 'true');

  // localStorage 를 막아 둔 브라우저에서도 동작한다
  const context = await browser.newContext({ viewport: { width: 900, height: 600 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const blocked = await context.newPage();
  blocked.problems = [];
  blocked.on('pageerror', (e) => blocked.problems.push(e.message));
  await blocked.goto(server.url);
  await loginPage(blocked, uniqueId('blocked'));
  await enterPage(blocked, { name: '막힘' });
  await blocked.click('#chat-toggle');
  await wait(250);
  t.check('collapse works without storage', (await blocked.getAttribute('#chat-toggle', 'aria-expanded')) === 'false' && blocked.problems.length === 0, blocked.problems.join(' | '));

  t.check('no page errors', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  other.close();
  await server.stop();
}

export default async function run(t) {
  const server = await startServer();
  const a = await Bot.enter(server, '말하는이');
  const b = await Bot.enter(server, '듣는이');
  await wait(100);

  const chats = (bot) => bot.events.filter((e) => e.t === 'chat');
  a.send('chat 안녕 "따옴표" \\ <img src=x onerror=alert(1)> 😀');
  await wait(150);
  t.check('message reaches others unchanged', chats(b).at(-1)?.m === '안녕 "따옴표" \\ <img src=x onerror=alert(1)> 😀', JSON.stringify(chats(b).at(-1)));
  t.check('sender gets the echo', chats(a).at(-1)?.id === a.id);

  a.send('chat    ');
  await wait(100);
  t.check('blank message ignored', chats(b).length === 1);

  a.ws.send(new Uint8Array([...new TextEncoder().encode('chat bad'), 0xff, 0xc0, 0x80, 0x0a, 0x09, 0x22, ...new TextEncoder().encode('end')]));
  await wait(150);
  t.check('invalid UTF-8 and control chars removed', chats(b).at(-1)?.m === 'bad"end', JSON.stringify(chats(b).at(-1)));

  await wait(1100);
  a.send('chat ' + '가'.repeat(500));
  await wait(150);
  t.check('long message capped at 200 chars', Array.from(chats(b).at(-1).m).length === 200);

  await wait(3200);
  const before = chats(b).length;
  for (let i = 0; i < 12; i++) a.send('chat spam' + i);
  await wait(200);
  const delivered = chats(b).length - before;
  const warned = a.events.filter((e) => e.t === 'sys' && e.m.includes('너무 빠르게')).length;
  t.check('rate limit applies', delivered <= 5 && warned >= 7, `delivered=${delivered} warned=${warned}`);
  t.check('receiver stays connected', !b.closed);

  b.close();
  await wait(200);
  t.check('leave notice', a.events.some((e) => e.t === 'sys' && e.m.includes('듣는이님이 퇴장')));
  a.close();
  await server.stop();

  await chatWindow(t);
}
