// 나무, 고양이의 배회, 가로등 배치
import { Bot, startServer, wait } from '../lib.mjs';

export default async function run(t) {
  const server = await startServer({ env: { MMO_CAT_NAP: '0' } });   // 돌아다니는 것을 보는 시험이라 낮잠은 끈다 (밤에는 60% 가 잠든다)
  const b1 = await Bot.enter(server, '관찰1');
  const b2 = await Bot.enter(server, '관찰2');
  const map = b1.map;
  const top = (x) => b1.top(x), bot = (x) => b1.bot(x);

  // ---- 나무
  const riverGap = (p) => (p.y < top(p.x) ? top(p.x) - p.y : p.y - bot(p.x));
  const north = map.trees.filter((p) => p.y < top(p.x));
  const south = map.trees.filter((p) => p.y > bot(p.x));
  t.check('trees on both banks', north.length === 9 && south.length === 6, `${north.length}/${south.length}`);
  t.check('trees are near the river', map.trees.every((p) => riverGap(p) >= 60 && riverGap(p) <= 180));
  t.check('bridge approach is clear', map.trees.every((p) => p.x < map.bridge[0] - 30 || p.x > map.bridge[1] + 30));

  const covers = (tree, x, y, half, above) => Math.abs(tree.x - x) < 62 + half && y + 20 > tree.y - 125 && y - above < tree.y + 12 && tree.y > y;
  const furniture = [...b1.furniture('chair').map((c) => [c.x, c.y, 23, 34]), ...b1.furniture('bench').map((c) => [c.x, c.y, 46, 34])];
  const hits = [];
  for (const tree of map.trees) for (const [x, y, half, above] of furniture) if (covers(tree, x, y, half, above)) hits.push([tree.x, x]);
  t.check('no tree covers a chair or bench', hits.length === 0, JSON.stringify(hits));
  const buildingHits = [];
  for (const tree of map.trees) {
    for (const b of map.buildings) {
      // 나무 몸통이 건물과 겹치지만 않으면 된다.
      if (Math.abs(tree.x - b.x) < b.halfW + 16 && tree.y > b.y - b.back - 12 && tree.y < b.y + b.front + 20) buildingHits.push([tree.x, b.name]);
    }
  }
  t.check('no tree trunk stands in a building', buildingHits.length === 0, JSON.stringify(buildingHits));
  let clash = 0;
  map.trees.forEach((p, i) => map.trees.forEach((q, j) => { if (j > i && Math.hypot(p.x - q.x, p.y - q.y) < 60) clash++; }));
  t.check('trees are spread out', clash === 0, clash);

  // ---- 가로등
  const northLamps = map.lamps.filter((l) => l.y < top(l.x));
  const southLamps = map.lamps.filter((l) => l.y > bot(l.x));
  t.check('lamps on both banks', northLamps.length >= 8 && southLamps.length >= 6, `${northLamps.length}/${southLamps.length}`);
  t.check('lamps are by the river and on land', map.lamps.every((l) => riverGap(l) >= map.margin && riverGap(l) <= 40), map.lamps.map((l) => Math.round(riverGap(l))).join());
  t.check('lamps stand beside the bridge', map.lamps.filter((l) => l.x === 670 || l.x === 770).length === 4);
  const lampClash = [];
  for (const l of map.lamps) {
    for (const [x, y, half] of furniture) if (Math.abs(l.x - x) < half + 4 && Math.abs(l.y - y) < 40) lampClash.push([l.x, x]);
    for (const tree of map.trees) if (Math.hypot(l.x - tree.x, l.y - tree.y) < 30) lampClash.push(['tree', l.x, tree.x]);
  }
  t.check('lamps do not overlap furniture or trunks', lampClash.length === 0, JSON.stringify(lampClash));

  // ---- 고양이 30초 관찰
  await wait(30000);
  const samples = b1.catSamples;
  const seconds = (samples.at(-1).at - samples[0].at) / 1000;
  const rate = (samples.length - 1) / seconds;
  t.check('cat updates about 4 per second', rate > 3.7 && rate < 4.3, rate.toFixed(2));
  t.check('5 cats', samples.every((s) => s.p.length === 5));

  const homes = [[520, true], [960, true], [170, true], [420, false], [1120, false]];
  let wet = 0, wrongBank = 0, roamed = 0, far = 0, inBuilding = 0;
  const travel = homes.map(() => 0);
  const idle = homes.map(() => 0);
  samples.forEach((s, n) => s.p.forEach(([x, y], i) => {
    const [home, isNorth] = homes[i];
    const tt = top(x), bb = bot(x);
    if (y > tt - map.margin + 1.2 && y < bb + map.margin - 1.2) wet++;
    if (isNorth ? y > (tt + bb) / 2 : y < (tt + bb) / 2) wrongBank++;
    if (Math.abs(x - home) > 242) roamed++;
    if ((isNorth ? tt - y : y - bb) > 215) far++;
    if (map.solids.some((so) => so[0] === 0 && x > so[1] && x < so[3] && y > so[2] && y < so[4])) inBuilding++;
    if (n > 0) {
      const [px, py] = samples[n - 1].p[i];
      const d = Math.hypot(x - px, y - py);
      travel[i] += d;
      if (d === 0) idle[i]++;
    }
  }));
  t.check('no cat ever enters the water', wet === 0, wet);
  t.check('cats stay on their own bank', wrongBank === 0, wrongBank);
  t.check('cats stay within their area', roamed === 0, roamed);
  t.check('cats stay near the river', far === 0, far);
  t.check('cats do not walk through buildings', inBuilding === 0, inBuilding);
  t.check('every cat walks', travel.every((d) => d > 60), travel.map(Math.round).join());
  t.check('every cat also rests', idle.every((n) => n > 4), idle.join());
  const maxStep = Math.max(...samples.slice(1).flatMap((s, n) => s.p.map(([x, y], i) => Math.hypot(x - samples[n].p[i][0], y - samples[n].p[i][1]))));
  t.check('cats never teleport', maxStep < 25, maxStep.toFixed(1));
  t.check('all players see the same cats', b1.cats.every(([x, y], i) => Math.hypot(x - b2.cats[i][0], y - b2.cats[i][1]) < 20));

  b1.close();
  b2.close();
  await server.stop();
}
