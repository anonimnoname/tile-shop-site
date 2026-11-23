(function () {
  'use strict';
  const S = window.SHOP, CAT = window.CATALOG, T = window.Tiles, PL = window.Plan;
  const byId = id => CAT.find(t => t.id === id);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/[\s,]/g, ' ');
  const money = n => fmt(n) + ' ' + S.currency;
  const usd = n => S.usdRate > 0 ? '≈ $' + (n / S.usdRate >= 100 ? fmt(n / S.usdRate) : (n / S.usdRate).toFixed(n / S.usdRate < 10 ? 2 : 1)) : '';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const r2 = v => Math.round(v * 100) / 100;
  const PPM = 384; // пикселей на метр в текстурах (крупный формат — нужна детализация)

  const LAYOUTS = {
    straight: 'Прямая', brick: 'Вразбежку ½', third: 'Вразбежку ⅓',
    diagonal: 'По диагонали', herringbone: 'Ёлочка'
  };
  const COMPLEX = { diagonal: 1, herringbone: 1 };
  const GROUTS = [
    ['#f4f3ef', 'Белая'], ['#d9d6d0', 'Светло-серая'], ['#a3a19c', 'Серая'],
    ['#5b5c5e', 'Графит'], ['#cdb99a', 'Бежевая'], ['#232325', 'Чёрная']
  ];
  const PAINTS = [
    ['#f3efe8', 'Молочный'], ['#e6e1d8', 'Светло-серый'], ['#d9cbb4', 'Бежевый'],
    ['#b9c4b4', 'Шалфей'], ['#9fb3c2', 'Серо-голубой'], ['#4f5a63', 'Графит']
  ];
  const FACADES = [
    ['#efe6d6', 'Слоновая кость'], ['#e3d1b3', 'Песочный'], ['#d8c7b9', 'Капучино'],
    ['#c9cfd2', 'Светло-серый'], ['#f7f6f2', 'Белый'], ['#b98f6e', 'Терракота']
  ];
  const DOOR_W = 0.8, DOOR_H = 2.0;

  // ---------------- помещения ----------------
  const ROOMS = {
    bath: {
      title: 'Ванная', icon: '🛁', plan: true,
      surfaces: [
        { key: 'wall', label: 'Стены', use: 'wall' },
        { key: 'wallLow', label: 'Низ стен (другая плитка)', use: 'wall', optional: true, height: [0.6, 1.6] },
        { key: 'accent', label: 'Акцентная стена (за тумбой)', use: 'wall', optional: true },
        { key: 'floor', label: 'Пол', use: 'floor', isFloor: true }
      ]
    },
    wc: {
      title: 'Туалет', icon: '🚽', plan: true,
      surfaces: [
        { key: 'wall', label: 'Стены', use: 'wall' },
        { key: 'wallLow', label: 'Низ стен (другая плитка)', use: 'wall', optional: true, height: [0.6, 1.6] },
        { key: 'accent', label: 'Акцентная стена', use: 'wall', optional: true },
        { key: 'floor', label: 'Пол', use: 'floor', isFloor: true }
      ]
    },
    kitchen: {
      title: 'Кухня', icon: '🍳', plan: true, paint: PAINTS, windows: true,
      surfaces: [
        { key: 'apron', label: 'Фартук', use: 'wall' },
        { key: 'walls', label: 'Стены целиком плиткой', use: 'wall', optional: true },
        { key: 'floor', label: 'Пол', use: 'floor', isFloor: true }
      ]
    },
    living: {
      title: 'Комната / прихожая', icon: '🛋', plan: true, paint: PAINTS, windows: true,
      surfaces: [
        { key: 'floor', label: 'Пол', use: 'floor', isFloor: true },
        { key: 'accent', label: 'Акцентная стена', use: 'wall', optional: true }
      ]
    },
    plinth: {
      title: 'Цоколь и двор', icon: '🏡', paint: FACADES,
      dims: { HW: ['Длина дома, м', 4, 30], HD: ['Ширина дома, м', 4, 30], Y: ['Двор, м²', 5, 500] },
      surfaces: [
        { key: 'plinth', label: 'Цоколь', use: 'plinth', height: [0.3, 1.2] },
        { key: 'ground', label: 'Двор / дорожка', use: 'outdoor' }
      ]
    }
  };

  // если товара из примера нет в каталоге (отец его удалил) — берём первый подходящий
  function pick(id, use) { return byId(id) ? id : ((CAT.find(t => t.use.includes(use)) || CAT[0] || {}).id); }
  function surf(tileId, extra, use) {
    tileId = pick(tileId, use || 'floor');
    const t = byId(tileId);
    return Object.assign({ tile: tileId, layout: (t && t.defaultLayout) || 'straight', rotate: false, enabled: true, ox: 0, oy: 0 }, extra);
  }
  function defaults() {
    return {
      room: 'bath',
      bath: {
        shape: 'rect', W: 3.0, D: 2.6, H: 2.7, poly: PL.SHAPES.rect.make(3.0, 2.6),
        grout: '#f4f3ef', groutMm: 2, showTiles: true,
        wall: surf('calacatta-gold-60x120', undefined, 'wall'),
        wallLow: surf('nero-marquina-80x135', { enabled: false, height: 1.2 }, 'wall'),
        accent: surf('onyx-honey-75x150', { enabled: false }, 'wall'),
        floor: surf('nero-marquina-80x135')
      },
      wc: {
        shape: 'rect', W: 1.3, D: 1.9, H: 2.6, poly: PL.SHAPES.rect.make(1.3, 1.9),
        grout: '#d9d6d0', groutMm: 2, showTiles: true,
        wall: surf('microcement-sand-75x150', undefined, 'wall'),
        wallLow: surf('solid-graphite-80x135', { enabled: false, height: 1.2 }, 'wall'),
        accent: surf('nero-marquina-80x135', { enabled: true }, 'wall'),
        floor: surf('concrete-grey-60x120')
      },
      kitchen: {
        shape: 'rect', W: 3.2, D: 3.0, H: 2.7, poly: PL.SHAPES.rect.make(3.2, 3.0),
        grout: '#f4f3ef', groutMm: 2, paint: '#f3efe8', showTiles: true,
        apron: surf('onyx-pearl-60x120', { rotate: true }, 'wall'),
        walls: surf('solid-ivory-60x120', { enabled: false }, 'wall'),
        floor: surf('microcement-sand-75x150')
      },
      living: {
        shape: 'L', W: 4.6, D: 4.2, H: 2.7, poly: PL.SHAPES.L.make(4.6, 4.2),
        grout: '#a3a19c', groutMm: 2, paint: '#e6e1d8', showTiles: true,
        floor: surf('travertine-classic-60x120'),
        accent: surf('onyx-honey-75x150', { enabled: false }, 'wall')
      },
      plinth: {
        HW: 10, HD: 8, Y: 45, grout: '#a3a19c', groutMm: 5, paint: '#efe6d6',
        plinth: surf('slate-graphite-60x120', { height: 0.6, rotate: true }, 'plinth'),
        ground: surf('limestone-80x135', undefined, 'outdoor')
      }
    };
  }

  // ---------------- состояние ----------------
  function deepMerge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function sanitize(st) {
    const d = defaults();
    if (!ROOMS[st.room]) st.room = 'bath';
    for (const k of Object.keys(ROOMS)) {
      const rs = st[k];
      if (ROOMS[k].plan) {
        if (!Array.isArray(rs.poly) || rs.poly.length < 3 || rs.poly.some(p => !Array.isArray(p) || !isFinite(p[0]) || !isFinite(p[1]))) {
          rs.poly = rs.W && rs.D ? PL.SHAPES.rect.make(+rs.W, +rs.D) : d[k].poly;
        }
        rs.H = Math.max(2, Math.min(4, +rs.H || d[k].H));
      }
      for (const sd of ROOMS[k].surfaces) {
        if (!rs[sd.key] || !byId(rs[sd.key].tile)) rs[sd.key] = d[k][sd.key];
        const t = byId(rs[sd.key].tile);
        if (t && !t.use.includes(sd.use)) rs[sd.key].tile = pick('', sd.use);
      }
    }
    return st;
  }
  function loadState() {
    try {
      const m = location.hash.match(/cfg=([^&]+)/);
      if (m) return sanitize(deepMerge(defaults(), JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))))));
    } catch (e) { /* битая ссылка */ }
    try {
      const saved = JSON.parse(localStorage.getItem('tile-cfg-v2'));
      if (saved) return sanitize(deepMerge(defaults(), saved));
    } catch (e) { /* приватный режим */ }
    return defaults();
  }
  let state;
  const fromLink = location.hash.includes('cfg=');

  function shareUrl() {
    const r = state.room;
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ room: r, [r]: state[r] }))));
    return location.origin + location.pathname + '#/constructor?cfg=' + encodeURIComponent(enc);
  }

  // ---------------- геометрия помещения ----------------
  function roomGeo(rs) {
    const poly = rs.poly, edges = PL.edges(poly);
    const solid = edges.filter(e => e.kind !== 'open');
    const main = (solid.length ? solid : edges).slice().sort((a, b) => (a.kind === 'door') - (b.kind === 'door') || b.len - a.len)[0];
    let door = edges.find(e => e.kind === 'door') || null, best = Infinity;
    // если дверь не указана и нет ни одного проёма — ставим её сами на стену напротив главной
    if (!door && !edges.some(e => e.kind === 'open')) {
      for (const e of edges) {
        if (e === main || e.len < 0.95) continue;
        const score = e.n[0] * main.n[0] + e.n[1] * main.n[1] - e.len * 0.01;
        if (score < best) { best = score; door = e; }
      }
    }
    const wallLen = solid.reduce((a, e) => a + e.len, 0);
    return { poly, edges, main, door, wallLen };
  }
  const TILED = { bath: 1, wc: 1 };
  // плитка конкретной стены: своя (режим «каждая стена отдельно») или общая
  function wallSurf(rs, e) {
    const id = rs.perWall && rs.perWall.enabled && rs.perWall.map && rs.perWall.map[e.i];
    if (id === '__floor') return Object.assign({}, rs.wall, { tile: rs.floor.tile, rotate: false });
    return id && byId(id) ? Object.assign({}, rs.wall, { tile: id, rotate: false }) : rs.wall;
  }
  let tileQuery = '';
  // какая стена акцентная: выбранная в панели или главная (самая длинная)
  function accentEdge(rs, g) {
    const e = g.edges[rs.accentWall];
    return e && e.kind !== 'open' ? e : g.main;
  }
  function windowsFor(kind, g) {
    if (!ROOMS[kind].windows) return [];
    const c = g.edges.filter(e => e !== g.main && e !== g.door && e.kind === 'wall' && e.len >= 1.6).sort((a, b) => b.len - a.len);
    return c.length ? [c[0]] : [];
  }

  // ---------------- текстуры поверхностей ----------------
  function surfaceSet(wM, hM) {
    const ppm = Math.min(PPM, 4096 / Math.max(wM, hM));
    const mk = () => T.canvas(wM * ppm, hM * ppm);
    const set = { ppm, color: mk(), bump: mk(), rough: mk(), wM, hM };
    const b = set.bump.getContext('2d'); b.fillStyle = '#8a8a8a'; b.fillRect(0, 0, set.bump.width, set.bump.height);
    const r = set.rough.getContext('2d'); r.fillStyle = '#e8e8e8'; r.fillRect(0, 0, set.rough.width, set.rough.height);
    return set;
  }
  function tileOpts(rs, sf, anchor) {
    return { tile: byId(sf.tile), layout: sf.layout, rotate: sf.rotate, groutColor: rs.grout, groutMm: rs.groutMm, anchor, offsetX: sf.ox || 0, offsetY: sf.oy || 0 };
  }
  // region и clip — в метрах (x, y от левого верхнего угла поверхности)
  function paintTiles(set, regionM, o, clipM) {
    const p = set.ppm;
    const region = { x: regionM.x * p, y: regionM.y * p, w: regionM.w * p, h: regionM.h * p };
    const clip = clipM && clipM.map(([x, y]) => [x * p, y * p]);
    const gloss = (o.tile.material && o.tile.material.gloss) || 0;
    const rough = Math.round(255 * (0.92 - gloss * 0.8));
    const base = Object.assign({}, o, { ppm: p, clip });
    set.gloss = Math.max(set.gloss || 0, gloss);
    T.paintSurface(set.color.getContext('2d'), region, base);
    T.paintSurface(set.bump.getContext('2d'), region, Object.assign({}, base, { mask: { tile: '#fff', grout: '#2a2a2a', edge: '#d8d8d8' } }));
    T.paintSurface(set.rough.getContext('2d'), region, Object.assign({}, base, { mask: { tile: `rgb(${rough},${rough},${rough})`, grout: '#f4f4f4' } }));
  }
  function paintPaint(set, color, seed) {
    T.paintPlaster(set.color.getContext('2d'), 0, 0, set.color.width, set.color.height, color, seed);
  }
  function skirting(set) {
    const p = set.ppm, c = set.color.getContext('2d'), h = 0.08 * p, y = set.color.height - h;
    c.fillStyle = '#f2f0ec'; c.fillRect(0, y, set.color.width, h);
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, y, set.color.width, 2);
    const b = set.bump.getContext('2d'); b.fillStyle = '#ffffff'; b.fillRect(0, y, set.color.width, h);
  }
  function ao(set, o) { T.shadeSurface(set.color.getContext('2d'), set.color.width, set.color.height, o); }

  // ---------------- 3D ----------------
  const viewport = $('#viewport');
  let scene = null;
  try { scene = new window.Scene3D(viewport); }
  catch (e) {
    viewport.innerHTML = '<p class="no3d">Ваш браузер не поддерживает 3D (WebGL). Каталог и расчёт работают, а 3D-вид откройте на другом устройстве.</p>';
  }
  let raf = 0;
  function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  T.setOnImageLoad(render);

  function draw() {
    const kind = state.room, rs = state[kind];
    document.body.classList.toggle('outdoor', kind === 'plinth');
    if (!scene) return;
    if (kind === 'plinth') return drawHouse(rs);
    if (kind === 'bath') heroNow();
    const g = roomGeo(rs), H = rs.H, bb = PL.bbox(rs.poly);

    // пол — одна текстура на прямоугольник плана, обрезана по форме комнаты
    const fs = surfaceSet(bb.w, bb.h);
    const clip = rs.poly.map(([x, y]) => [x - bb.x, y - bb.y]);
    paintTiles(fs, { x: 0, y: 0, w: bb.w, h: bb.h }, tileOpts(rs, rs.floor, 'center'), clip);

    const wins = windowsFor(kind, g);
    const walls = g.edges.map(e => {
      if (e.kind === 'open') return null;
      const set = surfaceSet(e.len, H);
      const full = (from, to) => ({ x: 0, y: H - to, w: e.len, h: to - from });
      if (TILED[kind]) {
        paintTiles(set, full(0, H), tileOpts(rs, wallSurf(rs, e), 'bottom'));
        if (rs.wallLow.enabled) paintTiles(set, full(0, rs.wallLow.height), tileOpts(rs, rs.wallLow, 'bottom'));
        if (rs.accent && rs.accent.enabled && e === accentEdge(rs, g)) paintTiles(set, full(0, H), tileOpts(rs, rs.accent, 'bottom'));
      } else if (kind === 'kitchen') {
        const wallsOn = rs.walls && rs.walls.enabled;
        if (wallsOn) paintTiles(set, full(0, H), tileOpts(rs, rs.walls, 'bottom'));
        else paintPaint(set, rs.paint, e.i + 3);
        if (e === g.main) paintTiles(set, { x: 0.03, y: H - 1.5, w: e.len - 0.06, h: 0.62 }, tileOpts(rs, rs.apron, 'bottom'));
        if (!wallsOn) skirting(set);
      } else {
        if (e === accentEdge(rs, g) && rs.accent.enabled) paintTiles(set, full(0, H), tileOpts(rs, rs.accent, 'bottom'));
        else paintPaint(set, rs.paint, e.i + 3);
        skirting(set);
      }
      ao(set, { ao: 0.12, edge: 0.05, top: true, bottom: true, light: 0.04 });
      return set;
    });
    scene.buildRoom({ kind, poly: rs.poly, H, edges: g.edges, floor: fs, walls, door: g.door ? g.door.i : null, windows: wins.map(e => e.i) });
    markView(scene.mode, { index: scene.eyeIndex, count: scene.eyes.length });
  }

  function drawHouse(rs) {
    const HW = Math.min(rs.HW, 20), HD = Math.min(rs.HD, 20), H = 3.2, ph = rs.plinth.height;
    const yardW = HW + 2, yardD = Math.max(2, Math.min(14, rs.Y / yardW));
    const plinthSet = len => {
      const s = surfaceSet(len, ph);
      paintTiles(s, { x: 0, y: 0, w: len, h: ph }, tileOpts(rs, rs.plinth, 'bottom'));
      return s;
    };
    const wallH = H - ph, sill = Math.max(1.0, ph + 0.2), wh = Math.min(1.3, H - 0.35 - sill);
    const facade = (len, wins, door) => {
      const s = surfaceSet(len, wallH), c = s.color.getContext('2d'), p = s.ppm;
      paintPaint(s, rs.paint, Math.round(len * 10));
      const glass = (cx, w) => {
        const x = (len / 2 + cx - w / 2) * p, y = (H - sill - wh) * p, gw = w * p, gh = wh * p;
        c.fillStyle = '#f7f7f5'; c.fillRect(x - 0.05 * p, y - 0.05 * p, gw + 0.1 * p, gh + 0.1 * p);
        const gr = c.createLinearGradient(0, y, 0, y + gh); gr.addColorStop(0, '#a9c8dc'); gr.addColorStop(1, '#4b6c84');
        c.fillStyle = gr; c.fillRect(x, y, gw, gh);
        const b = s.bump.getContext('2d'); b.fillStyle = '#5a5a5a'; b.fillRect(x, y, gw, gh);
        const r = s.rough.getContext('2d'); r.fillStyle = '#1a1a1a'; r.fillRect(x, y, gw, gh);
      };
      wins.forEach(cx => glass(cx, 1.2));
      if (door) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect((len / 2 - 0.55) * p, (wallH - 2.15 + 0.05) * p, 1.1 * p, 2.15 * p); }
      ao(s, { ao: 0.1, edge: 0.03, top: true, sides: true });
      return s;
    };
    const fx = HW * 0.3, bx = HW * 0.25;
    const windows = [
      { x: -fx, z: HD / 2, rot: 0 }, { x: fx, z: HD / 2, rot: 0 },
      { x: HW / 2, z: 0, rot: Math.PI / 2 }, { x: -HW / 2, z: 0, rot: -Math.PI / 2 },
      { x: -bx, z: -HD / 2, rot: Math.PI }, { x: bx, z: -HD / 2, rot: Math.PI }
    ].map(w => Object.assign(w, { w: 1.2, h: wh, y: sill }));
    const yard = surfaceSet(yardW, yardD);
    paintTiles(yard, { x: 0, y: 0, w: yardW, h: yardD }, tileOpts(rs, rs.ground, 'center'));
    scene.buildHouse({
      HW, HD, H, ph, yardW, yardD, doorX: 0, windows,
      plinth: [plinthSet(HW + 0.08), plinthSet(HD + 0.08)],
      facade: [facade(HW, [-fx, fx], true), facade(HD, [0]), facade(HW, [-bx, bx])],
      yard
    });
    markView(scene.mode, { index: scene.eyeIndex, count: scene.eyes.length });
  }

  // ---------------- панель ----------------
  const panel = $('#panel');
  let editor = null, floorCount = null;

  function renderTabs() {
    $('#roomTabs').innerHTML = Object.entries(ROOMS).map(([k, r]) =>
      `<button class="tab${state.room === k ? ' active' : ''}" data-room="${k}" role="tab" aria-selected="${state.room === k}"><span aria-hidden="true">${r.icon}</span> ${r.title}</button>`).join('');
  }

  function layoutsFor(tile) {
    const ratio = Math.max(tile.w, tile.h) / Math.min(tile.w, tile.h);
    const l = ['straight', 'brick', 'third', 'diagonal'];
    if (ratio >= 2.5) l.push('herringbone');
    return l;
  }

  function renderPanel() {
    const kind = state.room, def = ROOMS[kind], rs = state[kind];
    let h = '';
    if (def.plan) {
      h += `<section class="p-sec"><h4>Форма пола</h4>
        <div class="shapes">${Object.entries(PL.SHAPES).map(([k, s]) =>
          `<button class="shape${rs.shape === k ? ' sel' : ''}" data-shape="${k}" title="${s.name}" aria-label="${s.name}"><svg viewBox="0 0 24 24"><path d="${PL.SHAPE_ICONS[k]}"/></svg><span>${s.name}</span></button>`).join('')}</div>
        <div class="dims">
          <label>Ширина, м<input type="number" inputmode="decimal" step="0.05" min="1" max="15" data-dim="W" value="${rs.W}"></label>
          <label>Длина, м<input type="number" inputmode="decimal" step="0.05" min="1" max="15" data-dim="D" value="${rs.D}"></label>
          <label>Высота, м<input type="number" inputmode="decimal" step="0.05" min="2" max="4" data-dim="H" value="${rs.H}"></label>
        </div>
        <div id="planEditor"></div>
        <p class="plan-stats" id="planStats"></p>
      </section>`;
    } else {
      h += `<section class="p-sec"><h4>Размеры</h4><div class="dims">`;
      for (const [k, [label, min, max]] of Object.entries(def.dims)) {
        h += `<label>${label}<input type="number" inputmode="decimal" step="0.5" min="${min}" max="${max}" data-dim="${k}" value="${rs[k]}"></label>`;
      }
      h += `</div></section>`;
    }

    h += `<section class="p-sec"><input type="search" class="tile-search" id="tileSearch" placeholder="Поиск плитки: название или размер, например 75x150" value="${esc(tileQuery)}" aria-label="Поиск плитки"></section>`;
    for (const sd of def.surfaces) {
      const sf = rs[sd.key], tile = byId(sf.tile);
      const tiles = CAT.filter(t => t.use.includes(sd.use));
      h += `<section class="p-sec${sf.enabled === false ? ' off' : ''}" data-surf="${sd.key}">
        <div class="p-head"><h4>${sd.label}</h4>${sd.optional ? `<label class="switch"><input type="checkbox" data-toggle="${sd.key}" ${sf.enabled !== false ? 'checked' : ''} aria-label="${sd.label}"><span></span></label>` : ''}</div>
        <div class="p-body">
        <div class="tile-strip" role="listbox" aria-label="${sd.label}">${tiles.map(t =>
          `<button class="sw${t.id === sf.tile ? ' sel' : ''}" data-pick="${sd.key}" data-id="${t.id}" data-q="${esc((t.name + ' ' + t.w + 'x' + t.h + ' ' + t.h + 'x' + t.w).toLowerCase())}" title="${t.name} ${t.w}×${t.h}" role="option" aria-selected="${t.id === sf.tile}"><canvas data-swatch="${t.id}" width="112" height="112"></canvas></button>`).join('')}</div>
        <div class="sel-info"><b>${tile.name}</b> · ${tile.w}×${tile.h} см · ${money(tile.price)}/м²${tile.inStock ? '' : ' · <span class="warn">под заказ</span>'}</div>
        <div class="row">
          ${`<select data-layout="${sd.key}" aria-label="Раскладка">${layoutsFor(tile).map(l => `<option value="${l}"${l === sf.layout ? ' selected' : ''}>${LAYOUTS[l]}</option>`).join('')}</select>`}
          ${tile.w !== tile.h && sf.layout !== 'herringbone' ? `<button class="chip${sf.rotate ? ' on' : ''}" data-rotate="${sd.key}">⟲ Повернуть 90°</button>` : ''}
          ${def.plan ? `<button class="chip" data-all="${sd.key}" title="Поставить эту плитку на стены, пол и фартук">⇄ На всё</button>` : ''}
          ${sd.isFloor ? `<button class="chip" data-optimize="${sd.key}" title="Сдвинуть раскладку так, чтобы было меньше подрезки">✂ Меньше подрезки</button>` : ''}
        </div>
        ${sd.isFloor ? `<label class="check"><input type="checkbox" data-showtiles ${rs.showTiles ? 'checked' : ''}> Показать раскладку на плане</label>` : ''}
        ${sd.key === 'accent' && def.plan ? `<label class="range"><span>Какая стена</span><select data-accentwall>${roomGeo(rs).edges.filter(e => e.kind !== 'open').map(e => `<option value="${e.i}"${e === accentEdge(rs, roomGeo(rs)) ? ' selected' : ''}>Стена ${e.i + 1} — ${e.len.toFixed(2)} м${e === roomGeo(rs).main ? ' (самая длинная)' : ''}</option>`).join('')}</select></label>` : ''}
        ${sd.height ? `<label class="range"><span>Высота: <b>${sf.height.toFixed(2)} м</b></span><input type="range" min="${sd.height[0]}" max="${sd.height[1]}" step="0.05" value="${sf.height}" data-height="${sd.key}"></label>` : ''}
        </div></section>`;
    }

    if (TILED[kind]) {
      const pw = rs.perWall || { enabled: false, map: {} };
      const wt = CAT.filter(t => t.use.includes('wall'));
      h += `<section class="p-sec${pw.enabled ? '' : ' off'}"><div class="p-head"><h4>Каждая стена отдельно</h4><label class="switch"><input type="checkbox" data-perwall ${pw.enabled ? 'checked' : ''} aria-label="Каждая стена отдельно"><span></span></label></div>
        <div class="p-body pw-list">${roomGeo(rs).edges.filter(e => e.kind !== 'open').map(e => `<label><span>Стена ${e.i + 1} — ${e.len.toFixed(2)} м</span><select data-pwall="${e.i}">
          <option value="">Как основные стены</option><option value="__floor"${pw.map[e.i] === '__floor' ? ' selected' : ''}>Как пол (${esc(byId(rs.floor.tile).name)})</option>${wt.map(t => `<option value="${esc(t.id)}"${pw.map[e.i] === t.id ? ' selected' : ''}>${esc(t.name)} ${sizeTitle(t)}</option>`).join('')}</select></label>`).join('')}
        <p class="note">Номера стен видны на плане: стена 1 начинается с левого верхнего угла и идёт по часовой стрелке.</p></div></section>`;
    }
    h += `<section class="p-sec"><h4>Затирка (швы)</h4><div class="colors">${GROUTS.map(([c, n]) =>
      `<button class="dot${rs.grout === c ? ' sel' : ''}" style="--c:${c}" data-grout="${c}" title="${n}" aria-label="Затирка: ${n}"></button>`).join('')}</div>
      <label class="range"><span>Ширина шва: <b>${rs.groutMm} мм</b></span><input type="range" min="1" max="8" step="0.5" value="${rs.groutMm}" data-groutmm></label></section>`;

    if (def.paint) {
      h += `<section class="p-sec"><h4>${kind === 'plinth' ? 'Цвет фасада' : 'Цвет стен'}</h4><div class="colors">${def.paint.map(([c, n]) =>
        `<button class="dot${rs.paint === c ? ' sel' : ''}" style="--c:${c}" data-paint="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></section>`;
    }
    panel.innerHTML = h;
    $$('canvas[data-swatch]', panel).forEach(cv => {
      const t = byId(cv.dataset.swatch);
      cv.getContext('2d').drawImage(T.swatch(t, 112, 112, { across: t.w < 15 ? 4 : t.w > 50 ? 1.4 : 2.2 }), 0, 0);
    });
    $$('.tile-strip .sel', panel).forEach(el => { const s = el.parentElement; s.scrollLeft = el.offsetLeft - s.clientWidth / 2 + el.clientWidth / 2; });

    editor = null;
    if (def.plan) {
      editor = new PL.Editor($('#planEditor'), () => ({ poly: state[state.room].poly, showTiles: state[state.room].showTiles }), (poly, final) => {
        const r = state[state.room]; r.poly = poly; r.shape = 'custom';
        const bb = PL.bbox(poly); r.W = r2(bb.w); r.D = r2(bb.h);
        if (final) { $$('.shape', panel).forEach(b => b.classList.remove('sel')); syncDims(); }
        changed(false, !final);
      });
    }
    refreshPlan();
    renderEstimate();
    applySearch();
  }
  function syncDims() {
    const rs = state[state.room];
    $$('[data-dim]', panel).forEach(i => { if (document.activeElement !== i) i.value = rs[i.dataset.dim]; });
  }

  function refreshPlan() {
    const kind = state.room, rs = state[kind];
    floorCount = null;
    if (!ROOMS[kind].plan) return;
    floorCount = PL.countTiles(rs.poly, floorOpts(rs));
    if (editor) editor.render(floorCount);
    const st = $('#planStats');
    if (st) {
      const per = PL.perimeter(rs.poly);
      const opens = PL.edges(rs.poly).filter(e => e.kind === 'open').length;
      st.innerHTML = `Пол <b>${PL.area(rs.poly).toFixed(2)} м²</b> · периметр ${per.toFixed(2)} м · ${rs.poly.length} углов${opens ? ` · проёмов: ${opens}` : ''}<br>
        Плитка на пол: <b>${floorCount.full}</b> целых + <b class="c-cut">${floorCount.cut}</b> кусков подрезки из ${floorCount.cutTiles} плит = <b>${floorCount.total} шт</b>${floorCount.slivers ? ` · <span class="c-sliver">${floorCount.slivers} узких полосок</span>` : ''}`;
    }
  }
  function floorOpts(rs) {
    return { tile: byId(rs.floor.tile), layout: rs.floor.layout, rotate: rs.floor.rotate, offsetX: rs.floor.ox || 0, offsetY: rs.floor.oy || 0 };
  }

  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !panel.contains(b)) return;
    const rs = state[state.room];
    if (b.dataset.pick) {
      const sf = rs[b.dataset.pick], t = byId(b.dataset.id);
      sf.tile = t.id; sf.enabled = true; sf.rotate = false; sf.ox = sf.oy = 0;
      if (!layoutsFor(t).includes(sf.layout)) sf.layout = 'straight';
      if (t.defaultLayout && layoutsFor(t).includes(t.defaultLayout)) sf.layout = t.defaultLayout;
    } else if (b.dataset.rotate) { const sf = rs[b.dataset.rotate]; sf.rotate = !sf.rotate; sf.ox = sf.oy = 0; }
    else if (b.dataset.all) {
      const t = byId(rs[b.dataset.all].tile);
      for (const sd of ROOMS[state.room].surfaces) {
        if (!t.use.includes(sd.use) || (sd.optional && sd.key !== 'walls')) continue;
        Object.assign(rs[sd.key], { tile: t.id, enabled: true, rotate: false, ox: 0, oy: 0 });
      }
      if (rs.perWall) rs.perWall.enabled = false;
      toast(`«${t.name}» — на всех поверхностях`);
    }
    else if (b.dataset.grout) rs.grout = b.dataset.grout;
    else if (b.dataset.paint) rs.paint = b.dataset.paint;
    else if (b.dataset.shape) {
      const sh = PL.SHAPES[b.dataset.shape];
      if (sh.defaults && (rs.W < sh.defaults[0] * 0.8 || rs.D < sh.defaults[1] * 0.8)) { rs.W = sh.defaults[0]; rs.D = sh.defaults[1]; }
      rs.shape = b.dataset.shape; rs.poly = sh.make(rs.W, rs.D); rs.floor.ox = rs.floor.oy = 0;
      const bb = PL.bbox(rs.poly); rs.W = r2(bb.w); rs.D = r2(bb.h);
    }
    else if (b.dataset.optimize) {
      const before = floorCount;
      const best = PL.optimize(rs.poly, Object.assign(floorOpts(rs), { offsetX: 0, offsetY: 0 }));
      rs.floor.ox = best.ox; rs.floor.oy = best.oy;
      const after = PL.countTiles(rs.poly, floorOpts(rs));
      toast(before && after.total < before.total ? `Сдвинули раскладку: ${before.total} → ${after.total} плиток` : 'Раскладка уже близка к лучшей');
    }
    else return;
    changed(true);
  });
  function applySearch() {
    const q = tileQuery.trim().toLowerCase().replace('×', 'x').replace(/\s+/g, ' ');
    $$('.sw[data-q]', panel).forEach(b => { b.hidden = !!q && !b.classList.contains('sel') && !q.split(' ').every(w => b.dataset.q.includes(w)); });
  }
  panel.addEventListener('input', e => {
    const el = e.target, rs = state[state.room];
    if (el.id === 'tileSearch') { tileQuery = el.value; applySearch(); return; }
    if (el.dataset.height) { rs[el.dataset.height].height = +el.value; el.previousElementSibling.querySelector('b').textContent = (+el.value).toFixed(2) + ' м'; changed(false); }
    else if ('groutmm' in el.dataset) { rs.groutMm = +el.value; el.previousElementSibling.querySelector('b').textContent = el.value + ' мм'; changed(false); }
  });
  panel.addEventListener('change', e => {
    const el = e.target, rs = state[state.room];
    if (el.dataset.layout) { rs[el.dataset.layout].layout = el.value; rs[el.dataset.layout].ox = rs[el.dataset.layout].oy = 0; changed(true); }
    else if (el.dataset.toggle) { rs[el.dataset.toggle].enabled = el.checked; changed(true); }
    else if ('showtiles' in el.dataset) { rs.showTiles = el.checked; changed(false); }
    else if ('accentwall' in el.dataset) { rs.accentWall = +el.value; changed(false); }
    else if ('perwall' in el.dataset) { rs.perWall = rs.perWall || { map: {} }; rs.perWall.enabled = el.checked; changed(true); }
    else if (el.dataset.pwall != null) { rs.perWall = rs.perWall || { enabled: true, map: {} }; rs.perWall.map = rs.perWall.map || {}; if (el.value) rs.perWall.map[el.dataset.pwall] = el.value; else delete rs.perWall.map[el.dataset.pwall]; changed(false); }
    else if (el.dataset.dim) {
      const k = el.dataset.dim;
      let v = parseFloat(String(el.value).replace(',', '.'));
      const lim = k === 'H' ? [2, 4] : ROOMS[state.room].dims ? ROOMS[state.room].dims[k].slice(1) : [1, 15];
      if (!isFinite(v)) v = defaults()[state.room][k];
      v = r2(Math.max(lim[0], Math.min(lim[1], v)));
      el.value = v;
      if (ROOMS[state.room].plan && (k === 'W' || k === 'D')) {
        // растягиваем текущую форму пропорционально
        const bb = PL.bbox(rs.poly);
        const sx = k === 'W' ? v / bb.w : 1, sy = k === 'D' ? v / bb.h : 1;
        rs.poly = rs.poly.map(([x, y, f]) => f ? [r2((x - bb.x) * sx), r2((y - bb.y) * sy), f] : [r2((x - bb.x) * sx), r2((y - bb.y) * sy)]);
      }
      rs[k] = v;
      changed(false);
    }
  });

  $('#roomTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-room]'); if (!b) return;
    state.room = b.dataset.room; renderTabs(); changed(true);
  });

  let renderT;
  function changed(rebuildPanel, light) {
    if (rebuildPanel) renderPanel(); else { refreshPlan(); renderEstimate(); }
    clearTimeout(renderT);
    if (!light) render(); else renderT = setTimeout(render, 150);
    clearTimeout(changed.t);
    changed.t = setTimeout(() => { try { localStorage.setItem('tile-cfg-v2', JSON.stringify(state)); } catch (e) { /* ignore */ } }, 300);
  }

  // ---------------- расчёт ----------------
  function pcsPerBox(t) { return Math.max(1, Math.round(t.box / (t.w * t.h / 10000))); }

  function rows() {
    const kind = state.room, rs = state[kind], out = [];
    const byArea = (name, sf, area) => {
      const t = byId(sf.tile), res = COMPLEX[sf.layout] ? S.reserve.complex : S.reserve.simple;
      const boxes = Math.ceil(area * (1 + res) / t.box - 1e-9);
      out.push({ name, tile: t, layout: sf.layout, area, boxes, m2: boxes * t.box, sum: boxes * t.box * t.price, note: `+${Math.round(res * 100)}% запас`, pieces: boxes * pcsPerBox(t) });
    };
    if (ROOMS[kind].plan) {
      const g = roomGeo(rs), P = g.wallLen, H = rs.H;
      const doors = g.door ? 1 : 0;
      // пол — по реальной раскладке
      const t = byId(rs.floor.tile), c = floorCount || PL.countTiles(rs.poly, floorOpts(rs));
      const pcs = pcsPerBox(t), need = Math.ceil(c.total * 1.03);
      const boxes = Math.ceil(need / pcs);
      out.push({ name: 'Пол', tile: t, layout: rs.floor.layout, area: PL.area(rs.poly), boxes, m2: boxes * t.box, sum: boxes * t.box * t.price,
        note: `${c.full} целых + ${c.cutTiles} на подрезку, +3% на бой`, pcs, pieces: boxes * pcs });
      if (TILED[kind]) {
        // по каждой стене: вычитаем дверь и нижнюю зону, группируем по плитке
        const accE = rs.accent && rs.accent.enabled ? accentEdge(rs, g) : null;
        const groups = new Map(); let low = 0, accArea = 0;
        for (const e of g.edges) {
          if (e.kind === 'open') continue;
          if (e === accE) { accArea += e.len * H; continue; }
          const dw = e === g.door ? DOOR_W : 0;
          const a = e.len * H - dw * DOOR_H;
          const l = rs.wallLow.enabled ? (e.len - dw) * rs.wallLow.height : 0;
          low += l;
          const sf = wallSurf(rs, e), gr = groups.get(sf.tile) || { sf, area: 0, walls: [] };
          gr.area += a - l; gr.walls.push(e.i + 1); groups.set(sf.tile, gr);
        }
        for (const gr of groups.values()) byArea(groups.size > 1 ? `${gr.walls.length > 1 ? 'Стены' : 'Стена'} ${gr.walls.join(', ')}` : 'Стены', gr.sf, Math.max(0, gr.area));
        if (low) byArea('Низ стен', rs.wallLow, low);
        if (accArea) byArea('Акцентная стена', rs.accent, accArea);
        void P; void doors;
      } else if (kind === 'kitchen') {
        const apronArea = (g.main.len - 0.06) * 0.62;
        byArea('Фартук', rs.apron, apronArea);
        if (rs.walls && rs.walls.enabled) {
          let wa = 0;
          for (const e of g.edges) if (e.kind !== 'open') wa += e.len * H - (e === g.door ? DOOR_W * DOOR_H : 0) - (e === g.main ? apronArea : 0);
          wa -= windowsFor(kind, g).length * 1.4 * 1.5;
          byArea('Стены', rs.walls, Math.max(0, wa));
        }
      } else if (rs.accent.enabled) {
        byArea('Акцентная стена', rs.accent, accentEdge(rs, g).len * H);
      }
    } else {
      const per = 2 * (rs.HW + rs.HD) - 1.0;
      byArea('Цоколь', rs.plinth, per * rs.plinth.height);
      byArea('Двор', rs.ground, rs.Y);
    }
    return out;
  }

  function renderEstimate() {
    const rr = rows(), total = rr.reduce((a, r) => a + r.sum, 0);
    $('#estimate').innerHTML = `
      <table><thead><tr><th>Поверхность</th><th>Площадь</th><th>Коробок</th><th>Сумма</th></tr></thead><tbody>
      ${rr.map(r => `<tr><td><b>${r.name}</b><small>${r.tile.name}, ${r.tile.w}×${r.tile.h}, ${LAYOUTS[r.layout].toLowerCase()}</small></td>
        <td>${r.area.toFixed(2)} м²<small>${r.note}</small></td>
        <td>${r.boxes}<small>${r.m2.toFixed(2)} м² · ${r.pieces} шт</small></td><td>${money(r.sum)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">Итого примерно</td><td class="tf-sp"></td><td>${money(total)}<small class="usd">${usd(total)}</small></td></tr></tfoot></table>
      <p class="note">Пол считается по настоящей раскладке плиток на вашем плане; мелкие куски подрезки режутся из одной плитки. Стены считаются по площади за вычетом двери, с запасом. Точное количество проверит продавец. Клей и затирка в расчёт не входят.</p>`;
  }

  function summaryText() {
    const kind = state.room, rs = state[kind], rr = rows();
    const dims = ROOMS[kind].plan
      ? `пол ${PL.area(rs.poly).toFixed(2)} м² (${rs.poly.length} углов, ${rs.W}×${rs.D} м), высота ${rs.H} м`
      : `дом ${rs.HW}×${rs.HD} м, двор ${rs.Y} м²`;
    const total = rr.reduce((a, r) => a + r.sum, 0);
    const grout = (GROUTS.find(g => g[0] === rs.grout) || [, ''])[1];
    return [
      `Здравствуйте! Хочу отложить плитку — подборка с сайта.`,
      `${ROOMS[kind].title}: ${dims}`,
      ...rr.map(r => `• ${r.name}: ${r.tile.name} ${r.tile.w}×${r.tile.h} (${LAYOUTS[r.layout].toLowerCase()}) — ${r.boxes} кор. (${r.m2.toFixed(2)} м²)`),
      `Затирка: ${grout.toLowerCase()}, шов ${rs.groutMm} мм`,
      `Итого ≈ ${money(total)}`,
      `Подборка: ${shareUrl()}`
    ].join('\n');
  }

  // ---------------- действия ----------------
  $('#addCart').addEventListener('click', () => {
    const kind = state.room, rr = rows();
    rr.forEach(r => Cart.add(r.tile.id, r.boxes, `${ROOMS[kind].title} — ${r.name.toLowerCase()}`));
    Cart.addLink(shareUrl());
    toast(`Добавлено в корзину: ${rr.length} ${plural(rr.length, 'позиция', 'позиции', 'позиций')}`);
    Cart.open();
  });
  $('#sendTg').addEventListener('click', () => {
    const text = summaryText();
    copy(text, false);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl())}&text=${encodeURIComponent(text.replace(/\nПодборка:.*$/, ''))}`, '_blank', 'noopener');
  });
  $('#sendWa').addEventListener('click', () => window.open(`https://wa.me/${S.phoneRaw}?text=${encodeURIComponent(summaryText())}`, '_blank', 'noopener'));
  $('#copyLink').addEventListener('click', () => copy(summaryText(), true));
  $('#zoomIn').addEventListener('click', () => scene && scene.zoom(0.85));
  $('#zoomOut').addEventListener('click', () => scene && scene.zoom(1.18));
  $('#resetView').addEventListener('click', () => { if (scene) { scene.reset(); markView('orbit'); } });
  function markView(mode, info) {
    $$('#views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === mode));
    const n = $('#eyeNum'); if (n) n.textContent = mode === 'inside' && info && info.count > 1 ? ` ${info.index + 1}/${info.count}` : '';
  }
  $('#views').addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b || !scene) return;
    const info = scene.setView(b.dataset.view);
    markView(scene.mode, info);
  });
  $('#fullView').addEventListener('click', () => {
    const st = $('.stage'), on = !st.classList.contains('fs');
    st.classList.toggle('fs', on); document.body.classList.toggle('noscroll', on);
    $('#fullView').setAttribute('aria-label', on ? 'Свернуть' : 'Во весь экран'); $('#fullView').textContent = on ? '✕' : '⛶';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.stage').classList.contains('fs')) $('#fullView').click(); });
  $('#printInv').addEventListener('click', () => printInvoice());
  $('#presentBtn').addEventListener('click', () => present(!document.body.classList.contains('presenting')));
  // ---- презентация на ТВ: весь экран, медленное вращение, подписи с плиткой ----
  function present(on) {
    if (!scene) return;
    const st = $('.stage');
    if (on && !st.classList.contains('fs')) $('#fullView').click();
    if (!on && st.classList.contains('fs')) $('#fullView').click();
    document.body.classList.toggle('presenting', on);
    scene.controls.autoRotate = on; scene.controls.autoRotateSpeed = 0.6; scene.dirty = true;
    if (on && scene.mode !== 'orbit') { scene.setView('orbit'); markView('orbit'); }
    const box = $('#presInfo');
    if (on) {
      const rr = rows(), total = rr.reduce((a, r) => a + r.sum, 0);
      box.innerHTML = `<b>${esc(S.name || '')}</b>${rr.map(r => `<div><span>${esc(r.name)}</span>${esc(r.tile.name)} ${sizeTitle(r.tile)}</div>`).join('')}<div class="pi-total">≈ ${money(total)}</div>`;
    }
    box.hidden = !on;
  }
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('presenting')) return;
    if (e.key === 'Escape') present(false);
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); const i = scene.setView('inside'); scene.controls.autoRotate = false; markView('inside', i); }
    if (e.key === 'ArrowLeft') { scene.setView('orbit'); scene.controls.autoRotate = true; markView('orbit'); }
  });

  // ---- накладная (A5), как в прежней программе 3D Kamron, плюс картинка комнаты ----
  function invoiceData() {
    const kind = state.room, rs = state[kind], rr = rows(), total = rr.reduce((a, r) => a + r.sum, 0);
    const dims = ROOMS[kind].plan
      ? `${ROOMS[kind].title}: ${rs.W} м × ${rs.D} м (высота ${rs.H} м), пол ${PL.area(rs.poly).toFixed(2)} м²`
      : `${ROOMS[kind].title}: дом ${rs.HW} × ${rs.HD} м, двор ${rs.Y} м²`;
    // выбранные материалы — по каждой стене, как раньше «Стена 1…4» и «Пол»
    const mats = [];
    const tline = (label, t) => mats.push({ label, name: t.name, size: sizeTitle(t), price: t.price });
    if (ROOMS[kind].plan) {
      const g = roomGeo(rs);
      if (TILED[kind]) {
        const accE = rs.accent && rs.accent.enabled ? accentEdge(rs, g) : null;
        g.edges.filter(e => e.kind !== 'open').forEach(e => {
          const t = byId(e === accE ? rs.accent.tile : wallSurf(rs, e).tile);
          tline(`Стена ${e.i + 1}${e === g.door ? ' (с дверью)' : ''}`, t);
        });
        if (rs.wallLow.enabled) tline(`Низ стен до ${rs.wallLow.height.toFixed(2)} м`, byId(rs.wallLow.tile));
      } else {
        for (const sd of ROOMS[kind].surfaces) if (!sd.isFloor && rs[sd.key].enabled !== false) tline(sd.label, byId(rs[sd.key].tile));
      }
      tline('Пол', byId(rs.floor.tile));
    } else for (const sd of ROOMS[kind].surfaces) tline(sd.label, byId(rs[sd.key].tile));
    const grout = (GROUTS.find(g => g[0] === rs.grout) || [, ''])[1];
    const items = rr.map(r => ({ name: `${r.name}: ${r.tile.name} (${sizeTitle(r.tile)} см)`, pieces: r.pieces, boxes: r.boxes, area: +r.m2.toFixed(2), sum: Math.round(r.sum) }));
    const d = new Date();
    return {
      shop: S.name || '', phone: S.phone || '', address: S.address || '', currency: S.currency || 'сум',
      number: `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`,
      date: d.toLocaleDateString('ru-RU'), dims, grout: `Затирка: ${grout.toLowerCase()}, шов ${rs.groutMm} мм`,
      materials: mats, items, total: Math.round(total), image: scene ? scene.snapshot() : ''
    };
  }
  async function printInvoice() {
    const inv = invoiceData();
    // в программе для ноутбука — печать через саму программу (PDF, как раньше)
    if (APP) {
      try {
        const r = await fetch('/app/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inv) });
        if (r.ok) { toast('Открыто окно печати накладной'); return; }
      } catch (e) { /* печатаем из браузера */ }
    }
    const cur = esc(inv.currency);
    $('#invoice').innerHTML = `
      <header><b class="inv-title">НАКЛАДНАЯ</b><h1>${esc(inv.shop)}</h1><div class="inv-no"><b>${esc(inv.phone)}</b><span>${esc(inv.address)}</span><span>№ ${inv.number} · ${inv.date}</span></div></header>
      <div class="inv-main">${inv.image ? `<img src="${inv.image}" alt="">` : ''}
        <div><p class="inv-room">Размеры помещения: ${esc(inv.dims)}</p><p>${esc(inv.grout)}</p>
          <p class="inv-h">ВЫБРАННЫЕ МАТЕРИАЛЫ:</p>
          ${inv.materials.map(m => `<p class="inv-m">• ${esc(m.label)}: ${esc(m.name)} (${esc(m.size)} см) — ${fmt(m.price)} ${cur}/м²</p>`).join('')}</div></div>
      <p class="inv-h">ИТОГОВЫЙ РАСЧЁТ:</p>
      <table><tbody>${inv.items.map(i => `<tr><td>${esc(i.name)} (${i.pieces} шт. / ${i.boxes} кор. / ${i.area.toFixed(2)} м²)</td><td>${fmt(i.sum)} ${cur}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>ИТОГО К ОПЛАТЕ:</td><td>${fmt(inv.total)} ${cur}</td></tr></tfoot></table>
      <p class="inv-foot">Спасибо за выбор ${esc(inv.shop)}!</p>`;
    setTimeout(() => window.print(), 50);
  }

  $('#savePic').addEventListener('click', () => {
    if (!scene) return;
    const a = document.createElement('a'); a.href = scene.snapshot(); a.download = 'moya-plitka.jpg'; a.click();
  });

  function copy(text, notify) {
    const done = () => notify && toast('Подборка скопирована. Отправьте её нам в любом мессенджере');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------------- карточки, каталог, новинки, размеры ----------------
  const STYLES = window.STYLES || [], SIZES = window.SIZES || [];
  const sizeKey = t => `${Math.min(t.w, t.h)}x${Math.max(t.w, t.h)}`;
  const sizeTitle = t => `${Math.min(t.w, t.h)}×${Math.max(t.w, t.h)}`;
  const USE = { wall: 'стены', floor: 'пол', plinth: 'цоколь', outdoor: 'улица' };
  function cardHTML(t) {
    return `<article class="card">
      <div class="card-img"><canvas data-card="${esc(t.id)}" width="400" height="500"></canvas>
        ${t.isNew ? '<span class="badge new">Новинка</span>' : ''}${t.inStock ? '' : '<span class="badge">Под заказ</span>'}
        <span class="card-size">${sizeTitle(t)} см</span></div>
      <div class="card-body">
        <h3>${esc(t.name)}</h3>
        <p class="meta">${esc(t.finish || '')}${t.country ? ' · ' + esc(t.country) : ''} · ${t.use.map(u => USE[u]).filter(Boolean).join(', ')}</p>
        <div class="price">${money(t.price)}<small>/м²</small>${S.usdRate ? `<span class="usd">${usd(t.price)} за м² · ${t.box} м² в коробке</span>` : ''}</div>
        <div class="card-foot"><button class="btn btn-sm" data-try="${esc(t.id)}">Примерить в 3D</button><button class="btn btn-sm btn-ghost" data-buy="${esc(t.id)}" aria-label="В корзину">＋</button></div>
      </div></article>`;
  }
  let io = null;
  function paintLazy(root) {
    if (!io && 'IntersectionObserver' in window) io = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { paintCard(x.target); io.unobserve(x.target); } }), { rootMargin: '300px' });
    $$('canvas[data-card]', root).forEach(cv => io ? io.observe(cv) : paintCard(cv));
  }
  function fillGrid(el, list) { el.innerHTML = list.map(cardHTML).join('') || '<p class="muted">Скоро здесь появятся новые поставки.</p>'; paintLazy(el); }
  function paintCard(cv) {
    const t = byId(cv.dataset.card); if (!t) return;
    // карточка 4:5 — одна плита крупным планом, формат подписан на бейдже
    cv.getContext('2d').drawImage(T.swatch(t, cv.width, cv.height, { across: 0.92 }), 0, 0);
  }

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
  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

  function newList() {
    const n = CAT.filter(t => t.isNew);
    return n.length ? n : CAT.slice(0, 8);
  }
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

  // «Примерить» — подставить плитку на подходящую поверхность и открыть конструктор
  function tryTile(t) {
    let room = state.room;
    const fits = r => ROOMS[r].surfaces.some(sd => t.use.includes(sd.use));
    const outdoorOnly = !t.use.includes('floor') && !t.use.includes('wall');
    if (!fits(room) || outdoorOnly) room = outdoorOnly ? 'plinth' : t.use.includes('wall') ? 'bath' : 'living';
    if (room === 'wc' && !fits('wc')) room = 'bath';
    const cand = ROOMS[room].surfaces.filter(sd => t.use.includes(sd.use));
    const sd = (room === 'bath' && t.use.includes('floor') ? cand.find(s => s.key === 'floor') : null) || cand.find(s => !s.optional) || cand[0];
    state.room = room;
    const sf = state[room][sd.key];
    Object.assign(sf, { tile: t.id, enabled: true, ox: 0, oy: 0,
      layout: t.defaultLayout && layoutsFor(t).includes(t.defaultLayout) ? t.defaultLayout : 'straight' });
    renderTabs(); changed(true);
    location.hash = '#/constructor';
    toast(`«${t.name}»: ${ROOMS[room].title.toLowerCase()}, ${sd.label.toLowerCase()}`);
  }
  document.addEventListener('click', e => {
    const tr = e.target.closest('[data-try]'), by = e.target.closest('[data-buy]');
    if (tr) { const t = byId(tr.dataset.try); if (t) tryTile(t); }
    if (by) {
      const t = byId(by.dataset.buy); if (!t) return;
      Cart.add(t.id, 1, 'из каталога');
      toast(`«${t.name}»: 1 коробка (${t.box} м²) в корзине`);
    }
  });

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

  // ---------------- данные магазина ----------------
  function fillShop() {
    $$('[data-shop]').forEach(el => { el.textContent = S[el.dataset.shop] || ''; });
    $$('[data-shop-tel]').forEach(el => { el.href = 'tel:+' + S.phoneRaw; });
    $$('[data-shop-tg]').forEach(el => { el.href = 'https://t.me/' + S.telegram; });
    $$('[data-shop-wa]').forEach(el => { el.href = 'https://wa.me/' + S.phoneRaw; });
    $$('[data-shop-map]').forEach(el => { el.href = S.mapUrl || '#/contacts'; });
    $$('[data-hold]').forEach(el => { el.textContent = S.holdDays; });
    $$('[data-delivery]').forEach(el => { el.textContent = S.deliveryNote || ''; });
    $$('[data-years]').forEach(el => { el.textContent = (+S.years || 20) + '+'; });
    $('#year').textContent = new Date().getFullYear();
  }

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
    const rs = state.bath, f = byId(rs.floor.tile), w = byId(rs.wall.tile);
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
  // Режим программы для магазина (ноутбук + ТВ): открывается с ?app=1
  const APP = new URLSearchParams(location.search).get('app') === '1';
  if (APP) document.body.classList.add('app');
  let curPage = null, heroIO = null;
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
      if (r.page === 'catalog') { const st = r.query.get('style'); if (st) catStyle = st; renderCatalog(); }
      if (r.page === 'new') fillGrid($('#newGrid'), newList());
      if (r.page === 'sizes') renderSizes(r.param);
      if (r.page === 'home') observeReveal();
      place3d(r.page);
      if (curPage !== r.page) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      curPage = r.page;
      const titles = { home: '', constructor: '3D-конструктор', new: 'Новинки', sizes: 'Размеры', catalog: 'Каталог', contacts: 'Контакты' };
      document.title = (titles[r.page] ? titles[r.page] + ' — ' : '') + (S.name || '') + ' · крупноформатный керамогранит';
    };
    if (curPage && curPage !== r.page && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go);
    else go();
  }
  // один WebGL-холст: витрина на главной или рабочая сцена в конструкторе
  function place3d(page) {
    if (!scene) return;
    if (page === 'home') {
      scene.attach($('#heroStage'));
      if (state.room !== 'bath') { state.room = 'bath'; renderTabs(); renderPanel(); render(); }
      scene.showcase(true);
      scene.paused = false;
      if (!heroIO && 'IntersectionObserver' in window) {
        heroIO = new IntersectionObserver(en => { if (curPage === 'home') scene.paused = !en[0].isIntersecting || document.hidden; }, { threshold: 0.02 });
        heroIO.observe($('#heroStage'));
      }
    } else if (page === 'constructor') {
      scene.attach(viewport); scene.showcase(false); scene.paused = false;
    } else scene.paused = true;
  }
  document.addEventListener('visibilitychange', () => { if (scene && curPage !== 'constructor') scene.paused = document.hidden || curPage !== 'home'; });
  window.addEventListener('hashchange', route);
  $('#menuSizes').innerHTML = SIZES.map(z => `<a href="#/sizes/${z.w}x${z.h}">${z.title}</a>`).join('');

  // ---------------- старт ----------------
  // На сервере каталог и настройки берутся из админки; без сервера — из js/catalog.js и js/config.js
  async function boot() {
    if (/^https?:/.test(location.protocol)) {
      try {
        const r = await fetch('api/catalog', { cache: 'no-cache' });
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j.products) && j.products.length) { CAT.length = 0; j.products.forEach(p => CAT.push(p)); }
          if (j.settings) Object.assign(S, j.settings);
        }
      } catch (e) { /* сервер недоступен — показываем встроенный каталог */ }
    }
    state = loadState();
    fillShop();
    renderTabs();
    renderPanel();
    Cart.render();
    renderHome();
    heroNow();
    route();
    render();
  }
  boot();
})();
