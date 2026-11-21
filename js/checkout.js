// GLASSIT checkout: reads the bag saved by the store pages, collects delivery + payment
// details, and sends the order to the Glassit team.
import { PRODUCTS } from './catalog-data.js';

const STORE = { email: 'orders@glassit.example', discount: 0.30 }; // placeholder order email
const BAG_KEY = 'glassit-bag-v1', ORDERS_KEY = 'glassit-orders-v1', FORM_KEY = 'glassit-checkout-form';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const mrp = (p) => Math.ceil(p.price / (1 - STORE.discount) / 5) * 5;
const desc = (p) => [p.code, p.meta].filter(Boolean).join(' · ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } } };

let bag = store.get(BAG_KEY, []).filter((l) => byId[l.id]);
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
$('.js-states').innerHTML = '<option value="" disabled selected></option>' + STATES.map((s) => `<option>${s}</option>`).join('');

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('.toasts').append(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2800);
}
const totals = () => {
  const sub = bag.reduce((s, l) => s + l.qty * byId[l.id].price, 0);
  const full = bag.reduce((s, l) => s + l.qty * mrp(byId[l.id]), 0);
  return { sub, full, save: full - sub, n: bag.reduce((s, l) => s + l.qty, 0) };
};

function render() {
  const empty = !bag.length;
  $('.js-co').hidden = empty; $('.js-empty').hidden = !empty;
  if (empty) return;
  const T = totals();
  $('.js-items').innerHTML = bag.map((l, i) => {
    const p = byId[l.id];
    return `<div class="co-line"><img src="${p.image}" alt=""><div><b>${esc(p.name)}</b><small>${esc(desc(p))}</small>
      <div class="qty"><button type="button" data-q="-1" data-i="${i}" aria-label="Fewer">−</button><span>${l.qty}</span><button type="button" data-q="1" data-i="${i}" aria-label="More">+</button></div></div>
      <div><span class="price"><s>${fmt(mrp(p) * l.qty)}</s><b>${fmt(p.price * l.qty)}</b></span><button class="line__rm" type="button" data-rm="${i}">Remove</button></div></div>`;
  }).join('');
  $('.js-count').textContent = `${T.n} item${T.n === 1 ? '' : 's'}`;
  $('.js-mrp').textContent = fmt(T.full);
  $('.js-save').textContent = '−' + fmt(T.save); $('.js-save2').textContent = fmt(T.save);
  $('.js-sub').textContent = fmt(T.sub); $('.js-total').textContent = fmt(T.sub); $('.js-total-btn').textContent = fmt(T.sub);
}
$('.js-items').addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
  if (q) { const l = bag[+q.dataset.i]; l.qty = Math.max(1, l.qty + +q.dataset.q); }
  if (rm) bag.splice(+rm.dataset.rm, 1);
  if (q || rm) { store.set(BAG_KEY, bag); render(); }
});

// remember what the visitor typed (this browser only)
const form = $('.js-form');
const saved = store.get(FORM_KEY, {});
Object.entries(saved).forEach(([k, v]) => { const el = form.elements[k]; if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else if (el instanceof RadioNodeList) el.value = v; else el.value = v; });
const b2b = () => { $('.js-b2b-fields').hidden = !$('.js-b2b').checked; };
$('.js-b2b').addEventListener('change', b2b); b2b();
form.addEventListener('input', () => {
  const d = Object.fromEntries(new FormData(form)); d.b2b = $('.js-b2b').checked; store.set(FORM_KEY, d);
});
form.addEventListener('focusin', (e) => { if (e.target.closest('.pay, textarea')) { $('.js-step-pay').classList.add('on'); } });

const RULES = {
  email: (v) => /^\S+@\S+\.\S+$/.test(v), phone: (v) => v.replace(/\D/g, '').length >= 10,
  name: (v) => v.trim().length > 1, address1: (v) => v.trim().length > 2, city: (v) => v.trim().length > 1,
  state: (v) => !!v, pin: (v) => /^[1-9][0-9]{5}$/.test(v.trim()),
};
let lastOrder = null;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let firstBad = null;
  Object.entries(RULES).forEach(([k, ok]) => {
    const el = form.elements[k], bad = !ok(el.value || '');
    el.closest('.field').classList.toggle('err', bad);
    if (bad && !firstBad) firstBad = el;
  });
  if (firstBad) { firstBad.focus(); toast('Please check the highlighted details'); return; }
  const d = Object.fromEntries(new FormData(form));
  const T = totals();
  const id = 'GL-' + Date.now().toString(36).toUpperCase().slice(-6);
  const lines = bag.map((l) => { const p = byId[l.id]; return `• ${l.qty} × ${p.name} (${p.code || '—'}) — ${fmt(p.price * l.qty)}`; }).join('\n');
  const body = [
    `Order ${id}`, '',
    lines, '',
    `Price: ${fmt(T.full)}`, `Launch discount (30%): −${fmt(T.save)}`, `Subtotal: ${fmt(T.sub)} (delivery to be confirmed)`, '',
    `Payment: ${d.payment}`, '',
    `Name: ${d.name}`, `Phone: ${d.phone}`, `Email: ${d.email}`,
    `Address: ${d.address1}${d.address2 ? ', ' + d.address2 : ''}, ${d.city}, ${d.state} ${d.pin}`,
    $('.js-b2b').checked ? `Business order: ${d.company || '—'}  GSTIN: ${(d.gstin || '—').toUpperCase()}` : 'Order type: personal',
    d.note ? `Note: ${d.note}` : '',
  ].filter((x) => x !== null).join('\n');
  lastOrder = { id, subject: `New order ${id} — ${d.name}`, body };
  const orders = store.get(ORDERS_KEY, []); orders.push({ id, at: new Date().toISOString(), items: bag, total: T.sub, payment: d.payment }); store.set(ORDERS_KEY, orders);
  send();
  bag = []; store.set(BAG_KEY, bag);
  $('.js-oid').textContent = id; $('.js-oname').textContent = d.name.split(' ')[0];
  $('.js-co').hidden = true; $('.js-done').hidden = false;
  $$('.co-steps li').forEach((li) => { li.classList.remove('on'); li.classList.add('done'); });
  $('.js-step-done').classList.add('on');
  scrollTo({ top: 0, behavior: 'smooth' });
});
function send() {
  if (!lastOrder) return;
  location.href = `mailto:${STORE.email}?subject=${encodeURIComponent(lastOrder.subject)}&body=${encodeURIComponent(lastOrder.body)}`;
}
$('.js-resend').addEventListener('click', send);
render();
