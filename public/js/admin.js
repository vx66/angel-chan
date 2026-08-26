const admLogin = document.getElementById('admLogin');
const admDash = document.getElementById('admDash');
const admUser = document.getElementById('admUser');
const admPass = document.getElementById('admPass');
const admEnter = document.getElementById('admEnter');
const admError = document.getElementById('admError');
const admUsersEl = document.getElementById('admUsers');
const admMsgsEl = document.getElementById('admMsgs');
const admStatus = document.getElementById('admStatus');
const admRefresh = document.getElementById('admRefresh');
const admLogout = document.getElementById('admLogout');

const ADMIN_NICK = window.ANGEL_CONFIG?.adminNick || 'xergno';
admUser.value = ADMIN_NICK;

const nickColors = {};
const PALETTE = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'purple', 'red'];

function wsUrl() {
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
}

function colorForNick(nick) {
  if (nickColors[nick]) return nickColors[nick];
  let h = 0;
  for (const ch of nick) h = (h * 31 + ch.charCodeAt(0)) % 997;
  nickColors[nick] = PALETTE[h % PALETTE.length];
  return nickColors[nick];
}

function setAdmError(text) {
  admError.textContent = text;
  admError.classList.add('show');
}

let ws = null;
let token = null;

function connect() {
  admStatus.textContent = 'conectando como administrador (invisible)...';
  ws = new WebSocket(wsUrl());
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', nick: ADMIN_NICK, token, ghost: true }));
  ws.onmessage = (ev) => handle(JSON.parse(ev.data));
  ws.onclose = () => {
    admStatus.textContent = 'desconectado — reintentando...';
    setTimeout(connect, 2000);
  };
  ws.onerror = () => ws.close();
}

function appendMsgEl(text, className) {
  const div = document.createElement('div');
  div.className = 'msg-line ' + (className || '');
  div.textContent = text;
  admMsgsEl.appendChild(div);
  admMsgsEl.scrollTop = admMsgsEl.scrollHeight;
}

function renderUsers(users) {
  admUsersEl.innerHTML = '';
  users.sort((a, b) => a.nick.localeCompare(b.nick));
  for (const u of users) {
    const li = document.createElement('li');
    li.className = 'adm-user';

    const name = document.createElement('span');
    name.className = 'nick nick-' + colorForNick(u.nick);
    name.textContent = (u.role === 'admin' ? '✦ ' : '') + u.nick;

    const ipBtn = document.createElement('button');
    ipBtn.className = 'adm-btn';
    ipBtn.textContent = 'IP';
    ipBtn.title = 'ver IP y ubicación';
    ipBtn.addEventListener('click', () => ws.send(JSON.stringify({ type: 'admin_location', nick: u.nick })));

    const kickBtn = document.createElement('button');
    kickBtn.className = 'adm-btn del';
    kickBtn.textContent = '✕';
    kickBtn.title = 'expulsar';
    kickBtn.addEventListener('click', () => {
      if (confirm(`¿Expulsar a ${u.nick}?`)) ws.send(JSON.stringify({ type: 'admin_kick', nick: u.nick }));
    });

    const locLine = document.createElement('div');
    locLine.className = 'adm-loc';
    locLine.dataset.nick = u.nick.toLowerCase();

    li.append(name, ipBtn, kickBtn, locLine);
    admUsersEl.appendChild(li);
  }
}

function renderMessage(entry) {
  const div = document.createElement('div');
  div.className = 'msg-line' + (entry.type === 'system' ? ' system' : '') + (entry.type === 'image' ? ' imgline' : '');
  if (entry.id) div.dataset.id = entry.id;

  if (entry.type === 'system') {
    div.textContent = entry.text;
  } else {
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `[${entry.time}] `;
    const nick = document.createElement('span');
    nick.className = 'nick nick-' + colorForNick(entry.nick);
    nick.textContent = `<${entry.nick}> `;
    div.appendChild(time);
    div.appendChild(nick);
    if (entry.type === 'image') {
      const link = document.createElement('a');
      link.className = 'img-link';
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'compartió una imagen →';
      div.appendChild(link);
    } else {
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = entry.text + (entry.edited ? ' (editado)' : '');
      div.appendChild(text);
    }
  }

  if (entry.id) {
    const delBtn = document.createElement('button');
    delBtn.className = 'msg-action del';
    delBtn.textContent = '✕';
    delBtn.title = 'borrar mensaje';
    delBtn.addEventListener('click', () => {
      if (confirm('¿Borrar este mensaje?')) ws.send(JSON.stringify({ type: 'delete', id: entry.id }));
    });
    div.appendChild(delBtn);
  }

  admMsgsEl.appendChild(div);
  admMsgsEl.scrollTop = admMsgsEl.scrollHeight;
}

function handle(msg) {
  switch (msg.type) {
    case 'welcome':
      admStatus.textContent = 'admin conectado — invisible en el chat';
      for (const entry of msg.history) renderMessage(entry);
      renderUsers(msg.users);
      ws.send(JSON.stringify({ type: 'admin_users' }));
      break;
    case 'admin_users':
      renderUsers(msg.users);
      break;
    case 'admin_location': {
      const line = document.querySelector(`.adm-loc[data-nick="${msg.nick.toLowerCase()}"]`);
      if (line) line.textContent = `📍 ${msg.ip} · ${msg.location}`;
      break;
    }
    case 'users':
      renderUsers(msg.users);
      break;
    case 'message':
    case 'image':
      renderMessage(msg);
      break;
    case 'system':
      renderMessage(msg);
      break;
    case 'message_edited': {
      const line = document.querySelector(`.msg-line[data-id="${msg.id}"] .text`);
      if (line) line.textContent = msg.text + ' (editado)';
      break;
    }
    case 'message_deleted': {
      const line = document.querySelector(`.msg-line[data-id="${msg.id}"]`);
      if (line) line.remove();
      break;
    }
    case 'history_cleared':
      admMsgsEl.innerHTML = '';
      appendMsgEl('El chat quedó vacío. La conversación fue archivada y eliminada.', 'system');
      break;
    case 'error':
      appendMsgEl('ERROR: ' + msg.text, 'private');
      break;
    case 'private':
      appendMsgEl(msg.text, 'private');
      break;
  }
}

admEnter.addEventListener('click', () => {
  if (admUser.value.trim().toLowerCase() !== ADMIN_NICK) {
    setAdmError('Usuario inválido. Solo el administrador puede entrar.');
    return;
  }
  if (!admPass.value) {
    setAdmError('Escribe la contraseña.');
    return;
  }
  admError.classList.remove('show');
  const w = new WebSocket(wsUrl());
  w.onopen = () => w.send(JSON.stringify({ type: 'admin_login', nick: ADMIN_NICK, password: admPass.value }));
  w.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'available' && msg.role === 'admin') {
      token = msg.token;
      w.close();
      admLogin.hidden = true;
      admDash.hidden = false;
      connect();
    } else if (msg.type === 'error' || msg.type === 'unavailable') {
      setAdmError(msg.text);
      w.close();
    }
  };
  w.onerror = () => setAdmError('NO PUEDO CONECTARME AL SERVIDOR...');
});

admPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') admEnter.click();
});

admRefresh.addEventListener('click', () => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'admin_users' }));
    admStatus.textContent = 'lista actualizada';
  }
});

admLogout.addEventListener('click', () => {
  sessionStorage.removeItem('angel_gate_session');
  sessionStorage.removeItem('angel_token');
  sessionStorage.removeItem('angel_role');
  localStorage.removeItem('angel_nick');
  window.location.replace('/gate');
});
