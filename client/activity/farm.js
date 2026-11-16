// 농장과 요리. 마을 동쪽의 나무 문으로 들어가는 농장에서 씨앗을 심고 물을 주고 거두며, 닭장과 젖소에게서 달걀과 우유를 얻는다.
// 거둔 것은 출하 상자에 팔거나, 조리대(농장의 바깥 조리대, 집의 주방 가구) 앞에서 요리한다. 요리는 과정마다 짧은 손놀림 놀이를 한다.
// 표의 순서는 서버 activity/farm.hpp 와 같아야 한다.
'use strict';

const CROPS = [
  { name: '당근', minutes: 3, color: '#f08a2e' }, { name: '감자', minutes: 5, color: '#c9a36a' }, { name: '토마토', minutes: 7, color: '#e2483c' },
  { name: '양배추', minutes: 8, color: '#9fd27a' }, { name: '옥수수', minutes: 10, color: '#f4d03f' }, { name: '밀', minutes: 4, color: '#e3c26a' },
  { name: '딸기', minutes: 15, color: '#e83a5a' }, { name: '호박', minutes: 20, color: '#f0922e' },
];
const GOOD_EGG = 8, GOOD_MILK = 9, SEED_BASE = 10, DISH_BASE = 18;
// 요리법: needs 는 [물건 번호, 개수], fish 는 낚은 물고기 수, steps 는 과정 (C 썰기, S 젓기, F 뒤집기, H 불 조절, P 담기)
const RECIPES = [
  { name: '채소 샐러드', needs: [[2, 1], [3, 1]], fish: 0, steps: 'CP' },
  { name: '당근 수프', needs: [[0, 2], [GOOD_MILK, 1]], fish: 0, steps: 'CHS' },
  { name: '감자튀김', needs: [[1, 2]], fish: 0, steps: 'CH' },
  { name: '오믈렛', needs: [[GOOD_EGG, 2], [2, 1]], fish: 0, steps: 'SF' },
  { name: '팬케이크', needs: [[5, 1], [GOOD_EGG, 1], [GOOD_MILK, 1]], fish: 0, steps: 'SFP' },
  { name: '옥수수 버터구이', needs: [[4, 2]], fish: 0, steps: 'HF' },
  { name: '토마토 파스타', needs: [[5, 1], [2, 2]], fish: 0, steps: 'CHS' },
  { name: '생선구이', needs: [], fish: 1, steps: 'FH' },
  { name: '생선 스튜', needs: [[1, 1], [3, 1]], fish: 1, steps: 'CHS' },
  { name: '호박 파이', needs: [[7, 1], [5, 1], [GOOD_EGG, 1]], fish: 0, steps: 'CSH' },
  { name: '딸기 케이크', needs: [[6, 2], [5, 1], [GOOD_EGG, 1], [GOOD_MILK, 1]], fish: 0, steps: 'SHP' },
  { name: '딸기 우유', needs: [[6, 1], [GOOD_MILK, 1]], fish: 0, steps: 'CS' },
];
const GOOD_NAMES = [...CROPS.map((c) => c.name), '달걀', '우유', ...CROPS.map((c) => `${c.name} 씨앗`), ...RECIPES.map((r) => r.name)];
const GOOD_COUNT = GOOD_NAMES.length;
const KITCHEN_KINDS = new Set(['farm_kitchen', 'kitchen_counter', 'kitchen_bar', 'kitchen_island']);

// 농장의 물건은 가방에도 들어 있다: 버리고, 교환하고, 요리는 눌러서 먹는다. 가방의 아이템 표에 체스 설명서 앞으로 끼워 넣는다
myGoods = new Array(GOOD_COUNT).fill(0);
ITEMS.splice(ITEMS.length - 1, 0, ...GOOD_NAMES.map((name, good) => {
  if (good >= DISH_BASE) return { name, good, dish: true, grade: '요리', desc: `${RECIPES[good - DISH_BASE].steps.length}가지 과정을 거쳐 만든 요리. 먹으면 HP가 30 회복되고, 출하 상자에 팔면 값을 잘 쳐 준다.` };
  if (good >= SEED_BASE) return { name, good, grade: '씨앗', desc: `빈 밭 앞에서 E 를 눌러 심는다. 다 자라는 데 ${CROPS[good - SEED_BASE].minutes}분쯤 걸리고, 물을 주면 더 빨리 자란다.` };
  if (good === GOOD_EGG) return { name, good, grade: '재료', desc: '농장의 닭장에서 꺼낸 달걀. 오믈렛이나 팬케이크에 들어간다.' };
  if (good === GOOD_MILK) return { name, good, grade: '재료', desc: '농장의 젖소에게서 짠 우유. 수프나 케이크에 들어간다.' };
  return { name, good, grade: '작물', desc: `밭에서 거둔 ${name}. 요리 재료로 쓰거나 출하 상자에 판다.` };
}));

// ------------------------------------------------------------ 그림: 작물과 물건

// 밭에 자라는 작물. stage 0 씨앗, 1 새싹, 2 자라는 중, 3 다 자람. (x, y) 는 밭 칸의 가운데
function drawCrop(kind, stage, x, y, now) {
  const base = y + 8, sway = Math.sin(now / 900 + x * 0.05) * (stage ? 1.2 : 0);
  if (stage === 0) {   // 흙무더기 세 개
    for (const dx of [-22, 0, 22]) {
      oval(x + dx, base, 9, 4, '#5b3d24');
      fillCircles('#e9dcc0', [[x + dx, base - 2, 1.6]]);
    }
    return;
  }
  const spots = [-24, 0, 24];
  const leaf = (lx, ly, rx, ry, color, tilt) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(tilt);
    oval(0, 0, rx, ry, color);
    ctx.restore();
  };
  if (stage === 1) {   // 두 잎 새싹
    for (const dx of spots) {
      box(x + dx - 0.8, base - 9, 1.6, 9, '#4f9a45');
      leaf(x + dx - 4 + sway, base - 10, 5, 2.6, '#6cc04f', -0.5);
      leaf(x + dx + 4 + sway, base - 10, 5, 2.6, '#6cc04f', 0.5);
    }
    return;
  }
  const ripe = stage === 3, grow = ripe ? 1 : 0.72;
  const green = '#4f9a45', light = '#74c455';
  for (const dx of spots) {
    const px = x + dx;
    oval(px, base + 1, 11 * grow, 3.5, 'rgba(35, 22, 10, 0.3)');   // 흙 위의 그늘
    if (kind === 0) {          // 당근: 깃털 같은 잎, 다 자라면 주황 머리가 흙 위로
      for (const a of [-0.6, -0.2, 0.2, 0.6]) leaf(px + Math.sin(a) * 9 * grow + sway, base - 12 * grow, 3, 9 * grow, a % 0.4 ? light : green, a);
      if (ripe) oval(px, base - 1, 5.5, 4, '#f08a2e');
    } else if (kind === 1) {   // 감자: 낮고 둥근 덤불, 다 자라면 감자가 보인다
      fillCircles(green, [[px - 6, base - 8 * grow, 7 * grow], [px + 6, base - 8 * grow, 7 * grow]]);
      fillCircles(light, [[px + sway, base - 13 * grow, 7 * grow]]);
      if (ripe) {
        oval(px - 6, base, 5.5, 4, '#c9a36a');
        oval(px + 6, base + 1, 5, 3.6, '#b98f58');
      }
    } else if (kind === 2 || kind === 6) {   // 토마토·딸기: 덤불에 열매
      const tall = kind === 2 ? 26 : 14;
      if (kind === 2) box(px - 1, base - tall * grow, 2, tall * grow, '#7a5a34');
      fillCircles(green, [[px - 6, base - tall * 0.5 * grow, 8 * grow], [px + 6, base - tall * 0.5 * grow, 8 * grow]]);
      fillCircles(light, [[px + sway, base - tall * 0.85 * grow, 8 * grow]]);
      const fruit = ripe ? CROPS[kind].color : '#9ccf6a';
      if (ripe) fillCircles(fruit, [[px - 6, base - tall * 0.35 * grow, 3.4], [px + 5, base - tall * 0.6 * grow, 3.4], [px + 1, base - tall * 0.15 * grow - 2, 3]]);
      else {   // 꽃이 피고 풋열매가 맺힌다
        fillCircles(kind === 2 ? '#f6dc5a' : '#ffffff', [[px - 6, base - tall * 0.4 * grow, 2.2], [px + 5, base - tall * 0.62 * grow, 2.2]]);
        fillCircles(kind === 2 ? '#e0a020' : '#f6dc5a', [[px - 6, base - tall * 0.4 * grow, 0.9], [px + 5, base - tall * 0.62 * grow, 0.9]]);
        fillCircles(fruit, [[px + 1, base - tall * 0.15 * grow - 2, 2.4]]);
      }
    } else if (kind === 3) {   // 양배추: 겹겹이 싸인 공
      oval(px, base - 2, 14 * grow, 6 * grow, '#5fae55');
      fillCircles(ripe ? '#b5e08a' : '#8fd06a', [[px + sway * 0.3, base - 8 * grow, 9.5 * grow]]);
      strokeLines('rgba(60, 120, 50, 0.6)', 1.2, () => {
        ctx.arc(px + 2, base - 8 * grow, 6 * grow, -2.2, 0.6);
      });
    } else if (kind === 4) {   // 옥수수: 키 큰 줄기와 옥수수자루
      const h = 40 * grow;
      box(px - 1.5, base - h, 3, h, '#5fa04a');
      for (const [side, t] of [[-1, 0.35], [1, 0.55], [-1, 0.78]]) leaf(px + side * 8 + sway, base - h * t, 10, 3, light, side * -0.5);
      if (ripe) {
        oval(px + 4, base - h * 0.52, 3.6, 8, '#f4d03f');
        strokeLines('#c9a21e', 1, () => {
          ctx.moveTo(px + 4, base - h * 0.52 - 7);
          ctx.lineTo(px + 4, base - h * 0.52 + 7);
        });
      }
    } else if (kind === 5) {   // 밀: 가는 줄기 여럿, 다 자라면 황금빛 이삭
      const h = 30 * grow, color = ripe ? '#e3c26a' : '#8fc95a';
      for (const k of [-6, -2, 2, 6]) {
        strokeLines(color, 1.6, () => {
          ctx.moveTo(px + k, base);
          ctx.quadraticCurveTo(px + k + sway, base - h * 0.6, px + k * 1.4 + sway * 2, base - h);
        });
        oval(px + k * 1.4 + sway * 2, base - h, 2.2, 5, ripe ? '#d9ad3e' : '#7dba4c');
      }
    } else {                   // 호박: 넓은 잎 덩굴과 주황 호박
      leaf(px - 8, base - 6 * grow, 9 * grow, 6 * grow, green, -0.3);
      leaf(px + 8 + sway, base - 8 * grow, 9 * grow, 6 * grow, light, 0.3);
      if (ripe) {
        fillCircles('#e07a1e', [[px - 4, base - 5, 7.5], [px + 4, base - 5, 7.5]]);
        fillCircles('#f0922e', [[px, base - 5, 8]]);
        box(px - 1.2, base - 16, 2.4, 5, '#4f7a34', 1);
      } else {
        fillCircles('#b9c95a', [[px, base - 3, 4.5]]);
        fillCircles('#f6c531', [[px + 9 + sway, base - 12, 3]]);   // 노란 호박꽃
        fillCircles('#e09a1e', [[px + 9 + sway, base - 12, 1.2]]);
      }
    }
  }
}

// 곳간과 가게에 쓰는 물건 그림. (x, y) 를 가운데로 s 배
function drawGood(good, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const plate = () => {
    oval(0, 7, 15, 6, '#d8d2c4');
    oval(0, 6, 15, 6, '#ffffff');
    oval(0, 6, 10, 3.6, '#f1ede2');
  };
  const bowl = (color) => {
    polygon([[-13, 0], [13, 0], [9, 11], [-9, 11]], '#f4efe4');
    oval(0, 0, 13, 4.5, '#e2dccd');
    oval(0, 0, 11, 3.4, color);
  };
  if (good >= SEED_BASE && good < DISH_BASE) {   // 씨앗 봉투: 작물 그림이 붙은 종이 봉투
    box(-10, -13, 20, 26, '#efe2c2', 3);
    box(-10, -13, 20, 6, '#d9c79a', [3, 3, 0, 0]);
    ctx.scale(0.62, 0.62);
    ctx.translate(0, 5);
    good -= SEED_BASE;
  }
  if (good === 0) {            // 당근
    polygon([[-5, -6], [5, -6], [0, 13]], '#f08a2e');
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save();
      ctx.translate(0, -6);
      ctx.rotate(a);
      oval(0, -6, 2.4, 6.5, '#5fae55');
      ctx.restore();
    }
  } else if (good === 1) {     // 감자
    oval(0, 1, 12, 9, '#c9a36a');
    fillCircles('#a8824c', [[-5, -1, 1.3], [3, 3, 1.3], [6, -3, 1.1]]);
  } else if (good === 2) {     // 토마토
    fillCircles('#e2483c', [[0, 2, 11]]);
    fillCircles('rgba(255, 255, 255, 0.5)', [[-4, -2, 3]]);
    for (const a of [-1, -0.33, 0.33, 1]) {
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(a);
      oval(0, -2, 1.8, 4.5, '#4f9a45');
      ctx.restore();
    }
  } else if (good === 3) {     // 양배추
    fillCircles('#7dbf5c', [[0, 1, 12]]);
    fillCircles('#b5e08a', [[1, 0, 9]]);
    strokeLines('rgba(60, 120, 50, 0.65)', 1.3, () => {
      ctx.arc(2, 0, 6, -2.4, 0.8);
      ctx.moveTo(-6, 5);
      ctx.quadraticCurveTo(-2, -2, -7, -6);
    });
  } else if (good === 4) {     // 옥수수
    oval(0, 0, 6, 13, '#f4d03f');
    strokeLines('#c9a21e', 1, () => {
      for (const dx of [-2.5, 0, 2.5]) {
        ctx.moveTo(dx, -11);
        ctx.lineTo(dx, 11);
      }
      for (let dy = -8; dy <= 8; dy += 4) {
        ctx.moveTo(-5, dy);
        ctx.lineTo(5, dy);
      }
    });
    polygon([[-7, 13], [-9, -2], [-3, 8]], '#5fae55');
    polygon([[7, 13], [9, -2], [3, 8]], '#74c455');
  } else if (good === 5) {     // 밀
    for (const [dx, tilt] of [[-5, -0.25], [0, 0], [5, 0.25]]) {
      ctx.save();
      ctx.translate(dx, 12);
      ctx.rotate(tilt);
      box(-0.7, -16, 1.4, 16, '#c9a23e');
      for (let k = 0; k < 4; k++) fillCircles('#e3c26a', [[-2, -16 - k * 3, 2], [2, -17.5 - k * 3, 2]]);
      ctx.restore();
    }
  } else if (good === 6) {     // 딸기
    ctx.fillStyle = '#e83a5a';
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.bezierCurveTo(-16, 2, -10, -9, 0, -6);
    ctx.bezierCurveTo(10, -9, 16, 2, 0, 13);
    ctx.fill();
    fillCircles('#ffe9a8', [[-4, 0, 1], [3, -1, 1], [0, 5, 1], [5, 4, 1], [-5, 5, 1]]);
    for (const a of [-0.9, 0, 0.9]) {
      ctx.save();
      ctx.translate(0, -6);
      ctx.rotate(a);
      oval(0, -3, 2.2, 4.5, '#4f9a45');
      ctx.restore();
    }
  } else if (good === 7) {     // 호박
    fillCircles('#e07a1e', [[-6, 2, 9], [6, 2, 9]]);
    fillCircles('#f0922e', [[0, 2, 10]]);
    box(-1.5, -12, 3, 6, '#4f7a34', 1);
  } else if (good === GOOD_EGG) {
    oval(-4, 2, 6.5, 8.5, '#f6ead6');
    oval(5, 3, 6, 8, '#e9d3b0');
    fillCircles('rgba(255, 255, 255, 0.7)', [[-6, -1, 2]]);
  } else if (good === GOOD_MILK) {
    box(-6, -6, 12, 19, '#f7f9fb', 3);
    box(-3.5, -13, 7, 8, '#f7f9fb', 2);
    box(-4, -15, 8, 3.5, '#5a8fd0', 1);
    box(-6, 0, 12, 7, '#7fb0e8');
  } else if (good >= DISH_BASE) {
    const dish = good - DISH_BASE;
    if (dish === 0) {          // 샐러드
      bowl('#74c455');
      fillCircles('#5fae55', [[-5, -3, 4.5], [4, -4, 5], [0, -6, 4]]);
      fillCircles('#e2483c', [[-2, -2, 2.4], [6, -1, 2.2]]);
    } else if (dish === 1) {   // 당근 수프
      bowl('#f0a04a');
      strokeLines('rgba(255, 255, 255, 0.8)', 1.4, () => { ctx.arc(0, 0, 5, 0.3, 2.6); });
      fillCircles('#5fae55', [[2, -1, 1.5]]);
    } else if (dish === 2) {   // 감자튀김
      polygon([[-9, -2], [9, -2], [6, 12], [-6, 12]], '#d9463e');
      for (const [dx, h, tilt] of [[-6, 12, -0.2], [-2, 15, 0], [2, 13, 0.1], [6, 11, 0.25]]) {
        ctx.save();
        ctx.translate(dx, -2);
        ctx.rotate(tilt);
        box(-1.6, -h, 3.2, h, '#f4c84a', 1);
        ctx.restore();
      }
      box(-9, -2, 18, 3, '#b8332c');
    } else if (dish === 3) {   // 오믈렛
      plate();
      ctx.fillStyle = '#f6cf4a';
      ctx.beginPath();
      ctx.ellipse(0, 3, 12, 6.5, 0, Math.PI, 0);
      ctx.quadraticCurveTo(0, 9, -12, 3);
      ctx.fill();
      strokeLines('#d9463e', 1.8, () => {
        ctx.moveTo(-7, 1);
        ctx.lineTo(-3, -2);
        ctx.lineTo(1, 1);
        ctx.lineTo(5, -2);
      });
    } else if (dish === 4) {   // 팬케이크
      plate();
      for (let k = 0; k < 3; k++) {
        oval(0, 4 - k * 4, 11, 4, '#b9793a');
        oval(0, 3 - k * 4, 11, 3.6, '#e0a55a');
      }
      box(-3, -9, 6, 4, '#fff3b0', 1);
      strokeLines('#a8622a', 1.5, () => {
        ctx.moveTo(6, -5);
        ctx.quadraticCurveTo(9, 0, 7, 5);
      });
    } else if (dish === 5) {   // 옥수수 버터구이
      plate();
      ctx.save();
      ctx.rotate(-0.35);
      oval(0, 1, 13, 5.5, '#f4c53a');
      strokeLines('rgba(130, 70, 20, 0.7)', 1.3, () => {
        for (const dx of [-7, -2, 3, 8]) {
          ctx.moveTo(dx, -4);
          ctx.lineTo(dx - 2, 6);
        }
      });
      box(13, -0.5, 6, 2, '#b98a4a', 1);
      ctx.restore();
    } else if (dish === 6) {   // 토마토 파스타
      plate();
      strokeLines('#f0d27a', 2, () => {
        for (let k = 0; k < 4; k++) ctx.ellipse(0, 2, 9 - k * 2, 4 - k * 0.8, 0, 0, TAU);
      });
      fillCircles('#d9463e', [[0, 0, 4]]);
      fillCircles('#5fae55', [[1, -2, 1.5]]);
    } else if (dish === 7) {   // 생선구이
      plate();
      ctx.save();
      ctx.rotate(-0.12);
      oval(-1, 2, 11, 5, '#c98a4a');
      polygon([[9, 2], [15, -3], [15, 7]], '#b9793a');
      fillCircles('#3a2a1e', [[-8, 1, 1]]);
      strokeLines('rgba(80, 40, 15, 0.7)', 1.2, () => {
        for (const dx of [-4, 0, 4]) {
          ctx.moveTo(dx, -2);
          ctx.lineTo(dx - 2, 6);
        }
      });
      ctx.restore();
    } else if (dish === 8) {   // 생선 스튜
      bowl('#d9562e');
      fillCircles('#f1e2c0', [[-4, 0, 2.4], [5, 1, 2]]);
      fillCircles('#74c455', [[1, -1, 2]]);
      strokeLines('rgba(255, 255, 255, 0.55)', 1.2, () => {
        ctx.moveTo(-3, -8);
        ctx.quadraticCurveTo(-6, -11, -3, -14);
        ctx.moveTo(4, -8);
        ctx.quadraticCurveTo(1, -11, 4, -14);
      });
    } else if (dish === 9) {   // 호박 파이
      plate();
      polygon([[-11, 6], [11, 6], [0, -10]], '#e0862e');
      polygon([[-11, 6], [11, 6], [9, 2], [-9, 2]], '#c9a05a');
      fillCircles('#fff6e0', [[0, -1, 2.6]]);
    } else if (dish === 10) {  // 딸기 케이크
      plate();
      box(-9, -5, 18, 12, '#fff6ec', 2);
      box(-9, 0, 18, 2.5, '#f29bbd');
      box(-9, -6, 18, 3, '#ffffff', 2);
      fillCircles('#e83a5a', [[0, -9, 3.6]]);
      fillCircles('#4f9a45', [[0, -12, 1.4]]);
    } else {                   // 딸기 우유
      polygon([[-7, -10], [7, -10], [5, 12], [-5, 12]], 'rgba(255, 255, 255, 0.9)');
      polygon([[-6.3, -4], [6.3, -4], [5, 11], [-5, 11]], '#f7b5cc');
      box(1, -16, 2, 14, '#e83a5a', 1);
      fillCircles('#e83a5a', [[-7, -10, 3]]);
    }
  }
  ctx.restore();
}

function goodIcon(good, size = 34) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * 2;
  canvas.style.width = canvas.style.height = `${size}px`;
  canvas.className = 'good-icon';
  drawOn(canvas.getContext('2d'), () => drawGood(good, size, size, size / 17));
  return canvas;
}

// ------------------------------------------------------------ 그림: 농장

// 농장 구역의 바닥과 울타리. 방 번호 8 (서버 core/world.cpp 의 addPlace 에서 정한 꾸밈 번호)
// 작은 들꽃 한 송이. petal 은 꽃잎 색
function wildFlower(x, y, petal, size = 1) {
  strokeLines('#4f9a45', 1.4, () => {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 7 * size);
  });
  fillCircles(petal, [[x - 2.4 * size, y - 8 * size, 2.2 * size], [x + 2.4 * size, y - 8 * size, 2.2 * size], [x, y - 10.4 * size, 2.2 * size], [x, y - 5.8 * size, 2.2 * size]]);
  fillCircles('#ffe27a', [[x, y - 8 * size, 1.5 * size]]);
}

// 흙길 한 토막: 어두운 가장자리 위에 밝은 모래
function dirtPath(x, y, w, h, r = 18) {
  box(x - 3, y - 3, w + 6, h + 6, '#b99c62', r + 3);
  box(x, y, w, h, '#e0c891', r);
}

const FLOWER_COLORS = ['#ffffff', '#ff9ec4', '#ffd84d', '#c9a6ff', '#ff8a5c'];

ROOM_STYLES.push({
  side: '#3f7d3c',
  noMat: true,
  floor({ w, h }) {
    box(0, 0, w, h, '#78bd5e');
    for (let gx = 0; gx < w; gx += 120) box(gx, 0, 60, h, 'rgba(255, 255, 255, 0.045)');   // 깎은 풀의 결
    for (let gy = 20; gy < h; gy += 40) {   // 풀 포기와 토끼풀
      for (let gx = 16 + ((gy / 40) % 2) * 20; gx < w; gx += 40) {
        const n = floorNoise(gx, gy);
        if (n < 0.4) continue;
        if (n > 0.93) {
          fillCircles('#5fa04c', [[gx - 3, gy, 3], [gx + 3, gy, 3], [gx, gy - 4, 3]]);
          continue;
        }
        strokeLines(n > 0.75 ? '#93d474' : '#5fa04c', 1.6, () => {
          ctx.moveTo(gx - 3, gy);
          ctx.lineTo(gx - 4, gy - 6);
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx, gy - 8);
          ctx.moveTo(gx + 3, gy);
          ctx.lineTo(gx + 4, gy - 6);
        });
      }
    }
    // 밭 자리: 풀을 걷어 낸 밝은 땅과 그 둘레의 돌
    box(98, 192, 734, 438, '#6aa851', 22);
    box(104, 198, 722, 426, '#8ac26c', 18);
    box(104, 408, 722, 8, '#79b55e', 4);             // 위아래 두 구획 사이
    box(458, 198, 8, 426, '#79b55e', 4);             // 좌우 두 구획 사이
    // 흙길: 문에서 밭 아래를 지나 오른쪽 가게들로
    dirtPath(w / 2 - 34, h - 112, 68, 120, 10);
    dirtPath(110, h - 112, 960, 44);
    dirtPath(838, 170, 44, 500);
    dirtPath(858, 170, 290, 40);
    box(w / 2 - 34, h - 109, 68, 38, '#e0c891');     // 길이 만나는 곳의 이음매를 덮는다
    box(841, h - 112, 38, 41, '#e0c891');
    box(841, 173, 38, 34, '#e0c891');
    for (let k = 0; k < 26; k++) {                   // 길 위의 자갈
      const along = floorNoise(k * 13, 7), across = floorNoise(k * 29, 3);
      fillCircles(k % 2 ? '#cdb279' : '#f0dcae', [[124 + along * 930, h - 104 + across * 28, 2.2 + across * 2]]);
      if (k < 12) fillCircles(k % 2 ? '#cdb279' : '#f0dcae', [[846 + across * 28, 190 + along * 400, 2.2 + along * 2]]);
    }
    for (const sy of [h - 26, h - 52, h - 78]) oval(w / 2, sy, 20, 8, '#cfc5b0');   // 문 앞의 디딤돌
    // 축사 자리: 볏짚이 깔린 흙마당
    box(880, 548, 300, 124, '#c9a86a', 26);
    box(886, 554, 288, 112, '#dcbf85', 22);
    for (let k = 0; k < 22; k++) {
      const hx = 896 + floorNoise(k, 41) * 268, hy = 562 + floorNoise(k, 77) * 96;
      strokeLines('#f2de9a', 1.6, () => {
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 8, hy - 3);
        ctx.moveTo(hx + 3, hy + 3);
        ctx.lineTo(hx + 10, hy + 2);
      });
    }
    oval(96, 716, 44, 12, 'rgba(70, 130, 190, 0.35)');   // 우물가에 고인 물
    oval(84, 714, 16, 5, 'rgba(255, 255, 255, 0.35)');
    // 들꽃: 밭과 길을 피해 가장자리에 무리 지어 핀다
    const clusters = [[40, 150], [62, 300], [38, 470], [56, 590], [300, 150], [520, 140], [700, 160], [1150, 300], [1160, 470], [1010, 500], [930, 300], [1130, 110], [250, 730], [480, 735], [760, 735], [1020, 730]];
    clusters.forEach(([cx, cy], c) => {
      for (let k = 0; k < 5; k++) {
        const fx = cx + (floorNoise(c, k) - 0.5) * 56, fy = cy + (floorNoise(k, c + 9) - 0.5) * 30;
        wildFlower(fx, fy, FLOWER_COLORS[(c + k) % FLOWER_COLORS.length], 0.9 + floorNoise(c + k, 5) * 0.3);
      }
    });
    // 문: 양쪽 기둥과 열린 나무 문
    for (const side of [-1, 1]) {
      box(w / 2 + side * 46 - 6, h - 46, 12, 46, '#6b4423', 2);
      box(w / 2 + side * 46 - 8, h - 50, 16, 7, '#8a5a32', 2);
    }
  },
  wall({ w }) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -WALL_HEIGHT, w, WALL_HEIGHT);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, -WALL_HEIGHT, 0, 0);
    sky.addColorStop(0, '#8fcbf0');
    sky.addColorStop(1, '#e6f6fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, -WALL_HEIGHT, w, WALL_HEIGHT);
    fillCircles('rgba(255, 244, 190, 0.55)', [[w - 150, -92, 30]]);   // 해
    fillCircles('#fff3b8', [[w - 150, -92, 19]]);
    for (let cx = 90; cx < w; cx += 330) {   // 구름
      fillCircles('rgba(255, 255, 255, 0.92)', [[cx, -96, 13], [cx + 16, -100, 17], [cx + 36, -95, 12], [cx + 180, -78, 9], [cx + 193, -81, 12], [cx + 208, -77, 8]]);
    }
    for (let hx = 0; hx < w + 200; hx += 260) oval(hx, 6, 190, 62, '#a6d98c');   // 먼 언덕
    // 언덕 위의 풍차와 헛간
    const mx = 250;
    polygon([[mx - 9, -30], [mx + 9, -30], [mx + 5, -66], [mx - 5, -66]], '#e9dcc0');
    polygon([[mx - 8, -66], [mx + 8, -66], [mx, -76]], '#a8473a');
    strokeLines('#8a5f34', 2, () => {
      for (const a of [0.4, 0.4 + Math.PI / 2]) {
        ctx.moveTo(mx - Math.cos(a) * 20, -66 - Math.sin(a) * 20);
        ctx.lineTo(mx + Math.cos(a) * 20, -66 + Math.sin(a) * 20);
      }
    });
    const bx = 760;
    box(bx - 20, -52, 40, 24, '#c8423a');
    polygon([[bx - 24, -52], [bx + 24, -52], [bx + 12, -68], [bx - 12, -68]], '#8f2c26');
    box(bx - 6, -42, 12, 14, '#fbf6ea');
    for (let hx = 130; hx < w + 200; hx += 260) oval(hx, 10, 170, 44, '#8acb70');
    for (let tx = 30; tx < w; tx += 96) {   // 울타리 너머의 나무
      const lift = floorNoise(tx, 2) * 8;
      box(tx - 2, -30 - lift, 4, 16, '#7a5632');
      fillCircles('#5fa655', [[tx - 8, -36 - lift, 10], [tx + 8, -36 - lift, 10]]);
      fillCircles('#74bd60', [[tx, -44 - lift, 11]]);
    }
    ctx.restore();
    // 나무 울타리와 그 앞의 해바라기
    box(0, -34, w, 6, '#c2945c', 2);
    box(0, -16, w, 6, '#c2945c', 2);
    for (let px = 14; px < w; px += 42) {
      box(px - 4, -44, 8, 44, '#8a5f34', 2);
      box(px - 4, -44, 8, 4, '#b98a54', 2);
    }
    for (let sx = 60; sx < w; sx += 168) {
      box(sx - 1.3, -52, 2.6, 52, '#4f9a45');
      oval(sx + 6, -22, 6, 3, '#5fae55');
      oval(sx - 6, -32, 6, 3, '#5fae55');
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        fillCircles('#f6c531', [[sx + Math.cos(a) * 8, -56 + Math.sin(a) * 8, 4]]);
      }
      fillCircles('#6b4423', [[sx, -56, 5.5]]);
    }
  },
});

// 마을의 농장 입구: 간판을 건 나무 문과 해바라기. 건물 외형 번호 6
HOUSE_STYLES[6] = (b, ground, now, lit) => {
  const { x } = b;
  for (const side of [-1, 1]) {   // 옆으로 이어진 울타리
    const fx = x + side * 62;
    box(fx - 22, ground - 26, 44, 4, '#b98a54', 1);
    box(fx - 22, ground - 13, 44, 4, '#b98a54', 1);
    for (const dx of [-18, 0, 18]) box(fx + dx - 3, ground - 32, 6, 32, '#8a5f34', 1);
    const sx = x + side * 78, sway = Math.sin(now / 1100 + side) * 1.5;   // 해바라기
    box(sx - 1.2, ground - 46, 2.4, 46, '#4f9a45');
    oval(sx - 6, ground - 22, 6, 3, '#5fae55');
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      fillCircles('#f6c531', [[sx + sway + Math.cos(a) * 8, ground - 50 + Math.sin(a) * 8, 4]]);
    }
    fillCircles('#6b4423', [[sx + sway, ground - 50, 5.5]]);
  }
  for (const side of [-1, 1]) {   // 기둥
    box(x + side * 40 - 7, ground - 92, 14, 92, '#6b4423', 2);
    box(x + side * 40 - 9, ground - 8, 18, 8, '#5a3a1e', 2);
  }
  polygon([[x - 62, ground - 90], [x + 62, ground - 90], [x + 48, ground - 112], [x - 48, ground - 112]], '#a8473a');
  box(x - 64, ground - 94, 128, 7, '#7a2f26', 3);
  box(x - 38, ground - 86, 76, 26, '#efe2c2', 4);
  label(b.name, x, ground - 72.5, `800 17px ${FONT}`, '#5a3a1e');
  for (const side of [-1, 1]) {   // 활짝 열린 문짝
    polygon([[x + side * 33, ground - 46], [x + side * 33, ground - 2], [x + side * 18, ground + 6], [x + side * 18, ground - 40]], '#b98a54');
    strokeLines('#8a5f34', 1.5, () => {
      ctx.moveTo(x + side * 33, ground - 44);
      ctx.lineTo(x + side * 18, ground + 4);
    });
  }
  if (lit) drawGlowSoft(x, ground - 60, 46);
};

// ------------------------------------------------------------ 그림: 밭 한 칸
// 밭은 가운데 (x, y) 를 기준으로 104 × 80. 흙은 같고 둘레의 생김새가 여섯 가지다. wet 은 물을 준 지 얼마 안 된 흙

function bedSoil(x, y, hw, hh, wet, r = 6) {
  box(x - hw, y - hh, hw * 2, hh * 2, wet ? '#5a3d27' : '#7d5836', r);
  for (let dy = -hh + 12; dy <= hh - 6; dy += 16) {   // 이랑: 밝은 등과 어두운 고랑
    box(x - hw + 5, y + dy - 7, hw * 2 - 10, 4, wet ? '#6f4d32' : '#96693f', 2);
    box(x - hw + 5, y + dy - 1, hw * 2 - 10, 5, wet ? '#432b19' : '#654325', 2.5);
  }
  for (let k = 0; k < 10; k++) {   // 흙 알갱이
    const n = floorNoise(x + k * 37, y + k * 91), m = floorNoise(y + k * 53, x + k * 17);
    fillCircles(k % 3 ? (wet ? '#38230f' : '#5b3d24') : (wet ? '#8a6c4c' : '#b0916a'), [[x - hw + 8 + n * (hw * 2 - 16), y - hh + 8 + m * (hh * 2 - 16), 1.3]]);
  }
  if (wet) fillCircles('rgba(175, 220, 255, 0.55)', [[x - hw * 0.55, y - hh * 0.3, 1.8], [x + hw * 0.4, y + hh * 0.3, 1.6], [x + hw * 0.1, y - hh * 0.6, 1.3], [x - hw * 0.2, y + hh * 0.55, 1.4]]);
}

// 둘레를 따라 일정한 간격으로 점을 찍는다 (돌, 벽돌, 꽃)
function alongBedEdge(x, y, hw, hh, step, each) {
  let k = 0;
  for (let dx = -hw; dx <= hw; dx += step) {
    each(x + dx, y - hh, k++, 0);
    each(x + dx, y + hh, k++, 2);
  }
  for (let dy = -hh + step; dy <= hh - step; dy += step) {
    each(x - hw, y + dy, k++, 3);
    each(x + hw, y + dy, k++, 1);
  }
}

const BED_STYLES = [
  // 0 흙 두둑: 둥글게 돋운 흙과 귀퉁이의 풀
  (x, y, wet) => {
    box(x - 52, y - 40, 104, 80, wet ? '#3f2a18' : '#5b3d24', 12);
    bedSoil(x, y, 48, 36, wet, 9);
    for (const [sx, sy] of [[-50, 38], [50, 38], [-50, -36], [50, -36]]) {
      strokeLines('#5fae55', 1.8, () => {
        for (const a of [-4, 0, 4]) {
          ctx.moveTo(x + sx, y + sy);
          ctx.lineTo(x + sx + a, y + sy - 8);
        }
      });
    }
  },
  // 1 나무 틀밭: 널빤지로 짠 높은 틀
  (x, y, wet) => {
    box(x - 54, y - 44, 108, 90, '#6b4423', 3);
    box(x - 54, y - 44, 108, 9, '#a8794a', 2);
    bedSoil(x, y - 1, 46, 33, wet, 2);
    box(x - 54, y - 44, 7, 82, '#96693f');
    box(x + 47, y - 44, 7, 82, '#96693f');
    box(x - 54, y + 32, 108, 14, '#b98a54', 2);
    box(x - 54, y + 32, 108, 3, '#d2a56c', 2);
    box(x - 54, y + 43, 108, 3, '#8a5f34', 2);
    strokeLines('#8a5f34', 1.2, () => {
      for (const dx of [-18, 18]) {
        ctx.moveTo(x + dx, y + 33);
        ctx.lineTo(x + dx, y + 45);
      }
    });
    for (const dx of [-51, 44]) {   // 모서리 기둥과 못
      box(x + dx, y + 28, 7, 20, '#6b4423', 2);
      box(x + dx, y - 46, 7, 10, '#6b4423', 2);
    }
    fillCircles('#4a2f18', [[x - 30, y + 39, 1.2], [x + 30, y + 39, 1.2], [x, y + 39, 1.2]]);
  },
  // 2 돌담 텃밭: 크고 작은 돌을 둘렀다
  (x, y, wet) => {
    box(x - 54, y - 42, 108, 84, '#4d443a', 14);
    bedSoil(x, y, 46, 34, wet, 8);
    alongBedEdge(x, y, 49, 37, 14, (px, py, k) => {
      const n = floorNoise(px, py), r = 6.5 + n * 2.5;
      oval(px, py + 1.5, r + 0.5, r * 0.78, '#5d564c');
      oval(px, py, r, r * 0.74, ['#a39c90', '#b8b1a4', '#8f887c'][k % 3]);
      oval(px - r * 0.25, py - r * 0.22, r * 0.45, r * 0.26, 'rgba(255, 255, 255, 0.35)');
    });
  },
  // 3 벽돌 화단밭: 붉은 벽돌을 엇갈려 쌓았다
  (x, y, wet) => {
    box(x - 55, y - 43, 110, 88, '#7a3324', 3);
    bedSoil(x, y - 1, 45, 32, wet, 2);
    const brick = (bx, by, bw, bh, k) => {
      box(bx, by, bw - 1.5, bh - 1.5, k % 2 ? '#c9694d' : '#b5523c', 1.5);
      box(bx, by, bw - 1.5, 2, 'rgba(255, 255, 255, 0.18)', 1);
    };
    for (let k = 0; k < 7; k++) brick(x - 55 + k * 15.8, y - 43, 15.8, 10, k);
    for (let k = 0; k < 7; k++) brick(x - 55 + k * 15.8, y + 31, 15.8, 8, k + 1);
    brick(x - 55, y + 38, 7.9, 8, 1);   // 앞쪽은 두 단을 엇갈려
    for (let k = 0; k < 6; k++) brick(x - 47.1 + k * 15.8, y + 38, 15.8, 8, k);
    brick(x + 47.7, y + 38, 7.9, 8, 0);
    for (let k = 0; k < 6; k++) {
      brick(x - 55, y - 33 + k * 10.6, 10, 10.6, k + 1);
      brick(x + 45, y - 33 + k * 10.6, 10, 10.6, k);
    }
  },
  // 4 통나무 텃밭: 굵은 통나무 네 개
  (x, y, wet) => {
    bedSoil(x, y, 48, 35, wet, 3);
    const ring = (rx, ry, r) => {
      fillCircles('#e6c998', [[rx, ry, r]]);
      strokeLines('#b98a54', 1, () => { ctx.arc(rx, ry, r * 0.55, 0, TAU); });
      fillCircles('#8a5f34', [[rx, ry, 1.2]]);
    };
    box(x - 56, y - 46, 112, 11, '#8a5f34', 5.5);
    box(x - 56, y - 46, 112, 3.5, '#a8794a', 3);
    box(x - 57, y - 38, 11, 78, '#7a5330', 5.5);
    box(x + 46, y - 38, 11, 78, '#7a5330', 5.5);
    box(x - 57, y - 38, 3.5, 78, '#96693f', 3);
    box(x + 46, y - 38, 3.5, 78, '#96693f', 3);
    box(x - 58, y + 33, 116, 14, '#8a5f34', 7);
    box(x - 58, y + 33, 116, 4, '#a8794a', 3);
    strokeLines('#6b4423', 1, () => {
      for (const dx of [-30, -6, 22]) {
        ctx.moveTo(x + dx, y + 39);
        ctx.lineTo(x + dx + 12, y + 39);
      }
    });
    ring(x - 53, y + 40, 6);
    ring(x + 53, y + 40, 6);
    ring(x - 51, y - 40.5, 4.6);
    ring(x + 51, y - 40.5, 4.6);
  },
  // 5 꽃울타리 텃밭: 흰 말뚝 울타리와 모서리의 꽃
  (x, y, wet) => {
    box(x - 52, y - 40, 104, 80, wet ? '#3f2a18' : '#5b3d24', 6);
    for (let dx = -48; dx <= 48; dx += 12) {   // 뒤쪽 울타리는 흙보다 먼저
      box(x + dx - 3, y - 52, 6, 15, '#f4f1ea', [3, 3, 0, 0]);
    }
    box(x - 52, y - 45, 104, 3, '#dcd7cc', 1);
    bedSoil(x, y, 48, 36, wet, 4);
    box(x - 52, y + 33, 104, 3, '#dcd7cc', 1);
    for (let dx = -48; dx <= 48; dx += 12) {
      box(x + dx - 3, y + 27, 6, 16, '#ffffff', [3, 3, 0, 0]);
      box(x + dx + 1, y + 29, 2, 14, '#e4e0d6');
    }
    for (const [sx, sy, c] of [[-56, 44, 1], [56, 44, 2], [-58, 30, 3], [58, 28, 0], [-56, -34, 4], [56, -36, 1]]) wildFlower(x + sx, y + sy, FLOWER_COLORS[c]);
  },
];

function drawBed(style, x, y, wet = false) {
  BED_STYLES[style](x, y, wet);
}

// 물을 준 지 얼마 안 됐는지 (물을 다시 줄 수 있을 때까지는 젖은 흙으로 그린다)
function plotWet(plot, now = performance.now()) {
  return !!plot && plot.crop >= 0 && plot.water - (now - plot.at) / 1000 > 0;
}

// 농장의 밭은 네 구획이 저마다 다른 틀이다 (왼쪽 위부터 나무 틀, 흙 두둑, 돌담, 통나무)
function farmPlotStyle(i) {
  const row = Math.floor(i / 6), col = i % 6;
  return row < 2 ? (col < 3 ? 1 : 0) : (col < 3 ? 2 : 4);
}

function drawScarecrow(x, y, now, shirt, hat, patch) {
  groundShadow(x, y + 2, 16, 5);
  const sway = Math.sin(now / 1300 + x) * 0.04;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  box(-2.5, -74, 5, 74, '#8a5f34');
  box(-30, -56, 60, 5, '#8a5f34', 2);
  polygon([[-18, -58], [18, -58], [14, -26], [-14, -26]], shirt);
  box(-30, -58, 14, 8, shirt, 2);
  box(16, -58, 14, 8, shirt, 2);
  box(-8, -46, 8, 8, patch, 1);
  for (const side of [-1, 1]) {   // 소매 끝으로 삐져나온 짚
    strokeLines('#e3c26a', 1.4, () => {
      for (const a of [-3, 0, 3]) {
        ctx.moveTo(side * 30, -54);
        ctx.lineTo(side * 37, -54 + a);
      }
    });
  }
  fillCircles('#f2dfae', [[0, -70, 12]]);
  fillCircles('#3a2a1e', [[-4, -72, 1.6], [4, -72, 1.6]]);
  polygon([[-1.5, -69], [1.5, -69], [0, -66]], '#f08a2e');
  strokeLines('#3a2a1e', 1.4, () => {
    ctx.moveTo(-4, -65);
    ctx.quadraticCurveTo(0, -62, 4, -65);
  });
  polygon([[-17, -80], [17, -80], [9, -96], [-9, -96]], hat);
  box(-20, -82, 40, 4, hat, 2);
  box(-10, -86, 20, 3, patch);
  ctx.restore();
}

FLOOR_FURNITURE.add('farm_plot');
for (const kind of ['plot_soil', 'plot_wood', 'plot_stone', 'plot_brick', 'plot_log', 'plot_flower', 'garden_flowers']) FLOOR_FURNITURE.add(kind);
Object.assign(DECOR_NAMES, {
  plot_soil: '흙 두둑 텃밭', plot_wood: '나무 틀 텃밭', plot_stone: '돌담 텃밭', plot_brick: '벽돌 텃밭', plot_log: '통나무 텃밭', plot_flower: '꽃울타리 텃밭',
  garden_scarecrow: '허수아비', garden_fence: '나무 울타리', garden_flowers: '들꽃 무더기',
});
['plot_soil', 'plot_wood', 'plot_stone', 'plot_brick', 'plot_log', 'plot_flower'].forEach((kind, style) => {
  FURNITURE[kind] = ({ x, y, decor }) => drawBed(style, x, y, plotWet(decor && gardenBeds.get(decor.id)));
});
Object.assign(FURNITURE, {
  // 농장의 밭 한 칸
  farm_plot({ x, y }) {
    const i = Math.round((y - 250) / 112) * 6 + Math.round((x - 170) / 118);
    drawBed(farmPlotStyle(i), x, y, plotWet(farmPlots[i]));
  },

  farm_scarecrow({ x, y }, now) {
    drawScarecrow(x, y, now, '#4a78b8', '#d9ad3e', '#e8c547');
  },
  garden_scarecrow({ x, y }, now) {
    drawScarecrow(x, y, now, '#c8423a', '#b98a54', '#fbf6ea');
  },

  // 나무 울타리 한 토막. 지나다닐 수 있다
  garden_fence({ x, y }) {
    groundShadow(x, y + 1, 46, 4);
    box(x - 46, y - 26, 92, 5, '#c2945c', 2);
    box(x - 46, y - 12, 92, 5, '#c2945c', 2);
    for (let dx = -40; dx <= 40; dx += 20) {
      box(x + dx - 4, y - 36, 8, 36, '#96693f', [4, 4, 1, 1]);
      box(x + dx - 4, y - 36, 3, 36, '#b98a54', [4, 0, 0, 1]);
    }
  },

  // 들꽃 무더기: 풀밭 한 뼘에 핀 꽃들
  garden_flowers({ x, y }) {
    oval(x, y + 4, 40, 18, 'rgba(70, 140, 60, 0.55)');
    oval(x - 6, y + 2, 30, 13, 'rgba(110, 185, 85, 0.6)');
    for (let k = 0; k < 11; k++) {
      const fx = x + (floorNoise(k, 3) - 0.5) * 66, fy = y + 8 + (floorNoise(3, k) - 0.5) * 24;
      wildFlower(fx, fy, FLOWER_COLORS[k % FLOWER_COLORS.length], 0.9 + floorNoise(k, k) * 0.35);
    }
  },

  // 씨앗 가게: 줄무늬 차양 아래 씨앗 상자가 놓인 노점
  farm_stall({ x, y }) {
    groundShadow(x, y + 3, 84, 8);
    box(x - 76, y - 40, 152, 40, '#b98a54', 3);
    box(x - 80, y - 46, 160, 9, '#8a5f34', 2);
    for (const [dx, crop] of [[-52, 0], [-18, 2], [18, 6], [52, 4]]) {
      box(x + dx - 15, y - 62, 30, 18, '#efe2c2', 2);
      drawGood(crop, x + dx, y - 56, 0.6);
    }
    for (const side of [-1, 1]) box(x + side * 72 - 3, y - 122, 6, 82, '#6b4423');
    for (let k = 0; k < 8; k++) box(x - 84 + k * 21, y - 132, 21, 22, k % 2 ? '#fbf6ea' : '#5fae55', k === 0 ? [6, 0, 0, 6] : k === 7 ? [0, 6, 6, 0] : 0);
    for (let k = 0; k < 8; k++) fillCircles(k % 2 ? '#fbf6ea' : '#5fae55', [[x - 73.5 + k * 21, y - 110, 10.5]]);
    box(x - 34, y - 158, 68, 24, '#efe2c2', 4);
    label('씨앗 가게', x, y - 145.5, `800 13px ${FONT}`, '#3f6f34');
  },

  // 바깥 조리대: 화덕과 도마, 냄비
  farm_kitchen({ x, y }, now) {
    groundShadow(x, y + 3, 78, 8);
    box(x - 70, y - 44, 140, 44, '#c9b08a', 3);
    box(x - 74, y - 50, 148, 9, '#efe6d2', 2);
    box(x - 62, y - 34, 40, 28, '#8a7a5c', 3);
    box(x - 14, y - 34, 34, 28, '#b89c70', 2);
    box(x + 26, y - 34, 34, 28, '#b89c70', 2);
    box(x - 60, y - 58, 44, 9, '#3a3a40', 3);            // 화덕
    const flame = 3 + Math.sin(now / 120) * 1.5;
    fillCircles('#ff9a3c', [[x - 48, y - 59, flame], [x - 30, y - 59, flame * 0.8]]);
    box(x - 56, y - 72, 30, 14, '#5c6470', [2, 2, 6, 6]); // 냄비
    box(x - 60, y - 74, 38, 4, '#454c56', 2);
    box(x + 4, y - 55, 42, 5, '#d9b77a', 2);              // 도마
    drawGood(0, x + 16, y - 60, 0.5);
    drawGood(2, x + 34, y - 62, 0.45);
    box(x - 30, y - 100, 60, 22, '#efe2c2', 4);
    label('조리대', x, y - 88.5, `800 13px ${FONT}`, '#8a4a1e');
    box(x - 26, y - 78, 3, 6, '#8a5f34');
    box(x + 23, y - 78, 3, 6, '#8a5f34');
  },

  // 출하 상자: 뚜껑이 열린 나무 궤짝
  farm_bin({ x, y }) {
    groundShadow(x, y + 2, 42, 6);
    box(x - 36, y - 34, 72, 34, '#a8794a', 3);
    strokeLines('#7a5632', 2, () => {
      for (const dx of [-12, 12]) {
        ctx.moveTo(x + dx, y - 32);
        ctx.lineTo(x + dx, y - 2);
      }
    });
    box(x - 38, y - 38, 76, 7, '#8a5f34', 2);
    polygon([[x - 36, y - 38], [x + 36, y - 38], [x + 30, y - 62], [x - 30, y - 62]], '#b98a54');
    box(x - 24, y - 56, 48, 13, '#efe2c2', 3);
    label('출하', x, y - 49, `800 11px ${FONT}`, '#7a4a1e');
    drawGood(7, x - 14, y - 40, 0.5);
    drawGood(4, x + 12, y - 42, 0.5);
  },

  // 닭장: 작은 집과 모이를 쪼는 닭 두 마리
  farm_coop({ x, y }, now) {
    groundShadow(x, y + 3, 70, 8);
    box(x - 56, y - 54, 78, 54, '#e9d6b0', 3);
    polygon([[x - 66, y - 52], [x + 32, y - 52], [x - 17, y - 92]], '#c8423a');
    box(x - 30, y - 30, 26, 30, '#5a3a1e', [12, 12, 0, 0]);
    box(x - 48, y - 44, 14, 12, '#7fb0e8', 2);
    polygon([[x - 6, y], [x + 4, y], [x - 6, y - 18]], '#b98a54');   // 발판
    for (const [dx, phase, flip] of [[40, 0, 1], [58, 1.6, -1]]) {
      const peck = Math.max(0, Math.sin(now / 260 + phase)) * 5;
      const cx = x + dx, cy = y - 2;
      oval(cx, cy - 9, 9, 8, '#fffaf0');
      fillCircles('#fffaf0', [[cx + flip * 7, cy - 17 + peck, 5.5]]);
      polygon([[cx + flip * 12, cy - 17 + peck], [cx + flip * 17, cy - 15 + peck], [cx + flip * 12, cy - 13 + peck]], '#f0a02e');
      fillCircles('#d9463e', [[cx + flip * 6, cy - 23 + peck, 2.4]]);
      fillCircles('#1b1b1b', [[cx + flip * 8.5, cy - 18 + peck, 1]]);
      box(cx - 3, cy - 2, 1.5, 4, '#f0a02e');
      box(cx + 2, cy - 2, 1.5, 4, '#f0a02e');
    }
  },

  // 젖소: 얼룩무늬에 종을 단 소. 가끔 꼬리를 흔든다
  farm_cow({ x, y }, now) {
    groundShadow(x, y + 3, 50, 8);
    const tail = Math.sin(now / 500) * 5;
    strokeLines('#3a2a1e', 2.5, () => {
      ctx.moveTo(x - 40, y - 40);
      ctx.quadraticCurveTo(x - 52 + tail, y - 30, x - 48 + tail, y - 14);
    });
    for (const dx of [-28, -14, 16, 30]) box(x + dx - 4, y - 16, 8, 16, '#f4efe6', 2);
    for (const dx of [-28, -14, 16, 30]) box(x + dx - 4, y - 4, 8, 4, '#3a2a1e', 1);
    box(x - 42, y - 54, 84, 40, '#fbf8f2', 16);
    fillCircles('#3a2a1e', [[x - 20, y - 42, 10], [x + 6, y - 28, 8], [x - 30, y - 24, 5]]);
    oval(x + 2, y - 14, 9, 5, '#f6b8c4');   // 젖
    // 머리
    box(x + 30, y - 68, 30, 30, '#fbf8f2', 10);
    fillCircles('#3a2a1e', [[x + 36, y - 60, 6]]);
    box(x + 34, y - 46, 24, 12, '#f6b8c4', 6);
    fillCircles('#b9788a', [[x + 41, y - 40, 1.6], [x + 51, y - 40, 1.6]]);
    fillCircles('#1b1b1b', [[x + 40, y - 56, 2], [x + 52, y - 56, 2]]);
    polygon([[x + 30, y - 66], [x + 22, y - 72], [x + 31, y - 60]], '#fbf8f2');
    polygon([[x + 60, y - 66], [x + 68, y - 72], [x + 59, y - 60]], '#fbf8f2');
    box(x + 34, y - 74, 4, 8, '#e9dcc0', 2);
    box(x + 52, y - 74, 4, 8, '#e9dcc0', 2);
    box(x + 30, y - 36, 28, 4, '#c8423a', 2);
    fillCircles('#f2d04b', [[x + 44, y - 29, 4]]);
  },

  farm_well({ x, y }) {
    groundShadow(x, y + 2, 36, 6);
    box(x - 30, y - 30, 60, 30, '#9a9388', 4);
    strokeLines('#7c766c', 1.5, () => {
      for (let dy = -22; dy < 0; dy += 10) {
        ctx.moveTo(x - 30, y + dy);
        ctx.lineTo(x + 30, y + dy);
      }
    });
    oval(x, y - 30, 30, 8, '#7c766c');
    oval(x, y - 30, 24, 5.5, '#3d6f9a');
    for (const side of [-1, 1]) box(x + side * 26 - 3, y - 84, 6, 56, '#6b4423');
    polygon([[x - 38, y - 80], [x + 38, y - 80], [x, y - 106]], '#a8473a');
    box(x - 1, y - 80, 2, 26, '#8a7a5c');
    box(x - 7, y - 56, 14, 12, '#8a5f34', 2);
  },
});

// ------------------------------------------------------------ 상태

let farmPlots = [];                         // 칸마다 { crop, left, total, owner, mine, water, free, at } (crop -1 이면 빈 칸)
let gardenBeds = new Map();                 // 집과 마당의 텃밭: 가구 번호 → 밭 칸과 같은 모양의 상태
let goodsAt = 0, eggWait = 0, milkWait = 0;  // 달걀·우유를 다시 거둘 수 있을 때까지 (받은 때 기준 초)
let farmTab = 'seeds';
let harvestFx = [];                         // 거둘 때 떠오르는 글자

const farmEl = document.getElementById('farm');
const farmList = document.getElementById('farm-list');
const farmNote = document.getElementById('farm-note');
const farmTabs = [...document.querySelectorAll('#farm-tabs .rtab')];
const farmPick = document.getElementById('farm-pick');
const farmPickList = document.getElementById('farm-pick-list');
let farmPickSpot = null;   // 씨앗을 고르는 중인 밭 { cmd, ref }

function inFarm() {
  return !!terrain?.farm && zone === terrain.farm.zone;
}

function applyFarm(msg) {
  const at = performance.now();
  farmPlots = msg.p.map(([crop, left = 0, total = 1, owner = '', mine = 0, water = 0, free = 0]) => ({ crop, left, total, owner, mine: !!mine, water, free: !!free, at }));
  if (!farmPick.hidden && farmPickSpot?.cmd === 'farm' && farmPlots[farmPickSpot.ref]?.crop >= 0) setFarmPick(null);
}

function applyGarden(msg) {
  if (msg.z !== zone) return;
  const at = performance.now();
  gardenBeds = new Map(msg.p.map(([id, crop, left, total, owner, mine, water, free]) => [id, { crop, left, total, owner, mine: !!mine, water, free: !!free, at }]));
  if (!farmPick.hidden && farmPickSpot?.cmd === 'garden' && gardenBeds.has(farmPickSpot.ref)) setFarmPick(null);
}

function isPlotKind(k) {
  return k.startsWith('plot_');
}

function isGardenKind(k) {
  return k.startsWith('plot_') || k.startsWith('garden_');
}

// 지금 있는 곳에서 씨앗을 심을 수 있는 칸들: 농장의 밭, 또는 집과 마당에 놓은 텃밭.
// cmd 와 ref 는 서버에 보낼 명령과 칸 번호(텃밭은 가구 번호)다
function plotSpots() {
  if (!terrain?.farm) return [];
  if (inFarm()) return terrain.farm.plots.map(([x, y], i) => ({ x, y, cmd: 'farm', ref: i, plot: farmPlots[i], reach: terrain.farm.plotReach }));
  return decorItems.filter((d) => isPlotKind(d.info.k)).map((d) => ({ x: d.x, y: d.y, cmd: 'garden', ref: d.id, plot: gardenBeds.get(d.id), reach: terrain.farm.plotReach + 8 }));
}

function applyGoods(msg) {
  myGoods = GOOD_NAMES.map((_, i) => msg.g[i] || 0);
  goodsAt = performance.now();
  eggWait = msg.egg || 0;
  milkWait = msg.milk || 0;
  renderBag();
  if (tradeState) renderTrade();
  renderFarm();
  renderFarmPick();
  renderCookList();
}

function plotLeft(plot, now = performance.now()) {
  return Math.max(0, plot.left - (now - plot.at) / 1000);
}

function plotStage(plot, now) {
  const left = plotLeft(plot, now);
  if (left <= 0) return 3;
  const done = 1 - left / plot.total;
  return done < 0.12 ? 0 : done < 0.5 ? 1 : 2;
}

function waitText(seconds) {
  const s = Math.ceil(seconds);
  return s >= 60 ? `${Math.ceil(s / 60)}분` : `${s}초`;
}

// 밭의 작물과 그 위의 표시를 장면에 넣는다 (가까운 것이 앞에 오도록 y 로 정렬된다)
function farmScene(scene, now) {
  plotSpots().forEach(({ x, y, plot }, i) => {
    if (!plot || plot.crop < 0) return;
    scene.push({
      y: y + 12,
      draw: () => {
        const stage = plotStage(plot, now);
        drawCrop(plot.crop, stage, x, y, now);
        const near = me && Math.hypot(me.x - x, me.y - y) < 150;
        if (stage === 3) {   // 다 자랐다: 반짝임
          const t = (now / 700 + i * 0.37) % 1;
          ctx.globalAlpha = 1 - t;
          label('✦', x + 30 - t * 4, y - 26 - t * 12, `700 13px ${FONT}`, '#fff3a0');
          ctx.globalAlpha = 1;
        } else if (near || plot.mine) {   // 자라는 정도
          const done = 1 - plotLeft(plot, now) / plot.total;
          box(x - 26, y + 26, 52, 6, 'rgba(30, 20, 10, 0.55)', 3);
          box(x - 25, y + 27, 50 * clamp(done, 0, 1), 4, '#8fe06a', 2);
        }
        if (near) label(plot.mine ? '내 밭' : plot.owner, x, y + 42, `600 10px ${FONT}`, plot.mine ? '#fff3a0' : 'rgba(255, 255, 255, 0.92)');
      },
    });
  });
  harvestFx = harvestFx.filter((fx) => now - fx.at < 1400);
  for (const fx of harvestFx) {
    scene.push({
      y: 99999,
      draw: () => {
        const t = (now - fx.at) / 1400;
        ctx.globalAlpha = 1 - t;
        drawGood(fx.crop, fx.x - 14, fx.y - 30 - t * 40, 0.8);
        label(`+${fx.n}`, fx.x + 12, fx.y - 30 - t * 40, `800 15px ${FONT}`, '#ffffff');
        ctx.globalAlpha = 1;
      },
    });
  }
}

// ------------------------------------------------------------ E 로 하는 일

function nearestPlot(self) {
  let best = null, bestDist = Infinity;
  for (const spot of plotSpots()) {
    const d = Math.hypot(spot.x - self.x, spot.y - self.y);
    if (d <= spot.reach && d < bestDist) {
      best = spot;
      bestDist = d;
    }
  }
  return best;
}

// useChoice 가 부른다. near(kind, label, x, y, reach, extra) 로 할 수 있는 일을 더한다
function farmChoices(self, near) {
  for (const f of terrain.furnByZone[zone]) {
    if (KITCHEN_KINDS.has(f.k)) near('cook', cookEl.hidden ? '요리하기' : '요리 창 닫기', f.x, f.y, terrain.farm.reach + (f.k === 'farm_kitchen' ? 0 : 40) - 8);   // 서버가 받아 주는 거리보다 조금 안쪽
  }
  const now = performance.now();
  const spot = nearestPlot(self);
  if (spot) {
    const { x, y, plot } = spot, target = { cmd: spot.cmd, ref: spot.ref };
    if (!plot || plot.crop < 0) near('farmplant', '씨앗 심기', x, y, Infinity, { spot: target });
    else if (plotLeft(plot, now) <= 0) near('farmharvest', plot.mine || plot.free ? `${CROPS[plot.crop].name} 거두기` : `${plot.owner}님의 ${CROPS[plot.crop].name}`, x, y, Infinity, { spot: target });
    else {
      const dry = !plotWet(plot, now);
      near('farmwater', dry ? `물 주기 (${waitText(plotLeft(plot, now))} 남음)` : `자라는 중 (${waitText(plotLeft(plot, now))} 남음)`, x, y, Infinity, { spot: target, dry });
    }
  }
  if (!inFarm()) return;
  const since = (now - goodsAt) / 1000;
  for (const f of terrain.furnByZone[zone]) {
    if (f.k === 'farm_stall') near('farmshop', farmEl.hidden ? '씨앗 가게' : '창 닫기', f.x, f.y, terrain.farm.reach);
    else if (f.k === 'farm_bin') near('farmsell', farmEl.hidden ? '출하 상자' : '창 닫기', f.x, f.y, terrain.farm.reach);
    else if (f.k === 'farm_coop') near('farmegg', eggWait - since > 0 ? `달걀 (${waitText(eggWait - since)} 뒤)` : '달걀 꺼내기', f.x, f.y, terrain.farm.reach);
    else if (f.k === 'farm_cow') near('farmmilk', milkWait - since > 0 ? `우유 (${waitText(milkWait - since)} 뒤)` : '우유 짜기', f.x, f.y, terrain.farm.reach);
  }
}

// useNearest 가 부른다. 농장이나 요리의 일이면 true
function farmUse(choice) {
  if (choice.kind === 'cook') setCookOpen(cookEl.hidden);
  else if (choice.kind === 'farmplant') setFarmPick(choice.spot);
  else if (choice.kind === 'farmwater') ws.send(`${choice.spot.cmd} water ${choice.spot.ref}`);
  else if (choice.kind === 'farmharvest') ws.send(`${choice.spot.cmd} harvest ${choice.spot.ref}`);
  else if (choice.kind === 'farmshop') setFarmOpen(farmEl.hidden, 'seeds');
  else if (choice.kind === 'farmsell') setFarmOpen(farmEl.hidden, 'sell');
  else if (choice.kind === 'farmegg') ws.send('farm egg');
  else if (choice.kind === 'farmmilk') ws.send('farm milk');
  else return false;
  if (choice.kind === 'farmwater' && choice.dry) Sound.play('splash');
  return true;
}

function farmHarvested(msg) {
  const bed = msg.bed !== undefined ? decorItems.find((d) => d.id === msg.bed) : null;
  const spot = bed ? [bed.x, bed.y] : terrain?.farm?.plots[msg.plot];
  if (spot) harvestFx.push({ x: spot[0], y: spot[1], crop: msg.crop, n: msg.n, at: performance.now() });
  Sound.play('catch');
}

// ------------------------------------------------------------ 창: 씨앗 가게, 출하, 곳간

function goodRow(good, sub, buttons) {
  const row = document.createElement('div');
  row.className = 'good-row';
  row.dataset.good = good;
  const name = document.createElement('b');
  name.textContent = GOOD_NAMES[good];
  const count = document.createElement('span');
  count.className = 'good-count';
  count.textContent = `×${myGoods[good]}`;
  const note = document.createElement('small');
  note.textContent = sub;
  const actions = document.createElement('div');
  actions.className = 'good-actions';
  actions.append(...buttons);
  row.append(goodIcon(good), name, count, actions, note);
  return row;
}

function farmButton(label, onClick, disabled = false) {
  const button = friendButton(label, (e) => {
    e.currentTarget.blur();
    onClick();
  });
  button.disabled = disabled;
  return button;
}

function renderFarm() {
  if (farmEl.hidden || !terrain?.farm) return;
  for (const tab of farmTabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === farmTab));
  const { seed, sell } = terrain.farm;
  const empty = (text) => Object.assign(document.createElement('div'), { className: 'empty', textContent: text });
  if (farmTab === 'seeds') {
    farmList.replaceChildren(...CROPS.map((crop, i) => goodRow(SEED_BASE + i, `${crop.minutes}분 · ${seed[i] ? `${seed[i]} G` : '무료'} · 거두면 ${sell[i]} G짜리 2개`, [
      farmButton('1개', () => ws.send(`farm buy ${i} 1`), myGold < seed[i]),
      farmButton('5개', () => ws.send(`farm buy ${i} 5`), myGold < seed[i] * 5),
    ])));
    farmNote.textContent = '씨앗 가게 앞에서 살 수 있어요. 밭 한 칸에 씨앗 하나, 한 사람이 8칸까지. 물을 주면 더 빨리 자라고, 친구 밭에 물을 줘도 돼요. 상점에서 텃밭을 받아 집 안이나 집 근처 마당에 놓으면 집에서도 기를 수 있어요.';
  } else if (farmTab === 'sell') {
    const have = GOOD_NAMES.map((_, i) => i).filter((i) => myGoods[i] > 0 && (i < SEED_BASE || i >= DISH_BASE));
    farmList.replaceChildren(...(have.length ? have.map((i) => goodRow(i, `하나에 ${sell[i]} G`, [
      farmButton('1개 팔기', () => ws.send(`farm sell ${i} 1`)),
      farmButton('전부 팔기', () => ws.send(`farm sell ${i} ${myGoods[i]}`)),
    ])) : [empty('팔 것이 없어요. 작물을 거두거나 요리를 만들어 오세요.')]));
    farmNote.textContent = '출하 상자 앞에서 팔 수 있어요. 그냥 파는 것보다 요리해서 팔면 더 많이 받아요.';
  } else {
    const have = GOOD_NAMES.map((_, i) => i).filter((i) => myGoods[i] > 0);
    farmList.replaceChildren(...(have.length ? have.map((i) => goodRow(i, i >= DISH_BASE ? '요리 · 어디서든 먹을 수 있어요' : i >= SEED_BASE ? '씨앗 · 빈 밭에서 E' : '재료',
      i >= DISH_BASE ? [farmButton('먹기', () => ws.send(`farm eat ${i}`))] : [])) : [empty('곳간이 비어 있어요. 씨앗 가게에서 씨앗부터 구해 보세요.')]));
    farmNote.textContent = '곳간은 어디서든 B 로 열 수 있어요. 여기 있는 것은 가방(I)에도 들어 있어서 바닥에 버리거나 교환할 수 있어요.';
  }
}

function setFarmOpen(open, tab = farmTab) {
  farmEl.hidden = !open;
  if (open) {
    restoreWindow(farmEl, 'farm');
    farmTab = tab;
    renderFarm();
    Sound.play('page');
  }
}

// 빈 밭 앞에서 E: 가진 씨앗 중에 고른다
function renderFarmPick() {
  if (farmPick.hidden) return;
  const seeds = CROPS.map((_, i) => i).filter((i) => myGoods[SEED_BASE + i] > 0);
  if (!seeds.length) {
    farmPickList.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: inFarm() ? '씨앗이 없어요. 오른쪽 위의 씨앗 가게에서 구할 수 있어요.' : '씨앗이 없어요. 농장의 씨앗 가게에서 구할 수 있어요.' }));
    return;
  }
  farmPickList.replaceChildren(...seeds.map((i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = 'rbtn seed-pick';
    button.dataset.crop = i;
    const text = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = CROPS[i].name;
    const time = document.createElement('small');
    time.textContent = `${CROPS[i].minutes}분`;
    text.append(name, ` ×${myGoods[SEED_BASE + i]}`, document.createElement('br'), time);
    button.append(goodIcon(SEED_BASE + i, 30), text);
    button.addEventListener('click', () => {
      ws.send(`${farmPickSpot.cmd} plant ${farmPickSpot.ref} ${i}`);
      Sound.play('place');
      setFarmPick(null);
    });
    return button;
  }));
}

function setFarmPick(spot) {
  farmPickSpot = spot;
  farmPick.hidden = !spot;
  if (spot) {
    restoreWindow(farmPick, 'farmPick');
    renderFarmPick();
  }
}

for (const tab of farmTabs) {
  tab.addEventListener('click', () => {
    farmTab = tab.dataset.tab;
    renderFarm();
  });
}
document.getElementById('farm-close').addEventListener('click', () => setFarmOpen(false));
document.getElementById('farm-pick-close').addEventListener('click', () => setFarmPick(null));
makeMovable(farmEl, document.getElementById('farm-head'), 'farm');
makeMovable(farmPick, document.getElementById('farm-pick-head'), 'farmPick');

// ------------------------------------------------------------ 요리
// 요리법을 고르면 서버가 재료와 자리를 확인하고 시작을 알린다. 과정마다 점수(0~100)가 나오고, 평균이 요리의 별이 된다.

const cookEl = document.getElementById('cook');
const cookList = document.getElementById('cook-list');
const cookPlay = document.getElementById('cook-play');
const cookCanvas = document.getElementById('cook-canvas');
const cookStepsEl = document.getElementById('cook-steps');
const cookHelp = document.getElementById('cook-help');
const cookResult = document.getElementById('cook-result');
const cookResultIcon = document.getElementById('cook-result-icon');
const cookResultText = document.getElementById('cook-result-text');
const cookResultSub = document.getElementById('cook-result-sub');
const COOK_W = 440, COOK_H = 260;
const STEP_INFO = {
  C: { name: '썰기', help: '칼이 점선 위에 올 때 Space 를 누르거나 화면을 눌러요.' },
  S: { name: '젓기', help: 'Space 를 빠르게 연타하거나, 냄비 위에서 둥글게 저어요.' },
  F: { name: '뒤집기', help: '노릇한 칸에 들어왔을 때 Space 를 눌러 뒤집어요. 양면 모두!' },
  H: { name: '불 조절', help: 'Space 를 누르고 있으면 불이 세지고, 떼면 약해져요. 바늘을 초록 칸에 두세요.' },
  P: { name: '담기', help: '줄어드는 고리가 접시의 선에 닿을 때 Space 를 눌러 올려요.' },
};
let cook = null;   // 진행 중인 요리 { recipe, index, step, state, scores, phase, pause }
const cookInput = { down: false, pressed: false, angle: null, turned: 0 };
let cookFrame = 0, cookLast = 0;

function myFishCount() {
  return myBag.reduce((sum, n) => sum + n, 0);
}

function canCook(recipe) {
  return recipe.needs.every(([good, count]) => myGoods[good] >= count) && myFishCount() >= recipe.fish;
}

function renderCookList() {
  if (cookEl.hidden || cookList.hidden) return;
  cookList.replaceChildren(...RECIPES.map((recipe, i) => {
    const row = document.createElement('div');
    row.className = 'good-row recipe';
    row.dataset.recipe = i;
    const name = document.createElement('b');
    name.textContent = recipe.name;
    const have = document.createElement('span');
    have.className = 'good-count';
    have.textContent = myGoods[DISH_BASE + i] ? `×${myGoods[DISH_BASE + i]}` : '';
    const needs = document.createElement('small');
    for (const [good, count] of recipe.needs) {
      const part = document.createElement('span');
      part.className = myGoods[good] >= count ? 'ok' : 'lack';
      part.textContent = `${GOOD_NAMES[good]} ${myGoods[good]}/${count}`;
      needs.append(part);
    }
    if (recipe.fish) {
      const part = document.createElement('span');
      part.className = myFishCount() >= recipe.fish ? 'ok' : 'lack';
      part.textContent = `물고기 ${myFishCount()}/${recipe.fish}`;
      needs.append(part);
    }
    const steps = document.createElement('span');
    steps.className = 'steps';
    steps.textContent = [...recipe.steps].map((s) => STEP_INFO[s].name).join(' → ');
    needs.append(steps);
    const actions = document.createElement('div');
    actions.className = 'good-actions';
    actions.append(farmButton('만들기', () => ws.send(`cook start ${i}`), !canCook(recipe)));
    row.append(goodIcon(DISH_BASE + i), name, have, actions, needs);
    return row;
  }));
}

function showCookView(view) {
  cookList.hidden = view !== 'list';
  cookPlay.hidden = view !== 'play';
  cookResult.hidden = view !== 'result';
  document.getElementById('cook-note').hidden = view !== 'list';
}

function setCookOpen(open) {
  if (!open && cook) {
    ws.send('cook cancel');
    stopCook();
  }
  cookEl.hidden = !open;
  if (open) {
    restoreWindow(cookEl, 'cook');
    stopMoving();
    showCookView('list');
    renderCookList();
    Sound.play('page');
  }
}

function stopCook() {
  cook = null;
  cancelAnimationFrame(cookFrame);
  cookFrame = 0;
}

// 과정마다: start() 는 상태를 만들고, update(s, dt, input) 는 끝났으면 true, score(s) 는 0~100, draw(s, t) 는 그린다
const COOK_GAMES = {
  C: {
    start: () => ({ t: 0, knife: 0.05, dir: 1, marks: [0.18, 0.31, 0.44, 0.57, 0.7, 0.83], cut: [], total: 0, misses: 0, flash: 0 }),
    update(s, dt, input) {
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt);
      s.knife += s.dir * dt * 0.58;
      if (s.knife > 0.97) s.knife = 0.97, s.dir = -1;
      if (s.knife < 0.03) s.knife = 0.03, s.dir = 1;
      if (input.pressed) {
        let best = -1;
        s.marks.forEach((m, i) => {
          if (!s.cut.includes(i) && (best < 0 || Math.abs(m - s.knife) < Math.abs(s.marks[best] - s.knife))) best = i;
        });
        const d = best >= 0 ? Math.abs(s.marks[best] - s.knife) : 1;
        if (d < 0.06) {
          s.cut.push(best);
          s.total += 1 - d / 0.06 * 0.6;
          s.flash = 0.18;
        } else {
          s.misses++;
        }
      }
      return s.cut.length === s.marks.length || s.t > 14;
    },
    score: (s) => clamp(Math.round((s.total / s.marks.length) * 100 - s.misses * 7), 0, 100),
    draw(s, recipe) {
      const x0 = 50, x1 = COOK_W - 50, y = 150;
      box(30, 110, COOK_W - 60, 96, '#d9b77a', 10);                 // 도마
      box(30, 196, COOK_W - 60, 10, '#b98f58', [0, 0, 10, 10]);
      const good = recipe.needs[0]?.[0] ?? 2;
      box(x0, y - 22, x1 - x0, 44, CROPS[good]?.color || '#e9d3b0', 22);   // 길게 놓인 재료
      box(x0 + 8, y - 16, x1 - x0 - 16, 10, 'rgba(255, 255, 255, 0.25)', 5);
      s.marks.forEach((m, i) => {
        const mx = x0 + (x1 - x0) * m, done = s.cut.includes(i);
        strokeLines(done ? 'rgba(60, 30, 10, 0.85)' : 'rgba(255, 255, 255, 0.95)', done ? 3 : 2, () => {
          if (!done) ctx.setLineDash([5, 5]);
          ctx.moveTo(mx, y - 24);
          ctx.lineTo(mx, y + 24);
        });
        ctx.setLineDash([]);
      });
      const kx = x0 + (x1 - x0) * s.knife, lift = s.flash > 0 ? 14 : 0;
      polygon([[kx - 3, 62 + lift], [kx + 5, 62 + lift], [kx + 5, 118 + lift], [kx - 3, 106 + lift]], '#e8edf2');   // 칼
      box(kx - 4, 36 + lift, 10, 28, '#5a3a22', 3);
      box(kx - 1, y - 30, 2, 60, 'rgba(255, 80, 80, 0.55)');
      label(`${s.cut.length} / ${s.marks.length}`, COOK_W / 2, 234, `700 14px ${FONT}`, '#5a3a22');
    },
  },
  S: {
    start: () => ({ t: 0, strokes: 0, need: 16, spin: 0 }),
    update(s, dt, input) {
      s.t += dt;
      if (input.pressed) s.strokes++;
      while (input.turned >= Math.PI) {   // 냄비 위에서 반 바퀴 저을 때마다 한 번
        input.turned -= Math.PI;
        s.strokes++;
      }
      s.spin += (s.strokes * 0.6 - s.spin) * Math.min(1, dt * 8);
      return s.strokes >= s.need || s.t > 12;
    },
    score: (s) => (s.strokes >= s.need ? clamp(Math.round(100 - Math.max(0, s.t - 4.5) * 9), 35, 100) : Math.round((s.strokes / s.need) * 40)),
    draw(s) {
      const cx = COOK_W / 2, cy = 150;
      box(cx - 150, cy + 56, 300, 14, '#3a3a40', 6);
      polygon([[cx - 110, cy - 20], [cx + 110, cy - 20], [cx + 90, cy + 60], [cx - 90, cy + 60]], '#5c6470');
      oval(cx, cy - 20, 110, 30, '#454c56');
      oval(cx, cy - 20, 98, 24, '#f0b860');
      strokeLines('rgba(255, 255, 255, 0.6)', 3, () => {
        ctx.arc(cx, cy - 20, 50, s.spin, s.spin + 2.2);
      });
      const sx = cx + Math.cos(s.spin) * 62, sy = cy - 20 + Math.sin(s.spin) * 15;
      strokeLines('#b98a54', 8, () => {   // 국자
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 30, sy - 86);
      });
      box(cx - 120, 222, 240, 12, 'rgba(0, 0, 0, 0.25)', 6);
      box(cx - 118, 224, 236 * clamp(s.strokes / s.need, 0, 1), 8, '#8fe06a', 4);
    },
  },
  F: {
    start: () => ({ t: 0, side: 0, meter: 0, speed: 0.3, flip: 0, sum: 0 }),
    update(s, dt, input) {
      s.t += dt;
      if (s.flip > 0) {
        s.flip -= dt;
        return s.flip <= 0 && s.side >= 2;
      }
      s.meter += dt * s.speed;
      const press = input.pressed || s.meter >= 1.25;   // 너무 오래 두면 타 버린다
      if (press && s.meter > 0.12) {
        s.sum += s.meter >= 1.25 ? 0 : clamp(1 - Math.abs(s.meter - 0.78) / 0.34, 0, 1);
        s.last = s.meter;
        s.side++;
        s.flip = 0.55;
        s.meter = 0;
        s.speed = 0.4;
      }
      return false;
    },
    score: (s) => Math.round((s.sum / 2) * 100),
    draw(s, recipe) {
      const cx = COOK_W / 2, cy = 128;
      box(cx + 96, cy + 4, 110, 12, '#3a2a1e', 6);          // 손잡이
      oval(cx, cy + 14, 112, 34, '#2e3238');
      oval(cx, cy + 8, 104, 28, '#454c56');
      const done = s.flip > 0 ? clamp(s.last ?? 0, 0, 1.25) : s.meter;
      const cooked = mixColor('#f6e3a0', done > 1 ? '#3a2416' : '#c98a3a', clamp(done > 1 ? (done - 1) * 4 : done / 0.9, 0, 1));
      const lift = s.flip > 0 ? Math.sin((1 - s.flip / 0.55) * Math.PI) * 46 : 0;
      const squash = s.flip > 0 ? Math.abs(Math.cos((1 - s.flip / 0.55) * Math.PI)) : 1;
      oval(cx, cy + 4 - lift, 70, 19 * Math.max(0.15, squash), recipe.fish ? '#c9a27a' : cooked);
      if (!recipe.fish) oval(cx - 16, cy - lift, 26, 5 * squash, 'rgba(255, 255, 255, 0.25)');
      // 익은 정도: 덜 익음, 노릇함(가운데가 가장 좋다), 탐
      const bx = 60, bw = COOK_W - 120, by = 206;
      box(bx, by, bw, 18, '#f6e3a0', 9);
      box(bx + bw * (0.6 / 1.25), by, bw * (0.36 / 1.25), 18, '#e0a03a');
      box(bx + bw * (0.74 / 1.25), by, bw * (0.08 / 1.25), 18, '#ffcf5a');
      box(bx + bw * (0.96 / 1.25), by, bw * (0.29 / 1.25), 18, '#5a3320', [0, 9, 9, 0]);
      box(bx + bw * clamp(s.meter / 1.25, 0, 1) - 2, by - 6, 4, 30, '#ffffff', 2);
      label(s.side === 0 ? '앞면' : s.side === 1 ? '뒷면' : '완성', cx, 244, `700 13px ${FONT}`, '#5a3a22');
    },
  },
  H: {
    start: () => ({ t: 0, heat: 0.2, good: 0, length: 7 }),
    target: (s) => 0.55 + Math.sin(s.t * 1.1) * 0.22,
    update(s, dt, input) {
      s.t += dt;
      s.heat = clamp(s.heat + (input.down ? 0.62 : -0.5) * dt, 0, 1);
      if (Math.abs(s.heat - COOK_GAMES.H.target(s)) < 0.13) s.good += dt;
      return s.t >= s.length;
    },
    score: (s) => clamp(Math.round((s.good / s.length / 0.82) * 100), 0, 100),
    draw(s) {
      const cx = 150, cy = 150;
      box(cx - 96, cy + 46, 192, 16, '#3a3a40', 6);
      for (let k = -2; k <= 2; k++) {   // 불꽃
        const h = 10 + s.heat * 46 + Math.sin(s.t * 14 + k) * 4;
        polygon([[cx + k * 30 - 10, cy + 46], [cx + k * 30 + 10, cy + 46], [cx + k * 30, cy + 46 - h]], s.heat > 0.8 ? '#ff5a3c' : '#ff9a3c');
        polygon([[cx + k * 30 - 5, cy + 46], [cx + k * 30 + 5, cy + 46], [cx + k * 30, cy + 46 - h * 0.55]], '#ffe08a');
      }
      box(cx - 84, cy - 46, 168, 62, '#5c6470', [6, 6, 18, 18]);
      box(cx - 92, cy - 52, 184, 10, '#454c56', 4);
      for (const k of [-1, 0, 1]) {     // 김
        const p = (s.t * 0.6 + k * 0.33) % 1;
        ctx.globalAlpha = (1 - p) * 0.7;
        oval(cx + k * 36, cy - 60 - p * 40, 8 + p * 8, 6 + p * 6, '#ffffff');
        ctx.globalAlpha = 1;
      }
      const gx = 340, gy = 44, gh = 170;   // 온도계
      box(gx - 16, gy - 6, 32, gh + 12, '#2e3238', 12);
      box(gx - 10, gy, 20, gh, '#f4efe4', 8);
      const target = COOK_GAMES.H.target(s);
      box(gx - 10, gy + gh * (1 - target - 0.13), 20, gh * 0.26, '#8fe06a');
      box(gx - 22, gy + gh * (1 - s.heat) - 3, 44, 6, '#e2483c', 3);
      label(`${Math.max(0, Math.ceil(s.length - s.t))}`, gx, 240, `800 16px ${FONT}`, '#5a3a22');
    },
  },
  P: {
    start: () => ({ t: 0, round: 0, ring: 2.3, sum: 0, hold: 0, placed: [] }),
    update(s, dt, input) {
      s.t += dt;
      if (s.hold > 0) {
        s.hold -= dt;
        return s.hold <= 0 && s.round >= 3;
      }
      s.ring -= dt * (0.95 + s.round * 0.25);
      if (s.ring < 0.3) s.ring = 2.3;
      if (input.pressed) {
        const error = Math.abs(s.ring - 1);
        s.sum += clamp(1 - error / 0.55, 0, 1);
        s.placed.push(error);
        s.round++;
        s.hold = 0.45;
        s.ring = 2.3;
      }
      return false;
    },
    score: (s) => Math.round((s.sum / 3) * 100),
    draw(s, recipe, index) {
      const cx = COOK_W / 2, cy = 138, r = 66;
      oval(cx, cy + 6, 130, 62, '#d8d2c4');
      oval(cx, cy, 130, 62, '#ffffff');
      oval(cx, cy, 96, 44, '#f4f0e6');
      s.placed.forEach((error, i) => {   // 올린 음식: 잘 맞출수록 가운데에 가지런히
        const off = (i - 1) * 46 + (error > 0.3 ? (i % 2 ? 12 : -12) : 0);
        drawGood(DISH_BASE + index, cx + off, cy - 6 + (error > 0.3 ? 8 : 0), 1.5);
      });
      if (s.round < 3 && s.hold <= 0) {
        const tx = cx + (s.round - 1) * 46;
        strokeLines('#e0a03a', 3, () => { ctx.ellipse(tx, cy, r * 0.42, r * 0.3, 0, 0, TAU); });
        strokeLines('rgba(226, 72, 60, 0.9)', 3, () => { ctx.ellipse(tx, cy, r * 0.42 * s.ring, r * 0.3 * s.ring, 0, 0, TAU); });
      }
      label(`${Math.min(s.round, 3)} / 3`, cx, 234, `700 14px ${FONT}`, '#5a3a22');
    },
  },
};

function beginCook(recipe) {
  showCookView('play');
  cook = { recipe, index: 0, scores: [], phase: 'ready', pause: 1.1, state: null };
  cook.state = COOK_GAMES[RECIPES[recipe].steps[0]].start();
  Object.assign(cookInput, { down: false, pressed: false, angle: null, turned: 0 });
  paintCookSteps();
  cookLast = performance.now();
  cancelAnimationFrame(cookFrame);
  cookFrame = requestAnimationFrame(cookTick);
}

function paintCookSteps() {
  const recipe = RECIPES[cook.recipe];
  cookStepsEl.replaceChildren(...[...recipe.steps].map((step, i) => {
    const chip = document.createElement('span');
    chip.className = i < cook.index ? 'done' : i === cook.index ? 'now' : '';
    chip.textContent = i < cook.scores.length ? `${STEP_INFO[step].name} ${cook.scores[i]}` : STEP_INFO[step].name;
    return chip;
  }));
  const step = recipe.steps[Math.min(cook.index, recipe.steps.length - 1)];
  cookHelp.textContent = STEP_INFO[step].help;
}

// 지금 과정을 주어진 점수로 끝낸다 (과정이 스스로 끝났을 때, 그리고 시험에서)
function finishCookStep(score) {
  if (!cook || cook.phase === 'wait') return;
  cook.scores.push(clamp(Math.round(score), 0, 100));
  cook.index++;
  cook.phase = 'between';
  cook.pause = 0.9;
  paintCookSteps();
  Sound.play(score >= 60 ? 'coin' : 'page');
}

function cookTick(now) {
  if (!cook) return;
  const dt = Math.min(0.05, (now - cookLast) / 1000);
  cookLast = now;
  const recipe = RECIPES[cook.recipe];
  const step = recipe.steps[Math.min(cook.index, recipe.steps.length - 1)];
  const game = COOK_GAMES[step];
  if (cook.phase === 'ready') {
    cook.pause -= dt;
    if (cook.pause <= 0) cook.phase = 'play';
  } else if (cook.phase === 'play') {
    if (game.update(cook.state, dt, cookInput)) finishCookStep(game.score(cook.state));
  } else if (cook.phase === 'between') {
    cook.pause -= dt;
    if (cook.pause <= 0) {
      if (cook.index >= recipe.steps.length) {
        cook.phase = 'wait';
        ws.send(`cook done ${Math.round(cook.scores.reduce((a, b) => a + b, 0) / cook.scores.length)}`);
      } else {
        cook.state = COOK_GAMES[recipe.steps[cook.index]].start();
        cook.phase = 'ready';
        cook.pause = 0.9;
        Object.assign(cookInput, { down: false, angle: null, turned: 0 });
      }
    }
  }
  cookInput.pressed = false;
  drawOn(cookCanvas.getContext('2d'), () => {
    ctx.setTransform(cookCanvas.width / COOK_W, 0, 0, cookCanvas.height / COOK_H, 0, 0);
    box(0, 0, COOK_W, COOK_H, '#f3e7cf');
    box(0, 0, COOK_W, 30, '#e6d5b0');
    label(`${recipe.name} · ${STEP_INFO[step].name}`, COOK_W / 2, 15, `800 14px ${FONT}`, '#5a3a22');
    if (cook.phase === 'between' || cook.phase === 'wait') {
      const last = cook.scores[cook.scores.length - 1];
      drawGood(DISH_BASE + cook.recipe, COOK_W / 2, 118, 3);
      label(last >= 85 ? `완벽해요! ${last}점` : last >= 60 ? `좋아요! ${last}점` : `아쉬워요… ${last}점`, COOK_W / 2, 200, `800 20px ${FONT}`, last >= 60 ? '#3f8a4f' : '#b8552c');
    } else {
      game.draw(cook.state, recipe, cook.recipe);
      if (cook.phase === 'ready') {
        box(0, 30, COOK_W, COOK_H - 30, 'rgba(243, 231, 207, 0.72)');
        label(`${STEP_INFO[step].name} 준비!`, COOK_W / 2, 130, `800 26px ${FONT}`, '#8a4a1e');
      }
    }
  });
  cookFrame = requestAnimationFrame(cookTick);
}

function cookStarted(msg) {
  if (cookEl.hidden) setCookOpen(true);
  beginCook(msg.r);
}

function cookFinished(msg) {
  stopCook();
  showCookView('result');
  const stars = '★'.repeat(msg.stars) + '☆'.repeat(3 - msg.stars);
  drawOn(cookResultIcon.getContext('2d'), () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cookResultIcon.width, cookResultIcon.height);
    drawGood(DISH_BASE + msg.r, cookResultIcon.width / 2, cookResultIcon.height / 2, 4.2);
  });
  cookResultText.textContent = `${stars}  ${RECIPES[msg.r].name}`;
  cookResultSub.textContent = `${msg.score}점 · ${msg.n}접시를 곳간에 넣었어요.${msg.stars === 3 ? ' 완벽하게 만들어서 한 접시 더!' : ''}`;
  Sound.play('catch');
}

// 요리하는 동안의 조작: Space 와 화면 누르기. 캐릭터가 움직이지 않게 다른 키는 여기서 막는다
addEventListener('keydown', (e) => {
  if (!cook) return;
  if (e.key === 'Escape') return;   // 닫기는 평소대로
  e.stopImmediatePropagation();
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!e.repeat) cookInput.pressed = true;
    cookInput.down = true;
  }
}, true);
addEventListener('keyup', (e) => {
  if (cook && (e.code === 'Space' || e.code === 'Enter')) cookInput.down = false;
}, true);
cookCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  cookCanvas.setPointerCapture(e.pointerId);
  cookInput.pressed = true;
  cookInput.down = true;
  cookInput.angle = null;
});
cookCanvas.addEventListener('pointermove', (e) => {
  if (!cookInput.down) return;
  const rect = cookCanvas.getBoundingClientRect();
  const angle = Math.atan2(e.clientY - rect.top - rect.height * 0.5, e.clientX - rect.left - rect.width * 0.5);
  if (cookInput.angle !== null) {
    let d = angle - cookInput.angle;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    cookInput.turned += Math.abs(d);
  }
  cookInput.angle = angle;
});
for (const type of ['pointerup', 'pointercancel']) cookCanvas.addEventListener(type, () => { cookInput.down = false; });

document.getElementById('cook-close').addEventListener('click', () => setCookOpen(false));
document.getElementById('cook-cancel').addEventListener('click', (e) => {
  e.currentTarget.blur();
  ws.send('cook cancel');
  stopCook();
  showCookView('list');
  renderCookList();
});
document.getElementById('cook-again').addEventListener('click', (e) => {
  e.currentTarget.blur();
  showCookView('list');
  renderCookList();
});
document.getElementById('cook-store').addEventListener('click', (e) => {
  e.currentTarget.blur();
  setFarmOpen(true, 'store');
});
makeMovable(cookEl, document.getElementById('cook-head'), 'cook');

// ------------------------------------------------------------ 다른 파일(core/network.js, core/render.js …)이 부르는 것

// 서버 메시지. 농장이나 요리의 것이면 true
function farmMessage(msg) {
  if (msg.t === 'farm') applyFarm(msg);
  else if (msg.t === 'garden') applyGarden(msg);
  else if (msg.t === 'goods') applyGoods(msg);
  else if (msg.t === 'harvest') farmHarvested(msg);
  else if (msg.t === 'cook') cookStarted(msg);
  else if (msg.t === 'cooked') cookFinished(msg);
  else return false;
  return true;
}

// Esc: 열린 농장·요리 창을 하나 닫았으면 true
function farmEscape() {
  if (!farmPick.hidden) setFarmPick(null);
  else if (!cookEl.hidden) setCookOpen(false);
  else if (!farmEl.hidden) setFarmOpen(false);
  else return false;
  return true;
}

function farmReset() {
  stopCook();
  farmPlots = [];
  gardenBeds = new Map();
  myGoods = new Array(GOOD_COUNT).fill(0);
  farmEl.hidden = cookEl.hidden = farmPick.hidden = true;
}

// 구역을 옮기면 그곳에서만 쓰는 창을 닫는다
function farmZoneChanged() {
  if (cook) stopCook();
  cookEl.hidden = true;
  farmPick.hidden = true;
  gardenBeds = new Map();
  if (!inFarm() && farmTab !== 'store') farmEl.hidden = true;
}
