// Каталог: все коллекции, фильтр по стилю и размеру, сортировка.
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  let catStyle = 'all', catSize = 'all', sort = 'popular';
  function renderCatalog() {
    $('#catFilters').innerHTML = [['all', 'Все стили'], ...STYLES.map(s => [s.id, s.title])].map(([k, n]) => `<button class="chip${catStyle === k ? ' on' : ''}" data-cat="${k}">${n}</button>`).join('');
    $('#catSizes').innerHTML = [['all', 'Все размеры'], ...SIZES.map(z => [`${z.w}x${z.h}`, z.title + ' см'])].map(([k, n]) => `<button class="chip${catSize === k ? ' on' : ''}" data-size="${k}">${n}</button>`).join('');
    let list = CAT.filter(t => (catStyle === 'all' || t.style === catStyle) && (catSize === 'all' || sizeKey(t) === catSize));
    if (sort === 'cheap') list = list.slice().sort((a, b) => a.price - b.price);
    if (sort === 'expensive') list = list.slice().sort((a, b) => b.price - a.price);
    $('#catCount').textContent = list.length + ' ' + plural(list.length, 'модель', 'модели', 'моделей');
    fillGrid($('#catalogGrid'), list);
  }
  $('#catFilters').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { catStyle = b.dataset.cat; renderCatalog(); } });
  $('#catSizes').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (b) { catSize = b.dataset.size; renderCatalog(); } });
  $('#catSort').addEventListener('change', e => { sort = e.target.value; renderCatalog(); });
  K.pages.catalog = { enter(r) { const st = r.query.get('style'); if (st) catStyle = st; renderCatalog(); } };

})();
