'use strict';
// 지역별 배경음악과 발소리, 소리 켜고 끄기 버튼. 소리 엔진은 core/audio.js.

// ------------------------------------------------------------ 소리

const soundBar = document.getElementById('sound-bar');
const musicToggle = document.getElementById('music-toggle');
const sfxToggle = document.getElementById('sfx-toggle');
const STEP_SECONDS = 0.31;
let stepClock = 0;
let inventoryLoaded = false;

function refreshSoundButtons() {
  musicToggle.setAttribute('aria-pressed', String(Sound.isMusicOn()));
  sfxToggle.setAttribute('aria-pressed', String(Sound.isSfxOn()));
}
musicToggle.addEventListener('click', () => {
  Sound.setMusicOn(!Sound.isMusicOn());
  refreshSoundButtons();
});
sfxToggle.addEventListener('click', () => {
  Sound.setSfxOn(!Sound.isSfxOn());
  refreshSoundButtons();
});
refreshSoundButtons();

// 지금 있는 곳의 배경음악. 영상이나 레코드가 나오는 동안은 그 소리를 듣도록 비워 둔다.
function musicKey() {
  if (myId === null || !terrain) return null;
  if (tvState && !tvState.paused) return null;
  if (zone === 0) return 'village';
  if (jazzTrack()) return null;  // 레코드판이 돌고 있으면 그 곡을 듣는다
  const kind = terrain.buildings[terrain.zones[zone].b].k;
  if (kind === 'theater') return 'theater';
  if (kind === 'casino') return 'casino';
  return 'house';
}

function footSurface() {
  if (zone === 0) {
    const onBridge = me.x > terrain.bridge[0] && me.x < terrain.bridge[1] && me.y > riverNorth - 20 && me.y < riverSouth + 20;
    return onBridge ? 'wood' : CHRISTMAS ? 'snow' : 'grass';
  }
  const kind = terrain.buildings[terrain.zones[zone].b].k;
  return kind === 'theater' || kind === 'jazz' || kind === 'casino' ? 'carpet' : 'wood';
}

function updateSteps(dt) {
  const e = entities.get(myId);
  if (!me || !terrain || !me.moving || !e || e.seat) {
    stepClock = STEP_SECONDS;
    return;
  }
  stepClock += dt;
  if (stepClock >= STEP_SECONDS) {
    stepClock = 0;
    Sound.step(footSurface());
  }
}

function playSelfSounds(e, seat, fish) {
  if (!e.seat && seat) Sound.play(terrain.seats[seat - 1]?.lie ? 'blanket' : 'sit');
  if (!e.fish && fish === 1) {
    Sound.play('cast');
    setTimeout(() => Sound.play('splash'), 300);
  }
  if (e.fish === 1 && fish === 2) Sound.play('bite');
}
