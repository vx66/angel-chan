const bootLines = [
  '> INITIALIZING ANGEL_OS v0.0.1 ...',
  '> CARGA DE MEMORIA: 100%',
  '> CONECTANDO A #angel-denpa ...',
  '> BIENVENIDA PENDIENTE ...',
];

const term = document.getElementById('terminal');
const bootEl = document.getElementById('bootLines');
const loginLine = document.getElementById('loginLine');
const nickInput = document.getElementById('nickInput');
const loginError = document.getElementById('loginError');
const loadingOverlay = document.getElementById('loadingOverlay');
const linuxLines = document.getElementById('linuxLines');
const linuxPct = document.getElementById('linuxPct');
const progressFill = document.getElementById('progressFill');
const loadingStatus = document.getElementById('loadingStatus');

function typeLine(text, el, done, delay = 14) {
  let i = 0;
  const line = document.createElement('div');
  line.className = 'boot-line';
  el.appendChild(line);
  const tick = () => {
    line.textContent = text.slice(0, ++i);
    term.scrollTop = term.scrollHeight;
    if (i < text.length) {
      setTimeout(tick, delay);
    } else {
      done();
    }
  };
  tick();
}

let bootIndex = 0;
function nextBootLine() {
  if (bootIndex < bootLines.length) {
    typeLine(bootLines[bootIndex], bootEl, () => {
      bootIndex++;
      setTimeout(nextBootLine, 120);
    });
  } else {
    loginLine.style.display = 'flex';
    nickInput.focus();
    playError();
  }
}

let audioCtx = null;
function playError() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 587;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    o.stop(ctx.currentTime + 0.1);
  } catch (e) {
    /* sin audio */
  }
}

function setError(text) {
  loginError.textContent = text;
  loginError.classList.add('show');
  playError();
}

function wsUrl() {
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
}

const LINUX_BOOT = [
  '[    0.000000] ANGEL_DENPA OS 0.0.1 (angel-kernel 5.15.0-denpa)',
  '[    0.104210] CPU: kaomoji puro x2 @ 2.4GHz',
  '[    0.301912] Memoria: 100% de bytes angel disponibles',
  '[    0.452191] Cargando modulo: chat.ko',
  '[    0.603710] Conectando a #angel-denpa ...',
  '[    0.751243] Verificando identidad del usuario ...',
  '[  OK  ] Servicio de mensajeria iniciado',
  '[  OK  ] Canal #angel-denpa montado',
  '[  OK  ] Sesion lista. Bienvenid@, {name} ~'
];

let bootDone = false;
let checkResult = null;
let ws = null;

function typeLinuxLine(text, done, delay) {
  let i = 0;
  const line = document.createElement('div');
  line.className = 'linux-line';
  linuxLines.appendChild(line);
  const tick = () => {
    line.textContent = text.slice(0, ++i);
    if (i < text.length) {
      setTimeout(tick, delay);
    } else {
      done();
    }
  };
  tick();
}

function updateProgress(fraction) {
  progressFill.style.width = Math.floor(fraction * 100) + '%';
  linuxPct.textContent = Math.floor(fraction * 100) + '%';
}

function showLoading(name) {
  loadingOverlay.hidden = false;
  linuxLines.innerHTML = '';
  updateProgress(0);
  loadingStatus.textContent = 'arrancando ANGEL_DENPA OS...';
  bootDone = false;

  let idx = 0;
  const nextLine = () => {
    if (idx >= LINUX_BOOT.length) {
      bootDone = true;
      loadingStatus.textContent = 'INICIANDO CHAT ✧';
      finishLoading();
      return;
    }
    const text = LINUX_BOOT[idx].replace('{name}', name);
    idx++;
    typeLinuxLine(text, () => {
      updateProgress(idx / LINUX_BOOT.length);
      setTimeout(nextLine, 80);
    }, 9);
  };
  nextLine();
}

function finishLoading() {
  if (!bootDone) {
    setTimeout(finishLoading, 200);
    return;
  }
  if (checkResult && checkResult.ok) {
    sessionStorage.setItem('angel_token', checkResult.token);
    sessionStorage.setItem('angel_role', checkResult.role || 'user');
    localStorage.setItem('angel_nick', checkResult.nick);
    if (ws) ws.close();
    window.location.href = '/chat';
  } else if (checkResult && !checkResult.ok) {
    loadingOverlay.hidden = true;
    setError(checkResult.text);
  } else {
    loadingStatus.textContent = 'ESPERANDO AL SERVIDOR...';
    setTimeout(finishLoading, 300);
  }
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nickInput.value.trim();
  if (!name) {
    setError('!!! NECESITO SABER QUIEN ERES !!!');
    return;
  }
  loginError.classList.remove('show');
  showLoading(name);

  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'check', nick: name }));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'available') {
      checkResult = { ok: true, nick: msg.nick, token: msg.token, role: msg.role };
      finishLoading();
    } else if (msg.type === 'unavailable' || msg.type === 'error') {
      checkResult = { ok: false, text: msg.text };
      finishLoading();
    }
  };
  ws.onerror = () => {
    checkResult = { ok: false, text: 'NO PUEDO CONECTARME AL SERVIDOR...' };
    finishLoading();
  };
});

const saved = localStorage.getItem('angel_nick');
if (saved) nickInput.value = saved;

nextBootLine();
