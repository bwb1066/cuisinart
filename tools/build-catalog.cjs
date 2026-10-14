/* eslint-disable no-console */
/**
 * Build the Cuisinart catalog from tools/products-raw.json (Wayback scrape).
 * Keeps "Shop By Category" products (not Parts & Accessories, not
 * Discontinued) that carry a real price, then selects up to MAX products
 * balanced across sub-categories — always including SKUs authored on the
 * home page. Real data: name, description, image, list price, category,
 * availability. Synthesized (deterministic, demo only): stock quantity and
 * lead time for out-of-stock items.
 *
 * Writes tools/catalog-upload.json — the brand-products upload payload.
 * Usage: node tools/build-catalog.cjs [max=500]
 */
const fs = require('fs');
const path = require('path');

const MAX = Number(process.argv[2] || 500);
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'products-raw.json'), 'utf8'));

// SKUs merchandised on the authored home page (Best Sellers tabs).
const PINNED = ['TOA-95NAS', 'TOA-112', 'GR-4NNAS', 'AIR-160NAS', 'TOA-26', 'GR-150NAS',
  'DGB-30', 'DCC-3000NAS', 'DGB-400NAS', 'SS-18', 'DGB-450NAS', 'DCC-3400NAS',
  'MCPS-12N', '77-11G', '77-17N', 'PCT-12', 'DFP-14BCNY', 'FP-1400', 'SG-10', 'P-AFC-4'];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0; // eslint-disable-line no-bitwise
  }
  return Math.abs(h);
}

const clean = (s) => (s || '').replace(/\s+/g, ' ')
  .replace(/&reg;/g, '®').replace(/&trade;/g, '™').trim();

const eligible = Object.values(raw).filter((r) => r && !r.error
  && r.crumbs?.[0] === 'Shop By Category'
  && r.crumbs[1] && r.crumbs[1] !== 'Parts & Accessories'
  && Number(r.price) > 0
  && r.availability !== 'Discontinued'
  && r.name && r.description);

// Round-robin across sub-categories so no one aisle dominates.
const byCat = new Map();
eligible.forEach((r) => {
  const cat = r.crumbs.length > 3 ? r.crumbs[2] : r.crumbs[1];
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat).push(r);
});
byCat.forEach((list) => list.sort((a, b) => (b.availability === 'InStock') - (a.availability === 'InStock') || hash(a.sku) - hash(b.sku)));

// Picks per round, by department: the demo leans on appliances & cookware.
const WEIGHT = {
  Appliances: 3, Cookware: 2, Cutlery: 2, Bakeware: 1, 'Kitchen Tools & Gadgets': 1, Outdoors: 1,
};
const home = JSON.parse(fs.readFileSync(path.join(__dirname, 'home-products.json'), 'utf8'));
const fallbackCount = PINNED.filter((s) => !eligible.some((r) => r.sku === s) && home[s]).length;
const CAP = MAX - fallbackCount;

const picked = new Map();
eligible.filter((r) => PINNED.includes(r.sku)).forEach((r) => picked.set(r.sku, r));
const queues = [...byCat.values()]
  .map((l) => ({ list: [...l], w: WEIGHT[l[0].crumbs[1]] || 1 }));
while (picked.size < CAP && queues.some((q) => q.list.length)) {
  queues.forEach((q) => {
    for (let k = 0; k < q.w && picked.size < CAP; k += 1) {
      const next = q.list.shift();
      if (next && !picked.has(next.sku)) picked.set(next.sku, next);
    }
  });
}

// Home-page SKUs the archive never captured: fall back to the authored
// tile (name, price, image) so every merchandised product is buyable.
const HOME_CATS = [
  [/^(GR-)/, 'Appliances', 'Griddlers & Indoor Grills'],
  [/^(TOA-)/, 'Appliances', 'Toaster Ovens'],
  [/^(AIR-|P-AFC)/, 'Appliances', 'Air Fryers'],
  [/^(SS-|DGB-|DCC-)/, 'Appliances', 'Coffee Makers'],
  [/^(DFP-|FP-)/, 'Appliances', 'Food Processors'],
  [/^(SG-)/, 'Appliances', 'Coffee & Spice Grinders'],
  [/^(MCPS|PCT|77-)/, 'Cookware', 'Cookware Sets'],
];
PINNED.filter((s) => !picked.has(s) && home[s]).forEach((sku) => {
  const h = home[sku];
  const [, department, category] = HOME_CATS.find(([re]) => re.test(sku)) || [null, 'Appliances', 'Appliances'];
  picked.set(sku, {
    sku,
    url: h.url,
    name: h.name,
    description: `${h.name} from Cuisinart's ${category.toLowerCase()} range.`,
    images: [h.image],
    price: h.price,
    availability: 'InStock',
    crumbs: ['Shop By Category', department, category, sku],
  });
});

const products = [...picked.values()].map((r) => {
  const department = r.crumbs[1];
  const category = r.crumbs.length > 3 ? r.crumbs[2] : department;
  const out = r.availability === 'OutOfStock';
  const h = hash(r.sku);
  return {
    productName: clean(r.name),
    productPageUrl: r.url,
    productDescription: clean(r.description).slice(0, 1500),
    // Demandware image service: ?sw= resizes server-side (≈30KB vs 340KB).
    productImageUrl: r.images?.[0] ? r.images[0].replace(/\?.*$/, '') + (r.images[0].includes('/dw/image/') ? '?sw=600' : '') : null,
    sku: r.sku,
    category,
    listPrice: Number(r.price),
    currency: 'USD',
    uom: 'each',
    priceBreaks: [],
    stockQty: out ? 0 : 25 + (h % 475),
    leadTimeDays: out ? 7 + (h % 14) : 0,
    minOrderQty: 1,
    active: true,
    specs: { brand: 'Cuisinart', department },
  };
});

fs.writeFileSync(path.join(__dirname, 'catalog-upload.json'), JSON.stringify({ site_key: 'cuisinart', products }, null, 1));
const cats = {};
products.forEach((p) => { cats[p.category] = (cats[p.category] || 0) + 1; });
console.log(`eligible ${eligible.length}, selected ${products.length}, categories ${Object.keys(cats).length}`);
console.log(
  'pinned found:',
  PINNED.filter((s) => picked.has(s)).length,
  '/',
  PINNED.length,
  'missing:',
  PINNED.filter((s) => !picked.has(s)).join(' '),
);
console.log(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join('\n'));
