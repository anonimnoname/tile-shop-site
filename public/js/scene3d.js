// 3D-сцена на three.js.
// Реалистичность: отражения в полированном керамограните (Reflector), мягкие тени (VSM),
// затенение в углах (GTAO), лак/глянец (clearcoat), нейтральная цветопередача,
// плавные пролёты камеры, витрина с авто-вращением для главной страницы.
// План (x, y) в метрах → мир (x, 0, y).
(function () {
  'use strict';
  const THREE = window.THREE;

  const MAT = {};
  const std = (key, o) => MAT[key] || (MAT[key] = new THREE.MeshStandardMaterial(o));
  const phys = (key, o) => MAT[key] || (MAT[key] = new THREE.MeshPhysicalMaterial(o));
  const M = {
    ceramic: () => phys('ceramic', { color: 0xfbfbf9, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
    chrome: () => std('chrome', { color: 0xf0f2f4, roughness: 0.06, metalness: 1 }),
    brass: () => std('brass', { color: 0xc9a46a, roughness: 0.25, metalness: 1 }),
    black: () => std('black', { color: 0x141516, roughness: 0.35, metalness: 0.3 }),
    mirror: () => MAT.mirror || (MAT.mirror = new THREE.MeshPhysicalMaterial({ map: mirrorTexture(), roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0 })),
    water: () => phys('water', { color: 0xdfe9ee, roughness: 0.02, clearcoat: 1 }),
    oak: () => std('oak', { color: 0xa47c55, roughness: 0.55 }),
    walnut: () => std('walnut', { color: 0x5e4130, roughness: 0.5 }),
    front: () => std('front', { color: 0xe9e4db, roughness: 0.55 }),
    frontDark: () => std('frontDark', { color: 0x2f3134, roughness: 0.6 }),
    carcass: () => std('carcass', { color: 0xdcd6cc, roughness: 0.7 }),
    stone: () => phys('stone', { color: 0xeeeae3, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
    steel: () => std('steel', { color: 0xc4c9cd, roughness: 0.22, metalness: 1 }),
    fabric: () => std('fabric', { color: 0xc8c0b4, roughness: 1 }),
    fabric2: () => std('fabric2', { color: 0xd6cfc4, roughness: 1 }),
    pillow: () => std('pillow', { color: 0x8a6a4f, roughness: 1 }),
    towel: () => std('towel', { color: 0xf1ece4, roughness: 1 }),
    leaf: () => std('leaf', { color: 0x47704a, roughness: 0.7, flatShading: true }),
    pot: () => std('pot', { color: 0xd9d2c7, roughness: 0.85 }),
    cap: () => std('cap', { color: 0x3f3d3a, roughness: 0.9 }),
    plaster: () => std('plaster', { color: 0xf3f0ea, roughness: 0.95 }),
    ceiling: () => std('ceiling', { color: 0xf7f5f1, roughness: 1, side: THREE.BackSide }),
    glow: () => std('glow', { color: 0xfff1da, emissive: 0xffe6c0, emissiveIntensity: 2.2 }),
    shade: () => std('shade', { color: 0xf3ead9, roughness: 0.9, emissive: 0xffdcaa, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
    glass: () => phys('glass', { color: 0xdfeef0, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 1 }),
    winGlass: () => std('winGlass', { color: 0xbfd8e8, roughness: 0.05, metalness: 0.6, emissive: 0x9fc0d8, emissiveIntensity: 0.25 }),
    frame: () => std('frame', { color: 0xf5f5f3, roughness: 0.5 }),
    roof: () => std('roof', { color: 0x4a4c50, roughness: 0.7 }),
    ledge: () => std('ledge', { color: 0x5f6164, roughness: 0.45, metalness: 0.5 }),
    door: () => std('door', { color: 0x6a4b35, roughness: 0.45 }),
    concrete: () => std('concrete', { color: 0xb3afa8, roughness: 0.95 })
  };

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function rbox(w, h, d, r, m) {
    const g = new THREE.RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }
  function box(w, h, d, m) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.castShadow = mesh.receiveShadow = true; return mesh; }
  function cyl(rt, rb, h, m, seg = 32) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); mesh.castShadow = mesh.receiveShadow = true; return mesh; }
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  class Scene3D {
    constructor(host) {
      this.host = host;
      this.high = window.matchMedia('(pointer: fine)').matches && Math.min(screen.width, screen.height) > 700;
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: !this.high, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.high ? 1.75 : 2));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
      r.shadowMap.autoUpdate = false; // сцена неподвижна — тени считаем только при изменениях
      r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
      r.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(r.domElement);
      this.maxAniso = r.capabilities.getMaxAnisotropy();

      const s = this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(r);
      s.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
      s.environmentIntensity = 0.5;

      this.camera = new THREE.PerspectiveCamera(40, 1, 0.03, 300);
      const c = this.controls = new THREE.OrbitControls(this.camera, r.domElement);
      c.enableDamping = true; c.dampingFactor = 0.07; c.enablePan = false; c.rotateSpeed = 0.8;
      c.maxPolarAngle = Math.PI * 0.47;
      c.addEventListener('change', () => this.dirty = true);
      c.addEventListener('start', () => { this.anim = null; this.userTouched = true; });

      this.hemi = new THREE.HemisphereLight(0xfffaf2, 0xb7ab99, 0.9); s.add(this.hemi);
      const d = this.sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
      d.castShadow = true; d.shadow.mapSize.set(2048, 2048); d.shadow.bias = -0.0003; d.shadow.normalBias = 0.015;
      d.shadow.radius = 7; d.shadow.blurSamples = 14;
      s.add(d); s.add(d.target);
      this.lamps = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffe2bd, 0, 8, 1.7); s.add(l); return l; });

      this.group = new THREE.Group(); s.add(this.group);
      this.walls = []; this.pillars = []; this.eyes = []; this.eyeIndex = 0; this.mode = 'orbit'; this.kind = null;

      if (this.high) {
        try {
          const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType });
          const comp = this.composer = new THREE.EffectComposer(r, rt);
          comp.addPass(new THREE.RenderPass(s, this.camera));
          const ao = this.ao = new THREE.GTAOPass(s, this.camera, 2, 2);
          ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
          ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
          ao.blendIntensity = 0.9;
          comp.addPass(ao);
          comp.addPass(new THREE.OutputPass());
        } catch (e) { this.composer = null; }
      }

      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
      this.resize();
      const loop = () => {
        requestAnimationFrame(loop);
        if (this.paused) return;
        this.step();
        if (this.controls.update()) this.dirty = true;
        if (this.dirty) { this.dirty = false; this.draw(); }
      };
      loop();
    }

    draw() {
      this.cutaway();
      if (this.composer && !this.cheap) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    }

    // Переносим холст между витриной на главной и конструктором
    attach(host) {
      if (this.host === host) return;
      this.ro.unobserve(this.host);
      this.host = host; host.appendChild(this.renderer.domElement);
      this.ro.observe(host); this.resize();
    }
    // Витрина: медленное вращение, без управления (чтобы не мешать прокрутке страницы)
    showcase(on) {
      const c = this.controls;
      this.shiftX = on ? 1 : 0; this.resize();
      if (on && this.mode !== 'orbit') this.setView('orbit');
      c.autoRotate = on && !matchMedia('(prefers-reduced-motion: reduce)').matches; c.autoRotateSpeed = 0.5; c.enabled = !on;
      if (this._center) { const [p, t] = this.orbitPose(false); this.pose(p, t, 40); }
      this.renderer.domElement.style.pointerEvents = on ? 'none' : '';
      this.dirty = true;
    }

    resize() {
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      if (this.composer) { this.composer.setSize(w, h); this.composer.setPixelRatio(this.renderer.getPixelRatio()); }
      this.camera.aspect = w / h;
      // на главной сдвигаем комнату вправо, чтобы слева был виден текст
      if (this.shiftX && w > 860) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      if (this.reflector) { const pr = this.renderer.getPixelRatio(); this.reflector.getRenderTarget().setSize(w * pr * 0.6, h * pr * 0.6); }
      this.dirty = true;
    }

    tex(canvas, color) {
      const t = new THREE.CanvasTexture(canvas);
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.maxAniso;
      return t;
    }
    // Поверхность из плитки: цвет + рельеф швов + шероховатость; глянец — лаком
    surfaceMat(set, bumpScale, extra) {
      const gloss = set.gloss || 0;
      return new THREE.MeshPhysicalMaterial(Object.assign({
        map: this.tex(set.color, true), bumpMap: this.tex(set.bump), bumpScale: bumpScale || 3,
        roughnessMap: this.tex(set.rough), roughness: 1, metalness: 0,
        clearcoat: gloss > 0.4 ? gloss * 0.9 : 0, clearcoatRoughness: 0.05,
        envMapIntensity: 0.8
      }, extra));
    }

    clear() {
      const own = new Set(Object.values(MAT));
      this.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach(m => {
          if (own.has(m)) return;
          ['map', 'bumpMap', 'roughnessMap'].forEach(k => m[k] && m[k].dispose());
          m.dispose();
        });
      });
      if (this.reflector) { this.reflector.getRenderTarget().dispose(); this.reflector = null; }
      this.group.clear(); this.walls = []; this.pillars = []; this.ceiling = null;
      this._shadowSig = null; this.renderer.shadowMap.needsUpdate = true;
    }

    // ---------- камера ----------
    pose(pos, target, fov, instant) {
      const cam = this.camera, c = this.controls;
      const to = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), fov };
      if (instant || !this.built) {
        cam.position.copy(to.pos); c.target.copy(to.target); cam.fov = fov; cam.updateProjectionMatrix(); this.anim = null;
      } else {
        this.anim = { from: { pos: cam.position.clone(), target: c.target.clone(), fov: cam.fov }, to, t0: performance.now(), dur: 1100 };
      }
      this.dirty = true;
    }
    step() {
      const a = this.anim; if (!a) return;
      const t = Math.min(1, (performance.now() - a.t0) / a.dur), k = ease(t);
      this.camera.position.lerpVectors(a.from.pos, a.to.pos, k);
      this.controls.target.lerpVectors(a.from.target, a.to.target, k);
      this.camera.fov = a.from.fov + (a.to.fov - a.from.fov) * k; this.camera.updateProjectionMatrix();
      this.dirty = true;
      if (t >= 1) { this.anim = null; if (a.done) a.done(); }
    }
    limits(inside) {
      const c = this.controls;
      if (inside) {
        c.minDistance = c.maxDistance = 0.02; c.enableZoom = false; c.rotateSpeed = -0.32;
        c.minPolarAngle = Math.PI * 0.25; c.maxPolarAngle = Math.PI * 0.72;
      } else {
        c.enableZoom = true; c.rotateSpeed = 0.8;
        c.minPolarAngle = 0.02; c.maxPolarAngle = Math.PI * 0.47;
        c.minDistance = this._size * 0.4; c.maxDistance = this._size * 3.4;
      }
    }
    orbitPose(top) {
      const [cx, cy, cz] = this._center, size = this._size, plinth = this.kind === 'plinth';
      const dist = size * (this.camera.aspect < 1 ? 2.75 : 1.95) * (this.shiftX ? 1.3 : 1);
      const az = plinth ? 0.6 : 0.55, pol = top ? 0.02 : plinth ? 1.12 : 0.9;
      return [[cx + dist * Math.sin(pol) * Math.sin(az), cy + dist * Math.cos(pol), cz + dist * Math.sin(pol) * Math.cos(az)], [cx, cy, cz]];
    }
    frame(kind, center, size) {
      const changed = this.kind !== kind;
      this._center = center; this._size = size; this.kind = kind;
      if (this.ceiling) this.ceiling.visible = this.mode === 'inside';
      if (changed) this.mode = 'orbit';
      if (this.mode === 'inside') { this.setView('inside', true); return; }
      this.limits(false);
      if (changed || !this.built) {
        const [p, t] = this.orbitPose(this.mode === 'top');
        // въезд камеры при первом показе
        if (!this.built) { const far = p.map((v, i) => t[i] + (v - t[i]) * 1.6); this.pose(far, t, 40, true); this.built = true; }
        this.pose(p, t, 40);
      } else this.controls.target.set(...center);
      this.dirty = true;
    }
    setView(mode, keep) {
      if (mode === 'inside' && !this.eyes.length) mode = 'orbit';
      if (!keep) this.eyeIndex = mode === 'inside' && this.mode === 'inside' ? this.eyeIndex + 1 : 0;
      this.eyeIndex %= Math.max(1, this.eyes.length);
      this.mode = mode;
      if (this.ceiling) this.ceiling.visible = mode === 'inside';
      if (mode === 'inside') {
        const e = this.eyes[this.eyeIndex];
        const d = new THREE.Vector3(e.look[0] - e.pos[0], e.look[1] - e.pos[1], e.look[2] - e.pos[2]).normalize();
        const tgt = [e.pos[0] + d.x * 0.02, e.pos[1] + d.y * 0.02, e.pos[2] + d.z * 0.02];
        this.controls.minDistance = 0; this.controls.maxDistance = Infinity;
        this.pose(e.pos, tgt, 66, keep);
        if (this.anim) this.anim.done = () => this.limits(true); else this.limits(true);
      } else {
        this.limits(false);
        const [p, t] = this.orbitPose(mode === 'top');
        this.pose(p, t, 40);
      }
      return { index: this.eyeIndex, count: this.eyes.length };
    }
    zoom(k) {
      if (this.mode === 'inside') return;
      const c = this.controls, v = this.camera.position.clone().sub(c.target);
      const len = Math.min(c.maxDistance, Math.max(c.minDistance, v.length() * k));
      this.pose(c.target.clone().add(v.setLength(len)).toArray(), c.target.toArray(), this.camera.fov);
    }
    reset() { return this.setView('orbit'); }
    snapshot() { this.draw(); return this.renderer.domElement.toDataURL('image/jpeg', 0.92); }

    // Стены между камерой и комнатой прячем; изнутри видно всё
    cutaway() {
      const cp = this.camera.position, inside = this.mode === 'inside';
      for (const w of this.walls) {
        if (!w.mesh) continue;
        const vis = inside || (cp.x - w.mid[0]) * w.n[0] + (cp.z - w.mid[1]) * w.n[1] > -0.05;
        w.mesh.visible = vis; w.stub.visible = !vis;
        w.attached.forEach(o => o.visible = vis);
      }
      const sig = this.walls.map(w => w.mesh && w.mesh.visible ? 1 : 0).join('');
      if (sig !== this._shadowSig) { this._shadowSig = sig; this.renderer.shadowMap.needsUpdate = true; }
      const up = i => !this.walls[i] || !this.walls[i].mesh || this.walls[i].mesh.visible;
      for (const p of this.pillars) {
        p.mesh.scale.y = up(p.a) && up(p.b) ? 1 : p.low;
        p.mesh.position.y = p.mesh.scale.y * p.h / 2;
      }
    }

    // ---------- помещение ----------
    buildRoom(d) {
      this.clear();
      const { poly, H, edges } = d;
      this.scene.background = new THREE.Color(0xe9e4dc); this.scene.fog = null;
      this.scene.environmentIntensity = 0.5;
      const bb = window.Plan.bbox(poly);

      // геометрия пола в плоскости XY (для Reflector), повернём на −90° по X
      const contour = poly.map(([x, y]) => new THREE.Vector2(x, -y));
      let tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const pos = [], uv = [];
      for (const [x, y] of poly) { pos.push(x, -y, 0); uv.push((x - bb.x) / bb.w, 1 - (y - bb.y) / bb.h); }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      fg.setIndex(tris.flat()); fg.computeVertexNormals();
      if (fg.attributes.normal.getZ(0) < 0) { tris = tris.map(t => [t[0], t[2], t[1]]); fg.setIndex(tris.flat()); fg.computeVertexNormals(); }

      const gloss = d.floor.gloss || 0;
      const reflect = gloss >= 0.5 ? 0.1 + gloss * 0.14 : 0; // доля отражения у полированного керамогранита
      const floor = new THREE.Mesh(fg, this.surfaceMat(d.floor, 3, reflect ? { transparent: true, opacity: 1 - reflect, depthWrite: true } : {}));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.renderOrder = 1;
      this.group.add(floor);
      if (reflect) {
        const w = this.host.clientWidth || 800, h = this.host.clientHeight || 600, pr = this.renderer.getPixelRatio();
        const ref = this.reflector = new THREE.Reflector(fg.clone(), { textureWidth: w * pr * 0.6, textureHeight: h * pr * 0.6, color: 0xb5b5b5, clipBias: 0.003 });
        ref.rotation.x = -Math.PI / 2; ref.position.y = -0.002;
        this.group.add(ref);
      }
      const base = new THREE.Mesh(new THREE.PlaneGeometry(bb.w + 4, bb.h + 4), std('base', { color: 0xd8d1c6, roughness: 1 }));
      base.rotation.x = -Math.PI / 2; base.position.set(bb.x + bb.w / 2, -0.01, bb.y + bb.h / 2); base.receiveShadow = true;
      this.group.add(base);

      // стены
      const T = 0.12;
      edges.forEach((e, i) => {
        if (e.kind === 'open') { this.walls.push({ mesh: null, n: e.n, mid: e.mid, attached: [] }); return; }
        const inner = this.surfaceMat(d.walls[i], 2.2);
        const plain = M.plaster(), cap = M.cap();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(e.len, H, T), [plain, plain, cap, plain, inner, plain]);
        const theta = Math.atan2(e.n[0], e.n[1]);
        mesh.rotation.y = theta;
        const lx = [Math.cos(theta), -Math.sin(theta)];
        if (lx[0] * e.dir[0] + lx[1] * e.dir[1] < 0) for (const k of ['map', 'bumpMap', 'roughnessMap']) { const t = inner[k]; t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
        mesh.position.set(e.mid[0] - e.n[0] * T / 2, H / 2, e.mid[1] - e.n[1] * T / 2);
        mesh.castShadow = mesh.receiveShadow = true;
        const stub = new THREE.Mesh(new THREE.BoxGeometry(e.len, 0.14, T), [cap, cap, cap, cap, plain, cap]);
        stub.rotation.y = theta; stub.position.set(mesh.position.x, 0.07, mesh.position.z); stub.receiveShadow = true;
        this.group.add(mesh, stub);
        this.walls.push({ mesh, stub, n: e.n, mid: e.mid, attached: [] });
      });
      poly.forEach((v, i) => {
        const a = (i - 1 + poly.length) % poly.length, b = i, ea = edges[a], eb = edges[b];
        if (ea.kind === 'open' && eb.kind === 'open') return;
        const m = box(T, H, T, [M.plaster(), M.plaster(), M.cap(), M.plaster(), M.plaster(), M.plaster()]);
        m.position.set(v[0] - (ea.n[0] + eb.n[0]) * T / 2, H / 2, v[1] - (ea.n[1] + eb.n[1]) * T / 2);
        m.rotation.y = Math.atan2(eb.n[0], eb.n[1]);
        this.group.add(m); this.pillars.push({ mesh: m, a, b, h: H, low: 0.14 / H });
      });

      // потолок со встроенными светильниками — виден только «изнутри»
      const ceil = new THREE.Group();
      const cg = new THREE.Mesh(fg.clone(), M.ceiling()); cg.rotation.x = -Math.PI / 2; cg.position.y = H; ceil.add(cg);
      const cx = bb.x + bb.w / 2, cz = bb.y + bb.h / 2, size = Math.max(bb.w, bb.h, H);
      const spots = [];
      for (let x = bb.x + 0.6; x < bb.x + bb.w - 0.3; x += 1.2) for (let y = bb.y + 0.6; y < bb.y + bb.h - 0.3; y += 1.2) if (window.Plan.inside([x, y], poly)) spots.push([x, y]);
      spots.slice(0, 24).forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), M.glow()); s.rotation.x = Math.PI / 2; s.position.set(x, H - 0.002, y); ceil.add(s); });
      ceil.visible = this.mode === 'inside'; this.ceiling = ceil; this.group.add(ceil);

      // свет: «окно» — тёплый солнечный луч, плюс мягкие лампы под потолком
      this.sun.position.set(cx + size * 0.7, H + size * 1.5, cz + size * 1.1);
      this.sun.target.position.set(cx, 0, cz);
      const sc = this.sun.shadow.camera, ext = size * 1.2;
      Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: size * 6 }); sc.updateProjectionMatrix();
      this.sun.intensity = 2.4; this.hemi.intensity = 0.95;
      const lampPts = spots.length ? [spots[0], spots[Math.floor(spots.length / 2)], spots[spots.length - 1]] : [[cx, cz]];
      this.lamps.forEach((l, i) => { const p = lampPts[i] || lampPts[0]; l.position.set(p[0], H - 0.35, p[1]); l.intensity = 2.2; l.distance = size * 2.2; });
      if (this.ao) this.ao.updateGtaoMaterial({ radius: 0.45 });

      this._size = size;
      this.fixtures(d);
      if (d.door != null) this.door(edges[d.door]);
      (d.windows || []).forEach(i => this.window(edges[i], 1.4, 1.5, 0.8));

      // точки «изнутри»
      const P = window.Plan, inPt = (x, y) => P.inside([x, y], poly);
      const order = edges.filter(e => e.len >= 0.9).sort((a, b) => (b.i === d.door) - (a.i === d.door) || (b.kind !== 'wall') - (a.kind !== 'wall') || b.len - a.len);
      this.eyes = [];
      for (const e of order) {
        const back = e.kind === 'wall' ? 0.35 : 0.5;
        const px = e.mid[0] + e.n[0] * back, py = e.mid[1] + e.n[1] * back;
        let reach = 0.5;
        while (reach < size * 2 && inPt(e.mid[0] + e.n[0] * (reach + 0.2), e.mid[1] + e.n[1] * (reach + 0.2))) reach += 0.2;
        if (!inPt(px, py) || reach < 1.2) continue;
        this.eyes.push({ pos: [px, 1.55, py], look: [e.mid[0] + e.n[0] * reach, 1.15, e.mid[1] + e.n[1] * reach] });
        if (this.eyes.length >= 5) break;
      }
      this.frame(d.kind, [cx, H * 0.3, cz], size);
    }

    place(o, e, along, off, wallMounted) {
      o.rotation.y = Math.atan2(e.n[0], e.n[1]);
      o.position.x = e.a[0] + e.dir[0] * along + e.n[0] * off;
      o.position.z = e.a[1] + e.dir[1] * along + e.n[1] * off;
      this.group.add(o);
      if (wallMounted) this.walls[e.i].attached.push(o);
      return o;
    }

    fixtures(d) {
      const { kind, edges } = d;
      const solid = edges.filter(e => e.kind === 'wall');
      const main = (solid.length ? solid : edges).slice().sort((a, b) => b.len - a.len)[0];
      const prev = edges[(main.i - 1 + edges.length) % edges.length];
      const next = edges[(main.i + 1) % edges.length];
      if (kind === 'bath') {
        // отдельностоящая ванна, подвесная тумба, круглое зеркало с подсветкой, стеклянная перегородка
        const tw = Math.max(1.3, Math.min(1.7, main.len - 1.0));
        this.place(this.bathtub(tw), main, tw / 2 + 0.15, 0.48);
        this.place(this.floorFaucet(), main, tw + 0.25, 0.75);
        const rest = main.len - tw - 0.3;
        if (rest >= 0.6) {
          const vw = Math.min(1.0, rest - 0.05), vx = main.len - vw / 2 - 0.05;
          this.place(this.vanity(vw), main, vx, 0);
          this.place(this.roundMirror(Math.min(0.75, vw * 0.85)), main, vx, 0, true);
        }
        if (prev.kind === 'wall' && prev.len >= 1.6 && prev.i !== d.door) {
          this.place(this.toilet(), prev, prev.len * 0.55, 0);
          this.place(this.plant(0.7), prev, Math.max(0.3, prev.len * 0.55 - 0.65), 0.25);
        }
      } else if (kind === 'wc') {
        // унитаз напротив двери, маленькая раковина с зеркалом на боковой стене
        const dEdge = d.door != null ? edges[d.door] : null;
        const ws = edges.filter(e => e.kind === 'wall' && e !== dEdge);
        let far = ws[0] || main;
        if (dEdge) { let best = Infinity; for (const e of ws) { const sc = e.n[0] * dEdge.n[0] + e.n[1] * dEdge.n[1]; if (sc < best) { best = sc; far = e; } } }
        this.place(this.toilet(), far, far.len / 2, 0);
        const side = ws.filter(e => e !== far && e.len >= 1.1).sort((a, b) => b.len - a.len)[0];
        if (side) {
          const at = Math.min(side.len - 0.35, Math.max(0.35, side.len * 0.4));
          this.place(this.vanity(0.5), side, at, 0);
          this.place(this.roundMirror(0.45), side, at, 0, true);
        }
      } else if (kind === 'kitchen') {
        this.kitchen(main);
      } else if (kind === 'living') {
        const sw = Math.min(2.4, main.len * 0.6);
        this.place(this.sofa(sw), main, main.len / 2, 0.08);
        this.place(this.coffeeTable(), main, main.len / 2, 1.5);
        this.place(this.plant(1.1), main, Math.max(0.35, main.len / 2 - sw / 2 - 0.45), 0.35);
        this.place(this.floorLamp(), main, Math.min(main.len - 0.35, main.len / 2 + sw / 2 + 0.4), 0.3);
        this.place(this.art(Math.min(1.4, sw * 0.6), 0.9), main, main.len / 2, 0.01, true);
      }
    }

    bathtub(L) {
      // овальная ванна: профиль вращения, растянутый по длине
      const g = new THREE.Group(), W = 0.78;
      const prof = [[0, 0], [0.42, 0], [0.47, 0.06], [0.5, 0.35], [0.5, 0.56], [0.47, 0.58], [0.44, 0.56], [0.43, 0.2], [0.38, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
      const tub = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.ceramic());
      tub.scale.set(L, 1, W); tub.castShadow = tub.receiveShadow = true; g.add(tub);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.43, 64), M.water());
      water.rotation.x = -Math.PI / 2; water.scale.set(L, W, 1); water.position.y = 0.42; g.add(water);
      return g;
    }
    floorFaucet() {
      const g = new THREE.Group();
      g.add(at(cyl(0.018, 0.018, 0.95, M.chrome()), 0, 0.475, 0));
      g.add(at(cyl(0.05, 0.05, 0.01, M.chrome()), 0, 0.005, 0));
      const sp = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 12, 32, Math.PI), M.chrome());
      sp.position.set(0, 0.95, -0.1); sp.rotation.y = Math.PI / 2; sp.castShadow = true; g.add(sp);
      return g;
    }
    vanity(w) {
      const g = new THREE.Group(), D = 0.5;
      g.add(at(rbox(w, 0.42, D, 0.01, M.walnut()), 0, 0.62, D / 2));
      g.add(at(box(w * 0.98, 0.004, 0.006, M.black()), 0, 0.62, D + 0.003));
      g.add(at(rbox(w + 0.02, 0.04, D + 0.02, 0.006, M.stone()), 0, 0.85, D / 2));
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.2, 0.12], [0.19, 0.125], [0.16, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y)), 48), M.ceramic());
      bowl.position.set(0, 0.87, D / 2 + 0.02); bowl.castShadow = true; g.add(bowl);
      g.add(at(cyl(0.012, 0.012, 0.3, M.brass()), 0, 1.02, 0.09));
      const sp = at(cyl(0.01, 0.01, 0.16, M.brass()), 0, 1.16, 0.16); sp.rotation.x = Math.PI / 2; g.add(sp);
      return g;
    }
    roundMirror(dm) {
      const g = new THREE.Group(), y = 1.55;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(dm / 2 + 0.01, 0.012, 12, 64), M.glow()); halo.position.set(0, y, 0.015); g.add(halo);
      const m = new THREE.Mesh(new THREE.CircleGeometry(dm / 2, 64), M.mirror()); m.position.set(0, y, 0.03); g.add(m);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(dm / 2, dm / 2, 0.025, 64), M.black()); back.rotation.x = Math.PI / 2; back.position.set(0, y, 0.016); g.add(back);
      return g;
    }
    toilet() {
      const g = new THREE.Group();
      g.add(at(rbox(0.36, 0.34, 0.54, 0.12, M.ceramic()), 0, 0.42, 0.3));
      g.add(at(rbox(0.37, 0.03, 0.5, 0.05, M.ceramic()), 0, 0.605, 0.31));
      g.add(at(box(0.2, 0.14, 0.01, M.chrome()), 0, 1.05, 0.005));
      return g;
    }
    towelLadder() {
      const g = new THREE.Group();
      for (const x of [-0.22, 0.22]) { const r = at(cyl(0.012, 0.012, 1.7, M.walnut(), 12), x, 0.85, 0.12); r.rotation.x = -0.12; g.add(r); }
      for (let i = 0; i < 4; i++) g.add(at(cyl(0.01, 0.01, 0.44, M.walnut(), 12), 0, 0.4 + i * 0.38, 0.17 - i * 0.045).rotateZ(Math.PI / 2));
      g.add(at(rbox(0.4, 0.5, 0.05, 0.02, M.towel()), 0, 1.12, 0.1));
      return g;
    }
    kitchen(e) {
      const L = e.len - 0.06, start = 0.03, n = Math.max(1, Math.round(L / 0.6)), dw = L / n;
      const base = new THREE.Group(), up = new THREE.Group();
      base.add(at(box(L, 0.1, 0.5, M.black()), 0, 0.05, 0.26));
      base.add(at(box(L, 0.74, 0.56, M.carcass()), 0, 0.47, 0.28));
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + dw * (i + 0.5);
        base.add(at(rbox(dw - 0.004, 0.72, 0.02, 0.003, M.frontDark()), x, 0.47, 0.575));
        up.add(at(rbox(dw - 0.004, 0.62, 0.02, 0.003, M.oak()), x, 1.62 + 0.31, 0.345));
      }
      base.add(at(box(L + 0.02, 0.06, 0.64, M.stone()), 0, 0.87, 0.32));
      const sinkX = -L / 2 + Math.min(L * 0.3, 0.9);
      if (L > 1.2) {
        base.add(at(box(0.55, 0.004, 0.42, M.black()), sinkX, 0.902, 0.32));
        const tap = at(cyl(0.013, 0.013, 0.32, M.black()), sinkX, 1.06, 0.08); base.add(tap);
        const sp = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 10, 24, Math.PI), M.black()); sp.position.set(sinkX, 1.22, 0.18); sp.rotation.y = Math.PI / 2; base.add(sp);
      }
      if (L > 2.0) {
        const hx = L / 2 - Math.min(L * 0.3, 0.9);
        base.add(at(box(0.6, 0.006, 0.52, std('cook', { color: 0x0b0b0c, roughness: 0.05, metalness: 0.4 })), hx, 0.903, 0.32));
      }
      up.add(at(box(L, 0.62, 0.32, M.carcass()), 0, 1.93, 0.16));
      // подсветка под шкафами
      up.add(at(box(L * 0.96, 0.01, 0.03, M.glow()), 0, 1.615, 0.28));
      this.place(base, e, start + L / 2, 0);
      this.place(up, e, start + L / 2, 0, true);
      // подвесные светильники и растение
      for (const f of [0.3, 0.7]) {
        if (L < 2.2) break;
        const p = new THREE.Group();
        p.add(at(cyl(0.003, 0.003, 0.9, M.black(), 6), 0, 2.2, 0));
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.brass()); s.position.y = 1.75; s.castShadow = true; p.add(s);
        p.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), M.glow()), 0, 1.749, 0).rotateX(Math.PI / 2));
        this.place(p, e, start + L * f, 1.2);
      }
      this.place(this.plant(0.5, true), e, start + 0.25, 0.3).position.y = 0.9;
    }
    sofa(w) {
      const g = new THREE.Group(), F = M.fabric(), F2 = M.fabric2();
      g.add(at(rbox(w, 0.22, 0.95, 0.06, F), 0, 0.17, 0.475));
      g.add(at(rbox(w - 0.1, 0.55, 0.22, 0.08, F), 0, 0.5, 0.12));
      for (const sx of [-1, 1]) g.add(at(rbox(0.2, 0.5, 0.95, 0.09, F), sx * (w / 2 - 0.1), 0.31, 0.475));
      const n = w > 1.8 ? 3 : 2, cw = (w - 0.4) / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.2 + cw * (i + 0.5);
        g.add(at(rbox(cw - 0.015, 0.14, 0.72, 0.06, F2), x, 0.35, 0.56));
        const b = at(rbox(cw - 0.02, 0.45, 0.16, 0.08, F2), x, 0.6, 0.28); b.rotation.x = -0.14; g.add(b);
      }
      const pl = at(rbox(0.38, 0.38, 0.12, 0.06, M.pillow()), -w / 2 + 0.45, 0.6, 0.38); pl.rotation.set(-0.25, 0.3, 0.12); g.add(pl);
      for (const [x, z] of [[-1, 0.12], [1, 0.12], [-1, 0.85], [1, 0.85]]) g.add(at(cyl(0.015, 0.012, 0.06, M.black()), x * (w / 2 - 0.08), 0.03, z));
      return g;
    }
    coffeeTable() {
      const g = new THREE.Group();
      g.add(at(cyl(0.45, 0.45, 0.035, M.stone(), 64), 0, 0.38, 0));
      g.add(at(cyl(0.16, 0.22, 0.36, M.walnut(), 48), 0, 0.18, 0));
      g.add(at(cyl(0.05, 0.04, 0.12, M.ceramic(), 24), 0.12, 0.46, -0.05));
      return g;
    }
    plant(h, small) {
      const g = new THREE.Group(), r = small ? 0.09 : 0.18;
      g.add(at(cyl(r, r * 0.8, small ? 0.16 : 0.42, M.pot()), 0, small ? 0.08 : 0.21, 0));
      const n = small ? 5 : 9, base = small ? 0.16 : 0.42;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, rr = (small ? 0.06 : 0.12) * (0.5 + (i % 3) * 0.3);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(small ? 0.07 : 0.14 + (i % 2) * 0.04, 1), M.leaf());
        leaf.position.set(Math.cos(a) * rr, base + (h - base) * (0.4 + (i % 4) * 0.18), Math.sin(a) * rr);
        leaf.castShadow = true; g.add(leaf);
      }
      return g;
    }
    floorLamp() {
      const g = new THREE.Group();
      g.add(at(cyl(0.15, 0.15, 0.02, M.black()), 0, 0.01, 0));
      g.add(at(cyl(0.01, 0.01, 1.5, M.brass()), 0, 0.76, 0));
      const s = at(cyl(0.16, 0.22, 0.3, M.shade(), 48), 0, 1.55, 0); s.castShadow = false; g.add(s);
      return g;
    }
    art(w, h) {
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, c.width, c.height);
      gr.addColorStop(0, '#e9dfcf'); gr.addColorStop(1, '#cdbba1'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#b5603d'; x.beginPath(); x.arc(c.width * 0.38, c.height * 0.55, c.height * 0.24, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2f3134'; x.fillRect(c.width * 0.55, c.height * 0.25, c.width * 0.08, c.height * 0.5);
      x.strokeStyle = '#8a7b66'; x.lineWidth = 3; x.beginPath(); x.moveTo(c.width * 0.1, c.height * 0.8); x.bezierCurveTo(c.width * 0.4, c.height * 0.6, c.width * 0.6, c.height * 0.95, c.width * 0.9, c.height * 0.7); x.stroke();
      const g = new THREE.Group();
      g.add(at(box(w + 0.04, h + 0.04, 0.03, M.black()), 0, 1.5, 0.015));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: this.tex(c, true), roughness: 0.9 }));
      pic.position.set(0, 1.5, 0.032); g.add(pic);
      return g;
    }
    door(e) {
      if (!e || e.len < 0.95) return;
      const g = new THREE.Group();
      g.add(at(box(0.92, 2.12, 0.03, M.frame()), 0, 1.06, 0.015));
      g.add(at(rbox(0.82, 2.04, 0.04, 0.006, M.oak()), 0, 1.02, 0.035));
      g.add(at(rbox(0.16, 0.016, 0.03, 0.006, M.black()), 0.3, 1.0, 0.07));
      this.place(g, e, e.len / 2, 0, true);
    }
    window(e, w, h, sill) {
      if (!e || e.len < w + 0.3) return;
      const g = new THREE.Group();
      g.add(at(box(w + 0.1, h + 0.1, 0.03, M.frame()), 0, sill + h / 2, 0.015));
      g.add(at(box(w, h, 0.01, M.winGlass()), 0, sill + h / 2, 0.032));
      g.add(at(box(0.05, h, 0.04, M.frame()), 0, sill + h / 2, 0.04));
      g.add(at(box(w + 0.2, 0.03, 0.22, M.stone()), 0, sill - 0.02, 0.11));
      // занавески
      for (const sx of [-1, 1]) g.add(at(box(0.32, h + 0.6, 0.05, M.towel()), sx * (w / 2 + 0.12), sill + h / 2 + 0.2, 0.12));
      this.place(g, e, e.len / 2, 0, true);
    }

    // ---------- цоколь и двор ----------
    buildHouse(d) {
      this.clear();
      const { HW, HD, H, ph } = d;
      this.scene.background = this._sky || (this._sky = skyTexture());
      this.scene.fog = new THREE.Fog(0xdfe8ec, 35, 80);
      this.scene.environmentIntensity = 0.7;
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: this._grass || (this._grass = grassTexture(this)), roughness: 1 }));
      grass.rotation.x = -Math.PI / 2; grass.position.y = -0.01; grass.receiveShadow = true; this.group.add(grass);
      const yard = new THREE.Mesh(new THREE.PlaneGeometry(d.yardW, d.yardD), this.surfaceMat(d.yard, 3));
      yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.006, HD / 2 + d.yardD / 2); yard.receiveShadow = true; this.group.add(yard);
      const ring = box(HW + 1.4, 0.04, HD + 1.4, M.concrete()); ring.castShadow = false; this.group.add(ring);
      const P = 0.04, pw = HW + P * 2, pd = HD + P * 2;
      const pm = [this.surfaceMat(d.plinth[1], 4), this.surfaceMat(d.plinth[1], 4), M.ledge(), M.ledge(), this.surfaceMat(d.plinth[0], 4), this.surfaceMat(d.plinth[0], 4)];
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), pm);
      plinth.position.set(0, ph / 2, 0); plinth.castShadow = plinth.receiveShadow = true; this.group.add(plinth);
      const ledge = box(pw + 0.06, 0.02, pd + 0.06, M.ledge()); ledge.position.y = ph + 0.01; this.group.add(ledge);
      const wm = [this.surfaceMat(d.facade[1], 1), this.surfaceMat(d.facade[1], 1), M.plaster(), M.plaster(), this.surfaceMat(d.facade[0], 1), this.surfaceMat(d.facade[2], 1)];
      const walls = new THREE.Mesh(new THREE.BoxGeometry(HW, H - ph, HD), wm);
      walls.position.y = ph + (H - ph) / 2; walls.castShadow = walls.receiveShadow = true; this.group.add(walls);
      for (const w of d.windows) {
        const g = new THREE.Group();
        g.add(at(box(w.w + 0.12, 0.05, 0.04, M.frame()), 0, w.y + w.h + 0.03, 0.02));
        g.add(at(box(w.w + 0.24, 0.03, 0.2, M.ledge()), 0, w.y - 0.02, 0.1));
        g.add(at(box(0.05, w.h, 0.05, M.frame()), 0, w.y + w.h / 2, 0.02));
        g.rotation.y = w.rot; g.position.set(w.x, 0, w.z); this.group.add(g);
      }
      const door = rbox(1.0, 2.15, 0.07, 0.01, M.walnut()); door.position.set(d.doorX, ph + 1.03, HD / 2 + 0.035); this.group.add(door);
      const step = box(1.8, ph - 0.04, 1.1, M.concrete()); step.position.set(d.doorX, (ph - 0.04) / 2, HD / 2 + 0.55 + P); this.group.add(step);
      // плоская кровля с парапетом — современный дом
      const roof = box(HW + 0.5, 0.25, HD + 0.5, M.roof()); roof.position.y = H + 0.12; this.group.add(roof);
      // кусты вдоль дома
      for (let i = -2; i <= 2; i++) { if (!i) continue; const b = this.plant(0.7); b.position.set(i * HW / 5.5, 0, HD / 2 + 0.55); this.group.add(b); }

      const size = Math.max(HW, HD + d.yardD) * 0.85;
      this.sun.position.set(size * 0.9, size * 1.4, size * 1.2);
      this.sun.target.position.set(0, 0, HD / 2);
      const sc = this.sun.shadow.camera, ext = size * 1.3;
      Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: size * 6 }); sc.updateProjectionMatrix();
      this.sun.intensity = 3.0; this.hemi.intensity = 1.1;
      this.lamps.forEach(l => l.intensity = 0);
      if (this.ao) this.ao.updateGtaoMaterial({ radius: 0.9 });
      this._size = size;
      const yz = HD / 2 + d.yardD;
      this.eyes = [
        { pos: [0, 1.6, yz - 0.3], look: [0, 1.2, 0] },
        { pos: [-HW / 2 - 1.5, 1.6, yz - 0.5], look: [0, 0.8, HD / 2] },
        { pos: [HW / 2 + 0.8, 1.6, HD / 2 + 1.2], look: [-HW / 2, 0.5, HD / 2] }
      ];
      this.frame('plinth', [0, H * 0.3, HD / 2 + d.yardD * 0.25], size);
    }
  }

  function mirrorTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 40, 128);
    g.addColorStop(0, '#f4f6f7'); g.addColorStop(0.45, '#c9d2d7'); g.addColorStop(0.55, '#dfe5e8'); g.addColorStop(1, '#a9b5bc');
    x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function skyTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#86b6d9'); g.addColorStop(0.55, '#d3e4ee'); g.addColorStop(1, '#f1f2ee');
    x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function grassTexture(sc) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); x.fillStyle = '#6d8c49'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const k = Math.random();
      x.fillStyle = k > 0.6 ? 'rgba(140,170,90,.6)' : k > 0.3 ? 'rgba(80,110,55,.6)' : 'rgba(60,90,45,.5)';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3);
    }
    const t = sc.tex(c, true); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(34, 34); return t;
  }

  window.Scene3D = Scene3D;
})();
