// Отрисовка плитки и раскладок на canvas.
// Если у плитки есть image — используется фото, иначе процедурная имитация.
(function () {
  'use strict';

  // ---------- helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`; }
  function shade(c, k) { // k: -1..1
    return k >= 0 ? c.map(v => v + (255 - v) * k) : c.map(v => v * (1 + k));
  }
  function mix(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // ---------- images (real photos) ----------
  const images = {};
  let onImageLoad = null;
  function getImage(src) {
    if (!images[src]) {
      const img = new Image();
      img.onload = () => { cache.clear(); onImageLoad && onImageLoad(); };
      img.src = src;
      images[src] = img;
    }
    const img = images[src];
    return img.complete && img.naturalWidth ? img : null;
  }

  // ---------- materials ----------
  function speckle(ctx, w, h, r, base, amount, size) {
    const n = Math.floor(w * h / 18 * amount);
    for (let i = 0; i < n; i++) {
      const k = (r() - 0.5) * 0.35;
      ctx.fillStyle = rgba(shade(base, k), 0.35 + r() * 0.4);
      const s = (0.4 + r() * 1.2) * size;
      ctx.fillRect(r() * w, r() * h, s, s);
    }
  }
  function clouds(ctx, w, h, r, col, count, alpha) {
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, rad = (0.2 + r() * 0.6) * Math.max(w, h);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(col, alpha * (0.4 + r() * 0.6)));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }

  const M = {
    solid(ctx, w, h, r, m) {
      const c = hex(m.color);
      ctx.fillStyle = rgba(shade(c, (r() - 0.5) * 0.04)); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, shade(c, -0.08), 2, 0.25);
      speckle(ctx, w, h, r, c, 0.08, 1);
    },
    marble(ctx, w, h, r, m) {
      // Плавные «реки» прожилок: широкий мягкий ореол + основная жила + тонкие спутники
      const base = hex(m.base), vein = hex(m.vein), S = Math.max(w, h);
      ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, m.clouds ? hex(m.clouds) : mix(base, vein, 0.25), 6, 0.28);
      clouds(ctx, w, h, r, shade(base, 0.35), 4, 0.35);
      const hasFilter = 'filter' in ctx;
      const path = () => {
        // плавное «блуждание» через всю плиту
        const vertical = r() > 0.3, n = 3;
        let x = vertical ? w * (0.15 + r() * 0.7) : -0.05 * w, y = vertical ? -0.05 * h : h * (0.15 + r() * 0.7);
        const pts = [[x, y]];
        for (let i = 1; i <= n; i++) {
          if (vertical) { x += (r() - 0.5) * w * 0.45; y = -0.05 * h + i / n * 1.1 * h; }
          else { y += (r() - 0.5) * h * 0.45; x = -0.05 * w + i / n * 1.1 * w; }
          pts.push([x, y]);
        }
        return pts;
      };
      const stroke = (pts, width, alpha, blur) => {
        ctx.save();
        if (blur && hasFilter) ctx.filter = `blur(${blur}px)`;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const [px, py] = pts[i - 1], [qx, qy] = pts[i];
          const jx = (r() - 0.5) * S * 0.04, jy = (r() - 0.5) * S * 0.04;
          ctx.bezierCurveTo(px + (qx - px) * 0.35 + jx, py + (qy - py) * 0.35 + jy, px + (qx - px) * 0.65 - jx, py + (qy - py) * 0.65 - jy, qx, qy);
        }
        ctx.strokeStyle = rgba(vein, alpha); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke(); ctx.restore();
      };
      const jitter = (pts, k) => pts.map(([x, y]) => [x + (r() - 0.5) * S * k, y + (r() - 0.5) * S * k]);
      const veins = 1 + Math.floor(r() * 2.4);
      for (let i = 0; i < veins; i++) {
        const pts = path(), main = (0.5 + r()) * S / 160;
        stroke(pts, S / 14, m.veinAlpha * 0.12, S / 40);      // ореол
        stroke(pts, main * 3, m.veinAlpha * 0.35, S / 220);   // тело жилы
        stroke(pts, main, m.veinAlpha * 0.9, 0);              // ядро
        for (let k = 0; k < 2; k++) stroke(jitter(pts, 0.025), Math.max(0.5, main * 0.35), m.veinAlpha * 0.35, 0); // спутники
      }
      // тонкие волоски
      for (let i = 0; i < 3; i++) stroke(jitter(path(), 0.04), Math.max(0.5, S / 900), m.veinAlpha * 0.25, 0);
    },
    stone(ctx, w, h, r, m) {
      const base = hex(m.base);
      ctx.fillStyle = rgba(shade(base, (r() - 0.5) * 0.06)); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, shade(base, -0.15), 5, 0.35);
      clouds(ctx, w, h, r, shade(base, 0.15), 4, 0.3);
      speckle(ctx, w, h, r, base, m.speck || 0.5, 1.2);
    },
    travertine(ctx, w, h, r, m) {
      const base = hex(m.base), line = hex(m.line);
      ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, shade(base, -0.1), 4, 0.4);
      const n = Math.floor(h / 3);
      for (let i = 0; i < n; i++) {
        const y = r() * h; const len = (0.2 + r() * 0.8) * w; const x = r() * w - len / 2;
        ctx.fillStyle = rgba(r() > 0.5 ? line : shade(base, 0.12), 0.18 + r() * 0.3);
        ctx.fillRect(x, y, len, 0.6 + r() * 1.6);
      }
      for (let i = 0; i < w * h / 900; i++) { // поры
        ctx.fillStyle = rgba(shade(line, -0.2), 0.35);
        ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 0.8 + r() * 2.5, 0.5 + r(), 0, 0, Math.PI * 2); ctx.fill();
      }
    },
    slate(ctx, w, h, r, m) {
      const base = hex(m.base);
      ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, w, h);
      // сколы «камень»: слоистые плиты
      const pieces = 3 + Math.floor(r() * 3);
      for (let i = 0; i < pieces; i++) {
        const k = (r() - 0.5) * 0.35;
        ctx.fillStyle = rgba(shade(base, k), 0.9);
        ctx.beginPath();
        const cx = r() * w, cy = r() * h, rad = (0.25 + r() * 0.35) * w;
        for (let a = 0; a < 7; a++) {
          const ang = a / 7 * Math.PI * 2, rr = rad * (0.6 + r() * 0.5);
          ctx[a ? 'lineTo' : 'moveTo'](cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.6);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(shade(base, -0.45), 0.5); ctx.lineWidth = 1; ctx.stroke();
      }
      clouds(ctx, w, h, r, hex('#8a6a4a'), 2, 0.18);
      speckle(ctx, w, h, r, base, 0.6, 1);
    },
    wood(ctx, w, h, r, m) {
      const base = hex(m.base), grain = hex(m.grain);
      const vertical = h >= w;
      const L = vertical ? h : w, Wd = vertical ? w : h;
      ctx.save();
      if (!vertical) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); }
      ctx.fillStyle = rgba(shade(base, (r() - 0.5) * 0.2)); ctx.fillRect(0, 0, Wd, L);
      const lines = Math.floor(Wd / 2.2) + 4;
      for (let i = 0; i < lines; i++) {
        const x0 = r() * Wd, amp = 0.5 + r() * Wd * 0.08, freq = 0.5 + r() * 2;
        ctx.beginPath();
        for (let y = 0; y <= L; y += L / 30) {
          const x = x0 + Math.sin(y / L * Math.PI * freq + i) * amp;
          y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(grain, 0.1 + r() * 0.3); ctx.lineWidth = 0.4 + r() * 1.4; ctx.stroke();
      }
      if (r() > 0.55) { // сучок
        const kx = Wd * (0.25 + r() * 0.5), ky = L * r();
        for (let k = 4; k > 0; k--) {
          ctx.strokeStyle = rgba(grain, 0.25); ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.ellipse(kx, ky, k * Wd * 0.04, k * Wd * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    },
    terrazzo(ctx, w, h, r, m) {
      const base = hex(m.base);
      ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, r, base, 0.4, 1);
      const n = Math.floor(w * h / 260);
      for (let i = 0; i < n; i++) {
        const c = hex(m.chips[Math.floor(r() * m.chips.length)]);
        ctx.fillStyle = rgba(c, 0.95);
        const cx = r() * w, cy = r() * h, rad = 1 + r() * r() * Math.max(w, h) * 0.05;
        ctx.beginPath();
        const pts = 4 + Math.floor(r() * 3);
        for (let a = 0; a < pts; a++) {
          const ang = a / pts * Math.PI * 2 + r() * 0.6, rr = rad * (0.5 + r() * 0.6);
          ctx[a ? 'lineTo' : 'moveTo'](cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
        }
        ctx.closePath(); ctx.fill();
      }
    },
    zellige(ctx, w, h, r, m) {
      const c = shade(hex(m.color), (r() - 0.5) * (m.flat ? 0.18 : 0.3));
      ctx.fillStyle = rgba(c); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, shade(c, -0.25), 3, 0.45);
      clouds(ctx, w, h, r, shade(c, 0.3), 2, m.flat ? 0.2 : 0.45);
      // неровный край
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, rgba(shade(c, 0.25), 0.35)); g.addColorStop(1, rgba(shade(c, -0.3), 0.35));
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.08); ctx.strokeRect(0, 0, w, h);
      if (m.flat) speckle(ctx, w, h, r, c, 0.4, 1);
    },
    brick(ctx, w, h, r, m) {
      const c = shade(hex(m.base), (r() - 0.5) * 0.3);
      ctx.fillStyle = rgba(c); ctx.fillRect(0, 0, w, h);
      clouds(ctx, w, h, r, shade(c, -0.3), 3, 0.5);
      clouds(ctx, w, h, r, hex('#c98b62'), 2, 0.25);
      speckle(ctx, w, h, r, c, 1.4, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, w, Math.max(1, h * 0.12));
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, h - Math.max(1, h * 0.14), w, Math.max(1, h * 0.14));
    },
    mosaic(ctx, w, h, r, m) {
      const n = m.cells || 10;
      const cw = w / n, ch = h / Math.max(1, Math.round(n * h / w));
      ctx.fillStyle = m.grout || '#ddd'; ctx.fillRect(0, 0, w, h);
      const gap = Math.max(0.6, cw * 0.08);
      for (let y = 0; y < h - 0.1; y += ch) {
        for (let x = 0; x < w - 0.1; x += cw) {
          const c = shade(hex(m.colors[Math.floor(r() * m.colors.length)]), (r() - 0.5) * 0.12);
          const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
          g.addColorStop(0, rgba(shade(c, 0.2))); g.addColorStop(1, rgba(shade(c, -0.12)));
          ctx.fillStyle = g;
          ctx.fillRect(x + gap / 2, y + gap / 2, cw - gap, ch - gap);
        }
      }
    },
    pattern(ctx, w, h, r, m) {
      const bg = m.bg, fg = m.fg, ac = m.accent;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const s = Math.min(w, h), cx = w / 2, cy = h / 2;
      ctx.save();
      if (m.motif === 'star') {
        // восьмиконечная звезда + четверти розеток по углам (стыкуются в узор)
        star(ctx, cx, cy, s * 0.36, s * 0.2, 8, fg);
        star(ctx, cx, cy, s * 0.2, s * 0.12, 8, bg);
        circle(ctx, cx, cy, s * 0.08, ac);
        for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
          star(ctx, x, y, s * 0.22, s * 0.12, 8, ac);
          circle(ctx, x, y, s * 0.07, fg);
        }
        ctx.strokeStyle = fg; ctx.lineWidth = s * 0.025;
        for (const [x1, y1, x2, y2] of [[cx, 0, cx, s * 0.12], [cx, h, cx, h - s * 0.12], [0, cy, s * 0.12, cy], [w, cy, w - s * 0.12, cy]]) {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      } else {
        // четырёхлепестковый цветок, по углам — четверти лепестков
        ctx.fillStyle = fg;
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
          ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.09, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        circle(ctx, cx, cy, s * 0.07, ac);
        for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(x, y, s * 0.2, 0, Math.PI * 2); ctx.fill();
          circle(ctx, x, y, s * 0.12, bg);
          circle(ctx, x, y, s * 0.05, ac);
        }
        ctx.strokeStyle = ac; ctx.lineWidth = s * 0.02;
        ctx.strokeRect(s * 0.03, s * 0.03, w - s * 0.06, h - s * 0.06);
      }
      ctx.restore();
      // лёгкий износ цементной плитки
      speckle(ctx, w, h, r, hex(bg), 0.15, 1);
      clouds(ctx, w, h, r, [0, 0, 0], 1, 0.06);
    },
    image(ctx, w, h, r, m, tile, idx) {
      // у модели несколько узоров (faces) — плита idx берёт свой, как в настоящей укладке
      const f = faces(tile);
      const img = getImage(f[idx % f.length]);
      if (!img) { ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, w, h); return; }
      // случайный поворот на 0/180 — как кладут в реальности, если рисунок позволяет
      ctx.save();
      if (tile.rotatable !== false && r() > 0.5) { ctx.translate(w, h); ctx.rotate(Math.PI); }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }
  };
  function star(ctx, cx, cy, R, r0, n, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r0 : R;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function circle(ctx, x, y, rad, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }

  function finish(ctx, w, h, m, r) {
    const gloss = m.gloss || 0;
    if (gloss > 0.05) {
      const g = ctx.createLinearGradient(0, 0, w * 0.9, h * 0.9);
      g.addColorStop(0, `rgba(255,255,255,${0.22 * gloss})`);
      g.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.addColorStop(0.8, `rgba(255,255,255,${0.06 * gloss * r()})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const bw = Math.max(0.6, Math.min(w, h) * (m.bevel ? 0.07 : 0.025));
    ctx.fillStyle = `rgba(255,255,255,${m.bevel ? 0.45 : 0.18})`;
    ctx.fillRect(0, 0, w, bw); ctx.fillRect(0, 0, bw, h);
    ctx.fillStyle = `rgba(0,0,0,${m.bevel ? 0.22 : 0.1})`;
    ctx.fillRect(0, h - bw, w, bw); ctx.fillRect(w - bw, 0, bw, h);
  }

  // ---------- variants cache ----------
  const VARIANTS = 6;
  // фото узоров модели: images (несколько) или старое поле image (одно)
  function faces(tile) {
    if (Array.isArray(tile.images) && tile.images.length) return tile.images;
    return tile.image ? [tile.image] : [];
  }
  // сколько разных плит чередовать: не меньше числа узоров (каждый ещё и поворачивается)
  function variantCount(tile) { return Math.max(VARIANTS, faces(tile).length * 2); }
  // равномерный выбор плиты по её месту в раскладке (без перекоса в пользу одного узора)
  function pickVariant(i, j, n) {
    let h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j + 0x9e37, 0x165667b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) % n;
  }
  const cache = new Map();
  function variant(tile, wpx, hpx, idx) {
    wpx = Math.max(2, Math.round(wpx)); hpx = Math.max(2, Math.round(hpx));
    const key = tile.id + '|' + wpx + '|' + hpx + '|' + idx;
    let c = cache.get(key);
    if (c) return c;
    if (cache.size > 600) cache.clear();
    c = canvas(wpx, hpx);
    const ctx = c.getContext('2d');
    const r = rng(hashStr(tile.id) + idx * 7919);
    const m = tile.material || { type: 'solid', color: '#ddd' };
    const type = faces(tile).length ? 'image' : m.type;
    (M[type] || M.solid)(ctx, wpx, hpx, r, m, tile, idx);
    finish(ctx, wpx, hpx, m, r);
    cache.set(key, c);
    return c;
  }

  // ---------- layouts ----------
  // Генератор раскладки: возвращает список плиток {cx, cy, w, h, ang, i, j}
  // в координатах поверхности (px). w×h — «родной» размер плитки, ang — поворот.
  // opts: { tile, layout, rotate, ppm, anchor: 'bottom'|'center', offsetX, offsetY (м) }
  function layoutTiles(region, opts) {
    const { tile, ppm } = opts;
    const w0 = tile.w / 100 * ppm, h0 = tile.h / 100 * ppm;
    const rot = !!opts.rotate;
    const tw = rot ? h0 : w0, th = rot ? w0 : h0;
    const base = rot ? Math.PI / 2 : 0;
    const ox = (opts.offsetX || 0) * ppm, oy = (opts.offsetY || 0) * ppm;
    const cx = region.x + region.w / 2 + ox, cy = region.y + region.h / 2 + oy;
    const layout = opts.layout || 'straight';
    const out = [];
    const margin = Math.max(tw, th);
    const inR = (x, y) => x > region.x - margin && x < region.x + region.w + margin && y > region.y - margin && y < region.y + region.h + margin;
    const push = (x, y, ang, i, j) => { if (inR(x, y)) out.push({ cx: x, cy: y, w: w0, h: h0, ang, i, j }); };

    if (layout === 'diagonal' || layout === 'herringbone') {
      const R = Math.hypot(region.w, region.h) / 2 + Math.hypot(ox, oy) + Math.max(tw, th) * 2;
      const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
      const T = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
      if (layout === 'diagonal') {
        const n = Math.ceil(R / tw) + 1, m = Math.ceil(R / th) + 1;
        for (let j = -m; j <= m; j++) for (let i = -n; i <= n; i++) {
          const [x, y] = T(i * tw, j * th); push(x, y, base + Math.PI / 4, i, j);
        }
      } else {
        const L = Math.max(w0, h0), W = Math.min(w0, h0);
        const landscape = w0 >= h0;
        const K = Math.ceil((R + L) / W) + 1, Mx = Math.ceil((R + L) / L) + 1;
        for (let k = -K; k <= K; k++) for (let m = -Mx; m <= Mx; m++) {
          const px = k * W + m * L, py = k * W - m * L;
          if (Math.abs(px) > R + L || Math.abs(py) > R + L) continue;
          let [x, y] = T(px + L / 2, py + W / 2);           // «лёжа»
          push(x, y, (landscape ? 0 : Math.PI / 2) + Math.PI / 4, k, m * 2);
          [x, y] = T(px + L + W / 2, py + W - L / 2);       // «стоя»
          push(x, y, (landscape ? Math.PI / 2 : 0) + Math.PI / 4, k, m * 2 + 1);
        }
      }
    } else {
      const shiftFor = row => layout === 'brick' ? (row % 2) * tw / 2
        : layout === 'third' ? (row % 3) * tw / 3 : 0;
      const bottom = opts.anchor === 'bottom' ? region.y + region.h + oy
        : cy + th / 2 + Math.ceil((region.h / 2 + Math.abs(oy)) / th + 1) * th;
      const rows = Math.ceil((bottom - region.y) / th) + 1;
      const startX = cx - tw / 2 - Math.ceil((cx - tw / 2 - region.x) / tw + 1) * tw;
      for (let row = 0; row < rows; row++) {
        const y = bottom - th * (row + 1);
        if (y > region.y + region.h || y + th < region.y) continue;
        let col = 0;
        for (let x = startX + shiftFor(row); x < region.x + region.w; x += tw, col++) {
          if (x + tw < region.x) continue;
          push(x + tw / 2, y + th / 2, base, col, row);
        }
      }
    }
    return out;
  }

  // Углы плитки (для расчёта подрезки)
  function tileCorners(t) {
    const c = Math.cos(t.ang), s = Math.sin(t.ang), hw = t.w / 2, hh = t.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [t.cx + x * c - y * s, t.cy + x * s + y * c]);
  }

  // Рисует плитку. opts.mask = {tile:'#fff', grout:'#000'} — карта рельефа/шероховатости вместо цвета.
  // opts.clip — полигон [[x,y]...] в px для обрезки (пол сложной формы)
  function paintSurface(ctx, region, opts) {
    const { tile, ppm } = opts;
    const g = Math.max(1, (opts.groutMm || 2) / 1000 * ppm);
    ctx.save();
    ctx.beginPath();
    if (opts.clip) opts.clip.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    else ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    ctx.fillStyle = opts.mask ? opts.mask.grout : (opts.groutColor || '#ddd');
    ctx.fillRect(region.x, region.y, region.w, region.h);
    const tiles = layoutTiles(region, opts);
    for (const t of tiles) {
      const w = t.w - g, h = t.h - g;
      if (w <= 0 || h <= 0) continue;
      ctx.save(); ctx.translate(t.cx, t.cy); if (t.ang) ctx.rotate(t.ang);
      if (opts.mask) {
        ctx.fillStyle = opts.mask.tile; ctx.fillRect(-w / 2, -h / 2, w, h);
        if (opts.mask.edge) { // скруглённая фаска — плавный переход к шву
          ctx.strokeStyle = opts.mask.edge; ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.04);
          ctx.strokeRect(-w / 2, -h / 2, w, h);
        }
      } else {
        const v = variant(tile, w, h, pickVariant(t.i, t.j, variantCount(tile)));
        ctx.drawImage(v, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    ctx.restore();
    return tiles;
  }

  // Образец плитки для карточек и выбора
  function swatch(tile, wpx, hpx, opts) {
    const c = canvas(wpx, hpx);
    const ctx = c.getContext('2d');
    opts = opts || {};
    const across = opts.across || 2.4; // сколько плиток по ширине
    const ppm = wpx / (tile.w / 100 * across);
    paintSurface(ctx, { x: 0, y: 0, w: wpx, h: hpx }, {
      tile, ppm,
      layout: opts.layout || (tile.defaultLayout === 'herringbone' ? 'herringbone' : tile.defaultLayout) || 'straight',
      groutColor: opts.groutColor || '#d9d6d0', groutMm: 3, anchor: 'center'
    });
    return c;
  }

  // Штукатурка / краска
  function paintPlaster(ctx, x, y, w, h, color, seed) {
    const c = hex(color);
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    const r = rng(seed || 7);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let i = 0; i < 6; i++) {
      const px = x + r() * w, py = y + r() * h, rad = (0.2 + r() * 0.5) * Math.max(w, h);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, rgba(shade(c, (r() - 0.5) * 0.08), 0.5)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    const n = Math.floor(w * h / 60);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rgba(shade(c, (r() - 0.5) * 0.12), 0.5);
      ctx.fillRect(x + r() * w, y + r() * h, 1, 1);
    }
    ctx.restore();
  }

  // Мягкое затенение в углах и общий свет
  function shadeSurface(ctx, w, h, o) {
    ctx.save();
    const edge = o.edge || 0.12;
    const mk = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(0,0,0,${o.ao || 0.18})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      return g;
    };
    const ew = w * edge, eh = h * edge;
    if (o.sides !== false) {
      ctx.fillStyle = mk(0, 0, ew, 0); ctx.fillRect(0, 0, ew, h);
      ctx.fillStyle = mk(w, 0, w - ew, 0); ctx.fillRect(w - ew, 0, ew, h);
    }
    if (o.top) { ctx.fillStyle = mk(0, 0, 0, eh); ctx.fillRect(0, 0, w, eh); }
    if (o.bottom) { ctx.fillStyle = mk(0, h, 0, h - eh); ctx.fillRect(0, h - eh, w, eh); }
    if (o.dim) { ctx.fillStyle = `rgba(0,0,0,${o.dim})`; ctx.fillRect(0, 0, w, h); }
    if (o.light) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,255,255,${o.light})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  window.Tiles = {
    paintSurface, layoutTiles, faces, tileCorners, swatch, paintPlaster, shadeSurface, canvas, hex,
    setOnImageLoad(fn) { onImageLoad = fn; },
    clearCache() { cache.clear(); }
  };
})();
