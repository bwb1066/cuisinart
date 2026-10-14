import store from '../../scripts/commerce.js';
import { loadCardStyles, productRail } from '../../scripts/utils/product-rail.js';

/**
 * product-cards — catalog products as a native Cuisinart product rail (same
 * tiles as the authored `cards` block), with Add to Cart wired to the shared
 * commerce store.
 *
 * Authoring contract — labeled rows (| key | value |), all optional:
 *   | heading  | Featured Products            |  section title
 *   | skus     | DCC-3200NAS, TOA-95NAS       |  explicit SKUs, in order
 *   | query    | air fryer                    |  catalog search
 *   | category | Coffee Makers                |  filter by category
 *   | limit    | 4                            |  max products (default 8)
 *
 * @param {Element} block The block element
 */

function readConfig(block) {
  const cfg = {
    heading: '', skus: [], query: '', category: '', limit: 8,
  };
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase();
    const val = valCell?.textContent.trim() || '';
    if (key === 'skus') cfg.skus = val.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'limit') cfg.limit = parseInt(val, 10) || cfg.limit;
    else if (['heading', 'query', 'category'].includes(key)) cfg[key] = val;
  });
  return cfg;
}

async function fetchProducts(cfg) {
  if (cfg.skus.length) {
    const resolved = await Promise.all(cfg.skus.map((s) => store.getProduct(s)));
    return resolved.filter(Boolean).slice(0, cfg.limit);
  }
  // Filter by category BEFORE the limit, or a category rail comes up short.
  const products = await store.search({
    query: cfg.query,
    limit: cfg.category ? 500 : cfg.limit,
  });
  return cfg.category
    ? products.filter((p) => p.category === cfg.category).slice(0, cfg.limit)
    : products;
}

export default async function decorate(block) {
  const cfg = readConfig(block);
  block.replaceChildren();
  if (cfg.heading) {
    const h = document.createElement('h2');
    h.className = 'product-cards-heading';
    h.textContent = cfg.heading;
    block.append(h);
  }

  const [products] = await Promise.all([fetchProducts(cfg), loadCardStyles()]);
  if (!products.length) return;
  block.append(productRail(products));

  // Re-price when a demo buyer logs in or out.
  let key = store.getBuyer()?.key || '';
  document.addEventListener('p13n:change', async () => {
    const next = store.getBuyer()?.key || '';
    if (next === key) return;
    key = next;
    const fresh = await fetchProducts(cfg);
    block.querySelector('.cards')?.replaceWith(productRail(fresh));
  });
}
