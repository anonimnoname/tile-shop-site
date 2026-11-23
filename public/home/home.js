// Главная: реклама магазина, форматы, стили, новинки, анимации появления.
(function () {
  'use strict';
  const K = window.K;
  const { S, CAT, T, byId, $, $$, fmt, money, usd, esc, r2, toast, copy, plural, sizeKey, sizeTitle, USE, STYLES, SIZES, cardHTML, fillGrid, paintLazy, newList } = K;
  // ---------------- главная ----------------
  function renderHome() {
    $('#yearsNum').dataset.to = +S.years || 20;
    $('#statYears').dataset.to = +S.years || 20;
    $('#statClients').dataset.to = +S.clients || 100000;
    $('#statStyles').dataset.to = STYLES.filter(s => CAT.some(t => t.style === s.id)).length;
    // бегущая строка
    const words = STYLES.map(s => s.title).concat(SIZES.map(z => z.title));
    const run = words.map(w => `<span>${esc(w)}</span>`).join('');
    $('#marquee').innerHTML = run + run;
    // форматы в масштабе с человеком 175 см
    const H = 250 / 175; // px на см
    $('#formatRow').innerHTML = SIZES.map(z => {
      const t = CAT.find(x => sizeKey(x) === `${z.w}x${z.h}`) || CAT[0];
      return `<a class="fmt reveal" href="#/sizes/${z.w}x${z.h}">
        <div class="fmt-vis"><canvas data-fmt="${esc(t.id)}" width="${Math.round(z.w * H)}" height="${Math.round(z.h * H)}" style="width:${Math.round(z.w * H)}px;height:${Math.round(z.h * H)}px"></canvas>
        <svg viewBox="0 0 40 175" style="height:250px" aria-hidden="true"><circle cx="20" cy="12" r="11"/><path d="M8 30h24l4 60-8 2-3 81h-8l-1-60-1 60h-8l-3-81-8-2z"/></svg></div>
        <h3>${z.title}<small>см</small></h3><p>${esc(z.note || '')}</p><span class="link-arrow">Смотреть ${(n => n + ' ' + plural(n, 'модель', 'модели', 'моделей'))(CAT.filter(x => sizeKey(x) === `${z.w}x${z.h}`).length)}</span></a>`;
    }).join('');
    $$('canvas[data-fmt]').forEach(cv => {
      const t = byId(cv.dataset.fmt), z = { w: cv.width, h: cv.height };
      const one = Object.assign({}, t, { w: Math.min(t.w, t.h), h: Math.max(t.w, t.h) });
      cv.getContext('2d').drawImage(T.swatch(one, z.w, z.h, { across: 1 }), 0, 0);
    });
    // стили
    $('#styleGrid').innerHTML = STYLES.map((st, i) => {
      const list = CAT.filter(t => t.style === st.id); if (!list.length) return '';
      return `<a class="style-card reveal" style="--d:${(i % 3) * 0.1}s" href="#/catalog?style=${st.id}"><canvas data-style="${esc(list[0].id)}" width="480" height="600"></canvas>
        <span class="sc-count">${list.length} ${plural(list.length, 'модель', 'модели', 'моделей')}</span>
        <div class="sc-in"><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></div></a>`;
    }).join('');
    $$('canvas[data-style]').forEach(cv => cv.getContext('2d').drawImage(T.swatch(byId(cv.dataset.style), 480, 600, { across: 0.85 }), 0, 0));
    fillGrid($('#newRail'), newList());
    // CTA — большая плита
    const ct = byId('calacatta-gold-60x120') || CAT[0];
    $('#ctaCanvas').getContext('2d').drawImage(T.swatch(ct, 1200, 500, { across: 2.2 }), 0, 0);
    observeReveal();
  }
  function heroNow() {
    const rs = K.ctor.getState().bath, f = byId(rs.floor.tile), w = byId(rs.wall.tile);
    if (!f || !w) return;
    $('#heroNow').innerHTML = `<canvas width="88" height="88"></canvas><div><b>${esc(w.name)} ${sizeTitle(w)}</b>стены · пол: ${esc(f.name)} ${sizeTitle(f)}</div>`;
    $('#heroNow canvas').getContext('2d').drawImage(T.swatch(w, 88, 88, { across: 1.2 }), 0, 0);
  }

  // анимации появления и счётчики
  let revealIO = null;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach(el => el.classList.add('in')); return; }
    revealIO = revealIO || new IntersectionObserver(en => en.forEach(x => {
      if (!x.isIntersecting) return;
      x.target.classList.add('in'); revealIO.unobserve(x.target);
      $$('[data-count]', x.target).concat(x.target.matches('[data-count]') ? [x.target] : []).forEach(countUp);
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('.reveal:not(.in)').forEach(el => revealIO.observe(el));
  }
  function countUp(el) {
    const to = +el.dataset.to || 0, t0 = performance.now(), dur = 1600, suf = el.dataset.suf || '';
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(to * e) + (k >= 1 ? suf : ''); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  K.pages.home = { enter() { observeReveal(); } };
  K.on('start', () => { renderHome(); heroNow(); });
  K.on('bath-drawn', () => heroNow());

})();
