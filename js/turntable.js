// Live 3D carousel: Blender-built catalogue products lit by a path-traced studio light map,
// standing on travertine blocks with baked contact shadows, on one turning ring.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// glass: surface tint, absorption colour + distance (scene units)
export const TURN = [
  { key: 'tiger', id: 'smoke-tiger-whisky-glass-set', h: 1.0, glass: { color: 0xb3b7bc, atten: 0x6a6e75, dist: 0.18 }, med: { metal: 1, rough: 0.24, normal: 1.4 }, drink: { color: 0xffd7a3, atten: 0xc0651a, dist: 0.6, level: 0.42 } },
  { key: 'peacock', id: 'peacock-medallion-tumbler-set', h: 1.0, glass: { color: 0xffc677, atten: 0xd27a22, dist: 0.18 }, med: { metal: 0, rough: 0.3, normal: 0.35 } },
  { key: 'coupe', id: 'two-tone-round-wine-glass', h: 1.42, glass: { color: 0xb6babf, atten: 0x6a6e75, dist: 0.16 }, stem: { color: 0xffb75e, atten: 0xd9852a, dist: 0.06 }, drink: { color: 0xfff3d2, atten: 0xecc979, dist: 1.4, level: 0.55 } },
  { key: 'flute', id: 'angular-flute-set', h: 1.72, glass: { color: 0xffffff, atten: 0xf3f7f6, dist: 6 }, drink: { color: 0xfff5d6, atten: 0xe9c46c, dist: 1.6, level: 0.7, bubbles: true } },
  { key: 'lion', id: 'gold-lion-beer-mug-set', h: 1.5, glass: { color: 0xffd99c, atten: 0xd99540, dist: 0.3 }, med: { metal: 1, rough: 0.24, normal: 1.4 }, drink: { color: 0xffe39a, atten: 0xdc961e, dist: 0.9, level: 0.8, foam: true, bubbles: true } },
  { key: 'dispenser', id: 'amber-ribbed-cylinder-dispenser', h: 1.9, glass: { color: 0xf3a648, atten: 0xb8650f, dist: 0.07 } },
];

const RING = 1.95;
const V = '?v=12'; // bump when assets are re-baked
const BLOCK = 1.2;
const BLOCK_H = 0.32;

function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,250,230,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const glassMat = (o, extra = {}) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color, metalness: 0, roughness: 0.0, transmission: 1, ior: 1.5, thickness: 0.008,
    attenuationColor: new THREE.Color(o.atten), attenuationDistance: o.dist,
    specularIntensity: 1, envMapIntensity: 2.2, dispersion: 0.1, ...extra,
  });
  // real glass reads by its edges: darken (and tint) where the surface turns away from the camera
  const edge = new THREE.Color(o.atten).multiplyScalar(0.55);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: edge };
    sh.fragmentShader = 'uniform vec3 uEdge;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
       float rim = pow(1.0 - facing, 2.2);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uEdge * 1.4, clamp(rim * 0.85, 0.0, 1.0));
       #include <dithering_fragment>`);
  };
  return m;
};

class Product {
  constructor(def, gltf, profile, A) {
    this.def = def; this.profile = profile;
    this.group = new THREE.Group();
    this.spin = new THREE.Group(); this.group.add(this.spin);
    this.model = new THREE.Group(); this.spin.add(this.model);
    gltf.scene.traverse((m) => {
      if (!m.isMesh) return;
      const part = m.name.split('_').slice(1).join('_');
      let mat;
      if (part === 'Glass' || part === 'Handle') mat = glassMat(def.glass);
      else if (part === 'Stem') mat = def.stem ? glassMat(def.stem, { thickness: 0.005 }) : glassMat(def.glass);
      else if (part === 'Medallion') {
        const tex = m.material.map || null;
        if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = A.aniso; }
        mat = new THREE.MeshPhysicalMaterial({
          map: tex, normalMap: A.normals[def.key] || null, normalScale: new THREE.Vector2(def.med.normal, def.med.normal),
          metalness: def.med.metal, roughness: def.med.rough, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.25,
          clearcoat: def.med.metal ? 0 : 0.8, clearcoatRoughness: 0.08,
        });
      } else if (part === 'Lid' || part === 'Lid2' || part === 'Tap') mat = A.copper;
      else mat = A.gold;
      const mesh = new THREE.Mesh(m.geometry, mat);
      mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale);
      if (part === 'Glass' || part === 'Handle' || part === 'Stem') mesh.renderOrder = 2;
      this.model.add(mesh);
    });
    const box = new THREE.Box3().setFromObject(this.model);
    const s = def.h / (box.max.y - box.min.y);
    this.model.scale.setScalar(s);
    this.model.position.y = -box.min.y * s;
    this.scale = s;
    if (def.drink) this._drink(A);
    const block = new THREE.Mesh(A.blockGeo, A.travertine);
    block.position.y = -BLOCK_H / 2; block.rotation.y = 0.12; this.group.add(block);
    const sh = A.shadows[def.key];
    if (sh) {
      const size = sh.size * s;  // shadow baked in Blender metres; s converts metres -> scene units
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: sh.tex, transparent: true, depthWrite: false, opacity: 0.8, toneMapped: false }));
      decal.rotation.x = -Math.PI / 2; decal.position.y = 0.002; this.group.add(decal);
    }
    this.spinV = 0;
  }
  _drink(A) {
    const d = this.def.drink;
    this.liquid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: d.color, transmission: 1, roughness: 0.02, ior: 1.34, thickness: 0.05, attenuationColor: new THREE.Color(d.atten), attenuationDistance: d.dist, side: THREE.DoubleSide, envMapIntensity: 1 }));
    this.liquid.renderOrder = 1; this.model.add(this.liquid);
    if (d.foam) { this.foam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff) })); this.model.add(this.foam); }
    if (d.bubbles) {
      const N = 80; this.bSeed = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random(), 0.4 + Math.random()]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.bubbles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.011, map: A.dot, transparent: true, depthWrite: false, opacity: 0.85 }));
      this.model.add(this.bubbles);
    }
    this.level = 0; this._built = -1; this.setLevel(d.level);
  }
  zAt(l) { const p = this.profile, z0 = p.inner[0][1]; return z0 + (p.height - 0.008 - z0) * l; }
  rAt(z) {
    const inn = this.profile.inner; let best = 0;
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
    const inn = this.profile.inner, gap = 0.0004, zTop = this.zAt(l), rTop = this.rAt(zTop) - gap;
    const pts = [new THREE.Vector2(0.0001, inn[0][1] + gap)];
    for (let i = 1; i < inn.length; i++) {
      const [r, z] = inn[i];
      if (z >= zTop && inn[i - 1][1] < zTop) break;
      if (z < zTop) pts.push(new THREE.Vector2(Math.max(r - gap, 0.0002), z + gap));
    }
    pts.push(new THREE.Vector2(rTop, zTop), new THREE.Vector2(0.0001, zTop));
    this.liquid.geometry.dispose(); this.liquid.geometry = new THREE.LatheGeometry(pts, 96);
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
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas; this.onChange = onChange;
    this.mobile = matchMedia('(max-width: 980px), (pointer: coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.6 : 2));
    r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xede5da);
    RectAreaLightUniformsLib.init();
    // two tall window softboxes: they show up as the vertical highlight streaks real glass has
    const win = (x, z, i, w) => { const l = new THREE.RectAreaLight(0xfff4e4, i, w, 2.6); l.position.set(x, 1.5, z); l.lookAt(0, 0.6, RING); this.scene.add(l); return l; };
    this.winL = win(-2.6, RING + 1.6, 7, 0.9); this.winR = win(2.4, RING + 2.2, 3.5, 0.6);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    this.ring = new THREE.Group(); this.scene.add(this.ring);
    this.items = []; this.index = 0; this.cur = 0; this.visible = true;
    this.drag = null; this.camState = null;
    this._bind();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
    this.resize();
  }

  async load(base = 'assets/glassit3d/') {
    const gltfL = new GLTFLoader(), texL = new THREE.TextureLoader();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const tex = (url, srgb = true) => texL.loadAsync(base + url + V).then((t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; return t; });
    const [hdr, profiles, shadowInfo, trav, ...rest] = await Promise.all([
      new RGBELoader().loadAsync(base + 'studio.hdr' + V),
      fetch(base + 'profiles.json' + V).then((r) => r.json()),
      fetch(base + 'shadows.json' + V).then((r) => r.json()),
      tex('travertine.jpg'),
      ...['tiger', 'peacock', 'lion'].map((k) => tex(`medallion-${k}-normal.png`, false)),
      ...TURN.map((d) => tex(`shadow-${d.key}.png`)),
      ...TURN.map((d) => gltfL.loadAsync(base + d.key + '.glb' + V)),
    ]);
    const normals = { tiger: rest[0], peacock: rest[1], lion: rest[2] };
    Object.values(normals).forEach((t) => { t.flipY = false; t.needsUpdate = true; });
    const shadowTex = rest.slice(3, 3 + TURN.length), gltfs = rest.slice(3 + TURN.length);

    hdr.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment = hdr;
    this.scene.background = hdr;
    this.scene.backgroundBlurriness = 0.55;
    this.scene.backgroundIntensity = 1.9;

    trav.wrapS = trav.wrapT = THREE.RepeatWrapping;
    const A = {
      aniso, normals, dot: dotTex(),
      gold: new THREE.MeshPhysicalMaterial({ color: 0xf2c56b, metalness: 1, roughness: 0.17, envMapIntensity: 1.2, side: THREE.DoubleSide }),
      copper: new THREE.MeshPhysicalMaterial({ color: 0xe4a07e, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 }),
      travertine: new THREE.MeshPhysicalMaterial({ map: trav, roughness: 0.82, envMapIntensity: 0.95, sheen: 0.25, sheenColor: new THREE.Color(0xfff4e2) }),
      blockGeo: new RoundedBoxGeometry(BLOCK, BLOCK_H, BLOCK, 4, 0.018),
      shadows: Object.fromEntries(TURN.map((d, i) => [d.key, shadowInfo[d.key] ? { size: shadowInfo[d.key].size, tex: shadowTex[i] } : null])),
    };
    const step = (Math.PI * 2) / TURN.length;
    TURN.forEach((d, i) => {
      const p = new Product(d, gltfs[i], profiles[d.key], A);
      const a = i * step;
      p.group.position.set(Math.sin(a) * RING, 0, Math.cos(a) * RING);
      p.group.rotation.y = a;
      this.ring.add(p.group); this.items.push(p);
    });
    this.step = step;
    this.go(0, true);
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY, horiz: null }; });
    addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (this.drag.horiz === null && Math.hypot(dx, dy) > 6) this.drag.horiz = Math.abs(dx) > Math.abs(dy);
      if (!this.drag.horiz) return;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      const p = this.items[this.mod(this.index)];
      if (p) { p.spin.rotation.y += dx * 0.012; p.spinV = dx * 0.6; }
    });
    const up = () => { this.drag = null; };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  mod(i) { const n = this.items.length || TURN.length; return ((i % n) + n) % n; }

  go(i, instant = false) {
    this.index = i;
    const p = this.items[this.mod(i)];
    if (instant) this.cur = i;
    if (p && p.def.drink) {
      const lv = { v: 0 }; p.setLevel(0);
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
    const ai = this.mod(Math.round(this.cur)), active = this.items[ai], h = TURN[ai].h;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    let d = (h * 1.2 + 0.5) / (2 * Math.tan(vfov / 2));
    if (this.camera.aspect < 0.9) d = Math.max(d, 2.0 / (2 * Math.tan(vfov / 2) * this.camera.aspect));
    const target = { z: RING + d, y: h * 0.62 + 0.18, ly: h * 0.44 };
    if (!this.camState) this.camState = { ...target };
    const k = 1 - Math.exp(-dt * 3.5);
    for (const key of Object.keys(target)) this.camState[key] += (target[key] - this.camState[key]) * k;
    this.camera.position.set(0, this.camState.y, this.camState.z);
    this.camera.lookAt(0, this.camState.ly, RING);
    this.items.forEach((p) => {
      const isActive = p === active;
      if (isActive && !this.drag) { p.spinV *= Math.pow(0.05, dt); p.spin.rotation.y += (0.3 + p.spinV * 0.02) * dt; }
      else if (!isActive) p.spin.rotation.y += 0.1 * dt;
      const s = isActive ? 1 : 0.9;
      p.group.scale.setScalar(p.group.scale.x + (s - p.group.scale.x) * k);
      p.update(dt, t);
    });
    this.renderer.render(this.scene, this.camera);
  }
}
