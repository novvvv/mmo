'use strict';
// 캐릭터 정보(상태창).

// ------------------------------------------------------------ 캐릭터 정보

const profileEl = document.getElementById('profile');
const profileFace = document.getElementById('profile-face');
const profileName = document.getElementById('profile-name');
const profileSub = document.getElementById('profile-sub');
const profileStats = document.getElementById('profile-stats');

function toggleProfile() {
  if (!profileEl.hidden) {
    profileEl.hidden = true;
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send('stats');
}

function playTime(seconds) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

// 서버의 stats 메시지: s 는 [오목 승, 패, 무, 다트 우승, 다트 판, 낚은 물고기, (예전 슬라임), 접속 초, ...] (순서는 서버의 Stat)
function showProfile(msg) {
  const [omokW, omokL, omokD, dartW, dartG, fish, , seconds, arcadeW = 0, arcadeN = 0, bestShooter = 0, bestBricks = 0, minesClear = 0,
    chessW = 0, chessAi = 0, minesStage = 0, pachiJackpot = 0, pachiBest = 0, focusMin = 0, focusCount = 0, harvested = 0, cooked = 0, cookedPerfect = 0] = msg.s;
  const omokGames = omokW + omokL + omokD;
  profileName.textContent = msg.n;
  profileSub.textContent = msg.self ? '내 캐릭터' : '다른 사람의 캐릭터';
  const rows = [
    ['오목', `${omokW}승 ${omokL}패 ${omokD}무${omokGames ? ` (승률 ${Math.round((omokW / omokGames) * 100)}%)` : ''}`],
    ['다트', `${dartW}번 우승 / ${dartG}판`],
    ['오락기', `대전 ${arcadeW}승 / ${arcadeN}판`],
    ['오락기 최고 점수', `슈팅 ${bestShooter} · 벽돌 ${bestBricks}`],
    ['지뢰찾기', `${minesClear}판 성공${minesStage ? ` · 최고 ${minesStage}단계` : ''}`],
    ['체스', `사람에게 ${chessW}승 · 컴퓨터에게 ${chessAi}승`],
    ['낚은 물고기', `${fish}마리`],
    ['빠칭코', `대박 ${pachiJackpot}번${pachiBest ? ` · 최고 ${pachiBest}G` : ''}`],
    ['함께 집중', `${focusMin >= 60 ? `${Math.floor(focusMin / 60)}시간 ` : ''}${focusMin % 60}분 · 끝까지 ${focusCount}번`],
    ['농사와 요리', `거둔 작물 ${harvested}개 · 요리 ${cooked}번${cookedPerfect ? ` (★★★ ${cookedPerfect}번)` : ''}`],
    ['함께한 펫', `${msg.pets}마리`],
    ['동거인', `${msg.mates}명`],
    ['놓아 둔 가구', `${msg.placed}개`],
    ['접속 시간', playTime(seconds)],
  ];
  if (msg.self) rows.unshift(['골드', `${msg.g.toLocaleString()} G`], ['소지품의 가구', `${msg.furn}개`]);
  profileStats.textContent = '';
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    profileStats.append(dt, dd);
  }
  const a = msg.a || 0;
  const c = profileFace.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, profileFace.width, profileFace.height);
  c.setTransform(2.4, 0, 0, 2.4, profileFace.width / 2, profileFace.height * 0.72);
  drawCharacter(c, { x: 0, y: 0, color: msg.c, arms: a % 3, legs: Math.floor(a / 3) % 3, limbColor: Math.floor(a / 9), dirX: 0, dirY: 1, moving: false, seat: 0, grip: 0, t: 0 });
  const wasHidden = profileEl.hidden;
  profileEl.hidden = false;
  if (wasHidden) restoreWindow(profileEl, 'profile');
}
document.getElementById('profile-close').addEventListener('click', () => { profileEl.hidden = true; });
document.getElementById('profile-open').addEventListener('click', toggleProfile);
makeMovable(profileEl, document.getElementById('profile-head'), 'profile');
