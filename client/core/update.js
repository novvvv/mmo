'use strict';
// 매 프레임의 갱신: 내 캐릭터 예측 이동, 다른 사람 보간, 끊긴 연결 감지.

// ------------------------------------------------------------ 업데이트

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 쌓아 둔 위치에서 시각 t 의 자리를 찾는다. 바라보는 쪽과 걷는 모습은 서버가 알려 준 누른 방향(d)을 따른다.
// 멀리 뛰면(앉기, 문 앞 이동) 미끄러지지 않고 바로 옮긴다. 다음 위치가 아직 안 왔으면 잠깐만 같은 방향으로 이어 간다.
function placeRemote(e, t) {
  const snaps = e.snaps;
  while (snaps.length > 2 && snaps[1].t <= t) snaps.shift();
  let a = snaps[0], b = snaps[1];
  if (b && t >= b.t) {   // 다음 위치가 아직 안 왔다
    a = b;
    b = null;
  }
  let x = a.x, y = a.y, d = a.d;
  if (b && t > a.t) {
    const k = (t - a.t) / Math.max(1, b.t - a.t);
    if (Math.hypot(b.x - a.x, b.y - a.y) > 90) {
      x = a.x;
      y = a.y;
    } else {
      x = a.x + (b.x - a.x) * k;
      y = a.y + (b.y - a.y) * k;
    }
  } else if (!b && a.d && t > a.t) {   // 늦게 오는 동안: 한 틱만큼만 같은 방향으로 이어 간다
    const ahead = Math.min(t - a.t, 50) / 1000 * (world.speed || 220);
    const [vx, vy] = inputVector(a.d);
    x = a.x + vx * ahead;
    y = a.y + vy * ahead;
  }
  const moved = Math.hypot(x - e.x, y - e.y);
  if (d) {
    const [vx, vy] = inputVector(d);
    if (vx || vy) { e.dirX = vx; e.dirY = vy; }
  }
  e.moving = !!d && !e.seat && moved > 0.05;
  e.x = x;
  e.y = y;
}

function inputVector(bits) {
  let vx = 0, vy = 0;
  if (bits & 1) vy -= 1;
  if (bits & 2) vy += 1;
  if (bits & 4) vx -= 1;
  if (bits & 8) vx += 1;
  if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
  return [vx, vy];
}

function update(dt, now) {
  updatePets(dt);
  updateSteps(dt);
  for (const c of cats) {
    const t = Math.min((now - c.t0) / world.catMs, 1);
    c.x = c.fromX + (c.toX - c.fromX) * t;
    c.y = c.fromY + (c.toY - c.fromY) * t;
  }

  const renderAt = stateClock !== null ? now - stateClock - INTERP_MS : null;
  for (const [id, e] of entities) {
    if (id !== myId && e.snaps?.length) placeRemote(e, renderAt ?? now - INTERP_MS);
  }

  if (me) {
    let dx = 0, dy = 0;
    if (!isBusy() && !offline) {
      if (input & 1) dy -= 1;
      if (input & 2) dy += 1;
      if (input & 4) dx -= 1;
      if (input & 8) dx += 1;
    }
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    if (dx || dy) { me.dirX = dx; me.dirY = dy; }
    me.moving = !!(dx || dy);
    const bounds = terrain ? terrain.zones[zone] : world;
    stepMove(me, clamp(me.x + dx * world.speed * dt, (bounds.x0 || 0) + RADIUS, bounds.w - RADIUS),
      clamp(me.y + dy * world.speed * dt, (bounds.y0 || 0) + RADIUS, bounds.h - RADIUS));
  }
}
