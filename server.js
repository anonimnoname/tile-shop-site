#!/usr/bin/env node
// Сервер магазина плитки. Без внешних зависимостей: нужен только Node.js 20+.
//
//   node server.js                 — запустить сайт (порт из PORT, по умолчанию 3000)
//   node server.js set-password    — задать или сменить пароль админки
//
// Данные лежат в папке data/ (товары, заказы, настройки), фото — в public/uploads/.
'use strict';
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // наружу сайт выходит через Caddy (HTTPS)
// Админка: секретный адрес и (по желанию) список IP, с которых её можно открыть
const ADMIN_PATH = '/' + String(process.env.ADMIN_PATH || 'admin').replace(/[^\w-]/g, '').replace(/^$/, 'admin');
const ADMIN_IPS = (process.env.ADMIN_IPS || '').split(',').map(x => x.trim()).filter(Boolean);
const webpush = require('./webpush');
const TG_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT = process.env.TG_CHAT_ID || '';
const SESSION_DAYS = 30;

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------------- хранилище (JSON-файлы, атомарная запись) ----------------
function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8')); }
  catch (e) { return typeof fallback === 'function' ? fallback() : fallback; }
}
function save(name, value) {
  const file = path.join(DATA, name + '.json'), tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function seedFromStatic(file, varName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, 'js', file), 'utf8'), sandbox);
  return sandbox.window[varName];
}

const db = {
  products: load('products', () => seedFromStatic('catalog.js', 'CATALOG').map((p, i) => Object.assign({ active: true, order: i }, p))),
  orders: load('orders', []),
  settings: load('settings', () => Object.assign({ usdRate: 12700, deliveryNote: 'Доставка по Узбекистану. Стоимость доставки сообщим при подтверждении.' }, seedFromStatic('config.js', 'SHOP'))),
  admin: load('admin', null),
  push: load('push', [])
};
const vapid = webpush.loadKeys(path.join(DATA, 'vapid.json'));
for (const k of ['products', 'orders', 'settings']) save(k, db[k]);

// ---------------- пароль ----------------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function checkPassword(pw) {
  if (!db.admin || typeof pw !== 'string') return false;
  const h = crypto.scryptSync(pw, db.admin.salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(db.admin.hash, 'hex'));
}

if (process.argv[2] === 'set-password') {
  const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Новый пароль админки (минимум 8 символов): ', pw => {
    rl.close();
    if (!pw || pw.length < 8) { console.error('Слишком короткий пароль.'); process.exit(1); }
    save('admin', hashPassword(pw));
    console.log('Пароль сохранён. Перезапустите сервер, если он запущен.');
    process.exit(0);
  });
  return;
}
if (!db.admin && process.env.ADMIN_PASSWORD) { db.admin = hashPassword(process.env.ADMIN_PASSWORD); save('admin', db.admin); }

// ---------------- сессии и ограничения ----------------
const sessions = new Map(); // token -> expires
function newSession() {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + SESSION_DAYS * 864e5);
  return t;
}
function isAdmin(req) {
  const t = cookies(req).sid;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
const hits = new Map(); // key -> [timestamps]
function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some(t => now - t < 36e5)) hits.delete(k);
  for (const [k, v] of sessions) if (v < now) sessions.delete(k);
}, 6e5).unref();

// ---------------- http helpers ----------------
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function ip(req) { return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || ''; }
function secure(req) { return req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted; }
function send(res, code, body, headers) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, Object.assign({
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  }, headers));
  res.end(data);
}
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Слишком большой запрос'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Неверный JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}
// Запросы, меняющие данные, принимаем только со своего сайта
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

// ---------------- валидация ----------------
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const num = (v, min, max) => { const n = +v; return isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
function phone(v) {
  const s = str(v, 40).replace(/[\s()\-.]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}
const USES = ['wall', 'floor', 'plinth', 'outdoor'];
const CATS = ['bath', 'kitchen', 'floor', 'universal', 'outdoor'];
const MATERIALS = ['solid', 'marble', 'stone', 'travertine', 'slate', 'wood', 'terrazzo', 'zellige', 'brick', 'mosaic', 'pattern'];
const COLOR = /^#[0-9a-f]{6}$/i;
const STYLES = ['marble', 'onyx', 'stone', 'concrete', 'terrazzo', 'solid'];

function cleanProduct(b, old) {
  const p = Object.assign({}, old || {});
  p.name = str(b.name, 80); if (!p.name) throw bad('Укажите название');
  p.collection = str(b.collection, 60);
  p.country = str(b.country, 40);
  p.finish = str(b.finish, 60);
  p.w = num(b.w, 1, 300); p.h = num(b.h, 1, 300);
  if (!p.w || !p.h) throw bad('Укажите размер плитки');
  p.price = num(b.price, 0, 1e9); if (p.price == null) throw bad('Укажите цену');
  p.box = num(b.box, 0.01, 100); if (!p.box) throw bad('Укажите м² в коробке');
  p.use = Array.isArray(b.use) ? b.use.filter(u => USES.includes(u)) : [];
  if (!p.use.length) throw bad('Отметьте, где можно класть плитку');
  p.cats = Array.isArray(b.cats) ? b.cats.filter(c => CATS.includes(c)) : [];
  if (!p.cats.length) p.cats = ['universal'];
  p.inStock = !!b.inStock; p.active = b.active !== false; p.isNew = !!b.isNew;
  p.style = STYLES.includes(b.style) ? b.style : (p.style || 'solid');
  if (!p.createdAt) p.createdAt = new Date().toISOString();
  p.defaultLayout = ['straight', 'brick', 'third', 'diagonal', 'herringbone'].includes(b.defaultLayout) ? b.defaultLayout : undefined;
  const img = str(b.image, 200);
  p.image = /^\/uploads\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(img) ? img : undefined;
  if (b.material && typeof b.material === 'object') {
    const m = b.material, type = MATERIALS.includes(m.type) ? m.type : 'solid';
    const c1 = COLOR.test(m.c1) ? m.c1 : '#cccccc', c2 = COLOR.test(m.c2) ? m.c2 : '#888888';
    const gloss = num(m.gloss, 0, 1) || 0;
    p.material = materialFrom(type, c1, c2, gloss);
  } else if (!p.material) p.material = materialFrom('solid', '#cccccc', '#888888', 0.3);
  return p;
}
// Простые два цвета из админки → параметры имитации
function materialFrom(type, c1, c2, gloss) {
  const m = { type, gloss, c1, c2 };
  switch (type) {
    case 'marble': return Object.assign(m, { base: c1, vein: c2, veinAlpha: 0.55 });
    case 'travertine': return Object.assign(m, { base: c1, line: c2 });
    case 'stone': case 'slate': case 'brick': return Object.assign(m, { base: c1, speck: 0.7 });
    case 'wood': return Object.assign(m, { base: c1, grain: c2 });
    case 'terrazzo': return Object.assign(m, { base: c1, chips: [c2, '#8a8d91', '#c9b9a6', '#4f5559'] });
    case 'mosaic': return Object.assign(m, { cells: 10, colors: [c1, c2, c1, c2, '#ffffff'], grout: '#e9eef0' });
    case 'pattern': return Object.assign(m, { motif: 'star', bg: c1, fg: c2, accent: c2 });
    default: return Object.assign(m, { color: c1 });
  }
}
function bad(msg) { return Object.assign(new Error(msg), { code: 400 }); }

function publicSettings() {
  const s = db.settings;
  return { name: s.name, tagline: s.tagline, phone: s.phone, phoneRaw: s.phoneRaw, telegram: s.telegram, address: s.address,
    hours: s.hours, mapUrl: s.mapUrl, currency: s.currency, reserve: s.reserve, holdDays: s.holdDays, usdRate: s.usdRate, deliveryNote: s.deliveryNote, years: s.years, clients: s.clients };
}

// ---------------- Push-уведомления на ноутбук ----------------
async function pushAll(data) {
  if (!db.push.length) return;
  const subject = db.settings.siteOrigin || 'mailto:admin@example.com';
  const results = await Promise.all(db.push.map(sub => webpush.send(sub, data, vapid, subject)));
  const alive = db.push.filter((s, i) => results[i] !== 404 && results[i] !== 410);
  if (alive.length !== db.push.length) { db.push = alive; save('push', db.push); }
  return results;
}
function adminAllowed(req) {
  return !ADMIN_IPS.length || ADMIN_IPS.includes(ip(req).replace(/^::ffff:/, ''));
}

// ---------------- Telegram ----------------
function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const body = JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true });
  const r = https.request({ hostname: 'api.telegram.org', path: `/bot${TG_TOKEN}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
  r.on('error', e => console.error('Telegram:', e.message));
  r.end(body);
}
const fmt = n => Math.round(n).toLocaleString('ru-RU');

// ---------------- API ----------------
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Запрос с чужого сайта' });

  if (p === '/api/catalog' && m === 'GET') {
    const products = db.products.filter(x => x.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    return send(res, 200, { products, settings: publicSettings() }, { 'Cache-Control': 'public, max-age=60' });
  }

  if (p === '/api/orders' && m === 'POST') {
    if (limited('order:' + ip(req), 8, 36e5)) return send(res, 429, { error: 'Слишком много заказов подряд. Попробуйте позже или напишите нам.' });
    const b = await readJson(req, 64 * 1024);
    if (b.website) return send(res, 200, { ok: true, id: 0 }); // ловушка для ботов
    const customer = { name: str(b.customer && b.customer.name, 80), phone: phone(b.customer && b.customer.phone), contact: str(b.customer && b.customer.contact, 20) };
    const recipient = { name: str(b.recipient && b.recipient.name, 80), phone: phone(b.recipient && b.recipient.phone) };
    const address = { city: str(b.address && b.address.city, 80), street: str(b.address && b.address.street, 200) };
    if (!customer.name) throw bad('Укажите ваше имя');
    if (!customer.phone) throw bad('Укажите ваш телефон с кодом страны, например +1 555 123 4567');
    if (!recipient.name || !recipient.phone) throw bad('Укажите имя и телефон получателя');
    if (!address.city || !address.street) throw bad('Укажите адрес доставки');
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).map(it => {
      const prod = db.products.find(x => x.id === it.id);
      const boxes = Math.round(num(it.boxes, 0, 10000) || 0);
      if (!prod || !boxes) return null;
      const m2 = +(boxes * prod.box).toFixed(2);
      return { id: prod.id, name: prod.name, size: `${prod.w}×${prod.h}`, boxes, m2, price: prod.price, sum: Math.round(m2 * prod.price), note: str(it.note, 120) };
    }).filter(Boolean);
    if (!items.length) throw bad('Корзина пуста');
    const order = {
      id: (db.orders.reduce((a, o) => Math.max(a, o.id), 1000)) + 1,
      createdAt: new Date().toISOString(), status: 'new',
      customer, recipient, address, comment: str(b.comment, 1000),
      links: (Array.isArray(b.links) ? b.links : []).slice(0, 10).map(l => str(l, 4000)).filter(l => /^https?:\/\//.test(l)),
      items, total: items.reduce((a, i) => a + i.sum, 0), adminNote: ''
    };
    db.orders.push(order); save('orders', db.orders);
    notify([
      `🧱 Новый заказ №${order.id}`,
      `Заказчик: ${customer.name}, ${customer.phone} (${customer.contact || 'любой способ'})`,
      `Получатель: ${recipient.name}, ${recipient.phone}`,
      `Адрес: ${address.city}, ${address.street}`,
      ...items.map(i => `• ${i.name} ${i.size}: ${i.boxes} кор. (${i.m2} м²) = ${fmt(i.sum)}`),
      `Итого: ${fmt(order.total)} ${db.settings.currency}`,
      order.comment ? `Комментарий: ${order.comment}` : ''
    ].filter(Boolean).join('\n'));
    pushAll({ title: `Новый заказ №${order.id} — ${fmt(order.total)} ${db.settings.currency}`,
      body: `${customer.name}, ${customer.phone} → ${address.city}. ${items.length} поз.`, url: ADMIN_PATH, tag: 'order-' + order.id }).catch(() => {});
    return send(res, 200, { ok: true, id: order.id, total: order.total });
  }

  if ((p === '/api/login' || p.startsWith('/api/admin/')) && !adminAllowed(req)) return send(res, 404, { error: 'Не найдено' });
  if (p === '/api/login' && m === 'POST') {
    if (limited('login:' + ip(req), 6, 15 * 6e4)) return send(res, 429, { error: 'Слишком много попыток. Подождите 15 минут.' });
    const b = await readJson(req, 4096);
    if (!db.admin) return send(res, 503, { error: 'Пароль ещё не задан. На сервере выполните: node server.js set-password' });
    if (!checkPassword(b.password)) return send(res, 401, { error: 'Неверный пароль' });
    const t = newSession();
    return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure(req) ? '; Secure' : ''}` });
  }
  if (p === '/api/logout' && m === 'POST') {
    sessions.delete(cookies(req).sid);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
  }

  // ---- дальше только для администратора ----
  if (!p.startsWith('/api/admin/')) return send(res, 404, { error: 'Не найдено' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Нужно войти' });
  const sub = p.slice('/api/admin/'.length);

  if (sub === 'me') return send(res, 200, { ok: true });

  if (sub === 'push/key' && m === 'GET') return send(res, 200, { publicKey: vapid.publicKey, count: db.push.length });
  if (sub === 'push/subscribe' && m === 'POST') {
    const b = await readJson(req, 8192), sb = b.subscription || {};
    if (!/^https:\/\//.test(sb.endpoint || '') || !sb.keys || !sb.keys.p256dh || !sb.keys.auth) throw bad('Неверная подписка');
    db.push = db.push.filter(x => x.endpoint !== sb.endpoint);
    db.push.push({ endpoint: str(sb.endpoint, 1000), keys: { p256dh: str(sb.keys.p256dh, 200), auth: str(sb.keys.auth, 100) }, device: str(b.device, 120), at: new Date().toISOString() });
    save('push', db.push);
    if (req.headers.host) { db.settings.siteOrigin = (secure(req) ? 'https://' : 'http://') + req.headers.host; save('settings', db.settings); }
    return send(res, 200, { ok: true, count: db.push.length });
  }
  if (sub === 'push/test' && m === 'POST') {
    const r = await pushAll({ title: 'Уведомления работают ✓', body: 'Так будут приходить новые заказы с сайта.', url: ADMIN_PATH, tag: 'test' });
    return send(res, 200, { ok: true, sent: (r || []).filter(c => c >= 200 && c < 300).length, count: db.push.length });
  }

  if (sub === 'products' && m === 'GET') return send(res, 200, db.products.slice().sort((a, b) => (a.order || 0) - (b.order || 0)));
  if (sub === 'products' && m === 'POST') {
    const b = await readJson(req, 64 * 1024);
    const prod = cleanProduct(b);
    prod.id = 'p' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    prod.order = db.products.reduce((a, x) => Math.min(a, x.order || 0), 0) - 1; // новые — сверху
    db.products.push(prod); save('products', db.products);
    return send(res, 200, prod);
  }
  let mm = sub.match(/^products\/([\w-]+)$/);
  if (mm) {
    const i = db.products.findIndex(x => x.id === mm[1]);
    if (i < 0) return send(res, 404, { error: 'Товар не найден' });
    if (m === 'PUT') {
      const b = await readJson(req, 64 * 1024);
      db.products[i] = Object.assign(cleanProduct(b, db.products[i]), { id: db.products[i].id });
      save('products', db.products);
      return send(res, 200, db.products[i]);
    }
    if (m === 'PATCH') { // быстрые переключатели: наличие, показ, цена
      const b = await readJson(req, 4096), x = db.products[i];
      if ('inStock' in b) x.inStock = !!b.inStock;
      if ('isNew' in b) x.isNew = !!b.isNew;
      if ('active' in b) x.active = !!b.active;
      if ('price' in b) { const v = num(b.price, 0, 1e9); if (v != null) x.price = v; }
      save('products', db.products);
      return send(res, 200, x);
    }
    if (m === 'DELETE') {
      const [gone] = db.products.splice(i, 1); save('products', db.products);
      if (gone.image && !db.products.some(x => x.image === gone.image)) fs.unlink(path.join(PUBLIC, gone.image), () => {});
      return send(res, 200, { ok: true });
    }
  }
  if (sub === 'upload' && m === 'POST') {
    const b = await readJson(req, 6 * 1024 * 1024);
    const mt = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
    if (!mt) throw bad('Нужна картинка JPG, PNG или WEBP');
    const buf = Buffer.from(mt[2], 'base64');
    const ok = (mt[1] === 'jpeg' && buf[0] === 0xff && buf[1] === 0xd8) || (mt[1] === 'png' && buf[0] === 0x89 && buf[1] === 0x50) || (mt[1] === 'webp' && buf.slice(8, 12).toString() === 'WEBP');
    if (!ok) throw bad('Файл не похож на картинку');
    const name = crypto.randomBytes(12).toString('hex') + '.' + (mt[1] === 'jpeg' ? 'jpg' : mt[1]);
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return send(res, 200, { url: '/uploads/' + name });
  }

  if (sub === 'orders' && m === 'GET') return send(res, 200, db.orders.slice().reverse());
  mm = sub.match(/^orders\/(\d+)$/);
  if (mm && m === 'PATCH') {
    const o = db.orders.find(x => x.id === +mm[1]);
    if (!o) return send(res, 404, { error: 'Заказ не найден' });
    const b = await readJson(req, 8192);
    if (['new', 'confirmed', 'paid', 'delivering', 'done', 'cancelled'].includes(b.status)) o.status = b.status;
    if (typeof b.adminNote === 'string') o.adminNote = str(b.adminNote, 2000);
    save('orders', db.orders);
    return send(res, 200, o);
  }

  if (sub === 'settings' && m === 'GET') return send(res, 200, db.settings);
  if (sub === 'settings' && m === 'PUT') {
    const b = await readJson(req, 16 * 1024), s = db.settings;
    for (const k of ['name', 'tagline', 'phone', 'telegram', 'address', 'hours', 'mapUrl', 'currency', 'deliveryNote', 'payCard', 'payCardHolder', 'payBank']) if (k in b) s[k] = str(b[k], 500);
    if ('phoneRaw' in b) s.phoneRaw = str(b.phoneRaw, 20).replace(/\D/g, '');
    if ('usdRate' in b) { const v = num(b.usdRate, 0, 1e7); if (v != null) s.usdRate = v; }
    if ('years' in b) { const v = num(b.years, 0, 200); if (v != null) s.years = Math.round(v); }
    if ('clients' in b) { const v = num(b.clients, 0, 1e9); if (v != null) s.clients = Math.round(v); }
    if ('holdDays' in b) { const v = num(b.holdDays, 0, 60); if (v != null) s.holdDays = Math.round(v); }
    if (s.mapUrl && !/^https?:\/\//.test(s.mapUrl)) s.mapUrl = '';
    s.telegram = (s.telegram || '').replace(/^@/, '').replace(/[^\w]/g, '');
    save('settings', s);
    return send(res, 200, s);
  }
  if (sub === 'password' && m === 'POST') {
    const b = await readJson(req, 4096);
    if (!checkPassword(b.current)) return send(res, 401, { error: 'Текущий пароль неверный' });
    if (typeof b.next !== 'string' || b.next.length < 8) throw bad('Новый пароль — минимум 8 символов');
    db.admin = hashPassword(b.next); save('admin', db.admin);
    sessions.clear();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'Не найдено' });
}

// ---------------- статика ----------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' ) rel = '/index.html';
  if (rel === ADMIN_PATH || rel === ADMIN_PATH + '/') {
    if (!adminAllowed(req)) return send(res, 404, 'Not found');
    rel = '/admin.html';
  } else if (rel === '/admin.html') return send(res, 404, 'Not found'); // админка только по своему адресу
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' ? 'no-cache' : rel.startsWith('/uploads/') || rel.startsWith('/vendor/') ? 'public, max-age=2592000' : 'public, max-age=3600',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (ext === '.html') headers['X-Frame-Options'] = 'SAMEORIGIN';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
    else send(res, 405, 'Method not allowed');
  } catch (e) {
    if (!res.headersSent) send(res, e.code >= 400 && e.code < 500 ? e.code : 500, { error: e.code ? e.message : 'Ошибка сервера' });
    if (!e.code) console.error(e);
  }
});
server.listen(PORT, HOST, () => {
  console.log(`Сайт: http://${HOST}:${PORT}   Админка: http://${HOST}:${PORT}${ADMIN_PATH}`);
  if (ADMIN_IPS.length) console.log('Админка открывается только с IP: ' + ADMIN_IPS.join(', '));
  if (!db.admin) console.log('⚠ Пароль админки не задан. Выполните: node server.js set-password');
  if (!TG_TOKEN) console.log('ℹ Уведомления в Telegram выключены (задайте TG_BOT_TOKEN и TG_CHAT_ID).');
});
