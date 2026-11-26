// GLASSIT Ocean · "Glass as sculpture"
// The five current glasses (modelled at real size in Blender) standing on sunlit, rippling water.
// Drag to turn the glass in front, arrows/dots to move between them, "Fill it" pours the matching drink
// (the Halo lights its tea light). Renders only while the section is on screen.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/DRACOLoader.js/+esm';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/Water.js/+esm';

const S = 10; // 1 scene unit = 10 cm; models are in metres

// Inner cavities (radius, height in metres) from blender/ocean_glasses.py, used to build drink fills.
const CAV = {
  lumen: [[0, 0.1065], [0.01, 0.1085], [0.0192, 0.115], [0.0246, 0.13], [0.0262, 0.21]],
  arc: [[0, 0.1375], [0.0062, 0.1395], [0.0534, 0.21]],
  ripple: (() => { const p = [], C = 0.168, R = 0.0484; for (let k = 0; k <= 30; k++) { const a = (-90 + 142 * k / 30) * Math.PI / 180; p.push([R * Math.cos(a), C + R * Math.sin(a)]); } return p; })(),
  verdant: [[0, 0.0305], [0.0326, 0.0305], [0.0326, 0.14]],
};

export const GLASSES = [
  { key: 'lumen', drink: { color: 0xf4dc94, att: 0xd9a53a, level: 0.78, bubbles: true }, action: 'Pour champagne' },
  { key: 'arc', drink: { color: 0xff6b8b, att: 0xc2183f, level: 0.72 }, action: 'Mix a cosmo' },
  { key: 'ripple', drink: { color: 0x9c0f1f, att: 0x5c0410, level: 0.5 }, action: 'Pour red wine' },
  { key: 'verdant', drink: { color: 0xf0b45c, att: 0xb86414, level: 0.82, bubbles: true }, action: 'Pour iced tea' },
  { key: 'halo', candle: true, action: 'Light it' },
];

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// tileable water normal map from summed waves
function waterNormals() {
  return canvasTex(256, (x, n) => {
    const img = x.createImageData(n, n), h = new Float32Array(n * n);
    const waves = [[3, 1, .8], [-2, 3, .7], [1, -5, .45], [5, 4, .35], [-6, 2, .3], [4, -7, .22], [9, 3, .15], [-3, 10, .12], [11, -6, .08]];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let v = 0; for (const [a, b, amp] of waves) v += amp * Math.sin(2 * Math.PI * (a * i + b * j) / n + a * 1.7);
      h[j * n + i] = v;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = h[j * n + (i + 1) % n] - h[j * n + (i - 1 + n) % n], dy = h[((j + 1) % n) * n + i] - h[((j - 1 + n) % n) * n + i];
      const k = (j * n + i) * 4, s = 1.1;
      let nx = -dx * s, ny = -dy * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      img.data[k] = (nx * .5 + .5) * 255; img.data[k + 1] = (ny * .5 + .5) * 255; img.data[k + 2] = (nz * .5 + .5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  });
}

// bright sky + sun for reflections on the glass (generated, no download)
function skyEnv(renderer, panels = true) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sun: { value: new THREE.Vector3(-0.45, 0.55, -0.7).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){ float y = vD.y;
        vec3 top = vec3(.01,.03,.12), mid = vec3(.02,.16,.60), hor = vec3(.10,.50,.95), low = vec3(.01,.06,.18);
        vec3 c = y > 0. ? mix(hor, mix(mid, top, smoothstep(.25,.9,y)), smoothstep(0.,.25,y)) : mix(hor*.6, low, smoothstep(0.,-.4,y));
        float s = max(dot(normalize(vD), sun), 0.);
        c += vec3(1.,.95,.85) * (pow(s, 900.) * 60. + pow(s, 12.) * .6);
        gl_FragColor = vec4(c, 1.); }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  // soft panels so the stems pick up long highlights
  const panel = (x, y, z, w, h, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m); };
  if (panels) { panel(-12, 6, 8, 6, 14, 3); panel(14, 4, 4, 4, 12, 2.2); panel(0, 18, 0, 20, 4, 1.4); }
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.02).texture; pm.dispose(); geo.dispose(); mat.dispose();
  return env;
}

function glassMat(env, tint = 0xffffff, att = 0xffffff, dist = 4) {
  return new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0, roughness: 0.0, transmission: 1, thickness: 0.025, ior: 1.5,
    attenuationColor: new THREE.Color(att), attenuationDistance: dist,
    envMap: env, envMapIntensity: 1.1, specularIntensity: 1,
    side: THREE.DoubleSide, transparent: false,
  });
}

// drink: a lathe of the cavity, filled to `level` (0..1)
function drinkGeo(pts, level) {
  const z0 = pts[0][1], z1 = pts[pts.length - 1][1], zl = z0 + (z1 - z0) * Math.max(0.02, level);
  const out = [new THREE.Vector2(0, z0)];
  for (let i = 0; i < pts.length; i++) {
    const [r, z] = pts[i];
    if (z >= zl) {
      const [pr, pz] = pts[i - 1] || pts[i];
      const t = (zl - pz) / Math.max(1e-6, z - pz);
      out.push(new THREE.Vector2((pr + (r - pr) * t) * 0.965, zl));
      break;
    }
    if (r > 0) out.push(new THREE.Vector2(r * 0.965, z));
  }
  if (out[out.length - 1].y < zl - 1e-6) out.push(new THREE.Vector2(pts[pts.length - 1][0] * 0.965, zl));
  out.push(new THREE.Vector2(0, zl));
  return new THREE.LatheGeometry(out, 64);
}

export class Sculpture {
  constructor(canvas, { assets, onChange, onReady } = {}) {
    this.canvas = canvas; this.assets = assets; this.onChange = onChange; this.onReady = onReady;
    this.index = 0; this.cur = 0; this.items = []; this.visible = true; this.t = 0;
    const mobile = matchMedia('(max-width: 749px)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1f62d8, 24, 70);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.env = skyEnv(r);
    this.scene.environment = this.env;
    this.scene.background = this.sky = skyEnv(r, false);
    this.scene.backgroundBlurriness = 0.25;

    const sun = this.sunDir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
    const dl = new THREE.DirectionalLight(0xfff4e2, 2.2); dl.position.copy(sun).multiplyScalar(20); this.scene.add(dl);
    this.scene.add(new THREE.HemisphereLight(0x9cc8ff, 0x08204f, 0.6));

    const water = this.water = new Water(new THREE.PlaneGeometry(220, 220), {
      textureWidth: mobile ? 512 : 1024, textureHeight: mobile ? 512 : 1024,
      waterNormals: waterNormals(), sunDirection: sun.clone(), sunColor: 0xffffff,
      waterColor: 0x0663c8, distortionScale: 3.2, fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.material.uniforms.size.value = 16;
    this.scene.add(water);

    this.glow = canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(210,240,255,.28)'); g.addColorStop(.5, 'rgba(46,196,241,.08)'); g.addColorStop(1, 'rgba(46,196,241,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    this.flameTex = canvasTex(64, (x, n) => { const g = x.createRadialGradient(n / 2, n * .62, 0, n / 2, n * .62, n / 2); g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(.25, 'rgba(255,200,90,.95)'); g.addColorStop(.6, 'rgba(255,120,30,.35)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(n / 2, n * .58, n * .22, n * .42, 0, 0, Math.PI * 2); x.fill(); });

    this._bind();
    this._load();
  }

  async _load() {
    const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(this.assets + 'glasses.glb');
    const clear = glassMat(this.env), green = glassMat(this.env, 0xb8f5cf, 0x22b866, 0.35);
    const n = GLASSES.length;
    GLASSES.forEach((def, i) => {
      const src = gltf.scene.getObjectByName(def.key);
      const holder = new THREE.Group();
      const spin = new THREE.Group();
      src.traverse((o) => { if (o.isMesh) o.material = o.material && o.material.name === 'glass_green' ? green : clear; });
      src.position.set(0, 0, 0);
      spin.add(src); spin.scale.setScalar(S);
      holder.add(spin);
      const a = (i - (n - 1) / 2) * 0.32;
      holder.position.set(Math.sin(a) * 9, 0, 9 - Math.cos(a) * 9);
      holder.userData = { base: holder.position.clone() };
      // a soft pool of light on the water around the foot
      const g = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.rotation.x = -Math.PI / 2; g.position.y = 0.01; holder.add(g);
      this.scene.add(holder);
      const item = { def, holder, spin, level: 0, target: 0, liquid: null, lit: 0 };
      if (def.drink) {
        const m = new THREE.MeshPhysicalMaterial({ color: def.drink.color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color(def.drink.att), emissive: new THREE.Color(def.drink.att), emissiveIntensity: 0.18, envMap: this.env, envMapIntensity: 0.9 });
        item.liquid = new THREE.Mesh(drinkGeo(CAV[def.key], 0.02), m); item.liquid.visible = false; spin.add(item.liquid);
        if (def.drink.bubbles) item.bubbles = this._bubbles(def.key, spin);
      }
      if (def.candle) item.candle = this._candle(spin);
      this.items.push(item);
    });
    this.resize(); this.go(0, true);
    this.ready = true; this.onReady && this.onReady();
    this._loop();
  }

  _bubbles(key, parent) {
    const pts = CAV[key], N = 40, pos = new Float32Array(N * 3), seed = [];
    for (let i = 0; i < N; i++) seed.push([Math.random() * Math.PI * 2, Math.random(), 0.3 + Math.random() * 0.7]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xfffbe8, size: 0.0024 });
    const p = new THREE.Points(geo, m); p.visible = false; parent.add(p);
    return { p, seed, pts };
  }

  _candle(parent) {
    const g = new THREE.Group(); g.position.y = 0.0625;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.015, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.3, envMap: this.env, side: THREE.DoubleSide }));
    cup.position.y = 0.0075; g.add(cup);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.012, 40), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6, emissive: 0xffb347, emissiveIntensity: 0 }));
    wax.position.y = 0.006; g.add(wax);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.006), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    wick.position.y = 0.0145; g.add(wick);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    flame.renderOrder = 10;
    flame.scale.set(0.016, 0.034, 1); flame.position.y = 0.03; g.add(flame);
    const light = new THREE.PointLight(0xffa64a, 0, 0.8, 2); light.position.y = 0.03; g.add(light);
    parent.add(g);
    return { wax, flame, light };
  }

  _bind() {
    const c = this.canvas;
    let down = false, sx = 0, vel = 0, last = 0;
    c.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; vel = 0; last = performance.now(); c.setPointerCapture(e.pointerId); this.drag = true; });
    c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx; sx = e.clientX;
      const it = this.items[this.index]; if (!it) return;
      const now = performance.now(); vel = dx / Math.max(1, now - last); last = now;
      it.spin.rotation.y += dx * 0.012;
    });
    const up = () => { if (!down) return; down = false; this.drag = false; this.spinVel = vel * 12; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(c);
  }

  go(i, instant = false) {
    const n = this.items.length || GLASSES.length;
    this.index = ((i % n) + n) % n;
    if (instant) this.cur = this.index;
    this.onChange && this.onChange(this.index, GLASSES[this.index], this.items[this.index]);
  }

  act() {
    const it = this.items[this.index]; if (!it) return false;
    if (it.def.candle) { it.litTarget = it.litTarget ? 0 : 1; return !!it.litTarget; }
    it.target = it.target > 0 ? 0 : it.def.drink.level;
    return it.target > 0;
  }

  isOn() { const it = this.items[this.index]; return it ? (it.def.candle ? !!it.litTarget : it.target > 0) : false; }

  setVisible(v) { this.visible = v; if (v && this.ready && !this._raf) this._loop(); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 42 : 30;
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    let prev = performance.now();
    const tick = (now) => {
      if (!this.visible) { this._raf = 0; return; }
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; this.t += dt;
      this.water.material.uniforms.time.value += dt * 0.55;
      this.cur += (this.index - this.cur) * Math.min(1, dt * 4);
      const fi = Math.round(this.cur), focus = this.items[fi] || this.items[0];
      // camera glides along the arc to the glass in front
      const n = this.items.length, a = (this.cur - (n - 1) / 2) * 0.32;
      const tx = Math.sin(a) * 9, tz = 9 - Math.cos(a) * 9;
      const portrait = this.camera.aspect < 1;
      const dist = portrait ? 7.2 : 6.2;
      this.camera.position.set(tx + Math.sin(a) * dist * 0.2, portrait ? 3.4 : 2.9, tz + dist);
      this.camera.lookAt(tx, 1.05, tz);
      this.items.forEach((it, k) => {
        const active = k === this.index;
        // idle turn on the active glass, momentum after a drag
        if (active && !this.drag) { this.spinVel = (this.spinVel || 0) * 0.94; it.spin.rotation.y += dt * 0.35 + (this.spinVel || 0) * dt; }
        const bob = Math.sin(this.t * 1.3 + k) * 0.015;
        it.holder.position.y = bob;
        if (it.liquid) {
          it.level += (it.target - it.level) * Math.min(1, dt * 1.6);
          const show = it.level > 0.012;
          it.liquid.visible = show;
          if (show && Math.abs(it.level - (it._built || 0)) > 0.004) { it.liquid.geometry.dispose(); it.liquid.geometry = drinkGeo(CAV[it.def.key], it.level / 1); it._built = it.level; }
          if (it.bubbles) this._tickBubbles(it, dt);
        }
        if (it.candle) {
          it.lit += ((it.litTarget || 0) - it.lit) * Math.min(1, dt * 3);
          const f = it.lit * (0.85 + Math.sin(this.t * 23) * 0.06 + Math.sin(this.t * 7.3) * 0.08);
          it.candle.flame.material.opacity = f; it.candle.flame.scale.set(0.016, 0.034 * (0.9 + 0.15 * Math.sin(this.t * 11)), 1);
          it.candle.light.intensity = f * 0.9; it.candle.wax.material.emissiveIntensity = f * 0.35;
        }
      });
      this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _tickBubbles(it, dt) {
    const b = it.bubbles, pts = b.pts, z0 = pts[0][1], z1 = pts[pts.length - 1][1];
    const zl = z0 + (z1 - z0) * it.level;
    b.p.visible = it.level > 0.1;
    if (!b.p.visible) return;
    const pos = b.p.geometry.attributes.position.array;
    b.seed.forEach((s, i) => {
      s[1] += dt * 0.35 * s[2]; if (s[1] > 1) s[1] = 0;
      const z = z0 + 0.006 + (zl - z0 - 0.01) * s[1];
      let r = 0; for (let k = 1; k < pts.length; k++) if (pts[k][1] >= z) { r = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * ((z - pts[k - 1][1]) / Math.max(1e-6, pts[k][1] - pts[k - 1][1])); break; }
      const rr = r * 0.55 * ((i % 7) / 7);
      pos[i * 3] = Math.cos(s[0]) * rr; pos[i * 3 + 1] = z; pos[i * 3 + 2] = Math.sin(s[0]) * rr;
    });
    b.p.geometry.attributes.position.needsUpdate = true;
  }
}
