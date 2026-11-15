'use strict';
// 동거인 목록.

// ------------------------------------------------------------ 동거인


const bagMateList = document.getElementById('bag-mate-list');

function renderBagMates() {
  if (bagEl.hidden || bagTab !== 'mates') return;
  bagMateList.textContent = '';
  if (!myMates.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '아직 동거인이 없습니다.';
    bagMateList.append(empty);
    return;
  }
  myMates.forEach(([name, online], i) => {
    const row = document.createElement('div');
    row.className = 'mate-row';
    const dot = document.createElement('i');
    dot.className = online ? 'on' : '';
    dot.title = online ? '접속 중' : '접속 안 함';
    const label = document.createElement('span');
    label.textContent = name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.tabIndex = -1;
    remove.className = 'rbtn';
    remove.textContent = '해제';
    remove.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(`mate remove ${i}`);
    });
    row.append(dot, label, remove);
    bagMateList.append(row);
  });
}
