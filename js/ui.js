// Everything on the page that isn't the 3D canvas: cursor, text reveals, gallery,
// lightbox, cart, gift builder, trade calculator, forms, confetti and the story UI.
import { CONFIG, FORMS, MOTIFS, money } from './config.js';
import { sound } from './sound.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
const isDesktop = () => matchMedia('(min-width: 901px)').matches;
let lenis = null, atelier = null, stage = null;

/* ================================================================ toasts */
export function toast(msg, icon = '✦') {
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `<i>${icon}</i><span></span>`;
  el.querySelector('span').textContent = msg;
  $('.toasts').append(el);
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 500); }, 3200);
}

/* ================================================================ cursor */
function initCursor() {
  if (touch) return;
  document.body.classList.add('has-cursor');
  const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const p = { x: innerWidth / 2, y: innerHeight / 2 }, r = { ...p };
  addEventListener('pointermove', (e) => { p.x = e.clientX; p.y = e.clientY; dot.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`; }, { passive: true });
  gsap.ticker.add(() => { r.x += (p.x - r.x) * 0.18; r.y += (p.y - r.y) * 0.18; ring.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%,-50%)`; });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const hov = e.target.closest('a, button, input, select, textarea, label, .card, .pick, .giftbox__slot');
    cur.classList.toggle('is-label', !!lab);
    label.textContent = lab ? lab.dataset.cursor : '';
    cur.classList.toggle('is-hover', !lab && !!hov);
  });
  document.addEventListener('pointerleave', () => { ring.style.opacity = dot.style.opacity = 0; });
  document.addEventListener('pointerenter', () => { ring.style.opacity = dot.style.opacity = 1; });
}

function initMagnetic() {
  if (touch) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - b.left - b.width / 2) * 0.28, y: (e.clientY - b.top - b.height / 2) * 0.32, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }));
    el.addEventListener('pointerenter', () => sound.tick());
  });
}

/* ================================================================ split text */
function splitEl(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'split-word split-line';
          [...part].forEach((ch) => { const c = document.createElement('span'); c.className = 'split-char'; c.textContent = ch; w.append(c); });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return $$('.split-char', el);
}

function initSplits() {
  $$('[data-split]').forEach((el) => {
    const chars = splitEl(el);
    if (reduced) return;
    if (el.classList.contains('hero__title')) { gsap.set(chars, { yPercent: 115, rotate: 8 }); el._chars = chars; return; }
    gsap.set(chars, { yPercent: 115, rotate: 6 });
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1.2, stagger: 0.018, ease: 'expo.out' }),
    });
  });
  $$('[data-reveal]').forEach((el) => {
    if (reduced) { gsap.set(el, { opacity: 1, y: 0 }); return; }
    if (el.closest('.chapter--hero')) return;
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }) });
  });
  $$('.eyebrow .line').forEach((l) => {
    gsap.fromTo(l, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: l, start: 'top 92%', once: true } });
  });
}

export function intro() {
  const t = $('.hero__title');
  const tl = gsap.timeline();
  tl.from('.nav', { y: -40, opacity: 0, duration: 1, ease: 'expo.out' }, 0.2);
  if (t._chars) tl.to(t._chars, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.035, ease: 'expo.out' }, 0.25);
  tl.to('.chapter--hero [data-reveal]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.7);
  tl.from('#stage', { opacity: 0, duration: 1.6, ease: 'power2.out' }, 0);
}

/* ================================================================ preloader */
let loadShown = 0;
export function loader(p) {
  const fill = $('.preloader__fill'), cnt = $('.js-load-count');
  gsap.to({ v: loadShown }, {
    v: p * 100, duration: 0.6, ease: 'power2.out',
    onUpdate() { loadShown = this.targets()[0].v / 100; cnt.textContent = Math.round(loadShown * 100); fill.setAttribute('y', 140 - 130 * loadShown); },
  });
}
export function hideLoader() {
  return new Promise((res) => {
    loader(1);
    gsap.timeline({ delay: 0.55, onComplete: () => { $('.preloader').remove(); res(); } })
      .to('.preloader__inner', { y: -30, opacity: 0, duration: 0.6, ease: 'power3.in' })
      .to('.preloader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.2')
      .add(() => { document.body.classList.remove('is-loading'); lenis?.start(); }, '-=0.6');
  });
}

/* ================================================================ nav, menu, progress, anchors */
function initNav() {
  const nav = $('.nav'), bar = $('.progress span');
  let last = 0;
  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 40);
    const down = y > last && y > 400 && !document.body.classList.contains('menu-open');
    nav.classList.toggle('is-hidden', down);
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll)); else addEventListener('scroll', () => onScroll(scrollY));
  const btn = $('.menu-btn');
  btn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', open); $('.menu').setAttribute('aria-hidden', !open);
    open ? lenis?.stop() : lenis?.start();
    sound.whoosh();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2 && id !== '#top') return;
    e.preventDefault();
    if (document.body.classList.contains('menu-open')) { document.body.classList.remove('menu-open'); btn.setAttribute('aria-expanded', false); lenis?.start(); }
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    lenis ? lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) }) : (target === 0 ? scrollTo(0, 0) : target.scrollIntoView({ behavior: 'smooth' }));
  });
  ['collections', 'atelier', 'gift', 'trade', 'craft'].forEach((id) => {
    const link = $(`.nav__links a[href="#${id}"]`);
    ScrollTrigger.create({ trigger: '#' + id, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => link.classList.toggle('is-active', s.isActive) });
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeCart(); closeLightbox(); closeAR();
    if (document.body.classList.contains('menu-open')) btn.click();
  });
}

/* ================================================================ story (3D) hooks */
let chapters = [];
export function measureChapters() {
  chapters = $$('.chapter').map((el) => ({ el, top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
}
export function computeG() {
  const y = lenis ? lenis.scroll : scrollY;
  if (!chapters.length) return 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    if (y < c.top + c.h) return i + clamp((y - c.top) / c.h, 0, 1);
  }
  const lastC = chapters[chapters.length - 1];
  return chapters.length + (y - lastC.top - lastC.h) / innerHeight;
}

const fillBar = () => $('.js-fill-bar'), fillVal = () => $('.js-fill-val');
let lastStep = -1;
export const storyHooks = {
  onFill(f) {
    f = clamp(f, 0, 1);
    fillBar().style.transform = `scaleX(${f})`;
    fillVal().textContent = `${Math.round(f * 60)} ml`;
  },
  onZoom(z) { $('.js-zoom-val').textContent = `×${z.toFixed(1)}`; },
  onMotif(i) {
    const m = MOTIFS[i], ui = $('.motif-ui');
    $('.js-motif-name').textContent = m.name;
    $('.js-motif-family').textContent = m.family;
    $('.js-motif-idx').textContent = String(i + 1).padStart(2, '0');
    ui.classList.remove('is-swap'); void ui.offsetWidth; ui.classList.add('is-swap');
    $$('.motif-chips .chip').forEach((c, j) => c.classList.toggle('is-active', i === j));
    const chip = $(`.motif-chips .chip[data-motif="${i}"]`);
    chip?.parentElement.scrollTo({ left: chip.offsetLeft - chip.parentElement.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  },
  onHover(name) {
    $$('.trio-labels a').forEach((a) => a.classList.toggle('is-hover', a.dataset.form === name));
    $('#stage').style.cursor = name ? 'pointer' : '';
    if (!touch) {
      const cur = $('.cursor'); cur.classList.toggle('is-label', !!name);
      $('.cursor__label').textContent = name ? 'Design' : '';
    }
  },
  pickForm(form) { openInAtelier(form); },
  step(g) {
    const s = g < 1.4 ? 0 : g < 1.78 ? 1 : 2;
    if (s === lastStep) return;
    lastStep = s;
    $$('.pour-step').forEach((el, i) => { el.classList.toggle('is-active', i === s); el.classList.toggle('is-past', i < s); });
  },
};

function initStoryUI() {
  // cross-fade each chapter's text so pinned panels never overlap
  $$('.chapter').forEach((ch, i) => {
    const items = $$('.chapter__sticky > *', ch);
    if (i > 0) gsap.fromTo(items, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, ease: 'none', scrollTrigger: { trigger: ch, start: 'top 50%', end: 'top 0%', scrub: true } });
    gsap.to(items, { autoAlpha: 0, y: -50, ease: 'none', immediateRender: false, scrollTrigger: { trigger: ch, start: 'bottom 165%', end: 'bottom 108%', scrub: true } });
  });
  $$('.motif-chips .chip').forEach((chip) => chip.addEventListener('click', () => {
    const i = +chip.dataset.motif, c = chapters[3];
    if (!c) return;
    const y = c.top + (0.05 + ((i + 0.5) / 6) * 0.82) * c.h;
    lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: 'smooth' });
  }));
  $$('.trio-labels a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openInAtelier(a.dataset.form); }));
}

function openInAtelier(form, motif) {
  lenis ? lenis.scrollTo('#atelier', { duration: 1.8 }) : $('#atelier').scrollIntoView({ behavior: 'smooth' });
  if (!atelier) return;
  setTimeout(() => {
    if (form && atelier.state.form !== form) { atelier.build(form); segActive('.js-opt-form', form); }
    if (motif && atelier.state.motif !== motif) { atelier.setMotif(motif); segActive('.js-opt-motif', motif); }
  }, 900);
}

/* ================================================================ collections */
const COLLECTIONS = [
  { title: 'Regal Beasts', sub: 'Rocks glasses with tiger and lion medallions on walnut.', img: 'rocks-collection.webp', pos: '14% 0%', tag: 'Rocks', form: 'rocks', motif: 'tiger' },
  { title: 'The Bar Service', sub: 'A five-piece rocks set, built for the back bar.', img: 'rocks-collection.webp', pos: '86% 0%', tag: 'Set of 5', form: 'rocks', motif: 'lion', n: 5 },
  { title: 'The Pairing', sub: 'A rocks glass and a stein that share one lion.', img: 'pairing-collection.webp', pos: '86% 0%', tag: 'Rocks + Stein', form: 'mug', motif: 'lion' },
  { title: 'Banded Noir', sub: 'A dark filigree band with the tiger set in gold.', img: 'pairing-collection.webp', pos: '14% 100%', tag: 'Stein', form: 'mug', motif: 'tiger' },
  { title: 'Heritage Portraits', sub: 'Tumblers with painted royal portraits in gilt frames.', img: 'heritage-collection.webp', pos: '50% 100%', size: 'auto 175%', tag: 'Tumbler', form: 'tumbler', motif: 'queen' },
  { title: 'Botanica', sub: 'The tree of life and the peacock, enamelled in colour.', img: 'heritage-collection.webp', pos: '35% 0%', size: 'auto 175%', tag: 'Tumbler', form: 'tumbler', motif: 'peacock' },
];

function initCollections() {
  const track = $('.js-col-track');
  track.innerHTML = COLLECTIONS.map((c, i) => {
    const n = c.n || 4, price = CONFIG.price[c.form] * n;
    return `<article class="card" data-i="${i}">
      <div class="card__inner">
        <div class="card__img" data-cursor="Zoom" style="--img:url(../assets/img/${c.img});--pos:${c.pos};${c.size ? `--size:${c.size}` : ''}"></div>
        <div class="card__shade"></div><div class="card__glare"></div>
        <span class="card__num">0${i + 1}</span><span class="card__tag">${c.tag}</span>
        <div class="card__body">
          <h3>${c.title}</h3><p>${c.sub}</p>
          <div class="card__row">
            <span class="card__price">${money(price)}<small>set of ${n}</small></span>
            <div class="card__btns">
              <button type="button" class="btn btn--ghost js-card-custom"><span>Customise</span></button>
              <button type="button" class="btn btn--gold js-card-add"><span>Add</span></button>
            </div>
          </div>
        </div>
      </div>
    </article>`;
  }).join('') + `<a class="card card--end" href="#atelier" data-cursor="Design"><div><p class="eyebrow" style="justify-content:center">Or start from scratch</p><h3 class="display" style="font-size:clamp(34px,3.4vw,52px)">Make one <em>yours.</em></h3><p style="color:var(--muted);margin-top:14px">Open the Atelier →</p></div></a>`;

  $$('.card', track).forEach((card) => {
    const inner = $('.card__inner', card);
    const c = COLLECTIONS[+card.dataset.i];
    if (!c) return;
    if (!touch) {
      card.addEventListener('pointermove', (e) => {
        const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        inner.style.transform = `rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg)`;
        inner.style.setProperty('--gx', `${x * 100}%`); inner.style.setProperty('--gy', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    }
    $('.card__img', card).addEventListener('click', () => openLightbox(`assets/img/${c.img}`, c.title, c.sub));
    $('.js-card-add', card).addEventListener('click', (e) => {
      const n = c.n || 4;
      addToCart({ id: `col-${card.dataset.i}`, title: c.title, desc: `${FORMS[c.form].name} · set of ${n}`, price: CONFIG.price[c.form] * n, thumb: `assets/tex/medallion-${c.motif}.png` }, e.currentTarget);
    });
    $('.js-card-custom', card).addEventListener('click', () => openInAtelier(c.form, c.motif));
  });

  const idx = $('.js-col-idx');
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.collections__pin', pin: true, scrub: 1, start: 'top top', end: () => '+=' + dist(), invalidateOnRefresh: true,
        onUpdate: (s) => { idx.textContent = String(Math.min(6, Math.floor(s.progress * 6) + 1)).padStart(2, '0'); },
      },
    });
    $$('.card__img', track).forEach((img) => {
      gsap.fromTo(img, { backgroundPositionX: undefined, xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    return () => gsap.set(track, { x: 0 });
  });
  mm.add('(max-width: 900px)', () => {
    const onS = () => { idx.textContent = String(clamp(Math.round(track.scrollLeft / (track.scrollWidth - track.clientWidth || 1) * 5) + 1, 1, 6)).padStart(2, '0'); };
    track.addEventListener('scroll', onS, { passive: true });
    return () => track.removeEventListener('scroll', onS);
  });
}

/* ================================================================ lightbox (scroll / pinch to zoom) */
const lb = { s: 1, x: 0, y: 0, ptrs: new Map(), dist: 0 };
function openLightbox(src, title, sub) {
  const img = $('.js-lb-img');
  img.src = src; img.alt = title;
  $('.js-lb-title').textContent = title; $('.js-lb-sub').textContent = sub;
  Object.assign(lb, { s: 1, x: 0, y: 0 });
  img.onload = () => { centerLB(); applyLB(); };
  document.body.classList.add('lb-open'); $('.lightbox').setAttribute('aria-hidden', false);
  lenis?.stop(); sound.whoosh();
}
function closeLightbox() { if (!document.body.classList.contains('lb-open')) return; document.body.classList.remove('lb-open'); $('.lightbox').setAttribute('aria-hidden', true); lenis?.start(); }
function centerLB() { const img = $('.js-lb-img'), st = $('.js-lb-stage'); lb.x = (st.clientWidth - img.offsetWidth) / 2; lb.y = (st.clientHeight - img.offsetHeight) / 2; }
function applyLB(anim) {
  const img = $('.js-lb-img');
  img.style.transition = anim ? 'transform .5s cubic-bezier(.22,1,.36,1)' : 'none';
  img.style.position = 'absolute'; img.style.left = '0'; img.style.top = '0';
  img.style.transform = `translate(${lb.x}px, ${lb.y}px) scale(${lb.s})`;
  $('.js-lb-pct').textContent = `${Math.round(lb.s * 100)}%`;
}
function zoomAt(cx, cy, ns, anim) {
  ns = clamp(ns, 1, 6);
  const k = ns / lb.s;
  lb.x = cx - (cx - lb.x) * k; lb.y = cy - (cy - lb.y) * k; lb.s = ns;
  if (ns === 1) centerLB();
  applyLB(anim);
}
function initLightbox() {
  const st = $('.js-lb-stage');
  st.addEventListener('wheel', (e) => { e.preventDefault(); const b = st.getBoundingClientRect(); zoomAt(e.clientX - b.left, e.clientY - b.top, lb.s * Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
  st.addEventListener('pointerdown', (e) => { st.setPointerCapture(e.pointerId); lb.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  st.addEventListener('pointermove', (e) => {
    if (!lb.ptrs.has(e.pointerId)) return;
    const prev = lb.ptrs.get(e.pointerId); lb.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lb.ptrs.size === 2) {
      const [a, b] = [...lb.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lb.dist) { const r = st.getBoundingClientRect(); zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, lb.s * d / lb.dist); }
      lb.dist = d;
    } else if (lb.s > 1) { lb.x += e.clientX - prev.x; lb.y += e.clientY - prev.y; applyLB(); }
  });
  const up = (e) => { lb.ptrs.delete(e.pointerId); if (lb.ptrs.size < 2) lb.dist = 0; };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('dblclick', (e) => { const b = st.getBoundingClientRect(); zoomAt(e.clientX - b.left, e.clientY - b.top, lb.s > 1.2 ? 1 : 2.6, true); });
  $('.js-lb-in').addEventListener('click', () => zoomAt(st.clientWidth / 2, st.clientHeight / 2, lb.s * 1.5, true));
  $('.js-lb-out').addEventListener('click', () => zoomAt(st.clientWidth / 2, st.clientHeight / 2, lb.s / 1.5, true));
  $('.js-lb-close').addEventListener('click', closeLightbox);
  addEventListener('resize', () => { if (document.body.classList.contains('lb-open') && lb.s === 1) { centerLB(); applyLB(); } });
}

/* ================================================================ cart */
const CART_KEY = 'aureum-bag-v1';
let cart = [];
function loadCart() { try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; } }
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ } }
export function addToCart(item, fromEl) {
  const ex = cart.find((c) => c.id === item.id);
  ex ? ex.qty++ : cart.push({ ...item, qty: 1 });
  saveCart(); renderCart();
  if (fromEl && item.thumb) flyToCart(fromEl, item.thumb);
  else bumpCart();
  sound.clink(0.6, 1.2);
  toast(`${item.title} added to your bag`, '✓');
}
function bumpCart() { const b = $('.cart-btn'); b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
function flyToCart(fromEl, src) {
  const a = fromEl.getBoundingClientRect(), b = $('.cart-btn').getBoundingClientRect();
  const img = document.createElement('img'); img.src = src; img.className = 'fly';
  const size = Math.min(110, a.width, a.height) || 80;
  Object.assign(img.style, { width: size + 'px', height: size + 'px', left: a.left + a.width / 2 - size / 2 + 'px', top: a.top + a.height / 2 - size / 2 + 'px', objectFit: 'cover' });
  document.body.append(img);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  gsap.timeline({ onComplete: () => { img.remove(); bumpCart(); } })
    .to(img, { x: dx, duration: 0.9, ease: 'power2.inOut' }, 0)
    .to(img, { y: dy, duration: 0.9, ease: 'back.in(1.6)' }, 0)
    .to(img, { scale: 0.18, rotate: 300, duration: 0.9, ease: 'power2.in' }, 0);
}
function renderCart() {
  const list = $('.js-cart-items');
  const count = cart.reduce((s, c) => s + c.qty, 0), sub = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const badge = $('.js-cart-count'); badge.textContent = count; badge.classList.toggle('has-items', count > 0);
  $('.js-cart-sub').textContent = money(sub);
  $('.js-checkout').disabled = !count;
  if (!count) { list.innerHTML = `<div class="cart__empty"><b>Your bag is empty</b>Pour something in from the collections or the Atelier.</div>`; return; }
  list.innerHTML = cart.map((c, i) => `<div class="citem">
      <div class="citem__img" style="background-image:url('${c.thumb || ''}')"></div>
      <div><b></b><small></small><div class="citem__qty"><button type="button" data-a="dec" data-i="${i}" aria-label="Fewer">−</button><span>${c.qty}</span><button type="button" data-a="inc" data-i="${i}" aria-label="More">+</button></div></div>
      <div><div class="citem__price">${money(c.price * c.qty)}</div><button type="button" class="citem__rm" data-a="rm" data-i="${i}">Remove</button></div>
    </div>`).join('');
  $$('.citem', list).forEach((row, i) => { $('b', row).textContent = cart[i].title; $('small', row).textContent = cart[i].desc; });
}
function openCart() { document.body.classList.add('cart-open'); $('.cart').setAttribute('aria-hidden', false); lenis?.stop(); sound.whoosh(); }
function closeCart() { if (!document.body.classList.contains('cart-open')) return; document.body.classList.remove('cart-open'); $('.cart').setAttribute('aria-hidden', true); lenis?.start(); }
function initCart() {
  loadCart(); renderCart();
  $('.cart-btn').addEventListener('click', openCart);
  $$('.js-cart-close').forEach((b) => b.addEventListener('click', closeCart));
  $('.js-cart-items').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === 'inc') cart[i].qty++;
    if (b.dataset.a === 'dec') cart[i].qty = Math.max(1, cart[i].qty - 1);
    if (b.dataset.a === 'rm') cart.splice(i, 1);
    sound.tick(); saveCart(); renderCart();
  });
  $('.js-checkout').addEventListener('click', () => {
    const lines = cart.map((c) => `• ${c.qty} × ${c.title} (${c.desc}) — ${money(c.price * c.qty)}`).join('\n');
    const total = money(cart.reduce((s, c) => s + c.qty * c.price, 0));
    mail(`Order request — ${CONFIG.brand}`, `Hello ${CONFIG.brand},\n\nI'd like to order:\n${lines}\n\nSubtotal: ${total}\n\nName:\nDelivery address:\nPhone:\n`);
    toast('Opening your email app with your order…', '✉');
  });
}
function mail(subject, body) { location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }

/* ================================================================ atelier UI */
function segActive(sel, v) { $$(`${sel} button`).forEach((b) => b.classList.toggle('is-active', b.dataset.v === v)); }
let qty = 4;
function atelierPrice(s) {
  let unit = CONFIG.price[s.form];
  if (s.motif === 'monogram') unit += CONFIG.monogram;
  if (s.motif === 'logo') unit += 650;
  return unit * qty;
}
let shownPrice = 0;
export function atelierChanged(s) {
  $('.js-at-form').textContent = FORMS[s.form].name;
  const m = MOTIFS.find((x) => x.key === s.motif);
  $('.js-at-motif').textContent = m ? m.short : s.motif === 'monogram' ? `“${(s.mono || '').toUpperCase()}”` : 'Your logo';
  const p = atelierPrice(s);
  gsap.to({ v: shownPrice }, { v: p, duration: 0.6, ease: 'power2.out', onUpdate() { shownPrice = this.targets()[0].v; $('.js-price').textContent = money(shownPrice); } });
  $('.js-engrave').hidden = s.motif !== 'monogram';
  $('.js-logo').hidden = s.motif !== 'logo';
}
export function bindAtelier(a) {
  atelier = a;
  const on = (sel, fn) => $$(`${sel} button`).forEach((b) => b.addEventListener('click', () => { segActive(sel, b.dataset.v); sound.tick(); fn(b.dataset.v); }));
  on('.js-opt-form', (v) => a.build(v));
  on('.js-opt-motif', (v) => a.setMotif(v, v === 'monogram' ? $('.js-mono-input').value : undefined));
  on('.js-opt-rim', (v) => a.setRim(v));
  on('.js-opt-fill', (v) => a.setFill(v));
  on('.js-opt-light', (v) => a.setLight(v));
  on('.js-opt-qty', (v) => { qty = +v; atelierChanged(a.state); });
  let t;
  $('.js-mono-input').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { a.updateMonogram(e.target.value); sound.tick(); }, 120); });
  $('.js-logo-input').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { a.setMotif('logo', img); toast('Your logo is now struck in gold', '✦'); };
    img.onerror = () => toast('That file could not be read. Try a PNG or SVG.', '!');
    img.src = URL.createObjectURL(f);
  });
  $('.js-toast').addEventListener('click', () => a.toast());
  $('.js-reset').addEventListener('click', () => a.resetView());
  $('.js-snap').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = a.snapshot(); link.download = `aureum-${a.state.form}-${a.state.motif}.png`; link.click();
    sound.clink(0.4, 1.4); toast('Image saved', '✓');
    const v = $('.atelier__view'); gsap.fromTo(v, { boxShadow: '0 0 0 0 rgba(243,215,154,.9)' }, { boxShadow: '0 0 0 40px rgba(243,215,154,0)', duration: 0.8 });
  });
  $('.js-ar').addEventListener('click', openAR);
  $('.js-add-custom').addEventListener('click', (e) => {
    const s = a.state, m = MOTIFS.find((x) => x.key === s.motif);
    const name = m ? m.short : s.motif === 'monogram' ? `Initials “${(s.mono || '').toUpperCase()}”` : 'Your logo';
    const thumb = a.snapshot(200);
    addToCart({ id: `custom-${s.form}-${s.motif}-${s.mono}-${s.rim}-${s.fill}-${qty}`, title: `${FORMS[s.form].name} · ${name}`, desc: `${s.rim === 'none' ? 'No' : s.rim[0].toUpperCase() + s.rim.slice(1)} rim · set of ${qty}`, price: atelierPrice(s), thumb }, $('.atelier__view'));
    void e;
  });
  $('.js-bulk-link').addEventListener('click', () => { setCalc(a.state.form, 240); });
  $('.js-at-loading').classList.add('is-done');
  atelierChanged(a.state);
}

/* ================================================================ AR */
let mvLoaded = false;
function openAR() {
  document.body.classList.add('ar-open'); $('.ar-modal').setAttribute('aria-hidden', false); lenis?.stop();
  if (!mvLoaded) {
    mvLoaded = true;
    const s = document.createElement('script'); s.type = 'module';
    s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
    document.head.append(s);
    $('.js-ar-view').innerHTML = `<model-viewer src="assets/models/rocks-ar.glb" alt="The Rocks glass with tiger medallion" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls auto-rotate shadow-intensity="1" exposure="1.1" tone-mapping="aces" camera-orbit="20deg 75deg auto" interaction-prompt="none"><button slot="ar-button" class="btn btn--gold ar-btn"><span>View in your space</span></button></model-viewer>`;
  }
}
function closeAR() { if (!document.body.classList.contains('ar-open')) return; document.body.classList.remove('ar-open'); $('.ar-modal').setAttribute('aria-hidden', true); lenis?.start(); }

/* ================================================================ gift builder */
const PICKS = [
  { form: 'rocks', motif: 'tiger' }, { form: 'rocks', motif: 'lion' }, { form: 'mug', motif: 'lion' },
  { form: 'tumbler', motif: 'tree' }, { form: 'tumbler', motif: 'peacock' }, { form: 'tumbler', motif: 'queen' },
];
const box = [];
function initGift() {
  const wrap = $('.js-gift-picks');
  wrap.innerHTML = PICKS.map((p, i) => {
    const m = MOTIFS.find((x) => x.key === p.motif);
    return `<button type="button" class="pick" data-i="${i}" data-cursor="Add"><div class="pick__img"><img src="assets/tex/medallion-${p.motif}.png" alt=""></div><div class="pick__body"><b>${FORMS[p.form].short} · ${m.short}</b><small>${money(CONFIG.price[p.form])}</small></div><span class="pick__add">+</span></button>`;
  }).join('');
  $$('.pick', wrap).forEach((b) => b.addEventListener('click', () => {
    if (box.length >= 4) { toast('The box holds four. Tap a glass in the box to swap it out.', '!'); shake(); return; }
    const p = PICKS[+b.dataset.i];
    box.push(p);
    const slot = $(`.giftbox__slot[data-slot="${box.length - 1}"]`);
    flyTo($('img', b), slot, `assets/tex/medallion-${p.motif}.png`, () => renderBox());
    sound.tick();
  }));
  $$('.giftbox__slot').forEach((s) => s.addEventListener('click', () => {
    const i = +s.dataset.slot; if (!box[i]) return;
    box.splice(i, 1); renderBox(); sound.tick();
  }));
  $('.js-gift-clear').addEventListener('click', () => { box.length = 0; renderBox(); sound.whoosh(); });
  $('.js-giftbox').addEventListener('click', (e) => { if (e.target.closest('.giftbox__lid')) { $('.js-giftbox').classList.remove('is-closed'); } });
  $('.js-gift-add').addEventListener('click', (e) => {
    const total = giftTotal();
    addToCart({ id: 'gift-' + box.map((p) => p.form[0] + p.motif).join('-'), title: 'Gift box of four', desc: box.map((p) => `${FORMS[p.form].short} ${MOTIFS.find((m) => m.key === p.motif).short}`).join(', '), price: total, thumb: 'assets/img/rocks-collection.webp' }, e.currentTarget);
  });
  renderBox();
}
function giftTotal() { const s = box.reduce((a, p) => a + CONFIG.price[p.form], 0); return box.length === 4 ? s * (1 - CONFIG.giftDiscount) : s; }
function shake() { gsap.fromTo('.js-giftbox', { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' }); }
function renderBox() {
  $$('.giftbox__slot').forEach((s, i) => {
    const p = box[i];
    s.innerHTML = p ? `<img src="assets/tex/medallion-${p.motif}.png" alt=""><small>${FORMS[p.form].short}</small>` : '';
  });
  $('.js-gift-count').textContent = `${box.length} / 4`;
  $('.js-gift-total').textContent = money(giftTotal()) + (box.length === 4 ? ' · −10%' : '');
  $('.js-gift-add').disabled = box.length !== 4;
  const gb = $('.js-giftbox');
  if (box.length === 4 && !gb.classList.contains('is-closed')) {
    setTimeout(() => { gb.classList.add('is-closed'); sound.clink(0.7, 0.9); toast('Boxed and ribboned. Tap the lid to peek inside.', '🎁'); }, 650);
  } else if (box.length < 4) gb.classList.remove('is-closed');
}
function flyTo(fromEl, toEl, src, done) {
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const img = document.createElement('img'); img.src = src; img.className = 'fly';
  Object.assign(img.style, { width: a.width + 'px', height: a.height + 'px', left: a.left + 'px', top: a.top + 'px' });
  document.body.append(img);
  const sc = (b.width * 0.78) / a.width;
  gsap.timeline({ onComplete: () => { img.remove(); done(); gsap.fromTo(toEl, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }); } })
    .to(img, { x: b.left + b.width / 2 - (a.left + a.width / 2), duration: 0.75, ease: 'power2.inOut' }, 0)
    .to(img, { y: b.top + b.height / 2 - (a.top + a.height / 2), duration: 0.75, ease: 'back.in(1.4)' }, 0)
    .to(img, { scale: sc, rotate: 360, duration: 0.75, ease: 'power2.inOut' }, 0);
}

/* ================================================================ trade calculator */
let calcForm = 'rocks', calcQty = 240;
const shown = { unit: 0, total: 0, save: 0, qty: 0 };
function qtyFromSlider(v) {
  let q = 24 * Math.pow(5000 / 24, v / 1000);
  q = q < 100 ? Math.round(q) : q < 1000 ? Math.round(q / 10) * 10 : Math.round(q / 50) * 50;
  return clamp(q, 24, 5000);
}
function sliderFromQty(q) { return Math.round(1000 * Math.log(q / 24) / Math.log(5000 / 24)); }
function setCalc(form, q) {
  calcForm = form; segActive('.js-calc-form', form);
  const r = $('.js-calc-range'); r.value = sliderFromQty(q); updateCalc();
}
function updateCalc() {
  const r = $('.js-calc-range');
  calcQty = qtyFromSlider(+r.value);
  r.style.setProperty('--p', `${r.value / 10}%`);
  let ti = 0; CONFIG.tiers.forEach((t, i) => { if (calcQty >= t.min) ti = i; });
  const tier = CONFIG.tiers[ti], unit = CONFIG.price[calcForm] * (1 - tier.off);
  $$('.tiers span').forEach((s, i) => s.classList.toggle('is-on', i <= ti));
  $('.js-calc-lead').textContent = tier.lead;
  const perk = $('.js-calc-perk');
  perk.textContent = calcQty >= 500 ? '✦ Custom logo medallion included at this quantity.' : `Custom logo medallion included from 500 pieces. ${500 - calcQty} to go.`;
  perk.classList.toggle('is-on', calcQty >= 500);
  gsap.to(shown, {
    unit, total: unit * calcQty, save: tier.off * 100, qty: calcQty, duration: 0.45, ease: 'power2.out', overwrite: true,
    onUpdate: () => {
      $('.js-calc-unit').textContent = money(shown.unit);
      $('.js-calc-total').textContent = money(shown.total);
      $('.js-calc-save').textContent = `${Math.round(shown.save)}%`;
      $('.js-calc-qty').textContent = Math.round(shown.qty).toLocaleString(CONFIG.locale);
    },
  });
}
function initTrade() {
  const r = $('.js-calc-range');
  let lastTick = 0;
  r.addEventListener('input', () => { updateCalc(); const now = performance.now(); if (now - lastTick > 60) { sound.tick(); lastTick = now; } });
  $$('.js-calc-form button').forEach((b) => b.addEventListener('click', () => { calcForm = b.dataset.v; segActive('.js-calc-form', calcForm); sound.tick(); updateCalc(); }));
  r.value = sliderFromQty(240); updateCalc();

  const form = $('.js-rfq');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('input[required]', form).forEach((inp) => {
      const bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value));
      inp.closest('.field').classList.toggle('is-error', bad); if (bad) ok = false;
    });
    if (!ok) { toast('Please fill in your name, company and a valid email.', '!'); gsap.fromTo(form, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' }); return; }
    const d = Object.fromEntries(new FormData(form));
    mail(`Trade enquiry — ${d.company}`, `Name: ${d.name}\nCompany: ${d.company}\nEmail: ${d.email}\nBusiness: ${d.type}\n\nEstimate from the website: ${calcQty.toLocaleString(CONFIG.locale)} × ${FORMS[calcForm].name} at ${money(shown.unit)} each (${money(calcQty * shown.unit)}).\n\n${d.message || ''}`);
    toast('Opening your email app with your request…', '✉');
  });
}

function initNewsletter() {
  $('.js-newsletter').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#nl-email').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) { toast('That email doesn’t look right.', '!'); return; }
    mail(`Join the list — ${CONFIG.brand}`, `Please add ${v} to the ${CONFIG.brand} list.`);
    toast('Opening your email app to confirm…', '✉');
  });
  $('.js-contact-link').href = `mailto:${CONFIG.email}`;
  $('.js-contact-link').textContent = CONFIG.email;
}

/* ================================================================ craft, stats, finale, footer, paths */
function initScrollFX() {
  const path = $('.craft__path path');
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.craft__wrap', start: 'top 70%', end: 'bottom 60%', scrub: 1 } });
  $$('.step').forEach((s, i) => {
    gsap.from(s, { x: isDesktop() ? (i % 2 ? 80 : -80) : 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 80%', once: true } });
    gsap.from($('.step__n', s), { rotate: -25, scale: 0.6, duration: 1.4, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: s, start: 'top 80%', once: true } });
  });
  $$('[data-count]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to({ v: 0 }, { v: +el.dataset.count, duration: 1.6, ease: 'power3.out', onUpdate() { el.textContent = Math.round(this.targets()[0].v); } }) });
  });
  gsap.timeline({ scrollTrigger: { trigger: '.finale__media', start: 'top 85%', end: 'center 50%', scrub: 1 } })
    .to('.finale__media', { clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none' }, 0)
    .to('.js-finale-img', { scale: 1, ease: 'none' }, 0);
  gsap.from('.footer__big span', { yPercent: 100, opacity: 0, stagger: 0.07, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 85%', once: true } });
  $$('.path__img').forEach((img) => gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, scrub: true } }));
  gsap.from('.perk', { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.perks', start: 'top 85%', once: true } });
  gsap.from('.pick', { y: 40, opacity: 0, stagger: 0.06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.gift__picks', start: 'top 85%', once: true } });
  gsap.from('.opt', { x: 40, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.atelier__panel', start: 'top 85%', once: true } });
  // marquee speeds up with scroll velocity
  const mq = $('.marquee__track');
  if (lenis) lenis.on('scroll', ({ velocity }) => { mq.style.animationDuration = `${clamp(32 - Math.abs(velocity) * 1.4, 8, 32)}s`; });
}

/* ================================================================ confetti (gold flakes) */
function confetti(x0, y0) {
  const c = $('.confetti'), ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#f3d79a', '#d4a24c', '#fff1c9', '#a87a2e', '#e6c27a'];
  const P = Array.from({ length: touch ? 120 : 220 }, () => ({
    x: x0, y: y0, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    w: 5 + Math.random() * 9, h: 3 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], life: 1,
  }));
  let raf;
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    P.forEach((p) => {
      p.vy += 0.42; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.006;
      if (p.life <= 0 || p.y > innerHeight + 40) return;
      alive++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.sin(p.r * 3));
      ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  cancelAnimationFrame(raf); step();
}
function initFinale() {
  $('.js-cheers').addEventListener('click', (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    confetti(b.left + b.width / 2, b.top + b.height / 2);
    sound.clink(1); setTimeout(() => sound.clink(0.8, 1.06), 140);
    if (!sound.on) toast('Cheers! Turn on sound (top right) to hear the clink.', '🥂');
  });
  $('.finale__media').addEventListener('click', () => openLightbox('assets/img/hero-render.jpg', 'The Rocks · Tiger', 'Modelled and path-traced in Blender'));
}

/* ================================================================ sound button */
function initSound() {
  const b = $('.sound-btn');
  b.addEventListener('click', async () => {
    const on = await sound.toggle();
    b.setAttribute('aria-pressed', on);
    toast(on ? 'Sound on: pours, ice and clinks' : 'Sound off', on ? '♪' : '✕');
  });
  document.addEventListener('pointerenter', (e) => { if (e.target.closest?.('.seg button, .swatches button, .chip')) sound.tick(); }, true);
}

/* ================================================================ init */
export function init(l) {
  lenis = l;
  initCursor(); initMagnetic(); initSplits(); initNav(); initStoryUI();
  initCollections(); initLightbox(); initCart(); initGift(); initTrade(); initNewsletter();
  initScrollFX(); initFinale(); initSound();
  $('.js-ar-close').addEventListener('click', closeAR);
  $('.ar-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeAR(); });
}
export function setStage(s) { stage = s; void stage; }
