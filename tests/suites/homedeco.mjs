// 집 꾸미기 2: 설치형으로 바뀐 몰쟈·캬캬 가구(조명, 창, TV 포함), 염색, 바닥재, 펫, 쉬면 받는 골드, 미니홈피 이동,
// 도트 광고판, 채팅 스킨, 지도 접기, 창 옮기기
import path from 'node:path';
import { Bot, enterPage, launchBrowser, loginPage, openPage, serverWithAccounts, SHOTS, startServer, stubYouTube, wait } from '../lib.mjs';

const MOLJA = 1, RARA = 2, KYAKYA = 3, THEATER = 4;
const SOFA_L = 8, LONG_TABLE = 12, DINING_CHAIR = 0;
const shot = (name) => path.join(SHOTS, name);
const decor = (bot) => bot.lastEvent('decor');
const inv = (bot) => bot.lastEvent('inv');
const says = (bot, text) => bot.events.some((e) => e.t === 'sys' && e.m.includes(text));
const pause = () => wait(260);   // 행동 제한에 걸리지 않게

async function protocol(t) {
  const { server, ids } = await serverWithAccounts({
    host: [KYAKYA, 790, 380, { f12: 1, gold: 1000 }], guest: [KYAKYA, 700, 380, { gold: 400 }], out: [0, 820, 620],
  }, { env: { MMO_REST_SEC: '1' } });
  const enter = async (name) => {
    const bot = await Bot.enter(server, name, { id: ids[name] });
    await wait(60);
    return bot;
  };
  const host = await enter('host'), guest = await enter('guest'), out = await enter('out');
  await host.until(() => decor(host), 1500);

  // ---- 캬캬 집의 원래 가구는 설치형이다
  const seeded = decor(host).p;
  t.check('the 캬캬 house furniture is placeable furniture', seeded.length === host.map.seeds.filter((s) => s.z === KYAKYA).length && seeded.every((d) => d[4] === 2), seeded.length);
  const sofa = seeded.find((d) => d[1] === SOFA_L);
  t.check('the L sofa seats three', sofa?.[5].length === 3, JSON.stringify(sofa));
  const chair = seeded.find((d) => d[1] === DINING_CHAIR);
  t.check('chairs around the table still face it', chair && Math.abs(chair[5][0][7]) > 0.5, JSON.stringify(chair));
  t.check('only the piano, its stool and the poster stay fixed', host.map.furn.filter((f) => f.z === KYAKYA).map((f) => f.k).sort().join() === 'nimda_poster,piano,stool', host.map.furn.filter((f) => f.z === KYAKYA).map((f) => f.k).join());
  t.check('lamps, windows and the TV are placeable now', ['lantern_lamp', 'sheer_window', 'tv'].every((k) => seeded.some((d) => host.map.catalog[d[1]].k === k)));
  guest.send(`decor take ${sofa[0]}`);
  await guest.until(() => inv(guest)?.f?.[SOFA_L] === 1, 1500);
  await host.until(() => decor(host).p.length === seeded.length - 1, 1500);
  t.check('anyone can put house furniture in the bag', inv(guest).f[SOFA_L] === 1 && !decor(host).p.some((d) => d[0] === sofa[0]));

  // ---- 염색
  await pause();
  host.send(`decor dye ${LONG_TABLE} 3f5fc8-100-100`);
  await host.until(() => says(host, '염료가 없습니다'), 1500);
  t.check('dyeing needs a dye', inv(host)?.fd?.length ?? 0 === 0);
  await pause();
  host.send('decor buydye');
  await host.until(() => inv(host)?.dye === 1, 1500);
  const dyePrice = host.map.dyePrice;
  t.check('dye costs its price (0 while testing)', inv(host).dye === 1 && inv(host).g === 1000 - dyePrice, JSON.stringify(inv(host)));
  await pause();
  host.send(`decor dye ${LONG_TABLE} 3F5FC8-100-100`);
  await pause();
  host.send(`decor dye ${LONG_TABLE} 3f5fc8-300-100`);
  await wait(200);
  t.check('bad dye values are refused', inv(host).dye === 1 && inv(host).fd.length === 0);
  host.send(`decor dye ${LONG_TABLE} 3f5fc8-120-80`);
  await host.until(() => inv(host).fd.length === 1, 1500);
  t.check('dyeing turns a plain piece into a dyed one', inv(host).f[LONG_TABLE] === 0 && JSON.stringify(inv(host).fd) === JSON.stringify([[LONG_TABLE, '3f5fc8-120-80']]) && inv(host).dye === 0);
  await pause();
  host.send('decor buydye');
  await pause();
  host.send('decor redye 0 d6609a-100-150');
  await host.until(() => inv(host).fd[0]?.[1] === 'd6609a-100-150', 1500);
  t.check('a dyed piece can be dyed again', inv(host).fd.length === 1 && inv(host).dye === 0);
  await pause();
  host.send('decor placedyed 0 640 230');
  await host.until(() => decor(host).p.some((d) => d[6] === 'd6609a-100-150'), 1500);
  const dyed = decor(host).p.find((d) => d[6]);
  t.check('a dyed piece keeps its colour in the room', dyed?.[1] === LONG_TABLE && dyed[4] === 1 && inv(host).fd.length === 0, JSON.stringify(dyed));
  t.check('others see the colour too', decor(guest).p.some((d) => d[6] === 'd6609a-100-150'));
  await pause();
  host.send(`decor take ${dyed[0]}`);
  await host.until(() => inv(host).fd.length === 1, 1500);
  t.check('taking it back keeps the colour', JSON.stringify(inv(host).fd) === JSON.stringify([[LONG_TABLE, 'd6609a-100-150']]));
  await pause();
  host.send('decor placedyed 0 640 230');
  await host.until(() => decor(host).p.some((d) => d[6]), 1500);

  // ---- 놓인 가구를 그 자리에서 염색
  const placed = decor(host).p.find((d) => d[1] === LONG_TABLE && d[6]);
  await pause();
  guest.send(`decor dyeplaced ${placed[0]} 2f9e5a-100-100`);
  await guest.until(() => says(guest, '직접 놓았거나'), 1500);
  t.check('someone else cannot dye your placed furniture', says(guest, '직접 놓았거나'));
  await pause();
  host.send(`decor dyeplaced ${placed[0]} 2f9e5a-100-100`);
  await host.until(() => says(host, '염료가 없습니다'), 1500);
  t.check('dyeing placed furniture needs a dye too', says(host, '염료가 없습니다') && decor(host).p.find((d) => d[0] === placed[0])[6] === 'd6609a-100-150');
  await pause();
  host.send('decor buydye');
  await host.until(() => inv(host).dye === 1, 1500);
  await pause();
  host.send(`decor dyeplaced ${placed[0]} 2f9e5a-100-100`);
  await guest.until(() => decor(guest).p.find((d) => d[0] === placed[0])?.[6] === '2f9e5a-100-100', 1500);
  const redyed = decor(host).p.find((d) => d[0] === placed[0]);
  t.check('placed furniture changes colour where it stands, for everyone', redyed?.[6] === '2f9e5a-100-100' && redyed[2] === placed[2] && redyed[3] === placed[3] && decor(guest).p.find((d) => d[0] === placed[0])?.[6] === '2f9e5a-100-100' && inv(host).dye === 0, JSON.stringify(redyed));
  t.check('the four new pets are in the shop', host.map.petPrices.length === 12);
  await pause();
  host.send('decor buydye');   // 아래 확인들이 원래 색으로 찾으므로 되돌려 둔다
  await host.until(() => inv(host).dye === 1, 1500);
  await pause();
  host.send(`decor dyeplaced ${placed[0]} d6609a-100-150`);
  await host.until(() => decor(host).p.find((d) => d[0] === placed[0])?.[6] === 'd6609a-100-150', 1500);

  // ---- 바닥재
  await pause();
  out.send('floor 3');
  await out.until(() => says(out, '집 안에서만'), 1500);
  t.check('floors change only inside a house', true);
  const goldBeforeFloor = inv(host).g;
  host.send('floor 3');
  await guest.until(() => guest.lastEvent('floor')?.m === 3, 1500);
  t.check('a new floor shows to everyone in the house', guest.lastEvent('floor').z === KYAKYA);
  await host.until(() => inv(host).g === goldBeforeFloor - host.map.floorPrice, 1500);
  t.check('a new floor is bought once', inv(host).g === goldBeforeFloor - host.map.floorPrice && (inv(host).floors & (1 << 3)) !== 0);
  await pause();
  host.send('floor 0');
  await guest.until(() => guest.lastEvent('floor')?.m === 0, 1500);
  await pause();
  host.send('floor 3');
  await guest.until(() => guest.lastEvent('floor')?.m === 3, 1500);
  await wait(150);
  t.check('a floor I own is free to lay again', inv(host).g === goldBeforeFloor - host.map.floorPrice);
  await pause();
  host.send('floor 99');
  await wait(200);
  t.check('unknown floors are refused', host.lastEvent('floor').m === 3);

  // ---- 돌리기: 좌우로 뒤집고, 앉는 방향도 뒤집힌다
  await pause();
  const chairBefore = decor(host).p.find((d) => d[1] === DINING_CHAIR);
  host.send(`decor turn ${chairBefore[0]}`);
  await guest.until(() => decor(guest).p.find((d) => d[0] === chairBefore[0])?.[7] === 1, 1500);
  const chairAfter = decor(guest).p.find((d) => d[0] === chairBefore[0]);
  t.check('turning flips a chair and the way you sit', Math.abs(chairAfter[5][0][7] + chairBefore[5][0][7]) < 0.01 && chairAfter[5][0][1] === chairBefore[5][0][1], JSON.stringify([chairBefore[5], chairAfter[5]]));
  await pause();
  const hostsTable = decor(guest).p.find((d) => d[6] === 'd6609a-100-150');
  guest.send(`decor turn ${hostsTable[0]}`);
  await guest.until(() => says(guest, '동거인이 놓은 가구만 돌릴'), 1500);
  t.check('only the owner or housemates turn furniture', decor(guest).p.find((d) => d[0] === hostsTable[0])[7] === 0);

  // ---- 크기: 가구마다 정해진 범위 안에서, 앉는 자리도 같이 줄어든다
  const chairKind = host.map.catalog[DINING_CHAIR], rugKind = host.map.catalog.findIndex((k) => k.k === 'rug_heart');
  t.check('each piece has its own size range', chairKind.smin === 80 && chairKind.smax === 130 && host.map.catalog[rugKind].smin === 60 && host.map.catalog[rugKind].smax === 160, JSON.stringify([chairKind, host.map.catalog[rugKind]]));
  t.check('pieces start at full size', decor(host).p.every((d) => d[8] === 100));
  await pause();
  host.send(`decor scale ${chairBefore[0]} 80`);
  await guest.until(() => decor(guest).p.find((d) => d[0] === chairBefore[0])?.[8] === 80, 1500);
  const small = decor(guest).p.find((d) => d[0] === chairBefore[0]);
  t.check('a piece can be made smaller', small[8] === 80 && small[7] === 1 && small[2] === chairBefore[2]);
  t.check('the seat moves with the size', Math.abs((small[5][0][2] - small[3]) - (chairAfter[5][0][2] - chairAfter[3]) * 0.8) < 0.6, JSON.stringify([small[5][0], chairAfter[5][0]]));
  await pause();
  host.send(`decor scale ${chairBefore[0]} 200`);
  await pause();
  host.send(`decor scale ${chairBefore[0]} 40`);
  await wait(200);
  t.check('sizes outside the range are refused', decor(guest).p.find((d) => d[0] === chairBefore[0])[8] === 80);
  await pause();
  guest.send(`decor scale ${hostsTable[0]} 90`);
  await guest.until(() => says(guest, '동거인이 놓은 가구만 크기를'), 1500);
  t.check('only the owner or housemates resize furniture', decor(guest).p.find((d) => d[0] === hostsTable[0])[8] === 100);

  // ---- 바닥 염색: 염료 한 병, 원래 색으로 되돌리기는 무료
  await pause();
  host.send('decor buydye');
  await host.until(() => inv(host).dye >= 1, 1500);
  await pause();
  host.send('decor buydye');
  await host.until(() => inv(host).dye >= 2, 1500);
  await pause();
  host.send('floor dye 3f5fc8-110-90');
  await guest.until(() => guest.lastEvent('floor')?.tint === '3f5fc8-110-90', 1500);
  t.check('the floor can be dyed', inv(host).dye === 1 && guest.lastEvent('floor').m === 3);
  await pause();
  host.send('floor undye');
  await guest.until(() => guest.lastEvent('floor')?.tint === '', 1500);
  t.check('the floor can go back to its own colour', inv(host).dye === 1);
  await pause();
  host.send('floor dye zzzzzz-100-100');
  await wait(150);
  t.check('bad floor colours are refused', guest.lastEvent('floor').tint === '');
  host.send('floor dye d6609a-100-100');
  await guest.until(() => guest.lastEvent('floor')?.tint === 'd6609a-100-100', 1500);

  // ---- 캐릭터 러그: 밟고 지나가는 깔개
  const rugKinds = host.map.catalog.map((c, i) => [c, i]).filter(([c]) => ['rug_cat_black', 'rug_cat_stand', 'rug_bunny', 'rug_long_cat', 'rug_puppy', 'rug_8ball', 'rug_cloud', 'rug_heart'].includes(c.k));
  t.check('eight character rugs are on sale', rugKinds.length === 8 && rugKinds.every(([c]) => c.place === 2 && c.hw > 0));
  await pause();
  host.send(`decor buy ${rugKinds[5][1]}`);
  await host.until(() => inv(host).f[rugKinds[5][1]] === 1, 1500);
  await pause();
  host.send(`decor place ${rugKinds[5][1]} 640 330`);
  await guest.until(() => decor(guest).p.some((d) => d[1] === rugKinds[5][1]), 1500);
  t.check('a character rug can be laid', decor(guest).p.some((d) => d[1] === rugKinds[5][1] && d[2] === 640));
  await pause();
  host.send(`decor buy ${rugKinds[5][1]}`);
  await host.until(() => inv(host).f[rugKinds[5][1]] === 1, 1500);
  await pause();
  host.send(`decor place ${rugKinds[5][1]} 640 400`);
  await host.until(() => says(host, '깔개가 방 밖으로'), 1500);
  t.check('a rug may not stick out past the wall', decor(host).p.filter((d) => d[1] === rugKinds[5][1]).length === 1);
  const pendants = host.map.catalog.findIndex((c) => c.k === 'pendant_cone');
  t.check('the long table lights are separate furniture', decor(host).p.filter((d) => d[1] === pendants).length === 3);

  // ---- 미니홈피 이동
  await pause();
  out.send(`visit ${THEATER}`);
  await wait(250);
  t.check('visits go only to houses', out.zone === 0);
  out.send(`visit ${RARA}`);
  await out.until(() => out.zone === RARA, 1500);
  const rara = out.map.zones[RARA];
  const landed = out.lastEvent('zone');
  t.check('a visit lands just inside the door', Math.abs(landed.x - rara.door[0]) < 0.2 && Math.abs(landed.y - (rara.door[1] - 40)) < 0.2, JSON.stringify(landed));
  await pause();
  out.send(`visit ${KYAKYA}`);
  await out.until(() => out.lastEvent('floor')?.z === KYAKYA, 1500);
  t.check('visiting a house shows its floor', out.lastEvent('floor').m === 3);

  // ---- 펫: 상점에서 사고 데리고 다닌다. 다른 사람에게는 상태의 pt 로 보인다
  await pause();
  guest.send('buypet 1');
  await guest.until(() => inv(guest)?.pets === 2, 1500);
  t.check('buying a pet costs gold and brings it along', inv(guest).pet === 1 && inv(guest).g === 400 - host.map.petPrices[1], JSON.stringify(inv(guest)));
  await host.until(() => host.others?.some((e) => e.n === 'guest' && e.pt === 1), 1500);
  t.check('others see the pet', host.others.some((e) => e.n === 'guest' && e.pt === 1));
  await pause();
  guest.send('buypet 1');
  await guest.until(() => says(guest, '이미 함께하는'), 1500);
  await pause();
  if (host.map.petPrices[6] > inv(guest).g) {
    guest.send('buypet 6');
    await guest.until(() => says(guest, '골드가 부족'), 1500);
  }
  t.check('pets need gold and come once', inv(guest).pets === 2);
  await pause();
  guest.send('walkpet 5');
  await wait(200);
  t.check('only owned pets can walk along', inv(guest).pet === 1);
  guest.send('walkpet -1');
  await guest.until(() => inv(guest).pet === -1, 1500);
  await host.until(() => host.others?.some((e) => e.n === 'guest' && e.pt === undefined), 1500);
  t.check('a pet can stay home', host.others.some((e) => e.n === 'guest' && e.pt === undefined));

  // ---- 앉아서 쉬면 골드 (테스트 서버는 1초마다)
  await pause();
  const stool = decor(guest).p.find((d) => d[1] === 1 && d[5].length);  // 흰 의자
  const [, sx, sy] = stool[5][0];
  await guest.walkTo(sx, sy + (stool[5][0][3] < 0 ? 24 : -24), 10);
  guest.send('use');
  await guest.until(() => guest.me.s > 0, 1500);
  const seatedGold = inv(guest).g;
  await guest.until(() => inv(guest).g >= seatedGold + 2, 4000);
  t.check('resting on a chair earns gold quietly', inv(guest).g >= seatedGold + 2 && !guest.events.some((e) => e.t === 'rest'), `${seatedGold} -> ${inv(guest).g}`);
  guest.send('use');
  await guest.until(() => !guest.me.s, 1500);
  const standingGold = inv(guest).g;
  await wait(1600);
  t.check('standing earns nothing', inv(guest).g === standingGold);

  // ---- 광고판 모양
  host.send('board 1 놀러 오세요');
  await guest.until(() => guest.events.some((e) => e.t === 'board' && e.m === '놀러 오세요'), 1500);
  await pause();
  host.send('boardstyle 1');
  await guest.until(() => guest.events.some((e) => e.t === 'board' && e.s === 1), 1500);
  t.check('the pixel board style reaches everyone', host.lastEvent('myboard').s === 1);
  await pause();
  host.send('boardstyle 7');
  await wait(200);
  t.check('unknown board styles are refused', host.lastEvent('myboard').s === 1);

  // ---- 다시 켜도 남는다
  for (const bot of [host, guest, out]) bot.close();
  await wait(300);
  await server.stop();
  const again = await startServer({ dataDir: server.dataDir });
  const back = await Bot.enter(again, 'host', { id: ids.host });
  await back.until(() => decor(back) && back.lastEvent('floor') && inv(back) !== undefined || back.welcome, 1500);
  await back.until(() => decor(back), 1500);
  t.check('the dyed piece survives a restart', decor(back).p.some((d) => d[6] === 'd6609a-100-150'));
  t.check('the floor survives a restart', back.lastEvent('floor')?.m === 3 && back.lastEvent('floor').tint === 'd6609a-100-100', JSON.stringify(back.lastEvent('floor')));
  t.check('a turned piece stays turned', decor(back).p.some((d) => d[1] === DINING_CHAIR && d[7] === 1));
  t.check('a resized piece keeps its size', decor(back).p.some((d) => d[1] === DINING_CHAIR && d[7] === 1 && d[8] === 80));
  t.check('bought floors stay mine', (back.welcome.floors & (1 << 3)) !== 0, JSON.stringify(back.welcome.floors));
  t.check('the taken sofa stays taken', !decor(back).p.some((d) => d[1] === SOFA_L));
  t.check('the board style survives a restart', back.events.some((e) => e.t === 'boards' && e.p.some((b) => b[2] === 1)));
  back.close();
  await again.stop();
}

// 이전 버전에서 올라올 때: 1번 묶음만 깔린 데이터에 2번 묶음(조명, 창, TV ...)만 더해지고 1번은 겹치지 않는다
async function upgrade(t) {
  const fresh = await startServer();
  const bot = await Bot.enter(fresh, 'up');
  await bot.until(() => bot.map, 1500);
  const catalog = bot.map.catalog.map((c) => c.k);
  bot.close();
  await wait(300);
  await fresh.stop();
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dir = fresh.dataDir;
  const second = new Set(['floor_lamp', 'lantern_lamp', 'glass_partition', 'big_window', 'sheer_window', 'fireplace', 'tv_wall', 'tv']);
  const lines = readFileSync(`${dir}/decor.list`, 'utf8').split('\n').filter((line) => line && !second.has(line.split('\t')[0]));
  writeFileSync(`${dir}/decor.list`, lines.join('\n') + '\n');
  writeFileSync(`${dir}/decor.seeded`, '1\n3\n');   // 예전 형식: 구역 번호만
  const again = await startServer({ dataDir: dir });
  const inside = await serverWithAccountsInside(again);
  await inside.until(() => decor(inside), 1500);
  const kinds = decor(inside).p.map((d) => catalog[d[1]]);
  t.check('an upgrade lays the new lamps, windows, fireplace and TV', ['big_window', 'fireplace', 'tv_wall', 'glass_partition', 'floor_lamp'].every((k) => kinds.includes(k)), kinds.join());
  t.check('an upgrade does not lay the old pieces twice', kinds.filter((k) => k === 'sofa_cream').length === 1 && kinds.filter((k) => k === 'big_window').length === 2);
  inside.close();
  await again.stop();
}

async function serverWithAccountsInside(server) {
  const bot = await Bot.enter(server, 'inside');
  await bot.until(() => bot.map, 1500);
  bot.send(`visit ${MOLJA}`);
  await bot.until(() => bot.zone === MOLJA, 1500);
  return bot;
}

async function browser(t) {
  const { server, ids } = await serverWithAccounts({ deco: [MOLJA, 300, 380, { f12: 1, dye: 1, gold: 1000 }], walker: [0, 720, 600] });
  const chrome = await launchBrowser();

  // ---- 미니홈피 모드: 로그인에서 고르고, 오른쪽 탭으로 집을 오간다
  const hompy = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
  t.check('the login offers village or minihompy, not pixel', !!(await hompy.$('input[name="auth-mode"][value="hompy"]')) && !(await hompy.$('input[name="auth-mode"][value="pixel"]')));
  await hompy.check('input[name="auth-mode"][value="hompy"]', { force: true });
  await loginPage(hompy, ids.walker);
  await enterPage(hompy, { name: 'walker' });
  await hompy.waitForFunction(() => zone === 3, null, { timeout: 4000 });
  t.check('minihompy starts inside 캬캬', await hompy.isVisible('#hompy') && !(await hompy.isVisible('#map-win')));
  t.check('the tabs list the four houses', (await hompy.textContent('#hompy-tabs')).replace(/의 집/g, '') === '캬캬랏라몰쟈헤연', await hompy.textContent('#hompy-tabs'));
  await hompy.click('#hompy-tabs button[data-zone="1"]');
  await hompy.waitForFunction(() => zone === 1, null, { timeout: 3000 });
  t.check('a tab jumps straight into that house', (await hompy.getAttribute('#hompy-tabs button[data-zone="1"]', 'aria-current')) === 'page');
  t.check('the door offers no way out', !(await hompy.evaluate(() => { const [dx, dy] = terrain.zones[zone].door; return actionHint({ ...entities.get(myId), x: dx, y: dy - 30 }); })).includes('나가기'));
  await hompy.screenshot({ path: shot('minihompy.png') });
  await hompy.close();

  // ---- 꾸미기
  const page = await openPage(chrome, server, { viewport: { width: 1280, height: 800 } });
  await stubYouTube(page);
  await loginPage(page, ids.deco);
  await enterPage(page, { name: 'deco' });
  await page.waitForFunction(() => zone === 1 && decorItems.length > 0, null, { timeout: 4000 });

  t.check('the map starts folded', await page.isVisible('#map-win') && !(await page.isVisible('#minimap')));
  await page.click('#map-head');
  t.check('the map unfolds from its title bar', await page.isVisible('#minimap'));
  await page.click('#map-head');

  // 염색: 가구 탭에서 고르고 염색 창에서 색을 정한다
  await page.keyboard.press('KeyH');
  await page.click(`#decor-list button[data-kind="${LONG_TABLE}"]`);
  await page.click('#decor-dye');
  await page.waitForSelector('#dye:not([hidden])', { timeout: 2000 });
  await page.click('#dye-swatches button:nth-child(6)');
  await page.fill('#dye-sat', '150');
  await page.dispatchEvent('#dye-sat', 'input');
  await wait(100);
  await page.screenshot({ path: shot('dye_window.png') });
  await page.click('#dye-apply');
  await page.waitForFunction(() => myDyed.length === 1, null, { timeout: 2000 });
  t.check('the dyed piece gets its own cell with a mark', (await page.$$('#decor-list .furn-cell.dyed')).length === 1);
  await page.click('#decor-list .furn-cell.dyed');
  const spot = await page.evaluate(() => { const [cx, cy] = camera(innerWidth, innerHeight); return [420 - cx, 268 - cy]; });
  await page.mouse.click(...spot);
  await page.waitForFunction(() => decorItems.some((d) => d.tint), null, { timeout: 2000 });
  t.check('the dyed piece is drawn in its colour', await page.evaluate(() => {
    const d = decorItems.find((x) => x.tint);
    const sprite = tintedSprite(d.info.k, d.tint, 0);
    const c = sprite.canvas.getContext('2d').getImageData(0, 0, sprite.canvas.width, sprite.canvas.height).data;
    let blue = 0, total = 0;
    for (let i = 0; i < c.length; i += 4) if (c[i + 3] > 200) { total++; if (c[i + 2] > c[i] + 30) blue++; }
    return total > 0 && blue / total > 0.4;
  }));
  await page.keyboard.press('Escape');

  // 바닥재
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="floor"]');
  t.check('the floor tab hides the furniture list', await page.isVisible('#floor-list') && !(await page.isVisible('#furn-list')));
  await page.click('#floor-list .floor-cell:nth-child(5) button');
  await page.waitForFunction(() => roomFloor === 4, null, { timeout: 2000 });
  t.check('the floor changes', (await page.textContent('#floor-list .floor-cell:nth-child(5) button')) === '사용 중');

  // 상점과 레코드판은 제목 줄을 끌어 옮긴다
  const shopBefore = await page.locator('#furn-shop').boundingBox();
  await page.mouse.move(shopBefore.x + 60, shopBefore.y + 10);
  await page.mouse.down();
  await page.mouse.move(shopBefore.x - 140, shopBefore.y + 70, { steps: 5 });
  await page.mouse.up();
  const shopAfter = await page.locator('#furn-shop').boundingBox();
  t.check('the shop window moves', Math.abs(shopAfter.x - (shopBefore.x - 200)) < 3 && Math.abs(shopAfter.y - (shopBefore.y + 60)) < 3, JSON.stringify([shopBefore, shopAfter]));
  await page.click('#furn-close');
  await page.click('#shop-open');
  const shopAgain = await page.locator('#furn-shop').boundingBox();
  t.check('the shop reopens where it was left', Math.abs(shopAgain.x - shopAfter.x) < 3, JSON.stringify([shopAfter, shopAgain]));
  await page.click('#furn-close');
  await page.screenshot({ path: shot('floor_and_dye.png') });

  // 도트 광고판
  await page.evaluate(() => ws.send('board 1 도트 광고판'));
  await page.keyboard.press('KeyI');
  await page.click('#bag-tab-items');
  await page.check('input[name="board-style"][value="1"]', { force: true });
  await page.waitForFunction(() => boards.get(myId)?.style === 1, null, { timeout: 2000 });
  t.check('the board can switch to the pixel style', true);

  // 펫: 상점의 펫 탭에서 데려오면 주인을 따라 걷는다
  await page.keyboard.press('Escape');
  await page.click('#shop-open');
  await page.click('#shop-tabs [data-tab="pets"]');
  t.check('the shop has a pet tab', (await page.$$('#pet-list .pet-cell')).length >= 8 && !(await page.isVisible('#furn-list')));
  await page.click('#pet-list .pet-cell:nth-child(2) button');
  await page.waitForFunction(() => myPet === 1 && petFollowers.has(myId), null, { timeout: 3000 });
  await page.click('#furn-close');
  const before = await page.evaluate(() => { const f = petFollowers.get(myId); return { x: f.x, y: f.y }; });
  await page.keyboard.down('KeyD');
  await wait(600);
  await page.keyboard.up('KeyD');
  await wait(500);
  const after = await page.evaluate(() => { const f = petFollowers.get(myId); return { x: f.x, y: f.y, mx: me.x }; });
  t.check('the pet follows its owner', after.x > before.x + 40 && Math.abs(after.x - after.mx) < 60, JSON.stringify([before, after]));
  await page.screenshot({ path: shot('pet_follow.png') });
  await page.keyboard.press('KeyI');
  await page.click('#bag-tab-pets');
  t.check('the bag lists my pets', (await page.$$('#bag-pet-list .furn-cell')).length === 1);
  await page.keyboard.press('Escape');

  // 채팅 스킨
  await page.click('#chat-skin');
  await page.click('#chat-skins button[data-skin="terminal"]');
  t.check('a chat skin can be picked and the windows follow', await page.evaluate(() => document.getElementById('chat').classList.contains('skin-terminal') && document.documentElement.dataset.uiTheme === 'terminal'));
  await page.reload();
  t.check('the skin is remembered', await page.evaluate(() => document.getElementById('chat').classList.contains('skin-terminal') && document.getElementById('bag').dataset.uiTheme === 'terminal'));
  t.check('the character rugs draw with tufted texture', await page.evaluate(() => ['rug_cat_black', 'rug_cat_stand', 'rug_bunny', 'rug_long_cat', 'rug_puppy', 'rug_8ball', 'rug_cloud', 'rug_heart'].every((k) => {
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 200;
    drawOn(c.getContext('2d'), () => FURNITURE[k]({ k, x: 180, y: 100 }, 0, 0));
    const data = c.getContext('2d').getImageData(0, 0, 360, 200).data;
    let solid = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 200) solid++;
    return solid > 4000;
  })));
  // 염색한 가구도 움직이는 부분(레코드 음표, 불꽃, 물고기, 시계 바늘, TV 화면)은 계속 움직인다
  const moving = await page.evaluate(() => {
    const realTrack = jazzTrack;
    jazzTrack = () => ({ v: 'x', title: 'x' });   // 레코드가 돌고 있는 것처럼
    tvState = { paused: false };
    const frame = (k, now, tint) => {
      const c = document.createElement('canvas');
      c.width = 360;
      c.height = 320;
      drawOn(c.getContext('2d'), () => drawFurniturePiece({ k, x: 180, y: 250, decor: tint ? { tint, scale: 100 } : null }, now, 0));
      return c.getContext('2d').getImageData(0, 0, 360, 320).data;
    };
    const changed = (k, tint) => {
      const a = frame(k, 1000, tint), b = frame(k, 2300, tint);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 3] !== b[i + 3]) n++;
      return n;
    };
    const out = Object.fromEntries(['record_player', 'fireplace', 'aquarium', 'dining_table', 'tv'].map((k) => [k, [changed(k, ''), changed(k, '3f5fc8-110-100')]]));
    jazzTrack = realTrack;
    tvState = null;
    return out;
  });
  t.check('dyed furniture keeps its animation', Object.values(moving).every(([plain, dyed]) => plain > 20 && dyed > 20), JSON.stringify(moving));
  t.check('no script errors', page.problems.length === 0, page.problems.join(' | '));
  await chrome.close();
  await server.stop();
}

export default async function run(t) {
  await Promise.all([protocol(t), browser(t), upgrade(t)]);
}
