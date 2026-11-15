'use strict';
// 화면 크기 맞추기, 로그인과 캐릭터 만들기 화면.

// ------------------------------------------------------------ 화면 크기

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ 로그인과 캐릭터 선택

function setAuthBusy(busy, message) {
  authSubmit.disabled = busy;
  authStatus.textContent = message;
}

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = authId.value.trim();
  const password = authPw.value;
  if (!id || !password || authSubmit.disabled) return;
  if (/\s/.test(id)) {
    setAuthBusy(false, '아이디에는 공백을 쓸 수 없습니다.');
    return;
  }
  setAuthBusy(true, '확인 중...');
  hompyMode = document.querySelector('input[name="auth-mode"]:checked').value === 'hompy';
  Sound.unlock();
  const send = () => ws.send(`login ${id} ${password}`);
  if (ws && ws.readyState === WebSocket.OPEN) send();
  else connect(send);
});

function showCharacterSelect(msg) {
  authPw.value = '';
  setAuthBusy(false, '');
  authEl.hidden = true;
  charEl.hidden = false;

  charName.value = msg.nick || msg.id;
  setLookColor(msg.h || randomBodyColor());
  loadBagLayout(msg.id);
  look.arms = msg.arms;
  look.legs = msg.legs;
  look.limbColor = msg.limb;
  for (const name of ['arms', 'legs', 'limbColor']) {
    const radio = charForm.querySelector(`input[name="${name}"][value="${look[name]}"]`);
    if (radio) radio.checked = true;
  }
  charName.focus();
}

// 몸 색은 '#rrggbb'. 색상 선택기와 R, G, B 슬라이더가 서로를 따라간다.
function setLookColor(color) {
  look.color = color;
  charColor.value = color;
  charChannels.forEach(({ slider, value }, i) => {
    const channel = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
    slider.value = channel;
    value.textContent = channel;
  });
}

function randomBodyColor() {  // 처음 만드는 캐릭터는 너무 어둡거나 밝지 않은 색으로 시작한다
  const channel = () => (70 + Math.floor(Math.random() * 166)).toString(16).padStart(2, '0');
  return `#${channel()}${channel()}${channel()}`;
}

charColor.addEventListener('input', () => setLookColor(charColor.value));
for (const { slider } of charChannels) {
  slider.addEventListener('input', () => {
    setLookColor(`#${charChannels.map((c) => Number(c.slider.value).toString(16).padStart(2, '0')).join('')}`);
  });
}
charForm.addEventListener('change', (e) => {
  if (e.target.type === 'radio') look[e.target.name] = Number(e.target.value);
});

charForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = charName.value.trim();
  if (!name || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(`join ${look.color} ${look.arms} ${look.legs} ${look.limbColor} ${name}`);
  saveResume({ look: { ...look }, name, hompy: hompyMode });
});

charLogout.addEventListener('click', () => {
  closeMessage = '';
  clearResume();
  if (ws) ws.close();
});

function drawCharacterPreview(now) {
  const { width, height } = charPreview;
  previewCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewCtx.clearRect(0, 0, width, height);
  previewCtx.setTransform(3, 0, 0, 3, width / 2, height * 0.68);
  drawCharacter(previewCtx, {
    x: 0, y: 0, color: look.color, arms: look.arms, legs: look.legs, limbColor: look.limbColor,
    dirX: 0, dirY: 1, moving: Math.floor(now / 2500) % 2 === 1, seat: 0, grip: 0, t: now,
  });
}
