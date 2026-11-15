'use strict';
// 그리기: 야외와 방, 캐릭터와 이름·안내, 한 프레임을 장면 순서대로 그리기.

// ------------------------------------------------------------ 야외 렌더링

function drawRiver(camX, vw, now) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CHRISTMAS ? '#f8fbff' : '#d8c48c';  // 모래톱 (겨울에는 눈 쌓인 둑)
  ctx.lineWidth = 26;
  ctx.stroke(riverPath);
  ctx.fillStyle = CHRISTMAS ? '#3b86ba' : '#2f7fb8';
  ctx.fill(riverPath);
  ctx.strokeStyle = CHRISTMAS ? 'rgba(222, 240, 250, 0.9)' : 'rgba(160, 212, 235, 0.75)';  // 물가의 얕은 물 (겨울에는 살얼음)
  ctx.lineWidth = 8;
  ctx.stroke(riverPath);

  // 수면의 잔물결
  const CELL = 80;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let col = Math.floor(camX / CELL) - 1; col * CELL < camX + vw + CELL; col++) {
    for (let row = Math.floor(riverNorth / CELL); row * CELL < riverSouth; row++) {
      const h = hash(col, row);
      const wx = col * CELL + (h % CELL) + Math.sin(now / 900 + h) * 10;
      const wy = row * CELL + ((h >>> 8) % CELL);
      if (wy < bankAt(terrain.top, wx) + 16 || wy > bankAt(terrain.bot, wx) - 16) continue;
      ctx.moveTo(wx - 12, wy);
      ctx.quadraticCurveTo(wx - 6, wy - 4, wx, wy);
      ctx.quadraticCurveTo(wx + 6, wy + 4, wx + 12, wy);
    }
  }
  ctx.stroke();

  drawBridge();
}

function drawBridge() {
  const [l, r] = terrain.bridge;
  let y0 = Infinity, y1 = -Infinity;
  for (let x = l; x <= r; x += terrain.step) {
    y0 = Math.min(y0, bankAt(terrain.top, x));
    y1 = Math.max(y1, bankAt(terrain.bot, x));
  }
  y0 -= 16;
  y1 += 16;

  ctx.fillStyle = '#9a6b3c';
  ctx.fillRect(l, y0, r - l, y1 - y0);
  ctx.strokeStyle = '#7a5229';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = y0 + 12; y < y1; y += 12) {
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#6b4423';  // 난간
  ctx.fillRect(l - 3, y0, 7, y1 - y0);
  ctx.fillRect(r - 4, y0, 7, y1 - y0);
  if (CHRISTMAS) {
    ctx.fillStyle = SNOW;
    ctx.fillRect(l - 3, y0, 5, y1 - y0);
    ctx.fillRect(r - 2, y0, 5, y1 - y0);
  }
}

function drawGround(camX, camY, vw, vh, now) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, world.w, world.h);
  ctx.clip();

  ctx.fillStyle = CHRISTMAS ? '#e8eff6' : '#3d7a3a';
  ctx.fillRect(0, 0, world.w, world.h);

  const x0 = Math.max(0, Math.floor(camX / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE));
  const x1 = Math.min(Math.ceil(world.w / TILE), Math.ceil((camX + vw) / TILE));
  const y1 = Math.min(Math.ceil(world.h / TILE), Math.ceil((camY + vh) / TILE));

  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      const px = tx * TILE, py = ty * TILE;
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = CHRISTMAS ? '#e1e9f2' : '#42803e';
        ctx.fillRect(px, py, TILE, TILE);
      }
      // 타일마다 고정된 장식 (모든 클라이언트에서 동일하게 보임)
      const h = hash(tx, ty);
      const ox = px + 8 + ((h >>> 4) % 48), oy = py + 8 + ((h >>> 10) % 48);
      if (CHRISTMAS) {  // 꽃과 풀 대신 쌓인 눈 더미와 반짝임
        if (h % 5 === 0) oval(ox, oy, 15, 5.5, '#f8fbff');
        else if (h % 3 === 0) oval(ox, oy, 12, 3.5, 'rgba(160, 182, 210, 0.45)');
        else if (h % 7 === 0) fillCircles('#ffffff', [[ox, oy, 1.6]]);
      } else if (h % 11 === 0) {
        ctx.fillStyle = ['#f2d04b', '#f06b8b', '#ffffff', '#9fb8ff'][(h >>> 20) % 4];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ctx.beginPath();
          ctx.arc(ox + Math.cos(a) * 3, oy + Math.sin(a) * 3, 2.2, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#c47a1f';
        ctx.beginPath();
        ctx.arc(ox, oy, 1.6, 0, TAU);
        ctx.fill();
      } else if (h % 4 === 0) {
        ctx.strokeStyle = '#2f6a2d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox - 4, oy); ctx.lineTo(ox - 2, oy - 6);
        ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 8);
        ctx.moveTo(ox + 4, oy); ctx.lineTo(ox + 2, oy - 6);
        ctx.stroke();
      }
    }
  }
  if (terrain) {
    drawRiver(camX, vw, now);
    for (const b of terrain.buildings) if (b.k === 'cafe') drawDeck(b);
  }
  ctx.restore();

  ctx.strokeStyle = CHRISTMAS ? '#9fb2c6' : '#1c3a1a';
  ctx.lineWidth = 8;
  ctx.strokeRect(-4, -4, world.w + 8, world.h + 8);
}

function drawBuilding(b, now, night, hidingMe) {
  const ground = b.y + b.front;
  const lit = night > 0.3;
  ctx.save();
  if (hidingMe) ctx.globalAlpha = 0.55;  // 내 캐릭터가 건물 뒤에 있으면 비쳐 보이게
  groundShadow(b.x, ground + 2, b.halfW + 14, 10);
  if (b.k === 'cafe') drawCafe(b, ground, now, lit);
  else drawBuildingStyle(b, ground, now, lit, b.ext || NO_EXT);
  if (CHRISTMAS) XMAS_ROOFS[b.k === 'cafe' ? 'cafe' : houseShape(b)]?.(b, ground, now);
  ctx.restore();
}

function lightSources(list) {
  const lights = [];
  for (const l of terrain.lamps) lights.push({ x: l.x, y: l.y - 34, r: 190 });
  for (const b of terrain.buildings) {
    if (b.in) continue;
    const ground = b.y + b.front;
    const wide = b.k === 'cafe' ? 66 : 54;
    lights.push({ x: b.x - wide, y: ground + 8, r: 110 }, { x: b.x + wide, y: ground + 8, r: 110 });
    lights.push({ x: b.x, y: ground - 90, r: 190 });  // 건물 모양이 밤에도 보이게
    if (b.k === 'cafe') lights.push({ x: b.x, y: b.deck[1] + 62, r: 230 });
    else lights.push({ x: b.door[0], y: b.door[1] + 12, r: 90 });
  }
  if (CHRISTMAS) for (const d of XMAS_DECOR) if (d.k === 'tree' && d.z === 0) lights.push({ x: d.x, y: d.y - 90, r: 200 });
  for (const e of list) lights.push({ x: e.x, y: e.y, r: 74 });  // 어두워도 캐릭터는 보이게
  return lights;
}

const nightCanvas = document.createElement('canvas');
const nightCtx = nightCanvas.getContext('2d');

// 화면 전체를 어둡게 칠하고 lights 자리만 뚫는다.
function drawDarkness(lights, camX, camY, vw, vh, alpha) {
  const w = Math.ceil(vw / NIGHT_SCALE), h = Math.ceil(vh / NIGHT_SCALE);
  if (nightCanvas.width !== w || nightCanvas.height !== h) {
    nightCanvas.width = w;
    nightCanvas.height = h;
  }
  nightCtx.globalCompositeOperation = 'source-over';
  nightCtx.clearRect(0, 0, w, h);
  nightCtx.fillStyle = `rgba(10, 16, 46, ${alpha})`;
  nightCtx.fillRect(0, 0, w, h);

  nightCtx.globalCompositeOperation = 'destination-out';
  for (const light of lights) {
    const sx = (light.x - camX) / NIGHT_SCALE, sy = (light.y - camY) / NIGHT_SCALE, r = light.r / NIGHT_SCALE;
    if (sx < -r || sy < -r || sx > w + r || sy > h + r) continue;
    const gradient = nightCtx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nightCtx.fillStyle = gradient;
    nightCtx.beginPath();
    nightCtx.arc(sx, sy, r, 0, TAU);
    nightCtx.fill();
  }
  ctx.drawImage(nightCanvas, camX, camY, vw, vh);
}

// 호출하는 쪽에서 'lighter' 합성을 켜 둔다.
function drawGlow(x, y, r, color, power) {
  const g = ctx.createRadialGradient(x, y, 6, x, y, r);
  g.addColorStop(0, `rgba(${color}, ${power})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawNight(list, camX, camY, vw, vh, amount) {
  drawDarkness(lightSources(list), camX, camY, vw, vh, NIGHT_DARKNESS * amount);

  // 가로등 불빛의 따뜻한 색
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of terrain.lamps) {
    if (l.x < camX - 170 || l.x > camX + vw + 170 || l.y < camY - 170 || l.y > camY + vh + 170) continue;
    drawGlow(l.x, l.y - 34, 150, '255, 196, 110', 0.22 * amount);
  }
  ctx.restore();
}

// 밝기 설정이 낮을수록 방이 어두워지고, 난로와 촛불, 스탠드의 빛도 작고 약해진다.
function drawRoomLighting(room, list, camX, camY, vw, vh) {
  const level = (roomLight.level - LIGHT_LEVEL_MIN) / (LIGHT_LEVEL_MAX - LIGHT_LEVEL_MIN);
  const sources = [];
  for (const f of terrain.furnByZone[zone]) {
    const make = FURNITURE_LIGHTS[f.k];
    if (!make) continue;
    const scale = decorScale(f.decor), mirror = f.decor?.flip ? -1 : 1, py = scalePivotY(f.k, f.y);
    for (const s of make(f, roomLight)) {
      const x = f.x + (s.x - f.x) * mirror * scale, y = py + (s.y - py) * scale;
      sources.push({ ...s, x, y, r: s.r * scale * (0.55 + 0.45 * level), power: s.power * (0.5 + 0.5 * level) * (roomLight.on ? ROOM_ON_GLOW : 1) });
    }
  }
  const darkness = roomLight.on ? ROOM_DIM * (1 - level) : ROOM_DARKNESS;

  ctx.save();
  ctx.beginPath();  // 빛이 방 바깥의 빈 공간으로 번지지 않게
  const rx0 = room.x0 || 0, ry0 = room.y0 || 0;
  ctx.rect(rx0 - SIDE_WALL, ry0 - WALL_HEIGHT, room.w - rx0 + SIDE_WALL * 2, room.h - ry0 + WALL_HEIGHT + SIDE_WALL);
  ctx.clip();
  if (darkness > 0) {
    const bodies = [...list.map((e) => ({ x: e.x, y: e.y, r: 74 })), ...cats.map((c) => ({ x: c.x, y: c.y - 18, r: 58 }))];  // 어두워도 캐릭터와 동물은 보이게
    drawDarkness([...sources, ...bodies], camX, camY, vw, vh, darkness);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sources) drawGlow(s.x, s.y, s.r, s.color, s.power);
  ctx.restore();
}

// ------------------------------------------------------------ 캐릭터와 안내 표시

function seatInfo(e) {
  return e.seat && terrain ? terrain.seats[e.seat - 1] : null;
}

// 옆자리와 이름, 말풍선, 낚싯대가 겹치지 않게 펼칠 방향 (-1 왼쪽, 1 오른쪽, 0 가운데)
function seatSide(e) {
  const seat = seatInfo(e);
  return seat ? seat.side : 0;
}

function bodyTop(e) {
  return e.y - bodyLift(e) - RADIUS;
}

function rodSide(e) {
  const dist = Math.hypot(e.bx - e.x, e.by - e.y) || 1;
  return seatSide(e) || ((e.bx - e.x) / dist < 0 ? -1 : 1);
}

function drawPlayer(e, isMe, now) {
  const emoting = e.emoteAt !== undefined && now - e.emoteAt < EMOTE_MS;
  const bed = seatInfo(e);
  if (bed && bed.lie) {   // 이불 위로 몸만 보이게 잘라서 그린다
    ctx.save();
    if (bed.fx) {   // 돌려 놓은 침대: 누운 방향도 함께 돈다
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(-bed.fx, bed.fy));
      ctx.translate(-e.x, -e.y);
    } else if (bed.fy < 0) {
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI);
      ctx.translate(-e.x, -e.y);
    }
    ctx.beginPath();
    ctx.rect(e.x - 60, e.y - 70, 120, 72);
    ctx.clip();
    drawCharacter(ctx, { ...e, seat: 0, moving: false, grip: 0, dirX: 0, dirY: 1, t: now, emote: EMOTE_SLEEP, emoteT: now });
    ctx.restore();
    drawSleepZ(e.x, e.y, now);
  } else {
    drawCharacter(ctx, { ...e, grip: e.fish ? rodSide(e) : 0, t: now, emote: emoting ? e.emote : -1, emoteT: now - e.emoteAt });
  }

  const side = seatSide(e);
  const nameX = e.x - side * 14, nameY = bodyTop(e) - 6;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = side < 0 ? 'right' : side > 0 ? 'left' : 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeText(e.name, nameX, nameY);
  ctx.fillStyle = isMe ? '#ffe066' : '#ffffff';
  ctx.fillText(e.name, nameX, nameY);
  if (e.focus) {   // 집중 타이머를 켠 사람: 이름 왼쪽에 작은 표시
    const nameW = ctx.measureText(e.name).width;
    const left = Math.round((side < 0 ? nameX - nameW : side > 0 ? nameX : nameX - nameW / 2) - 32);
    ctx.fillStyle = '#1f6f4a';
    ctx.fillRect(left - 1, nameY - 16, 30, 16);
    ctx.fillStyle = '#7ff0b4';
    ctx.fillRect(left, nameY - 15, 28, 14);
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0d3a26';
    ctx.fillText('집중', left + 14, nameY - 2);
  }
}

// 광고판을 띄웠으면 말풍선과 잡은 물고기는 그 위로 올라간다. 광고판은 자리를 옮기지 않는다.
function headStack(e) {
  const board = boards.get(e.id);
  return bodyTop(e) - NAME_CLEARANCE - (board ? board.h + BOARD_TAIL + 3 : 0);
}

function traceBoard(left, top, w, h, tipX) {
  const right = left + w, bottom = top + h, r = BOARD_RADIUS;
  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.arcTo(right, top, right, bottom, r);
  ctx.arcTo(right, bottom, left, bottom, r);
  ctx.lineTo(tipX + 5, bottom);
  ctx.lineTo(tipX, bottom + BOARD_TAIL);
  ctx.lineTo(tipX - 5, bottom);
  ctx.arcTo(left, bottom, left, top, r);
  ctx.arcTo(left, top, right, top, r);
  ctx.closePath();
}

function drawBoard(e) {
  const board = boards.get(e.id);
  if (!board) return;
  if (board.style === 1) {
    drawPixelBoard(e, board);
    return;
  }
  const { lines, w, h } = board;
  const side = seatSide(e);
  const left = Math.round(side < 0 ? e.x + 14 - w : side > 0 ? e.x - 14 : e.x - w / 2);
  const top = Math.round(headStack(e) + 3);
  const tipX = clamp(Math.round(e.x), left + BOARD_RADIUS + 6, left + w - BOARD_RADIUS - 6);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.translate(0, 2);
  traceBoard(left, top, w, h, tipX);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();
  ctx.translate(0, -2);
  traceBoard(left, top, w, h, tipX);
  ctx.fillStyle = '#fff8e7';
  ctx.fill();
  ctx.strokeStyle = mixColor(e.color, '#000000', 0.25);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = BOARD_FONT;
  ctx.fillStyle = '#33291c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, left + w / 2, top + BOARD_PAD_Y + BOARD_LINE_HEIGHT * (i + 0.5) + 0.5));
  ctx.restore();
}

function drawBubble(e, now) {
  if (!e.bubble || now > e.bubbleUntil) return;
  ctx.font = `13px ${FONT}`;
  const w = ctx.measureText(e.bubble).width + 16, h = 24;
  const top = headStack(e) - 5 - h;
  const side = seatSide(e);
  const left = side < 0 ? e.x + 14 - w : side > 0 ? e.x - 14 : e.x - w / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 8);
  ctx.moveTo(e.x - 5, top + h);
  ctx.lineTo(e.x + 5, top + h);
  ctx.lineTo(e.x, top + h + 5);
  ctx.fill();

  ctx.fillStyle = '#1b1b1b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e.bubble, left + w / 2, top + h / 2 + 0.5);
}

function drawRod(e, now) {
  const dist = Math.hypot(e.bx - e.x, e.by - e.y) || 1;
  const uy = (e.by - e.y) / dist;
  const bodyY = e.y - bodyLift(e);
  const side = rodSide(e);
  const tipX = e.x + side * 46, tipY = bodyY - 32 + uy * 8;
  const bite = e.fish === 2;
  const bobY = e.by + (bite ? 3 + Math.sin(now / 45) * 4 : Math.sin(now / 500) * 1.5);

  ctx.save();
  ctx.lineCap = 'round';

  const ripple = (now / (bite ? 350 : 1400)) % 1;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - ripple)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(e.bx, e.by + 3, 6 + ripple * 16, 3 + ripple * 7, 0, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';  // 낚싯줄 (입질이 오면 팽팽해진다)
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo((tipX + e.bx) / 2, (tipY + bobY) / 2 + (bite ? 0 : 18), e.bx, bobY - 4);
  ctx.stroke();

  ctx.strokeStyle = '#5b3a1e';  // 낚싯대
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.x + side * (e.arms ? 24 : 12), bodyY + 4);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';  // 찌
  ctx.beginPath();
  ctx.arc(e.bx, bobY, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  ctx.arc(e.bx, bobY, 6, Math.PI, 0);
  ctx.fill();

  if (bite) {
    ctx.font = `800 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeText('!', e.x + side * (RADIUS + 10), bodyY - RADIUS);
    ctx.fillStyle = '#ffe066';
    ctx.fillText('!', e.x + side * (RADIUS + 10), bodyY - RADIUS);
  }
  ctx.restore();
}

function drawCatch(e, now) {
  if (!e.caught) return;
  const t = (now - e.caughtAt) / CATCH_MS;
  if (t >= 1) return;
  const y = headStack(e) - 5 - t * 30;

  ctx.save();
  ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
  drawFish(ctx, e.x - 5, y, 1.6, e.caught.color);
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeText(e.caught.name, e.x, y - 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(e.caught.name, e.x, y - 12);
  ctx.restore();
}

function drawNoteFx(now) {
  noteFx = noteFx.filter((n) => now - n.at < NOTE_FX_MS);
  ctx.save();
  ctx.font = `700 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  for (const n of noteFx) {
    const t = (now - n.at) / NOTE_FX_MS;
    const x = n.x + Math.sin(t * 7) * 5, y = n.y - t * 52;
    ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
    ctx.fillStyle = n.color;
    ctx.strokeText('♪', x, y);
    ctx.fillText('♪', x, y);
  }
  ctx.restore();
}

function drawCatEffects(c, now, showName) {
  const top = c.y - (c.coat.dog ? 18 : 0);  // 강아지는 귀가 높이 솟아 있어 이름과 말풍선을 더 위에 띄운다
  const t = (now - c.heartsAt) / HEARTS_MS;
  if (t < 1) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - t) * 2);
    for (const [dx, delay, size] of [[-12, 0, 1.2], [10, 0.15, 1], [0, 0.3, 1.4]]) {
      const local = clamp((t - delay) / (1 - delay), 0, 1);
      if (local > 0) drawHeart(c.x + dx + Math.sin(local * 8) * 3, top - 44 - local * 34, size, '#f0567c');
    }
    ctx.restore();
  }
  if (now < c.saysUntil) {
    ctx.font = `600 12px ${FONT}`;
    const w = ctx.measureText(c.says).width + 12;
    box(c.x - w / 2, top - 66, w, 20, 'rgba(255, 255, 255, 0.95)', 7);
    label(c.says, c.x, top - 55.5, `600 12px ${FONT}`, '#1b1b1b');
  } else if (showName) {
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(c.coat.name, c.x, top - 44);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(c.coat.name, c.x, top - 44);
  }
}

function seatFreeInReach(self, s, i) {
  return s.z === zone && Math.hypot(s.x - self.x, s.y - self.y) <= (s.lie ? terrain.bedReach : terrain.chairReach)
    && ![...entities.values()].some((e) => e.seat === i + 1);
}

function lampHint(self) {
  if (!roomLight) return '';
  const near = terrain.furnByZone[zone].some((f) => (f.k === 'floor_lamp' || f.k === 'lantern_lamp') && Math.hypot(f.x - self.x, f.y - self.y) <= terrain.lampReach);
  if (!near) return '';
  return roomLight.lamp ? 'L: 스탠드 끄기' : 'L: 스탠드 켜기';
}

// 내 캐릭터가 지금 할 수 있는 행동 안내. E 의 우선순위는 서버와 같다 (문, 스탠드, 자리).
function actionHint(self) {
  if (self.fish === 2) return '입질! F를 누르세요';
  if (self.fish === 1) return 'F: 낚싯대 거두기';
  const actions = [];
  const choice = useChoice(self);
  if (atPiano(self)) actions.push('Esc: 일어나기');
  else if (choice) actions.push(`E: ${choice.label}`);
  const lamp = lampHint(self);
  if (lamp) actions.push(lamp);
  if (tvInReach(self)) actions.push(isCinema() ? 'T: 스크린 조작' : tvPanelOpen ? 'T: TV 창 닫기' : 'T: TV 보기');
  if (inHouse() && !self.seat) actions.push('H: 가구 배치');
  else if (zone === 0 && !self.seat && nearHouseDoor(self)) actions.push('H: 마당에 텃밭 놓기');
  if (zone === 0 && waterDistance(self.x, self.y) <= terrain.fishReach) actions.push('F: 낚시');
  if (catInReach(self)) {
    actions.push('C: 쓰다듬기');
    if (myBag.some((n) => n > 0)) actions.push('X: 먹이 주기');
  }
  return actions.join(' · ');
}

function drawActionHint(self) {
  const text = actionHint(self);
  if (!text) return;
  const urgent = self.fish === 2;
  ctx.font = `600 12px ${FONT}`;
  const w = ctx.measureText(text).width + 16, h = 22;
  const top = self.y + RADIUS + 12 + (self.seat && self.legs ? LEG_LENGTH[self.legs] - 4 : 0);  // 늘어진 다리를 가리지 않게

  ctx.fillStyle = urgent ? '#ffe066' : 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(self.x - w / 2, top, w, h, 6);
  ctx.fill();
  ctx.fillStyle = urgent ? '#1b1b1b' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, self.x, top + h / 2 + 0.5);
}

// ------------------------------------------------------------ 한 프레임 그리기

function camera(vw, vh) {
  if (!me || !terrain) {
    const cx = me ? me.x : world.w / 2, cy = me ? me.y : world.h / 2;
    return [Math.round(cx - vw / 2), Math.round(cy - vh / 2)];
  }
  if (zone === 0) {   // 마을: 캐릭터를 따라가되 맵 밖의 빈 곳은 테두리 조금만 보이게. 화면이 맵보다 크면 맵을 가운데에
    const axis = (size, view, pos) => Math.round(size + 80 <= view ? (size - view) / 2 : clamp(pos - view / 2, -40, size + 40 - view));
    return [axis(world.w, vw, me.x), axis(world.h, vh, me.y)];
  }
  // 집 안: 방이 화면보다 작으면 가운데에 고정하고, 크면 캐릭터를 따라가되 방 밖을 보이지 않게 한다.
  const room = terrain.zones[zone];
  const axis = (lo, hi, view, pos) => Math.round(hi - lo <= view ? (lo + hi - view) / 2 : clamp(pos - view / 2, lo, hi - view));
  const seatedInCinema = isCinema() && entities.get(myId)?.seat > 0;  // 극장 좌석에 앉으면 스크린이 온전히 보이게
  return [axis((room.x0 || 0) - SIDE_WALL, room.w + SIDE_WALL, vw, me.x), axis((room.y0 || 0) - WALL_HEIGHT - 8, room.h + SIDE_WALL, vh, seatedInCinema ? 0 : me.y)];
}

function viewEntities() {
  const list = [];
  for (const [id, e] of entities) {
    const v = id === myId && me
      ? { ...e, x: me.x, y: me.y, dirX: me.dirX, dirY: me.dirY, moving: !!me.moving, id }
      : { ...e, id };
    const seat = seatInfo(v);
    if (v.fish) {  // 낚시 중에는 찌를, 앉으면 자리에 맞는 쪽을 바라본다
      const dist = Math.hypot(v.bx - v.x, v.by - v.y) || 1;
      v.dirX = (v.bx - v.x) / dist;
      v.dirY = (v.by - v.y) / dist;
    } else if (seat) {
      v.dirX = seat.fx;
      v.dirY = seat.fy;
    }
    list.push(v);
  }
  return list;
}

function buildScene(list, camX, camY, vw, vh, now, night) {
  const visible = (x, y, margin) => x > camX - margin && x < camX + vw + margin && y > camY - margin / 2 && y < camY + vh + margin * 1.5;

  // 아래쪽에 있는 것이 앞에 그려지도록 정렬. 앉은 캐릭터는 의자보다 앞에 온다.
  const scene = list.map((e) => ({ y: seatInfo(e)?.lie ? seatInfo(e).sy : e.y, draw: () => drawPlayer(e, e.id === myId, now) }));
  if (!terrain) return scene;

  for (const f of terrain.furnByZone[zone]) {
    if (FLOOR_FURNITURE.has(f.k) || WALL_FURNITURE.has(f.k) || !visible(f.x, f.y, 220)) continue;
    scene.push({ y: f.y - 1, draw: () => drawFurniturePiece(f, now, night) });
  }
  if (zone === 0) {
    const lampsOn = night > 0.3;
    for (const t of terrain.trees) {
      if (!visible(t.x, t.y, 180)) continue;
      const s = treeScale(t);
      const hiding = me && Math.abs(me.x - t.x) < 46 * s && me.y < t.y && me.y > t.y - 116 * s;
      scene.push({ y: t.y, draw: () => drawTree(t, hiding) });
    }
    for (const l of terrain.lamps) if (visible(l.x, l.y, 140)) scene.push({ y: l.y, draw: () => drawLamp(l, lampsOn) });
    for (const b of terrain.buildings) {
      if (b.in || !visible(b.x, b.y, 320)) continue;
      const ground = b.y + b.front;
      const hiding = me && Math.abs(me.x - b.x) < b.halfW + 10 && me.y < ground - 4 && me.y > ground - 190;
      scene.push({ y: ground, draw: () => drawBuilding(b, now, night, hiding) });
    }
  }
  if (CHRISTMAS) for (const d of XMAS_DECOR) if (decorHere(d) && visible(d.x, d.y, 280)) scene.push({ y: d.y, draw: () => drawDecor(d, now) });
  farmScene(scene, now);
  for (const c of cats) scene.push({ y: c.y, draw: () => (c.coat.dog ? drawDog : drawCat)(c, now) });
  for (const f of petFollowers.values()) if (visible(f.x, f.y, 80)) scene.push({ y: f.y, draw: () => (f.coat.dog ? drawDog : drawCat)(f, now) });
  for (const d of drops) if (visible(d.x, d.y, 40)) scene.push({ y: d.y - 1, draw: () => drawDrop(d, now) });
  scene.sort((a, b) => a.y - b.y);
  return scene;
}

function render() {
  const vw = innerWidth, vh = innerHeight;
  const now = performance.now();
  const night = nightAmount(now);
  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, vw, vh);

  const [camX, camY] = camera(vw, vh);
  ctx.save();
  ctx.translate(-camX, -camY);

  const room = terrain && zone > 0 ? terrain.zones[zone] : null;
  if (room) {
    drawRoomShell(room);
    const items = terrain.furnByZone[zone];
    drawRoomFurniture(items, (k) => FLOOR_FURNITURE.has(k), now, night);
    drawRoomFurniture(items, (k) => WALL_FURNITURE.has(k), now, night);
  } else {
    drawGround(camX, camY, vw, vh, now);
    if (terrain) drawRoomFurniture(terrain.furnByZone[0], (k) => FLOOR_FURNITURE.has(k), now, night);   // 마당의 텃밭
  }

  const list = viewEntities();
  for (const item of buildScene(list, camX, camY, vw, vh, now, night)) item.draw();

  if (!room && terrain && night > 0) drawNight(list, camX, camY, vw, vh, night);
  if (room && roomLight) drawRoomLighting(room, list, camX, camY, vw, vh);
  if (CHRISTMAS && terrain && !room) drawSnowfall(camX, camY, vw, vh, now, room ? room.w : world.w, room ? room.h : world.h, room ? -WALL_HEIGHT : 0);

  // 낚싯대와 말풍선이 다른 캐릭터나 어둠에 가려지지 않게 마지막에
  for (const e of list) if (e.fish) drawRod(e, now);
  if (boards.size) for (const e of [...list].sort((a, b) => a.y - b.y)) drawBoard(e);  // 가까운 캐릭터의 광고판이 앞에
  for (const e of list) drawBubble(e, now);
  drawDecorOverlay(now, night);
  for (const e of list) drawCatch(e, now);
  if (noteFx.length) drawNoteFx(now);
  if (damageFx.length) drawDamageFx(now);
  const self = list.find((e) => e.id === myId);
  if (self) {
    for (const c of cats) drawCatEffects(c, now, Math.hypot(c.x - self.x, c.y - self.y) < 150);
  }
  if (self && terrain && !touchMode) drawActionHint(self);  // 터치 화면에서는 오른쪽 아래 버튼이 안내를 대신한다
  ctx.restore();

  if (me && terrain) {
    const where = zone === 0
      ? (innerWidth > 640 ? `위치 (${Math.round(me.x)}, ${Math.round(me.y)})` : '')  // 휴대폰에서는 좌표를 빼서 한 줄에 맞춘다
      : terrain.buildings[terrain.zones[zone].b].k === 'house' ? `${terrain.buildings[terrain.zones[zone].b].name}의 집` : terrain.buildings[terrain.zones[zone].b].name;
    hud.textContent = [`접속자 ${onlineCount}명`, where, timeLabel(now)].filter(Boolean).join(' · ');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (offline) {   // 끊긴 동안은 마지막 화면을 그대로 둔다 (다시 그리지 않아 휴대폰 배터리와 CPU 를 아낀다)
    syncTouchPad();
    requestAnimationFrame(frame);
    return;
  }
  update(dt, now);
  // 전체화면 영상이 화면을 다 덮는 동안은 그 밑의 방을 그리지 않는다. 영상과 흘러가는 채팅이 끊기지 않게 CPU 와 GPU 를 비워 둔다.
  // 릴스는 세로 영상이라 양옆으로 방이 보이므로 그대로 그린다.
  const covered = cinemaFull && !!tvState && !tvState.reel;
  if (!covered) render();
  syncPianoPanel();
  syncPachinko(now);
  if (!furnShop.hidden && shopTab === 'ext') {
    if (exteriorTarget() !== extTarget) renderExtPane();
    drawExtPreview(now);
  }
  // 소식이 끊긴 연결: 화면이 돌고 있는 동안에만 센다. 탭을 뒤에 두었거나 기기가 잠들었다 깨어난 직후에는
  // 밀린 메시지를 받기도 전에 첫 화면이 그려져, 멀쩡한 연결을 죽은 것으로 보고 끊던 일이 있었다 (dt 는 한 번에 0.1초까지만 는다)
  if (lastStateAt !== staleSeen) {
    staleSeen = lastStateAt;
    staleMs = 0;
  } else {
    staleMs += dt * 1000;
  }
  if (myId !== null && !offline && ws && ws.readyState === WebSocket.OPEN && lastStateAt && staleMs > STALE_MS) {
    staleMs = 0;
    const dead = ws;
    dead.onclose = null;
    dead.onmessage = null;
    dead.close();
    lastStateAt = 0;
    goOffline();
  }
  syncTvVideo();
  if (!covered) drawMinimap(now);
  if (!shopEl.hidden && (!terrain || !me || !shopFurniture() || !shopInReach({ x: me.x, y: me.y }))) closeShop();
  Sound.setMusic(musicKey());
  Sound.tick(dt);
  syncCinemaHud(now);
  syncTouchPad();
  if (!dartsEl.hidden && !amInDarts() && (!terrain || !me || !dartInReach({ x: me.x, y: me.y }))) setDartsOpen(false);
  drawDartsPanel();
  if (!charEl.hidden) drawCharacterPreview(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
