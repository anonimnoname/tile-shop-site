// Корзина и оформление заказа (для клиентов из-за границы — телефон заказчика и получателя).
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  // ---------------- корзина и заказ ----------------
  const Cart = (() => {
    let data = { items: [], links: [] };
    try { const d = JSON.parse(localStorage.getItem('tile-cart')); if (d && Array.isArray(d.items)) data = d; } catch (e) { /* ignore */ }
    const persist = () => { try { localStorage.setItem('tile-cart', JSON.stringify(data)); } catch (e) { /* ignore */ } render(); };
    const drawer = $('#cart'), list = $('#cartList');
    function lines() { return data.items.map(it => ({ it, t: byId(it.id) })).filter(x => x.t); }
    function total() { return lines().reduce((a, { it, t }) => a + it.boxes * t.box * t.price, 0); }
    function render() {
      const L = lines(), count = L.reduce((a, x) => a + x.it.boxes, 0);
      $('#cartCount').textContent = count; $('#cartCount').hidden = !count;
      if (!L.length) {
        list.innerHTML = '<p class="empty">Корзина пуста. Подберите плитку в конструкторе и нажмите «Добавить в корзину» или добавьте товар из каталога.</p>';
      } else {
        list.innerHTML = L.map(({ it, t }, i) => `<div class="cl">
          <canvas data-cl="${t.id}" width="96" height="96"></canvas>
          <div class="cl-info"><b>${esc(t.name)}</b><small>${t.w}×${t.h} см · ${esc(it.note || '')}</small>
            <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Меньше">−</button><input data-qi="${i}" inputmode="numeric" value="${it.boxes}" aria-label="Коробок"><button data-q="${i}" data-d="1" aria-label="Больше">+</button><span>кор. · ${(it.boxes * t.box).toFixed(2)} м²</span></div></div>
          <div class="cl-sum">${money(it.boxes * t.box * t.price)}<button class="cl-del" data-del="${i}" aria-label="Удалить">Удалить</button></div></div>`).join('');
        $$('canvas[data-cl]', list).forEach(cv => cv.getContext('2d').drawImage(T.swatch(byId(cv.dataset.cl), 96, 96, { across: 2 }), 0, 0));
      }
      const tt = total();
      $('#cartTotal').innerHTML = `${money(tt)} <small>${usd(tt)}</small>`;
      $('#checkout').hidden = !L.length;
    }
    list.addEventListener('click', e => {
      const q = e.target.closest('[data-q]'), d = e.target.closest('[data-del]');
      const L = lines();
      if (q) { const it = L[+q.dataset.q].it; it.boxes = Math.max(1, it.boxes + +q.dataset.d); persist(); }
      if (d) { const it = L[+d.dataset.del].it; data.items.splice(data.items.indexOf(it), 1); persist(); }
    });
    list.addEventListener('change', e => {
      const i = e.target.dataset.qi; if (i == null) return;
      const it = lines()[+i].it; it.boxes = Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)); persist();
    });
    $('#cartBtn').addEventListener('click', () => open());
    $('#cartClose').addEventListener('click', () => close());
    drawer.addEventListener('click', e => { if (e.target === drawer) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.hidden) close(); });
    function open() { drawer.hidden = false; document.body.classList.add('noscroll'); $('#orderDone').hidden = true; $('#cartBody').hidden = false; render(); }
    function close() { drawer.hidden = true; document.body.classList.remove('noscroll'); }
    return {
      add(id, boxes, note) {
        const ex = data.items.find(x => x.id === id && x.note === note);
        if (ex) ex.boxes += boxes; else data.items.push({ id, boxes, note });
        persist();
      },
      addLink(l) { if (!data.links.includes(l)) data.links.push(l); data.links = data.links.slice(-10); persist(); },
      clear() { data = { items: [], links: [] }; persist(); },
      get: () => data, lines, total, open, render
    };
  })();

  const PHONE = v => { const s = String(v || '').replace(/[\s()\-.]/g, ''); return /^\+[1-9]\d{7,14}$/.test(s) ? s : null; };
  $('#checkout').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, v = n => f.elements[n].value.trim();
    const err = $('#coError'); err.textContent = '';
    const cPhone = PHONE(v('cPhone')), rPhone = PHONE(v('rPhone'));
    const bad = (name, msg) => { err.textContent = msg; f.elements[name].focus(); };
    if (!v('cName')) return bad('cName', 'Укажите ваше имя');
    if (!cPhone) return bad('cPhone', 'Телефон нужен с кодом страны: +1…, +7…, +44…, +49…, +998…');
    if (!v('rName')) return bad('rName', 'Укажите, кто примет заказ');
    if (!rPhone) return bad('rPhone', 'Телефон получателя с кодом страны, например +998 90 123 45 67');
    if (!v('city') || !v('street')) return bad(v('city') ? 'street' : 'city', 'Укажите адрес доставки');
    const d = Cart.get();
    const body = {
      customer: { name: v('cName'), phone: cPhone, contact: f.elements.contact.value },
      recipient: { name: v('rName'), phone: rPhone },
      address: { city: v('city'), street: v('street') },
      comment: v('comment'), website: v('website'),
      items: d.items.map(i => ({ id: i.id, boxes: i.boxes, note: i.note })), links: d.links
    };
    const btn = $('#coSubmit'); btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
      if (!/^https?:/.test(location.protocol)) throw new Error('offline');
      const r = await fetch('api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = j.error || 'Не получилось отправить заказ. Попробуйте ещё раз или напишите нам.'; return; }
      orderDone(j.id, cPhone);
    } catch (ex) {
      // сервера нет (сайт открыт как файл) — отправляем заказ в WhatsApp
      const text = ['Заказ с сайта', `Заказчик: ${body.customer.name}, ${cPhone} (${body.customer.contact})`, `Получатель: ${body.recipient.name}, ${rPhone}`,
        `Адрес: ${body.address.city}, ${body.address.street}`, ...Cart.lines().map(({ it, t }) => `• ${t.name} ${t.w}×${t.h}: ${it.boxes} кор.`),
        `Итого ≈ ${money(Cart.total())}`, body.comment].filter(Boolean).join('\n');
      window.open(`https://wa.me/${S.phoneRaw}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      orderDone(null, cPhone);
    } finally { btn.disabled = false; btn.textContent = 'Оформить заказ'; }
  });
  function orderDone(id, phone) {
    Cart.clear();
    $('#cartBody').hidden = true; $('#orderDone').hidden = false;
    $('#orderNum').textContent = id ? `Заказ №${id} принят` : 'Заказ отправлен';
    $('#orderPhone').textContent = phone;
  }

  K.Cart = Cart;
  K.on('start', () => Cart.render());

})();
