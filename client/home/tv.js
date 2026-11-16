'use strict';
// TV 와 화면 공유: 유튜브·릴스 함께 보기, 내 화면을 방의 화면에 띄우기.

// ------------------------------------------------------------ TV (유튜브 함께 보기)

// 유튜브 주소나 영상 ID 에서 11자리 영상 ID 를 뽑는다. 아니면 null.
function parseYouTubeId(text) {
  const value = text.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1, 12);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const path = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    id = path ? path[1] : url.searchParams.get('v');
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function sendTv(command) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`tv ${command}`);
}

function tvExpected() {
  return tvState.paused ? tvState.pos : tvState.pos + (performance.now() - tvState.at) / 1000;
}

function loadYouTubeApi() {
  if (!youTubeApi) {
    youTubeApi = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        youTubeApi = null;
        reject(new Error('youtube api'));
      };
      document.head.append(script);
    });
  }
  return youTubeApi;
}

// ---- 화면 공유: 한 사람의 탭이나 창을 방의 화면에 띄운다. 영상은 브라우저끼리 직접 주고받고(WebRTC) 서버는 연결 정보만 전한다.
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const SHARE_MAX_VIEWERS = 12;
const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia && typeof RTCPeerConnection === 'function';
let tvShareEl = null;          // 공유 화면을 보여 주는 <video>
let shareStream = null;        // 내가 공유하는 화면
let shareStarting = false;
const sharePeers = new Map();  // 내가 공유할 때: 보는 사람 연결 번호 -> 연결
let viewPeer = null;           // 내가 볼 때: 공유하는 사람과의 연결
let viewRetry = 0;

function sendRtc(to, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`rtc ${to} ${JSON.stringify(data)}`);
}

function closeViewPeer() {
  clearTimeout(viewRetry);
  if (viewPeer) viewPeer.close();
  viewPeer = null;
}

// ---- 보낼 범위: 고른 화면에서 네모 하나만 잘라 보낸다. 자르는 일은 보내기 전에 하므로 네모 밖은 전송되지 않는다.
// 프레임을 하나씩 받아 자르는 방식(크롬 계열)이라 게임 탭이 뒤에 가 있어도 멈추지 않는다. 지원하지 않는 브라우저는 화면 전체를 보낸다.
const canCropShare = typeof MediaStreamTrackProcessor === 'function' && typeof MediaStreamTrackGenerator === 'function' && typeof VideoFrame === 'function';
const SHARE_CROP_KEY = 'mmo.shareCrop', SHARE_CROP_MIN = 0.06;
const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };
const shareCropEl = document.getElementById('share-crop');
const shareCropStage = document.getElementById('share-crop-stage');
const shareCropVideo = document.getElementById('share-crop-video');
const shareCropRect = document.getElementById('share-crop-rect');
const shareCropWide = document.getElementById('share-crop-wide');
const shareCropOk = document.getElementById('share-crop-ok');
const tvCrop = document.getElementById('tv-crop');
let shareRaw = null;              // 브라우저가 준 화면 그대로. shareStream 은 여기서 범위만 잘라 낸 것
let shareCrop = { ...FULL_CROP }; // 보낼 범위. 화면 크기에 대한 비율 (0~1)
let cropDraft = { ...FULL_CROP }; // 창에서 고르는 중인 범위
try {
  const saved = JSON.parse(loadSetting(SHARE_CROP_KEY) || 'null');
  if (saved && [saved.x, saved.y, saved.w, saved.h].every((n) => typeof n === 'number' && n >= 0 && n <= 1) && saved.w >= SHARE_CROP_MIN && saved.h >= SHARE_CROP_MIN && saved.x + saved.w <= 1.0001 && saved.y + saved.h <= 1.0001) shareCrop = saved;
} catch { /* 화면 전체 */ }

// 범위(비율)를 그 프레임의 픽셀 네모로. 영상 형식이 요구하는 대로 짝수에 맞춘다.
function cropPixels(crop, width, height) {
  const even = (n) => Math.floor(n / 2) * 2;
  const w = Math.max(16, Math.min(even(width), even(crop.w * width))), h = Math.max(16, Math.min(even(height), even(crop.h * height)));
  return { x: Math.min(even(crop.x * width), even(width - w)), y: Math.min(even(crop.y * height), even(height - h)), width: w, height: h };
}

function buildShareStream(raw) {
  const [track] = raw.getVideoTracks();
  if (!canCropShare || !track) return raw;
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  const cropper = new TransformStream({
    transform(frame, controller) {
      let out = frame;
      if (shareCrop.w < 1 || shareCrop.h < 1) {
        try {
          const rect = cropPixels(shareCrop, frame.codedWidth, frame.codedHeight);
          out = new VideoFrame(frame, { visibleRect: rect, displayWidth: rect.width, displayHeight: rect.height });
          frame.close();
        } catch {
          out = frame;   // 자르지 못한 프레임은 건너뛰지 않고 그대로 보낸다
        }
      }
      controller.enqueue(out);
    },
  });
  new MediaStreamTrackProcessor({ track }).readable.pipeThrough(cropper).pipeTo(generator.writable).catch(() => { /* 공유를 끝냈다 */ });
  return new MediaStream([generator, ...raw.getAudioTracks()]);
}

function paintCropRect() {
  const { x, y, w, h } = cropDraft;
  shareCropRect.style.left = `${x * 100}%`;
  shareCropRect.style.top = `${y * 100}%`;
  shareCropRect.style.width = `${w * 100}%`;
  shareCropRect.style.height = `${h * 100}%`;
}

function openShareCrop() {
  if (!shareRaw) return;
  stopMoving();
  cropDraft = { ...shareCrop };
  shareCropVideo.srcObject = shareRaw;
  shareCropOk.textContent = tvState?.share === myId ? '적용' : '공유 시작';
  shareCropEl.hidden = false;
  paintCropRect();
}

function closeShareCrop() {
  shareCropEl.hidden = true;
  shareCropVideo.srcObject = null;
}

// 창을 닫으며: 아직 공유를 시작하지 않았으면 고른 화면도 놓는다.
function cancelShareCrop() {
  if (shareCropEl.hidden) return;
  if (tvState?.share === myId) closeShareCrop();
  else stopShareCapture();
}

// 16:9 고정이면 가로에 맞춰 세로를 정한다. 화면 밖으로 나가면 줄인다.
function fitCropWide(crop) {
  if (!shareCropWide.checked || !shareCropVideo.videoWidth) return crop;
  const ratio = shareCropVideo.videoWidth / shareCropVideo.videoHeight * 9 / 16;   // 가로 비율 1 이 세로 비율로 얼마인지
  let w = crop.w, h = w * ratio;
  if (h > 1) { h = 1; w = h / ratio; }
  return { x: Math.min(crop.x, 1 - w), y: Math.min(crop.y, 1 - h), w, h };
}

let cropDrag = null;
shareCropStage.addEventListener('pointerdown', (e) => {
  const box = shareCropStage.getBoundingClientRect();
  const fx = clamp((e.clientX - box.left) / box.width, 0, 1), fy = clamp((e.clientY - box.top) / box.height, 0, 1);
  const { x, y, w, h } = cropDraft;
  const inside = (w < 1 || h < 1) && fx >= x && fx <= x + w && fy >= y && fy <= y + h;
  cropDrag = inside ? { move: true, dx: fx - x, dy: fy - y, before: { ...cropDraft } } : { move: false, ax: fx, ay: fy, before: { ...cropDraft } };
  shareCropStage.setPointerCapture(e.pointerId);
  e.preventDefault();
});
shareCropStage.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const box = shareCropStage.getBoundingClientRect();
  const fx = clamp((e.clientX - box.left) / box.width, 0, 1), fy = clamp((e.clientY - box.top) / box.height, 0, 1);
  if (cropDrag.move) {
    cropDraft = { ...cropDraft, x: clamp(fx - cropDrag.dx, 0, 1 - cropDraft.w), y: clamp(fy - cropDrag.dy, 0, 1 - cropDraft.h) };
  } else {
    const x = Math.min(cropDrag.ax, fx), y = Math.min(cropDrag.ay, fy);
    cropDraft = fitCropWide({ x, y, w: Math.abs(fx - cropDrag.ax), h: Math.abs(fy - cropDrag.ay) });
  }
  paintCropRect();
});
const endCropDrag = () => {
  if (!cropDrag) return;
  if (cropDraft.w < SHARE_CROP_MIN || cropDraft.h < SHARE_CROP_MIN) cropDraft = cropDrag.before;   // 너무 작게 그렸거나 그냥 눌렀다
  cropDrag = null;
  paintCropRect();
};
shareCropStage.addEventListener('pointerup', endCropDrag);
shareCropStage.addEventListener('pointercancel', endCropDrag);
shareCropWide.addEventListener('change', () => {
  cropDraft = fitCropWide(cropDraft);
  paintCropRect();
});
document.getElementById('share-crop-all').addEventListener('click', () => {
  shareCropWide.checked = false;
  cropDraft = { ...FULL_CROP };
  paintCropRect();
});
document.getElementById('share-crop-cancel').addEventListener('click', cancelShareCrop);
shareCropOk.addEventListener('click', () => {
  shareCrop = { ...cropDraft };
  saveSetting(SHARE_CROP_KEY, JSON.stringify(shareCrop));
  const sharing = tvState?.share === myId;
  closeShareCrop();
  if (!sharing && shareStream) sendTv('share');
});
tvCrop.addEventListener('click', () => {
  tvCrop.blur();
  openShareCrop();
});

// ---- 화질: 공유하는 사람이 고른다. 브라우저는 회선에 맞춰 이 상한 안에서만 조절한다.
const SHARE_QUALITY = { normal: 2_500_000, high: 6_000_000, max: 12_000_000 };   // 보내는 양의 상한 (bps, 보는 사람마다)
const SHARE_QUALITY_KEY = 'mmo.shareQuality', SHARE_PREFER_KEY = 'mmo.sharePrefer';
const shareQualityPick = document.getElementById('share-quality');
const sharePreferPick = document.getElementById('share-prefer');
let shareQuality = SHARE_QUALITY[loadSetting(SHARE_QUALITY_KEY)] ? loadSetting(SHARE_QUALITY_KEY) : 'high';
let sharePrefer = loadSetting(SHARE_PREFER_KEY) === 'smooth' ? 'smooth' : 'sharp';   // 느려질 때 지킬 것: 선명함(프레임을 줄인다) 또는 부드러움(해상도를 줄인다)
shareQualityPick.value = shareQuality;
sharePreferPick.value = sharePrefer;

// 고른 화질을 보내는 연결(들)에 적용한다. 연결을 다시 맺지 않아도 바로 바뀐다.
function applyShareQuality(only) {
  if (shareStream) {
    for (const track of shareStream.getVideoTracks()) {
      try { track.contentHint = sharePrefer === 'sharp' ? 'detail' : 'motion'; } catch { /* 지원하지 않으면 그대로 */ }
    }
  }
  for (const pc of only ? [only] : sharePeers.values()) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) continue;
      params.encodings[0].maxBitrate = SHARE_QUALITY[shareQuality];
      params.encodings[0].maxFramerate = 30;
      params.degradationPreference = sharePrefer === 'sharp' ? 'maintain-resolution' : 'maintain-framerate';
      sender.setParameters(params).catch(() => { /* 그 사이 연결이 닫혔다 */ });
    }
  }
}
shareQualityPick.addEventListener('change', () => {
  shareQuality = shareQualityPick.value;
  saveSetting(SHARE_QUALITY_KEY, shareQuality);
  applyShareQuality();
});
sharePreferPick.addEventListener('change', () => {
  sharePrefer = sharePreferPick.value;
  saveSetting(SHARE_PREFER_KEY, sharePrefer);
  applyShareQuality();
});

function stopShareCapture() {
  for (const pc of sharePeers.values()) pc.close();
  sharePeers.clear();
  for (const stream of [shareStream, shareRaw]) if (stream) for (const track of stream.getTracks()) track.stop();
  shareStream = null;
  shareRaw = null;
  closeShareCrop();
}

async function startShare() {
  if (shareStarting || shareStream || !canShareScreen) return;
  shareStarting = true;
  try {
    const raw = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    shareRaw = raw;
    shareStream = buildShareStream(raw);
    applyShareQuality();
    raw.getVideoTracks()[0]?.addEventListener('ended', () => {   // 브라우저의 "공유 중지" 를 눌렀다
      if (tvState?.share === myId) sendTv('stop');
      stopShareCapture();
    });
    if (canCropShare) openShareCrop();   // 범위를 고른 뒤에 보내기 시작한다
    else sendTv('share');
  } catch {
    stopShareCapture();
    tvStatus.textContent = '화면 공유를 시작하지 못했어요.';
  }
  shareStarting = false;
}

// 공유하는 쪽: 보겠다는 사람마다 연결을 하나씩 만들어 화면을 보낸다.
async function shareOfferTo(id) {
  if (!shareStream || tvState?.share !== myId) return;
  sharePeers.get(id)?.close();
  sharePeers.delete(id);
  if (sharePeers.size >= SHARE_MAX_VIEWERS) return;
  const pc = new RTCPeerConnection(RTC_CONFIG);
  sharePeers.set(id, pc);
  for (const track of shareStream.getTracks()) pc.addTrack(track, shareStream);
  pc.onicecandidate = (e) => { if (e.candidate) sendRtc(id, { t: 'ice', c: e.candidate }); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      pc.close();
      if (sharePeers.get(id) === pc) sharePeers.delete(id);
    }
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  applyShareQuality(pc);
  sendRtc(id, { t: 'offer', sdp: pc.localDescription.sdp });
}

// 보는 쪽: 공유하는 사람이 보낸 연결 제안에 답하고, 화면이 오면 띄운다.
async function shareAnswer(from, sdp) {
  if (tvState?.share !== from || !tvShareEl) return;
  closeViewPeer();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  viewPeer = pc;
  pc.ontrack = (e) => {
    if (!tvShareEl) return;
    tvShareEl.srcObject = e.streams[0];
    tvStatus.textContent = '';
    applyTvSound();
    tvShareEl.play().catch(() => { tvStatus.textContent = '화면을 한 번 누르면 재생돼요.'; });
  };
  pc.onicecandidate = (e) => { if (e.candidate) sendRtc(from, { t: 'ice', c: e.candidate }); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState !== 'failed' || viewPeer !== pc) return;
    tvStatus.textContent = '화면 공유에 연결하지 못했어요. 다시 시도하는 중…';
    viewRetry = setTimeout(() => { if (viewPeer === pc && tvState?.share === from) sendRtc(from, { t: 'want' }); }, 3000);
  };
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendRtc(from, { t: 'answer', sdp: pc.localDescription.sdp });
}

function applyRtc(msg) {
  let data;
  try { data = JSON.parse(msg.d); } catch { return; }
  const mine = tvState?.share === myId;
  const pc = mine ? sharePeers.get(msg.from) : tvState?.share === msg.from ? viewPeer : null;
  const failed = () => { /* 그 사이 연결이 닫혔다 */ };
  if (data.t === 'want' && mine) shareOfferTo(msg.from).catch(failed);
  else if (data.t === 'offer' && !mine) shareAnswer(msg.from, data.sdp).catch(failed);
  else if (data.t === 'answer' && mine && pc) pc.setRemoteDescription({ type: 'answer', sdp: data.sdp }).catch(failed);
  else if (data.t === 'ice' && pc) pc.addIceCandidate(data.c).catch(failed);
}

// 공유 화면을 TV 자리에 띄운다. 내가 공유하면 내 화면을 그대로, 아니면 공유하는 사람에게 보내 달라고 한다.
function showShare() {
  const key = `@share:${tvState.share}`;
  if (tvLoadedVideo === key && tvShareEl) return;
  destroyTvPlayer();
  tvLoadedVideo = key;
  tvShareEl = document.createElement('video');
  tvShareEl.autoplay = true;
  tvShareEl.playsInline = true;
  tvVideo.append(tvShareEl);
  if (tvState.share === myId) {
    tvShareEl.muted = true;   // 내 소리가 되돌아와 울리지 않게
    tvShareEl.srcObject = shareStream;
  } else {
    tvStatus.textContent = '화면 공유에 연결하는 중…';
    sendRtc(tvState.share, { t: 'want' });
  }
}

function destroyTvPlayer() {
  if (tvPlayer) tvPlayer.destroy();
  closeViewPeer();
  tvShareEl = null;
  tvPlayer = null;
  tvReelFrame = null;
  tvPlayerReady = false;
  tvLoadedVideo = null;
  tvVideo.textContent = '';
}

// 인스타 릴스는 재생을 제어할 API 가 없어 임베드 화면만 띄운다.
function showReel() {
  if (tvPlayer) destroyTvPlayer();
  if (tvLoadedVideo === tvState.video) return;
  destroyTvPlayer();
  tvLoadedVideo = tvState.video;
  tvReelFrame = document.createElement('iframe');
  tvReelFrame.src = `https://www.instagram.com/reel/${tvState.video}/embed/`;
  tvReelFrame.allow = 'autoplay; encrypted-media';
  tvReelFrame.title = '인스타그램 릴스';
  tvVideo.append(tvReelFrame);
}

// 창을 닫아도 방의 TV 에서 계속 나오도록 영상이 켜져 있는 동안 플레이어를 유지한다.
function ensureTvPlayer() {
  if (!tvState) return;
  if (tvState.share) {
    showShare();
    return;
  }
  if (tvShareEl) destroyTvPlayer();
  if (tvState.reel) {
    showReel();
    return;
  }
  if (tvReelFrame) destroyTvPlayer();
  if (tvPlayer || tvPlayerPending) return;
  tvPlayerPending = true;
  loadYouTubeApi().then((YT) => {
    tvPlayerPending = false;
    if (tvPlayer || !tvState || tvState.reel) return;
    const mount = document.createElement('div');
    tvVideo.append(mount);
    tvLoadedVideo = tvState.video;
    tvPlayer = new YT.Player(mount, {
      width: '100%',
      height: '100%',
      videoId: tvState.video,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin, start: Math.floor(tvExpected()) },
      events: {
        onReady() {
          tvPlayerReady = true;
          applyTvSound();
          syncTv();
        },
        onStateChange(e) {
          if (e.data === YT.PlayerState.ENDED && tvState) sendTv(`end ${tvState.video}`);
          if (e.data === YT.PlayerState.PLAYING) applyTvSound();   // 다음 영상으로 넘어가도 음소거를 그대로
        },
        onError(e) {
          tvStatus.textContent = e.data === 101 || e.data === 150 ? '이 영상은 소유자가 외부 재생을 막아 두었습니다.' : '이 영상을 재생할 수 없습니다.';
        },
      },
    });
  }, () => {
    tvPlayerPending = false;
    tvStatus.textContent = '유튜브를 불러오지 못했습니다.';
  });
}

// 인스타 릴스 주소에서 릴스 코드를 뽑는다. 아니면 null.
function parseReelCode(text) {
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^(www|m)\./, '') !== 'instagram.com') return null;
  const match = url.pathname.match(/^(?:\/[^/]+)?\/(?:reel|reels|p|tv)\/([\w-]{5,64})/);
  return match ? match[1] : null;
}

function formatTvTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// 서버가 정한 위치와 재생 상태에 플레이어를 맞춘다. 영상을 눌러 혼자 멈춰도 다시 맞춰진다.
function syncTv() {
  if (!tvState || tvState.reel || tvState.share || !tvPlayer || !tvPlayerReady) return;
  const { PLAYING, BUFFERING, ENDED } = window.YT.PlayerState;
  const expected = tvExpected();
  if (tvLoadedVideo !== tvState.video) {
    tvLoadedVideo = tvState.video;
    tvStatus.textContent = '';
    tvPlayer.loadVideoById({ videoId: tvState.video, startSeconds: expected });
    return;
  }
  const state = tvPlayer.getPlayerState();
  if (state === ENDED) return;
  if (tvState.paused) {
    if (state === PLAYING || state === BUFFERING) tvPlayer.pauseVideo();
  } else if (state !== PLAYING && state !== BUFFERING) {
    tvPlayer.playVideo();
  }
  const drift = Math.abs(tvPlayer.getCurrentTime() - expected);
  // 누군가 위치를 옮긴 경우(크게 어긋남)는 간격을 기다리지 않고 바로 따라간다.
  if (state !== BUFFERING && drift > TV_DRIFT_SEC && (drift > 5 || performance.now() - tvSeekedAt > TV_SEEK_COOLDOWN_MS)) {
    tvSeekedAt = performance.now();
    tvPlayer.seekTo(expected, true);
  }

  const duration = tvPlayer.getDuration();
  if (duration > 0) {
    tvBar.max = Math.floor(duration);
    if (!tvSeeking) tvBar.value = expected;
    tvClock.textContent = `${formatTvTime(expected)} / ${formatTvTime(duration)}`;
  }
}
// 스크립트가 모두 실행된 뒤에 시작한다 (먼저 시작하면 아직 불러오지 않은 파일의 값을 쓰다 멈출 수 있다)
document.addEventListener('DOMContentLoaded', () => setInterval(syncTv, TV_SYNC_MS));

function updateTvPanel() {
  const reel = !!tvState && tvState.reel;
  tvEmpty.hidden = !!tvState;
  tvControls.hidden = !tvState;
  tvEl.classList.toggle('reel', reel);
  tvEl.classList.toggle('share', !!tvState?.share);
  tvShareTile.hidden = !canShareScreen;
  tvCrop.hidden = !(canCropShare && tvState?.share === myId);
  tvStop.textContent = tvState?.share ? (tvState.share === myId ? '공유 끝내기' : '화면 공유 끄기') : 'TV 끄기';
  if (tvState?.share && !tvStatus.textContent) tvStatus.textContent = tvState.share === myId ? '내 화면을 공유하는 중' : `${tvState.name}님의 화면`;
  tvEl.classList.toggle('cinema', isCinema() && !!tvState);  // 극장은 스크린에서 보므로 창에는 조작 버튼만 둔다
  tvToggle.textContent = tvState && tvState.paused ? '재생' : '일시정지';
  if (reel) tvStatus.textContent = '릴스는 화면의 재생 버튼을 각자 눌러 주세요.';
}

function setTvSource(kind) {
  tvSourceKind = kind;
  const youtube = kind === 'youtube';
  tvSource.textContent = youtube ? 'YouTube' : '릴스';
  tvUrl.placeholder = youtube ? '유튜브 주소 붙여넣기' : '인스타 릴스 주소 붙여넣기';
}

// 영상을 큰 창 또는 방의 TV 화면 위에 겹친다. 창이 움직이거나 화면이 스크롤되어도 매 프레임 따라간다.
function syncTvVideo() {
  const furniture = terrain && tvState && (tvPlayer || tvReelFrame || tvShareEl) ? tvFurniture() : null;
  tvVideo.hidden = !furniture;
  tvVideo.classList.toggle('cinema-full', cinemaFull);
  if (!furniture) return;
  const reel = tvState.reel;
  const cinema = isCinemaScreen(furniture.k);
  const big = tvPanelOpen && !cinema;  // 극장은 창을 열어도 큰 스크린에서 그대로 나온다
  let area;
  if (cinemaFull) {
    area = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  } else if (big) {
    const r = tvScreen.getBoundingClientRect();
    area = { x: r.left, y: r.top, w: r.width, h: r.height };
  } else {
    const [camX, camY] = camera(innerWidth, innerHeight);
    const r = tvScreenRect(furniture);
    area = { x: r.x - camX, y: r.y - camY, w: r.w, h: r.h };
  }
  // 작은 화면에서도 플레이어가 최소 크기를 지키도록 원래 크기로 띄워 축소한다.
  let width = area.w, scale = 1, x = area.x;
  if (reel) {
    width = 326;
    scale = big || cinema ? Math.min(1, area.h / 580) : area.w / 326;
    if (big || cinema) x += (area.w - width * scale) / 2;
  } else if (area.w < 356) {
    width = 356;
    scale = area.w / 356;
  }
  const height = area.h / scale;
  const layout = `${x},${area.y},${width},${height},${scale},${big},${reel},${cinema}`;
  if (layout === tvVideoLayout) return;
  tvVideoLayout = layout;
  tvVideo.style.width = `${width}px`;
  tvVideo.style.height = `${height}px`;
  tvVideo.style.transform = `translate(${x}px, ${area.y}px) scale(${scale})`;
  tvVideo.classList.toggle('big', big);
  tvVideo.classList.toggle('small-reel', reel && !big && !cinema);
  tvVideo.classList.toggle('clickable', reel && cinema);  // 릴스의 재생 버튼을 직접 눌러야 한다
}

function openTvPanel() {
  tvPanelOpen = true;
  tvDismissed = null;
  tvEl.hidden = false;
  restoreWindow(tvEl, 'tv');
  updateTvPanel();
  ensureTvPlayer();
}

function closeTvPanel() {
  tvPanelOpen = false;
  tvEl.hidden = true;
  tvDismissed = tvState ? tvState.video : null;  // 같은 영상이 이어지는 동안은 다시 열지 않는다. 영상은 방의 TV 에서 계속 나온다
  tvUrl.blur();
}

function clearTv() {
  tvState = null;
  stopShareCapture();
  closeTvPanel();
  destroyTvPlayer();
  tvDismissed = null;
  tvStatus.textContent = '';
  tvUrl.value = '';
}

function applyTv(msg) {
  if (!msg.v) {
    clearTv();
    return;
  }
  if (tvState?.share && tvState.share !== (msg.share || 0)) tvStatus.textContent = '';   // 공유가 끝나고 다른 것이 나온다
  tvState = { video: msg.v, reel: msg.reel, pos: msg.pos, paused: msg.paused, at: performance.now(), share: msg.share || 0, name: msg.sn || '' };
  if (tvState.share !== myId) stopShareCapture();   // 내 공유가 받아들여지지 않았거나 다른 영상으로 바뀌었다
  ensureTvPlayer();
  syncTv();
  if (tvDismissed === msg.v) return;
  if (isCinema() && !tvPanelOpen) return;  // 극장은 창을 띄우지 않아도 스크린에서 바로 보인다
  if (tvPanelOpen) updateTvPanel();
  else openTvPanel();
}

tvEmpty.addEventListener('click', (e) => {
  const tile = e.target.closest('[data-source]');
  if (!tile) return;
  if (tile.dataset.source === 'share') {
    tile.blur();
    startShare();
    return;
  }
  setTvSource(tile.dataset.source);
  tvUrl.focus();
});
tvSource.addEventListener('click', () => {
  setTvSource(tvSourceKind === 'youtube' ? 'reel' : 'youtube');
  tvSource.blur();
});

tvClose.addEventListener('click', closeTvPanel);
tvStop.addEventListener('click', () => {
  sendTv('stop');
  tvStop.blur();
});
tvToggle.addEventListener('click', () => {
  if (tvState) sendTv(tvState.paused ? 'resume' : 'pause');
  tvToggle.blur();
});
tvBar.addEventListener('input', () => { tvSeeking = true; });
tvBar.addEventListener('change', () => {
  tvSeeking = false;
  sendTv(`seek ${tvBar.value}`);
  tvBar.blur();
});
// TV 소리 크기와 음소거는 내 화면에만 적용한다. 방의 다른 사람에게는 그대로 나온다. 이 브라우저에 남긴다.
let tvMuted = false;
function applyTvSound() {
  tvMute.setAttribute('aria-pressed', String(tvMuted));
  tvEl.classList.toggle('muted', tvMuted);
  if (tvShareEl && tvState?.share !== myId) {
    tvShareEl.volume = Number(tvVolume.value) / 100;
    tvShareEl.muted = tvMuted;
  }
  if (!tvPlayer || !tvPlayerReady) return;
  tvPlayer.setVolume(Number(tvVolume.value));
  if (tvMuted) tvPlayer.mute();   // 아이폰은 소리 크기를 바꿀 수 없어 음소거는 mute 로 한다
  else tvPlayer.unMute();
}
tvMute.addEventListener('click', () => {
  tvMuted = !tvMuted;
  saveSetting(TV_MUTE_KEY, tvMuted ? '1' : '0');
  applyTvSound();
  tvMute.blur();
});
tvVolume.addEventListener('input', () => {
  if (tvMuted) saveSetting(TV_MUTE_KEY, '0');   // 음소거 중에 소리 크기를 만지면 다시 켠다
  tvMuted = false;
  applyTvSound();
});
tvVolume.addEventListener('change', () => {
  saveSetting(TV_VOLUME_KEY, tvVolume.value);
  tvVolume.blur();
});
tvVolume.value = loadSetting(TV_VOLUME_KEY) ?? tvVolume.value;
tvMuted = loadSetting(TV_MUTE_KEY) === '1';
applyTvSound();

tvForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const youtube = tvSourceKind === 'youtube';
  const id = youtube ? parseYouTubeId(tvUrl.value) : parseReelCode(tvUrl.value);
  if (!id) {
    tvStatus.textContent = youtube ? '유튜브 주소를 확인해 주세요.' : '릴스 주소를 확인해 주세요.';
    return;
  }
  tvStatus.textContent = '';
  tvUrl.value = '';
  tvUrl.blur();
  sendTv(`${youtube ? 'play' : 'reel'} ${id}`);
});
tvUrl.addEventListener('focus', () => stopMoving());

// 영상을 누르면 키보드 입력이 iframe 으로 넘어가므로 바로 게임으로 되돌린다.
addEventListener('blur', () => setTimeout(() => {
  if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
    document.activeElement.blur();
    window.focus();
  }
}, 0));

function tvFurniture() {
  return terrain ? terrain.furnByZone[zone].find((f) => f.k === 'tv' || f.k === 'tv_wall' || isCinemaScreen(f.k)) : undefined;
}

function isCinema() {
  return isCinemaScreen(tvFurniture()?.k);
}

function tvInReach(self) {
  const tv = tvFurniture();
  if (!tv) return false;
  if (isCinemaScreen(tv.k)) return Math.abs(tv.y - self.y) <= terrain.tvReach && Math.abs(tv.x - self.x) <= (tv.k === 'cinema_screen_big' ? 640 : 420);  // 무대 앞 어디서나
  return Math.hypot(tv.x - self.x, tv.y - self.y) <= terrain.tvReach;
}
