// Brand + commerce settings. Edit these to go live.
export const CONFIG = {
  brand: 'AUREUM',
  // Order requests, quotes and sign-ups open the visitor's email app addressed here.
  email: 'hello@aureum.example',
  currency: 'INR',
  locale: 'en-IN',
  // Indicative single-glass prices (₹). Placeholders until real pricing is set.
  price: { rocks: 1850, mug: 2250, tumbler: 1650 },
  monogram: 450,          // per glass
  giftDiscount: 0.10,     // full box of 4
  // Trade tiers: min quantity -> discount and lead time
  tiers: [
    { min: 24, off: 0.00, lead: '2–3 weeks' },
    { min: 100, off: 0.12, lead: '3–4 weeks' },
    { min: 500, off: 0.22, lead: '4–6 weeks' },
    { min: 2000, off: 0.30, lead: '6–8 weeks' },
  ],
};

export const FORMS = {
  rocks: { name: 'The Rocks', short: 'Rocks', cap: '≈ 340 ml', pour: 'whisky', level: 0.62 },
  mug: { name: 'The Stein', short: 'Stein', cap: '≈ 580 ml', pour: 'beer', level: 0.82 },
  tumbler: { name: 'The Tumbler', short: 'Tumbler', cap: '≈ 360 ml', pour: 'juice', level: 0.78 },
};

export const MOTIFS = [
  { key: 'tiger', name: 'The Tiger', short: 'Tiger', family: 'Regal Beasts', metal: 0.92, rough: 0.26 },
  { key: 'lion', name: 'The Lion', short: 'Lion', family: 'Regal Beasts', metal: 0.92, rough: 0.26 },
  { key: 'tree', name: 'Tree of Life', short: 'Tree of Life', family: 'Botanica', metal: 0.35, rough: 0.32 },
  { key: 'peacock', name: 'The Peacock', short: 'Peacock', family: 'Botanica', metal: 0.35, rough: 0.32 },
  { key: 'queen', name: 'The Queen', short: 'Queen', family: 'Heritage Portraits', metal: 0.2, rough: 0.35 },
  { key: 'king', name: 'The King', short: 'King', family: 'Heritage Portraits', metal: 0.2, rough: 0.35 },
];

export const money = (n) =>
  new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency, maximumFractionDigits: 0 }).format(Math.round(n));
