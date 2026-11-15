// 오락기 게임. 별똥 슈팅과 벽돌깨기는 판을 돌리는 화면(1P, 혼자면 앉은 사람)에서 돌린다. 둘이 앉으면 한 판에
// 로켓·라켓이 둘이 되어 함께 하고, 그 화면이 판을 초당 15번 중계해 2P 와 구경꾼이 같은 판을 본다. 2P 는 자기 로켓·라켓의
// 자리와 쏘는지를 보내고, 받은 판 사이사이는 같은 규칙으로 미리 움직여 부드럽게 보여 준다.
// 지뢰찾기와 체스 판은 서버가 갖고 있어 여기서는 그리기만 한다. 화면은 240×320 논리 크기로 그리고, 창에서 두 배로 키운다.

const ARCADE_W = 240, ARCADE_H = 320;
const ARCADE_KINDS = { arcade_shooter: 0, arcade_bricks: 1, arcade_mines: 2, arcade_chess: 3 };
const ARCADE_TITLES = ['별똥 슈팅', '벽돌깨기', '지뢰찾기', '체스'];
const ARCADE_FONT = '"Galmuri11", monospace';
const ARCADE_PLAYER_COLORS = ['#ff8fc0', '#7fb8ff'];   // 1P 분홍, 2P 하늘

function arcadeRandom(seed) {   // mulberry32: 같은 씨앗이면 어느 화면에서나 같은 수열. 상태(a)를 중계한다
  const random = () => {
    random.a = (random.a + 0x6d2b79f5) >>> 0;
    let t = random.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.a = seed >>> 0;
  return random;
}

const arcadeRound = (v) => Math.round(v * 10) / 10;   // 중계할 때 소수점 한 자리로 줄인다
const arcadeClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function arcadeText(c, text, x, y, size, color, align = 'center') {
  c.font = `${size}px ${ARCADE_FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, x, y);
}

// 불꽃은 판의 수열을 쓰지 않는다 (보여 주기만 하는 화면에서 터져도 판이 어긋나지 않게)
function arcadeSparks(list, x, y, color, count, speed = 60) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random();
    const v = speed * (0.5 + Math.random());
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.35, color });
  }
}

function arcadeMoveSparks(list, dt) {
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  return list.filter((p) => p.life > 0);
}

function arcadeDrawSparks(c, list) {
  for (const p of list) {
    c.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    c.fillStyle = p.color;
    c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
  }
  c.globalAlpha = 1;
}

// 단계가 바뀔 때 가운데에 잠깐 뜨는 글씨
function arcadeBanner(c, title, sub, color) {
  c.fillStyle = 'rgba(0, 0, 0, 0.45)';
  c.fillRect(0, ARCADE_H / 2 - 26, ARCADE_W, 50);
  arcadeText(c, title, ARCADE_W / 2, ARCADE_H / 2 - 8, 18, color);
  if (sub) arcadeText(c, sub, ARCADE_W / 2, ARCADE_H / 2 + 12, 10, '#ffffff');
}

// ------------------------------------------------------------ 별똥 슈팅
// 고양이 귀 로켓으로 줄지어 내려오는 우주 슬라임을 쏜다. 슬라임은 대열에서 빠져나와 로켓을 향해 내리꽂고,
// 웨이브가 오를수록 빨라지고 여럿이 함께 내리꽂으며, 4웨이브부터 맨 윗줄은 두 번 맞혀야 터진다.

const SLIME_ROWS = [
  { body: '#b48cff', dark: '#7a52d6', points: 30 },
  { body: '#ff8fc0', dark: '#d65a92', points: 20 },
  { body: '#6fe0c8', dark: '#35a890', points: 10 },
  { body: '#6fe0c8', dark: '#35a890', points: 10 },
];
const SHOOTER_MODES = ['enter', 'form', 'dive', 'back'];

class ShooterGame {
  constructor(seed, players = 1) {
    this.random = arcadeRandom(seed);
    this.players = players;
    this.remote = false;   // 중계받아 보여 주기만 하는 화면: 쏘기와 맞기는 판을 돌리는 화면이 정한다
    this.score = 0;
    this.over = false;
    this.wave = 0;
    this.time = 0;
    this.ships = Array.from({ length: players }, (_, i) => ({
      x: players > 1 ? ARCADE_W / 2 + (i ? 36 : -36) : ARCADE_W / 2, y: ARCADE_H - 26, dead: 0, shield: 2, lives: 3, cool: 0, dx: 0,
    }));
    this.shots = [];
    this.bullets = [];
    this.sparks = [];
    this.stars = Array.from({ length: 46 }, () => ({ x: this.random() * ARCADE_W, y: this.random() * ARCADE_H, v: 12 + this.random() * 30 }));
    this.nextWave();
  }

  get units() { return this.ships; }
  get ship() { return this.ships[0]; }
  get lives() { return this.ships.reduce((n, s) => n + s.lives, 0); }
  get speed() { return Math.min(2.6, 1 + (this.wave - 1) * 0.15); }   // 웨이브마다 빨라진다

  nextWave() {
    this.wave++;
    this.enemies = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        this.enemies.push({ row, col, x: 0, y: -60 - row * 20, mode: 'enter', t: 0, fired: false, dir: 1, aim: 0, wob: this.random() * 6, hp: row === 0 && this.wave >= 4 ? 2 : 1, flash: 0 });
      }
    }
    this.entry = 1.4;
    this.diveTimer = 2.2;
    this.dropTimer = 1.5;
    this.banner = 1.8;
  }

  slot(e) {   // 대열 속 자리: 좌우로 천천히 흔들린다
    const sway = Math.sin(this.time * 0.9) * 18;
    return { x: ARCADE_W / 2 - 3.5 * 24 + e.col * 24 + sway, y: 48 + e.row * 21 };
  }

  // 이 화면의 키보드·마우스를 로켓 조작으로 바꾼다
  control(input, i) {
    const ship = this.ships[i];
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (ship && input.pointerX !== null && input.pressed) dx = arcadeClamp((input.pointerX - ship.x) / 10, -1, 1);
    return { dx, x: null, fire: input.fire || input.pressed };
  }

  dropPlayer(i) {   // 함께 하던 사람이 일어났다
    const ship = this.ships[i];
    if (ship) ship.lives = 0;
  }

  alive(ship) { return ship.lives > 0 && ship.dead <= 0; }

  hitShip(ship) {
    if (this.remote || !this.alive(ship) || ship.shield > 0 || this.over) return;
    arcadeSparks(this.sparks, ship.x, ship.y, '#ffd84d', 18);
    ship.lives--;
    ship.dead = 1.3;
    if (this.ships.every((s) => s.lives <= 0)) this.over = true;
  }

  flyShip(ship, i, control, dt) {
    if (ship.lives <= 0) return;
    if (ship.dead > 0) {   // 터진 자리에서 잠시 뒤 다시 나온다
      ship.dead -= dt;
      if (ship.dead <= 0) ship.shield = 2;
      return;
    }
    ship.shield = Math.max(0, ship.shield - dt);
    if (control) {
      if (control.x !== null && control.x !== undefined) ship.x += arcadeClamp(control.x - ship.x, -320 * dt, 320 * dt);   // 다른 화면이 움직이는 로켓
      else ship.x += control.dx * 150 * dt;
      ship.x = arcadeClamp(ship.x, 12, ARCADE_W - 12);
      ship.dx = control.dx || 0;
    }
    ship.cool -= dt;
    if (!this.remote && control?.fire && ship.cool <= 0 && this.shots.filter((s) => s.o === i).length < 3) {
      this.shots.push({ x: ship.x, y: ship.y - 12, o: i });
      ship.cool = 0.2;
    }
  }

  step(dt, controls = []) {
    this.time += dt;
    this.sparks = arcadeMoveSparks(this.sparks, dt);
    for (const s of this.stars) {
      s.y += s.v * dt * (this.over ? 1 : Math.min(2, this.speed));
      if (s.y > ARCADE_H) s.y -= ARCADE_H;
    }
    if (this.over) return;
    const speed = this.speed, together = this.players > 1 ? 0.75 : 1;   // 둘이면 더 자주 내리꽂는다
    this.banner = Math.max(0, this.banner - dt);
    this.ships.forEach((ship, i) => this.flyShip(ship, i, controls[i], dt));
    for (const s of this.shots) s.y -= 300 * dt;
    this.shots = this.shots.filter((s) => s.y > -10);

    // 슬라임: 들어오기, 대열, 내리꽂기, 돌아가기
    this.entry = Math.max(0, this.entry - dt);
    const alive = this.enemies.filter((e) => !e.dead);
    this.diveTimer -= dt;
    if (this.diveTimer <= 0 && this.entry <= 0) {
      const ready = alive.filter((e) => e.mode === 'form');
      const count = 1 + (this.wave >= 3 && this.random() < 0.45 ? 1 : 0) + (this.wave >= 6 && this.random() < 0.4 ? 1 : 0);
      for (let k = 0; k < count && ready.length; k++) {
        const e = ready.splice(Math.floor(this.random() * ready.length), 1)[0];
        e.mode = 'dive';
        e.t = 0;
        e.fired = false;
        e.dir = e.x < ARCADE_W / 2 ? 1 : -1;
        e.aim = this.players > 1 ? Math.floor(this.random() * this.players) : 0;   // 쫓아갈 로켓
      }
      this.diveTimer = Math.max(0.45, 2.2 / speed - alive.length * 0.01) * (0.7 + this.random() * 0.6) * together;
    }
    this.dropTimer -= dt;
    if (this.dropTimer <= 0 && this.entry <= 0) {   // 대열에서 가끔 떨어뜨리는 점액
      const shooters = alive.filter((e) => e.mode === 'form');
      if (shooters.length) {
        const e = shooters[Math.floor(this.random() * shooters.length)];
        this.bullets.push({ x: e.x, y: e.y + 6, vx: 0, vy: 90 * speed });
      }
      this.dropTimer = ((1.6 + this.random() * 1.4) / speed) * together;
    }
    for (const e of alive) {
      const home = this.slot(e);
      e.flash = Math.max(0, e.flash - dt);
      if (e.mode === 'enter') {
        const k = 1 - this.entry / 1.4;
        e.x = home.x;
        e.y = home.y - (1 - k) * (90 + e.row * 30);
        if (this.entry <= 0) e.mode = 'form';
      } else if (e.mode === 'form') {
        e.x = home.x;
        e.y = home.y;
      } else if (e.mode === 'dive') {
        e.t += dt;
        const chased = this.ships[e.aim] && this.alive(this.ships[e.aim]) ? this.ships[e.aim] : this.ships.find((s) => this.alive(s));
        const target = chased ? chased.x : ARCADE_W / 2;
        e.x += (Math.sign(target - e.x) * 60 + Math.sin(e.t * 5 + e.wob) * 70 * e.dir) * dt * speed;
        e.y += Math.min(250, (80 + this.wave * 6) * speed) * dt;
        if (!e.fired && e.y > 110 && e.y < 220 && this.random() < 0.02 * speed) {
          e.fired = true;
          const aim = arcadeClamp((target - e.x) * 0.6, -60, 60);
          this.bullets.push({ x: e.x, y: e.y + 6, vx: aim, vy: 120 * speed });
        }
        if (e.y > ARCADE_H + 14) {
          e.mode = 'back';
          e.y = -14;
        }
      } else if (e.mode === 'back') {
        e.x += (home.x - e.x) * Math.min(1, dt * 3);
        e.y += 90 * dt * Math.min(1.6, speed);
        if (e.y >= home.y) e.mode = 'form';
      }
      for (const s of this.shots) {   // 맞히기
        if (Math.abs(s.x - e.x) < 9 && Math.abs(s.y - e.y) < 9) {
          s.y = -100;
          const row = SLIME_ROWS[e.row];
          if (--e.hp > 0) {
            e.flash = 0.15;
            arcadeSparks(this.sparks, e.x, e.y, '#ffffff', 4);
            break;
          }
          e.dead = true;
          this.score += row.points * (e.mode === 'dive' ? 2 : 1);
          arcadeSparks(this.sparks, e.x, e.y, row.body, 10);
          break;
        }
      }
      if (e.dead || this.remote) continue;
      for (const ship of this.ships) {
        if (this.alive(ship) && Math.abs(e.x - ship.x) < 11 && Math.abs(e.y - ship.y) < 10) {
          e.dead = true;
          arcadeSparks(this.sparks, e.x, e.y, SLIME_ROWS[e.row].body, 10);
          this.hitShip(ship);
          break;
        }
      }
    }
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (this.remote) continue;
      for (const ship of this.ships) {
        if (this.alive(ship) && Math.abs(b.x - ship.x) < 7 && Math.abs(b.y - ship.y) < 8) {
          b.y = ARCADE_H + 100;
          this.hitShip(ship);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.y < ARCADE_H + 10);
    if (!this.enemies.some((e) => !e.dead) && !this.over) {
      this.score += 100 * this.wave;
      this.nextWave();
    }
  }

  save() {
    const r = arcadeRound;
    return {
      r: this.random.a, sc: this.score, ov: this.over ? 1 : 0, wv: this.wave, tm: r(this.time), bn: r(this.banner),
      en: r(this.entry), dv: r(this.diveTimer), dr: r(this.dropTimer),
      sh: this.ships.map((s) => [r(s.x), r(s.dead), r(s.shield), s.lives, r(s.cool), r(s.dx)]),
      s: this.shots.map((s) => [r(s.x), r(s.y), s.o]),
      b: this.bullets.map((b) => [r(b.x), r(b.y), r(b.vx), r(b.vy)]),
      e: this.enemies.map((e) => (e.dead ? 0 : [r(e.x), r(e.y), SHOOTER_MODES.indexOf(e.mode), r(e.t), e.fired ? 1 : 0, e.dir, r(e.wob), e.hp, e.aim])),
    };
  }

  // 판을 돌리는 화면이 보낸 판으로 바꾼다. mine 은 이 화면에서 움직이는 로켓 (자리는 이 화면의 것을 쓴다)
  load(d, mine = -1) {
    const newWave = d.wv !== this.wave;
    this.random.a = d.r >>> 0;
    this.score = d.sc;
    this.over = !!d.ov;
    this.wave = d.wv;
    this.time = d.tm;
    this.banner = d.bn;
    this.entry = d.en;
    this.diveTimer = d.dv;
    this.dropTimer = d.dr;
    d.sh.forEach((v, i) => {
      const ship = this.ships[i] || (this.ships[i] = { x: v[0], y: ARCADE_H - 26, dead: 0, shield: 0, lives: 0, cool: 0, dx: 0 });
      const was = this.alive(ship);
      if (i !== mine || ship.lives <= 0) ship.x = v[0];
      [, ship.dead, ship.shield, ship.lives, ship.cool, ship.dx] = v;
      if (was && ship.dead > 0) arcadeSparks(this.sparks, ship.x, ship.y, '#ffd84d', 18);   // 판을 돌리는 화면에서 맞았다
    });
    this.shots = d.s.map(([x, y, o]) => ({ x, y, o }));
    this.bullets = d.b.map(([x, y, vx, vy]) => ({ x, y, vx, vy }));
    d.e.forEach((v, i) => {
      const e = this.enemies[i] || (this.enemies[i] = { row: Math.floor(i / 8), col: i % 8, flash: 0 });
      if (!v) {
        if (!e.dead && !newWave) arcadeSparks(this.sparks, e.x, e.y, SLIME_ROWS[e.row].body, 10);
        e.dead = true;
        return;
      }
      e.dead = false;
      [e.x, e.y] = v;
      e.mode = SHOOTER_MODES[v[2]];
      [, , , e.t, , e.dir, e.wob, e.hp, e.aim] = v;
      e.fired = !!v[4];
    });
  }

  draw(c) {
    c.fillStyle = '#07081c';
    c.fillRect(0, 0, ARCADE_W, ARCADE_H);
    for (const s of this.stars) {
      c.fillStyle = s.v > 30 ? '#ffffff' : '#7d82b8';
      c.fillRect(Math.round(s.x), Math.round(s.y), 1, s.v > 30 ? 2 : 1);
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      drawSpaceSlime(c, e.x, e.y, e.flash > 0 ? { body: '#ffffff', dark: '#d8d8f0' } : SLIME_ROWS[e.row], this.time + e.wob);
      if (e.hp > 1) {   // 단단한 슬라임: 머리띠
        c.fillStyle = '#ffd84d';
        c.fillRect(Math.round(e.x) - 5, Math.round(e.y) - 6, 10, 2);
      }
    }
    c.fillStyle = '#9dff6a';
    for (const b of this.bullets) c.fillRect(Math.round(b.x) - 1.5, Math.round(b.y) - 3, 3, 6);
    for (const s of this.shots) {
      c.fillStyle = this.players > 1 ? (s.o ? '#bfe0ff' : '#ffd0e4') : '#fff7a8';
      c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 5, 2, 8);
    }
    arcadeDrawSparks(c, this.sparks);
    this.ships.forEach((ship, i) => {
      if (!this.alive(ship) || this.over || (ship.shield > 0 && Math.floor(this.time * 10) % 2)) return;
      drawCatRocket(c, ship.x, ship.y, this.time, 1, this.players > 1 ? ARCADE_PLAYER_COLORS[i] : ARCADE_PLAYER_COLORS[0]);
      if (this.players > 1) arcadeText(c, `${i + 1}P`, ship.x, ship.y - 18, 7, ARCADE_PLAYER_COLORS[i]);
    });
    arcadeText(c, `${this.score}`, 6, 10, 10, '#ffffff', 'left');
    arcadeText(c, `WAVE ${this.wave}`, ARCADE_W - 6, 10, 10, '#b48cff', 'right');
    this.ships.forEach((ship, i) => {
      for (let k = 0; k < ship.lives; k++) {
        const x = i === 0 ? 10 + k * 14 : ARCADE_W - 10 - k * 14;
        drawCatRocket(c, x, ARCADE_H - 8, 0, 0.5, this.players > 1 ? ARCADE_PLAYER_COLORS[i] : ARCADE_PLAYER_COLORS[0]);
      }
    });
    if (this.banner > 0 && !this.over) arcadeBanner(c, `WAVE ${this.wave}`, this.wave > 1 ? '슬라임이 더 빨라졌어요!' : '준비!', '#ffd84d');
  }
}

function drawSpaceSlime(c, x, y, look, t) {
  const squish = Math.sin(t * 6) * 0.8;
  c.fillStyle = look.dark;
  c.beginPath();
  c.ellipse(x, y + 1, 8 + squish, 7 - squish, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = look.body;
  c.beginPath();
  c.ellipse(x, y, 7 + squish, 6 - squish, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = look.dark;   // 더듬이
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x - 3, y - 5);
  c.lineTo(x - 5, y - 9);
  c.moveTo(x + 3, y - 5);
  c.lineTo(x + 5, y - 9);
  c.stroke();
  c.fillStyle = '#fff6a0';
  c.fillRect(x - 6, y - 10, 2, 2);
  c.fillRect(x + 4, y - 10, 2, 2);
  c.fillStyle = '#1b1530';
  c.fillRect(x - 3, y - 1, 2, 2);
  c.fillRect(x + 1, y - 1, 2, 2);
}

function drawCatRocket(c, x, y, t, s = 1, wing = '#ff8fc0') {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = Math.floor(t * 20) % 2 ? '#ffb347' : '#ff6a3d';   // 불꽃
  c.beginPath();
  c.moveTo(-3, 7);
  c.lineTo(0, 13);
  c.lineTo(3, 7);
  c.fill();
  c.fillStyle = '#f6f1ff';
  c.beginPath();
  c.moveTo(0, -10);
  c.quadraticCurveTo(7, -2, 6, 7);
  c.lineTo(-6, 7);
  c.quadraticCurveTo(-7, -2, 0, -10);
  c.fill();
  c.fillStyle = wing;   // 고양이 귀 날개
  c.beginPath();
  c.moveTo(-6, 0);
  c.lineTo(-11, 7);
  c.lineTo(-5, 6);
  c.moveTo(6, 0);
  c.lineTo(11, 7);
  c.lineTo(5, 6);
  c.fill();
  c.fillStyle = '#4fc3f7';
  c.fillRect(-2, -4, 4, 4);
  c.restore();
}

// ------------------------------------------------------------ 벽돌깨기
// 칠 때마다 공이 조금씩 빨라지고, 단계가 오르면 공은 더 빠르게, 라켓은 더 짧게, 단단한 벽돌은 더 많아진다.
// 둘이 하면 라켓 둘이 같은 줄에 서서 각자의 공을 띄우고, 어느 라켓으로든 받아칠 수 있다.

const BRICK_COLS = 10, BRICK_ROWS = 7, BRICK_W = 22, BRICK_H = 10, BRICK_GAP = 2, BRICK_TOP = 34;
const BRICK_LEFT = (ARCADE_W - (BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP)) / 2;
const BRICK_COLORS = ['#ff6b8a', '#ff9f5a', '#ffd84d', '#7fdc7a', '#4fc3f7', '#8a7dff', '#d58cff'];
const PADDLE_Y = ARCADE_H - 22;

class BricksGame {
  constructor(seed, players = 1) {
    this.random = arcadeRandom(seed);
    this.players = players;
    this.remote = false;
    this.score = 0;
    this.over = false;
    this.level = 0;
    this.time = 0;
    this.paddles = Array.from({ length: players }, (_, i) => ({ x: players > 1 ? (i ? 160 : 80) : ARCADE_W / 2, w: 44, lives: 3, dx: 0 }));
    this.balls = this.paddles.map(() => null);
    this.sparks = [];
    this.nextLevel();
  }

  get units() { return this.paddles; }
  get paddle() { return this.paddles[0]; }
  get ball() { return this.balls[0]; }
  get lives() { return this.paddles.reduce((n, p) => n + p.lives, 0); }

  nextLevel() {
    this.level++;
    this.bricks = [];
    const pattern = this.level === 1 ? 0 : Math.floor(this.random() * 4);
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const mirror = Math.min(col, BRICK_COLS - 1 - col);
        const keep = pattern === 0 ? true
          : pattern === 1 ? (row + col) % 2 === 0 || row < 2
          : pattern === 2 ? mirror >= row - 2
          : this.random() < 0.75;
        if (!keep) continue;
        const hard = this.level > 1 && (row === 0 || this.random() < 0.08 * this.level);
        this.bricks.push(this.brick(col, row, hard ? 2 : 1));
      }
    }
    const width = Math.max(30, 46 - this.level * 2);
    for (const p of this.paddles) p.w = width;
    this.speed = Math.min(250, 150 + this.level * 14);   // 단계마다 공이 빨라진다
    this.paddles.forEach((p, i) => { if (p.lives > 0) this.resetBall(i); });
    this.banner = 1.6;
  }

  brick(col, row, hits) {
    return { col, row, hits, x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP), y: BRICK_TOP + row * (BRICK_H + BRICK_GAP) };
  }

  resetBall(i) {
    this.balls[i] = { x: this.paddles[i].x, y: ARCADE_H - 28, vx: 0, vy: 0, held: 1.6, v: this.speed };
  }

  control(input, i) {
    const fire = input.fire || input.pressed;
    if (input.pointerX !== null) return { dx: 0, x: input.pointerX, fire };
    return { dx: (input.right ? 1 : 0) - (input.left ? 1 : 0), x: null, fire };
  }

  dropPlayer(i) {
    if (!this.paddles[i]) return;
    this.paddles[i].lives = 0;
    this.balls[i] = null;
    if (this.paddles.every((p) => p.lives <= 0)) this.over = true;
  }

  movePaddle(p, control, dt) {
    if (p.lives <= 0 || !control) return;
    if (control.x !== null && control.x !== undefined) p.x += arcadeClamp(control.x - p.x, -420 * dt, 420 * dt);
    else p.x += control.dx * 230 * dt;
    p.x = arcadeClamp(p.x, p.w / 2, ARCADE_W - p.w / 2);
    p.dx = control.dx || 0;
  }

  step(dt, controls = []) {
    this.time += dt;
    this.sparks = arcadeMoveSparks(this.sparks, dt);
    if (this.over) return;
    this.banner = Math.max(0, this.banner - dt);
    this.paddles.forEach((p, i) => this.movePaddle(p, controls[i], dt));
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (!ball) continue;
      if (ball.held > 0) {   // 공을 라켓 위에 올려 두고, 누르거나 잠시 뒤에 띄운다
        ball.x = this.paddles[i].x;
        ball.y = ARCADE_H - 28;
        if (this.remote) continue;   // 띄우는 것은 판을 돌리는 화면이 정한다
        ball.held -= dt;
        if (controls[i]?.fire || ball.held <= 0) {
          ball.held = 0;
          const a = (this.random() - 0.5) * 0.8;
          ball.vx = Math.sin(a) * ball.v;
          ball.vy = -Math.cos(a) * ball.v;
        }
        continue;
      }
      for (let k = 0; k < 4 && this.balls[i] === ball && !this.over; k++) this.moveBall(ball, i, dt / 4);
    }
  }

  moveBall(ball, owner, dt) {
    const r = 3.5;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.y > ARCADE_H + 8) {
      if (this.remote) {   // 놓쳤는지는 판을 돌리는 화면이 정할 때까지 화면 밖에 둔다
        ball.vx = ball.vy = 0;
        return;
      }
      const p = this.paddles[owner];
      p.lives--;
      if (p.lives > 0) this.resetBall(owner);
      else this.balls[owner] = null;
      if (this.paddles.every((q) => q.lives <= 0)) this.over = true;
      return;
    }
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > ARCADE_W - r) { ball.x = ARCADE_W - r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < 20 + r) { ball.y = 20 + r; ball.vy = Math.abs(ball.vy); }
    if (ball.vy > 0 && ball.y + r >= PADDLE_Y && ball.y + r <= PADDLE_Y + 8) {
      const p = this.paddles.find((q) => q.lives > 0 && Math.abs(ball.x - q.x) <= q.w / 2 + r);
      if (p) {
        const offset = arcadeClamp((ball.x - p.x) / (p.w / 2), -1, 1);
        ball.v = Math.min(this.speed * 1.7, ball.v * 1.03);   // 칠 때마다 조금씩 빨라진다
        const a = offset * 1.05;
        ball.vx = Math.sin(a) * ball.v;
        ball.vy = -Math.cos(a) * ball.v;
        ball.y = PADDLE_Y - r;
      }
    }
    for (const b of this.bricks) {
      if (ball.x + r < b.x || ball.x - r > b.x + BRICK_W || ball.y + r < b.y || ball.y - r > b.y + BRICK_H) continue;
      const overlapX = Math.min(ball.x + r - b.x, b.x + BRICK_W - (ball.x - r));
      const overlapY = Math.min(ball.y + r - b.y, b.y + BRICK_H - (ball.y - r));
      if (overlapX < overlapY) ball.vx = ball.x < b.x + BRICK_W / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      else ball.vy = ball.y < b.y + BRICK_H / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      b.hits--;
      if (b.hits <= 0) {
        b.gone = true;
        this.score += 10 + (BRICK_ROWS - b.row) * 2;
        arcadeSparks(this.sparks, b.x + BRICK_W / 2, b.y + BRICK_H / 2, BRICK_COLORS[b.row], 8, 50);
      } else {
        this.score += 5;
      }
      break;
    }
    this.bricks = this.bricks.filter((b) => !b.gone);
    if (!this.bricks.length) {
      this.score += 200 * this.level;
      this.nextLevel();
    }
  }

  save() {
    const r = arcadeRound;
    const cells = new Array(BRICK_COLS * BRICK_ROWS).fill('0');
    for (const b of this.bricks) cells[b.row * BRICK_COLS + b.col] = String(b.hits);
    return {
      r: this.random.a, sc: this.score, ov: this.over ? 1 : 0, lv: this.level, tm: r(this.time), bn: r(this.banner), sp: this.speed,
      p: this.paddles.map((p) => [r(p.x), p.w, p.lives, r(p.dx)]),
      b: this.balls.map((b) => (b ? [r(b.x), r(b.y), r(b.vx), r(b.vy), r(b.held), r(b.v)] : 0)),
      k: cells.join(''),
    };
  }

  load(d, mine = -1) {
    const newLevel = d.lv !== this.level;
    this.random.a = d.r >>> 0;
    this.score = d.sc;
    this.over = !!d.ov;
    this.level = d.lv;
    this.time = d.tm;
    this.banner = d.bn;
    this.speed = d.sp;
    d.p.forEach((v, i) => {
      const p = this.paddles[i] || (this.paddles[i] = { x: v[0], w: v[1], lives: 0, dx: 0 });
      if (i !== mine || p.lives <= 0) p.x = v[0];
      [, p.w, p.lives, p.dx] = v;
    });
    this.balls = d.b.map((v) => (v ? { x: v[0], y: v[1], vx: v[2], vy: v[3], held: v[4], v: v[5] } : null));
    const before = new Map(this.bricks.map((b) => [b.row * BRICK_COLS + b.col, b]));
    this.bricks = [];
    for (let i = 0; i < d.k.length; i++) {
      const hits = Number(d.k[i]);
      const old = before.get(i);
      if (hits > 0) this.bricks.push(this.brick(i % BRICK_COLS, Math.floor(i / BRICK_COLS), hits));
      else if (old && !newLevel) arcadeSparks(this.sparks, old.x + BRICK_W / 2, old.y + BRICK_H / 2, BRICK_COLORS[old.row], 8, 50);
    }
  }

  draw(c) {
    c.fillStyle = '#10161f';
    c.fillRect(0, 0, ARCADE_W, ARCADE_H);
    c.fillStyle = '#1b2533';
    c.fillRect(0, 20, ARCADE_W, 1);
    for (const b of this.bricks) {
      c.fillStyle = b.hits > 1 ? '#c9ccd6' : BRICK_COLORS[b.row];
      c.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      c.fillStyle = 'rgba(255, 255, 255, 0.35)';
      c.fillRect(b.x, b.y, BRICK_W, 2);
      c.fillStyle = 'rgba(0, 0, 0, 0.25)';
      c.fillRect(b.x, b.y + BRICK_H - 2, BRICK_W, 2);
    }
    arcadeDrawSparks(c, this.sparks);
    this.paddles.forEach((p, i) => {
      if (p.lives <= 0) return;
      c.fillStyle = '#f6f1ff';
      c.beginPath();
      c.roundRect(p.x - p.w / 2, PADDLE_Y, p.w, 6, 3);
      c.fill();
      c.fillStyle = this.players > 1 ? ARCADE_PLAYER_COLORS[i] : ARCADE_PLAYER_COLORS[0];
      c.fillRect(p.x - p.w / 2 + 3, PADDLE_Y + 2, p.w - 6, 2);
      if (this.players > 1) arcadeText(c, `${i + 1}P`, p.x, PADDLE_Y + 12, 7, ARCADE_PLAYER_COLORS[i]);
    });
    if (!this.over) {
      for (const ball of this.balls) {
        if (!ball || ball.y > ARCADE_H + 4) continue;
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(ball.x, ball.y, 3.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    arcadeText(c, `${this.score}`, 6, 10, 10, '#ffffff', 'left');
    arcadeText(c, `LEVEL ${this.level}`, ARCADE_W - 6, 10, 10, '#ffd84d', 'right');
    this.paddles.forEach((p, i) => {   // 남은 목숨: 혼자면 가운데, 둘이면 각자의 색으로 나란히
      c.fillStyle = this.players > 1 ? ARCADE_PLAYER_COLORS[i] : '#ff6b8a';
      for (let k = 0; k < p.lives; k++) {
        const x = this.players > 1 ? ARCADE_W / 2 + (i ? 12 + k * 9 : -12 - k * 9) : ARCADE_W / 2 - 10 + k * 10;
        c.beginPath();
        c.arc(x, 10, 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    const fastest = Math.max(0, ...this.balls.map((b) => (b && !b.held ? b.v : 0)));   // 공 빠르기
    if (fastest) {
      const k = arcadeClamp((fastest - 150) / 280, 0, 1);
      c.fillStyle = '#26303f';
      c.fillRect(6, 24, 40, 3);
      c.fillStyle = k > 0.66 ? '#ff6b8a' : k > 0.33 ? '#ffd84d' : '#7fdc7a';
      c.fillRect(6, 24, Math.max(2, 40 * k), 3);
    }
    if (this.banner > 0 && !this.over) arcadeBanner(c, `LEVEL ${this.level}`, this.level > 1 ? '공이 더 빨라졌어요!' : '준비!', '#ffd84d');
  }
}

// ------------------------------------------------------------ 지뢰찾기 판 (서버가 준 판을 그린다)

const MINE_NUMBER_COLORS = ['', '#2f6fe0', '#2e9a4a', '#e0453a', '#5a3fb8', '#a8442c', '#2a9a9a', '#23202a', '#7a7a80'];

function minesLayout(size) {
  const cell = Math.floor((ARCADE_W - 8) / size);
  const width = cell * size;
  return { cell, x: Math.floor((ARCADE_W - width) / 2), y: Math.floor((ARCADE_H - width) / 2) + 12 };
}

function drawMinesBoard(c, state, flags, hover) {
  c.fillStyle = '#c3c7cf';
  c.fillRect(0, 0, ARCADE_W, ARCADE_H);
  if (!state.b) return;
  const { cell, x: ox, y: oy } = minesLayout(state.size);
  for (let i = 0; i < state.b.length; i++) {
    const x = ox + (i % state.size) * cell, y = oy + Math.floor(i / state.size) * cell, ch = state.b[i];
    if (ch === '.') {
      c.fillStyle = i === hover ? '#e6e9ef' : '#d7dae2';
      c.fillRect(x, y, cell, cell);
      c.fillStyle = '#ffffff';
      c.fillRect(x, y, cell, 2);
      c.fillRect(x, y, 2, cell);
      c.fillStyle = '#8b909c';
      c.fillRect(x, y + cell - 2, cell, 2);
      c.fillRect(x + cell - 2, y, 2, cell);
      if (flags.has(i)) drawMineFlag(c, x + cell / 2, y + cell / 2, cell, '#e0453a');
      continue;
    }
    c.fillStyle = ch === 'x' ? '#ff6b6b' : '#eceef2';
    c.fillRect(x, y, cell, cell);
    c.strokeStyle = '#b3b8c2';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    if (ch >= '1' && ch <= '8') arcadeText(c, ch, x + cell / 2, y + cell / 2 + 1, Math.floor(cell * 0.7), MINE_NUMBER_COLORS[Number(ch)]);
    else if (ch === 'a' || ch === 'b') drawMineFlag(c, x + cell / 2, y + cell / 2, cell, ch === 'a' ? '#ff5d9e' : '#3c8de0');
    else if (ch === 'x' || ch === '*') {
      c.fillStyle = '#23202a';
      c.beginPath();
      c.arc(x + cell / 2, y + cell / 2, cell * 0.26, 0, Math.PI * 2);
      c.fill();
      c.fillRect(x + cell / 2 - 0.5, y + cell * 0.15, 1, cell * 0.7);
      c.fillRect(x + cell * 0.15, y + cell / 2 - 0.5, cell * 0.7, 1);
    }
  }
  if (!state.vs) {
    arcadeText(c, `STAGE ${state.st || 1}`, 8, 16, 11, '#2f5038', 'left');
    arcadeText(c, `지뢰 ${state.mc}`, ARCADE_W - 8, 16, 11, '#2f5038', 'right');
    if (state.nx) arcadeBanner(c, 'CLEAR!', `다음은 ${(state.st || 1) + 1}단계 · 판이 커지고 지뢰가 늘어나요`, '#ffd84d');
  }
}

function drawMineFlag(c, x, y, cell, color) {
  c.fillStyle = '#23202a';
  c.fillRect(x - 1, y - cell * 0.3, 2, cell * 0.6);
  c.fillRect(x - cell * 0.22, y + cell * 0.26, cell * 0.44, 2);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x + 1, y - cell * 0.32);
  c.lineTo(x + cell * 0.3, y - cell * 0.16);
  c.lineTo(x + 1, y);
  c.fill();
}

// 판을 누른 자리의 칸 번호. 판 밖이면 -1
function minesCellAt(state, lx, ly) {
  if (!state?.size) return -1;
  const { cell, x: ox, y: oy } = minesLayout(state.size);
  const col = Math.floor((lx - ox) / cell), row = Math.floor((ly - oy) / cell);
  return col >= 0 && row >= 0 && col < state.size && row < state.size ? row * state.size + col : -1;
}

// ------------------------------------------------------------ 체스
// 판은 서버의 64칸 문자열(0 이 a8, 63 이 h1, 백은 대문자)이다. 흑을 잡은 사람에게는 판을 뒤집어 흑이 아래에 오게 그린다.

const CHESS_BOARD = { x: 8, y: 44, cell: 28 };
const CHESS_LIGHT = '#f2e2c4', CHESS_DARK = '#b98a5e';
const CHESS_START = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';
const CHESS_SIDES = ['백', '흑'];
const CHESS_PROMOS = ['q', 'r', 'b', 'n'];

// 말마다 이름, 대략의 가치(폰 몇 개만큼인지), 움직이는 법과 쓰는 요령
const CHESS_INFO = {
  k: { name: '킹', value: '∞', move: '가로·세로·대각선 어느 쪽으로든 한 칸씩 움직여요.', tip: '킹이 잡힐 위기(체크)를 피할 수 없게 되면(체크메이트) 져요. 공격받는 칸으로는 갈 수 없어요.' },
  q: { name: '퀸', value: 9, move: '가로·세로·대각선으로 막히지 않는 데까지 몇 칸이든 가요.', tip: '가장 강한 말이에요. 너무 일찍 꺼내면 상대 말에 쫓겨 다니기 쉬워요.' },
  r: { name: '룩', value: 5, move: '가로·세로로 막히지 않는 데까지 몇 칸이든 가요.', tip: '폰이 없는 열린 줄에 두면 힘이 세져요. 캐슬링 때 킹과 함께 움직여요.' },
  b: { name: '비숍', value: 3, move: '대각선으로 막히지 않는 데까지 몇 칸이든 가요.', tip: '처음 선 칸과 같은 색 칸으로만 다녀요. 둘이 함께 있으면 더 든든해요.' },
  n: { name: '나이트', value: 3, move: 'L자(한쪽으로 두 칸 + 옆으로 한 칸)로 뛰어요.', tip: '다른 말을 뛰어넘을 수 있는 유일한 말이에요. 판 가운데에 있을 때 갈 곳이 많아요.' },
  p: { name: '폰', value: 1, move: '앞으로 한 칸 가요(처음 움직일 때는 두 칸도 돼요). 잡을 때만 앞 대각선 한 칸으로 가요.', tip: '뒤로는 못 가요. 끝 줄까지 가면 퀸 같은 다른 말로 바뀌어요(프로모션).' },
};

const chessSquareName = (sq) => `${'abcdefgh'[sq & 7]}${8 - (sq >> 3)}`;
const chessSquareOf = (name) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
const chessColorOf = (piece) => (piece === '.' ? -1 : piece === piece.toUpperCase() ? 0 : 1);

function chessSquareXY(sq, flip, L = CHESS_BOARD) {
  const r = sq >> 3, col = sq & 7;
  return [L.x + (flip ? 7 - col : col) * L.cell, L.y + (flip ? 7 - r : r) * L.cell];
}

function chessSquareAt(lx, ly, flip, L = CHESS_BOARD) {
  const col = Math.floor((lx - L.x) / L.cell), row = Math.floor((ly - L.y) / L.cell);
  if (col < 0 || row < 0 || col > 7 || row > 7) return -1;
  return (flip ? 7 - row : row) * 8 + (flip ? 7 - col : col);
}

// 그 말이 갈 수 있는 칸 (자기 킹이 위험해지는지와 캐슬링·앙파상은 보지 않는다). 상대 말과 설명서 그림에 쓴다
function chessPattern(board, sq) {
  const piece = board[sq];
  if (!piece || piece === '.') return [];
  const me = chessColorOf(piece), kind = piece.toLowerCase(), r = sq >> 3, col = sq & 7, out = [];
  const inside = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
  const add = (rr, cc) => {   // 갈 수 있으면 넣고, 계속 미끄러질 수 있는지 돌려준다
    if (!inside(rr, cc)) return false;
    const q = board[rr * 8 + cc];
    if (chessColorOf(q) === me) return false;
    out.push({ to: rr * 8 + cc, capture: q !== '.' });
    return q === '.';
  };
  if (kind === 'p') {
    const dir = me === 0 ? -1 : 1, home = me === 0 ? 6 : 1;
    if (inside(r + dir, col) && board[(r + dir) * 8 + col] === '.') {
      out.push({ to: (r + dir) * 8 + col, capture: false });
      if (r === home && board[(r + 2 * dir) * 8 + col] === '.') out.push({ to: (r + 2 * dir) * 8 + col, capture: false });
    }
    for (const dc of [-1, 1]) {
      if (inside(r + dir, col + dc) && chessColorOf(board[(r + dir) * 8 + col + dc]) === 1 - me) out.push({ to: (r + dir) * 8 + col + dc, capture: true });
    }
  } else if (kind === 'n' || kind === 'k') {
    const steps = kind === 'n' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dr, dc] of steps) add(r + dr, col + dc);
  } else {
    const lines = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const use = kind === 'r' ? lines.slice(0, 4) : kind === 'b' ? lines.slice(4) : lines;
    for (const [dr, dc] of use) {
      for (let k = 1; add(r + dr * k, col + dc * k); k++);
    }
  }
  return out;
}

// 잡힌 말: 처음 수에서 판에 남은 수를 뺀다 (프로모션으로 늘어난 말은 0 으로 본다)
function chessCaptured(board) {
  const left = {};
  for (const p of board) left[p] = (left[p] || 0) + 1;
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const lost = (color) => Object.entries(start).flatMap(([k, n]) => {
    const piece = color === 0 ? k.toUpperCase() : k;
    return Array(Math.max(0, n - (left[piece] || 0))).fill(piece);
  });
  const worth = (list) => list.reduce((n, p) => n + CHESS_INFO[p.toLowerCase()].value, 0);
  const whiteLost = lost(0), blackLost = lost(1);
  return { byWhite: blackLost, byBlack: whiteLost, lead: worth(blackLost) - worth(whiteLost) };   // lead > 0 이면 백이 앞선다
}

// 28×28 칸 안의 말 그림. 기준은 칸의 왼쪽 위
function drawChessPiece(c, piece, x, y, size = 28, colors = null) {
  const kind = piece.toLowerCase(), white = piece === piece.toUpperCase();
  const fill = colors?.fill || (white ? '#fdf7ea' : '#3a3340'), line = colors?.line || (white ? '#3a2b22' : '#110e13');
  const k = size / 28;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.lineJoin = 'round';
  c.lineWidth = 1.2;
  c.fillStyle = fill;
  c.strokeStyle = line;
  const shape = (points) => {
    c.beginPath();
    points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.closePath();
    c.fill();
    c.stroke();
  };
  const round = (rx, ry, w, h) => {
    c.beginPath();
    c.roundRect(rx, ry, w, h, 1.6);
    c.fill();
    c.stroke();
  };
  const ball = (bx, by, br) => {
    c.beginPath();
    c.arc(bx, by, br, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  };
  if (kind === 'p') {
    shape([[9.5, 21], [11.5, 15], [16.5, 15], [18.5, 21]]);
    round(7, 20.5, 14, 3.6);
    round(10, 13.4, 8, 2.4);
    ball(14, 10.2, 3.8);
  } else if (kind === 'r') {
    shape([[9.5, 21], [10.2, 12], [17.8, 12], [18.5, 21]]);
    round(6.5, 20.5, 15, 3.6);
    shape([[8, 12.4], [8, 6], [10.6, 6], [10.6, 8.2], [12.7, 8.2], [12.7, 6], [15.3, 6], [15.3, 8.2], [17.4, 8.2], [17.4, 6], [20, 6], [20, 12.4]]);
  } else if (kind === 'n') {
    shape([[9.2, 21], [9.6, 17], [11.8, 14.4], [8.6, 13.8], [6.4, 14.2], [5.4, 12], [8, 8.4], [10.4, 6.6], [10.8, 4.2], [12.6, 5.8], [15.2, 5.4], [18.6, 7.6], [20.2, 11.6], [20.2, 16], [19.2, 21]]);
    round(6.5, 20.5, 15, 3.6);
    c.fillStyle = line;
    c.beginPath();
    c.arc(11.6, 9.2, 0.95, 0, Math.PI * 2);
    c.fill();
    c.beginPath();   // 갈기
    c.moveTo(15.6, 7);
    c.quadraticCurveTo(18.4, 9, 18.6, 15);
    c.stroke();
  } else if (kind === 'b') {
    shape([[10, 21], [11.6, 16], [16.4, 16], [18, 21]]);
    round(7, 20.5, 14, 3.6);
    round(10.4, 14.4, 7.2, 2.2);
    c.beginPath();
    c.moveTo(14, 4.8);
    c.quadraticCurveTo(19.2, 9.2, 17.4, 14.4);
    c.lineTo(10.6, 14.4);
    c.quadraticCurveTo(8.8, 9.2, 14, 4.8);
    c.closePath();
    c.fill();
    c.stroke();
    ball(14, 3.8, 1.4);
    c.beginPath();   // 갈라진 틈
    c.moveTo(15.8, 8);
    c.lineTo(13, 11.2);
    c.stroke();
  } else if (kind === 'q') {
    shape([[8.6, 21], [10.4, 13.6], [17.6, 13.6], [19.4, 21]]);
    round(6, 20.5, 16, 3.6);
    shape([[8.4, 14], [6.8, 7.4], [9.6, 10.4], [11.2, 5.6], [12.8, 9.6], [14, 4.6], [15.2, 9.6], [16.8, 5.6], [18.4, 10.4], [21.2, 7.4], [19.6, 14]]);
    for (const [bx, by] of [[6.8, 6.6], [11.2, 4.8], [14, 3.8], [16.8, 4.8], [21.2, 6.6]]) ball(bx, by, 1.15);
  } else {   // 킹
    shape([[8.6, 21], [10.4, 13.6], [17.6, 13.6], [19.4, 21]]);
    round(6, 20.5, 16, 3.6);
    c.beginPath();
    c.moveTo(9, 14);
    c.quadraticCurveTo(6.2, 8.6, 10.8, 8.4);
    c.quadraticCurveTo(13, 8.4, 14, 10.6);
    c.quadraticCurveTo(15, 8.4, 17.2, 8.4);
    c.quadraticCurveTo(21.8, 8.6, 19, 14);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = line;
    c.fillRect(13.1, 2.4, 1.8, 6.4);
    c.fillRect(11, 4.2, 6, 1.8);
  }
  c.restore();
}

function drawChessSquares(c, flip, L = CHESS_BOARD, labels = true) {
  for (let sq = 0; sq < 64; sq++) {
    const [x, y] = chessSquareXY(sq, flip, L);
    c.fillStyle = ((sq >> 3) + (sq & 7)) % 2 ? CHESS_DARK : CHESS_LIGHT;
    c.fillRect(x, y, L.cell, L.cell);
  }
  if (!labels) return;
  const size = Math.max(6, Math.round(L.cell * 0.24));
  const ink = (r, col) => ((r + col) % 2 ? CHESS_LIGHT : CHESS_DARK);   // 칸 색의 반대색
  for (let i = 0; i < 8; i++) {   // 칸 이름: 아래 줄에 a~h, 왼쪽 줄에 1~8
    const col = flip ? 7 - i : i, bottom = flip ? 0 : 7, row = flip ? 7 - i : i, left = flip ? 7 : 0;
    arcadeText(c, 'abcdefgh'[col], L.x + i * L.cell + L.cell - size * 0.55, L.y + 8 * L.cell - size * 0.6, size, ink(bottom, col));
    arcadeText(c, String(8 - row), L.x + size * 0.55, L.y + i * L.cell + size * 0.7, size, ink(row, left));
  }
}

function chessShade(c, sq, flip, color, L = CHESS_BOARD) {
  const [x, y] = chessSquareXY(sq, flip, L);
  c.fillStyle = color;
  c.fillRect(x, y, L.cell, L.cell);
}

// 갈 수 있는 칸: 빈칸은 점, 상대 말이 있는 칸은 모서리 테두리
function drawChessTargets(c, targets, flip, color, L = CHESS_BOARD) {
  for (const t of targets) {
    const [x, y] = chessSquareXY(t.to, flip, L);
    if (t.capture) {
      c.strokeStyle = color;
      c.lineWidth = L.cell * 0.09;
      c.beginPath();
      c.arc(x + L.cell / 2, y + L.cell / 2, L.cell * 0.44, 0, Math.PI * 2);
      c.stroke();
    } else {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x + L.cell / 2, y + L.cell / 2, L.cell * 0.15, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawChessArrow(c, from, to, flip, color, L = CHESS_BOARD) {
  const [x0, y0] = chessSquareXY(from, flip, L), [x1, y1] = chessSquareXY(to, flip, L);
  const ax = x0 + L.cell / 2, ay = y0 + L.cell / 2, bx = x1 + L.cell / 2, by = y1 + L.cell / 2;
  const a = Math.atan2(by - ay, bx - ax), head = L.cell * 0.32;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = L.cell * 0.14;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(bx - Math.cos(a) * head, by - Math.sin(a) * head);
  c.stroke();
  c.beginPath();
  c.moveTo(bx, by);
  c.lineTo(bx - Math.cos(a - 0.5) * head * 1.3, by - Math.sin(a - 0.5) * head * 1.3);
  c.lineTo(bx - Math.cos(a + 0.5) * head * 1.3, by - Math.sin(a + 0.5) * head * 1.3);
  c.closePath();
  c.fill();
  c.lineCap = 'butt';
}

function drawChessPieces(c, board, flip, L = CHESS_BOARD, skip = -1) {
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq] === '.' || sq === skip) continue;
    const [x, y] = chessSquareXY(sq, flip, L);
    drawChessPiece(c, board[sq], x, y, L.cell);
  }
}

function drawChessDanger(c, squares, flip, L = CHESS_BOARD) {   // 지켜 주는 말 없이 공격받는 말: 빨간 느낌표
  for (const sq of squares) {
    const [x, y] = chessSquareXY(sq, flip, L);
    c.fillStyle = '#e8413a';
    c.beginPath();
    c.arc(x + L.cell - 5, y + 5, 4, 0, Math.PI * 2);
    c.fill();
    arcadeText(c, '!', x + L.cell - 5, y + 5.5, 7, '#ffffff');
  }
}

// 위·아래 띠: 그쪽 사람(또는 컴퓨터)의 이름, 잡은 말, 차례와 남은 시간
function drawChessBar(c, y, label, color, captured, lead, turn, clock, now) {
  c.fillStyle = turn ? '#4a3626' : '#2c2018';
  c.fillRect(0, y, ARCADE_W, 34);
  c.fillStyle = color === 0 ? '#fdf7ea' : '#3a3340';
  c.strokeStyle = color === 0 ? '#3a2b22' : '#c9bfa8';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(12, y + 11, 5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (turn && Math.floor(now / 500) % 2) {
    c.strokeStyle = '#ffd84d';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(12, y + 11, 7.5, 0, Math.PI * 2);
    c.stroke();
  }
  arcadeText(c, label, 22, y + 11, 10, turn ? '#ffe9a8' : '#e8dcc8', 'left');
  if (clock) arcadeText(c, clock, ARCADE_W - 6, y + 11, 10, clock.startsWith('0:') && Number(clock.slice(2)) <= 30 ? '#ff8f8f' : '#e8dcc8', 'right');
  const order = 'pnbrq';
  const list = [...captured].sort((a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase()));
  list.forEach((p, i) => drawChessPiece(c, p, 6 + i * 9, y + 18, 14));
  if (lead > 0) arcadeText(c, `+${lead}`, 10 + list.length * 9 + 8, y + 26, 9, '#9fe08a', 'left');
}

// 체스 화면 전체. ui: { side, flip, sel, targets, pattern, promo, labels:[위, 아래], clocks:[위, 아래] }
function drawChessScreen(c, st, ui, now) {
  c.fillStyle = '#2c2018';
  c.fillRect(0, 0, ARCADE_W, ARCADE_H);
  const board = st.cb || CHESS_START, flip = ui.flip;
  drawChessSquares(c, flip);
  if (st.lm && st.lm[0] >= 0) for (const sq of st.lm) chessShade(c, sq, flip, 'rgba(255, 226, 80, 0.42)');
  if (st.hn && st.hn[0] >= 0 && st.s === 1) for (const sq of st.hn) chessShade(c, sq, flip, 'rgba(90, 170, 255, 0.4)');
  if (ui.sel >= 0) chessShade(c, ui.sel, flip, 'rgba(120, 220, 140, 0.55)');
  if (st.ck >= 0 && st.s === 1) {
    const [x, y] = chessSquareXY(st.ck, flip);
    const glow = c.createRadialGradient(x + 14, y + 14, 2, x + 14, y + 14, 18);
    glow.addColorStop(0, 'rgba(255, 40, 40, 0.95)');
    glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
    c.fillStyle = glow;
    c.fillRect(x, y, CHESS_BOARD.cell, CHESS_BOARD.cell);
  }
  drawChessPieces(c, board, flip);
  if (st.s === 1 && st.hg?.length && ui.side === st.ct) drawChessDanger(c, st.hg, flip);
  if (ui.pattern.length) drawChessTargets(c, ui.pattern, flip, 'rgba(70, 110, 200, 0.5)');
  if (ui.targets.length) drawChessTargets(c, ui.targets, flip, 'rgba(30, 110, 40, 0.62)');
  if (st.hn && st.hn[0] >= 0 && st.s === 1) drawChessArrow(c, st.hn[0], st.hn[1], flip, 'rgba(40, 120, 230, 0.75)');
  const caps = chessCaptured(board), top = flip ? 0 : 1, bottom = 1 - top;
  const captured = (color) => (color === 0 ? caps.byWhite : caps.byBlack);
  const lead = (color) => (color === 0 ? caps.lead : -caps.lead);
  drawChessBar(c, 4, ui.labels[0], top, captured(top), lead(top), st.s === 1 && st.ct === top, ui.clocks[0], now);
  drawChessBar(c, ARCADE_H - 38, ui.labels[1], bottom, captured(bottom), lead(bottom), st.s === 1 && st.ct === bottom, ui.clocks[1], now);
  if (ui.promo) drawChessPromo(c, ui.side);
}

// 프로모션: 폰이 무엇으로 바뀔지 고른다
const CHESS_PROMO_BOX = { x: 24, y: 128, w: 192, h: 72 };
function drawChessPromo(c, side) {
  const B = CHESS_PROMO_BOX;
  c.fillStyle = 'rgba(0, 0, 0, 0.5)';
  c.fillRect(0, 0, ARCADE_W, ARCADE_H);
  c.fillStyle = '#fff6dc';
  c.strokeStyle = '#3a2b22';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(B.x, B.y, B.w, B.h, 6);
  c.fill();
  c.stroke();
  arcadeText(c, '폰이 무엇으로 바뀔까요?', ARCADE_W / 2, B.y + 12, 10, '#3a2b22');
  CHESS_PROMOS.forEach((k, i) => {
    const x = B.x + 12 + i * 44;
    c.fillStyle = i === 0 ? '#ffe9a8' : '#f2e2c4';
    c.fillRect(x, B.y + 22, 36, 36);
    drawChessPiece(c, side === 1 ? k : k.toUpperCase(), x + 4, B.y + 24, 28);
    arcadeText(c, CHESS_INFO[k].name, x + 18, B.y + 64, 8, '#3a2b22');
  });
}

function chessPromoAt(lx, ly) {
  const B = CHESS_PROMO_BOX;
  if (ly < B.y + 20 || ly > B.y + B.h) return null;
  const i = Math.floor((lx - B.x - 8) / 44);
  return i >= 0 && i < 4 ? CHESS_PROMOS[i] : null;
}

// ------------------------------------------------------------ 체스 설명서 (아이템창의 「체스 설명서」와 체스판 창에서 연다)
// board: 'e4:K,d5:p' 처럼 칸과 말. show 칸의 말이 갈 수 있는 곳을 점으로, arrows 는 화살표, marks 는 빨간 표시

const CHESS_GUIDE = [
  {
    tab: '처음', title: '체스는 어떤 게임?', board: 'start',
    text: [
      '두 사람이 백(흰 말)과 흑(검은 말)을 나눠 번갈아 한 수씩 둬요. 백이 먼저 둡니다.',
      '말마다 움직이는 법이 달라요. 상대 말이 있는 칸으로 가면 그 말을 잡아 판에서 없애요.',
      '상대 킹을 공격(체크)했는데 피할 방법이 없으면 체크메이트, 그 사람이 이겨요.',
      '칸은 가로 a~h, 세로 1~8로 불러요. 백은 1·2줄, 흑은 7·8줄에서 시작해요.',
    ],
  },
  { tab: '킹', piece: 'k', title: '킹', board: 'd4:K,e5:p,c3:P', show: 'd4', extra: '공격받는 칸으로는 못 가요. 이 게임은 갈 수 없는 칸을 빼고 보여 줘요.' },
  { tab: '퀸', piece: 'q', title: '퀸', board: 'd4:Q,d7:p,f4:P', show: 'd4', extra: '같은 편 말은 넘지 못하고 그 앞에서 멈춰요. 상대 말은 잡고 그 자리에서 멈춰요.' },
  { tab: '룩', piece: 'r', title: '룩', board: 'd4:R,d7:p,b4:P', show: 'd4', extra: '판의 양 끝 구석에서 시작해요. 처음엔 막혀 있으니 폰을 먼저 움직여 길을 열어 줘요.' },
  { tab: '비숍', piece: 'b', title: '비숍', board: 'd4:B,f6:p,b2:P', show: 'd4', extra: '비숍 하나는 밝은 칸, 다른 하나는 어두운 칸만 다녀요.' },
  { tab: '나이트', piece: 'n', title: '나이트', board: 'd4:N,d5:P,e5:p,c5:P,e4:p,f5:p', show: 'd4', extra: '둘레가 말로 막혀 있어도 뛰어넘어 L자 끝 칸으로 가요. L자 끝에 상대 말이 있으면 잡아요(f5).' },
  { tab: '폰', piece: 'p', title: '폰', board: 'e2:P,d3:p,f3:P,c5:P,c6:p', show: 'e2', extra: '앞에 말이 있으면 막혀서 못 가요(c5 폰처럼). 앞 대각선에 상대 말이 있을 때만 그쪽으로 잡아요.' },
  {
    tab: '특수', title: '특별한 규칙 세 가지', board: 'e1:K,h1:R,a1:R,b7:P,e5:P,d5:p', arrows: [['e1', 'g1'], ['h1', 'f1'], ['b7', 'b8'], ['e5', 'd6']], marks: ['d5'],
    text: [
      '캐슬링: 킹과 룩이 한 번도 안 움직였고 사이가 비어 있으면, 킹이 룩 쪽으로 두 칸 가고 룩이 킹을 넘어 옆에 서요. 킹을 두 칸 옮기면 돼요. 체크 중이거나 지나는 칸이 공격받으면 못 해요.',
      '프로모션: 폰이 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀌어요. 보통 퀸을 고르면 돼요.',
      '앙파상: 상대 폰이 처음에 두 칸 와서 내 폰 바로 옆에 서면, 바로 다음 수에 한 칸만 온 것처럼 대각선으로 잡을 수 있어요.',
    ],
  },
  {
    tab: '체크', title: '체크와 체크메이트', board: 'g8:k,f7:p,g7:p,h7:p,e8:R,g1:K', marks: ['g8'], arrows: [['e1', 'e8']],
    text: [
      '체크: 킹이 공격받는 상태예요. 체크를 받으면 꼭 풀어야 해요 — 킹을 옮기거나, 막거나, 공격한 말을 잡아요.',
      '체크메이트: 체크를 풀 방법이 하나도 없으면 져요. 그림은 룩이 끝 줄에서 킹을 몰아붙인 체크메이트예요.',
      '비김: 체크가 아닌데 둘 곳이 없으면(스테일메이트) 비겨요. 같은 국면이 세 번 나오거나, 서로 이길 말이 없거나, 50수 동안 아무것도 잡지 않고 폰도 안 움직여도 비겨요.',
    ],
  },
  {
    tab: '요령', title: '초보를 위한 요령', board: 'start', arrows: [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4']],
    text: [
      '처음엔 가운데 폰(e·d 폰)을 내보내고, 나이트와 비숍을 앞으로 꺼내요. 그다음 캐슬링으로 킹을 안전하게!',
      '말의 가치: 폰 1, 나이트·비숍 3, 룩 5, 퀸 9. 값싼 말로 비싼 말을 잡으면 이득이에요.',
      '두기 전에 확인: 내 말이 공격받고 있지 않은지, 상대가 방금 무엇을 노렸는지 살펴봐요.',
    ],
  },
  {
    tab: '이 게임', title: '체스판 오락기에서 두는 법',
    text: [
      '체스판 앞에서 E를 누르고 1P(백)나 2P(흑)에 앉아요. 혼자 시작하면 컴퓨터와 두고, 둘이 앉으면 사람끼리 둬요.',
      '말을 누르면 그 말의 설명과 갈 수 있는 칸이 보여요. 초록 점은 갈 수 있는 칸, 초록 테두리는 잡을 수 있는 상대 말이에요. 점을 누르면 움직여요.',
      '상대 말을 누르면 그 말이 노리는 칸이 파란 점으로 보여요. 빨간 느낌표(!)는 지켜 주는 말 없이 공격받는 내 말이에요.',
      '컴퓨터와 둘 때는 「힌트」로 좋은 수를 파란 화살표로 보고, 「무르기」로 방금 수를 물릴 수 있어요. 컴퓨터를 이길 때마다 한 단계씩 세져요(최고 3단계).',
      '사람끼리 둘 때는 한 수에 3분 안에 둬야 해요. 일어나면 기권이에요.',
    ],
  },
];

function chessGuideBoard(spec) {
  if (spec === 'start') return CHESS_START;
  const board = new Array(64).fill('.');
  for (const part of (spec || '').split(',')) {
    if (!part) continue;
    const [name, piece] = part.split(':');
    board[chessSquareOf(name)] = piece;
  }
  return board.join('');
}

// 설명서 한 쪽의 그림 (240×240 논리 크기)
function drawChessGuideBoard(c, page) {
  const L = { x: 8, y: 8, cell: 28 };
  c.fillStyle = '#2c2018';
  c.fillRect(0, 0, 240, 240);
  const board = chessGuideBoard(page.board);
  drawChessSquares(c, false, L);
  for (const name of page.marks || []) chessShade(c, chessSquareOf(name), false, 'rgba(255, 60, 60, 0.5)', L);
  if (page.show) chessShade(c, chessSquareOf(page.show), false, 'rgba(120, 220, 140, 0.55)', L);
  drawChessPieces(c, board, false, L);
  if (page.show) drawChessTargets(c, chessPattern(board, chessSquareOf(page.show)), false, 'rgba(30, 110, 40, 0.7)', L);
  for (const [from, to] of page.arrows || []) drawChessArrow(c, chessSquareOf(from), chessSquareOf(to), false, 'rgba(40, 120, 230, 0.75)', L);
}

// 아이템창의 체스 설명서 아이콘 (72×42)
function drawChessBookIcon(c) {
  c.fillStyle = 'rgba(0, 0, 0, 0.25)';
  c.fillRect(19, 38, 38, 3);
  c.fillStyle = '#f4ead2';   // 책장
  c.fillRect(22, 3, 34, 36);
  c.fillStyle = '#8a3b2e';   // 표지
  c.beginPath();
  c.roundRect(17, 1, 35, 38, 2);
  c.fill();
  c.fillStyle = '#5e241b';
  c.fillRect(17, 1, 5, 38);
  c.fillStyle = '#e8c06a';
  c.fillRect(25, 5, 23, 1.5);
  c.fillRect(25, 33, 23, 1.5);
  drawChessPiece(c, 'N', 22, 6, 28, { fill: '#e8c06a', line: '#5e241b' });
}
