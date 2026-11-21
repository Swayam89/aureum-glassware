// GLASSIT storefront (Shopify): live products from the store, Shopify cart + checkout,
// 3D gallery, filters, search. Copy is rendered by the theme's sections; this script adds behaviour.
const CFG = Object.assign({ email: '', instagram: '', assets: '' }, window.GLASSIT || {});
const CATS = [
  { key: 'all', name: 'All' },
  { key: 'wine', name: 'Wine & Cocktail', url: '/collections/wine-and-cocktail' },
  { key: 'tumblers', name: 'Tumblers', url: '/collections/tumblers' },
  { key: 'gold', name: 'Gold Detail', url: '/collections/gold-detail' },
  { key: 'beer', name: 'Beer & Whisky Sets', url: '/collections/beer-and-whisky-sets' },
  { key: 'cups', name: 'Cups & Saucers', url: '/collections/cups-and-saucers' },
  { key: 'dispensers', name: 'Water Dispensers', url: '/collections/water-dispensers' },
];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sized = (src, w) => (src ? src + (src.includes('?') ? '&' : '?') + 'width=' + w : '');
const mrp = (p) => p.compare || Math.ceil(p.price / 0.7 / 5) * 5;
const off = (p) => Math.floor((1 - p.price / mrp(p)) * 100 + 1e-9);
const priceHTML = (p) => (mrp(p) > p.price ? `<s>${fmt(mrp(p))}</s><b>${fmt(p.price)}</b><i>-${off(p)}%</i>` : `<b>${fmt(p.price)}</b>`);
const desc = (p) => [p.code, p.meta].filter(Boolean).join(' · ');

let PRODUCTS = [], byId = {};
async function loadProducts() {
  const out = [];
  for (let page = 1; page < 5; page++) {
    const r = await fetch(`/products.json?limit=250&page=${page}`);
    const { products } = await r.json();
    out.push(...products);
    if (products.length < 250) break;
  }
  PRODUCTS = out.map((p) => {
    const v = p.variants[0] || {};
    return {
      id: p.handle, name: p.title, url: `/products/${p.handle}`, vid: v.id, available: v.available !== false,
      price: parseFloat(v.price), compare: v.compare_at_price ? parseFloat(v.compare_at_price) : 0,
      code: v.sku || '', meta: (p.body_html || '').replace(/<[^>]+>/g, '').replace(v.sku || '\u0000', '').replace(/^\s*·\s*/, '').trim(),
      cat: (p.tags || []).find((t) => CATS.some((c) => c.key === t)) || '', category: p.product_type,
      image: p.images[0]?.src || '', created: p.created_at,
    };
  }).sort((a, b) => a.created.localeCompare(b.created));
  byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
}

gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = window.Lenis && !reduced ? new window.Lenis({ lerp: 0.1, smoothWheel: true }) : null;
if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
const scrollToEl = (target, offset = 0) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.3 });
  else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
};
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('.toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------------- ticker: duplicate the messages for a seamless loop ---------------- */
const tk = $('.js-ticker');
if (tk) tk.innerHTML += tk.innerHTML;

/* ---------------- nav ---------------- */
const nav = $('.nav');
if ($('.ticker')) new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)).observe($('.ticker'));
$('.js-burger')?.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  $('.js-burger').setAttribute('aria-expanded', open);
  open ? lenis?.stop() : lenis?.start();
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  e.preventDefault();
  if (document.body.classList.contains('menu-open')) { document.body.classList.remove('menu-open'); lenis?.start(); }
  if (a.dataset.cat) setFilter(a.dataset.cat);
  const target = href === '#' || href === '#top' ? 0 : $(href);
  if (target !== null) scrollToEl(target, target === 0 ? 0 : -nav.offsetHeight + 2);
});

/* ---------------- cart (Shopify AJAX cart) ---------------- */
let cart = { items: [], item_count: 0 };
async function refreshCart() { cart = await fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((r) => r.json()); renderCart(); }
async function addToCart(id, fromImg) {
  const p = byId[id]; if (!p) return;
  const r = await fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: p.vid, quantity: 1 }] }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); toast(j.description || 'Could not add this to your cart'); return; }
  if (fromImg) fly(fromImg);
  toast(`${p.name} added to your cart`);
  refreshCart();
}
// "Shop now": straight to Shopify checkout with just this piece (the cart is left as it is)
function shopNow(id) { const p = byId[id]; if (p) location.href = `/cart/${p.vid}:1`; }
async function changeLine(key, quantity) {
  await fetch('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: key, quantity }) });
  refreshCart();
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
function renderCart() {
  const n = cart.item_count || 0;
  const c = $('.js-bag-count'); c.textContent = n; c.classList.toggle('on', n > 0);
  const sub = (cart.items_subtotal_price ?? cart.total_price ?? 0) / 100;
  const full = cart.items.reduce((s, it) => { const p = byId[it.handle]; return s + (p ? mrp(p) : it.final_price / 100) * it.quantity; }, 0);
  $('.js-bag-sub').textContent = fmt(sub); $('.js-bag-save').textContent = fmt(Math.max(0, full - sub));
  $('.js-checkout').disabled = !n;
  $('.js-bag-items').innerHTML = n ? cart.items.map((it) => {
    const p = byId[it.handle];
    return `<div class="line"><img src="${esc(sized(it.image, 200))}" alt=""><div><b>${esc(it.product_title)}</b><small>${esc(p ? desc(p) : it.sku || '')}</small>
      <div class="qty"><button type="button" data-k="${esc(it.key)}" data-q="${it.quantity - 1}" aria-label="Fewer">−</button><span>${it.quantity}</span><button type="button" data-k="${esc(it.key)}" data-q="${it.quantity + 1}" aria-label="More">+</button></div></div>
      <div class="line__right"><span class="price">${p && mrp(p) > p.price ? `<s>${fmt(mrp(p) * it.quantity)}</s>` : ''}<b>${fmt(it.final_line_price / 100)}</b></span><button class="line__rm" type="button" data-k="${esc(it.key)}" data-q="0">Remove</button></div></div>`;
  }).join('') : '<div class="bag__empty"><b>Your cart is empty</b>Add a few pieces from the collection.</div>';
}
$('.js-bag-items').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const q = Math.max(0, +b.dataset.q);
  changeLine(b.dataset.k, b.dataset.q === '0' ? 0 : Math.max(1, q));
});
const openBag = () => { document.body.classList.add('bag-open'); $('.bag').setAttribute('aria-hidden', false); lenis?.stop(); refreshCart(); };
const closeBag = () => { document.body.classList.remove('bag-open'); $('.bag').setAttribute('aria-hidden', true); lenis?.start(); };
$('.js-bag-open').addEventListener('click', openBag);
$$('.js-bag-close').forEach((b) => b.addEventListener('click', closeBag));
$('.js-checkout').addEventListener('click', () => { location.href = '/checkout'; });

/* ---------------- shop grid ---------------- */
let filter = 'all', shown = 8;
const grid = $('.js-grid');
const list = () => (filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === filter));
function setFilter(cat) {
  filter = cat; shown = 8;
  $$('.js-chips button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  renderGrid();
}
function cardHTML(p, i) {
  return `<article class="card enter" style="animation-delay:${(i % 8) * 50}ms" data-id="${esc(p.id)}">
    <a class="card__img" href="${p.url}"><img src="${esc(sized(p.image, 700))}" alt="${esc(p.name)}" loading="lazy" width="700" height="780">${mrp(p) > p.price ? `<span class="card__badge">-${off(p)}%</span>` : ''}</a>
    <div class="card__body"><h3><a href="${p.url}">${esc(p.name)}</a></h3><small>${esc(desc(p))}</small><span class="price">${priceHTML(p)}</span>
      <div class="card__btns"><button class="btn btn--line" type="button" data-cart="${esc(p.id)}">Add to cart</button><button class="btn btn--dark" type="button" data-buy="${esc(p.id)}">Shop now</button></div></div>
  </article>`;
}
function renderGrid() {
  if (!grid) return;
  const L = list();
  grid.innerHTML = L.slice(0, shown).map(cardHTML).join('');
  $('.js-more').hidden = shown >= L.length;
  $('.js-count').textContent = `Showing ${Math.min(shown, L.length)} of ${L.length} designs`;
}
$('.js-more')?.addEventListener('click', () => {
  const L = list(), from = shown; shown += 8;
  grid.insertAdjacentHTML('beforeend', L.slice(from, shown).map(cardHTML).join(''));
  $('.js-more').hidden = shown >= L.length;
  $('.js-count').textContent = `Showing ${Math.min(shown, L.length)} of ${L.length} designs`;
  ScrollTrigger.refresh();
});
grid?.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cart]'), b = e.target.closest('[data-buy]');
  if (c) addToCart(c.dataset.cart, c.closest('.card').querySelector('img'));
  if (b) shopNow(b.dataset.buy);
});
function highlight(id) {
  const p = byId[id]; if (!p || !grid) return;
  if (filter !== 'all' && filter !== p.cat) setFilter(p.cat);
  const L = list(), idx = L.findIndex((x) => x.id === id);
  if (idx >= shown) { shown = Math.ceil((idx + 1) / 8) * 8; renderGrid(); }
  const card = grid.querySelector(`[data-id="${id}"]`);
  if (card) scrollToEl(card, -nav.offsetHeight - 30);
}

/* ---------------- search ---------------- */
const openSearch = () => { document.body.classList.add('search-open'); $('.search').setAttribute('aria-hidden', false); setTimeout(() => $('.js-search').focus(), 60); runSearch(); };
const closeSearch = () => { document.body.classList.remove('search-open'); $('.search').setAttribute('aria-hidden', true); };
$('.js-search-open').addEventListener('click', openSearch);
$('.js-search-close').addEventListener('click', closeSearch);
$('.search').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSearch(); });
function runSearch() {
  const q = $('.js-search').value.trim().toLowerCase();
  const res = (q ? PRODUCTS.filter((p) => `${p.name} ${p.code} ${p.category} ${p.meta}`.toLowerCase().includes(q)) : PRODUCTS.slice(0, 8)).slice(0, 12);
  $('.js-search-results').innerHTML = res.length ? res.map((p) => `<a href="${p.url}"><img src="${esc(sized(p.image, 160))}" alt=""><span><b>${esc(p.name)}</b><span class="price">${priceHTML(p)}</span></span></a>`).join('') : '<p style="color:var(--muted)">No designs match that. Try “tiger”, “amber” or “flute”.</p>';
}
$('.js-search').addEventListener('input', runSearch);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); closeBag(); if (document.body.classList.contains('menu-open')) $('.js-burger').click(); }
  if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); openSearch(); }
});

/* ---------------- forms & links ---------------- */
const mail = (subject, body) => { if (CFG.email) location.href = `mailto:${CFG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
$('.js-trade-mail')?.addEventListener('click', (e) => { if (!CFG.email) return; e.preventDefault(); mail('Trade enquiry — Glassit', 'Business name:\nType (hotel / restaurant / gifting / retail):\nDesigns and quantities:\nCity:\nPhone:\n'); });

/* ---------------- reveal + sticky shop bar ---------------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.section-head, .story__copy, .story__media, .trade__inner, .value, .reel, .tile').forEach((el) => { el.classList.add('rv'); io.observe(el); });
if ($('.hero__ctas')) new IntersectionObserver(([e]) => $('.shopbar')?.classList.toggle('on', !e.isIntersecting)).observe($('.hero__ctas'));
if ($('.turn__buy')) new IntersectionObserver(([e]) => document.body.classList.toggle('hide-shopbar', e.isIntersecting)).observe($('.turn__buy'));

/* ---------------- 3D gallery ---------------- */
async function initTurn() {
  const { Turntable, TURN } = await import(CFG.turntable);
  const info = $('.js-turn-info'), dots = $('.js-dots');
  const items = TURN.filter((d) => byId[d.id]);
  if (!items.length) { $('.js-turn-loading').innerHTML = ''; return; }
  let current = 0;
  dots.innerHTML = TURN.map((d, i) => `<button type="button" aria-label="${esc(byId[d.id]?.name || d.key)}" data-i="${i}"></button>`).join('');
  const show = (i) => {
    current = i;
    const p = byId[TURN[i].id]; if (!p) return;
    $('.js-t-cat').textContent = p.category; $('.js-t-name').textContent = p.name; $('.js-t-desc').textContent = desc(p);
    $('.js-t-price').innerHTML = priceHTML(p);
    info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
    $$('button', dots).forEach((b, j) => b.classList.toggle('on', j === i));
  };
  const tt = new Turntable($('#turn-canvas'), { onChange: (i) => show(i) });
  show(0);
  await tt.load(CFG.assets);
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
  $('.js-t-cart').addEventListener('click', () => addToCart(TURN[current].id, null));
  $('.js-t-shop').addEventListener('click', () => shopNow(TURN[current].id));
  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) tt.tick(dt, now / 1000);
  });
}
function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

/* ---------------- boot ---------------- */
(async () => {
  try { await loadProducts(); } catch (e) { console.error('products', e); }
  // chips with live counts
  const chips = $('.js-chips');
  if (chips) {
    chips.innerHTML = CATS.map((c) => {
      const n = c.key === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.key).length;
      return n || c.key === 'all' ? `<button type="button" data-cat="${c.key}" class="${c.key === 'all' ? 'on' : ''}">${c.name}<small>${n}</small></button>` : '';
    }).join('');
    $$('button', chips).forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.cat)));
  }
  renderGrid();
  // hero product price
  const hp = $('.js-hero-price');
  if (hp && byId[hp.dataset.handle]) hp.innerHTML = priceHTML(byId[hp.dataset.handle]);
  refreshCart();
  if ($('#turn-canvas')) {
    if (webgl()) initTurn().catch((err) => { console.error(err); $('.js-turn-loading').innerHTML = 'The 3D view could not load on this device.'; });
    else $('.js-turn-loading').innerHTML = 'The 3D view needs WebGL.';
  }
  ScrollTrigger.refresh();
})();
