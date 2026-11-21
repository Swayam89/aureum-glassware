// GLASSIT landing page: ticker, nav, sale pricing, 3D carousel, shop grid, bag, search.
import { PRODUCTS } from './catalog-data.js';

const STORE = {
  email: 'orders@glassit.example', // placeholder: set the real order/trade email
  instagram: '',                    // placeholder: Instagram profile URL
  discount: 0.30,                   // launch offer shown on every product
};
const CATS = [
  { key: 'all', name: 'All' },
  { key: 'wine', name: 'Wine & Cocktail' },
  { key: 'tumblers', name: 'Tumblers' },
  { key: 'gold', name: 'Gold Detail' },
  { key: 'beer', name: 'Beer & Whisky Sets' },
  { key: 'cups', name: 'Cups & Saucers' },
  { key: 'dispensers', name: 'Water Dispensers' },
];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
// Catalogue price is the sale price. The struck-through price is set so the saving is a true 30%.
export const mrp = (p) => Math.ceil(p.price / (1 - STORE.discount) / 5) * 5;
const priceHTML = (p) => `<s>${fmt(mrp(p))}</s><b>${fmt(p.price)}</b><i>-30%</i>`;
const desc = (p) => [p.code, p.meta].filter(Boolean).join(' · ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = window.Lenis && !reduced ? new window.Lenis({ lerp: 0.1, smoothWheel: true }) : null;
if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
const scrollToEl = (target, offset = 0) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.3 });
  else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
};

/* ---------------- toast ---------------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('.toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------------- 1 · ticker ---------------- */
const MESSAGES = [
  '<b>Launch sale: 30% off</b> every piece, already applied',
  'Luxury glassware for home &amp; hospitality',
  'Best-quality pieces for <b>B2B &amp; B2C</b>',
  'Bulk and trade orders welcome',
  '91 designs across 6 collections',
  'Gold-detail whisky &amp; highball sets',
];
const tk = $('.js-ticker');
tk.innerHTML = [...MESSAGES, ...MESSAGES].map((m) => `<span>${m}</span>`).join('');

/* ---------------- 2 · nav ---------------- */
const nav = $('.nav');
new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting), { threshold: 0 }).observe($('.ticker'));
$('.js-burger').addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  $('.js-burger').setAttribute('aria-expanded', open);
  open ? lenis?.stop() : lenis?.start();
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (a.getAttribute('aria-disabled') === 'true' || href === '#') { e.preventDefault(); if (a.matches('.js-insta-link') || a.closest('.footer__col')) toast('Coming soon'); return; }
  e.preventDefault();
  if (document.body.classList.contains('menu-open')) { document.body.classList.remove('menu-open'); lenis?.start(); }
  if (a.dataset.cat) setFilter(a.dataset.cat, false);
  const target = href === '#top' ? 0 : $(href);
  if (target !== null) scrollToEl(target, href === '#top' ? 0 : -nav.offsetHeight + 2);
});

/* ---------------- 3 · hero ---------------- */
const cover = byId['two-tone-round-wine-glass'];
$('.js-hero-price').innerHTML = priceHTML(cover);
$('.js-hero-shop').addEventListener('click', () => setTimeout(() => { setFilter('wine', false); highlight(cover.id); }, 50));

/* ---------------- 5 · shop grid ---------------- */
let filter = 'all', shown = 8;
const grid = $('.js-grid');
const list = () => (filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === filter));
$('.js-chips').innerHTML = CATS.map((c) => {
  const n = c.key === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.key).length;
  return `<button type="button" data-cat="${c.key}" class="${c.key === 'all' ? 'on' : ''}">${c.name}<small>${n}</small></button>`;
}).join('');
$$('.js-chips button').forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.cat, true)));
function setFilter(cat, animate) {
  filter = cat; shown = 8;
  $$('.js-chips button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  renderGrid(animate);
}
function cardHTML(p, i) {
  return `<article class="card enter" style="animation-delay:${(i % 8) * 50}ms" data-id="${p.id}">
    <div class="card__img"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy" width="808" height="900"><span class="card__badge">-30%</span></div>
    <div class="card__body"><h3>${esc(p.name)}</h3><small>${esc(desc(p))}</small><span class="price">${priceHTML(p)}</span>
      <div class="card__btns"><button class="btn btn--line" type="button" data-cart="${p.id}">Add to cart</button><button class="btn btn--dark" type="button" data-buy="${p.id}">Shop now</button></div></div>
  </article>`;
}
function renderGrid() {
  const L = list();
  grid.innerHTML = L.slice(0, shown).map(cardHTML).join('');
  $('.js-more').hidden = shown >= L.length;
  $('.js-count').textContent = `Showing ${Math.min(shown, L.length)} of ${L.length} designs`;
}
$('.js-more').addEventListener('click', () => {
  const L = list(), from = shown; shown += 8;
  grid.insertAdjacentHTML('beforeend', L.slice(from, shown).map(cardHTML).join(''));
  $('.js-more').hidden = shown >= L.length;
  $('.js-count').textContent = `Showing ${Math.min(shown, L.length)} of ${L.length} designs`;
  ScrollTrigger.refresh();
});
grid.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cart]'), b = e.target.closest('[data-buy]');
  if (c) addToBag(c.dataset.cart, c.closest('.card').querySelector('img'));
  if (b) shopNow(b.dataset.buy);
});
function highlight(id) {
  const p = byId[id]; if (!p) return;
  if (filter !== 'all' && filter !== p.cat) setFilter(p.cat, false);
  const L = list(), idx = L.findIndex((x) => x.id === id);
  if (idx >= shown) { shown = Math.ceil((idx + 1) / 8) * 8; renderGrid(); }
  const card = grid.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  scrollToEl(card, -nav.offsetHeight - 30);
  gsap.fromTo(card, { boxShadow: '0 0 0 0 rgba(155,59,37,.0)' }, { boxShadow: '0 0 0 6px rgba(155,59,37,.35)', duration: 0.5, delay: 1, yoyo: true, repeat: 3 });
}
renderGrid();

/* ---------------- 6 · collection tiles ---------------- */
const TILE_IMG = { wine: 'diamond-cut-coupe-set', tumblers: 'tall-pink-tumbler-set', gold: 'cut-base-tiger-whisky-glass-set', beer: 'gold-banded-whisky-and-beer-set', cups: 'fine-diamond-cup-and-saucer-set', dispensers: 'amber-ribbed-cylinder-dispenser' };
$('.js-tiles').innerHTML = CATS.slice(1).map((c) => {
  const n = PRODUCTS.filter((p) => p.cat === c.key).length, img = byId[TILE_IMG[c.key]]?.image || PRODUCTS.find((p) => p.cat === c.key).image;
  return `<a class="tile rv" href="#shop" data-cat="${c.key}"><img src="${img}" alt="" loading="lazy"><div><small>${n} designs</small><h3>${c.name}</h3></div></a>`;
}).join('');

/* ---------------- bag ---------------- */
const BAG_KEY = 'glassit-bag-v1';
let bag = [];
try { bag = (JSON.parse(localStorage.getItem(BAG_KEY)) || []).filter((l) => byId[l.id]); } catch { bag = []; }
const saveBag = () => { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* storage blocked */ } };
function addToBag(id, fromImg) {
  const l = bag.find((x) => x.id === id);
  l ? l.qty++ : bag.push({ id, qty: 1 });
  saveBag(); renderBag();
  if (fromImg) fly(fromImg);
  toast(`${byId[id].name} added to your cart`);
}
// "Shop now": straight to checkout with only this product (like "Buy now")
function shopNow(id) {
  location.href = 'checkout.html?buy=' + encodeURIComponent(id); // checks out just this piece; the cart is left alone
}
function fly(img) {
  const a = img.getBoundingClientRect(), b = $('.js-bag-open').getBoundingClientRect();
  const f = img.cloneNode(); f.className = 'fly';
  Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.append(f);
  gsap.timeline({ onComplete: () => { f.remove(); const btn = $('.js-bag-open'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); } })
    .to(f, { x: b.left + b.width / 2 - a.left - a.width / 2, duration: 0.8, ease: 'power2.inOut' }, 0)
    .to(f, { y: b.top + b.height / 2 - a.top - a.height / 2, duration: 0.8, ease: 'back.in(1.3)' }, 0)
    .to(f, { scale: 0.08, opacity: 0.6, duration: 0.8, ease: 'power2.in' }, 0);
}
function renderBag() {
  const n = bag.reduce((s, l) => s + l.qty, 0);
  const sub = bag.reduce((s, l) => s + l.qty * byId[l.id].price, 0);
  const save = bag.reduce((s, l) => s + l.qty * (mrp(byId[l.id]) - byId[l.id].price), 0);
  const c = $('.js-bag-count'); c.textContent = n; c.classList.toggle('on', n > 0);
  $('.js-bag-sub').textContent = fmt(sub); $('.js-bag-save').textContent = fmt(save);
  $('.js-checkout').disabled = !n;
  $('.js-bag-items').innerHTML = n ? bag.map((l, i) => {
    const p = byId[l.id];
    return `<div class="line"><img src="${p.image}" alt=""><div><b>${esc(p.name)}</b><small>${esc(desc(p))}</small>
      <div class="qty"><button type="button" data-q="-1" data-i="${i}" aria-label="Fewer">−</button><span>${l.qty}</span><button type="button" data-q="1" data-i="${i}" aria-label="More">+</button></div></div>
      <div class="line__right"><span class="price"><s>${fmt(mrp(p) * l.qty)}</s><b>${fmt(p.price * l.qty)}</b></span><button class="line__rm" type="button" data-rm="${i}">Remove</button></div></div>`;
  }).join('') : '<div class="bag__empty"><b>Your cart is empty</b>Add a few pieces from the collection.</div>';
}
$('.js-bag-items').addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
  if (q) { const l = bag[+q.dataset.i]; l.qty = Math.max(1, l.qty + +q.dataset.q); }
  if (rm) bag.splice(+rm.dataset.rm, 1);
  if (q || rm) { saveBag(); renderBag(); }
});
const openBag = () => { document.body.classList.add('bag-open'); $('.bag').setAttribute('aria-hidden', false); lenis?.stop(); };
const closeBag = () => { document.body.classList.remove('bag-open'); $('.bag').setAttribute('aria-hidden', true); lenis?.start(); };
$('.js-bag-open').addEventListener('click', openBag);
$$('.js-bag-close').forEach((b) => b.addEventListener('click', closeBag));
const mail = (subject, body) => { location.href = `mailto:${STORE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
$('.js-checkout').addEventListener('click', () => { location.href = 'checkout.html'; });
renderBag();

/* ---------------- search ---------------- */
const openSearch = () => { document.body.classList.add('search-open'); $('.search').setAttribute('aria-hidden', false); setTimeout(() => $('.js-search').focus(), 60); runSearch(); };
const closeSearch = () => { document.body.classList.remove('search-open'); $('.search').setAttribute('aria-hidden', true); };
$('.js-search-open').addEventListener('click', openSearch);
$('.js-search-close').addEventListener('click', closeSearch);
$('.search').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSearch(); });
function runSearch() {
  const q = $('.js-search').value.trim().toLowerCase();
  const res = (q ? PRODUCTS.filter((p) => `${p.name} ${p.code} ${p.category} ${p.meta}`.toLowerCase().includes(q)) : PRODUCTS.slice(0, 8)).slice(0, 12);
  $('.js-search-results').innerHTML = res.length ? res.map((p) => `<a href="#" data-go="${p.id}"><img src="${p.image}" alt=""><span><b>${esc(p.name)}</b><span class="price">${priceHTML(p)}</span></span></a>`).join('') : '<p style="color:var(--muted)">No designs match that. Try “tiger”, “amber” or “flute”.</p>';
}
$('.js-search').addEventListener('input', runSearch);
$('.js-search-results').addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]'); if (!a) return;
  e.preventDefault(); e.stopPropagation(); closeSearch();
  setTimeout(() => highlight(a.dataset.go), 80);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); closeBag(); if (document.body.classList.contains('menu-open')) $('.js-burger').click(); }
  if (e.key === '/' && !e.target.closest('input')) { e.preventDefault(); openSearch(); }
});

/* ---------------- forms & placeholders ---------------- */
$('.js-trade-mail').addEventListener('click', (e) => { e.preventDefault(); mail('Trade enquiry — Glassit', 'Business name:\nType (hotel / restaurant / gifting / retail):\nDesigns and quantities:\nCity:\nPhone:\n'); });
$('.js-contact').addEventListener('click', (e) => { e.preventDefault(); mail('Hello Glassit', ''); });
$('.js-news').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#news-email').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(v)) { toast('Please enter a valid email'); return; }
  mail('Sign me up — Glassit', `Please add ${v} to the Glassit list.`); toast('Opening your email app to confirm…');
});
if (STORE.instagram) { const a = $('.js-insta-link'); a.href = STORE.instagram; a.target = '_blank'; a.rel = 'noopener'; a.removeAttribute('aria-disabled'); }

/* ---------------- reveal + shop bar ---------------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.section-head, .story__copy, .story__media, .trade__inner, .value, .reel, .tile').forEach((el) => { el.classList.add('rv'); io.observe(el); });
new IntersectionObserver(([e]) => $('.shopbar').classList.toggle('on', !e.isIntersecting && !document.body.classList.contains('at-shop')), { threshold: 0 }).observe($('.hero__ctas'));

/* ---------------- 4 · 3D gallery (not scroll-driven: swipe, drag, arrows, dots, keys) ---------------- */
async function initTurn() {
  const { Turntable, TURN } = await import('./turntable.js?v=16');
  const info = $('.js-turn-info');
  let current = 0;
  const dots = $('.js-dots');
  dots.innerHTML = TURN.map((d, i) => `<button type="button" aria-label="${esc(byId[d.id].name)}" data-i="${i}"></button>`).join('');
  const show = (i) => {
    current = i;
    const p = byId[TURN[i].id];
    $('.js-t-cat').textContent = p.category; $('.js-t-name').textContent = p.name; $('.js-t-desc').textContent = desc(p);
    $('.js-t-price').innerHTML = priceHTML(p);
    info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
    $$('button', dots).forEach((b, j) => b.classList.toggle('on', j === i));
  };
  const tt = new Turntable($('#turn-canvas'), { onChange: (i) => show(i) });
  show(0);
  await tt.load();
  $('.js-turn-loading').classList.add('done');
  $('.js-prev').addEventListener('click', () => tt.prev());
  $('.js-next').addEventListener('click', () => tt.next());
  dots.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) tt.goTo(+b.dataset.i); });
  addEventListener('keydown', (e) => {
    const r = $('.turn').getBoundingClientRect();
    if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.5 || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') tt.next();
    if (e.key === 'ArrowLeft') tt.prev();
  });
  $('.js-t-cart').addEventListener('click', () => addToBag(TURN[current].id, null));
  $('.js-t-shop').addEventListener('click', () => shopNow(TURN[current].id));

  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) tt.tick(dt, now / 1000);
  });
  window.__glassit = { tt, lenis };
}
function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
// start the 3D gallery only when it is about to scroll into view (keeps first load light, especially on phones)
function whenNear(el, fn) {
  if (!el || !('IntersectionObserver' in window)) return fn();
  const watch = () => { const o = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); fn(); } }, { rootMargin: '400px 0px' }); o.observe(el); };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(watch, { timeout: 2500 }) : setTimeout(watch, 600));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}
if (webgl()) whenNear($('#turn'), () => initTurn().catch((err) => { console.error(err); $('.js-turn-loading').innerHTML = 'The 3D view could not load on this device.'; }));
else $('.js-turn-loading').innerHTML = 'The 3D view needs WebGL.';

// keep the sticky shop bar from covering the carousel's buttons
new IntersectionObserver(([e]) => document.body.classList.toggle('hide-shopbar', e.isIntersecting)).observe($('.turn__buy'));
