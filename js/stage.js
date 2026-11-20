// The scroll-driven 3D story: hero -> pour -> macro zoom -> motif flips -> exploded anatomy -> the three forms.
import * as THREE from 'three';
import { Glassware, makeEnvironment, backdropTexture, wordmarkTexture, makeDust, LIGHT_PRESETS, smooth, lerp } from './glassware.js';
import { MOTIFS } from './config.js';
import { sound } from './sound.js';

// Keyframes along the story. g = chapter index + progress through it.
const KEYS = [
  { g: 0.0, c: [0, 0.66, 3.5], l: [0, 0.46, 0], fill: 0, ice: 0, gar: 0, ex: 0, trio: 0, front: 0, sx: 1 },
  { g: 0.9, c: [0.35, 0.8, 3.3], l: [0, 0.44, 0] },
  { g: 1.2, c: [0.45, 0.85, 3.25], l: [0, 0.42, 0], fill: 0 },
  { g: 1.55, c: [0.4, 0.8, 3.1], fill: 0.62, ice: 0 },
  { g: 1.8, ice: 1, gar: 0 },
  { g: 2.05, c: [0.3, 0.72, 3.0], gar: 1, front: 0.4 },
  { g: 2.55, c: [0, 0.5, 1.12], l: [0, 0.5, 0.2], front: 1, sx: 0 },
  { g: 3.0, c: [0, 0.5, 0.95], l: [0, 0.5, 0.25] },
  { g: 3.18, c: [0, 0.52, 1.75], l: [0, 0.48, 0] },
  { g: 3.92, c: [0, 0.52, 1.75], l: [0, 0.48, 0] },
  { g: 4.12, c: [0, 0.75, 3.5], l: [0, 0.42, 0], front: 0.5, gar: 1, ice: 1, fill: 0.62 },
  { g: 4.3, gar: 0, ice: 0, fill: 0 },
  { g: 4.68, c: [0.55, 0.95, 4.1], l: [0, 0.38, 0], ex: 1, front: 0.82 },
  { g: 4.98, ex: 1 },
  { g: 5.15, c: [0, 0.85, 4.4], l: [0, 0.5, 0], ex: 0, trio: 0, front: 0.6 },
  { g: 5.6, c: [0, 1.05, 5.7], l: [0, 0.62, 0], trio: 1 },
  { g: 6.2, c: [0, 1.05, 5.9], l: [0, 0.62, 0], trio: 1 },
];
(() => { // forward-fill
  const props = ['c', 'l', 'fill', 'ice', 'gar', 'ex', 'trio', 'front', 'sx'];
  for (let i = 1; i < KEYS.length; i++) props.forEach((p) => { if (KEYS[i][p] === undefined) KEYS[i][p] = KEYS[i - 1][p]; });
})();

function sample(g) {
  if (g <= KEYS[0].g) return KEYS[0];
  for (let i = 1; i < KEYS.length; i++) {
    const a = KEYS[i - 1], b = KEYS[i];
    if (g <= b.g) {
      const t = smooth(a.g, b.g, g);
      const o = {};
      for (const k of Object.keys(b)) {
        if (k === 'g') continue;
        o[k] = Array.isArray(b[k]) ? b[k].map((v, j) => lerp(a[k][j], v, t)) : lerp(a[k], b[k], t);
      }
      return o;
    }
  }
  return KEYS[KEYS.length - 1];
}

export class Stage {
  constructor(canvas, assets, ui) {
    this.canvas = canvas; this.assets = assets; this.ui = ui;
    this.mobile = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25;
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0907);
    scene.environment = makeEnvironment(r, 'bar');
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), new THREE.MeshBasicMaterial({ map: backdropTexture(LIGHT_PRESETS.bar.bg), toneMapped: false }));
    back.position.set(0, 2.2, -10); scene.add(back);
    this.word = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.65), new THREE.MeshBasicMaterial({ map: wordmarkTexture(), color: 0x8a6e48, alphaTest: 0.04, alphaToCoverage: true, toneMapped: false }));
    this.word.position.set(0, 0.55, -1.7); scene.add(this.word);

    const key = new THREE.DirectionalLight(0xffd6a8, 1.6); key.position.set(-2, 3, 2); scene.add(key);
    this.pLight = new THREE.PointLight(0xffc27a, 6, 6, 2); this.pLight.position.set(1, 1.2, 1.5); scene.add(this.pLight);

    this.rocks = new Glassware(assets, 'rocks', { liquid: 'whisky', level: 0, props: true });
    this.rocks.setMotif('tiger', MOTIFS[0]);
    this.mug = new Glassware(assets, 'mug', { liquid: 'beer', level: 0.84 });
    this.mug.setMotif('lion', MOTIFS[1]);
    this.tumbler = new Glassware(assets, 'tumbler', { liquid: 'juice', level: 0.76 });
    this.tumbler.setMotif('peacock', MOTIFS[3]);
    [this.rocks, this.mug, this.tumbler].forEach((gw) => scene.add(gw.group));
    this.mug.group.visible = this.tumbler.group.visible = false;

    this.dust = makeDust(this.mobile ? 140 : 380); scene.add(this.dust);

    this.state = JSON.parse(JSON.stringify(KEYS[0]));
    this.g = 0; this.pointer = new THREE.Vector2(); this.pointerS = new THREE.Vector2();
    this.spinAngle = 0; this.spinVel = 0; this.flip = 0; this.motifIdx = 0; this.lastFill = 0; this.lastIce = 0;
    this.hover = null; this.hoverLift = { rocks: 0, mug: 0, tumbler: 0 };
    this.ray = new THREE.Raycaster();
    this.callouts = [...document.querySelectorAll('.callout')];
    this.tmp = new THREE.Vector3();
    this.visible = true;
    this._bind();
    this.resize();
  }

  _bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (this.drag) {
        const dx = e.clientX - this.drag.x; this.drag.x = e.clientX;
        this.spinVel = dx * 0.012; this.spinAngle += dx * 0.012;
      }
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.target.closest('a,button,input,textarea,select,label,.atelier__view,.motif-chips')) return;
      if (this.g > 2.4 && !(this.g > 4.1 && this.g < 5.1)) return;
      this.drag = { x: e.clientX }; document.body.classList.add('is-dragging');
    });
    const up = () => { this.drag = null; document.body.classList.remove('is-dragging'); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('click', (e) => {
      if (!this.hover || e.target.closest('a,button')) return;
      this.ui.pickForm?.(this.hover);
    });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.aspect = w / h;
  }

  setG(g) { this.g = g; }

  setMotif(i) {
    if (i === this.motifIdx) return;
    this.motifIdx = i;
    const m = MOTIFS[i];
    this.ui.onMotif?.(i);
    sound.whoosh();
    const target = Math.round(this.flip / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2;
    let swapped = false;
    gsap.to(this, {
      flip: target, duration: 1.1, ease: 'power3.inOut', overwrite: true,
      onUpdate: () => {
        const prog = 1 - Math.abs(target - this.flip) / (Math.PI * 2);
        if (!swapped && prog > 0.5) { swapped = true; this.rocks.setMotif(m.key, m); sound.tick(); }
      },
      onComplete: () => { if (!swapped) this.rocks.setMotif(m.key, m); },
    });
  }

  tick(dt, t) {
    const g = this.g;
    const fade = 1 - smooth(5.85, 6.15, g);
    this.canvas.style.opacity = fade.toFixed(3);
    document.querySelector('.callouts').style.opacity = fade.toFixed(3);
    if (fade <= 0.001) { this.visible = false; return; }
    this.visible = true;

    const target = sample(g);
    const k = 1 - Math.exp(-dt * 5.5);
    const S = this.state;
    for (const key of Object.keys(target)) {
      if (key === 'g') continue;
      if (Array.isArray(target[key])) S[key] = S[key].map((v, j) => lerp(v, target[key][j], k));
      else S[key] = lerp(S[key], target[key], key === 'ice' || key === 'gar' ? Math.min(1, k * 1.4) : k);
    }
    this.pointerS.lerp(this.pointer, 1 - Math.exp(-dt * 4));

    // responsive framing
    const portrait = this.aspect < 0.85, wide = this.aspect > 1.15;
    const dist = portrait ? 1.75 : this.aspect < 1.15 ? 1.25 : 1;
    const shift = wide ? -0.5 * S.sx * Math.min(1.2, this.aspect / 1.5) : 0;
    const lookY = S.l[1] - (portrait ? lerp(0.78, 0.3, S.trio) * (1 - S.front) : 0);
    const L = new THREE.Vector3(S.l[0] + shift, lookY, S.l[2]);
    const C = new THREE.Vector3(S.c[0] + shift, S.c[1], S.c[2]);
    C.sub(L).multiplyScalar(dist).add(L);
    C.x += this.pointerS.x * 0.12 * (1 - S.front * 0.8); C.y += this.pointerS.y * 0.08 * (1 - S.front * 0.8);
    this.camera.position.copy(C); this.camera.lookAt(L);

    // the hero glass
    const R = this.rocks;
    R.setLevel(S.fill); R.setProps(S.ice, S.gar, t); R.setExplode(S.ex);
    if (S.fill > 0.06 && this.lastFill <= 0.06) sound.pour(1.4);
    if (S.ice > 0.7 && this.lastIce <= 0.7) sound.ice();
    this.lastFill = S.fill; this.lastIce = S.ice;
    if (!this.drag) { this.spinVel *= Math.pow(0.04, dt); this.spinAngle += this.spinVel * dt * 4; }
    this.spinAngle *= 1 - S.front * Math.min(1, dt * 3);
    const idle = Math.sin(t * 0.32) * 0.55;
    R.spin.rotation.y = lerp(idle + this.spinAngle, 0, S.front) + this.flip;
    R.group.rotation.x = -this.pointerS.y * 0.05 * (1 - S.front);
    R.group.rotation.z = -this.pointerS.x * 0.035 * (1 - S.front);

    // the trio
    const tr = S.trio;
    const sp = portrait ? 0.64 : 1.18;
    this.mug.group.visible = this.tumbler.group.visible = tr > 0.002;
    R.group.position.set(-sp * tr, this.hoverLift.rocks, portrait ? 0.25 * tr : 0);
    if (tr > 0.002) {
      const e = 1 - Math.pow(1 - tr, 3);
      this.mug.group.position.set(0, -3.2 * (1 - e) + this.hoverLift.mug, portrait ? -0.75 : -0.15);
      this.tumbler.group.position.set(sp * e + (1 - e) * 3, this.hoverLift.tumbler, portrait ? 0.25 : 0);
      this.mug.spin.rotation.y = Math.sin(t * 0.4 + 1) * 0.35 + (1 - e) * 3 + (this.hover === 'mug' ? t * 1.5 : 0);
      this.tumbler.spin.rotation.y = Math.sin(t * 0.36 + 2) * 0.35 - (1 - e) * 3 + (this.hover === 'tumbler' ? t * 1.5 : 0);
      if (this.hover === 'rocks') R.spin.rotation.y += t * 1.5;
      this.mug.update(dt, t); this.tumbler.update(dt, t);
      this._hoverTest();
    } else if (this.hover) { this.hover = null; this.ui.onHover?.(null); }
    for (const key of Object.keys(this.hoverLift)) this.hoverLift[key] = lerp(this.hoverLift[key], this.hover === key ? 0.12 : 0, 1 - Math.exp(-dt * 8));

    // wordmark drifts away after the hero
    this.word.position.y = 0.55 + g * 0.35; this.word.visible = g < 2.6;

    this.pLight.position.set(this.pointerS.x * 2.4, 1 + this.pointerS.y * 1.2, 1.6);
    this.dust.tick(t);
    R.update(dt, t);

    // UI readouts
    this.ui.onFill?.(S.fill / 0.62);
    const medPos = R.anchor('medallion', this.tmp);
    const zoom = 3.4 / Math.max(0.2, this.camera.position.distanceTo(medPos));
    this.ui.onZoom?.(zoom);
    if (g > 3.0 && g < 4.0) this.setMotif(Math.max(0, Math.min(5, Math.floor((g - 3.05) / 0.82 * 6))));
    else if ((g <= 3.0 || g >= 4.05) && this.motifIdx !== 0) this.setMotif(0);
    this._callouts(S.ex);

    this.renderer.render(this.scene, this.camera);
  }

  _hoverTest() {
    if (this.mobile) return;
    this.ray.setFromCamera(this.pointer, this.camera);
    let hit = null;
    for (const [name, gw] of [['rocks', this.rocks], ['mug', this.mug], ['tumbler', this.tumbler]]) {
      if (this.ray.intersectObject(gw.parts.Glass, false).length) { hit = name; break; }
    }
    if (hit !== this.hover) { this.hover = hit; this.ui.onHover?.(hit); if (hit) sound.tick(); }
  }

  _callouts(ex) {
    const W = innerWidth, H = innerHeight;
    this.callouts.forEach((el, i) => {
      const o = smooth(0.35 + i * 0.08, 0.75 + i * 0.05, ex);
      if (o < 0.01) { el.style.opacity = 0; return; }
      const p = this.rocks.anchor(el.dataset.anchor, this.tmp).project(this.camera);
      const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
      const left = el.dataset.anchor === 'wall' || el.dataset.anchor === 'coaster';
      el.classList.toggle('is-left', left);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate(${left ? x - el.offsetWidth : x}px, ${y - el.offsetHeight / 2}px)`;
    });
  }
}
