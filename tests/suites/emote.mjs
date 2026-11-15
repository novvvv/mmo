// 감정표현: /박수 /꿀맛 /행복 /엉엉 /기쁨
import path from 'node:path';
import { Bot, enterGame, launchBrowser, serverWithAccounts, SHOTS, wait } from '../lib.mjs';

const EMOTES = ['/박수', '/꿀맛', '/행복', '/엉엉', '/기쁨'];
const emotes = (bot) => bot.events.filter((e) => e.t === 'emote');
const chats = (bot) => bot.events.filter((e) => e.t === 'chat');

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    actor: [0, 820, 620], near: [0, 870, 620], indoors: [1, 250, 300],
  });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const actor = await enter('actor');
  const near = await enter('near');
  const indoors = await enter('indoors');

  for (const [index, text] of EMOTES.entries()) {
    const before = emotes(near).length;
    actor.send(`chat ${text}`);
    await near.until(() => emotes(near).length > before, 1000);
    const event = emotes(near).at(-1);
    t.check(`${text} reaches people nearby`, event?.e === index && event?.id === actor.id && event?.n === 'actor', JSON.stringify(event));
    await wait(1100);
  }
  t.check('sender sees their own emote', emotes(actor).length === EMOTES.length, emotes(actor).length);
  t.check('emotes are not sent as chat', chats(near).length === 0, JSON.stringify(chats(near)));
  t.check('other zones do not see emotes', emotes(indoors).length === 0);

  actor.send('chat /박수 짝짝짝');
  actor.send('chat /모르는말');
  await near.until(() => chats(near).length === 2, 1000);
  t.check('other slash text stays normal chat', chats(near).map((c) => c.m).join() === '/박수 짝짝짝,/모르는말', JSON.stringify(chats(near)));

  await wait(5200);
  const seen = emotes(near).length;
  for (let i = 0; i < 12; i++) actor.send('chat /기쁨');
  await wait(200);
  const delivered = emotes(near).length - seen;
  const warned = actor.events.filter((e) => e.t === 'sys' && e.m.includes('너무 빠르게')).length;
  t.check('emotes share the chat rate limit', delivered <= 6 && warned >= 6, `delivered=${delivered} warned=${warned}`);

  // ---- 상점의 감정표현: 구해야 쓸 수 있다
  await wait(5200);
  const inv = (bot) => bot.events.filter((e) => e.t === 'inv').at(-1);
  t.check('the map lists a price for every emote', actor.map.emotePrices?.length === 15, JSON.stringify(actor.map.emotePrices));
  let before = emotes(near).length;
  actor.send('chat /하트');
  await actor.until(() => actor.events.some((e) => e.t === 'sys' && e.m.includes('감정표현 탭')), 1000);
  await wait(100);
  t.check('a shop emote does nothing until you have it', emotes(near).length === before && chats(near).every((c) => c.m !== '/하트'));
  actor.send('buyemote 2');
  actor.send('buyemote 99');
  await wait(150);
  t.check('free emotes and unknown ones cannot be bought', !(inv(actor)?.em));
  await wait(1100);
  actor.send('buyemote 5');
  await actor.until(() => inv(actor)?.em === 32, 1000);
  t.check('buying adds it to what I own', inv(actor)?.em === 32, JSON.stringify(inv(actor)?.em));
  actor.send('chat /하트');
  await near.until(() => emotes(near).length > before, 1000);
  t.check('then it works like any emote', emotes(near).at(-1)?.e === 5 && emotes(near).at(-1)?.id === actor.id);
  await wait(1100);
  before = emotes(actor).length;
  near.send('chat /하트');
  await wait(200);
  t.check('someone else still has to get their own', emotes(actor).length === before);
  actor.send('buyemote 5');
  await actor.until(() => actor.events.some((e) => e.t === 'sys' && e.m.includes('이미 가지고')), 1000);
  t.check('it cannot be bought twice', inv(actor)?.em === 32);

  // 다시 접속해도 남아 있다
  actor.close();
  await wait(300);
  const again = await enter('actor');
  t.check('owned emotes are kept across logins', (again.welcome?.em ?? inv(again)?.em) === 32, JSON.stringify(again.welcome?.em));
  for (const bot of [again, near, indoors]) bot.close();
  await wait(100);
  await server.stop();
}

async function ui(t) {
  const { server, ids } = await serverWithAccounts({ actor: [0, 820, 620], friend: [0, 890, 620] });
  const browser = await launchBrowser();
  const page = await enterGame(browser, server, ids.actor, { name: 'actor', look: { arms: 1, legs: 1, limbColor: 0 } });
  const friend = await enterGame(browser, server, ids.friend, { name: 'friend', look: { arms: 0, legs: 0, limbColor: 0 } });
  await wait(250);
  const id = await page.evaluate(() => myId);

  // ---- 표정마다 그림이 다르다
  const faces = await page.evaluate(() => {
    const draw = (emote) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 120;
      const c = canvas.getContext('2d');
      drawCharacter(c, { x: 60, y: 70, color: '#49df49', arms: 1, legs: 1, limbColor: 0, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: 500, emote, emoteT: 700 });
      return Array.from(c.getImageData(0, 0, 120, 120).data);
    };
    const list = [-1, ...EMOTES.keys()].map(draw);
    const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; };
    const result = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) result.push(differ(list[i], list[j]));
    return result;
  });
  t.check('every expression looks different', faces.every((n) => n > 25), faces.join());

  // 한 장에 모아 눈으로 확인
  await page.evaluate(() => {
    const sheet = document.createElement('canvas');
    sheet.id = 'sheet';
    sheet.width = 1760;
    sheet.height = 580;
    sheet.style.cssText = 'position:fixed;left:0;top:0;width:880px;height:290px;z-index:99;background:#7fb56f';
    const c = sheet.getContext('2d');
    c.scale(2, 2);
    [-1, ...EMOTES.keys()].forEach((emote, i) => {
      c.save();
      c.translate(55 + (i % 8) * 110, Math.floor(i / 8) * 145 + 10);
      c.scale(2, 2);
      drawCharacter(c, { x: 0, y: 40, color: ['#e08a3c', '#4fa3e0', '#e04f9b', '#e0c23c', '#7a4fe0', '#3ce07a'][i % 6], arms: 1, legs: 1, limbColor: 0, dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: 500, emote, emoteT: 880 });
      c.restore();
    });
    document.body.append(sheet);
  });
  await page.locator('#sheet').screenshot({ path: path.join(SHOTS, 'emote_sheet.png') });
  await page.evaluate(() => document.getElementById('sheet').remove());

  // ---- 상점의 감정표현 탭과 채팅창의 표정 버튼
  await page.click('#chat-emote');
  t.check('the chat button lists only the emotes I have', (await page.$$eval('#chat-emotes [role="menuitem"]', (els) => els.map((e) => e.textContent).join())) === '박수,꿀맛,행복,엉엉,기쁨');
  await page.click('#chat-emotes .more');
  t.check('it leads to the emote tab of the shop', await page.isVisible('#emote-list') && (await page.$$('.emote-cell')).length === 15);
  await wait(250);
  const cells = () => page.$$eval('.emote-cell', (els) => els.map((e) => [e.classList.contains('owned'), e.querySelector('button').textContent]));
  t.check('free ones can be tried, the rest are for sale', (await cells()).slice(0, 5).every(([owned, label]) => owned && label === '해 보기') && (await cells()).slice(5).every(([owned]) => !owned), JSON.stringify(await cells()));
  await page.click('.emote-cell:nth-child(11) button');   // 춤
  await page.waitForFunction(() => !!(myEmotes & (1 << 10)), null, { timeout: 2000 });
  await wait(1200);
  t.check('buying turns the button into try it', (await cells())[10].join() === 'true,해 보기');
  await page.click('.emote-cell:nth-child(11) button');
  await friend.waitForFunction((who) => entities.get(who)?.emote === 10, id, { timeout: 2000 });
  t.check('trying it shows the dance to others', (await friend.textContent('#chat-log')).includes('actor님이 신나게 춤을 춥니다.'));
  await page.screenshot({ path: path.join(SHOTS, 'emote_shop.png') });
  await page.click('#furn-close');
  await page.click('#chat-emote');
  t.check('the new emote joins the chat menu', (await page.$$eval('#chat-emotes [role="menuitem"]', (els) => els.map((e) => e.textContent).join())) === '박수,꿀맛,행복,엉엉,기쁨,춤');
  await page.screenshot({ path: path.join(SHOTS, 'emote_menu.png') });
  await page.click('#chat-emote');
  await wait(3200);

  // ---- 채팅창에 입력하면 표정이 바뀐다
  await page.keyboard.press('Enter');
  await page.keyboard.type('/행복');
  await page.keyboard.press('Enter');
  await friend.waitForFunction((who) => entities.get(who)?.emote === 2, id, { timeout: 2000 });
  await page.waitForFunction(() => entities.get(myId).emote === 2, null, { timeout: 2000 }).catch(() => {});
  t.check('typing the macro changes my face', await page.evaluate(() => entities.get(myId).emote === 2));
  t.check('chat shows what happened', (await friend.textContent('#chat-log')).includes('actor님이 행복해합니다.'), await friend.textContent('#chat-log'));
  t.check('the macro text is not chatted', !(await friend.textContent('#chat-log')).includes('/행복'));

  // 일정 시간 뒤에는 평소 얼굴로 돌아온다
  const shownEmote = () => page.evaluate(() => new Promise((resolve) => {
    const original = drawCharacter;
    window.drawCharacter = (c, o) => {
      if (o.id === myId) { window.drawCharacter = original; resolve(o.emote); }
      return original(c, o);
    };
  }));
  t.check('expression shows while active', (await shownEmote()) === 2);
  await page.screenshot({ path: path.join(SHOTS, 'emote_world.png'), clip: { x: 400, y: 240, width: 300, height: 200 } });
  await wait(3300);
  t.check('expression ends by itself', (await shownEmote()) === -1);

  const problems = [...page.problems, ...friend.problems];
  t.check('no page errors', problems.length === 0, problems.join(' | '));
  await browser.close();
  await server.stop();
}

export default async function run(t) {
  await protocol(t);
  await ui(t);
}
