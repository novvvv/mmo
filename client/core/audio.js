// 배경음악과 효과음. 음원은 assets/audio/ 폴더에 있고 출처는 assets/audio/CREDITS.txt 에 적어 두었다.
'use strict';

const Sound = (() => {
  const MUSIC_VOLUME = 0.36;
  const FADE_PER_SEC = 0.5;
  const STEP_VARIANTS = 3;
  const STEP_SURFACES = ['snow', 'grass', 'wood', 'stone', 'carpet'];
  const SAMPLES = ['hit', 'hurt', 'item', 'blanket', 'sit', 'drink', 'eat', 'dart', 'page', 'place'];
  const VOLUMES = { hit: 0.5, hurt: 0.5, item: 0.5, blanket: 0.5, sit: 0.4, drink: 0.5, eat: 0.5, dart: 0.6, page: 0.4, place: 0.45 };
  const STEP_VOLUME = 0.2;
  const KEY_MUSIC = 'mmo.sound.music', KEY_SFX = 'mmo.sound.sfx';

  const read = (key) => {
    try {
      return localStorage.getItem(key) !== '0';
    } catch {
      return true;
    }
  };
  const write = (key, on) => {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch { /* 저장은 편의 기능이다 */ }
  };

  let audio = null;
  let noise = null;
  const buffers = new Map();
  const tracks = new Map();
  let wanted = null;
  let musicOn = read(KEY_MUSIC);
  let sfxOn = read(KEY_SFX);
  let playBlocked = false;

  async function loadSample(name) {
    try {
      const response = await fetch(`assets/audio/sfx/${name}.mp3`);
      buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()));
    } catch { /* 소리 하나를 못 불러와도 게임은 계속된다 */ }
  }

  // 로그인 버튼처럼 사용자가 누른 순간에 불러야 브라우저가 소리를 허락한다.
  function unlock() {
    if (audio) {
      audio.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audio = new AudioContextClass();
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    for (const name of SAMPLES) loadSample(name);
    for (const surface of STEP_SURFACES) for (let i = 1; i <= STEP_VARIANTS; i++) loadSample(`${surface}${i}`);
  }

  function playBuffer(name, volume, rate = 1) {
    const buffer = buffers.get(name);
    if (!buffer) return;
    const source = audio.createBufferSource(), gain = audio.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain).connect(audio.destination);
    source.start();
  }

  // 걸러낸 잡음. 낚싯줄이 나는 소리와 물소리에 쓴다.
  function whoosh(type, fromHz, toHz, seconds, volume) {
    const t = audio.currentTime, source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    source.buffer = noise;
    source.loop = true;
    filter.type = type;
    filter.frequency.setValueAtTime(fromHz, t);
    filter.frequency.exponentialRampToValueAtTime(toHz, t + seconds);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + seconds * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(t);
    source.stop(t + seconds + 0.02);
  }

  function tone(type, hz, delay, seconds, volume) {
    const t = audio.currentTime + delay, oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(t);
    oscillator.stop(t + seconds + 0.02);
  }

  const SYNTH = {
    swing: () => whoosh('bandpass', 2200, 500, 0.22, 0.3),
    cast: () => whoosh('bandpass', 1500, 320, 0.34, 0.26),
    splash() {
      whoosh('lowpass', 2600, 300, 0.42, 0.42);
      tone('sine', 190, 0, 0.14, 0.3);
    },
    bite() {
      tone('sine', 880, 0, 0.16, 0.26);
      tone('sine', 1174, 0.1, 0.22, 0.26);
    },
    catch() {
      [523, 659, 784, 1046].forEach((hz, i) => tone('triangle', hz, i * 0.07, 0.22, 0.2));
      whoosh('lowpass', 1800, 400, 0.3, 0.24);
    },
    coin() {
      tone('square', 1318, 0, 0.08, 0.07);
      tone('square', 1760, 0.06, 0.2, 0.07);
    },
    launch: () => whoosh('bandpass', 700, 2200, 0.12, 0.12),   // 빠칭코 구슬 쏘기
    pocket() {
      tone('square', 988, 0, 0.07, 0.05);
      tone('square', 1319, 0.06, 0.12, 0.05);
    },
    reel: () => tone('square', 660, 0, 0.025, 0.025),
    reach() { [784, 988, 1175, 1568].forEach((hz, i) => tone('square', hz, i * 0.07, 0.1, 0.05)); },
    jackpot() {
      [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((hz, i) => tone('square', hz, i * 0.1, 0.16, 0.06));
      tone('triangle', 2093, 0.85, 0.6, 0.12);
    },
    notify() {   // 신청이 왔을 때: 옛날 게임기의 띠리링
      [659, 880, 1175].forEach((hz, i) => tone('square', hz, i * 0.09, 0.14, 0.06));
      tone('triangle', 1568, 0.27, 0.32, 0.14);
    },
  };

  function play(name) {
    if (!sfxOn || !audio || audio.state !== 'running') return;
    if (SYNTH[name]) SYNTH[name]();
    else playBuffer(name, VOLUMES[name] ?? 0.5);
  }

  function step(surface) {
    if (!sfxOn || !audio || audio.state !== 'running') return;
    playBuffer(`${surface}${1 + Math.floor(Math.random() * STEP_VARIANTS)}`, STEP_VOLUME, 0.92 + Math.random() * 0.16);
  }

  function setMusic(key) {
    wanted = key;
    if (key && !tracks.has(key)) {
      const element = new Audio(`assets/audio/bgm/${key}.mp3`);
      element.loop = true;
      element.volume = 0;
      tracks.set(key, element);
    }
  }

  // 매 프레임 불러 곡을 서서히 바꾼다.
  function tick(dt) {
    for (const [key, element] of tracks) {
      const target = key === wanted && musicOn ? MUSIC_VOLUME : 0;
      const change = FADE_PER_SEC * dt;
      element.volume = target > element.volume ? Math.min(target, element.volume + change) : Math.max(target, element.volume - change);
      if (target > 0 && element.paused && !playBlocked) element.play().catch(() => { playBlocked = true; });
      if (target === 0 && element.volume === 0 && !element.paused) element.pause();
    }
  }

  function retryAfterGesture() {
    playBlocked = false;
    if (audio && audio.state === 'suspended') audio.resume();
  }
  addEventListener('pointerdown', retryAfterGesture);
  addEventListener('keydown', retryAfterGesture);

  return {
    unlock,
    play,
    step,
    setMusic,
    tick,
    current: () => wanted,
    isMusicOn: () => musicOn,
    isSfxOn: () => sfxOn,
    setMusicOn(on) {
      musicOn = on;
      write(KEY_MUSIC, on);
    },
    setSfxOn(on) {
      sfxOn = on;
      write(KEY_SFX, on);
    },
  };
})();
