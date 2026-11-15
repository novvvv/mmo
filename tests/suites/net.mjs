// 소켓 서버 방어: 이어 붙인 HTTP 요청, 멈춘 연결, IP당 연결 수, ping
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { Bot, startServer, uniqueId, wait } from '../lib.mjs';

const rssKb = (pid) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)]).toString().trim());

function rawSocket(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    const state = { socket, data: '', closed: false };
    socket.on('data', (chunk) => { state.data += chunk.toString('latin1'); });
    socket.on('close', () => { state.closed = true; });
    socket.on('error', () => { state.closed = true; });
    socket.once('connect', () => resolve(state));
  });
}

const HANDSHAKE = 'GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
  + 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n';

export default async function run(t) {
  const server = await startServer();

  // ---- 이어 붙인 요청: 연결당 응답은 하나뿐이다
  const piped = await rawSocket(server.port);
  piped.socket.write('GET /index.html HTTP/1.1\r\nHost: x\r\n\r\n'.repeat(50));
  await wait(400);
  const responses = (piped.data.match(/HTTP\/1\.1 200/g) || []).length;
  t.check('pipelined requests get one response', responses === 1, responses);
  t.check('connection closes after the response', piped.closed);

  // ---- 응답을 읽지 않고 요청만 쏟아부어도 메모리가 늘지 않는다
  const before = rssKb(server.pid);
  const flooders = [];
  for (let i = 0; i < 8; i++) {
    const flood = await rawSocket(server.port);
    flood.socket.pause();
    flood.socket.write('GET /config.js HTTP/1.1\r\nHost: x\r\n\r\n'.repeat(3000));
    flooders.push(flood);
  }
  await wait(800);
  const grown = rssKb(server.pid) - before;
  t.check('request flood does not grow memory', grown < 16 * 1024, `${Math.round(grown / 1024)}MB`);
  flooders.forEach((f) => f.socket.destroy());
  const page = await fetch(server.url);
  t.check('server still serves pages after the flood', page.status === 200, page.status);

  // ---- 멈춘 연결 정리와 ping (같은 대기 시간에 함께 확인)
  const stalledHttp = await rawSocket(server.port);
  stalledHttp.socket.write('GET / HT');
  const silentWs = await rawSocket(server.port);
  silentWs.socket.write(HANDSHAKE);
  await wait(200);
  t.check('raw websocket upgraded', silentWs.data.includes('101 Switching'), silentWs.data.slice(0, 40));
  const idlePlayer = await Bot.enter(server, '가만히');
  const idleStart = Date.now();

  await wait(12000);
  t.check('half-sent HTTP request is dropped', stalledHttp.closed);
  t.check('quiet websocket is kept before the idle limit', !silentWs.closed);

  await wait(Math.max(0, 66000 - (Date.now() - idleStart)));
  t.check('websocket that ignores ping is dropped', silentWs.closed);
  t.check('idle player stays connected past the limit', !idlePlayer.closed && idlePlayer.ws.readyState === WebSocket.OPEN);
  const statesBefore = idlePlayer.stateCount;
  await wait(200);
  t.check('idle player still gets state updates', idlePlayer.stateCount > statesBefore);
  idlePlayer.close();
  await server.stop();

  // ---- IP당 연결 수
  const limited = await startServer({ env: { MMO_MAX_CONN_PER_IP: '3' } });
  const held = [];
  for (let i = 0; i < 3; i++) held.push(await Bot.connect(limited, { ip: '203.0.113.5' }));
  let refused = false;
  try {
    await Bot.connect(limited, { ip: '203.0.113.5' });
  } catch {
    refused = true;
  }
  t.check('connections per IP are limited', refused);
  const otherIp = await Bot.connect(limited, { ip: '203.0.113.6' });
  t.check('another IP can still connect', otherIp.ws.readyState === WebSocket.OPEN);
  held[0].close();
  await wait(200);
  const again = await Bot.connect(limited, { ip: '203.0.113.5' });
  t.check('a closed connection frees its slot', again.ws.readyState === WebSocket.OPEN);
  held.slice(1).forEach((b) => b.close());
  again.close();
  otherIp.close();
  await limited.stop();

  // ---- IP당 동시 로그인 수: 한 곳에서 몰아쳐도 다른 사람은 로그인할 수 있다
  const throttled = await startServer({ env: { MMO_AUTH_PER_IP: '1', MMO_AUTH_ITERATIONS: '600000' } });
  const [first, second, third] = await Promise.all([
    Bot.connect(throttled, { ip: '198.51.100.1' }),
    Bot.connect(throttled, { ip: '198.51.100.1' }),
    Bot.connect(throttled, { ip: '198.51.100.2' }),
  ]);
  const firstLogin = first.login(uniqueId('ipa'), 'password1');
  await wait(20);
  const secondResult = await second.login(uniqueId('ipb'), 'password1');
  t.check('second concurrent login from one IP is refused', secondResult?.ok === false && secondResult.m.includes('몰리고'), JSON.stringify(secondResult));
  const thirdResult = await third.login(uniqueId('ipc'), 'password1');
  t.check('another IP still logs in', thirdResult?.ok === true, JSON.stringify(thirdResult));
  t.check('the first login finishes', (await firstLogin)?.ok === true);
  [first, second, third].forEach((b) => b.close());
  await throttled.stop();
}
