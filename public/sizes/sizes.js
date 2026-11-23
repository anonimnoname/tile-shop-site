// Размеры: 60×120, 75×150, 80×135 и товары каждого формата.
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  function renderSizes(key) {
    const cur = SIZES.find(z => `${z.w}x${z.h}` === key) || SIZES[0];
    if (!cur) return;
    const k = `${cur.w}x${cur.h}`;
    $('#sizeTabs').innerHTML = SIZES.map(z => {
      const kk = `${z.w}x${z.h}`, n = CAT.filter(t => sizeKey(t) === kk).length;
      return `<a class="size-tab${kk === k ? ' on' : ''}" href="#/sizes/${kk}" role="tab" aria-selected="${kk === k}">
        <span class="st-box"><i style="width:${z.w / 3.2}px;height:${z.h / 2.2}px"></i></span>
        <span><b>${z.title}</b><small>${n} ${plural(n, 'модель', 'модели', 'моделей')}</small></span></a>`;
    }).join('');
    $('#sizeNote').textContent = cur.note || '';
    fillGrid($('#sizeGrid'), CAT.filter(t => sizeKey(t) === k));
  }

  K.pages.sizes = { enter(r) { renderSizes(r.param); } };

})();
