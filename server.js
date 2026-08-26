const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

const HISTORY_LIMIT = 200;
const TOKEN_TTL = 10 * 60 * 1000;
const MAX_UPLOAD = 5 * 1024 * 1024;
const ADMIN_NICK = process.env.ADMIN_NICK || 'xergno';
const ADMIN_PASS = process.env.ADMIN_PASS;
const GATE_PASS = process.env.GATE_PASS;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const GATE_COOKIE = 'angel_gate';
const gateTokens = new Set();

if (!ADMIN_PASS || !GATE_PASS) {
  throw new Error('Faltan las variables de entorno ADMIN_PASS y/o GATE_PASS. Revisa tu archivo .env.');
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const UPLOAD_EXTS = ['png', 'jpg', 'gif', 'webp', 'bmp'];

// ---------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------

let history = [];
let sessionAudit = [];
let chatStartedAt = null;
try {
  const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  if (Array.isArray(raw)) history = raw.slice(-HISTORY_LIMIT);
} catch {
  history = [];
}

function persistHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-HISTORY_LIMIT)));
    return true;
  } catch (err) {
    console.error('No se pudo guardar el historial activo:', err.message);
    return false;
  }
}

function appendLog(line) {
  sessionAudit.push(line);
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function logStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function archiveStamp(d) {
  const p = (n, size = 2) => String(n).padStart(size, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
}

function historyEntryToLog(entry) {
  const stamp = `[${entry.time || '--:--'}]`;
  if (entry.type === 'system') return `${stamp} * ${entry.text || ''}`;
  if (entry.type === 'image') return `${stamp} <${entry.nick || '?'}> compartió una imagen: ${entry.url || ''}`;
  return `${stamp} <${entry.nick || '?'}> ${entry.text || ''}${entry.edited ? ' (editado)' : ''}`;
}

function startChatSession() {
  chatStartedAt = new Date();
  sessionAudit = [];
}

function archiveAndClearConversation(reason, notifyClients = true) {
  if (history.length === 0 && sessionAudit.length === 0) {
    chatStartedAt = null;
    return true;
  }

  const closedAt = new Date();
  const transcript = sessionAudit.length > 0 ? sessionAudit : history.map(historyEntryToLog);
  const filePath = path.join(LOGS_DIR, `chat-${archiveStamp(closedAt)}.log`);
  const contents = [
    'ANGEL DENPA CHAT — LOG INTERNO',
    `Inicio: ${chatStartedAt ? logStamp(chatStartedAt) : 'desconocido'}`,
    `Cierre: ${logStamp(closedAt)}`,
    `Motivo: ${reason}`,
    `Eventos registrados: ${transcript.length}`,
    '',
    ...transcript,
    ''
  ].join('\n');

  try {
    // El log se escribe primero: el historial solo se borra si el archivo quedó guardado.
    fs.writeFileSync(filePath, contents, 'utf8');
    fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
  } catch (err) {
    console.error('No se pudo archivar el chat; el historial se conserva:', err.message);
    return false;
  }

  history = [];
  sessionAudit = [];
  chatStartedAt = null;
  if (notifyClients) broadcast({ type: 'history_cleared' });
  console.log(`📋 Chat archivado en ${filePath}`);
  return true;
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ownedEntry(entry, state) {
  Object.defineProperty(entry, 'ownerId', { value: state.clientId });
  return entry;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function gateOk(req) {
  const t = parseCookies(req.headers.cookie)[GATE_COOKIE];
  return !!t && gateTokens.has(t);
}

function grantGate(res) {
  const token = crypto.randomBytes(24).toString('hex');
  gateTokens.add(token);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Set-Cookie': `${GATE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${COOKIE_SECURE ? '; Secure' : ''}`
  });
  return res.end(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Acceso concedido</title></head>
<body>
  <script>
    sessionStorage.setItem('angel_gate_session', 'active');
    window.location.replace('/');
  </script>
</body>
</html>`);
}

// ---------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'GET' && urlPath === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method === 'GET' && urlPath === '/config.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    return res.end(`window.ANGEL_CONFIG = ${JSON.stringify({ adminNick: ADMIN_NICK })};`);
  }

  // ---------- página de acceso (gate) ----------
  if (urlPath === '/gate') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const params = new URLSearchParams(body);
        if (params.get('password') === GATE_PASS) return grantGate(res);
        res.writeHead(302, { Location: '/gate?error=1' });
        return res.end();
      });
      return;
    }
    const gatePath = path.join(PUBLIC_DIR, 'gate.html');
    fs.stat(gatePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        return res.end('Not Found');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(gatePath).pipe(res);
    });
    return;
  }

  // ---------- rutas que exigen acceso ----------
  const needsGate =
    urlPath === '/' ||
    urlPath === '/index.html' ||
    urlPath === '/chat' ||
    urlPath === '/chat.html' ||
    urlPath === '/admin';
  if (needsGate && !gateOk(req)) {
    res.writeHead(302, { Location: '/gate' });
    return res.end();
  }

  if (req.method === 'POST' && urlPath === '/upload') {
    if (!gateOk(req)) {
      res.writeHead(403);
      return res.end('denegado');
    }
    return handleUpload(req, res);
  }

  let filePath;
  if (urlPath === '/' || urlPath === '/index.html') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  } else if (urlPath === '/chat') {
    filePath = path.join(PUBLIC_DIR, 'chat.html');
  } else if (urlPath === '/admin') {
    filePath = path.join(PUBLIC_DIR, 'admin.html');
  } else if (urlPath === '/chat.html') {
    res.writeHead(301, { Location: '/chat' });
    return res.end();
  } else if (urlPath.startsWith('/uploads/')) {
    filePath = path.join(UPLOADS_DIR, path.basename(urlPath));
  } else {
    filePath = path.join(PUBLIC_DIR, urlPath);
  }

  if (!filePath.startsWith(PUBLIC_DIR) && !filePath.startsWith(UPLOADS_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

function handleUpload(req, res) {
  const nick = String(req.headers['x-nick'] || '');
  const token = String(req.headers['x-token'] || '');
  const ext = String(req.headers['x-ext'] || '').toLowerCase();

  if (!UPLOAD_EXTS.includes(ext) || !isJoined(nick, token)) {
    res.writeHead(403);
    return res.end('denegado');
  }

  const length = parseInt(req.headers['content-length'], 10) || 0;
  if (length > MAX_UPLOAD) {
    res.writeHead(413);
    return res.end('imagen muy grande (máx 5MB)');
  }

  const chunks = [];
  let total = 0;
  req.on('data', (c) => {
    total += c.length;
    if (total > MAX_UPLOAD) {
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const m = buf.subarray(0, 12);
    const ok =
      (ext === 'png' && m.length >= 4 && m.readUInt32BE(0) === 0x89504e47) ||
      (ext === 'jpg' && m.length >= 3 && m.readUInt16BE(0) === 0xffd8) ||
      (ext === 'gif' && (buf.toString('ascii', 0, 6) === 'GIF89a' || buf.toString('ascii', 0, 6) === 'GIF87a')) ||
      (ext === 'webp' && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') ||
      (ext === 'bmp' && buf.toString('ascii', 0, 2) === 'BM');
    if (!ok || buf.length === 0) {
      res.writeHead(415);
      return res.end('formato inválido');
    }
    const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFile(path.join(UPLOADS_DIR, name), buf, (err) => {
      if (err) {
        res.writeHead(500);
        return res.end('error guardando');
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ url: '/uploads/' + name }));
    });
  });
  req.on('error', () => res.destroy());
}

// ---------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------

const wss = new WebSocketServer({ server });

const clients = new Map();
const tokens = new Map();

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws !== except && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

// Si el proceso anterior terminó con gente conectada, se archiva ese historial
// antes de aceptar una conversación nueva.
if (history.length > 0) {
  archiveAndClearConversation('historial recuperado después de reiniciar el servidor', false);
}

function pushHistory(msg) {
  history.push(msg);
  if (history.length > HISTORY_LIMIT) history.shift();
  persistHistory();
}

function addSystem(msg, extraUsers) {
  const entry = { type: 'system', text: msg, time: now(), id: null };
  pushHistory(entry);
  appendLog(`[${logStamp()}] * ${msg.replace(/^[◇✧✦]\s*/, '')}`);
  broadcast(entry);
  bcastUsers();
}

function bcastUsers() {
  broadcast({ type: 'users', users: clientList() });
}

function clientList() {
  return [...clients.values()].map((c) => ({ nick: c.nick, role: c.role }));
}

function nickInUse(nick) {
  const lower = nick.toLowerCase();
  return [...clients.values()].some((c) => c.nick.toLowerCase() === lower);
}

function sanitizeNick(raw) {
  return String(raw || '')
    .replace(/[<>{}&"'\r\n\t]/g, '')
    .trim()
    .slice(0, 20);
}

function sanitizeText(raw) {
  return String(raw || '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, 1000);
}

function newToken(nick, role) {
  pruneTokens();
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, { nick, role, ts: Date.now() });
  return token;
}

function pruneTokens() {
  const cutoff = Date.now() - TOKEN_TTL;
  for (const [token, entry] of tokens) {
    if (entry.ts < cutoff) tokens.delete(token);
  }
}

function getIP(req) {
  const addr = req && req.socket ? req.socket.remoteAddress : '';
  return String(addr || '').replace(/^::ffff:/, '') || 'desconocida';
}

function isJoined(nick, token) {
  const session = tokens.get(token);
  if (!session || session.nick !== nick) return false;
  return [...clients.values()].some((c) => c.nick === nick);
}

function lookupLocation(ip, cb) {
  const clean = String(ip || '').replace(/^::ffff:/, '');
  if (
    !clean ||
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    clean.startsWith('172.') ||
    clean === '0.0.0.0'
  ) {
    return cb(null, 'local (tu máquina)');
  }
  http
    .get(
      {
        host: 'ip-api.com',
        path: `/json/${clean}?fields=status,country,regionName,city,isp`,
        timeout: 5000
      },
      (r) => {
        let data = '';
        r.on('data', (c) => (data += c));
        r.on('end', () => {
          try {
            const o = JSON.parse(data);
            if (o.status === 'success') {
              const parts = [o.city, o.regionName, o.country].filter(Boolean).join(', ');
              return cb(null, parts + (o.isp ? ` (${o.isp})` : ''));
            }
            cb(null, 'desconocida');
          } catch {
            cb(null, 'desconocida');
          }
        });
      }
    )
    .on('error', () => cb(null, 'desconocida'));
}

wss.on('connection', (ws, req) => {
  if (!gateOk(req)) {
    ws.close(1008, 'acceso denegado');
    return;
  }
  let state = { nick: null, token: null, role: 'user', ip: getIP(req), clientId: randomId() };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // ---------- antes de entrar ----------
    if (!state.nick) {
      if (msg.type === 'check') {
        const nick = sanitizeNick(msg.nick);
        pruneTokens();
        if (!nick) {
          return send(ws, { type: 'error', text: 'Escribe tu nombre antes de entrar.' });
        }
        if (nick.toLowerCase() === ADMIN_NICK) {
          return send(ws, { type: 'unavailable', text: `"${ADMIN_NICK}" está reservado para el administrador. Usa el botón ⚙ Admin.` });
        }
        if (nickInUse(nick)) {
          return send(ws, { type: 'unavailable', text: `El nombre "${nick}" ya está en uso. Elige otro.` });
        }
        return send(ws, { type: 'available', nick, token: newToken(nick, 'user'), role: 'user' });
      }

      if (msg.type === 'admin_login') {
        const nick = sanitizeNick(msg.nick);
        const password = String(msg.password || '');
        pruneTokens();
        if (nick.toLowerCase() !== ADMIN_NICK) {
          return send(ws, { type: 'error', text: 'Usuario inválido. Solo el administrador puede entrar.' });
        }
        if (password !== ADMIN_PASS) {
          return send(ws, { type: 'error', text: 'Contraseña de administrador incorrecta.' });
        }
        return send(ws, { type: 'available', nick: ADMIN_NICK, token: newToken(ADMIN_NICK, 'admin'), role: 'admin' });
      }

      if (msg.type === 'join') {
        const nick = sanitizeNick(msg.nick);
        const token = String(msg.token || '');
        const ghost = msg.ghost === true;
        pruneTokens();
        const session = tokens.get(token);
        if (!session || session.nick !== nick) {
          return send(ws, { type: 'error', text: 'ACCESO DENEGADO. Debes entrar por el login.' });
        }
        if (ghost && session.role !== 'admin') {
          return send(ws, { type: 'error', text: 'ACCESO DENEGADO. Solo administradores.' });
        }
        state.nick = nick;
        state.token = token;
        state.role = session.role;
        state.ghost = ghost;
        if (!ghost) {
          if (nickInUse(nick)) {
            return send(ws, { type: 'error', text: `El nombre "${nick}" ya está en uso. Elige otro.` });
          }
          if (clients.size === 0) startChatSession();
          clients.set(ws, state);
          addSystem(`◇ ${nick} ha entrado al canal.`);
        }
        send(ws, {
          type: 'welcome',
          nick,
          role: state.role,
          users: clientList(),
          history,
          text: ghost ? 'Modo administrador activado (invisible en el chat).' : `Bienvenid@ al canal #angel-denpa, ${nick} ~`
        });
        return;
      }

      return;
    }

    // ---------- administración ----------
    if (msg.type === 'admin_users') {
      if (state.role !== 'admin') return;
      return send(ws, {
        type: 'admin_users',
        users: [...clients.values()].map((c) => ({ nick: c.nick, ip: c.ip, role: c.role }))
      });
    }

    if (msg.type === 'admin_location') {
      if (state.role !== 'admin') return;
      const target = [...clients.values()].find((c) => c.nick.toLowerCase() === String(msg.nick).toLowerCase());
      if (!target) return send(ws, { type: 'admin_location', nick: msg.nick, ip: '?', location: 'desconectado' });
      return lookupLocation(target.ip, (err, location) => {
        send(ws, { type: 'admin_location', nick: target.nick, ip: target.ip, location });
      });
    }

    if (msg.type === 'admin_kick') {
      if (state.role !== 'admin') return;
      const entry = [...clients.entries()].find(([cws, c]) => c.nick.toLowerCase() === String(msg.nick).toLowerCase());
      if (!entry) return;
      const [tws, tstate] = entry;
      clients.delete(tws);
      if (tstate.token) tokens.delete(tstate.token);
      addSystem(`◇ ${state.nick} expulsó a ${tstate.nick}.`);
      send(tws, { type: 'kicked', text: 'Has sido expulsado por el administrador.' });
      if (clients.size === 0) archiveAndClearConversation('todos los participantes abandonaron el chat');
      tws.close();
      return;
    }

    // ---------- mensajes ----------
    if (msg.type === 'message') {
      let text = sanitizeText(msg.text);

      if (text.startsWith('/')) {
        const [cmd, ...rest] = text.split(' ');
        const arg = rest.join(' ').trim();
        switch (cmd.toLowerCase()) {
          case '/help':
            send(ws, { type: 'private', text: 'Comandos: /nick <nombre> · /users · /clear · /help' });
            break;
          case '/nick': {
            const newNick = sanitizeNick(arg);
            if (!newNick) return send(ws, { type: 'private', text: 'Uso: /nick <nuevo_nombre>' });
            if (newNick.toLowerCase() === state.nick.toLowerCase()) return send(ws, { type: 'private', text: 'Ese ya es tu nombre.' });
            if (newNick.toLowerCase() === ADMIN_NICK && state.role !== 'admin') return send(ws, { type: 'private', text: 'Ese nombre está reservado.' });
            if (nickInUse(newNick)) return send(ws, { type: 'private', text: `"${newNick}" ya está en uso.` });
            const oldNick = state.nick;
            state.nick = newNick;
            send(ws, { type: 'nick', nick: newNick });
            addSystem(`✧ ${oldNick} ahora se llama ${newNick}.`);
            break;
          }
          case '/users':
            send(ws, { type: 'private', text: 'Usuarios conectados: ' + (clientList().map((u) => u.nick).join(', ') || '(solo tú)') });
            break;
          case '/clear':
            send(ws, { type: 'clear' });
            break;
          default:
            send(ws, { type: 'private', text: 'Comando desconocido. Usa /help.' });
        }
        return;
      }

      if (!text.trim()) return;
      const entry = ownedEntry({ type: 'message', nick: state.nick, text, time: now(), id: randomId() }, state);
      pushHistory(entry);
      appendLog(`[${logStamp()}] <${state.nick}> ${text}`);
      broadcast(entry);
      return;
    }

    if (msg.type === 'edit') {
      const entry = history.find((m) => m.id === msg.id);
      if (!entry || entry.type !== 'message') return;
      if (entry.ownerId !== state.clientId) return send(ws, { type: 'private', text: 'Solo puedes editar tus propios mensajes.' });
      const text = sanitizeText(msg.text);
      if (!text) return;
      entry.text = text;
      entry.edited = true;
      persistHistory();
      appendLog(`[${logStamp()}] * ${state.nick} editó su mensaje a: ${text}`);
      broadcast({ type: 'message_edited', id: entry.id, text });
      return;
    }

    if (msg.type === 'delete') {
      const idx = history.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const entry = history[idx];
        const canDelete = state.role === 'admin' || entry.ownerId === state.clientId;
        if (!canDelete) return send(ws, { type: 'private', text: 'Solo puedes borrar tus propios mensajes.' });
        const [removed] = history.splice(idx, 1);
        persistHistory();
        const actor = state.role === 'admin' && removed.nick !== state.nick ? `admin ${state.nick}` : state.nick;
        appendLog(`[${logStamp()}] * ${actor} borró un mensaje de ${removed.nick}`);
        broadcast({ type: 'message_deleted', id: removed.id });
      }
      return;
    }

    if (msg.type === 'image') {
      const url = String(msg.url || '');
      if (!/^\/uploads\/[a-f0-9]+\.(png|jpg|gif|webp|bmp)$/i.test(url)) return;
      fs.access(path.join(UPLOADS_DIR, path.basename(url)), fs.constants.F_OK, (err) => {
        if (err) return;
        const entry = ownedEntry({ type: 'image', nick: state.nick, url, time: now(), id: randomId() }, state);
        pushHistory(entry);
        appendLog(`[${logStamp()}] <${state.nick}> compartió una imagen: ${url}`);
        broadcast(entry);
      });
      return;
    }
  });

  ws.on('close', () => {
    if (state.nick && clients.has(ws)) {
      clients.delete(ws);
      if (state.token) tokens.delete(state.token);
      addSystem(`◇ ${state.nick} ha salido del canal.`);
      if (clients.size === 0) archiveAndClearConversation('todos los participantes abandonaron el chat');
    }
  });
});

server.listen(PORT, () => {
  console.log(`☁  Angel Denpa Chat corriendo en http://localhost:${PORT}`);
  console.log(`✦  Administrador: ${ADMIN_NICK}`);
  console.log(`📋  Logs internos: ${LOGS_DIR}`);
});
