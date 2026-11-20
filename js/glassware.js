// Shared 3D layer: loads the Blender-built GLB models and turns them into
// interactive glass objects (fill, medallion, rim, explode, props).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MOTIFS } from './config.js';

export const SCALE = 10; // Blender metres -> scene units (1 unit = 10 cm)

/* ------------------------------------------------------------------ assets */
export async function loadAssets(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, loaded, total) => onProgress(loaded / total);
  const gltf = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);
  const base = './assets/';
  const [rocks, mug, tumbler, props, profiles, ...motifTex] = await Promise.all([
    gltf.loadAsync(base + 'models/rocks.glb'),
    gltf.loadAsync(base + 'models/mug.glb'),
    gltf.loadAsync(base + 'models/tumbler.glb'),
    gltf.loadAsync(base + 'models/props.glb'),
    fetch(base + 'models/profiles.json').then((r) => r.json()),
    ...MOTIFS.map((m) => texLoader.loadAsync(base + `tex/medallion-${m.key}.png`)),
  ]);
  const motifs = {};
  MOTIFS.forEach((m, i) => { motifs[m.key] = prepTex(motifTex[i]); });
  const meshes = (g) => { const out = {}; g.scene.traverse((o) => { if (o.isMesh) out[o.name.split('_').slice(1).join('_')] = o; }); return out; };
  return {
    models: { rocks: meshes(rocks), mug: meshes(mug), tumbler: meshes(tumbler) },
    props: meshes(props),
    profiles,
    motifs,
  };
}

export function prepTex(t, flipY = false) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = flipY;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/* --------------------------------------------------------------- materials */
export const RIMS = {
  gold: { color: 0xe9b862, rough: 0.16 },
  rose: { color: 0xe7a48a, rough: 0.18 },
  platinum: { color: 0xdfe3e8, rough: 0.12 },
};

export function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02,
    transmission: 1, thickness: 0.012, ior: 1.5,
    specularIntensity: 1, envMapIntensity: 1.3,
    clearcoat: 0.3, clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0xfff6e6), attenuationDistance: 3,
  });
}
export function goldMaterial(color = 0xe9b862, rough = 0.16) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, envMapIntensity: 1.5, clearcoat: 0.35, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
}
function medallionMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.26, envMapIntensity: 1.5, alphaTest: 0.5, side: THREE.DoubleSide, clearcoat: 0.5, clearcoatRoughness: 0.12, bumpScale: 2.5 });
}

export const LIQUIDS = {
  empty: null,
  whisky: { color: 0xffd6a0, atten: 0xd0701c, dist: 1.1, trans: 1, rough: 0.02, ior: 1.36 },
  beer: { color: 0xffe9a8, atten: 0xe8a83a, dist: 1.6, trans: 1, rough: 0.03, ior: 1.34, foam: true, bubbles: true },
  juice: { color: 0xffb12e, atten: 0xff9a10, dist: 0.6, trans: 0.4, rough: 0.25, ior: 1.35 },
  water: { color: 0xffffff, atten: 0xd6efff, dist: 4, trans: 1, rough: 0.01, ior: 1.33 },
};

function liquidMaterial() {
  return new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0.02, thickness: 0.07, ior: 1.36, envMapIntensity: 1.1, color: 0xffc58a, attenuationColor: new THREE.Color(0xb4500e), attenuationDistance: 0.32, side: THREE.DoubleSide });
}

/* --------------------------------------------------------- shared textures */
let _woodTex = null, _shadowTex = null, _sprite = null;
export function woodTexture() {
  if (_woodTex) return _woodTex;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#3a1f10'; x.fillRect(0, 0, 512, 512);
  for (let r = 4; r < 360; r += 3 + Math.random() * 5) {
    x.beginPath();
    x.strokeStyle = `rgba(${20 + Math.random() * 30},${8 + Math.random() * 10},4,${0.25 + Math.random() * 0.35})`;
    x.lineWidth = 1 + Math.random() * 2.5;
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.05) {
      const rr = r + Math.sin(a * 3 + r) * 2.5 + Math.sin(a * 7) * 1.2;
      const px = 256 + 40 + rr * Math.cos(a), py = 256 - 30 + rr * Math.sin(a) * 0.92;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  }
  _woodTex = new THREE.CanvasTexture(c); _woodTex.colorSpace = THREE.SRGBColorSpace;
  return _woodTex;
}
export function shadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.45, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
export function spriteTexture() {
  if (_sprite) return _sprite;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,200,110,.6)'); g.addColorStop(1, 'rgba(255,180,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _sprite = new THREE.CanvasTexture(c);
  return _sprite;
}

/* ------------------------------------------------------------ environment */
export const LIGHT_PRESETS = {
  bar: { base: 0x0b0705, bg: ['#5a381a', '#1a120b', '#0b0907'], panels: [
    { w: 5, h: 1.2, c: 0xfff0dc, i: 2.6, p: [0, 4.6, 0.5] },
    { w: 0.35, h: 4.5, c: 0xffb766, i: 7, p: [-4.6, 0.6, 1.2] },
    { w: 0.35, h: 4.5, c: 0xffa955, i: 5.5, p: [4.6, 0.6, -0.8] },
    { w: 3.2, h: 1.6, c: 0xffd9b0, i: 0.9, p: [0, 1, 4.8] },
    { w: 0.6, h: 0.6, c: 0xffa040, i: 6, p: [-1.8, 1.4, -4.8] },
    { w: 0.5, h: 0.5, c: 0xffb060, i: 5, p: [1.6, 0.9, -4.8] },
    { w: 0.4, h: 0.4, c: 0xff9a40, i: 6, p: [0.2, 2.1, -4.8] },
  ], key: 0xffd2a0, keyI: 2.2 },
  day: { base: 0x30302f, bg: ['#5b5651', '#2d2a27', '#1a1816'], panels: [
    { w: 4, h: 3.2, c: 0xffffff, i: 4.2, p: [-4.7, 1, 0.4] },
    { w: 5, h: 1.5, c: 0xf4f7ff, i: 2.2, p: [0, 4.7, 0] },
    { w: 2.5, h: 2.5, c: 0xffffff, i: 1.1, p: [4.7, 0.6, 0] },
    { w: 3, h: 1.4, c: 0xfffaf0, i: 1.2, p: [0, 1, 4.8] },
  ], key: 0xffffff, keyI: 2.6 },
  candle: { base: 0x050302, bg: ['#24130a', '#0d0805', '#060403'], panels: [
    { w: 0.5, h: 0.9, c: 0xff8a2a, i: 9, p: [-2.2, -0.4, 3.6] },
    { w: 0.4, h: 0.7, c: 0xff7a1a, i: 7, p: [2.6, -0.6, 3.0] },
    { w: 0.3, h: 0.5, c: 0xff9a40, i: 6, p: [0, 0.2, -4.8] },
    { w: 3, h: 0.6, c: 0xffb070, i: 0.5, p: [0, 4.6, 0] },
  ], key: 0xff9c4a, keyI: 1.2 },
};

export function makeEnvironment(renderer, presetKey = 'bar') {
  const pre = LIGHT_PRESETS[presetKey];
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: pre.base, side: THREE.BackSide })));
  pre.panels.forEach(({ w, h, c, i, p }) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.035).texture;
  pmrem.dispose();
  return tex;
}

/* -------------------------------------------- canvas medallions (bespoke) */
function coinBase(x, S) {
  const c = S / 2;
  const g = x.createRadialGradient(S * 0.36, S * 0.3, S * 0.04, c, c, S * 0.52);
  g.addColorStop(0, '#fff3cf'); g.addColorStop(0.35, '#e8bb63'); g.addColorStop(0.75, '#b0802f'); g.addColorStop(1, '#6a4716');
  x.fillStyle = g; x.beginPath(); x.arc(c, c, S * 0.49, 0, Math.PI * 2); x.fill();
  // beaded edge
  x.fillStyle = 'rgba(255,240,200,.55)';
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2; x.beginPath();
    x.arc(c + Math.cos(a) * S * 0.455, c + Math.sin(a) * S * 0.455, S * 0.008, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(90,60,20,.55)'; x.lineWidth = S * 0.006;
  x.beginPath(); x.arc(c, c, S * 0.425, 0, Math.PI * 2); x.stroke();
}
function engrave(x, draw) {
  // emboss: dark offset, light offset, then gold fill
  x.save(); x.translate(4, 5); x.globalAlpha = 0.55; draw('#4a3010'); x.restore();
  x.save(); x.translate(-3, -3); x.globalAlpha = 0.8; draw('#fff6dc'); x.restore();
  draw(null);
}
function goldFill(x, S) {
  const g = x.createLinearGradient(0, S * 0.2, S, S * 0.8);
  g.addColorStop(0, '#f9e2a6'); g.addColorStop(0.5, '#d6a24a'); g.addColorStop(1, '#a5752a');
  return g;
}
export function monogramTexture(text = 'SJ') {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); coinBase(x, S);
  const t = (text || '').toUpperCase().slice(0, 3) || '✦';
  const size = t.length === 1 ? 470 : t.length === 2 ? 380 : 290;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`;
  engrave(x, (col) => { x.fillStyle = col || goldFill(x, S); x.fillText(t, S / 2, S / 2 + size * 0.04); });
  // ring text
  x.font = `600 38px "Inter Tight", sans-serif`; x.fillStyle = 'rgba(80,52,16,.7)';
  const ring = 'AUREUM  ·  BESPOKE  ·  AUREUM  ·  BESPOKE  ·  ';
  for (let i = 0; i < ring.length; i++) {
    const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    x.save(); x.translate(S / 2 + Math.cos(a) * S * 0.385, S / 2 + Math.sin(a) * S * 0.385); x.rotate(a + Math.PI / 2); x.fillText(ring[i], 0, 0); x.restore();
  }
  return canvasTex(c);
}
export function logoTexture(img) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); coinBase(x, S);
  // logo -> alpha mask
  const L = 560, m = document.createElement('canvas'); m.width = m.height = L;
  const mx = m.getContext('2d');
  const k = Math.min(L / img.width, L / img.height);
  const w = img.width * k, h = img.height * k;
  mx.drawImage(img, (L - w) / 2, (L - h) / 2, w, h);
  const d = mx.getImageData(0, 0, L, L), px = d.data;
  const corner = px[3] + px[(L - 1) * 4 + 3] + px[(L * (L - 1)) * 4 + 3];
  if (corner > 600) { // opaque image: treat dark pixels as the mark
    let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    const avg = sum / (px.length / 4) / 3, invert = avg < 128;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11);
      px[i + 3] = Math.max(0, Math.min(255, ((invert ? lum : 255 - lum) - 40) * 1.6));
    }
    mx.putImageData(d, 0, 0);
  }
  const tint = (col) => {
    const t = document.createElement('canvas'); t.width = t.height = L;
    const tx = t.getContext('2d'); tx.drawImage(m, 0, 0);
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col || goldFill(tx, L); tx.fillRect(0, 0, L, L);
    return t;
  };
  engrave(x, (col) => x.drawImage(tint(col), (S - L) / 2, (S - L) / 2));
  return canvasTex(c);
}
function canvasTex(c) { const t = new THREE.CanvasTexture(c); return prepTex(t, false); }

/* --------------------------------------------------------------- the glass */
export class Glassware {
  constructor(assets, form, opts = {}) {
    this.assets = assets; this.form = form; this.pj = assets.profiles[form];
    this.group = new THREE.Group();
    this.spin = new THREE.Group(); this.group.add(this.spin);
    this.model = new THREE.Group(); this.model.scale.setScalar(SCALE); this.spin.add(this.model);
    this.mats = { glass: glassMaterial(), gold: goldMaterial(), rim: goldMaterial(), flakes: goldMaterial(0xffcf74, 0.22), med: medallionMaterial(), liquid: liquidMaterial() };
    this.parts = {};
    const src = assets.models[form];
    for (const [key, m] of Object.entries(src)) {
      const mat = key === 'Glass' || key === 'Handle' ? this.mats.glass
        : key === 'Rim' ? this.mats.rim : key === 'Medallion' ? this.mats.med
        : key === 'Flakes' ? this.mats.flakes : this.mats.gold;
      const mesh = new THREE.Mesh(m.geometry, mat);
      mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale);
      mesh.userData.base = mesh.position.clone();
      if (key === 'Glass' || key === 'Handle') mesh.renderOrder = 2;
      this.model.add(mesh); this.parts[key] = mesh;
    }
    // liquid, foam, bubbles
    this.liquid = new THREE.Mesh(new THREE.BufferGeometry(), this.mats.liquid);
    this.liquid.renderOrder = 1; this.liquid.visible = false; this.model.add(this.liquid);
    this.foam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xfbf3e2, roughness: 0.85, envMapIntensity: 0.6 }));
    this.foam.visible = false; this.model.add(this.foam);
    this._bubbles();
    this.level = 0; this._built = -1; this.liquidType = 'empty';
    this.setLiquid(opts.liquid || 'empty');
    this.setLevel(opts.level || 0);
    this.setRim(opts.rim || 'gold');
    if (opts.motif) this.setMotif(opts.motif);
    if (opts.coaster !== false) this._coaster();
    if (opts.props) this._props();
    this.explode = 0;
  }

  _coaster() {
    const p = this.assets.props.Coaster;
    const wood = new THREE.MeshPhysicalMaterial({ map: woodTexture(), color: 0x8a5a3a, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
    this.coaster = new THREE.Mesh(p.geometry, wood);
    this.coaster.position.y = -0.0082; this.coaster.userData.base = this.coaster.position.clone();
    const r = Math.max(0.051, this.pj.outer[0][0] + 0.012) / 0.051;
    this.coaster.scale.set(r, 1, r);
    this.model.add(this.coaster);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = -0.0085; this.shadow.scale.setScalar(r);
    this.model.add(this.shadow);
  }

  _props() {
    const P = this.assets.props;
    this.ice = new THREE.Mesh(P.Ice.geometry, new THREE.MeshPhysicalMaterial({ color: 0xf2f9ff, transmission: 1, roughness: 0.14, thickness: 0.02, ior: 1.31, envMapIntensity: 1.2, side: THREE.DoubleSide }));
    this.ice.visible = false; this.model.add(this.ice);
    this.cinnamon = new THREE.Mesh(P.Cinnamon.geometry, new THREE.MeshStandardMaterial({ color: 0x6b3216, roughness: 0.85 }));
    this.rosemary = new THREE.Mesh(P.Rosemary.geometry, new THREE.MeshStandardMaterial({ color: 0x3c5a30, roughness: 0.6 }));
    this.cinnamon.visible = this.rosemary.visible = false;
    this.model.add(this.cinnamon, this.rosemary);
    this.iceT = 0; this.garnishT = 0;
  }

  setProps(ice = 0, garnish = 0, time = 0) {
    if (!this.ice) return;
    const H = this.pj.height, top = this._levelZ();
    this.iceT = ice; this.garnishT = garnish;
    this.ice.visible = ice > 0.001;
    if (this.ice.visible) {
      const bounce = easeOutBounce(ice);
      const rest = Math.max(this.pj.base + 0.016, top - 0.004);
      this.ice.position.set(0.004, rest + (1 - bounce) * 0.14 + Math.sin(time * 1.3) * 0.0012 * ice, 0.003);
      this.ice.rotation.set(0.4 + (1 - ice) * 2.2 + Math.sin(time * 0.7) * 0.03, 0.25 + (1 - ice) * 1.5, 0.6);
    }
    const gv = garnish > 0.001;
    this.cinnamon.visible = this.rosemary.visible = gv;
    if (gv) {
      const e = 1 - Math.pow(1 - garnish, 3);
      this.cinnamon.position.set(0.016, this.pj.base + 0.004 + (1 - e) * 0.12, -0.014);
      this.cinnamon.rotation.set(-0.32, 0.4, -0.3 - (1 - e) * 0.6);
      this.rosemary.position.set(-0.014, this.pj.base + 0.006 + (1 - e) * 0.16, -0.012);
      this.rosemary.rotation.set(-0.28, -0.3, 0.38 + (1 - e) * 0.7);
      void H;
    }
  }

  _bubbles() {
    const N = 90, pos = new Float32Array(N * 3);
    this.bubbleSeed = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random(), 0.3 + Math.random()]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.bubbles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.022, map: spriteTexture(), transparent: true, depthWrite: false, opacity: 0.65, color: 0xfff1c0 }));
    this.bubbles.visible = false; this.model.add(this.bubbles);
  }

  _levelZ(l = this.level) {
    const pj = this.pj;
    return pj.base + (pj.height - pj.wall - 0.006 - pj.base) * l;
  }
  _radiusAt(z) {
    const inn = this.pj.inner;
    for (let i = 1; i < inn.length; i++) {
      if (inn[i][1] >= z) { const [r0, z0] = inn[i - 1], [r1, z1] = inn[i]; return r0 + (r1 - r0) * ((z - z0) / Math.max(z1 - z0, 1e-6)); }
    }
    return inn[inn.length - 1][0];
  }

  setLiquid(type) {
    this.liquidType = type;
    const L = LIQUIDS[type];
    if (!L) { this.liquid.visible = this.foam.visible = this.bubbles.visible = false; return; }
    const m = this.mats.liquid;
    m.color.set(L.color); m.attenuationColor.set(L.atten); m.attenuationDistance = L.dist;
    m.transmission = L.trans; m.roughness = L.rough; m.ior = L.ior;
    this._built = -1; this.setLevel(this.level);
  }

  setLevel(l) {
    this.level = Math.max(0, Math.min(1, l));
    const show = this.level > 0.012 && !!LIQUIDS[this.liquidType];
    this.liquid.visible = show;
    const L = LIQUIDS[this.liquidType];
    this.foam.visible = show && !!(L && L.foam);
    this.bubbles.visible = show && !!(L && L.bubbles);
    if (!show || Math.abs(this._built - this.level) < 0.002) return;
    this._built = this.level;
    const pj = this.pj, gap = 0.0004, zTop = this._levelZ();
    const pts = [new THREE.Vector2(0.0001, pj.base + gap)];
    for (let i = 1; i < pj.inner.length; i++) {
      const [r, z] = pj.inner[i];
      if (z >= zTop) break;
      pts.push(new THREE.Vector2(Math.max(r - gap, 0.0002), Math.max(z, pj.base + gap)));
    }
    const rTop = this._radiusAt(zTop) - gap;
    pts.push(new THREE.Vector2(rTop, zTop), new THREE.Vector2(rTop * 0.5, zTop), new THREE.Vector2(0.0001, zTop));
    this.liquid.geometry.dispose();
    this.liquid.geometry = new THREE.LatheGeometry(pts, 72);
    this.rTop = rTop; this.zTop = zTop;
    if (L && L.foam) {
      this.foam.geometry.dispose();
      const f = [[0.0001, zTop - 0.001], [rTop, zTop - 0.001], [rTop * 1.0, zTop + 0.005], [rTop * 0.92, zTop + 0.010], [rTop * 0.6, zTop + 0.0135], [0.0001, zTop + 0.0145]];
      this.foam.geometry = new THREE.LatheGeometry(f.map(([a, b]) => new THREE.Vector2(a, b)), 64);
    }
  }

  setMotif(texOrKey, meta = null) {
    const tex = typeof texOrKey === 'string' ? this.assets.motifs[texOrKey] : texOrKey;
    const m = this.mats.med;
    m.map = tex; m.bumpMap = tex;
    if (meta) { m.metalness = meta.metal; m.roughness = meta.rough; }
    m.needsUpdate = true;
  }

  setRim(kind) {
    const r = RIMS[kind];
    const rim = this.parts.Rim;
    if (!rim) return;
    rim.visible = !!r;
    if (r) { this.mats.rim.color.set(r.color); this.mats.rim.roughness = r.rough; }
  }

  setExplode(e) {
    this.explode = e;
    const P = this.parts, k = e;
    if (P.Rim) P.Rim.position.y = P.Rim.userData.base.y + 0.034 * k;
    ['Medallion', 'Bezel'].forEach((n) => { if (P[n]) P[n].position.z = P[n].userData.base.z + 0.034 * k; });
    if (P.Flakes) P.Flakes.position.y = P.Flakes.userData.base.y - 0.02 * k;
    if (this.coaster) { this.coaster.position.y = this.coaster.userData.base.y - 0.045 * k; this.shadow.position.y = -0.0085 - 0.045 * k; }
  }

  // anchor points (world) for anatomy callouts
  anchor(name, out = new THREE.Vector3()) {
    const pj = this.pj, P = this.parts;
    const R = pj.outer[pj.outer.length - 1][0];
    switch (name) {
      case 'rim': out.set(R, pj.height + 0.034 * this.explode, 0); break;
      case 'wall': out.set(-R, pj.height * 0.7, 0); break;
      case 'medallion': out.set(pj.medallion.r * 1.08, pj.medallion.z, R + 0.004 + 0.034 * this.explode); break;
      case 'base': out.set(R, pj.base * 0.5 - 0.02 * this.explode, 0); break;
      case 'coaster': out.set(-0.054, -0.004 - 0.045 * this.explode, 0.0); break;
    }
    void P;
    return this.model.localToWorld(out);
  }

  update(dt, t) {
    if (this.bubbles.visible) {
      const pos = this.bubbles.geometry.attributes.position, b = this.pj.base, top = this.zTop || b;
      const h = top - b;
      this.bubbleSeed.forEach((s, i) => {
        s[2] = (s[2] + dt * 0.12 * s[3]) % 1;
        const r = (this.rTop || 0.03) * 0.82 * Math.sqrt(s[0]), a = s[1] * 6.283 + t * 0.2 * s[3];
        pos.setXYZ(i, r * Math.cos(a), b + 0.002 + s[2] * (h - 0.003), r * Math.sin(a));
      });
      pos.needsUpdate = true;
    }
  }

  dispose() {
    Object.values(this.mats).forEach((m) => m.dispose());
    this.liquid.geometry.dispose(); this.foam.geometry.dispose(); this.bubbles.geometry.dispose();
  }
}

export function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/* -------------------------------------------------- backdrop + dust + word */
export function backdropTexture(stops, bokeh = true, w = 2048, h = 1024) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = stops[2]; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.5, w * 0.55);
  g.addColorStop(0, stops[0]); g.addColorStop(0.5, stops[1]); g.addColorStop(1, stops[2]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  if (bokeh) {
    for (let i = 0; i < 46; i++) {
      const px = Math.random() * w, py = h * (0.08 + Math.random() * 0.5), r = 14 + Math.random() * 70;
      const bg = x.createRadialGradient(px, py, 0, px, py, r);
      const a = 0.12 + Math.random() * 0.28;
      bg.addColorStop(0, `rgba(255,${170 + Math.random() * 50 | 0},90,${a})`); bg.addColorStop(0.7, `rgba(255,170,80,${a * 0.6})`); bg.addColorStop(1, 'rgba(255,160,70,0)');
      x.fillStyle = bg; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    // shelf glints
    for (let s = 0; s < 3; s++) {
      const y = h * (0.18 + s * 0.17);
      const lg = x.createLinearGradient(0, y - 3, 0, y + 3);
      lg.addColorStop(0, 'rgba(255,190,110,0)'); lg.addColorStop(0.5, 'rgba(255,190,110,.10)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
      x.fillStyle = lg; x.fillRect(0, y - 3, w, 6);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function wordmarkTexture(text = 'AUREUM') {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
  const x = c.getContext('2d');
  x.font = '300 360px "Cormorant Garamond", Georgia, serif';
  x.textBaseline = 'middle';
  const sp = 70; let total = 0;
  const ws = [...text].map((ch) => { const w = x.measureText(ch).width; total += w + sp; return w; });
  total -= sp;
  let px = (2048 - total) / 2;
  const g = x.createLinearGradient(0, 100, 2048, 420);
  g.addColorStop(0, '#7a5520'); g.addColorStop(0.3, '#f3d79a'); g.addColorStop(0.5, '#c9953f'); g.addColorStop(0.7, '#fff0c6'); g.addColorStop(1, '#8a6424');
  x.fillStyle = g;
  [...text].forEach((ch, i) => { x.fillText(ch, px, 270); px += ws[i] + sp; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function makeDust(count, spread = [8, 4, 6]) {
  const pos = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = Math.random() * spread[1] - 0.6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    seeds[i] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.028, map: spriteTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, color: 0xffd28a }));
  pts.userData = { seeds, spread };
  pts.tick = (t) => {
    const p = g.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + 0.0016 + Math.sin(t * 0.5 + seeds[i]) * 0.0006;
      if (y > spread[1] - 0.6) y = -0.6;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + seeds[i]) * 0.0007);
    }
    p.needsUpdate = true;
  };
  return pts;
}
