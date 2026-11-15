// 캐릭터 몸 색: RGB 선택과 예전 계정의 색 변환
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, SHOTS, startServer, uniqueId, wait } from '../lib.mjs';

async function protocol(t) {
  const server = await startServer();
  const a = await Bot.enter(server, '색칠', { hue: '#12abef' });
  const b = await Bot.enter(server, '구경');
  await wait(120);
  t.check('hex color reaches everyone', b.others.find((p) => p.id === a.id)?.c === '#12abef', JSON.stringify(b.others));
  a.send('chat 안녕');
  await b.until(() => b.events.some((e) => e.t === 'chat'), 1000);
  t.check('chat carries the color', b.events.find((e) => e.t === 'chat')?.c === '#12abef');

  // 잘못된 색으로는 입장할 수 없다
  for (const bad of ['#12345', '#1234567', '#gggggg', 'red', '#12 456']) {
    const bot = await Bot.connect(server);
    await bot.login(uniqueId('bad'));
    bot.send(`join ${bad} 1 1 0 x`);
    await wait(100);
    t.check(`color "${bad}" is refused`, !bot.welcome, JSON.stringify(bot.welcome));
    bot.close();
  }

  // 아직 캐시된 예전 화면이 보내는 hue 숫자도 받는다
  const legacy = await Bot.enter(server, '예전화면', { hue: 120 });
  t.check('old clients still join with the same color', legacy.me?.c === '#49df49', JSON.stringify(legacy.me));

  // 이 변경 전에 저장된 계정
  const id = uniqueId('oldfile');
  const old = await Bot.enter(server, '옛계정', { id, hue: '#000000' });
  old.close();
  for (const bot of [a, b, legacy]) bot.close();
  await wait(150);
  await server.stop();
  const file = path.join(server.dataDir, `${Buffer.from(id).toString('hex')}.acc`);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^rgb=.*$/m, 'hue=120'));
  const restarted = await startServer({ dataDir: server.dataDir });
  const back = await Bot.connect(restarted);
  const auth = await back.login(id);
  t.check('accounts saved with hue keep their color', auth.h === '#49df49', JSON.stringify(auth));
  await back.join({ hue: auth.h, nick: '옛계정' });
  back.close();
  await wait(150);
  await restarted.stop();
  t.check('account file now stores rgb', /^rgb=4841289$/m.test(readFileSync(file, 'utf8')), readFileSync(file, 'utf8').match(/^(rgb|hue)=.*$/m)?.[0]);
}

async function ui(t) {
  const server = await startServer();
  const browser = await launchBrowser();
  const id = uniqueId('color');
  const page = await openPage(browser, server);
  await loginPage(page, id);

  const slider = (key, value) => page.$eval(`#char-${key}`, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const previewColor = () => page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bodyY = charPreview.height * 0.68 - 3 * bodyLift({ legs: look.legs, seat: 0 });
      const d = previewCtx.getImageData(charPreview.width / 2, bodyY + 3 * 9, 1, 1).data;
      resolve([d[0], d[1], d[2]]);
    }));
  }));

  t.check('new character starts with a color', /^#[0-9a-f]{6}$/.test(await page.inputValue('#char-color')), await page.inputValue('#char-color'));
  t.check('sliders show the picked color', await page.evaluate(() => charChannels.every((c, i) => Number(c.slider.value) === parseInt(look.color.slice(1 + i * 2, 3 + i * 2), 16) && c.value.textContent === c.slider.value)));

  for (const [key, value] of [['r', 255], ['g', 0], ['b', 128]]) await slider(key, value);
  t.check('sliders make any RGB color', (await page.inputValue('#char-color')) === '#ff0080', await page.inputValue('#char-color'));
  t.check('slider numbers follow', (await page.textContent('#char-g-value')) === '0' && (await page.textContent('#char-b-value')) === '128');
  t.check('preview shows the exact color', (await previewColor()).join() === '255,0,128', (await previewColor()).join());
  await page.screenshot({ path: path.join(SHOTS, 'color_select.png') });

  await page.$eval('#char-color', (el) => {
    el.value = '#00ffcc';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  t.check('color picker moves the sliders', (await page.inputValue('#char-r')) === '0' && (await page.inputValue('#char-g')) === '255' && (await page.inputValue('#char-b')) === '204');
  t.check('preview follows the picker', (await previewColor()).join() === '0,255,204', (await previewColor()).join());

  // 흰색과 검정도 고를 수 있고, 어두운 이름도 채팅에서 읽힌다
  for (const key of ['r', 'g', 'b']) await slider(key, 0);
  await enterPage(page, { name: '까망' });
  t.check('even black reaches the world', await page.evaluate(() => entities.get(myId).color === '#000000'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('안녕');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chat-log b'), null, { timeout: 2000 });
  const shade = await page.$eval('#chat-log b', (el) => getComputedStyle(el).color.match(/\d+/g).map(Number));
  t.check('dark names stay readable in chat', 0.299 * shade[0] + 0.587 * shade[1] + 0.114 * shade[2] >= 140, shade.join());

  // 다시 접속해도 같은 색 (로그아웃해서 접속 화면으로)
  await page.evaluate(() => { closeMessage = ''; clearResume(); ws.close(); });
  await page.waitForSelector('#auth:not([hidden])');
  await loginPage(page, id);
  t.check('color comes back on login', (await page.inputValue('#char-color')) === '#000000');

  const narrow = await openPage(browser, server, { viewport: { width: 360, height: 640 } });
  await loginPage(narrow, uniqueId('color'));
  t.check('color controls fit a phone', await narrow.evaluate(() => {
    const r = document.getElementById('char-b').getBoundingClientRect();
    return r.right <= innerWidth && r.width > 80;
  }));

  t.check('no page errors', page.problems.length === 0, page.problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
