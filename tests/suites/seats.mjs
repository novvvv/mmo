// 2인용 벤치
import { Bot, startServer, wait } from '../lib.mjs';

export default async function run(t) {
  const server = await startServer();
  const p1 = await Bot.enter(server, '벤치1');
  const p2 = await Bot.enter(server, '벤치2');
  const p3 = await Bot.enter(server, '벤치3');
  const map = p1.map;
  const top = (x) => p1.top(x), bot = (x) => p1.bot(x);
  const near = (a, b) => Math.abs(a - b) < 0.11;
  const bobberOk = (me) => me.by > top(me.bx) && me.by < bot(me.bx) && !(me.bx > map.bridge[0] - 6 && me.bx < map.bridge[1] + 6);

  const benches = p1.furniture('bench');
  t.check('5 outdoor benches', benches.length === 5, benches.length);
  t.check('every outdoor bench has a left and right seat', benches.every((b) => {
    const left = map.seats.find((s) => s.z === 0 && near(s.x, b.x - 22) && near(s.y, b.y));
    const right = map.seats.find((s) => s.z === 0 && near(s.x, b.x + 22) && near(s.y, b.y));
    return left?.side === -1 && right?.side === 1;
  }));
  const riverside = benches.filter((b) => b.y > 700);
  t.check('benches stay clear of the sand', riverside.every((b) => b.y + 20 < Math.min(top(b.x - 46), top(b.x), top(b.x + 46)) - 13));
  t.check('riverside bench seats can reach the water', riverside.every((b) => [b.x - 22, b.x + 22].every((x) => top(x) - b.y <= map.fishReach)));
  t.check('benches clear of the bridge', riverside.every((b) => b.x + 46 < map.bridge[0] || b.x - 46 > map.bridge[1]));

  const bench = riverside.find((b) => b.x === 605);
  const leftSeat = p1.seatIndexAt(bench.x - 22, bench.y);
  const rightSeat = p1.seatIndexAt(bench.x + 22, bench.y);
  await p1.toNorthField(bench.x - 30);
  await p1.walkTo(bench.x - 30, bench.y - 22, 8);
  await p2.toNorthField(bench.x + 30);
  await p2.walkTo(bench.x + 30, bench.y - 22, 8);
  await p3.toNorthField(bench.x);
  await p3.walkTo(bench.x, bench.y - 24, 8);

  p1.send('use');
  await wait(100);
  t.check('first player takes the near (left) seat', p1.me.s === leftSeat + 1, JSON.stringify(p1.me));
  p2.send('use');
  await wait(100);
  t.check('second player takes the right seat', p2.me.s === rightSeat + 1, JSON.stringify(p2.me));
  p3.send('use');
  await wait(100);
  t.check('third player has no room', !p3.me.s);

  p1.send('fish');
  p2.send('fish');
  await wait(120);
  t.check('both can fish from the bench', p1.me.f === 1 && p2.me.f === 1 && bobberOk(p1.me) && bobberOk(p2.me));
  p1.send('fish');
  p2.send('fish');
  await wait(100);
  t.check('still seated after reeling in', p1.me.s === leftSeat + 1 && p2.me.s === rightSeat + 1);

  p1.send('use');
  await wait(100);
  t.check('stand up frees only that seat', !p1.me.s && p2.me.s === rightSeat + 1);
  p3.send('use');
  await wait(100);
  t.check('third player takes the freed seat', p3.me.s === leftSeat + 1);
  p3.close();
  await wait(150);
  p1.send('use');
  await wait(100);
  t.check('disconnect frees a bench seat', p1.me.s === leftSeat + 1);
  p1.send('in 8');
  await wait(200);
  p1.send('in 0');
  t.check('moving off a bench works', !p1.me.s);
  p1.close();
  p2.close();
  await server.stop();
}
