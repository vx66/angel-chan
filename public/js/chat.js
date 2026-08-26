const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('userList');
const connStatus = document.getElementById('connStatus');
const inputForm = document.getElementById('inputForm');
const msgInput = document.getElementById('msgInput');
const quitBtn = document.getElementById('quitBtn');
const kaoBtn = document.getElementById('kaoBtn');
const kaoTray = document.getElementById('kaoTray');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const darkBtn = document.getElementById('darkBtn');

function applyDark(on) {
  document.body.classList.toggle('dark', on);
  darkBtn.textContent = on ? '☀️' : '🌙';
  darkBtn.title = on ? 'modo claro' : 'modo oscuro';
}
applyDark(localStorage.getItem('angel_dark') === '1');
darkBtn.addEventListener('click', () => {
  const on = !document.body.classList.contains('dark');
  applyDark(on);
  localStorage.setItem('angel_dark', on ? '1' : '0');
});

const token = sessionStorage.getItem('angel_token');
const savedNick = localStorage.getItem('angel_nick') || '';

if (!token || !savedNick) {
  window.location.replace('/');
  throw new Error('no_login');
}

const MY_COLOR = 'cyan';

const nickColors = {};
const PALETTE = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'purple', 'red'];

const KAOMOJI = [
  // feliz / risas
  '(＾▽＾)', '(≧▽≦)', '(^▽^)', '(*^▽^*)', 'ヽ(´▽`)/', '(ﾉ≧∇≦)ﾉ ﾟ ･:*:･｡',
  '(≧∇≦)ﾉ', 'ヽ(≧Д≦)ノ', '(〜￣▽￣)〜', '(＾▿＾)', '(๑˃ᴗ˂)ﻭ', '( ◜‿◝ )',
  '(▰˘◡˘▰)', '( ˘ ³˘)♥', '( ﾟ▽ﾟ)/', '＼(≧▽≦)／', '♪(´▽｀)', 'ヾ(≧▽≦)ノ',
  // amor / cariño
  '(♥ω♥*)', '(♥ω♥ )', '(｡♥‿♥｡)', '(￣ε￣)', '(˘︶˘).｡.:*♡', '(｡•́︿•̀｡)',
  '(´｡• ᵕ •｡`)', '(´▽`ʃ♡ƪ)', '(♡˙︶˙♡)', '(ノ_<。)ヾ(´ ▽ `)', '(๑′ฅ‵๑)',
  '(*≧ω≦*)', '(♡◕‿◕♡)', '✧(｡•̀ᴗ-)✧', '(´∩｡• ᵕ •｡∩`)', 'ฅ(♡ơ ₃ơ)ฅ',
  // triste / llorando
  '(´；ω；`)', '(´・ω・`)', '(T_T)', '(ToT)', '(ಥ﹏ಥ)', '(´;ω;`)',
  '( •̥́ ˍ •̀ू )', '(っ˘̩╭╮˘̩)っ', '｡ﾟ(ﾟ´ω`ﾟ)ﾟ｡', '(ｉДｉ)',
  '(个_个)', '(╥﹏╥)', '(ﾉД`)', '(´_ゝ`)',
  // enfadado / molesto
  '(怒´Д`怒)', '(╬ Ò﹏Ó)', '(｀Д´)', 'ヽ(｀Д´)ノ', '(▼皿▼#)', '(；￣Д￣)',
  '(╬▔皿▔)╯', '(｀ε´)', '(╬ಠ益ಠ)', 'ಠ_ಠ', '(╯°□°）╯︵ ┻━┻', '︵ヽ(`Д´)ﾉ︵',
  '(¬_¬)', '(￣ヘ￣)', '(•̀へ •́ ╮)', '(▼へ▼メ)', '(⊙_◎)',
  // sorpresa / asustado
  '(⊙_⊙)', '(;￣Д￣)', '(°ロ°)', '(ºロº)', '(꒪Д꒪)', '(⊙﹏⊙)',
  '(°□°)', '(O_O)', '(o_O)', '(°Д°)', '(　ﾟДﾟ)', '(Д)ﾟ ﾟ',
  '(▰﹏▰)', '(￣□￣;)', '(・o・)', '(・_・;)', '(´⊙ω⊙`)', '(□_□)',
  // durmiendo / cansado
  '(￣o￣) zzZ', '(￣▽￣) zzZ', '(_ _).｡o○', 'ヽ(´ー`)ノ', '(˘ω˘)',
  '(≧﹏≦)', '(￣▽￣*)ゞ', '(；´Д｀)', '(´-ω-`)', '(￣～￣;)',
  // gestos / manos
  '( •̀ᴗ•́ )و', '(￣ω￣)/', '✌(◕‿-)✌', '👋( ˘▽˘)', '(ノ´ヮ`)ノ', 'ヽ(・∀・)ノ',
  '₍₍ ◟(˘ᵔ˘◟)₎₎', '(☞ﾟヮﾟ)☞', '☜(ﾟヮﾟ☜)', '( ͡° ͜ʖ ͡°)', '( ͡° ʖ̯ ͡°)',
  '(ノ°ο°)ノ', 'ψ(._. )>', '(╯°□°)╯', '٩(◕‿◕)۶', 'd(´▽`)b', '♪~ ᕕ(ᐛ)ᕗ',
  // tímido / nervioso
  '(⁄ ⁄•⁄ω⁄•⁄ ⁄)', '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', '(´•ω•̥`)', '(•́ω•̀)', '(*/ω＼*)',
  '(///￣ ￣///)', '(／。＼)', '(。﹏。*)', '(ｏ・_・)ノ', '(*´﹃｀*)',
  // animalitos
  'ʕ•ᴥ•ʔ', 'ʕ·ᴥ·ʔ', 'ʕ•́ᴥ•̀ʔ', '◕.◕', '●﹏●', '◉‿◉',
  'ᵔᴥᵔ', '(^人^)', 'ฅ^•ﻌ•^ฅ', 'ᗜˬᗜ', '(=^･ω･^=)', '≽(•́ ˕ •̀)≼',
  'UwU', 'OwO', '>w<', '>.<', '^ω^', 'n_n', '(=^‥^=)',
  // flores / adorno
  '✿✿✿', '✧*:･ﾟ✧', '°˖✧◝(⁰▿⁰)◜✧˖°', '✧(≖ ◡ ≖✿)', '(◕‿◕✿)', '❀(*´▽`*)❀',
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '♪✧✧♪', '✿◕ ‿ ◕✿', '❁´◡`❁', '(ง •̀_•́)ง✧', '★(・ω・)ノ'
];

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

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendLine(node) {
  messagesEl.appendChild(node);
  scrollBottom();
}

function systemLine(text, time) {
  const div = document.createElement('div');
  div.className = 'msg-line system';
  if (time) {
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = `[${time}] `;
    div.appendChild(t);
  }
  const s = document.createElement('span');
  s.textContent = text;
  div.appendChild(s);
  appendLine(div);
}

function privateLine(text) {
  const div = document.createElement('div');
  div.className = 'msg-line private';
  div.innerHTML = `<span class="time">[${'*'}]</span> <span class="text"></span>`;
  div.querySelector('.text').textContent = text;
  appendLine(div);
}

function makeTextSpan(text, edited) {
  const span = document.createElement('span');
  span.className = 'text';
  span.textContent = text;
  if (edited) {
    const ed = document.createElement('span');
    ed.className = 'edited';
    ed.textContent = ' (editado)';
    span.appendChild(ed);
  }
  return span;
}

function msgLine(entry, isSelf) {
  const div = document.createElement('div');
  div.className = 'msg-line' + (isSelf ? ' self' : '');
  if (entry.type === 'image') div.classList.add('imgline');
  div.dataset.id = entry.id;

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = `[${entry.time}] `;

  const nick = document.createElement('span');
  nick.className = 'nick nick-' + (isSelf ? MY_COLOR : colorForNick(entry.nick));
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
    div.appendChild(makeTextSpan(entry.text, entry.edited));
    if (isSelf) {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action edit';
      editBtn.textContent = '✎';
      editBtn.title = 'editar';
      editBtn.addEventListener('click', () => startEdit(div, entry));
      div.appendChild(editBtn);
    }
  }

  if (isSelf) {
    const delBtn = document.createElement('button');
    delBtn.className = 'msg-action del';
    delBtn.textContent = '✕';
    delBtn.title = 'borrar';
    delBtn.addEventListener('click', () => {
      if (confirm('¿Borrar este mensaje?')) ws.send(JSON.stringify({ type: 'delete', id: entry.id }));
    });
    div.appendChild(delBtn);
  }

  appendLine(div);
}

function startEdit(div, entry) {
  const span = div.querySelector('.text');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = entry.text;
  div.replaceChild(input, span);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (save && v && v !== entry.text) {
      ws.send(JSON.stringify({ type: 'edit', id: entry.id, text: v }));
      entry.text = v;
      div.replaceChild(makeTextSpan(v, true), input);
    } else {
      div.replaceChild(makeTextSpan(entry.text, entry.edited), input);
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
}

function renderUsers(users) {
  userListEl.innerHTML = '';
  users.sort((a, b) => a.nick.localeCompare(b.nick));
  for (const u of users) {
    const li = document.createElement('li');
    li.className = 'user';
    const color = colorForNick(u.nick);
    const isSelf = u.nick === savedNick;
    li.innerHTML = `<span class="dot dot-${isSelf ? MY_COLOR : color}"></span>` +
      `<span class="nick nick-${isSelf ? MY_COLOR : color}">${u.role === 'admin' ? '✦ ' : ''}${u.nick}</span>` +
      (isSelf ? ' <span class="self-tag">(tú)</span>' : '');
    userListEl.appendChild(li);
  }
}

function setConn(text) {
  connStatus.textContent = text;
}

// ---------- notificaciones en la pestaña ----------

const baseTitle = document.title;
let unread = 0;

function setUnread(n) {
  unread = n;
  document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
}

function countUnread() {
  if (document.hidden) setUnread(unread + 1);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setUnread(0);
});

function redirectToLogin() {
  sessionStorage.removeItem('angel_gate_session');
  sessionStorage.removeItem('angel_token');
  sessionStorage.removeItem('angel_role');
  localStorage.removeItem('angel_nick');
  window.location.replace('/gate');
}

function insertAtCursor(input, text) {
  const s = input.selectionStart || input.value.length;
  const e = input.selectionEnd || input.value.length;
  input.value = input.value.slice(0, s) + text + input.value.slice(e);
  const pos = s + text.length;
  input.setSelectionRange(pos, pos);
  input.focus();
}

let ws = null;
function connect() {
  setConn('conectando...');
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', nick: savedNick, token }));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'welcome': {
        setConn(`conectado como ${msg.nick}`);
        for (const entry of msg.history) {
          if (entry.type === 'system') systemLine(entry.text, entry.time);
          else msgLine(entry, entry.nick === msg.nick);
        }
        appendLine(document.createElement('div'));
        privateLine(msg.text);
        renderUsers(msg.users);
        break;
      }
      case 'message':
        msgLine(msg, msg.nick === savedNick);
        countUnread();
        break;
      case 'image':
        msgLine(msg, msg.nick === savedNick);
        countUnread();
        break;
      case 'system':
        systemLine(msg.text, msg.time);
        break;
      case 'private':
        privateLine(msg.text);
        countUnread();
        break;
      case 'users':
        renderUsers(msg.users);
        break;
      case 'message_edited': {
        const line = document.querySelector(`.msg-line[data-id="${msg.id}"]`);
        if (line) {
          const span = line.querySelector('.text');
          if (span) {
            span.textContent = msg.text;
            const ed = document.createElement('span');
            ed.className = 'edited';
            ed.textContent = ' (editado)';
            span.appendChild(ed);
          }
        }
        break;
      }
      case 'message_deleted': {
        const line = document.querySelector(`.msg-line[data-id="${msg.id}"]`);
        if (line) line.remove();
        break;
      }
      case 'history_cleared':
        messagesEl.innerHTML = '';
        systemLine('El chat quedó vacío. La conversación anterior fue archivada y eliminada.');
        break;
      case 'error':
        privateLine('ERROR: ' + msg.text);
        setTimeout(redirectToLogin, 1500);
        break;
      case 'kicked':
        alert('Has sido expulsado por el administrador.');
        redirectToLogin();
        break;
      case 'nick':
        localStorage.setItem('angel_nick', msg.nick);
        location.reload();
        break;
      case 'clear':
        messagesEl.innerHTML = '';
        break;
    }
  };
  ws.onclose = () => {
    setConn('desconectado — reintentando...');
    setTimeout(connect, 2000);
  };
  ws.onerror = () => ws.close();
}

inputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = msgInput.value;
  if (!text.trim() || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'message', text }));
  msgInput.value = '';
  setUnread(0);
  msgInput.focus();
});

kaoBtn.addEventListener('click', () => {
  kaoTray.hidden = !kaoTray.hidden;
});

KAOMOJI.forEach((k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'kao-btn';
  b.textContent = k;
  b.addEventListener('click', () => insertAtCursor(msgInput, k + ' '));
  kaoTray.appendChild(b);
});

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.type)) {
    privateLine('ERROR: solo se admiten imágenes PNG/JPG/GIF/WEBP/BMP');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    privateLine('ERROR: la imagen pesa más de 5MB');
    return;
  }
  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  try {
    const res = await fetch('/upload', {
      method: 'POST',
      headers: { 'X-Nick': savedNick, 'X-Token': token, 'X-Ext': ext, 'Content-Type': file.type },
      body: file
    });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'image', url: data.url }));
  } catch {
    privateLine('ERROR: no pude subir la imagen');
  }
});

quitBtn.addEventListener('click', () => {
  redirectToLogin();
});

connect();
msgInput.focus();
