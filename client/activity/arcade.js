'use strict';
// 오락기 창: 자리, 시작, 점수 보내기, 체스판과 체스 설명서. 게임 자체는 activity/arcade-games.js.

// ------------------------------------------------------------ 오락기
// 앞에서 E 를 누르면 창이 열린다. 1P·2P 자리에 앉아 시작하면 혼자 하거나 둘이 한다.
// 슈팅·벽돌깨기: 판을 돌리는 화면(1P, 혼자면 앉은 사람)이 점수를 0.4초마다 서버에 보내고, 함께 하는 2P 나 구경꾼이 있으면
// 판을 초당 15번 중계한다. 2P 는 자기 로켓·라켓 자리와 쏘는지를 보낸다. 지뢰찾기와 체스는 누른 칸·둔 수를 서버에 보내고
// 서버가 준 판을 그린다. 자리에 없는 사람은 구경한다.

const arcadeEl = document.getElementById('arcade');
const arcadeTitle = document.getElementById('arcade-title');
const arcadeScreenEl = document.getElementById('arcade-screen');
const arcadeCtx = arcadeScreenEl.getContext('2d');
const arcadePlayers = [document.getElementById('arcade-p1'), document.getElementById('arcade-p2')];
const arcadeStatus = document.getElementById('arcade-status');
const arcadeHelp = document.getElementById('arcade-help');
const arcadeJoin = [document.getElementById('arcade-join1'), document.getElementById('arcade-join2')];
const arcadeStart = document.getElementById('arcade-start');
const arcadeLeave = document.getElementById('arcade-leave');
const arcadeUndo = document.getElementById('arcade-undo');
const arcadeHint = document.getElementById('arcade-hint');
const arcadeGuide = document.getElementById('arcade-guide');
const ARCADE_REACH = 90;
const ARCADE_SYNC_MS = 66;    // 판을 중계하는 간격
const ARCADE_INPUT_MS = 50;   // 함께 하는 2P 가 조작을 보내는 간격
const ARCADE_HELP = [
  '← → (A D)로 움직이고 Space로 쏩니다. 화면을 누른 채 끌어도 돼요. 웨이브가 오를수록 슬라임이 빨라지고 여럿이 함께 내리꽂아요. 둘이 앉으면 한 화면에서 같이 싸워요!',
  '← → (A D)나 마우스로 라켓을 움직이고 Space나 클릭으로 공을 띄웁니다. 칠수록, 단계가 오를수록 공이 빨라져요. 둘이 앉으면 라켓 두 개로 같이 깨요!',
  '칸을 눌러 엽니다. 오른쪽 클릭(길게 누르기)으로 깃발을 꽂아요. 혼자면 깰 때마다 판이 커지는 다음 단계로! 둘이면 번갈아 열고, 지뢰를 찾으면 한 번 더. 지뢰를 더 많이 찾으면 이겨요.',
  '말을 누르면 움직이는 법과 갈 수 있는 칸이 보여요. 초록 점을 누르면 그리로 움직여요.',
];
const ARCADE_KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire' };
const arcadeStates = new Map();   // 배치 번호 → 서버가 보낸 판
const arcadeInput = { left: false, right: false, fire: false, pressed: false, pointerX: null };
const arcadeFlags = new Set();    // 지뢰찾기의 깃발 (내 화면에만)
let arcadeOpenId = null;
let arcadeSim = null;             // 이 화면이 돌리는 슈팅·벽돌깨기 (혼자 하거나, 함께 하는 판의 1P)
let arcadeView = null;            // 중계받아 보여 주는 판 (함께 하는 2P, 구경꾼)
let arcadeGuest = { x: null, fire: false, at: 0 };   // 1P 화면이 받은 2P 의 조작
const chessUi = { sel: -1, promo: null };            // 체스: 고른 말, 고르는 중인 프로모션
let arcadeFrame = 0, arcadeLast = 0, arcadeStatusAt = 0, arcadeHover = -1, arcadePress = null;

function arcadeState() {
  return arcadeOpenId === null ? null : arcadeStates.get(arcadeOpenId) || null;
}
function arcadeSide(st = arcadeState()) {
  return !st ? -1 : st.p[0] === myId ? 0 : st.p[1] === myId ? 1 : -1;
}
function arcadeGameOf(id) {
  const d = decorItems.find((item) => item.id === id);
  return d ? ARCADE_KINDS[d.info.k] : undefined;
}
function arcadeHostSide(st) {   // 슈팅·벽돌깨기 판을 돌리는 자리
  return st.p[0] ? 0 : 1;
}

function setArcadeOpen(id) {
  const was = arcadeOpenId;
  if (was !== null && was !== id && ws && ws.readyState === WebSocket.OPEN) {
    const st = arcadeStates.get(was);
    // 슈팅·벽돌깨기는 이 화면이 판을 돌리므로 하는 중에 창을 닫으면 자리에서 일어난다
    if (st && st.s === 1 && st.g < 2 && arcadeSide(st) >= 0) ws.send(`arcade leave ${was}`);
    ws.send(`arcade unlook ${was}`);
  }
  arcadeOpenId = id;
  arcadeEl.hidden = id === null;
  arcadeInput.left = arcadeInput.right = arcadeInput.fire = arcadeInput.pressed = false;
  arcadeView = null;
  chessUi.sel = -1;
  chessUi.promo = null;
  if (id !== null) {
    if (was === null) restoreWindow(arcadeEl, 'arcade');
    const game = arcadeGameOf(id) ?? 0;
    arcadeTitle.textContent = game === 3 ? '체스판' : `오락기 · ${ARCADE_TITLES[game]}`;
    arcadeEl.classList.toggle('chess', game === 3);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(`arcade look ${id}`);
    stopMoving();
    arcadeLast = 0;
    if (!arcadeFrame) arcadeFrame = requestAnimationFrame(arcadeTick);
    Sound.play('page');
  }
  renderArcadePanel();
}

function applyArcade(msg) {
  if (msg.off) {
    arcadeStates.delete(msg.id);
    if (arcadeOpenId === msg.id) setArcadeOpen(null);
    return;
  }
  const before = arcadeStates.get(msg.id);
  msg.at = performance.now();
  arcadeStates.set(msg.id, msg);
  if (msg.g === 2 && (before?.seed !== msg.seed || before?.st !== msg.st)) arcadeFlags.clear();
  if (msg.id !== arcadeOpenId) return;
  if (msg.g === 3 && (before?.np !== msg.np || before?.s !== msg.s || before?.seed !== msg.seed)) {   // 수가 바뀌었다
    chessUi.sel = -1;
    chessUi.promo = null;
    if (before?.cb && msg.cb && before.cb !== msg.cb) Sound.play([...msg.cb].filter((p) => p !== '.').length < [...before.cb].filter((p) => p !== '.').length ? 'hit' : 'place');
  }
  if (msg.s === 2 && before?.s === 1) {
    const side = arcadeSide(msg);
    if ((msg.vs && !msg.co && msg.w === side) || (msg.g === 3 && !msg.vs && msg.w === side)) Sound.play('catch');
  }
  if (msg.g === 2 && msg.nx && !before?.nx) Sound.play('catch');
  renderArcadePanel();
}

// 1P 화면이 중계한 판: 함께 하는 2P 와 구경꾼이 받아 그린다
function applyArcadeSync(msg) {
  const st = arcadeStates.get(msg.id);
  if (!st || msg.id !== arcadeOpenId || st.g > 1) return;
  let d;
  try {
    d = JSON.parse(msg.d);
  } catch {
    return;
  }
  const players = (st.g === 0 ? d.sh : d.p)?.length || 1;
  if (!arcadeView || arcadeView.id !== msg.id || arcadeView.seed !== st.seed) {
    const sim = st.g === 0 ? new ShooterGame(st.seed, players) : new BricksGame(st.seed, players);
    sim.remote = true;
    arcadeView = { id: msg.id, seed: st.seed, sim, acc: 0, lastInput: 0 };
  }
  arcadeView.sim.load(d, st.co && arcadeSide(st) === 1 ? 1 : -1);
}

function arcadeSeatName(st, i) {
  if (st.p[i]) return st.n[i];
  if (st.g === 3 && st.s > 0 && !st.vs && st.as === i) return `컴퓨터 ${st.ai}단계`;
  return '빈 자리';
}

function arcadeStatusText(st, side) {
  const both = st.p[0] && st.p[1];
  if (st.s === 0) {
    if (st.g === 3) {
      if (side < 0) return st.p[0] || st.p[1] ? '빈 자리에 앉으면 함께 둘 수 있어요.' : '1P는 백, 2P는 흑이에요. 혼자 앉으면 컴퓨터와 둬요.';
      return both ? '둘 다 앉았어요. 대국 시작을 누르세요!' : '혼자 시작하면 컴퓨터와 둬요. 다른 사람이 앉으면 사람끼리 둬요.';
    }
    if (side < 0) return st.p[0] || st.p[1] ? `빈 자리에 앉으면 함께 ${st.g < 2 ? '할' : '겨룰'} 수 있어요.` : '1P나 2P 자리에 앉아 보세요.';
    if (both) return st.g < 2 ? '둘 다 앉았어요. 같이 시작을 누르세요!' : '둘 다 앉았어요. 시작을 누르면 겨룹니다!';
    return '혼자 시작하거나 다른 사람이 앉기를 기다리세요.';
  }
  if (st.g === 3) return chessStatusText(st, side);
  if (st.s === 1) {
    if (st.g === 2) {
      if (!st.vs) return st.nx ? `${st.st}단계 성공! 다음 단계로…` : `${st.st}단계 · 지뢰 ${st.mc}개 · 깃발 ${arcadeFlags.size}개`;
      const left = Math.max(0, Math.ceil(st.tl - (performance.now() - st.at) / 1000));
      return st.tn === side ? `내 차례예요! (${left}초)` : `${st.n[st.tn]}님 차례 (${left}초)`;
    }
    const host = arcadeHostSide(st);
    if (st.co) return `함께 ${st.sc[host]}점${side < 0 ? ' · 구경하는 중' : ''}`;
    return side >= 0 ? `${st.sc[side]}점 · 플레이 중!` : `${st.n[host]}님이 하는 중 · ${st.sc[host]}점`;
  }
  if (st.g < 2) {
    const score = Math.max(st.sc[0], st.sc[1]);
    return `${st.co ? '함께 ' : ''}게임 오버 · ${score}점${st.why === 'stale' ? ' (화면이 멈춰 끝났어요)' : ''}`;
  }
  if (st.vs) {
    const why = st.why === 'leave' ? ' (상대가 일어났어요)' : '';
    return st.w === 2 ? `비겼습니다!${why}` : `${st.n[st.w] || (st.w ? '2P' : '1P')} 승리!${why}`;
  }
  return st.why === 'boom' ? `펑! ${st.st}단계에서 지뢰를 밟았어요.` : '판이 끝났어요.';
}

function chessStatusText(st, side) {
  const name = (color) => (!st.vs && st.as === color ? '컴퓨터' : `${st.n[color] || CHESS_SIDES[color]}님`);
  if (st.s === 1) {
    const left = st.vs ? Math.max(0, Math.ceil(st.tl - (performance.now() - st.at) / 1000)) : 0;
    const clock = st.vs && left <= 60 ? ` · ${left}초 남음` : '';
    const check = st.ck >= 0 ? '체크! ' : '';
    if (side === st.ct) return `${check}내 차례예요 (${CHESS_SIDES[side]})${st.ck >= 0 ? ' — 킹을 지키세요' : ''}${clock}`;
    if (!st.vs && st.as === st.ct) return `${check}컴퓨터(${st.ai}단계)가 생각하는 중…`;
    return `${check}${name(st.ct)} 차례 (${CHESS_SIDES[st.ct]})${clock}`;
  }
  const winner = st.w === 0 || st.w === 1 ? st.w : -1;
  const who = winner < 0 ? '' : side === winner ? '내가' : side >= 0 ? `${name(winner)}이` : `${CHESS_SIDES[winner]}(${name(winner)})이`;
  switch (st.why) {
    case 'mate': return `체크메이트! ${who} 이겼어요.`;
    case 'stalemate': return '스테일메이트 — 둘 곳은 없지만 체크가 아니라서 비겼어요.';
    case 'material': return '남은 말로는 아무도 이길 수 없어 비겼어요.';
    case 'fifty': return '50수 동안 잡지도 폰을 움직이지도 않아 비겼어요.';
    case 'repeat': return '같은 국면이 세 번 나와 비겼어요.';
    case 'time': return `시간 초과! ${who} 이겼어요.`;
    case 'leave': return side === winner ? '상대가 일어나서 이겼어요.' : '기권했어요.';
    default: return '대국이 끝났어요.';
  }
}

// 체스판 창 아래의 설명: 고른 말의 설명, 아니면 방금 둔 수와 위험한 말
function chessHelpText(st, side) {
  const board = st.cb || CHESS_START;
  if (chessUi.sel >= 0 && board[chessUi.sel] !== '.') {
    const piece = board[chessUi.sel], color = chessColorOf(piece), info = CHESS_INFO[piece.toLowerCase()];
    const lines = [`${CHESS_SIDES[color]} ${info.name} (${chessSquareName(chessUi.sel)}) · 가치 ${info.value}`, info.move, info.tip];
    if (st.s === 1 && color === side) {
      if (st.ct !== side) {
        lines.push('지금은 상대 차례예요. 내 차례가 되면 움직일 수 있어요.');
      } else {
        const n = chessMovesFrom(st, chessUi.sel).length;
        lines.push(n ? `초록 점으로 표시된 ${n}칸으로 갈 수 있어요.`
          : st.ck >= 0 ? '체크 중이라 이 말로는 킹을 지킬 수 없어요. 다른 말을 골라 보세요.'
          : '지금은 움직일 수 없어요. 길이 막혔거나, 움직이면 킹이 위험해져요.');
        if (st.hg?.includes(chessUi.sel)) lines.push('⚠ 이 말은 공격받는데 지켜 주는 말이 없어요!');
      }
    } else if (st.s === 1 && side >= 0) {
      lines.push('상대 말이에요. 파란 점은 이 말이 노리는 칸이에요.');
    }
    return lines.join('\n');
  }
  const lines = [ARCADE_HELP[3]];
  if (st.s > 0 && st.lm?.[0] >= 0) {
    const piece = board[st.lm[1]];
    if (piece && piece !== '.') lines.push(`방금 둔 수: ${CHESS_SIDES[chessColorOf(piece)]} ${CHESS_INFO[piece.toLowerCase()].name} ${chessSquareName(st.lm[0])} → ${chessSquareName(st.lm[1])}`);
  }
  if (st.s === 1 && st.ct === side && st.hg?.length) lines.push(`⚠ 빨간 ! 표시: 공격받는데 지켜 주는 말이 없는 내 말 ${st.hg.length}개`);
  if (st.s === 1 && st.hn?.[0] >= 0) lines.push(`힌트: ${chessSquareName(st.hn[0])} → ${chessSquareName(st.hn[1])} (파란 화살표)`);
  return lines.join('\n');
}

function renderArcadePanel() {
  const st = arcadeState();
  if (arcadeEl.hidden) return;
  if (!st) {
    arcadeStatus.textContent = '불러오는 중…';
    return;
  }
  const side = arcadeSide(st), playing = st.s === 1, chess = st.g === 3;
  for (let i = 0; i < 2; i++) {
    let extra = '';
    if (st.p[i] && playing && st.g < 2) extra = ` ${'♥'.repeat(st.lv[i])}`;
    if (st.g === 2 && st.vs && st.s > 0) extra = ` · 지뢰 ${st.f[i]}`;
    arcadePlayers[i].textContent = `${i + 1}P${chess ? ` ${CHESS_SIDES[i]}` : ''} ${arcadeSeatName(st, i)}${extra}`;
    arcadePlayers[i].classList.toggle('me', i === side);
    arcadePlayers[i].classList.toggle('turn', playing && ((st.g === 2 && st.vs && st.tn === i) || (chess && st.ct === i)));
    arcadeJoin[i].hidden = side >= 0 || playing || !!st.p[i];
    arcadeJoin[i].textContent = chess ? `${i + 1}P 앉기 (${CHESS_SIDES[i]})` : `${i + 1}P 앉기`;
  }
  const both = st.p[0] && st.p[1];
  arcadeStart.hidden = side < 0 || playing;
  arcadeStart.textContent = st.s === 2 ? '한 판 더' : chess ? (both ? '대국 시작' : '컴퓨터와 두기') : both ? (st.g < 2 ? '같이 시작' : '둘이 겨루기') : '혼자 시작';
  arcadeLeave.hidden = side < 0;
  arcadeLeave.textContent = chess && playing ? '기권' : '일어나기';
  const solo = chess && playing && side >= 0 && !st.vs;
  arcadeUndo.hidden = !solo;
  arcadeUndo.disabled = !(st.np >= (st.ct === side ? 2 : 1));
  arcadeHint.hidden = !solo;
  arcadeHint.disabled = st.ct !== side;
  arcadeGuide.hidden = !chess;
  arcadeStatus.textContent = arcadeStatusText(st, side);
  arcadeHelp.textContent = chess ? chessHelpText(st, side) : ARCADE_HELP[st.g];
}

// 아무도 안 할 때의 손님 끌기 화면
function drawArcadeAttract(c, game, now) {
  c.fillStyle = ['#07081c', '#10161f', '#c3c7cf'][game];
  c.fillRect(0, 0, ARCADE_W, ARCADE_H);
  if (game === 0) {
    for (let i = 0; i < 40; i++) c.fillRect((i * 53) % ARCADE_W, (i * 97 + now / 30) % ARCADE_H, 1, 1 + (i % 2));
    for (let i = 0; i < 5; i++) drawSpaceSlime(c, 40 + i * 40, 120 + Math.sin(now / 400 + i) * 6, SLIME_ROWS[i % 3], now / 1000 + i);
    drawCatRocket(c, ARCADE_W / 2 - 30 + Math.sin(now / 600) * 40, 260, now / 1000, 1, ARCADE_PLAYER_COLORS[0]);
    drawCatRocket(c, ARCADE_W / 2 + 30 + Math.sin(now / 700 + 1) * 40, 260, now / 1000, 1, ARCADE_PLAYER_COLORS[1]);
  } else if (game === 1) {
    for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
      c.fillStyle = BRICK_COLORS[row];
      c.fillRect(BRICK_LEFT + col * (BRICK_W + BRICK_GAP), 60 + row * 12, BRICK_W, BRICK_H);
    }
  } else {
    for (let i = 0; i < 64; i++) {
      c.fillStyle = (i + Math.floor(now / 300)) % 9 ? '#d7dae2' : '#eceef2';
      c.fillRect(24 + (i % 8) * 24, 80 + Math.floor(i / 8) * 24, 22, 22);
    }
  }
  const ink = game === 2 ? '#23202a' : '#ffffff';
  arcadeText(c, ARCADE_TITLES[game], ARCADE_W / 2, 40, 22, game === 2 ? '#2f5038' : '#ffd84d');
  if (Math.floor(now / 600) % 2) arcadeText(c, game < 2 ? '혼자 또는 둘이 함께!' : '자리에 앉아 시작!', ARCADE_W / 2, game === 2 ? 300 : 200, 12, ink);
}

// 구경하는 사람이 중계를 받기 전: 점수판
function drawArcadeScoreboard(c, st, now) {
  drawArcadeAttract(c, st.g, now);
  if (st.s === 0) return;
  c.fillStyle = 'rgba(0, 0, 0, 0.6)';
  c.fillRect(20, 130, ARCADE_W - 40, 90);
  if (st.co) {
    arcadeText(c, `${st.n[0]} · ${st.n[1] || '1P 혼자'}`, ARCADE_W / 2, 155, 11, '#ffd84d');
    arcadeText(c, `함께 ${st.sc[0]}점`, ARCADE_W / 2, 185, 13, '#ffffff');
    return;
  }
  for (let i = 0; i < 2; i++) {
    if (!st.p[i]) continue;
    arcadeText(c, `${i + 1}P ${st.n[i]}`, ARCADE_W / 2, 150 + i * 36, 11, ARCADE_PLAYER_COLORS[i]);
    arcadeText(c, `${st.sc[i]}점 ${'♥'.repeat(st.lv[i])}`, ARCADE_W / 2, 165 + i * 36, 11, '#ffffff');
  }
}

function drawArcadeOverlay(c, st, side) {
  if (st.s !== 2) return;
  if (st.g === 3) {   // 체스: 판 가운데에 결과
    const draw = st.w === 2;
    const title = st.why === 'mate' ? '체크메이트!' : draw ? '무승부' : st.why === 'time' ? '시간 초과' : st.why === 'leave' ? '기권' : '대국 끝';
    const sub = draw ? '비겼어요' : side < 0 ? `${CHESS_SIDES[st.w]} 승리` : st.w === side ? '이겼어요!' : '졌어요';
    c.fillStyle = 'rgba(30, 20, 14, 0.78)';
    c.fillRect(20, ARCADE_H / 2 - 30, ARCADE_W - 40, 58);
    arcadeText(c, title, ARCADE_W / 2, ARCADE_H / 2 - 10, 18, st.w === side ? '#ffd84d' : '#ffffff');
    arcadeText(c, sub, ARCADE_W / 2, ARCADE_H / 2 + 14, 11, '#f2e2c4');
    return;
  }
  c.fillStyle = 'rgba(0, 0, 0, 0.62)';
  c.fillRect(0, ARCADE_H / 2 - 30, ARCADE_W, 60);
  const duel = st.vs && !st.co;
  const won = duel && st.w === side, lost = duel && side >= 0 && st.w !== side && st.w !== 2;
  const title = duel ? (st.w === 2 ? 'DRAW' : side < 0 ? `${st.w + 1}P WIN` : won ? 'YOU WIN!' : 'YOU LOSE') : st.g === 2 && st.why === 'boom' ? 'BOOM!' : 'GAME OVER';
  arcadeText(c, title, ARCADE_W / 2, ARCADE_H / 2 - 8, 20, won ? '#ffd84d' : lost ? '#ff8fa0' : '#ffffff');
  if (st.g < 2) arcadeText(c, `${st.co ? '함께 ' : ''}${Math.max(st.sc[0], st.sc[1])}점`, ARCADE_W / 2, ARCADE_H / 2 + 16, 12, '#ffffff');
  else if (!st.vs) arcadeText(c, `${st.st}단계까지 왔어요`, ARCADE_W / 2, ARCADE_H / 2 + 16, 12, '#ffffff');
}

// 슈팅·벽돌깨기 한 장면: 판을 돌리는 화면이면 돌리고 보내고, 아니면 중계받은 판을 미리 움직여 그린다
function arcadeActionFrame(c, st, side, dt, now) {
  const host = side >= 0 && side === arcadeHostSide(st);
  const key = `${st.id}:${st.seed}`;
  if (host && st.s === 1 && arcadeSim?.key !== key) {
    const players = st.co ? 2 : 1;
    arcadeSim = { key, sim: st.g === 0 ? new ShooterGame(st.seed, players) : new BricksGame(st.seed, players), lastSent: 0, lastSync: 0, sentOver: false, acc: 0 };
    arcadeGuest = { x: null, fire: false, at: 0 };
  }
  if (host && arcadeSim?.key === key && st.s > 0) {
    const sim = arcadeSim.sim;
    if (st.s === 1) {
      if (st.co && !st.p[1]) sim.dropPlayer(1);   // 함께 하던 2P 가 일어났다
      const guest = st.co ? { dx: 0, x: arcadeGuest.x, fire: arcadeGuest.fire && now - arcadeGuest.at < 600 } : null;
      arcadeSim.acc += dt;
      while (arcadeSim.acc >= 1 / 60) {   // 화면 주사율과 상관없이 같은 빠르기로
        sim.step(1 / 60, [sim.control(arcadeInput, 0), guest]);
        arcadeSim.acc -= 1 / 60;
      }
    }
    sim.draw(c);
    if (st.s === 1 && !arcadeSim.sentOver) {
      const units = sim.units;
      if (now - arcadeSim.lastSent > 400 || sim.over) {
        ws.send(`arcade score ${st.id} ${sim.score} ${units[0].lives} ${sim.over ? 1 : 0} ${units[1]?.lives ?? 0}`);
        arcadeSim.lastSent = now;
      }
      if ((st.co || st.wc > 0) && (now - arcadeSim.lastSync > ARCADE_SYNC_MS || sim.over)) {
        ws.send(`arcade sync ${st.id} ${JSON.stringify(sim.save())}`);
        arcadeSim.lastSync = now;
      }
      if (sim.over) arcadeSim.sentOver = true;
    }
    return;
  }
  const view = arcadeView?.id === st.id && arcadeView.seed === st.seed ? arcadeView : null;
  if (view && st.s > 0) {
    const sim = view.sim, mine = st.co && side === 1 ? 1 : -1;
    if (st.s === 1 && !sim.over) {
      view.acc += dt;
      while (view.acc >= 1 / 60) {
        const controls = sim.units.map((u, i) => (i === mine ? sim.control(arcadeInput, i) : { dx: u.dx || 0, x: null, fire: false }));
        sim.step(1 / 60, controls);
        view.acc -= 1 / 60;
      }
      if (mine >= 0 && now - view.lastInput > ARCADE_INPUT_MS) {
        ws.send(`arcade in ${st.id} ${sim.units[mine].x.toFixed(1)} ${arcadeInput.fire || arcadeInput.pressed ? 1 : 0}`);
        view.lastInput = now;
      }
    }
    sim.draw(c);
    return;
  }
  drawArcadeScoreboard(c, st, now);
}

// ---- 체스

function chessMoves(st) {   // 서버가 보낸 둘 수 있는 수 ("출발.도착", 프로모션은 뒤에 p)
  if (!st._moves) {
    st._moves = (st.cm || '').split(',').filter(Boolean).map((m) => {
      const promo = m.endsWith('p');
      const [from, to] = (promo ? m.slice(0, -1) : m).split('.').map(Number);
      return { from, to, promo };
    });
  }
  return st._moves;
}
const chessMovesFrom = (st, sq) => chessMoves(st).filter((m) => m.from === sq);

function chessView(st, side, now) {
  const flip = side === 1;   // 흑을 잡으면 흑이 아래에 온다
  const board = st.cb || CHESS_START;
  let targets = [], pattern = [];
  if (chessUi.sel >= 0 && board[chessUi.sel] !== '.') {
    const piece = board[chessUi.sel];
    if (chessColorOf(piece) === side && st.s === 1 && st.ct === side) {
      targets = chessMovesFrom(st, chessUi.sel).map((m) => ({ to: m.to, capture: board[m.to] !== '.' || (piece.toLowerCase() === 'p' && (m.to & 7) !== (chessUi.sel & 7)) }));
    } else {
      pattern = chessPattern(board, chessUi.sel);
    }
  }
  const top = flip ? 0 : 1, bottom = 1 - top;
  const label = (color) => `${CHESS_SIDES[color]} · ${arcadeSeatName(st, color)}${color === side ? ' (나)' : ''}`;
  const clock = (color) => {
    if (!st.vs || st.s !== 1 || st.ct !== color) return '';
    const left = Math.max(0, Math.ceil(st.tl - (now - st.at) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  };
  return { side, flip, sel: chessUi.sel, targets, pattern, promo: chessUi.promo, labels: [label(top), label(bottom)], clocks: [clock(top), clock(bottom)] };
}

function chessClick(lx, ly) {
  const st = arcadeState();
  if (!st) return;
  const side = arcadeSide(st);
  if (chessUi.promo) {
    const choice = chessPromoAt(lx, ly);
    if (choice) ws.send(`arcade move ${st.id} ${chessUi.promo.from} ${chessUi.promo.to} ${choice}`);
    chessUi.promo = null;
    return;
  }
  const board = st.cb || CHESS_START;
  const sq = chessSquareAt(lx, ly, side === 1);
  if (sq >= 0 && chessUi.sel >= 0 && st.s === 1 && side === st.ct) {
    const move = chessMovesFrom(st, chessUi.sel).find((m) => m.to === sq);
    if (move) {
      if (move.promo) chessUi.promo = { from: chessUi.sel, to: sq };
      else ws.send(`arcade move ${st.id} ${chessUi.sel} ${sq}`);
      chessUi.sel = -1;
      renderArcadePanel();
      return;
    }
  }
  chessUi.sel = sq >= 0 && board[sq] !== '.' && sq !== chessUi.sel ? sq : -1;
  renderArcadePanel();
}

function arcadeTick(now) {
  arcadeFrame = 0;
  if (arcadeOpenId === null) return;
  arcadeFrame = requestAnimationFrame(arcadeTick);
  const dt = arcadeLast ? Math.min(0.05, (now - arcadeLast) / 1000) : 0;
  arcadeLast = now;
  const c = arcadeCtx, st = arcadeState();
  c.setTransform(arcadeScreenEl.width / ARCADE_W, 0, 0, arcadeScreenEl.height / ARCADE_H, 0, 0);
  if (!st) {
    const game = arcadeGameOf(arcadeOpenId) ?? 0;
    if (game === 3) {
      const empty = { s: 0, g: 3, p: [0, 0], n: ['', ''], cb: CHESS_START };
      drawChessScreen(c, empty, chessView(empty, -1, now), now);
    } else {
      drawArcadeAttract(c, game, now);
    }
    return;
  }
  const side = arcadeSide(st);
  if (st.g === 3) drawChessScreen(c, st, chessView(st, side, now), now);
  else if (st.g === 2) {
    if (st.b) drawMinesBoard(c, st, arcadeFlags, side >= 0 && st.s === 1 ? arcadeHover : -1);
    else drawArcadeAttract(c, 2, now);
  } else {
    arcadeActionFrame(c, st, side, dt, now);
  }
  drawArcadeOverlay(c, st, side);
  if (now - arcadeStatusAt > 250) {
    arcadeStatusAt = now;
    renderArcadePanel();
  }
}

function arcadeKey(e, down) {
  if (arcadeOpenId === null) return false;
  if (down && e.key === 'Escape') {
    if (chessUi.promo || chessUi.sel >= 0) {   // 체스: 먼저 고른 말을 놓는다
      chessUi.promo = null;
      chessUi.sel = -1;
      renderArcadePanel();
    } else {
      setArcadeOpen(null);
    }
    return true;
  }
  const st = arcadeState();
  if (!st || st.g >= 2 || st.s !== 1 || arcadeSide(st) < 0) return false;
  const action = ARCADE_KEYMAP[e.code];
  if (!action && e.code !== 'KeyS' && e.code !== 'ArrowDown') return false;
  e.preventDefault();
  if (action) {
    arcadeInput[action] = down;
    if (action !== 'fire') arcadeInput.pointerX = null;   // 키로 움직이면 마우스 위치는 잊는다
  }
  return true;
}

function arcadePoint(e) {
  const r = arcadeScreenEl.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * ARCADE_W, ((e.clientY - r.top) / r.height) * ARCADE_H];
}

function arcadeDig(cell) {
  const st = arcadeState();
  if (!st || st.s !== 1 || st.nx || arcadeSide(st) < 0 || st.b[cell] !== '.' || arcadeFlags.has(cell)) return;
  ws.send(`arcade dig ${st.id} ${cell}`);
}

function arcadeFlag(cell) {
  const st = arcadeState();
  if (!st || st.s !== 1 || st.b[cell] !== '.') return;
  if (arcadeFlags.has(cell)) arcadeFlags.delete(cell);
  else arcadeFlags.add(cell);
  renderArcadePanel();
}

arcadeScreenEl.addEventListener('pointerdown', (e) => {
  const st = arcadeState();
  if (!st) return;
  e.preventDefault();
  const [lx, ly] = arcadePoint(e);
  if (st.g === 3) {
    chessClick(lx, ly);
    return;
  }
  if (st.g === 2) {
    const cell = minesCellAt(st, lx, ly);
    if (cell < 0) return;
    if (e.button === 2) arcadeFlag(cell);
    else if (e.pointerType === 'touch') arcadePress = { cell, timer: setTimeout(() => { arcadeFlag(cell); arcadePress = null; }, 450) };   // 길게 누르면 깃발
    else arcadeDig(cell);
    return;
  }
  arcadeInput.pressed = true;
  arcadeInput.pointerX = lx;
  arcadeScreenEl.setPointerCapture(e.pointerId);
});
arcadeScreenEl.addEventListener('pointermove', (e) => {
  const st = arcadeState();
  if (!st) return;
  const [lx, ly] = arcadePoint(e);
  if (st.g === 2) arcadeHover = minesCellAt(st, lx, ly);
  else if (st.g < 2 && (arcadeInput.pressed || (st.g === 1 && e.pointerType === 'mouse'))) arcadeInput.pointerX = lx;
});
const arcadeRelease = () => {
  if (arcadePress) {   // 짧게 눌렀다 뗐다: 연다
    clearTimeout(arcadePress.timer);
    arcadeDig(arcadePress.cell);
    arcadePress = null;
  }
  arcadeInput.pressed = false;
  if (arcadeState()?.g === 0) arcadeInput.pointerX = null;
};
arcadeScreenEl.addEventListener('pointerup', arcadeRelease);
arcadeScreenEl.addEventListener('pointercancel', arcadeRelease);
arcadeScreenEl.addEventListener('pointerleave', () => { arcadeHover = -1; });
arcadeScreenEl.addEventListener('contextmenu', (e) => e.preventDefault());
arcadeJoin.forEach((button, slot) => button.addEventListener('click', () => ws.send(`arcade join ${arcadeOpenId} ${slot}`)));
arcadeStart.addEventListener('click', () => {
  ws.send(`arcade start ${arcadeOpenId}`);
  arcadeScreenEl.focus?.();
});
arcadeLeave.addEventListener('click', () => ws.send(`arcade leave ${arcadeOpenId}`));
arcadeUndo.addEventListener('click', () => ws.send(`arcade undo ${arcadeOpenId}`));
arcadeHint.addEventListener('click', () => ws.send(`arcade hint ${arcadeOpenId}`));
arcadeGuide.addEventListener('click', () => {   // 고른 말이 있으면 그 말의 쪽을 펼친다
  const board = arcadeState()?.cb || CHESS_START;
  const kind = chessUi.sel >= 0 ? board[chessUi.sel].toLowerCase() : null;
  const page = CHESS_GUIDE.findIndex((p) => p.piece === kind);
  setChessGuideOpen(true, page >= 0 ? page : CHESS_GUIDE.length - 1);
});
document.getElementById('arcade-close').addEventListener('click', () => setArcadeOpen(null));
makeMovable(arcadeEl, document.getElementById('arcade-head'), 'arcade');

// ------------------------------------------------------------ 체스 설명서
// 아이템창의 「체스 설명서」를 누르거나 체스판 창의 「설명서」로 연다. 쪽마다 그림과 설명이 있고, 말 쪽의 초록 점은 그 말이 갈 수 있는 칸이다.

const guideEl = document.getElementById('chess-guide');
const guideTabs = document.getElementById('chess-guide-tabs');
const guideTitle = document.getElementById('chess-guide-title');
const guideBoard = document.getElementById('chess-guide-board');
const guideText = document.getElementById('chess-guide-text');
const guidePageLabel = document.getElementById('chess-guide-page');
let guidePage = 0;

CHESS_GUIDE.forEach((page, i) => {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'rtab';
  tab.tabIndex = -1;
  tab.setAttribute('role', 'tab');
  tab.textContent = page.tab;
  tab.addEventListener('click', () => showGuidePage(i));
  guideTabs.append(tab);
});

function setChessGuideOpen(open, page = guidePage) {
  if (!open) {
    guideEl.hidden = true;
    return;
  }
  if (guideEl.hidden) restoreWindow(guideEl, 'chess-guide');
  guideEl.hidden = false;
  showGuidePage(page);
  Sound.play('page');
}

function showGuidePage(i) {
  guidePage = (i + CHESS_GUIDE.length) % CHESS_GUIDE.length;
  const page = CHESS_GUIDE[guidePage];
  [...guideTabs.children].forEach((tab, k) => tab.setAttribute('aria-selected', String(k === guidePage)));
  guideTitle.textContent = page.piece ? `${page.title} — 가치 ${CHESS_INFO[page.piece].value}` : page.title;
  guideBoard.hidden = !page.board;
  if (page.board) {
    const c = guideBoard.getContext('2d');
    c.setTransform(guideBoard.width / 240, 0, 0, guideBoard.height / 240, 0, 0);
    drawChessGuideBoard(c, page);
  }
  const info = page.piece ? CHESS_INFO[page.piece] : null;
  const lines = info ? [`움직임: ${info.move}`, `요령: ${info.tip}`, page.extra, page.piece === 'k' ? '킹은 값을 매길 수 없어요. 잡히게 되면(체크메이트) 지니까요.' : `가치 ${info.value}: 폰 ${info.value}개만큼의 힘이에요.`] : page.text;
  guideText.replaceChildren(...lines.map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  guidePageLabel.textContent = `${guidePage + 1} / ${CHESS_GUIDE.length}`;
}

document.getElementById('chess-guide-prev').addEventListener('click', () => showGuidePage(guidePage - 1));
document.getElementById('chess-guide-next').addEventListener('click', () => showGuidePage(guidePage + 1));
document.getElementById('chess-guide-close').addEventListener('click', () => setChessGuideOpen(false));
makeMovable(guideEl, document.getElementById('chess-guide-head'), 'chess-guide');
