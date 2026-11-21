// 3D product carousel: Blender-built catalogue products on travertine plinths, on a turning ring.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const TURN = [
  { key: 'tiger', id: 'smoke-tiger-whisky-glass-set', h: 1.0, glass: { color: 0xc3c7cc, atten: 0x5c6067, dist: 0.35 }, med: { metal: 0.9, rough: 0.28 }, drink: { color: 0xffc98f, atten: 0xb5560f, dist: 0.5, level: 0.42 } },
  { key: 'peacock', id: 'peacock-medallion-tumbler-set', h: 1.0, glass: { color: 0xffe2b2, atten: 0xd58a2a, dist: 0.55 }, med: { metal: 0.25, rough: 0.35 } },
  { key: 'coupe', id: 'two-tone-round-wine-glass', h: 1.42, glass: { color: 0xc6c9ce, atten: 0x5f6268, dist: 0.4 }, stem: { color: 0xffb867, atten: 0xd0761c, dist: 0.12 }, drink: { color: 0xfff1c6, atten: 0xe9c46a, dist: 1.2, level: 0.55 } },
  { key: 'flute', id: 'angular-flute-set', h: 1.72, glass: { color: 0xffffff, atten: 0xf4f6f7, dist: 5 }, drink: { color: 0xfff3cf, atten: 0xe8c36a, dist: 1.4, level: 0.7, bubbles: true } },
  { key: 'lion', id: 'gold-lion-beer-mug-set', h: 1.5, glass: { color: 0xfff0d4, atten: 0xdca64f, dist: 1.0 }, med: { metal: 0.9, rough: 0.28 }, drink: { color: 0xffe08a, atten: 0xd9921b, dist: 0.9, level: 0.8, foam: true, bubbles: true } },
  { key: 'dispenser', id: 'amber-ribbed-cylinder-dispenser', h: 1.9, glass: { color: 0xffd9a2, atten: 0xc8781f, dist: 0.7 } },
];

const RING = 1.9;

function travertine() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#e9dfd0'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * 512, py = Math.random() * 256, r = Math.random() * 2.2;
    x.fillStyle = `rgba(${150 + Math.random() * 40},${130 + Math.random() * 30},${100 + Math.random() * 30},${Math.random() * 0.25})`;
    x.beginPath(); x.ellipse(px, py, r * 2.5, r, 0, 0, Math.PI * 2); x.fill();
  }
  for (let y = 0; y < 256; y += 3 + Math.random() * 9) {
    x.fillStyle = `rgba(160,140,110,${Math.random() * 0.12})`; x.fillRect(0, y, 512, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(60,45,30,.45)'); g.addColorStop(0.5, 'rgba(60,45,30,.18)'); g.addColorStop(1, 'rgba(60,45,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,250,230,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const glassMat = (o, extra = {}) => new THREE.MeshPhysicalMaterial({
  color: o.color, transmission: 1, roughness: 0.02, metalness: 0, ior: 1.52, thickness: 0.03,
  attenuationColor: new THREE.Color(o.atten), attenuationDistance: o.dist, specularIntensity: 1,
  clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.9, ...extra,
});

class Product {
  constructor(def, gltf, profile, assets) {
    this.def = def; this.profile = profile;
    this.group = new THREE.Group();
    this.spin = new THREE.Group(); this.group.add(this.spin);
    this.model = new THREE.Group(); this.spin.add(this.model);
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xd9b46c, metalness: 1, roughness: 0.22, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const copper = new THREE.MeshPhysicalMaterial({ color: 0xd08c6a, metalness: 1, roughness: 0.24, envMapIntensity: 1.3 });
    gltf.scene.traverse((m) => {
      if (!m.isMesh) return;
      const part = m.name.split('_').slice(1).join('_');
      let mat;
      if (part === 'Glass' || part === 'Handle') mat = glassMat(def.glass);
      else if (part === 'Stem') mat = def.stem ? glassMat(def.stem, { thickness: 0.004 }) : glassMat(def.glass);
      else if (part === 'Medallion') {
        const tex = m.material.map || null;
        if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }
        mat = new THREE.MeshPhysicalMaterial({ map: tex, bumpMap: tex, bumpScale: 2, metalness: def.med?.metal ?? 0.9, roughness: def.med?.rough ?? 0.28, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.4, clearcoat: 0.5 });
      } else if (part === 'Lid' || part === 'Lid2' || part === 'Tap') mat = copper;
      else mat = gold;
      const mesh = new THREE.Mesh(m.geometry, mat);
      mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale);
      if (part === 'Glass' || part === 'Handle' || part === 'Stem') mesh.renderOrder = 2;
      this.model.add(mesh);
    });
    // normalise: base on y=0, target height def.h
    const box = new THREE.Box3().setFromObject(this.model);
    const s = def.h / (box.max.y - box.min.y);
    this.model.scale.setScalar(s);
    this.model.position.y = -box.min.y * s;
    this.scale = s;
    // liquid
    if (def.drink) {
      this.liquidMat = new THREE.MeshPhysicalMaterial({ color: def.drink.color, transmission: 1, roughness: 0.03, ior: 1.34, thickness: 0.05, attenuationColor: new THREE.Color(def.drink.atten), attenuationDistance: def.drink.dist, side: THREE.DoubleSide, envMapIntensity: 1 });
      this.liquid = new THREE.Mesh(new THREE.BufferGeometry(), this.liquidMat); this.liquid.renderOrder = 1;
      this.model.add(this.liquid);
      if (def.drink.foam) { this.foam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9 })); this.model.add(this.foam); }
      if (def.drink.bubbles) {
        const N = 70; this.bSeed = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random(), 0.4 + Math.random()]);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        this.bubbles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.012, map: assets.dot, transparent: true, depthWrite: false, opacity: 0.8 }));
        this.model.add(this.bubbles);
      }
      this.level = 0; this._built = -1; this.setLevel(def.drink.level);
    }
    // plinth + shadow
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.34, 72), assets.plinth);
    plinth.position.y = -0.17; this.group.add(plinth);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: assets.shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002; this.group.add(sh);
    this.spinV = 0;
  }
  zAt(l) { const p = this.profile, z0 = p.inner[0][1]; return z0 + (p.height - 0.008 - z0) * l; }
  rAt(z) {
    const inn = this.profile.inner;
    let best = 0;
    for (let i = 1; i < inn.length; i++) {
      const [r0, z0] = inn[i - 1], [r1, z1] = inn[i];
      if ((z0 <= z && z <= z1) || (z1 <= z && z <= z0)) best = Math.max(best, r0 + (r1 - r0) * ((z - z0) / ((z1 - z0) || 1e-6)));
    }
    return best;
  }
  setLevel(l) {
    if (!this.liquid) return;
    this.level = l;
    const show = l > 0.01;
    this.liquid.visible = show; if (this.foam) this.foam.visible = show; if (this.bubbles) this.bubbles.visible = show;
    if (!show || Math.abs(this._built - l) < 0.003) return;
    this._built = l;
    const inn = this.profile.inner, gap = 0.0004, zTop = this.zAt(l);
    const pts = [new THREE.Vector2(0.0001, inn[0][1] + gap)];
    let rTop = this.rAt(zTop) - gap;
    for (let i = 1; i < inn.length; i++) {
      const [r, z] = inn[i];
      if (z >= zTop && inn[i - 1][1] < zTop) break;
      if (z < zTop) pts.push(new THREE.Vector2(Math.max(r - gap, 0.0002), z + gap));
    }
    pts.push(new THREE.Vector2(rTop, zTop), new THREE.Vector2(0.0001, zTop));
    this.liquid.geometry.dispose(); this.liquid.geometry = new THREE.LatheGeometry(pts, 64);
    this.zTop = zTop; this.rTop = rTop;
    if (this.foam) {
      this.foam.geometry.dispose();
      this.foam.geometry = new THREE.LatheGeometry([[0.0001, zTop - 0.001], [rTop, zTop - 0.001], [rTop, zTop + 0.006], [rTop * 0.9, zTop + 0.011], [0.0001, zTop + 0.013]].map(([a, b]) => new THREE.Vector2(a, b)), 64);
    }
  }
  update(dt, t) {
    if (!this.bubbles || !this.bubbles.visible) return;
    const pos = this.bubbles.geometry.attributes.position, b = this.profile.inner[0][1], h = (this.zTop || b) - b;
    this.bSeed.forEach((s, i) => {
      s[2] = (s[2] + dt * 0.18 * s[3]) % 1;
      const r = (this.rTop || 0.02) * 0.75 * Math.sqrt(s[0]), a = s[1] * 6.283 + t * 0.3;
      pos.setXYZ(i, r * Math.cos(a), b + 0.003 + s[2] * (h - 0.004), r * Math.sin(a));
    });
    pos.needsUpdate = true;
  }
}

export class Turntable {
  constructor(canvas, { onChange, bg = 0xede5da } = {}) {
    this.canvas = canvas; this.onChange = onChange;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.mobile = matchMedia('(max-width: 980px), (pointer: coarse)').matches;
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(bg);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 1.0;
    this.scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd9cbb6, 1.2));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(-3, 5, 4); this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    this.ring = new THREE.Group(); this.scene.add(this.ring);
    this.items = []; this.index = 0; this.cur = 0; this.visible = true;
    this.drag = null; this.camState = null;
    this._bind();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
    this.resize();
  }

  async load(base = 'assets/glassit3d/') {
    const loader = new GLTFLoader();
    const [profiles, ...gltfs] = await Promise.all([
      fetch(base + 'profiles.json').then((r) => r.json()),
      ...TURN.map((d) => loader.loadAsync(base + d.key + '.glb')),
    ]);
    const assets = { plinth: new THREE.MeshStandardMaterial({ map: travertine(), roughness: 0.92, color: 0xffffff }), shadow: shadowTex(), dot: dotTex() };
    const step = (Math.PI * 2) / TURN.length;
    TURN.forEach((d, i) => {
      const p = new Product(d, gltfs[i], profiles[d.key], assets);
      const a = i * step;
      p.group.position.set(Math.sin(a) * RING, 0, Math.cos(a) * RING);
      p.group.rotation.y = a;
      p.spin.rotation.y = 0;
      this.ring.add(p.group); this.items.push(p);
    });
    this.step = step;
    this.go(0, true);
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, horiz: null };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (this.drag.horiz === null && Math.hypot(dx, dy) > 6) this.drag.horiz = Math.abs(dx) > Math.abs(dy);
      if (!this.drag.horiz) return;
      this.drag.dx += dx; this.drag.x = e.clientX; this.drag.y = e.clientY;
      const p = this.items[this.mod(this.index)];
      if (p) { p.spin.rotation.y += dx * 0.012; p.spinV = dx * 0.6; }
    });
    const up = () => { this.drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  mod(i) { const n = this.items.length || TURN.length; return ((i % n) + n) % n; }

  go(i, instant = false) {
    this.index = i;
    const p = this.items[this.mod(i)];
    if (instant) this.cur = i;
    if (p && p.def.drink) {
      gsap.killTweensOf(p, 'level');
      const lv = { v: 0 };
      p.setLevel(0);
      gsap.to(lv, { v: p.def.drink.level, duration: 1.6, delay: instant ? 0.2 : 0.45, ease: 'power2.out', onUpdate: () => p.setLevel(lv.v) });
    }
    this.onChange?.(this.mod(i), TURN[this.mod(i)]);
  }

  resize() {
    const el = this.canvas.parentElement, w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  tick(dt, t) {
    if (!this.visible || !this.items.length) return;
    this.cur += (this.index - this.cur) * (1 - Math.exp(-dt * 5));
    this.ring.rotation.y = -this.cur * this.step;
    const active = this.items[this.mod(Math.round(this.cur))];
    const h = TURN[this.mod(Math.round(this.cur))].h;
    // frame the active product (fit height; on narrow screens fit width too)
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    let d = (h * 1.18 + 0.32) / (2 * Math.tan(vfov / 2));
    if (this.camera.aspect < 0.9) d = Math.max(d, 2.1 / (2 * Math.tan(vfov / 2) * this.camera.aspect));
    const target = { z: RING + d, y: h * 0.52 + 0.08, ly: h * 0.46 };
    if (!this.camState) this.camState = { ...target };
    const k = 1 - Math.exp(-dt * 3.5);
    for (const key of Object.keys(target)) this.camState[key] += (target[key] - this.camState[key]) * k;
    this.camera.position.set(0, this.camState.y, this.camState.z);
    this.camera.lookAt(0, this.camState.ly, RING);
    this.items.forEach((p) => {
      const isActive = p === active;
      if (isActive && this.drag) { /* user is turning it */ }
      else if (isActive) { p.spinV *= Math.pow(0.05, dt); p.spin.rotation.y += (0.32 + p.spinV * 0.02) * dt; }
      else p.spin.rotation.y += 0.12 * dt;
      const s = isActive ? 1 : 0.92;
      p.group.scale.setScalar(p.group.scale.x + (s - p.group.scale.x) * k);
      p.update(dt, t);
    });
    this.renderer.render(this.scene, this.camera);
  }
}
