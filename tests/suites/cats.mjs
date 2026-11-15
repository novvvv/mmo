// 강가 고양이와의 상호작용: 쓰다듬기, 먹이 주기, 따라오기
import { Bot, startServer, uniqueId, wait } from '../lib.mjs';

// 움직이는 고양이 옆으로 다가간다.
async function reachCat(bot, index) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const [cx, cy] = bot.cats[index];
    if (Math.hypot(cx - bot.me.x, cy - bot.me.y) < 45) {
      bot.send('in 0');
      await wait(100);
      const [ax, ay] = bot.cats[index];
      if (Math.hypot(ax - bot.me.x, ay - bot.me.y) < 60) return true;
    }
    await bot.walkTo(cx + 26, cy - 8, 10, 3000);
  }
  return false;
}

// 쉬던 동물은 그 자리에서 잠들고, 쓰다듬으면 깬다
async function naps(t) {
  const server = await startServer({ env: { MMO_CAT_NAP: '100' } });
  const a = await Bot.enter(server, '집사');
  await a.until(() => a.cats, 1000);
  t.check('cats start out awake', a.cats.every((c) => !c[3]), JSON.stringify(a.cats));
  await a.until(() => a.cats.every((c) => c[3] === 1), 16000).catch(() => {});
  t.check('resting cats fall asleep where they are', a.cats.every((c) => c[3] === 1), JSON.stringify(a.cats));
  const still = JSON.stringify(a.cats.map(([x, y]) => [x, y]));
  await wait(1500);
  t.check('a sleeping cat stays put', JSON.stringify(a.cats.map(([x, y]) => [x, y])) === still);
  await a.toNorthField(520);
  const index = a.cats.reduce((best, c, i) => (Math.hypot(c[0] - a.me.x, c[1] - a.me.y) < Math.hypot(a.cats[best][0] - a.me.x, a.cats[best][1] - a.me.y) ? i : best), 0);
  t.check('I can walk up to it', await reachCat(a, index));
  a.send('pet');
  await a.until(() => a.events.some((e) => e.t === 'cat' && e.act === 'pet'), 1500);
  await wait(400);
  t.check('petting wakes it up', a.events.find((e) => e.t === 'cat').woke === 1 && !a.cats[index][3], JSON.stringify(a.cats[index]));
  a.close();
  await server.stop();
}

export default async function run(t) {
  await naps(t);
  const server = await startServer({ env: { MMO_CAT_NAP: '0' } });
  const a = await Bot.enter(server, '집사');
  const watcher = await Bot.enter(server, '구경');
  await a.until(() => a.cats, 1000);
  await a.toNorthField(520);

  // ---- 멀면 안 된다
  const farCat = Math.min(...a.cats.map(([x, y]) => Math.hypot(x - a.me.x, y - a.me.y)));
  a.send('pet');
  await wait(150);
  if (farCat > a.map.catReach + 20) t.check('pet from afar is ignored', !a.events.some((e) => e.t === 'cat'), farCat);
  await wait(700);

  // ---- 쓰다듬기
  t.check('reached a cat', await reachCat(a, 0));
  const count = () => a.events.filter((e) => e.t === 'cat').length;
  const eventsBefore = count();
  a.send('pet');
  await a.until(() => count() > eventsBefore, 1000);
  const pet = a.events.filter((e) => e.t === 'cat').at(-1);
  t.check('pet event', pet?.act === 'pet' && pet.i === 0 && pet.id === a.id && pet.n === '집사', JSON.stringify(pet));
  await wait(100);
  t.check('other players see the pet', watcher.events.some((e) => e.t === 'cat' && e.act === 'pet'));
  const before = [...a.cats[0]];
  await wait(3000);
  t.check('petted cat stays put', Math.hypot(a.cats[0][0] - before[0], a.cats[0][1] - before[1]) < 1, `${before} -> ${a.cats[0]}`);

  // ---- 연속 입력 제한
  await wait(700);
  await reachCat(a, 0);
  const n0 = count();
  a.send('pet');
  a.send('pet');
  a.send('pet');
  await wait(200);
  t.check('rapid pets are limited', count() === n0 + 1, count() - n0);
  await wait(600);
  a.send('pet');
  await wait(150);
  t.check('can pet again after the cooldown', count() === n0 + 2, count() - n0);

  // ---- 물고기 없이 먹이 주기
  await wait(700);
  a.send('feed');
  await wait(150);
  t.check('feeding without fish explains why', a.events.some((e) => e.t === 'sys' && e.m.includes('줄 물고기가 없습니다')));

  // ---- 낚시해서 먹이 주기
  await a.toNorthField(520);
  await a.walkTo(520, a.top(520) - 40, 10);
  let caught = null;
  for (let i = 0; i < 4 && !caught; i++) {
    a.send('fish');
    if (await a.until(() => a.me.f === 2, 9000)) {
      a.send('fish');
      await a.until(() => a.events.some((e) => e.t === 'catch'), 1000);
      caught = a.events.find((e) => e.t === 'catch');
    }
  }
  t.check('caught a fish to feed', !!caught);
  await wait(700);  // 쿨다운이 끝난 뒤에 다가가야 그 사이 고양이가 멀어지지 않는다
  t.check('reached a cat again', await reachCat(a, 0));
  const feedBefore = count();
  a.send('feed');
  await a.until(() => count() > feedBefore, 1000);
  const fed = a.events.filter((e) => e.t === 'cat').at(-1);
  t.check('feed event uses up a fish', fed?.act === 'feed' && fed.k === caught.k && fed.c.reduce((x, y) => x + y) === 0, JSON.stringify(fed));

  // ---- 먹이를 주면 따라온다
  await wait(150);
  const start = { x: a.me.x, y: a.me.y };
  await a.walkTo(start.x + 260, Math.min(start.y - 120, 670), 12);
  await wait(2200);
  const [fx, fy] = a.cats[0];
  const followDist = Math.hypot(fx - a.me.x, fy - a.me.y);
  t.check('fed cat follows the player', followDist < 90, followDist.toFixed(1));
  t.check('following cat keeps a little distance', followDist > 20, followDist.toFixed(1));

  // ---- 다리를 건너가도 고양이는 자기 강가에 남는다
  await a.toNorthField(720);
  await a.walkTo(720, a.top(720) - 40, 8);
  a.send('in 2');
  await a.until(() => a.me.y > a.bot(720) + 60, 4000);
  a.send('in 0');
  await wait(2500);
  const [cx, cy] = a.cats[0];
  t.check('following cat does not cross the bridge', cy < a.top(cx) - a.map.margin + 1.2, `${cx},${cy}`);

  // ---- 먹이를 준 사람이 나가면 평소처럼 돌아간다
  a.close();
  await wait(300);
  t.check('cat handles the feeder leaving', !watcher.closed && watcher.cats.length === 5);
  watcher.close();

  // ---- 새 계정의 가방은 비어 있고, 다시 접속해도 유지된다
  const id = uniqueId('feeder');
  const f1 = await Bot.enter(server, '기록', { id });
  f1.close();
  await wait(100);
  const f2 = await Bot.connect(server);
  await f2.login(id);
  await f2.join({ nick: '기록' });
  t.check('bag is restored on login', Array.isArray(f2.welcome.c) && f2.welcome.c.length === 3 && f2.welcome.c.every((n) => n === 0), JSON.stringify(f2.welcome));
  f2.close();
  await server.stop();
}
