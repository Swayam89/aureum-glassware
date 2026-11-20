import { loadAssets } from './glassware.js';
import * as UI from './ui.js';

gsap.registerPlugin(ScrollTrigger);
history.scrollRestoration = 'manual';
scrollTo(0, 0);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = window.Lenis && !reduced ? new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 }) : null;
if (lenis) {
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
if (reduced) document.documentElement.classList.add('reduced');

UI.init(lenis);

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  const start = performance.now();
  let stage = null, atelier = null;
  if (webglOK()) {
    try {
      const assets = await loadAssets(UI.loader);
      await document.fonts.ready;
      const [{ Stage }, { Atelier }] = await Promise.all([import('./stage.js'), import('./atelier.js')]);
      stage = new Stage(document.getElementById('stage'), assets, UI.storyHooks);
      atelier = new Atelier(document.getElementById('atelier-canvas'), assets, { onChange: UI.atelierChanged });
      UI.bindAtelier(atelier); UI.setStage(stage);
      window.__aureum = { stage, atelier, lenis };
    } catch (err) {
      console.error('3D failed to start', err);
      document.body.classList.add('no-webgl');
    }
  } else document.body.classList.add('no-webgl');

  const wait = Math.max(0, 1700 - (performance.now() - start));
  await new Promise((r) => setTimeout(r, wait));
  UI.measureChapters();
  ScrollTrigger.refresh();
  addEventListener('resize', () => { clearTimeout(boot._t); boot._t = setTimeout(() => { UI.measureChapters(); ScrollTrigger.refresh(); }, 200); });
  ScrollTrigger.addEventListener('refresh', UI.measureChapters);

  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
    last = now;
    if (document.hidden) return;
    const g = UI.computeG();
    UI.storyHooks.step(g);
    if (stage) { stage.setG(g); stage.tick(dt, t); }
    if (atelier) atelier.tick(dt, t);
  });

  await UI.hideLoader();
  UI.intro();
}
boot();
