(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const T = window.Tiles;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/[\s,]/g, ' ');
  let products = [], orders = [], settings = {};

  async function api(path, opts = {}) {
    const r = await fetch('api/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }, opts,
      opts.body && typeof opts.body !== 'string' ? { body: JSON.stringify(opts.body) } : {}));
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== 'login') { showLogin(); throw new Error(j.error || 'Нужно войти'); }
    if (!r.ok) throw new Error(j.error || 'Ошибка ' + r.status);
    return j;
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  // ---------- вход ----------
  function showLogin() { $('#login').hidden = false; $('#app').hidden = true; }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#loginErr').textContent = '';
    try { await api('login', { method: 'POST', body: { password: e.target.password.value } }); e.target.reset(); start(); }
    catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('logout', { method: 'POST' }).catch(() => {}); showLogin(); });

  async function start() {
    try { await api('admin/me'); } catch (e) { return showLogin(); }
    $('#login').hidden = true; $('#app').hidden = false;
    await Promise.all([loadOrders(), loadProducts(), loadSettings()]);
  }

  // ---------- вкладки ----------
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    $$('#tabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
    $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab);
  });

  // ---------- заказы ----------
  const STATUS = { new: 'Новый', confirmed: 'Подтверждён', paid: 'Оплачен', delivering: 'В доставке', done: 'Выполнен', cancelled: 'Отменён' };
  // Сообщение клиенту для подтверждения заказа (с реквизитами из настроек)
  function confirmText(o) {
    const cur = settings.currency || 'сум';
    return [
      `Здравствуйте, ${o.customer.name}! Это ${settings.name || 'магазин'}.`,
      `Вы оформили заказ №${o.id} на сайте:`,
      ...o.items.map(i => `• ${i.name} ${i.size} — ${i.boxes} кор. (${i.m2} м²) — ${fmt(i.sum)} ${cur}`),
      `Итого: ${fmt(o.total)} ${cur}`,
      `Доставка: ${o.address.city}, ${o.address.street}. Получатель: ${o.recipient.name}, ${o.recipient.phone}.`,
      '',
      'Подтверждаете заказ?',
      settings.payCard || settings.payBank ? 'Оплатить можно при получении или переводом:' : 'Оплата при получении.',
      settings.payCard ? `Карта: ${settings.payCard}${settings.payCardHolder ? ' (' + settings.payCardHolder + ')' : ''}` : '',
      settings.payBank ? `Счёт: ${settings.payBank}` : '',
      'После подтверждения сообщим дату доставки.'
    ].filter(x => x !== '').join('\n');
  }
  let oFilter = 'active';
  async function loadOrders() { orders = await api('admin/orders'); renderOrders(); }
  function renderOrders() {
    const n = orders.filter(o => o.status === 'new').length;
    $('#newCount').textContent = n; $('#newCount').hidden = !n;
    const F = [['active', 'Текущие'], ['new', 'Новые'], ['done', 'Выполненные'], ['cancelled', 'Отменённые'], ['all', 'Все']];
    $('#orderFilter').innerHTML = F.map(([k, l]) => `<button class="chip${oFilter === k ? ' on' : ''}" data-of="${k}">${l}</button>`).join('');
    const list = orders.filter(o => oFilter === 'all' ? true : oFilter === 'active' ? !['done', 'cancelled'].includes(o.status) : o.status === oFilter);
    const tel = p => `<a href="tel:${esc(p)}">${esc(p)}</a> · <a href="https://wa.me/${esc(p.replace('+', ''))}" target="_blank" rel="noopener">WhatsApp</a>`;
    $('#orders').innerHTML = list.length ? list.map(o => `
      <article class="o-card st-${o.status}">
        <div class="o-top">
          <b>№${o.id}</b><span class="muted">${new Date(o.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <select data-ost="${o.id}" aria-label="Статус">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${o.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="o-grid">
          <div><small>Заказчик (подтвердить по этому номеру)</small><b>${esc(o.customer.name)}</b><div>${tel(o.customer.phone)}</div><div class="muted">Связь: ${esc(o.customer.contact || 'любая')}</div></div>
          <div><small>Получатель, оплата при доставке</small><b>${esc(o.recipient.name)}</b><div>${tel(o.recipient.phone)}</div><div>${esc(o.address.city)}, ${esc(o.address.street)}</div></div>
        </div>
        <table class="o-items">${o.items.map(i => `<tr><td>${esc(i.name)} <span class="muted">${esc(i.size)}${i.note ? ' · ' + esc(i.note) : ''}</span></td><td>${i.boxes} кор.</td><td>${i.m2} м²</td><td>${fmt(i.sum)}</td></tr>`).join('')}
          <tr class="o-total"><td colspan="3">Итого</td><td>${fmt(o.total)} ${esc(settings.currency || '')}</td></tr></table>
        ${o.comment ? `<p class="o-comment">💬 ${esc(o.comment)}</p>` : ''}
        <div class="o-acts">
          <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="https://wa.me/${esc(o.customer.phone.replace('+', ''))}?text=${encodeURIComponent(confirmText(o))}">Подтвердить в WhatsApp</a>
          <button class="btn btn-sm" data-otg="${o.id}">Подтвердить в Telegram</button>
          <button class="btn btn-sm btn-ghost" data-ocopy="${o.id}">Скопировать сообщение</button>
        </div>
        ${o.links && o.links.length ? `<p class="o-links">${o.links.map((l, i) => `<a href="${esc(l)}" target="_blank" rel="noopener">Открыть подборку ${o.links.length > 1 ? i + 1 : ''} в конструкторе</a>`).join(' · ')}</p>` : ''}
        <label class="o-note">Заметка (видно только вам)<textarea data-onote="${o.id}" rows="1">${esc(o.adminNote || '')}</textarea></label>
      </article>`).join('') : '<p class="muted">Заказов нет.</p>';
  }
  $('#orderFilter').addEventListener('click', e => { const b = e.target.closest('[data-of]'); if (b) { oFilter = b.dataset.of; renderOrders(); } });
  $('#orders').addEventListener('click', async e => {
    const tg = e.target.closest('[data-otg]'), cp = e.target.closest('[data-ocopy]');
    const id = tg ? +tg.dataset.otg : cp ? +cp.dataset.ocopy : 0; if (!id) return;
    const o = orders.find(x => x.id === id), text = confirmText(o);
    try { await navigator.clipboard.writeText(text); } catch (err) { /* без буфера обмена */ }
    if (tg) { window.open('https://t.me/' + o.customer.phone, '_blank', 'noopener'); toast('Сообщение скопировано — вставьте его в чат (Ctrl+V)'); }
    else toast('Сообщение скопировано');
  });
  $('#orders').addEventListener('change', async e => {
    const s = e.target.dataset.ost, n = e.target.dataset.onote;
    try {
      if (s) { const o = await api('admin/orders/' + s, { method: 'PATCH', body: { status: e.target.value } }); Object.assign(orders.find(x => x.id === o.id), o); renderOrders(); toast('Статус обновлён'); }
      if (n) { await api('admin/orders/' + n, { method: 'PATCH', body: { adminNote: e.target.value } }); orders.find(x => x.id === +n).adminNote = e.target.value; toast('Заметка сохранена'); }
    } catch (err) { toast(err.message); }
  });
  setInterval(() => { if (!$('#app').hidden && document.visibilityState === 'visible') loadOrders().catch(() => {}); }, 60000);

  // ---------- товары ----------
  async function loadProducts() { products = await api('admin/products'); renderProducts(); }
  function renderProducts() {
    const q = $('#pSearch').value.trim().toLowerCase();
    const list = products.filter(p => !q || (p.name + ' ' + (p.collection || '')).toLowerCase().includes(q));
    $('#products').innerHTML = list.map(p => `
      <div class="p-row${p.active === false ? ' hidden-p' : ''}" data-id="${esc(p.id)}">
        <canvas data-sw="${esc(p.id)}" width="112" height="112"></canvas>
        <div class="p-name"><b>${esc(p.name)}${p.isNew ? ' <span class="pill">новинка</span>' : ''}</b><small>${p.w}×${p.h} см · ${p.box} м²/кор.${T.faces(p).length ? ` · 📷 ${T.faces(p).length} узор.` : ''}</small></div>
        <label class="p-price">Цена/м²<input type="number" step="100" min="0" value="${p.price}" data-price></label>
        <label class="check"><input type="checkbox" data-stock ${p.inStock ? 'checked' : ''}> В наличии</label>
        <label class="check"><input type="checkbox" data-active ${p.active !== false ? 'checked' : ''}> На сайте</label>
        <div class="p-acts"><button class="chip" data-edit>Изменить</button><button class="chip" data-copy>Копия</button><button class="chip danger" data-del>Удалить</button></div>
      </div>`).join('') || '<p class="muted">Ничего не найдено.</p>';
    $$('canvas[data-sw]').forEach(cv => {
      const p = products.find(x => x.id === cv.dataset.sw);
      cv.getContext('2d').drawImage(T.swatch(p, 112, 112, { across: p.w < 15 ? 4 : 2 }), 0, 0);
    });
  }
  T.setOnImageLoad(() => { renderProducts(); drawPreview(); });
  $('#pSearch').addEventListener('input', renderProducts);
  $('#products').addEventListener('change', async e => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const id = row.dataset.id, body = {};
    if ('price' in e.target.dataset) body.price = +e.target.value;
    if ('stock' in e.target.dataset) body.inStock = e.target.checked;
    if ('active' in e.target.dataset) body.active = e.target.checked;
    try {
      const p = await api('admin/products/' + encodeURIComponent(id), { method: 'PATCH', body });
      Object.assign(products.find(x => x.id === id), p);
      row.classList.toggle('hidden-p', p.active === false);
      toast('Сохранено');
    } catch (err) { toast(err.message); }
  });
  $('#products').addEventListener('click', async e => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    const p = products.find(x => x.id === row.dataset.id);
    if (e.target.closest('[data-edit]')) openEdit(p);
    if (e.target.closest('[data-copy]')) openEdit(Object.assign({}, p, { id: null, name: p.name + ' (копия)' }));
    if (e.target.closest('[data-del]')) {
      if (!confirm(`Удалить «${p.name}» навсегда? Если товар просто закончился, лучше снимите «В наличии» или «На сайте».`)) return;
      try { await api('admin/products/' + encodeURIComponent(p.id), { method: 'DELETE' }); products = products.filter(x => x !== p); renderProducts(); toast('Удалено'); }
      catch (err) { toast(err.message); }
    }
  });

  // ---------- форма товара ----------
  const drawer = $('#pEdit'), form = $('#pForm');
  let editing = null, images = [], lookDirty = false;
  function materialFrom(type, c1, c2, gloss) { // то же, что на сервере
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
  const hex6 = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
  function openEdit(p) {
    editing = p; images = p ? T.faces(p).slice() : []; lookDirty = !p || !p.id;
    form.reset(); $('#pErr').textContent = '';
    $('#pEditTitle').textContent = p && p.id ? 'Изменить товар' : 'Новый товар';
    const f = form.elements, d = p || { w: 60, h: 120, box: 1.44, use: ['floor', 'wall'], cats: ['universal'], inStock: true, active: true, isNew: true };
    for (const k of ['name', 'box', 'price', 'collection', 'country', 'finish']) f[k].value = d[k] != null ? d[k] : '';
    const sk = `${Math.min(d.w, d.h)}x${Math.max(d.w, d.h)}`;
    f.size.value = ['60x120', '75x150', '80x135'].includes(sk) ? sk : '60x120';
    f.style.value = d.style || 'marble';
    f.isNew.checked = !!d.isNew;
    f.defaultLayout.value = d.defaultLayout || '';
    $$('input[name=use]', form).forEach(c => c.checked = (d.use || []).includes(c.value));
    $$('input[name=cats]', form).forEach(c => c.checked = (d.cats || []).includes(c.value));
    f.inStock.checked = d.inStock !== false; f.active.checked = d.active !== false;
    const m = d.material || {};
    f.mType.value = m.type || 'solid';
    f.c1.value = hex6(m.c1) || hex6(m.base) || hex6(m.color) || hex6(m.bg) || hex6(m.colors && m.colors[0]) || '#cccccc';
    f.c2.value = hex6(m.c2) || hex6(m.vein) || hex6(m.grain) || hex6(m.line) || hex6(m.fg) || hex6(m.colors && m.colors[1]) || '#888888';
    f.gloss.value = m.gloss != null ? m.gloss : 0.3; $('#glossVal').textContent = f.gloss.value;
    drawer.hidden = false; document.body.classList.add('noscroll');
    drawPreview();
  }
  function closeEdit() { drawer.hidden = true; document.body.classList.remove('noscroll'); }
  $('#pAdd').addEventListener('click', () => openEdit(null));
  drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('[data-close]')) closeEdit(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.hidden) closeEdit(); });

  function formTile() {
    const f = form.elements;
    const material = lookDirty || !editing ? materialFrom(f.mType.value, f.c1.value, f.c2.value, +f.gloss.value) : editing.material;
    return {
      id: (editing && editing.id) || 'preview', name: f.name.value.trim(),
      w: +f.size.value.split('x')[0], h: +f.size.value.split('x')[1], box: +f.box.value, price: +f.price.value,
      style: f.style.value, isNew: f.isNew.checked,
      collection: f.collection.value.trim(), country: f.country.value.trim(), finish: f.finish.value.trim(),
      defaultLayout: f.defaultLayout.value || undefined,
      use: $$('input[name=use]:checked', form).map(c => c.value), cats: $$('input[name=cats]:checked', form).map(c => c.value),
      inStock: f.inStock.checked, active: f.active.checked, images: images.slice(), image: images[0], material
    };
  }
  let prevT;
  function drawPreview() {
    if (drawer.hidden) return;
    clearTimeout(prevT);
    prevT = setTimeout(() => {
      const t = formTile(); t.id = 'prev-' + Math.random(); // без кэша
      const c = $('#pPrev').getContext('2d'); c.clearRect(0, 0, 320, 240);
      c.drawImage(T.swatch(t, 320, 240, { across: 2.6, layout: t.defaultLayout || 'straight' }), 0, 0);
      T.clearCache();
    }, 80);
    $('#pFaces').innerHTML = images.map((u, i) => `<span class="face"><img src="${esc(u)}" alt=""><button type="button" data-rmface="${i}" aria-label="Убрать узор">✕</button></span>`).join('');
    $('#lookBox').classList.toggle('dim', images.length > 0);
  }
  form.addEventListener('input', e => {
    if (['mType', 'c1', 'c2', 'gloss'].includes(e.target.name)) lookDirty = true;
    if (e.target.name === 'gloss') $('#glossVal').textContent = e.target.value;
    drawPreview();
  });
  form.addEventListener('change', drawPreview);

  // фото: обрезаем по пропорциям плитки и уменьшаем до 1024 px
  $('#pFile').addEventListener('change', async e => {
    const files = Array.from(e.target.files); e.target.value = '';
    for (const [n, file] of files.entries()) {
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не удалось открыть фото')); i.src = URL.createObjectURL(file); });
      const f = form.elements, [sw0, sh0] = f.size.value.split('x').map(Number), ar = sw0 / sh0;
      let sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
      const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
      const k = Math.min(1, 1024 / Math.max(sw, sh));
      const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      toast(`Загружаем узор ${n + 1} из ${files.length}…`);
      const r = await api('admin/upload', { method: 'POST', body: { dataUrl: c.toDataURL('image/jpeg', 0.88) } });
      images.push(r.url); drawPreview();
    } catch (err) { toast(err.message); }
    }
    if (files.length) toast(`Узоров у модели: ${images.length}`);
  });
  $('#pFaces').addEventListener('click', e => {
    const b = e.target.closest('[data-rmface]'); if (!b) return;
    images.splice(+b.dataset.rmface, 1); drawPreview();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault(); $('#pErr').textContent = '';
    const t = formTile();
    if (!t.name) return ($('#pErr').textContent = 'Укажите название');
    if (!(t.price >= 0) || form.elements.price.value === '') return ($('#pErr').textContent = 'Укажите цену');
    if (!t.use.length) return ($('#pErr').textContent = 'Отметьте, где можно класть плитку');
    const body = Object.assign({}, t, { images: images.slice(), image: images[0] || '' });
    if (lookDirty || !editing || !editing.id) body.material = { type: form.elements.mType.value, c1: form.elements.c1.value, c2: form.elements.c2.value, gloss: +form.elements.gloss.value };
    else delete body.material;
    delete body.id;
    $('#pSave').disabled = true;
    try {
      if (editing && editing.id) {
        const p = await api('admin/products/' + encodeURIComponent(editing.id), { method: 'PUT', body });
        Object.assign(products.find(x => x.id === p.id), p);
      } else {
        const p = await api('admin/products', { method: 'POST', body });
        products.unshift(p);
      }
      T.clearCache(); renderProducts(); closeEdit(); toast('Товар сохранён');
    } catch (err) { $('#pErr').textContent = err.message; }
    finally { $('#pSave').disabled = false; }
  });

  // ---------- настройки ----------
  const SET_KEYS = ['name', 'tagline', 'phone', 'phoneRaw', 'telegram', 'hours', 'address', 'mapUrl', 'currency', 'usdRate', 'deliveryNote', 'years', 'clients', 'payCard', 'payCardHolder', 'payBank'];
  async function loadSettings() {
    settings = await api('admin/settings');
    const f = $('#settingsForm').elements;
    for (const k of SET_KEYS) if (f[k]) f[k].value = settings[k] != null ? settings[k] : '';
  }
  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements, body = {};
    for (const k of SET_KEYS) body[k] = f[k].value;
    try { settings = await api('admin/settings', { method: 'PUT', body }); $('#setSaved').hidden = false; setTimeout(() => $('#setSaved').hidden = true, 2500); }
    catch (err) { toast(err.message); }
  });
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#pwErr').textContent = '';
    try { await api('admin/password', { method: 'POST', body: { current: e.target.current.value, next: e.target.next.value } }); e.target.reset(); toast('Пароль изменён. Войдите заново'); showLogin(); }
    catch (err) { $('#pwErr').textContent = err.message; }
  });

  // ---------- push-уведомления ----------
  const pushBtn = $('#pushBtn');
  const b64ToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(s + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  async function pushState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { pushBtn.textContent = '🔕 Браузер без уведомлений'; pushBtn.disabled = true; return null; }
    if (!window.isSecureContext) { pushBtn.textContent = '🔕 Нужен HTTPS'; pushBtn.title = 'Уведомления работают только на сайте с https://'; return null; }
    const reg = await navigator.serviceWorker.register('admin-sw.js');
    const sub = await reg.pushManager.getSubscription();
    pushBtn.textContent = sub && Notification.permission === 'granted' ? '🔔 Уведомления включены' : '🔔 Включить уведомления';
    pushBtn.classList.toggle('btn-wa', !!sub);
    return { reg, sub };
  }
  pushBtn.addEventListener('click', async () => {
    try {
      const st = await pushState(); if (!st) return;
      if (st.sub && Notification.permission === 'granted') {
        const r = await api('admin/push/test', { method: 'POST' });
        toast(r.sent ? 'Отправили тестовое уведомление' : 'Не удалось отправить. Попробуйте включить заново');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return toast('Разрешите уведомления для этого сайта в настройках браузера');
      const { publicKey } = await api('admin/push/key');
      const sub = await st.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      await api('admin/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), device: navigator.userAgent.slice(0, 120) } });
      await pushState();
      await api('admin/push/test', { method: 'POST' });
      toast('Готово: новые заказы будут приходить уведомлением на этот компьютер');
    } catch (err) { toast(err.message); }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'refresh-orders') loadOrders().catch(() => {}); });

  start().then(() => pushState()).catch(() => {});
})();
