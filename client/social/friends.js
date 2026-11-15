'use strict';
// 친구 창.

// ------------------------------------------------------------ 친구
// 서로 수락하면 친구가 된다. 친구 창(N)에서 접속 여부와 있는 곳, 할 일 진행을 보고, 「할 일」로 친구의 할 일 목록을 연다.

const friendsEl = document.getElementById('friends');
const friendsOpen = document.getElementById('friends-open');
const friendsBadge = document.getElementById('friends-badge');
const friendsList = document.getElementById('friends-list');
const friendsReq = document.getElementById('friends-req');
const friendsTabList = document.getElementById('friends-tab-list');
const friendsTabReq = document.getElementById('friends-tab-req');
const friendsCount = document.getElementById('friends-count');
const friendsReqCount = document.getElementById('friends-req-count');
const friendsName = document.getElementById('friends-name');
const playerFriend = document.getElementById('player-friend');
let myFriends = [];        // [[이름, 접속 중이면 연결 번호 아니면 0, 있는 구역(-1 접속 안 함), 다 한 일, 할 일, 공개하는지], ...]
let friendRequests = [];   // 나에게 온 친구 신청의 이름
let friendsLoaded = false; // 접속하고 처음 받은 목록이면 쌓인 신청을 알린다
let friendsTab = 'list';

function zoneLabel(z) {
  if (z === 0) return '마을';
  const building = terrain?.buildings[terrain.zones[z]?.b];
  if (!building) return '어딘가';
  return building.k === 'house' ? `${building.name}의 집` : building.name;
}

function applyFriends(msg) {
  myFriends = msg.p;
  friendRequests = msg.q;
  const waiting = friendRequests.length;
  friendsBadge.hidden = friendsReqCount.hidden = !waiting;   // 버튼에는 빨간 N, 창의 탭에는 몇 개인지
  friendsReqCount.textContent = waiting;
  if (!friendsLoaded && waiting) {   // 접속하지 않은 동안 온 신청
    pushNotice({
      kind: 'friend', key: 'friends:waiting', title: '친구 신청', text: `친구 신청이 ${waiting}개 와 있어요!`, sub: `${friendRequests.slice(0, 3).join(', ')}${waiting > 3 ? ' 외' : ''}`,
      yesLabel: '확인하기', noLabel: '나중에', yes: () => setFriendsOpen(true, 'req'),
    });
  }
  friendsLoaded = true;
  renderFriends();
  renderTodo();   // 할 일 창의 친구 탭
}

function friendAsked(name) {
  friendsOpen.classList.remove('ring');
  void friendsOpen.offsetWidth;
  friendsOpen.classList.add('ring');
  pushNotice({
    kind: 'friend', key: `friend:${name}`, title: '친구 신청', text: `${name}님이 친구 신청을 보냈어요!`, sub: '친구가 되면 서로 접속했는지, 어디 있는지, 할 일을 볼 수 있어요.',
    look: (e) => e.name === name,
    yes: () => { const i = friendRequests.indexOf(name); if (i >= 0) ws.send(`friend yes ${i}`); },
    no: () => { const i = friendRequests.indexOf(name); if (i >= 0) ws.send(`friend no ${i}`); },
  });
}

function setFriendsOpen(open, tab = friendsTab) {
  friendsEl.hidden = !open;
  if (open) {
    restoreWindow(friendsEl, 'friends');
    friendsTab = tab;
    renderFriends();
    Sound.play('page');
  } else if (friendsEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

function friendButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.className = 'rbtn';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderFriends() {
  friendsCount.textContent = myFriends.length ? `(${myFriends.length})` : '';
  if (friendsEl.hidden) return;
  friendsTabList.setAttribute('aria-selected', String(friendsTab === 'list'));
  friendsTabReq.setAttribute('aria-selected', String(friendsTab === 'req'));
  friendsList.hidden = friendsTab !== 'list';
  friendsReq.hidden = friendsTab !== 'req';
  const empty = (text) => {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = text;
    return div;
  };
  // 접속한 친구를 위로
  const order = myFriends.map((f, i) => [f, i]).sort(([a], [b]) => (b[1] ? 1 : 0) - (a[1] ? 1 : 0));
  friendsList.replaceChildren(...(order.length ? order.map(([[name, id, z, done, total, shared], i]) => {
    const row = document.createElement('div');
    row.className = 'friend-row';
    const dot = document.createElement('i');
    dot.className = `friend-dot${id ? ' on' : ''}`;
    dot.title = id ? '접속 중' : '접속 안 함';
    const label = document.createElement('span');
    label.className = 'friend-name';
    label.textContent = name;
    const where = document.createElement('small');
    where.className = 'friend-where';
    where.textContent = `${id ? `${zoneLabel(z)}에 있어요` : '오프라인'} · ${shared ? `할 일 ${done}/${total}` : '할 일 비공개'}`;
    const actions = document.createElement('div');
    actions.className = 'friend-actions';
    actions.append(
      friendButton('할 일', () => {
        setTodoOpen(true);
        openFriendTodo(i);
      }),
      friendButton('✕', () => pushNotice({
        kind: 'info', title: '친구 끊기', text: `${name}님과 친구를 끊을까요?`, sub: '상대의 친구 목록에서도 빠져요.', quiet: true,
        yesLabel: '끊기', noLabel: '취소', yes: () => { const at = myFriends.findIndex((f) => f[0] === name); if (at >= 0) ws.send(`friend remove ${at}`); },
      })),
    );
    actions.lastChild.title = '친구 끊기';
    row.append(dot, label, actions, where);
    return row;
  }) : [empty('아직 친구가 없어요. 아래에 이름을 적거나, 다른 사람을 우클릭해 신청해 보세요.')]));
  friendsReq.replaceChildren(...(friendRequests.length ? friendRequests.map((name, i) => {
    const row = document.createElement('div');
    row.className = 'friend-row';
    const dot = document.createElement('i');
    dot.className = 'friend-dot';
    const label = document.createElement('span');
    label.className = 'friend-name';
    label.textContent = name;
    const actions = document.createElement('div');
    actions.className = 'friend-actions';
    actions.append(friendButton('수락', () => ws.send(`friend yes ${i}`)), friendButton('거절', () => ws.send(`friend no ${i}`)));
    const where = document.createElement('small');
    where.className = 'friend-where';
    where.textContent = '친구가 되고 싶대요';
    row.append(dot, label, actions, where);
    return row;
  }) : [empty('받은 친구 신청이 없어요.')]));
}

friendsOpen.addEventListener('click', () => setFriendsOpen(friendsEl.hidden));
document.getElementById('friends-close').addEventListener('click', () => setFriendsOpen(false));
friendsTabList.addEventListener('click', () => { friendsTab = 'list'; renderFriends(); });
friendsTabReq.addEventListener('click', () => { friendsTab = 'req'; renderFriends(); });
document.getElementById('friends-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = friendsName.value.trim();
  if (name && ws && ws.readyState === WebSocket.OPEN) ws.send(`friend name ${name}`);
  friendsName.value = '';
  friendsName.blur();
});
friendsName.addEventListener('focus', () => stopMoving());
playerFriend.addEventListener('click', () => {
  playerMenu.hidden = true;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(`friend ask ${menuTarget}`);
});
makeMovable(friendsEl, document.getElementById('friends-head'), 'friends');
