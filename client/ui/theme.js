'use strict';
// 창 테마, 채팅창 스킨, 오른쪽 위 버튼의 픽셀 아이콘.

// ------------------------------------------------------------ 채팅창 스킨

const chatSkinButton = document.getElementById('chat-skin');
const chatSkinMenu = document.getElementById('chat-skins');
const CHAT_SKINS = [
  ['', '기본', 'rgba(12, 15, 20, .8)'],
  ['retro', '레트로', '#efe6cf'],
  ['terminal', '터미널', '#06140a'],
  ['messenger', '메신저', '#dcebff'],
  ['candy', '캔디', '#ffe4f2'],
  ['glass', '유리', 'linear-gradient(160deg, #b8999a, #6c5656)'],
];
let chatSkin = '';
try { chatSkin = localStorage.getItem('mmo.chatSkin') || ''; } catch { /* 기본 스킨 */ }

function setChatSkin(skin) {
  if (!CHAT_SKINS.some(([id]) => id === skin)) skin = '';
  chatSkin = skin;
  for (const [id] of CHAT_SKINS) if (id) chatEl.classList.toggle(`skin-${id}`, id === skin);
  for (const button of chatSkinMenu.children) button.setAttribute('aria-checked', String(button.dataset.skin === skin));
  try { localStorage.setItem('mmo.chatSkin', skin); } catch { /* 이번 접속에만 적용 */ }
}

function setChatSkinMenu(open) {
  chatSkinMenu.hidden = !open;
  chatSkinButton.setAttribute('aria-expanded', String(open));
}

for (const [id, name, color] of CHAT_SKINS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.setAttribute('role', 'menuitemradio');
  button.dataset.skin = id;
  const swatch = document.createElement('i');
  swatch.style.background = color;
  button.append(swatch, name);
  button.addEventListener('click', () => {
    setChatSkin(id);
    const theme = id === 'retro' ? '' : id || 'basic';   // 창에도 같은 스킨이 있으면 창과 화면 위 버튼도 한꺼번에 바꾼다
    if (isUiTheme(theme)) setUiTheme(theme);
    setChatSkinMenu(false);
  });
  chatSkinMenu.append(button);
}
chatSkinButton.addEventListener('click', () => setChatSkinMenu(chatSkinMenu.hidden));
addEventListener('pointerdown', (e) => {
  if (!chatSkinMenu.hidden && !chatSkinMenu.contains(e.target) && e.target !== chatSkinButton) setChatSkinMenu(false);
});
setChatSkin(chatSkin);

// ------------------------------------------------------------ 창 테마
// 스킨은 하나다. 어느 창의 제목 줄 색동 단추로 골라도 모든 창, 화면 위 버튼, 채팅창이 한꺼번에 바뀐다.
// 채팅창의 스킨 단추로 골라도 창에 같은 스킨이 있으면 함께 바뀐다 (위의 CHAT_SKINS). 이 브라우저에 남긴다.

const UI_THEMES = [   // [이름표, 이름, 어울리는 채팅창 스킨, 미리보기 색: 바탕, 제목 줄, 제목 줄 끝, 글씨]. 이름표가 빈 것이 레트로
  ['', '레트로', 'retro', '#efe6cf', '#2a3a94', '#5b8fe0', '#23203a'],
  ['basic', '기본', '', '#161a21', '#2a303b', '#2a303b', '#ffffff'],
  ['messenger', '메신저', 'messenger', '#dcebff', '#2f6fd6', '#7cc0ff', '#1d2b44'],
  ['candy', '캔디', 'candy', '#ffe4f2', '#e0559b', '#ffa8d2', '#5a2a4a'],
  ['wood', '나무', 'retro', '#dcbf91', '#6b3f1f', '#a86a3a', '#3a2414'],
  ['night', '밤하늘', 'retro', '#2d2a55', '#5a3fc9', '#c4569f', '#ece8ff'],
  ['terminal', '터미널', 'terminal', '#071a0e', '#0d5c2b', '#1f9e50', '#7dffb0'],
  ['glass', '유리', 'glass', 'linear-gradient(160deg, #b8999a, #6c5656)', 'rgba(255, 255, 255, .4)', 'rgba(255, 255, 255, .4)', '#fff'],
];
const themeMenu = document.getElementById('theme-menu');
const themeList = document.getElementById('theme-list');
let themeAnchor = null;   // 메뉴를 연 제목 줄 단추
const isUiTheme = (id) => UI_THEMES.some(([key]) => key === id);
let uiTheme = isUiTheme(document.documentElement.dataset.uiTheme) ? document.documentElement.dataset.uiTheme : '';

// 색은 html 의 data-ui-theme 가 정하고, 창마다에도 같은 이름표를 단다. 유리처럼 모양까지 바뀌는 테마는 창의 이름표로 고르기 때문이다
function paintUiTheme() {
  if (uiTheme) document.documentElement.dataset.uiTheme = uiTheme;
  else delete document.documentElement.dataset.uiTheme;
  for (const win of document.querySelectorAll('.rwin')) win.dataset.uiTheme = uiTheme || 'retro';
  for (const button of themeList.children) button.setAttribute('aria-checked', String(button.dataset.theme === uiTheme));
}

function setUiTheme(id, withChat = false) {
  uiTheme = isUiTheme(id) ? id : '';
  paintUiTheme();
  saveSetting('mmo.uiTheme', uiTheme);
  paintHudIcons();
  if (withChat) setChatSkin(UI_THEMES.find(([key]) => key === uiTheme)[2]);
}

function setThemeMenu(anchor) {
  themeAnchor?.setAttribute('aria-expanded', 'false');
  themeAnchor = anchor;
  themeMenu.hidden = !anchor;
  if (!anchor) return;
  anchor.setAttribute('aria-expanded', 'true');
  const at = anchor.getBoundingClientRect(), width = themeMenu.offsetWidth, height = themeMenu.offsetHeight;
  themeMenu.style.left = `${clamp(at.right - width, 8, Math.max(8, innerWidth - width - 8))}px`;
  themeMenu.style.top = `${at.bottom + 4 + height <= innerHeight - 8 ? at.bottom + 4 : Math.max(8, at.top - height - 4)}px`;
}

for (const [id, name, , face, title, title2, ink] of UI_THEMES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.setAttribute('role', 'menuitemradio');
  button.dataset.theme = id;
  const swatch = document.createElement('i');
  swatch.className = 'theme-swatch';
  swatch.style.cssText = `--sw-face: ${face}; --sw-title: ${title}; --sw-title2: ${title2}; --sw-ink: ${ink}`;
  button.append(swatch, name);
  button.addEventListener('click', () => {
    setUiTheme(id, true);
    setThemeMenu(null);
    Sound.play('page');
  });
  themeList.append(button);
}
// 닫기 단추가 있는 창마다 그 앞에 테마 단추를 단다
for (const head of document.querySelectorAll('.rwin-title')) {
  const first = head.querySelector('.rwin-x');
  if (!first) continue;
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.className = 'rwin-x rwin-theme';
  button.title = '창 테마';
  button.setAttribute('aria-label', '창 테마 고르기');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (e) => {
    e.stopPropagation();   // 지도처럼 제목 줄을 누르면 접히는 창도 그대로 둔다
    setThemeMenu(themeAnchor === button ? null : button);
  });
  first.before(button);
}
addEventListener('pointerdown', (e) => {
  if (!themeMenu.hidden && !themeMenu.contains(e.target) && !e.target.closest?.('.rwin-theme')) setThemeMenu(null);
});
addEventListener('resize', () => setThemeMenu(null));
paintUiTheme();

// ------------------------------------------------------------ 오른쪽 위 버튼의 픽셀 아이콘
// 12×12 점 그림을 두 배로 키워 버튼 이름 앞에 붙인다. 휴대폰에서는 이름을 숨기고 아이콘만 보인다.

const HUD_PALETTE = { k: '#23203a', w: '#fffbf1', s: '#bcae8c', y: '#ffd84d', p: '#ff5d9e', b: '#5b8fe0', g: '#61d07a', n: '#a86e34', o: '#ff9f5a' };
const HUD_ICONS = {
  'guest-open': [   // 펼친 방명록과 책갈피
    '............', '.kkkk..kkkk.', 'kwwwwkkwwwwk', 'kwsswkkwsswk', 'kwwwwkkwwwwk', 'kwsswkkwsswk',
    'kwwwwkkwwwwk', 'kwsswkkwsswk', 'kwwwwkkwwwwk', 'kkkkkkkkkkkk', '.nnnnkknpnn.', '........p...',
  ],
  'todo-open': [   // 체크 표시가 있는 클립보드
    '....kkkk....', '.kkkyyyykkk.', '.kwwwwwwwwk.', '.kwwwwgwwwk.', '.kwgwgwsswk.', '.kwwgwwwwwk.',
    '.kwwwwwwwwk.', '.kwwwwgwwwk.', '.kwgwgwsswk.', '.kwwgwwwwwk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.',
  ],
  'focus-open': [   // 타이머
    '....kkkk....', '..kkwwwwkk..', '.kwwwwpwwwk.', '.kwwwwpwwwk.', 'kwwwwwpwwwwk', 'kwwwwwpwwwwk',
    'kwwwwwpppwwk', 'kwwwwwwwwwwk', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....',
  ],
  'friends-open': [   // 나란히 선 두 친구
    '............', '..ppp...bbb.', '.ppppp.bbbbb', '.pkpkp.bkbkb', '.ppppp.bbbbb', '..ppp...bbb.',
    '............', '..ppp...bbb.', '.ppppp.bbbbb', '.ppppp.bbbbb', '.ppppp.bbbbb', '............',
  ],
  'profile-open': [   // 캐릭터 카드
    '............', 'kkkkkkkkkkkk', 'kbbbbbbbbbbk', 'kwwwwwwwwwwk', 'kwgggwsssswk', 'kwgkgwwwwwwk',
    'kwgggwsssswk', 'kwwwwwwwwwwk', 'kwssssssswwk', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk', '............',
  ],
  'shop-open': [   // 동전이 그려진 쇼핑백
    '............', '....kkkk....', '...k....k...', '...k....k...', '.kkkkkkkkkk.', '.kppppppppk.',
    '.kppppppppk.', '.kpppyypppk.', '.kppyyyyppk.', '.kpppyypppk.', '.kppppppppk.', '.kkkkkkkkkk.',
  ],
  'music-toggle': [   // 이어진 음표
    '............', '....kkkkkkk.', '....kkkkkkk.', '....k.....k.', '....k.....k.', '....k.....k.',
    '....k.....k.', '..kkk...kkk.', '.kpppk.kpppk', '.kpppk.kpppk', '..kkk...kkk.', '............',
  ],
  'sfx-toggle': [   // 소리 나는 스피커
    '............', '......k.....', '.....kk..k..', '....kwk...k.', 'kkkkwwk.k..k', 'kwwwwwk..k.k',
    'kwwwwwk..k.k', 'kkkkwwk.k..k', '....kwk...k.', '.....kk..k..', '......k.....', '............',
  ],
  'cinema-full': [   // 화면 네 귀퉁이
    'kkkk....kkkk', 'k..........k', 'k..........k', 'k..........k', '............', '....oooo....',
    '....oooo....', '............', 'k..........k', 'k..........k', 'k..........k', 'kkkk....kkkk',
  ],
};

const hudIcons = [];   // [캔버스, 점 그림]. 창 테마를 바꾸면 테두리(k)를 그 테마의 글씨 색으로 다시 칠한다

// 어두운 테마에서도 보이게 테두리는 창 글씨 색(--r-ink)으로 칠한다
function paintHudIcons() {
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--r-ink').trim() || HUD_PALETTE.k;
  for (const [canvas, rows] of hudIcons) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 12, 12);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (!HUD_PALETTE[ch]) return;
      c.fillStyle = ch === 'k' ? ink : HUD_PALETTE[ch];
      c.fillRect(x, y, 1, 1);
    }));
  }
}

function hudIcon(rows) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 12;
  canvas.className = 'hud-icon';
  canvas.setAttribute('aria-hidden', 'true');
  hudIcons.push([canvas, rows]);
  return canvas;
}

for (const [id, rows] of Object.entries(HUD_ICONS)) {
  const button = document.getElementById(id);
  if (!button) continue;
  const label = document.createElement('span');
  label.className = 'hud-label';
  for (const node of [...button.childNodes]) if (node.nodeType === Node.TEXT_NODE) label.append(node);
  button.prepend(hudIcon(rows), label);
  button.title = label.textContent.trim();
  button.setAttribute('aria-label', button.title);
}
paintHudIcons();
