// Общее для всех частей сайта: данные, форматирование, карточки товаров, события.
(function () {
  'use strict';
  const K = window.K = window.K || {};
  const S = K.S = window.SHOP, CAT = K.CAT = window.CATALOG, T = K.T = window.Tiles;
  K.APP = new URLSearchParams(location.search).get('app') === '1';
  if (K.APP) document.body.classList.add('app');
  // простая шина событий между частями сайта
  const handlers = {};
  K.on = (name, fn) => (handlers[name] = handlers[name] || []).push(fn);
  K.emit = (name, ...a) => (handlers[name] || []).forEach(fn => fn(...a));
  K.pages = {};
  const byId = id => CAT.find(t => t.id === id);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/[\s,]/g, ' ');
  const money = n => fmt(n) + ' ' + S.currency;
  const usd = n => S.usdRate > 0 ? '≈ $' + (n / S.usdRate >= 100 ? fmt(n / S.usdRate) : (n / S.usdRate).toFixed(n / S.usdRate < 10 ? 2 : 1)) : '';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = v => Math.round(v * 100) / 100;
  function copy(text, notify) {
    const done = () => notify && toast('Подборка скопирована. Отправьте её нам в любом мессенджере');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  const STYLES = window.STYLES || [], SIZES = window.SIZES || [];
  const sizeKey = t => `${Math.min(t.w, t.h)}x${Math.max(t.w, t.h)}`;
  const sizeTitle = t => `${Math.min(t.w, t.h)}×${Math.max(t.w, t.h)}`;
  const USE = { wall: 'стены', floor: 'пол', plinth: 'цоколь', outdoor: 'улица' };
  function cardHTML(t) {
    return `<article class="card">
      <div class="card-img"><canvas data-card="${esc(t.id)}" width="400" height="500"></canvas>
        ${t.isNew ? '<span class="badge new">Новинка</span>' : ''}${t.inStock ? '' : '<span class="badge">Под заказ</span>'}
        <span class="card-size">${sizeTitle(t)} см</span></div>
      <div class="card-body">
        <h3>${esc(t.name)}</h3>
        <p class="meta">${esc(t.finish || '')}${t.country ? ' · ' + esc(t.country) : ''} · ${t.use.map(u => USE[u]).filter(Boolean).join(', ')}</p>
        <div class="price">${money(t.price)}<small>/м²</small>${S.usdRate ? `<span class="usd">${usd(t.price)} за м² · ${t.box} м² в коробке</span>` : ''}</div>
        <div class="card-foot"><button class="btn btn-sm" data-try="${esc(t.id)}">Примерить в 3D</button><button class="btn btn-sm btn-ghost" data-buy="${esc(t.id)}" aria-label="В корзину">＋</button></div>
      </div></article>`;
  }
  let io = null;
  function paintLazy(root) {
    if (!io && 'IntersectionObserver' in window) io = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { paintCard(x.target); io.unobserve(x.target); } }), { rootMargin: '300px' });
    $$('canvas[data-card]', root).forEach(cv => io ? io.observe(cv) : paintCard(cv));
  }
  function fillGrid(el, list) { el.innerHTML = list.map(cardHTML).join('') || '<p class="muted">Скоро здесь появятся новые поставки.</p>'; paintLazy(el); }
  function paintCard(cv) {
    const t = byId(cv.dataset.card); if (!t) return;
    // карточка 4:5 — одна плита крупным планом, формат подписан на бейдже
    cv.getContext('2d').drawImage(T.swatch(t, cv.width, cv.height, { across: 0.92 }), 0, 0);
  }

  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
  function newList() {
    const n = CAT.filter(t => t.isNew);
    return n.length ? n : CAT.slice(0, 8);
  }
  document.addEventListener('click', e => {
    const tr = e.target.closest('[data-try]'), by = e.target.closest('[data-buy]');
    if (tr) { const t = byId(tr.dataset.try); if (t) K.tryTile(t); }
    if (by) {
      const t = byId(by.dataset.buy); if (!t) return;
      K.Cart.add(t.id, 1, 'из каталога');
      toast(`«${t.name}»: 1 коробка (${t.box} м²) в корзине`);
    }
  });

  // ---------------- данные магазина ----------------
  function fillShop() {
    $$('[data-shop]').forEach(el => { el.textContent = S[el.dataset.shop] || ''; });
    $$('[data-shop-tel]').forEach(el => { el.href = 'tel:+' + S.phoneRaw; });
    $$('[data-shop-tg]').forEach(el => { el.href = 'https://t.me/' + S.telegram; });
    $$('[data-shop-wa]').forEach(el => { el.href = 'https://wa.me/' + S.phoneRaw; });
    $$('[data-shop-map]').forEach(el => { el.href = S.mapUrl || '#/contacts'; });
    $$('[data-hold]').forEach(el => { el.textContent = S.holdDays; });
    $$('[data-delivery]').forEach(el => { el.textContent = S.deliveryNote || ''; });
    $$('[data-years]').forEach(el => { el.textContent = (+S.years || 20) + '+'; });
    $('#year').textContent = new Date().getFullYear();
  }

  Object.assign(K, { byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList, fillShop });
})();
