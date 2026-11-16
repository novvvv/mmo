// 다시 접속할 때의 자리: 침대에 누워 있다 나갔는데 그새 침대 앞이 가구로 막혔어도(재접속, 서버 재시작 모두) 마을 광장이 아니라 그 집의 가까운 빈 곳에 선다.
import { Bot, serverWithAccounts, startServer, wait } from '../lib.mjs';

const HEYEON = 9, BOOKSHELF = 16, LINEN_BED = 64;   // 헤연 집에 처음부터 놓인 침대의 배치 번호

async function lieThenBlock(t, restart) {
  const { server, ids } = await serverWithAccounts({ a: [HEYEON, 545, 168, { f16: 1 }] });
  let a = await Bot.enter(server, 'a', { id: ids.a });
  await wait(100);
  const bed = a.lastEvent('decor')?.p?.find((d) => d[0] === LINEN_BED);
  a.send('use sit');
  await a.until(() => a.others.find((p) => p.id === a.id)?.s > 0, 1500);
  a.send(`decor place ${BOOKSHELF} 560 192`);   // 누운 채로 침대 앞을 막는다
  await a.until(() => a.lastEvent('decor')?.p?.some((d) => d[1] === BOOKSHELF && d[3] === 192), 1500);
  let srv = server;
  if (restart) {
    await server.stop();
    srv = await startServer({ dataDir: server.dataDir });
  } else {
    a.close();
    await wait(400);
  }
  a = await Bot.enter(srv, 'a', { id: ids.a });
  const z = a.lastEvent('zone');
  const label = restart ? 'after a server restart' : 'after logging in again';
  t.check(`lying in a bed whose front got blocked, ${label} you stay in the house`, z?.z === HEYEON, JSON.stringify(z));
  t.check(`  ...right by the bed (${restart ? 'restart' : 'relogin'})`, z && bed && Math.hypot(z.x - bed[2], z.y - (bed[3] + 22)) < 80, JSON.stringify({ z, bed: bed?.slice(0, 4) }));
  a.close();
  await srv.stop();
}

export default async function run(t) {
  await Promise.all([lieThenBlock(t, false), lieThenBlock(t, true)]);
}
