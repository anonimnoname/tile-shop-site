// Сборка страницы из частей: каждая часть сайта лежит в своей папке
// (nav, home, constructor, new, sizes, catalog, contacts, cart).
// 1) подставляет HTML частей, 2) загружает каталог и настройки, 3) запускает скрипты по порядку.
(function () {
  'use strict';
  const SCRIPTS = [
    'shared/textures.js',
    'shared/vendor/three.bundle.js',
    'constructor/plan.js',
    'constructor/scene3d.js',
    'shared/core.js',
    'cart/cart.js',
    'constructor/constructor.js',
    'catalog/catalog.js',
    'new/new.js',
    'sizes/sizes.js',
    'home/home.js',
    'contacts/contacts.js',
    'nav/nav.js',
    'shared/i18n.js'
  ];
  const get = (url, type) => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return type === 'json' ? r.json() : r.text(); });

  async function loadParts() {
    const holders = Array.from(document.querySelectorAll('[data-part]'));
    const html = await Promise.all(holders.map(h => get(h.dataset.part)));
    holders.forEach((h, i) => { h.outerHTML = html[i]; });
  }

  // Каталог и настройки: с сервера (админка), иначе из shared/data
  async function loadData() {
    const [base, shop] = await Promise.all([get('shared/data/products.json', 'json'), get('shared/data/shop.json', 'json')]);
    window.SIZES = base.sizes; window.STYLES = base.styles; window.CATALOG = base.products; window.SHOP = shop;
    try {
      const j = await get('api/catalog', 'json');
      if (Array.isArray(j.products) && j.products.length) window.CATALOG = j.products;
      if (j.settings) for (const [k, v] of Object.entries(j.settings)) if (v != null && v !== '') shop[k] = v;
    } catch (e) { /* без сервера — каталог-пример из shared/data */ }
  }

  function loadScripts() {
    return new Promise((resolve, reject) => {
      let left = SCRIPTS.length;
      for (const src of SCRIPTS) {
        const s = document.createElement('script');
        s.src = src; s.async = false; // выполняются строго по порядку
        s.onload = () => { if (--left === 0) resolve(); };
        s.onerror = () => reject(new Error('Не загрузился ' + src));
        document.body.appendChild(s);
      }
    });
  }

  Promise.all([loadParts(), loadData()])
    .then(loadScripts)
    .then(() => window.K.start())
    .catch(err => {
      console.error(err);
      document.body.insertAdjacentHTML('beforeend', '<p style="padding:24px;font:16px sans-serif">Не удалось загрузить сайт. Обновите страницу.</p>');
    });
})();
