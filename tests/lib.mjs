// 테스트 공용 도구: 시험용 서버 실행, 프로토콜로 접속하는 봇, 실제 Chrome 조작.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHOTS = path.join(ROOT, 'tests', '.screenshots');
mkdirSync(SHOTS, { recursive: true });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 마을 지도의 자주 쓰는 자리 (1440×1520). 다리 가운데, 북쪽 강가 앞 줄, 광장
export const BRIDGE_X = 720;
export const NORTH_FIELD_Y = 670;
export const PLAZA = [820, 620];

let nextPort = 18200 + (process.pid % 4000) * 5;  // 여러 실행이 겹쳐도 포트가 부딪히지 않게
let botCounter = 0;

// 테스트가 중간에 멈춰도 시험용 서버가 남지 않게 한다.
const servers = new Set();
process.on('exit', () => { for (const child of servers) child.kill('SIGKILL'); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

export const uniqueId = (prefix = 'bot') => `${prefix}${Date.now().toString(36)}${(botCounter++).toString(36)}`;

function waitForPort(port) {
  return new Promise((resolve, reject) => {
    const end = Date.now() + 8000;
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > end) reject(new Error(`server did not open port ${port}`));
        else setTimeout(attempt, 30);
      });
    };
    attempt();
  });
}

// 비밀번호 해시 반복을 줄이고 가입 제한을 풀어 빠르게 시험한다. 필요하면 env 로 덮어쓴다.
// port 를 주면 그 포트로 연다 (끊긴 화면이 같은 주소로 다시 잇는지 볼 때 서버를 같은 자리에서 다시 켠다)
// binary 를 주면 그 서버를 띄운다 (저장소 루트에서 본 경로, 기본은 이 게임 서버)
export async function startServer({ env = {}, dataDir, port: fixedPort, binary = 'server/mmo_server' } = {}) {
  const port = fixedPort ?? nextPort++;
  const dir = dataDir ?? mkdtempSync(path.join(tmpdir(), 'mmo-test-'));
  const child = spawn(path.join(ROOT, binary), [String(port), path.join(ROOT, 'client'), dir], {
    env: {
      ...process.env,
      MMO_AUTH_ITERATIONS: '1000',
      MMO_SIGNUP_LIMIT: '100000',
      MMO_AUTH_PER_IP: '100000',
      MMO_MAX_CONN_PER_IP: '100000',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  servers.add(child);
  const exited = new Promise((resolve) => child.once('exit', () => { servers.delete(child); resolve(); }));
  await waitForPort(port);
  return {
    port,
    pid: child.pid,
    dataDir: dir,
    url: `http://localhost:${port}/`,
    ws: `ws://localhost:${port}/ws`,
    // 종료 신호에 10초 안에 끝나지 않으면 경고를 남기고 강제로 끈다 (시험이 끝없이 멈추지 않게)
    async stop(signal = 'SIGTERM') {
      child.kill(signal);
      const slow = await Promise.race([exited.then(() => false), wait(10000).then(() => true)]);
      if (slow) {
        console.error(`경고: 포트 ${port} 서버가 ${signal} 뒤 10초 안에 끝나지 않아 강제로 끕니다 (데이터: ${dir})`);
        child.kill('SIGKILL');
        await exited;
      }
    },
  };
}

export class Bot {
  // ip 를 주면 프록시가 보낸 것처럼 X-Forwarded-For 로 접속한다 (localhost 는 프록시로 신뢰된다).
  static async connect(server, { ip } = {}) {
    const b = new Bot();
    b.server = server;
    b.events = [];
    b.me = null;
    b.others = [];
    b.online = 0;
    b.map = null;
    b.cats = null;
    b.catSamples = [];
    b.time = null;
    b.zone = 0;
    b.closed = false;
    b.history = [];
    b.stateCount = 0;
    b.ws = ip ? new WebSocket(server.ws, { headers: { 'X-Forwarded-For': ip } }) : new WebSocket(server.ws);
    b.ws.onmessage = (ev) => b.receive(JSON.parse(ev.data));
    b.ws.onclose = () => { b.closed = true; };
    await new Promise((resolve, reject) => {
      b.ws.onopen = resolve;
      b.ws.onerror = () => reject(new Error('websocket failed'));
    });
    return b;
  }

  receive(m) {
    switch (m.t) {
      case 'welcome': this.id = m.id; this.welcome = m; break;
      case 'map': this.map = m; break;
      case 'zone': this.zone = m.z; this.events.push(m); break;
      case 'time': this.time = { ...m, at: Date.now() }; break;
      case 'cats': this.cats = m.p; this.catSamples.push({ at: Date.now(), p: m.p }); break;
      case 'slimes': this.slimes = m.p; break;
      case 'drops': this.drops = m.p; break;
      case 'state': {
        this.stateCount++;
        this.online = m.on;
        this.others = m.p;
        const me = m.p.find((p) => p.id === this.id);
        if (me) {
          this.me = me;
          this.history.push(me);
          if (this.history.length > 400) this.history.shift();
        }
        break;
      }
      default: this.events.push(m);
    }
  }

  send(s) { this.ws.send(s); }
  close() { this.ws.close(); }

  async until(fn, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await wait(5);
    }
    return false;
  }

  lastEvent(type) {
    return this.events.filter((e) => e.t === type).at(-1);
  }

  async login(id, password = 'test-password') {
    const before = this.events.length;
    this.send(`login ${id} ${password}`);
    await this.until(() => this.events.slice(before).some((e) => e.t === 'auth'), 10000);
    return this.events.slice(before).find((e) => e.t === 'auth');
  }

  async join({ hue = 120, arms = 1, legs = 1, limb = 0, nick = 'bot' } = {}) {
    this.send(`join ${hue} ${arms} ${legs} ${limb} ${nick}`);
    await this.until(() => this.me && this.map && this.welcome, 5000);
    return this;
  }

  // 접속 → 로그인 → 입장까지 한 번에
  static async enter(server, nick = 'bot', options = {}) {
    const b = await Bot.connect(server);
    b.accountId = options.id ?? uniqueId();
    const auth = await b.login(b.accountId, options.password);
    if (!auth?.ok) throw new Error(`login failed: ${JSON.stringify(auth)}`);
    await b.join({ nick, ...options });
    return b;
  }

  top(x) { return lerp(this.map.top, this.map.step, x); }
  bot(x) { return lerp(this.map.bot, this.map.step, x); }

  furniture(kind, zone = 0) { return this.map.furn.filter((f) => f.k === kind && f.z === zone); }
  seatIndexAt(x, y, zone = 0) {
    return this.map.seats.findIndex((s) => s.z === zone && Math.abs(s.x - x) < 0.2 && Math.abs(s.y - y) < 0.2);
  }

  // 벽이나 가구에 걸리면 옆으로 잠깐 비켜서 다시 간다.
  async walkTo(tx, ty, tol = 12, timeout = 20000) {
    const end = Date.now() + timeout;
    let last = -1, lastX = this.me.x, lastY = this.me.y, movedAt = Date.now(), side = 0, sideUntil = 0;
    while (Date.now() < end) {
      const dx = tx - this.me.x, dy = ty - this.me.y;
      if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) break;
      if (Math.hypot(this.me.x - lastX, this.me.y - lastY) > 1) {
        lastX = this.me.x;
        lastY = this.me.y;
        movedAt = Date.now();
      } else if (Date.now() - movedAt > 300) {
        side = Math.abs(dx) > Math.abs(dy) ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.5 ? 4 : 8);
        sideUntil = Date.now() + 350;
        movedAt = Date.now();
      }
      let mask = 0;
      if (Date.now() < sideUntil) {
        mask = side;
      } else {
        if (dy < -tol) mask |= 1;
        if (dy > tol) mask |= 2;
        if (dx < -tol) mask |= 4;
        if (dx > tol) mask |= 8;
      }
      if (mask !== last) {
        this.send('in ' + mask);
        last = mask;
      }
      await wait(10);
    }
    this.send('in 0');
    await wait(120);
  }

  // 북쪽 강가 앞(y=670, 광장 의자 줄 바로 아래)으로 나온 뒤 x 로 이동
  async toNorthField(x) {
    await this.walkTo(this.me.x, NORTH_FIELD_Y, 14);
    await this.walkTo(x, NORTH_FIELD_Y, 14);
  }

  // 다리를 건너 남쪽 강가로
  async crossToSouth() {
    await this.toNorthField(BRIDGE_X);
    await this.walkTo(BRIDGE_X, this.top(BRIDGE_X) - 40, 8);
    this.send('in 2');
    await this.until(() => this.me.y > this.bot(BRIDGE_X) + this.map.margin + 20, 5000);
    this.send('in 0');
    await wait(120);
  }
}

// 걸어가는 시간을 줄이려고 계정 파일을 고쳐 원하는 곳에서 시작한다. places: { 이름: [구역, x, y, { 추가 항목 }] }
export async function serverWithAccounts(places, { env = {} } = {}) {
  const first = await startServer({ env });
  const ids = {};
  for (const name of Object.keys(places)) {
    ids[name] = uniqueId(name);
    const bot = await Bot.enter(first, name, { id: ids[name] });
    bot.close();
  }
  await wait(200);
  await first.stop();
  for (const [name, [zone, x, y, extra = {}]] of Object.entries(places)) {
    const file = path.join(first.dataDir, `${Buffer.from(ids[name]).toString('hex')}.acc`);
    let edited = readFileSync(file, 'utf8');
    for (const [key, value] of Object.entries({ zone, x, y, ...extra })) edited = edited.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
    writeFileSync(file, edited);
  }
  return { server: await startServer({ dataDir: first.dataDir, env }), ids };
}

function lerp(table, step, x) {
  const pos = Math.max(0, Math.min(x / step, table.length - 1));
  const i = Math.min(Math.floor(pos), table.length - 2);
  return table[i] + (table[i + 1] - table[i]) * (pos - i);
}

// ------------------------------------------------------------ 실제 Chrome

// Playwright 는 기본으로 스크롤바를 숨긴다. 스크롤바 모양을 검사할 때만 realScrollbars 를 켠다.
export async function launchBrowser({ realScrollbars = false } = {}) {
  return chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: realScrollbars ? ['--hide-scrollbars'] : [] });
}

// Chrome 이 가끔 탭의 렌더러 프로세스를 띄우지 못하면 newPage 가 끝없이 기다린다 (테스트 코드와 상관없는 브라우저 쪽 문제).
// 그때 스위트 전체가 멈추지 않도록 시간 제한을 두고 분명한 오류로 끝낸다.
function inTime(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: no answer in ${ms / 1000}s (Chrome did not start a tab)`)), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

export async function openPage(browser, server, { viewport = { width: 1100, height: 720 }, scale = 1 } = {}) {
  const context = await inTime(browser.newContext({ viewport, deviceScaleFactor: scale }), 20000, 'newContext');
  const page = await inTime(context.newPage(), 20000, 'newPage');
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(e.message));
  page.on('dialog', (d) => { page.problems.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto(server.url);
  return page;
}

export async function loginPage(page, id, password = 'test-password') {
  await page.fill('#auth-id', id);
  await page.fill('#auth-pw', password);
  await page.press('#auth-pw', 'Enter');
  await page.waitForSelector('#charselect:not([hidden])', { timeout: 10000 });
}

export async function enterPage(page, { arms, legs, limbColor, name } = {}) {
  for (const [key, value] of [['arms', arms], ['legs', legs], ['limbColor', limbColor]]) {
    if (value !== undefined) await page.check(`input[name="${key}"][value="${value}"]`, { force: true });
  }
  if (name) await page.fill('#char-name', name);
  await page.click('#char-form button[type="submit"]');
  await page.waitForFunction(() => terrain && myId !== null && entities.get(myId) && me, null, { timeout: 10000 });
}

export async function enterGame(browser, server, id, options = {}) {
  const page = await openPage(browser, server, options);
  await loginPage(page, id);
  await enterPage(page, { name: options.name ?? id.slice(0, 12), ...options.look });
  return page;
}

export const pageSelf = (page) => page.evaluate(() => {
  const e = entities.get(myId);
  return { x: me.x, y: me.y, seat: e.seat, fish: e.fish, sx: e.toX, sy: e.toY, bx: e.bx, by: e.by, zone };
});

// 유튜브 대신 쓰는 가짜 플레이어. 호출을 window.__yt 에 남긴다.
export async function stubYouTube(page) {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `
      window.__yt = { players: [] };
      window.YT = {
        PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
        Player: class {
          constructor(mount, options) {
            this.options = options;
            this.video = options.videoId;
            this.time = options.playerVars.start;
            this.state = -1;
            this.volume = null;
            this.muted = false;
            this.calls = [];
            this.destroyed = false;
            this.frame = document.createElement('iframe');
            mount.replaceWith(this.frame);
            window.__yt.players.push(this);
            setTimeout(() => options.events.onReady({ target: this }), 0);
          }
          setVolume(v) { this.volume = v; }
          mute() { this.muted = true; }
          unMute() { this.muted = false; }
          getPlayerState() { return this.state; }
          getCurrentTime() { return this.time; }
          getDuration() { return 600; }
          playVideo() { this.calls.push('play'); this.state = 1; }
          pauseVideo() { this.calls.push('pause'); this.state = 2; }
          seekTo(t) { this.calls.push('seek'); this.time = t; }
          loadVideoById(a) { this.calls.push('load'); this.video = a.videoId; this.time = a.startSeconds; this.state = 1; }
          destroy() { this.destroyed = true; this.frame.remove(); }
        },
      };
      window.onYouTubeIframeAPIReady();
    `,
  }));
}

export const pageHint = (page) => page.evaluate(() => actionHint({ ...entities.get(myId), x: me.x, y: me.y }));

export async function pageWalkTo(page, tx, ty, tol = 10, timeout = 20000) {
  const end = Date.now() + timeout;
  const down = new Set();
  const key = async (code, on) => {
    if (on && !down.has(code)) { down.add(code); await page.keyboard.down(code); }
    if (!on && down.has(code)) { down.delete(code); await page.keyboard.up(code); }
  };
  let lastX = null, lastY = null, movedAt = Date.now(), sideKey = null, sideUntil = 0;
  while (Date.now() < end) {
    const { x, y } = await pageSelf(page);
    const dx = tx - x, dy = ty - y;
    if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) break;
    if (lastX === null || Math.hypot(x - lastX, y - lastY) > 1) {
      lastX = x;
      lastY = y;
      movedAt = Date.now();
    } else if (Date.now() - movedAt > 300) {
      sideKey = Math.abs(dx) > Math.abs(dy) ? (Math.random() < 0.5 ? 'KeyW' : 'KeyS') : (Math.random() < 0.5 ? 'KeyA' : 'KeyD');
      sideUntil = Date.now() + 350;
      movedAt = Date.now();
    }
    if (Date.now() < sideUntil) {
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await key(code, code === sideKey);
    } else {
      await key('KeyD', dx > tol);
      await key('KeyA', dx < -tol);
      await key('KeyS', dy > tol);
      await key('KeyW', dy < -tol);
    }
    await wait(12);
  }
  for (const code of [...down]) await key(code, false);
  await wait(300);
}
