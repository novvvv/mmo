// 카페 건물과 4인용 테라스 테이블
import { Bot, startServer, wait } from '../lib.mjs';

export default async function run(t) {
  const server = await startServer();
  const a = await Bot.enter(server, '손님1');
  const map = a.map;
  const cafe = map.buildings.find((b) => b.k === 'cafe');

  t.check('cafe at (540, 400)', cafe?.x === 540 && cafe?.y === 400, JSON.stringify(cafe));
  t.check('cafe is named', cafe.name === '카페');
  t.check('cafe has a terrace', cafe.deck[2] > cafe.deck[0] && cafe.deck[3] > cafe.deck[1] && cafe.deck[1] >= cafe.y + cafe.front);
  t.check('cafe has no interior door', cafe.room === -1);

  const tables = a.furniture('cafe_table');
  t.check('tables stand on the terrace', tables.length >= 1 && tables.every((f) => f.x > cafe.deck[0] && f.x < cafe.deck[2] && f.y > cafe.deck[1] && f.y < cafe.deck[3]), tables.length);

  const seatsOf = (table) => map.seats.filter((s) => s.z === 0 && Math.hypot(s.x - table.x, s.y - table.y) < 60);
  t.check('every table seats four', tables.every((table) => seatsOf(table).length === 4), tables.map((f) => seatsOf(f).length).join());
  t.check('stools at every seat', tables.every((table) => seatsOf(table).every((s) => map.furn.some((f) => f.k === 'stool' && Math.abs(f.x - s.x) < 0.2 && Math.abs(f.y - s.y) < 0.2))));
  t.check('seats face the table', tables.every((table) => seatsOf(table).every((s) => (table.x - s.x) * s.fx + (table.y - s.y) * s.fy > 0)));
  t.check('seats are left/right so names do not collide', tables.every((table) => seatsOf(table).every((s) => s.side === (s.x < table.x ? -1 : 1))));
  t.check('seats are on the terrace', tables.every((table) => seatsOf(table).every((s) => s.x > cafe.deck[0] && s.x < cafe.deck[2] && s.y > cafe.deck[1] && s.y < cafe.deck[3])));

  // ---- 건물은 통과할 수 없다
  await a.walkTo(692, 475, 12);
  await a.walkTo(cafe.x + 40, cafe.deck[1] + 16, 8);
  a.send('in 1');
  await wait(800);
  a.send('in 0');
  await wait(100);
  t.check('cafe wall stops the player', a.me.y >= cafe.y + cafe.front + map.body - 0.2, a.me.y);

  // ---- 넷이 둘러앉는다
  const table = tables[0];
  const seats = seatsOf(table);
  const bots = [a, await Bot.enter(server, '손님2'), await Bot.enter(server, '손님3'), await Bot.enter(server, '손님4')];
  const extra = await Bot.enter(server, '손님5');
  await Promise.all(bots.map(async (bot, i) => {
    const seat = seats[i];
    await bot.walkTo(692, 585, 14);
    await bot.walkTo(seat.x + (seat.x < table.x ? -10 : 10), seat.y + (seat.y < table.y ? -12 : 12), 7);
    bot.send('use');
  }));
  await wait(200);
  const taken = bots.map((bot) => bot.me.s);
  t.check('four players sit around one table', new Set(taken).size === 4 && taken.every((s) => s && seats.includes(map.seats[s - 1])), JSON.stringify(taken));
  await extra.walkTo(692, 585, 14);
  await extra.walkTo(table.x, table.y + 46, 8);
  extra.send('use');
  await wait(150);
  t.check('fifth player has no seat at a full table', !extra.me.s || !seats.includes(map.seats[extra.me.s - 1]), JSON.stringify(extra.me));

  // ---- 일어나면 걸어 나갈 수 있다
  await Promise.all(bots.map(async (bot) => {
    const seat = map.seats[bot.me.s - 1];
    bot.send(seat.x < table.x ? 'in 4' : 'in 8');
    await wait(300);
    bot.send('in 0');
  }));
  await wait(120);
  t.check('everyone can stand up and walk away', bots.every((bot, i) => !bot.me.s && Math.abs(bot.me.x - map.seats[taken[i] - 1].x) > 20), JSON.stringify(bots.map((b) => [b.me.x, b.me.s])));

  // ---- 테이블은 통과할 수 없다
  const walker = extra;
  if (walker.me.s) {
    walker.send('use');
    await wait(100);
  }
  await walker.walkTo(table.x, table.y + 50, 6);
  walker.send('in 1');
  await wait(600);
  walker.send('in 0');
  await wait(120);
  t.check('the table is solid', walker.me.y >= table.y + 8 + map.body - 0.2, walker.me.y);

  bots.forEach((bot) => bot.close());
  extra.close();
  await server.stop();
}
