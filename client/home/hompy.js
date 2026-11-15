'use strict';
// 미니홈피 모드: 집 안에서 시작해 오른쪽 탭으로 집을 오간다.

// ------------------------------------------------------------ 미니홈피

const hompyTabs = document.getElementById('hompy-tabs');
const HOMPY_ORDER = ['캬캬', '랏라', '몰쟈'];  // 테스트 기간에는 이 세 집으로 고정

function hompyHouses() {
  if (!terrain) return [];
  return HOMPY_ORDER.map((name) => terrain.buildings.find((b) => b.k === 'house' && b.name === name)).filter(Boolean).map((b) => ({ name: b.name, zone: b.room }));
}

function visitHouse(target) {
  if (target === undefined || target === zone || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(`visit ${target}`);
}

function syncHompy() {
  if (hompyEl.hidden) return;
  hompyTabs.textContent = '';
  for (const house of hompyHouses()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.dataset.zone = String(house.zone);
    button.innerHTML = `${house.name}<small>의 집</small>`;
    if (house.zone === zone) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => visitHouse(house.zone));
    hompyTabs.append(button);
  }
}

function nearRoomDoor() {
  if (zone === 0 || !terrain || !me) return false;
  const [dx, dy] = terrain.zones[zone].door;
  return Math.hypot(dx - me.x, dy - me.y) <= terrain.doorReach + 8;
}
