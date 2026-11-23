// План помещения: геометрия многоугольника, готовые формы, редактор и точный подсчёт плитки.
(function () {
  'use strict';

  // ---------- геометрия ----------
  function area(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    return a / 2; // знак = направление обхода
  }
  function perimeter(poly) {
    let p = 0;
    for (let i = 0; i < poly.length; i++) p += dist(poly[i], poly[(i + 1) % poly.length]);
    return p;
  }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function bbox(poly) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // Пересечение произвольного многоугольника subject с выпуклым clip (Сазерленд — Ходжмен)
  function clipConvex(subject, clip) {
    let out = subject;
    const ccw = area(clip) > 0;
    for (let i = 0; i < clip.length && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const side = p => { const v = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); return ccw ? v : -v; };
      const input = out; out = [];
      for (let j = 0; j < input.length; j++) {
        const p = input[j], q = input[(j + 1) % input.length];
        const sp = side(p), sq = side(q);
        if (sp >= 0) out.push(p);
        if ((sp >= 0) !== (sq >= 0)) {
          const t = sp / (sp - sq);
          out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
    }
    return out;
  }
  // Внутренние нормали стен и прочие данные по рёбрам
  function edges(poly) {
    return poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const len = dist(a, b), dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len;
      let n = [-dy, dx];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!inside([mid[0] + n[0] * 0.02, mid[1] + n[1] * 0.02], poly)) n = [dy, -dx];
      return { i, a, b, len, dir: [dx, dy], n, mid, kind: KINDS[a[2] || 0] || 'wall' };
    });
  }

  const KINDS = ['wall', 'open', 'door'];
  const snap = v => Math.round(v * 20) / 20; // 5 см
  const withFlag = (x, y, f) => f ? [x, y, f] : [x, y];

  // ---------- готовые формы ----------
  const SHAPES = {
    rect: { name: 'Прямоугольник', make: (W, D) => [[0, 0], [W, 0], [W, D], [0, D]] },
    corner: { name: 'Короб в углу', make: (W, D) => [[0, 0], [W, 0], [W, D], [0.45, D], [0.45, D - 0.35], [0, D - 0.35]] },
    bevel: { name: 'Скошенный угол', make: (W, D) => [[0, 0], [W - 0.9, 0], [W, 0.9], [W, D], [0, D]] },
    niche: { name: 'С нишей', make: (W, D) => [[0, 0], [W, 0], [W, D], [W * 0.7, D], [W * 0.7, D + 0.6], [W * 0.3, D + 0.6], [W * 0.3, D], [0, D]] },
    L: { name: 'Г-образная', make: (W, D) => [[0, 0], [W, 0], [W, D * 0.55], [W * 0.55, D * 0.55], [W * 0.55, D], [0, D]] },
    // комната + коридор без двери между ними; дверь — в конце коридора
    corridor: { name: 'Комната + коридор', defaults: [3, 6], make: (W, D) => {
      const cl = Math.max(1, Math.min(3, D - 2)), rd = D - cl, cw = Math.min(1.5, W * 0.6);
      const x0 = snap(W / 2 - cw / 2), x1 = snap(W / 2 + cw / 2);
      return [[0, 0], [W, 0], [W, rd], [x1, rd], [x1, D, 2], [x0, D], [x0, rd], [0, rd]];
    } }
  };
  const SHAPE_ICONS = {
    rect: 'M3 3h18v18H3z', corner: 'M3 3h18v18H8v-5H3z', bevel: 'M3 3h13l5 5v13H3z',
    niche: 'M3 3h18v14h-5v4H8v-4H3z', L: 'M3 3h18v9h-8v9H3z', corridor: 'M3 3h18v10h-6v8H9v-8H3z'
  };

  // ---------- подсчёт плитки по раскладке ----------
  // poly в метрах. Возвращает целые, подрезные, узкие обрезки и список плиток для рисования.
  function countTiles(poly, o) {
    const PPM = 100; // 1 px = 1 см
    const bb = bbox(poly);
    const region = { x: 0, y: 0, w: bb.w * PPM, h: bb.h * PPM };
    const P = poly.map(([x, y]) => [(x - bb.x) * PPM, (y - bb.y) * PPM]);
    const tiles = window.Tiles.layoutTiles(region, Object.assign({}, o, { ppm: PPM, anchor: 'center' }));
    let full = 0, cut = 0, slivers = 0, used = 0;
    const list = [], parts = [];
    for (const t of tiles) {
      const corners = window.Tiles.tileCorners(t);
      const ta = t.w * t.h;
      const inter = Math.abs(area(clipConvex(P, corners)));
      const f = inter / ta;
      if (f < 0.003) continue;
      if (f > 0.997) { full++; list.push([corners, 1]); }
      else { cut++; parts.push(f); list.push([corners, f]); if (f < 0.2) slivers++; }
      used += inter;
    }
    // Обрезки: несколько маленьких кусков режут из одной плитки (как делает плиточник).
    // Упаковка «первый подходящий» по площади с запасом 15% на форму кусков и пропил.
    const bins = [];
    parts.sort((a, b) => b - a).forEach(f => {
      const i = bins.findIndex(v => v + f <= 0.85);
      if (i >= 0) bins[i] += f; else bins.push(f);
    });
    return { full, cut, slivers, cutTiles: bins.length, total: full + bins.length, tiles: list, bb, coverage: used / (PPM * PPM) };
  }

  // Подбор сдвига раскладки: меньше плиток и меньше узких полосок
  function optimize(poly, o) {
    const t = o.tile, step = 9, best = { score: Infinity, ox: 0, oy: 0 };
    const sw = (o.rotate ? t.h : t.w) / 100, sh = (o.rotate ? t.w : t.h) / 100;
    for (let i = 0; i < step; i++) for (let j = 0; j < step; j++) {
      const ox = (i / step - 0.5) * sw, oy = (j / step - 0.5) * sh;
      const r = countTiles(poly, Object.assign({}, o, { offsetX: ox, offsetY: oy }));
      const score = r.total + r.slivers * 0.6 + (Math.abs(ox) + Math.abs(oy)) * 0.01;
      if (score < best.score) Object.assign(best, { score, ox, oy });
    }
    return { ox: Math.round(best.ox * 1000) / 1000, oy: Math.round(best.oy * 1000) / 1000 };
  }

  // ---------- редактор плана (SVG) ----------

  class Editor {
    // host — контейнер; get() → {poly, floorOpts, showTiles}; onChange(poly, final)
    constructor(host, get, onChange) {
      this.host = host; this.get = get; this.onChange = onChange; this.sel = -1;
      host.innerHTML = `<div class="plan-wrap"><svg class="plan" aria-label="План пола"></svg><input class="edge-input" type="number" step="0.05" min="0.2" inputmode="decimal" hidden></div>
        <div class="plan-tools">
          <div class="edge-kind" hidden><span>Эта стена:</span><button class="chip" data-kind="0">Стена</button><button class="chip" data-kind="1">Проём</button><button class="chip" data-kind="2">Дверь</button></div>
          <button class="chip" data-act="del" disabled>Удалить точку</button>
          <span class="plan-hint">Тяните углы · «+» добавит излом · нажмите на размер стены, чтобы задать длину и тип: стена, проём без двери, дверь</span></div>`;
      this.svg = host.querySelector('svg');
      this.input = host.querySelector('.edge-input');
      this.delBtn = host.querySelector('[data-act=del]');
      this.kindBox = host.querySelector('.edge-kind'); this.selEdge = -1;
      this.kindBox.addEventListener('pointerdown', e => e.preventDefault()); // не терять фокус поля длины
      this.kindBox.addEventListener('click', e => {
        const b = e.target.closest('[data-kind]'); if (!b || this.selEdge < 0) return;
        const poly = this.get().poly, v = poly[this.selEdge], k = +b.dataset.kind;
        poly[this.selEdge] = withFlag(v[0], v[1], k);
        if (k === 2) poly.forEach((p, i) => { if (i !== this.selEdge && p[2] === 2) poly[i] = [p[0], p[1]]; }); // одна дверь
        this.input.hidden = true;
        this.onChange(poly, true);
      });
      this._bind();
    }
    _bind() {
      let drag = null;
      this.svg.addEventListener('pointerdown', e => {
        const h = e.target.closest('[data-v]'), add = e.target.closest('[data-add]'), lab = e.target.closest('[data-edge]');
        const poly = this.get().poly;
        if (add) {
          const i = +add.dataset.add, a = poly[i], b = poly[(i + 1) % poly.length];
          poly.splice(i + 1, 0, withFlag(snap((a[0] + b[0]) / 2), snap((a[1] + b[1]) / 2), a[2]));
          this.sel = i + 1; this.onChange(poly, true); return;
        }
        if (lab) { this.sel = -1; this.selEdge = +lab.dataset.edge; this._editEdge(this.selEdge); this.render(this._count); e.preventDefault(); return; }
        this.selEdge = -1;
        if (h) {
          this.sel = +h.dataset.v; drag = { i: this.sel, id: e.pointerId };
          this.svg.setPointerCapture(e.pointerId); this.render(this._count); e.preventDefault();
        } else { this.sel = -1; this.input.hidden = true; this.render(this._count); }
      });
      this.svg.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId) return;
        const p = this._toPlan(e), poly = this.get().poly;
        poly[drag.i] = withFlag(snap(p[0]), snap(p[1]), poly[drag.i][2]);
        this.onChange(poly, false);
      });
      const end = e => { if (drag && drag.id === e.pointerId) { drag = null; this.onChange(this.get().poly, true); } };
      this.svg.addEventListener('pointerup', end); this.svg.addEventListener('pointercancel', end);
      this.delBtn.addEventListener('click', () => {
        const poly = this.get().poly;
        if (this.sel < 0 || poly.length <= 3) return;
        poly.splice(this.sel, 1); this.sel = -1; this.onChange(poly, true);
      });
      const commit = () => {
        if (this.input.hidden) return;
        const v = parseFloat(String(this.input.value).replace(',', '.'));
        const i = +this.input.dataset.edge; this.input.hidden = true;
        if (isFinite(v) && v >= 0.2 && v <= 30) { this.setEdgeLength(i, v); this.onChange(this.get().poly, true); }
      };
      this.input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') this.input.hidden = true; });
      this.input.addEventListener('blur', commit);
    }
    _toPlan(e) {
      const pt = this.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      return [p.x, p.y];
    }
    _editEdge(i) {
      const poly = this.get().poly, a = poly[i], b = poly[(i + 1) % poly.length];
      const r = this.svg.getBoundingClientRect(), m = this.svg.getScreenCTM();
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const host = this.host.querySelector('.plan-wrap').getBoundingClientRect();
      this.input.style.left = (m.a * mx + m.e - host.left - 36) + 'px';
      this.input.style.top = (m.d * my + m.f - host.top - 16) + 'px';
      this.input.value = dist(a, b).toFixed(2); this.input.dataset.edge = i; this.input.hidden = false;
      this.input.focus(); this.input.select();
      void r;
    }
    // Изменить длину стены: «растягиваем» всё, что лежит за её концом
    setEdgeLength(i, len) {
      const poly = this.get().poly, a = poly[i], j = (i + 1) % poly.length, b = poly[j];
      const cur = dist(a, b); if (cur < 1e-6) return;
      const d = [(b[0] - a[0]) / cur, (b[1] - a[1]) / cur], delta = len - cur;
      const proj = p => p[0] * d[0] + p[1] * d[1], pb = proj(b) - 1e-6;
      poly.forEach((p, k) => {
        if (k !== i && proj(p) >= pb) { p[0] = snap(p[0] + d[0] * delta); p[1] = snap(p[1] + d[1] * delta); }
      });
      poly[j] = withFlag(snap(a[0] + d[0] * len), snap(a[1] + d[1] * len), b[2]);
    }
    render(count) {
      this._count = count;
      const { poly, showTiles } = this.get();
      const bb = bbox(poly), pad = 0.55;
      const vb = [bb.x - pad, bb.y - pad, bb.w + pad * 2, bb.h + pad * 2];
      this.svg.setAttribute('viewBox', vb.join(' '));
      const k = Math.max(vb[2], vb[3]) / 100; // «единица» толщины
      const P = poly.map(p => p[0] + ',' + p[1]).join(' ');
      let h = `<defs><pattern id="grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse"><path d="M0.5 0H0V0.5" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="${k * 0.25}"/></pattern></defs>`;
      h += `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#grid)"/>`;
      h += `<polygon points="${P}" class="pl-floor"/>`;
      if (showTiles && count) {
        const s = 0.01, ox = bb.x, oy = bb.y;
        h += `<g class="pl-tiles" clip-path="url(#clipRoom)">`;
        for (const [c, f] of count.tiles) {
          h += `<polygon points="${c.map(([x, y]) => (x * s + ox).toFixed(3) + ',' + (y * s + oy).toFixed(3)).join(' ')}" class="${f >= 0.997 ? 't-full' : f < 0.2 ? 't-sliver' : 't-cut'}" stroke-width="${k * 0.18}"/>`;
        }
        h += `</g><clipPath id="clipRoom"><polygon points="${P}"/></clipPath>`;
      }
      const E = edges(poly);
      for (const e of E) {
        const cls = 'pl-wall k-' + e.kind + (e.i === this.selEdge ? ' sel' : '');
        h += `<line x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" class="${cls}" stroke-width="${k * (e.kind === 'open' ? 0.6 : 1.4)}"${e.kind === 'open' ? ` stroke-dasharray="${k * 2} ${k * 1.5}"` : ''}/>`;
        if (e.kind === 'door' && e.len >= 0.9) {
          const c0 = [e.mid[0] - e.dir[0] * 0.4, e.mid[1] - e.dir[1] * 0.4], c1 = [e.mid[0] + e.dir[0] * 0.4, e.mid[1] + e.dir[1] * 0.4];
          const tip = [c0[0] + e.n[0] * 0.8, c0[1] + e.n[1] * 0.8];
          const sweep = (e.dir[0] * e.n[1] - e.dir[1] * e.n[0]) > 0 ? 0 : 1;
          h += `<line x1="${c0[0]}" y1="${c0[1]}" x2="${c1[0]}" y2="${c1[1]}" class="pl-gap" stroke-width="${k * 1.8}"/>`;
          h += `<path d="M${c0[0]} ${c0[1]}L${tip[0]} ${tip[1]}" class="pl-door" stroke-width="${k * 0.5}"/>`;
          h += `<path d="M${tip[0]} ${tip[1]}A0.8 0.8 0 0 ${sweep} ${c1[0]} ${c1[1]}" class="pl-door" fill="none" stroke-width="${k * 0.35}" stroke-dasharray="${k} ${k}"/>`;
        }
      }
      for (const e of E) {
        const lx = e.mid[0] - e.n[0] * k * 5.5, ly = e.mid[1] - e.n[1] * k * 5.5;
        h += `<g data-edge="${e.i}" class="pl-label"><rect x="${lx - k * 8}" y="${ly - k * 2.6}" width="${k * 16}" height="${k * 5.2}" rx="${k * 1.2}"/><text x="${lx}" y="${ly}" font-size="${k * 3.2}" dominant-baseline="central" text-anchor="middle"><tspan class="pl-num">${e.i + 1}·</tspan>${e.len.toFixed(2)}</text></g>`;
        if (e.len > 0.4) {
          const ax = e.mid[0] + e.n[0] * k * 4, ay = e.mid[1] + e.n[1] * k * 4;
          h += `<g data-add="${e.i}" class="pl-add"><circle cx="${ax}" cy="${ay}" r="${k * 2.4}"/><path d="M${ax - k * 1.2} ${ay}h${k * 2.4}M${ax} ${ay - k * 1.2}v${k * 2.4}" stroke-width="${k * 0.6}"/></g>`;
        }
      }
      poly.forEach(([x, y], i) => {
        h += `<circle data-v="${i}" cx="${x}" cy="${y}" r="${k * 2.8}" class="pl-v${i === this.sel ? ' sel' : ''}" stroke-width="${k * 0.8}"/>`;
      });
      this.svg.innerHTML = h;
      this.delBtn.disabled = this.sel < 0 || poly.length <= 3;
      this.kindBox.hidden = this.selEdge < 0 || this.selEdge >= poly.length;
      if (!this.kindBox.hidden) {
        const cur = poly[this.selEdge][2] || 0;
        this.kindBox.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('on', +b.dataset.kind === cur));
      }
    }
  }

  window.Plan = { KINDS, area: p => Math.abs(area(p)), signedArea: area, perimeter, bbox, inside, edges, countTiles, optimize, SHAPES, SHAPE_ICONS, Editor, dist };
})();
