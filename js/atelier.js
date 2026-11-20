// The Atelier: a real-time configurator with orbit, fills, medallions, monogram/logo, light presets and a toast.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Glassware, makeEnvironment, backdropTexture, LIGHT_PRESETS, monogramTexture, logoTexture, spriteTexture, lerp } from './glassware.js';
import { MOTIFS, FORMS } from './config.js';
import { sound } from './sound.js';

const LEVELS = { empty: 0, whisky: 0.55, beer: 0.86, juice: 0.8, water: 0.74 };

export class Atelier {
  constructor(canvas, assets, { onChange } = {}) {
    this.canvas = canvas; this.assets = assets; this.onChange = onChange;
    this.state = { form: 'rocks', motif: 'tiger', rim: 'gold', fill: 'whisky', light: 'bar', mono: 'SJ' };
    this.mobile = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.envs = {}; this.backs = {};
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
    this.camera.position.set(1.2, 1.1, 3.4);
    const c = this.controls = new OrbitControls(this.camera, canvas);
    c.enableDamping = true; c.dampingFactor = 0.06; c.enablePan = false;
    c.minDistance = 1.2; c.maxDistance = 6; c.minPolarAngle = 0.35; c.maxPolarAngle = 1.72;
    c.autoRotate = true; c.autoRotateSpeed = 0.9; c.target.set(0, 0.48, 0);
    c.addEventListener('start', () => { c.autoRotate = false; clearTimeout(this._ar); });
    c.addEventListener('end', () => { clearTimeout(this._ar); this._ar = setTimeout(() => { c.autoRotate = true; }, 3500); });

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(24, 48, 24), new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false }));
    this.scene.add(this.sky);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshPhysicalMaterial({ color: 0x15100c, roughness: 0.28, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -0.088; this.scene.add(this.floor);
    this.key = new THREE.DirectionalLight(0xffd2a0, 2); this.key.position.set(-2, 3, 2); this.scene.add(this.key);

    // sparks for the toast
    const N = 140, pos = new Float32Array(N * 3);
    this.sparkV = Array.from({ length: N }, () => new THREE.Vector3());
    this.sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ size: 0.05, map: spriteTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd58a, opacity: 0 }));
    this.scene.add(this.sparks);

    this.flip = 0; this.level = 0; this.visible = false;
    this.setLight('bar', true);
    this.build('rocks', true);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const el = this.canvas.parentElement, w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  emit() { this.onChange?.({ ...this.state }); }

  build(form, instant = false) {
    const old = this.glass;
    this.state.form = form;
    const g = this.glass = new Glassware(this.assets, form, { liquid: this.state.fill, level: 0, rim: this.state.rim, props: form === 'rocks' });
    this._applyMotif(false);
    this.scene.add(g.group);
    const H = g.pj.height * 10;
    gsap.to(this.controls.target, { y: H * 0.5, duration: 1, ease: 'power3.inOut' });
    const d = form === 'mug' ? 4.6 : 3.4;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (!instant) gsap.to(this.camera.position, { x: dir.x * d, y: H * 0.5 + dir.y * d, z: dir.z * d, duration: 1.1, ease: 'power3.inOut' });
    else this.camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0, H * 0.5, 0));
    if (old) {
      gsap.to(old.group.position, { x: -2.6, duration: 0.8, ease: 'power3.in' });
      gsap.to(old.group.rotation, { z: 0.5, duration: 0.8, ease: 'power3.in', onComplete: () => { this.scene.remove(old.group); old.dispose(); } });
      g.group.position.x = 2.6; g.group.rotation.z = -0.4;
      gsap.to(g.group.position, { x: 0, duration: 1.1, delay: 0.25, ease: 'power3.out' });
      gsap.to(g.group.rotation, { z: 0, duration: 1.3, delay: 0.25, ease: 'elastic.out(1, 0.6)' });
      sound.whoosh();
    }
    this.level = 0;
    this._pour(this.state.fill, instant ? 0 : 0.7);
    this.emit();
  }

  _pour(type, delay = 0) {
    const g = this.glass, target = LEVELS[type] ?? 0;
    gsap.killTweensOf(this, 'level');
    const tl = gsap.timeline({ delay });
    if (this.level > 0.02) tl.to(this, { level: 0, duration: 0.5, ease: 'power2.in', onUpdate: () => g.setLevel(this.level) });
    tl.add(() => { g.setLiquid(type); g.setProps(0, 0); if (target > 0) sound.pour(1.2); });
    if (target > 0) tl.to(this, { level: target, duration: 1.5, ease: 'power2.out', onUpdate: () => g.setLevel(this.level) });
    if (type === 'whisky' && g.ice) {
      const p = { ice: 0, gar: 0 };
      tl.to(p, { ice: 1, duration: 1.1, ease: 'none', onUpdate: () => g.setProps(p.ice, p.gar, performance.now() / 1000), onComplete: () => sound.ice() }, '-=0.4')
        .to(p, { gar: 1, duration: 0.9, ease: 'none', onUpdate: () => g.setProps(p.ice, p.gar, performance.now() / 1000) }, '-=0.5');
      this._propsOn = true;
    } else this._propsOn = false;
  }

  setFill(type) { this.state.fill = type; this._pour(type); this.emit(); }
  setRim(kind) { this.state.rim = kind; this.glass.setRim(kind); sound.tick(); this.emit(); }

  setMotif(key, extra) {
    this.state.motif = key;
    if (key === 'monogram' && extra !== undefined) this.state.mono = extra;
    if (key === 'logo' && extra) this.logoImg = extra;
    this._applyMotif(true);
    this.emit();
  }
  updateMonogram(text) {
    this.state.mono = text;
    if (this.state.motif === 'monogram') { this.glass.setMotif(monogramTexture(text), { metal: 0.55, rough: 0.3 }); this.emit(); }
  }

  _texFor() {
    const s = this.state;
    if (s.motif === 'monogram') return [monogramTexture(s.mono), { metal: 0.55, rough: 0.3 }];
    if (s.motif === 'logo' && this.logoImg) return [logoTexture(this.logoImg), { metal: 0.55, rough: 0.3 }];
    if (s.motif === 'logo') return [monogramTexture('✦'), { metal: 0.55, rough: 0.3 }];
    const m = MOTIFS.find((x) => x.key === s.motif);
    return [this.assets.motifs[m.key], m];
  }

  _applyMotif(animate) {
    const [tex, meta] = this._texFor();
    if (!animate) { this.glass.setMotif(tex, meta); return; }
    const target = Math.round(this.flip / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2;
    let swapped = false;
    sound.whoosh();
    gsap.to(this, {
      flip: target, duration: 1, ease: 'power3.inOut', overwrite: 'auto',
      onUpdate: () => { if (!swapped && 1 - Math.abs(target - this.flip) / (Math.PI * 2) > 0.5) { swapped = true; this.glass.setMotif(tex, meta); } },
      onComplete: () => { if (!swapped) this.glass.setMotif(tex, meta); },
    });
  }

  setLight(key, instant = false) {
    this.state.light = key;
    const pre = LIGHT_PRESETS[key];
    if (!this.envs[key]) { this.envs[key] = makeEnvironment(this.renderer, key); this.backs[key] = backdropTexture(pre.bg, key !== 'day', 1024, 512); }
    this.scene.environment = this.envs[key];
    this.sky.material.map = this.backs[key]; this.sky.material.needsUpdate = true;
    this.key.color.set(pre.key);
    gsap.to(this.key, { intensity: pre.keyI, duration: instant ? 0 : 0.8 });
    gsap.fromTo(this.renderer, { toneMappingExposure: instant ? 1.05 : 0.3 }, { toneMappingExposure: key === 'candle' ? 0.95 : 1.05, duration: instant ? 0 : 0.9, ease: 'power2.out' });
    this.floor.material.color.set(key === 'day' ? 0x3a3631 : 0x15100c);
    this.emit();
  }

  resetView() {
    const H = this.glass.pj.height * 10, d = this.state.form === 'mug' ? 4.6 : 3.4;
    gsap.to(this.camera.position, { x: 0, y: H * 0.55 + 0.25, z: d, duration: 1.1, ease: 'power3.inOut' });
    sound.whoosh();
  }

  toast() {
    if (this._toasting) return;
    this._toasting = true;
    const g1 = this.glass, form = this.state.form;
    const g2 = new Glassware(this.assets, form, { liquid: this.state.fill, level: this.level, rim: this.state.rim, props: false });
    const [tex, meta] = this._texFor(); g2.setMotif(tex, meta);
    this.scene.add(g2.group);
    const pj = g1.pj, Rt = pj.outer[pj.outer.length - 1][0] * 10, H = pj.height * 10, tilt = 0.16;
    const d = 2 * Rt + 2 * H * Math.sin(tilt) - 0.02;
    const spin1 = form === 'mug' ? Math.PI / 2 : 0.5, spin2 = form === 'mug' ? -Math.PI / 2 : -0.5;
    g2.group.position.set(d + 2.8, 0, 0); g2.spin.rotation.y = spin2;
    this.controls.enabled = false; this.controls.autoRotate = false;
    const camD = (form === 'mug' ? 5.6 : 4.2);
    const tl = gsap.timeline({ onComplete: () => { this.scene.remove(g2.group); g2.dispose(); this.controls.enabled = true; this._toasting = false; this.controls.autoRotate = true; } });
    tl.to(this.controls.target, { x: d / 2, y: H * 0.55, duration: 0.9, ease: 'power3.inOut' }, 0)
      .to(this.camera.position, { x: d / 2, y: H * 0.7, z: camD, duration: 0.9, ease: 'power3.inOut' }, 0)
      .to(this, { flip: this.flip + spin1, duration: 0.8, ease: 'power2.inOut' }, 0)
      .to(g2.group.position, { x: d + 0.35, duration: 0.9, ease: 'power3.out' }, 0.3)
      .to(g1.group.rotation, { z: -tilt, duration: 0.5, ease: 'power2.inOut' }, 1.0)
      .to(g2.group.rotation, { z: tilt, duration: 0.5, ease: 'power2.inOut' }, 1.0)
      .to(g2.group.position, { x: d, duration: 0.5, ease: 'power2.in' }, 1.0)
      .add(() => {
        sound.clink(1); this._burst(new THREE.Vector3(d / 2, H * Math.cos(tilt) - 0.02, 0));
        [g1, g2].forEach((g) => gsap.fromTo(g.liquid.rotation, { z: 0.08 }, { z: 0, duration: 1.4, ease: 'elastic.out(1, 0.3)' }));
      }, 1.5)
      .to(g1.group.rotation, { z: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, 1.55)
      .to(g2.group.rotation, { z: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, 1.55)
      .to(g2.group.position, { x: d + 3.2, duration: 0.9, ease: 'power3.in' }, 2.3)
      .to(this.controls.target, { x: 0, duration: 1, ease: 'power3.inOut' }, 2.5)
      .to(this.camera.position, { x: 0.9, z: camD - 0.8, duration: 1, ease: 'power3.inOut' }, 2.5)
      .to(this, { flip: this.flip, duration: 1, ease: 'power3.inOut' }, 2.5);
  }

  _burst(at) {
    const pos = this.sparks.geometry.attributes.position;
    this.sparkV.forEach((v, i) => {
      pos.setXYZ(i, at.x, at.y, at.z);
      v.set((Math.random() - 0.5) * 2.4, Math.random() * 2.2 + 0.4, (Math.random() - 0.5) * 2.4);
    });
    pos.needsUpdate = true;
    this.sparks.material.opacity = 1;
    gsap.to(this.sparks.material, { opacity: 0, duration: 1.6, ease: 'power2.in' });
  }

  snapshot(size = 0) {
    this.renderer.render(this.scene, this.camera);
    if (!size) return this.canvas.toDataURL('image/png');
    const c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(this.canvas.width, this.canvas.height);
    c.getContext('2d').drawImage(this.canvas, (this.canvas.width - s) / 2, (this.canvas.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.82);
  }

  tick(dt, t) {
    if (!this.visible) return;
    this.controls.update();
    this.glass.spin.rotation.y = this.flip;
    this.glass.update(dt, t);
    if (this._propsOn && this.glass.ice && this.glass.iceT > 0.99) this.glass.setProps(1, this.glass.garnishT, t);
    if (this.sparks.material.opacity > 0.01) {
      const pos = this.sparks.geometry.attributes.position;
      this.sparkV.forEach((v, i) => {
        v.y -= dt * 3.2; v.multiplyScalar(1 - dt * 0.6);
        pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt);
      });
      pos.needsUpdate = true;
    }
    void lerp; void FORMS;
    this.renderer.render(this.scene, this.camera);
  }
}
