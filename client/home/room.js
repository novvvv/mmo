'use strict';
// 방 안의 공용 물건: 조명, 피아노, 레코드판, 벽의 포스터.

// ------------------------------------------------------------ 방 조명 조작

function showLevel(level) {
  lightLevel.value = level;
  lightLevelValue.textContent = `${level}%`;
}

function adjustingLevel() {
  return document.activeElement === lightLevel || lightLevel.matches(':active');
}

function applyLight(msg) {
  roomLight = { on: msg.on, lamp: msg.lamp, level: msg.lv };
  lightPanel.hidden = false;
  syncLampRow();
  lightRoom.checked = msg.on;
  lightLamp.checked = msg.lamp;
  if (adjustingLevel()) roomLight.level = Number(lightLevel.value);  // 움직이는 중인 슬라이더를 되돌리지 않는다
  else showLevel(msg.lv);
}

function clearLight() {
  roomLight = null;
  lightPanel.hidden = true;
}

function sendLight(key, value) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`light ${key} ${value}`);
}

function flushLevel() {
  clearTimeout(levelTimer);
  levelTimer = null;
  levelSentAt = performance.now();
  sendLight('level', lightLevel.value);
}

lightRoom.addEventListener('change', () => {
  if (roomLight) roomLight.on = lightRoom.checked;
  sendLight('room', lightRoom.checked ? 1 : 0);
  releaseFocus(lightRoom);
});
lightLamp.addEventListener('change', () => {
  if (roomLight) roomLight.lamp = lightLamp.checked;
  sendLight('lamp', lightLamp.checked ? 1 : 0);
  releaseFocus(lightLamp);
});
lightLevel.addEventListener('input', () => {
  const level = Number(lightLevel.value);
  lightLevelValue.textContent = `${level}%`;
  if (roomLight) roomLight.level = level;  // 내 화면은 바로 바꾸고, 서버에는 간격을 두고 보낸다
  if (levelTimer === null) levelTimer = setTimeout(flushLevel, Math.max(0, LEVEL_SEND_MS - (performance.now() - levelSentAt)));
});
lightLevel.addEventListener('change', () => {
  flushLevel();
  releaseFocus(lightLevel);
});

// ------------------------------------------------------------ 피아노

// 브라우저는 사용자가 무언가를 누른 뒤에야 소리를 허용한다. 연주를 듣기만 하는 사람도 로그인할 때 이미 눌렀다.
function unlockAudio() {
  if (!audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audio = new AudioContextClass();
    audioOut = audio.createGain();
    audioOut.gain.value = 0.6;
    const limiter = audio.createDynamicsCompressor();  // 여러 음이 겹쳐도 소리가 깨지지 않게
    audioOut.connect(limiter);
    limiter.connect(audio.destination);
    const imag = Float32Array.from(PIANO_PARTIALS);
    pianoWave = audio.createPeriodicWave(new Float32Array(imag.length), imag);
  }
  if (audio.state === 'suspended') audio.resume();
}
addEventListener('keydown', unlockAudio, true);
addEventListener('pointerdown', unlockAudio, true);

function playPianoNote(index) {
  if (!audio || audio.state !== 'running') return;
  const t = audio.currentTime;
  const decay = 2.2 - index * 0.04;  // 높은음일수록 빨리 사라진다
  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(0.0001, t);
  envelope.gain.exponentialRampToValueAtTime(0.3, t + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  envelope.connect(audioOut);
  for (const detune of [-2, 2]) {  // 현을 두 줄 치는 것처럼 살짝 어긋나게
    const osc = audio.createOscillator();
    osc.setPeriodicWave(pianoWave);
    osc.frequency.value = PIANO_BASE_HZ * 2 ** (index / 12);
    osc.detune.value = detune;
    osc.connect(envelope);
    osc.start(t);
    osc.stop(t + decay);
  }
}

function addNoteFx(index) {
  if (!terrain) return;
  const piano = terrain.furnByZone[zone].find((f) => f.k === 'piano');
  if (!piano) return;
  noteFx.push({ x: piano.x - 60 + index * 7.5, y: piano.y - 44, at: performance.now(), color: `hsl(${(index * 37) % 360}, 75%, 50%)` });
  if (noteFx.length > NOTE_FX_MAX) noteFx.shift();
}

function atPiano(e) {
  return !!terrain && !!e && e.seat > 0 && e.seat === terrain.pianoSeat + 1;
}

// 의자에 앉아 있는 동안만 건반 창이 열린다. 서버가 알려 주는 자리를 그대로 따른다.
function syncPianoPanel() {
  const open = atPiano(entities.get(myId));
  if (pianoEl.hidden === open) pianoEl.hidden = !open;
}

const pianoKeyEls = PIANO_KEYS.map(([, label, black], index) => {
  const key = document.createElement('div');
  key.className = `piano-key ${black ? 'black' : 'white'}`;
  key.dataset.note = index;
  key.textContent = label;
  if (black) key.style.setProperty('--at', PIANO_KEYS.slice(0, index).filter((k) => !k[2]).length);
  pianoKeys.append(key);
  return key;
});
const PIANO_NOTE_BY_CODE = new Map(PIANO_KEYS.map(([code], index) => [code, index]));

function pressPiano(index) {
  unlockAudio();
  playPianoNote(index);  // 내 소리는 서버를 기다리지 않는다
  addNoteFx(index);
  const key = pianoKeyEls[index];
  key.classList.add('down');
  setTimeout(() => key.classList.remove('down'), 160);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`note ${index}`);
}

pianoKeys.addEventListener('pointerdown', (e) => {
  const key = e.target.closest('[data-note]');
  if (key) pressPiano(Number(key.dataset.note));
});
pianoLeave.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send('use');
  pianoLeave.blur();
});

// ------------------------------------------------------------ 재즈바 레코드판

const jazzEl = document.getElementById('jazz');
const jazzVideo = document.getElementById('jazz-video');
const jazzNow = document.getElementById('jazz-now');
const jazzSound = document.getElementById('jazz-sound');
const jazzMute = document.getElementById('jazz-mute');
const jazzVolume = document.getElementById('jazz-volume');
const jazzMore = document.getElementById('jazz-more');
const jazzList = document.getElementById('jazz-list');
const jazzForm = document.getElementById('jazz-form');
const jazzUrl = document.getElementById('jazz-url');
const jazzNote = document.getElementById('jazz-note');
const jazzClose = document.getElementById('jazz-close');
const jazzControls = document.getElementById('jazz-controls');
const jazzToggle = document.getElementById('jazz-toggle');
const jazzListToggle = document.getElementById('jazz-list-toggle');
const JAZZ_SKIP_MS = 3000;  // 틀 수 없는 곡을 건너뛰기까지 기다리는 시간

let jazzState = null;       // { gen, i, pos, at, stop, list: [[영상 ID, 제목], ...] }. 레코드판이 있는 방(재즈바, 레코드 플레이어를 놓은 집)에서만 있다
let jazzPlayer = null;
let jazzPlayerReady = false;
let jazzPlayerPending = false;
let jazzLoadedGen = null;
let jazzSkipTimer = 0;
let jazzPanelOpen = false;

function sendJazz(command) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`jazz ${command}`);
}

// 지금 나오는 곡. 정지해 두었으면 없다.
function jazzTrack() {
  return jazzState && !jazzState.stop ? jazzState.list[jazzState.i] : undefined;
}

function jazzExpected() {
  return jazzState.pos + (performance.now() - jazzState.at) / 1000;
}

// ------------------------------------------------------------ 벽의 포스터

// 화면 좌표의 지점에 있는 포스터. 없으면 undefined.
function posterAt(screenX, screenY) {
  if (!terrain || myId === null) return undefined;
  const [camX, camY] = camera(innerWidth, innerHeight);
  const x = screenX + camX, y = screenY + camY;
  return terrain.furnByZone[zone].find((f) => f.k === 'nimda_poster' && Math.abs(f.x - x) <= POSTER_SIZE.w / 2 + 3 && Math.abs(f.y - y) <= POSTER_SIZE.h / 2 + 3);
}

canvas.addEventListener('click', (e) => {
  if (handleDecorClick(e.clientX, e.clientY)) return;
  if (posterAt(e.clientX, e.clientY)) posterView.hidden = false;
  else if (touchMode) openPlayerMenu(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e) => {
  if (terrain && myId !== null) {
    const [camX, camY] = camera(innerWidth, innerHeight);
    mouseWorld = { x: e.clientX + camX, y: e.clientY + camY };
  }
  canvas.style.cursor = posterAt(e.clientX, e.clientY) ? 'zoom-in' : '';
});
posterView.addEventListener('click', () => { posterView.hidden = true; });

function destroyJazzPlayer() {
  clearTimeout(jazzSkipTimer);
  if (jazzPlayer) jazzPlayer.destroy();
  jazzPlayer = null;
  jazzPlayerReady = false;
  jazzLoadedGen = null;
  jazzVideo.textContent = '';
}

// 곡이 끝나면 서버에 알린다. 다음 곡은 서버가 정해서 방 전체에 보낸다.
function createJazzPlayer(YT) {
  const mount = document.createElement('div');
  jazzVideo.append(mount);
  jazzLoadedGen = jazzState.gen;
  jazzPlayer = new YT.Player(mount, {
    width: '100%',
    height: '100%',
    videoId: jazzTrack()[0],
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin, start: Math.floor(jazzExpected()) },
    events: {
      onReady() {
        jazzPlayerReady = true;
        applyJazzSound();
        jazzPlayer.playVideo();
        playJazz();
      },
      onStateChange(e) {
        if (e.data === YT.PlayerState.ENDED && jazzState) sendJazz(`next ${jazzState.gen}`);
        if (e.data === YT.PlayerState.PLAYING) {
          jazzNote.textContent = '';
          applyJazzSound();   // 다음 곡으로 넘어가도 음소거를 그대로
        }
      },
      onError() {
        jazzNote.textContent = '틀 수 없는 곡이라 다음 곡으로 넘어갑니다.';
        const gen = jazzState?.gen;
        clearTimeout(jazzSkipTimer);
        jazzSkipTimer = setTimeout(() => { if (jazzState?.gen === gen) sendJazz(`next ${gen}`); }, JAZZ_SKIP_MS);
      },
    },
  });
}

function playJazz() {
  const track = jazzTrack();
  if (!track) {
    destroyJazzPlayer();
    return;
  }
  if (jazzPlayer) {
    if (jazzPlayerReady && jazzLoadedGen !== jazzState.gen) {
      jazzLoadedGen = jazzState.gen;
      clearTimeout(jazzSkipTimer);
      jazzPlayer.loadVideoById({ videoId: track[0], startSeconds: jazzExpected() });
    }
    return;
  }
  if (jazzPlayerPending) return;
  jazzPlayerPending = true;
  loadYouTubeApi().then((YT) => {
    jazzPlayerPending = false;
    if (jazzTrack() && !jazzPlayer) createJazzPlayer(YT);
  }, () => {
    jazzPlayerPending = false;
    jazzNote.textContent = '유튜브를 불러오지 못했습니다.';
  });
}

function renderJazz() {
  const track = jazzTrack();
  const wasHidden = jazzEl.hidden;
  jazzEl.hidden = !jazzState;
  if (wasHidden && !jazzEl.hidden) restoreWindow(jazzEl, 'jazz');
  jazzVideo.hidden = !track;
  jazzSound.hidden = !track;
  const list = jazzState ? jazzState.list : [];
  jazzNow.textContent = track ? `♪ ${track[1]}` : list.length ? `■ 멈춤 · ${list[jazzState.i]?.[1] ?? ''}` : '올려 둔 곡이 없습니다';
  jazzControls.hidden = !jazzState;
  jazzToggle.textContent = jazzState?.stop ? '재생' : '정지';
  for (const button of [jazzControls.children[0], jazzToggle, jazzControls.children[2]]) button.disabled = list.length === 0;
  jazzList.textContent = '';
  (jazzState ? jazzState.list : []).forEach(([id, title], i) => {
    const row = document.createElement('div');
    row.className = 'jazz-track';
    row.classList.toggle('playing', i === jazzState.i);
    const name = document.createElement('button');
    name.className = 'jazz-title';
    name.type = 'button';
    name.tabIndex = -1;
    name.textContent = title;
    name.title = '이 곡 틀기';
    name.addEventListener('click', () => sendJazz(`play ${id}`));
    const remove = document.createElement('button');
    remove.className = 'panel-close';
    remove.type = 'button';
    remove.tabIndex = -1;
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `${title} 지우기`);
    remove.addEventListener('click', () => sendJazz(`remove ${id}`));
    row.append(name, remove);
    jazzList.append(row);
  });
}

function applyJazz(msg) {
  if (msg.off) {  // 이 방의 레코드 플레이어를 치웠다
    clearJazz();
    return;
  }
  jazzState = { gen: msg.gen, i: msg.i, pos: msg.pos, stop: !!msg.stop, at: performance.now(), list: msg.list };
  renderJazz();
  playJazz();
}

function setJazzPanel(open) {
  jazzPanelOpen = open;
  jazzMore.hidden = !open;
  jazzClose.hidden = !open;
  jazzListToggle.setAttribute('aria-expanded', String(open));
  if (!open) jazzUrl.blur();
}

// 이전/다음은 목록에서 옆 곡을 고르는 것과 같다.
function playNeighbour(step) {
  if (!jazzState || !jazzState.list.length) return;
  const n = jazzState.list.length;
  sendJazz(`play ${jazzState.list[(jazzState.i + step + n) % n][0]}`);
}
jazzControls.children[0].addEventListener('click', () => playNeighbour(-1));
jazzControls.children[2].addEventListener('click', () => playNeighbour(1));
jazzToggle.addEventListener('click', () => sendJazz(jazzState?.stop ? 'resume' : 'stop'));
jazzListToggle.addEventListener('click', () => setJazzPanel(!jazzPanelOpen));

function clearJazz() {
  jazzState = null;
  jazzNote.textContent = '';
  setJazzPanel(false);
  destroyJazzPlayer();
  renderJazz();
}

// 제목을 받아 온다. 없는 영상이나 외부 재생이 막힌 영상은 틀 수 없으므로 올리지 않는다.
async function jazzVideoInfo(id) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    if (response.status === 401 || response.status === 403 || response.status === 404) return { blocked: true };
    if (response.ok) return { title: String((await response.json()).title || '') };
  } catch { /* 제목을 못 받아도 곡은 올릴 수 있다 */ }
  return { title: '' };
}

jazzForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = parseYouTubeId(jazzUrl.value);
  if (!id) {
    jazzNote.textContent = '유튜브 주소가 맞는지 확인해 주세요.';
    return;
  }
  jazzUrl.value = '';
  jazzUrl.blur();
  const info = await jazzVideoInfo(id);
  if (info.blocked) {
    jazzNote.textContent = '없는 영상이거나 외부 재생이 막힌 영상입니다.';
    return;
  }
  jazzNote.textContent = '';
  sendJazz(`add ${id} ${info.title.slice(0, 80)}`);
});
jazzUrl.addEventListener('focus', () => stopMoving());
jazzClose.addEventListener('click', () => setJazzPanel(false));

// 레코드판 창 접기: 제목 줄만 남긴다. 이 브라우저에 기억한다
const jazzMini = document.getElementById('jazz-mini');
function setJazzMini(mini) {
  jazzEl.classList.toggle('mini', mini);
  jazzMini.textContent = mini ? '▢' : '–';
  jazzMini.title = mini ? '펴기' : '접기';
  jazzMini.setAttribute('aria-expanded', String(!mini));
  jazzMini.setAttribute('aria-label', mini ? '레코드판 펴기' : '레코드판 접기');
  try { localStorage.setItem('mmo.jazzMini', mini ? '1' : '0'); } catch { /* 이번 접속에만 적용 */ }
}
jazzMini.addEventListener('click', () => {
  setJazzMini(!jazzEl.classList.contains('mini'));
  releaseFocus(jazzMini);
});
try { if (localStorage.getItem('mmo.jazzMini') === '1') setJazzMini(true); } catch { /* 기본은 펼친 상태 */ }
// 레코드판 소리 크기와 음소거도 내 화면에만. 정지 단추와 달리 방의 다른 사람에게는 계속 나온다. 이 브라우저에 남긴다.
const JAZZ_VOLUME_KEY = 'mmo.jazzVolume';
const JAZZ_MUTE_KEY = 'mmo.jazzMuted';
let jazzMuted = false;
function applyJazzSound() {
  jazzMute.setAttribute('aria-pressed', String(jazzMuted));
  jazzSound.classList.toggle('muted', jazzMuted);
  if (!jazzPlayer || !jazzPlayerReady) return;
  jazzPlayer.setVolume(Number(jazzVolume.value));
  if (jazzMuted) jazzPlayer.mute();   // 아이폰은 소리 크기를 바꿀 수 없어 음소거는 mute 로 한다
  else jazzPlayer.unMute();
}
jazzMute.addEventListener('click', () => {
  jazzMuted = !jazzMuted;
  saveSetting(JAZZ_MUTE_KEY, jazzMuted ? '1' : '0');
  applyJazzSound();
  jazzMute.blur();
});
jazzVolume.addEventListener('input', () => {
  if (jazzMuted) saveSetting(JAZZ_MUTE_KEY, '0');   // 음소거 중에 소리 크기를 만지면 다시 켠다
  jazzMuted = false;
  applyJazzSound();
});
jazzVolume.addEventListener('change', () => {
  saveSetting(JAZZ_VOLUME_KEY, jazzVolume.value);
  jazzVolume.blur();
});
jazzVolume.value = loadSetting(JAZZ_VOLUME_KEY) ?? jazzVolume.value;
jazzMuted = loadSetting(JAZZ_MUTE_KEY) === '1';
applyJazzSound();

function recordInReach(self) {
  return terrain.furnByZone[zone].some((f) => f.k === 'record_player' && Math.hypot(f.x - self.x, f.y - self.y) <= terrain.tvReach);
}
