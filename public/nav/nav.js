// Навигация: шапка, меню «☰», переходы между страницами, запуск сайта.
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  // ---------------- меню ----------------
  const burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.setAttribute('aria-hidden', !open);
    if ('inert' in menu) menu.inert = !open;
  }
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  setMenu(false);

  // шапка: прозрачная над героем, прячется при прокрутке вниз
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    document.body.classList.toggle('at-top', y < 40);
    lastY = y;
  }, { passive: true });

  // ---------------- маршруты ----------------
  const PAGES = ['home', 'constructor', 'new', 'sizes', 'catalog', 'contacts'];
  const APP = K.APP;
  let curPage = null;
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, query] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    let page = parts[0] || (APP ? 'constructor' : 'home');
    if (h.includes('cfg=')) page = 'constructor';
    if (!PAGES.includes(page)) page = 'home';
    return { page, param: parts[1], query: new URLSearchParams(query || '') };
  }
  function route() {
    const r = parseRoute();
    const go = () => {
      $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === r.page));
      document.body.classList.toggle('on-hero', r.page === 'home');
      $$('.menu-list a').forEach(a => a.classList.toggle('cur', (a.getAttribute('href').replace(/^#\/?/, '') || 'home') === r.page));
      K.page = r.page;
      const pg = K.pages[r.page]; if (pg && pg.enter) pg.enter(r);
      K.emit('route', r.page);
      if (curPage !== r.page) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      curPage = r.page;
      const titles = { home: '', constructor: '3D-конструктор', new: 'Новинки', sizes: 'Размеры', catalog: 'Каталог', contacts: 'Контакты' };
      document.title = (titles[r.page] ? titles[r.page] + ' — ' : '') + (S.name || '') + ' · крупноформатный керамогранит';
    };
    if (curPage && curPage !== r.page && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go);
    else go();
  }
  window.addEventListener('hashchange', route);
  $('#menuSizes').innerHTML = SIZES.map(z => `<a href="#/sizes/${z.w}x${z.h}">${z.title}</a>`).join('');

  K.start = () => { K.fillShop(); K.emit('start'); route(); };

})();
