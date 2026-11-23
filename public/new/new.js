// Новинки: товары с отметкой «Новинка».
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  K.pages.new = { enter() { fillGrid($('#newGrid'), newList()); } };

})();
