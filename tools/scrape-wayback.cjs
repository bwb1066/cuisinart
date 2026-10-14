/* eslint-disable no-console */
/**
 * Scrape Cuisinart product data from Wayback Machine captures (cuisinart.com
 * itself is behind PerimeterX). Input: tools/wayback-urls.json — [slug, sku,
 * url, timestamp] from the CDX API. Output: tools/products-raw.json.
 * Usage: node tools/scrape-wayback.cjs [concurrency]
 */
const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'wayback-urls.json');
const OUT = path.join(__dirname, 'products-raw.json');
const CONC = Number(process.argv[2] || 4);

const rows = JSON.parse(fs.readFileSync(IN, 'utf8'));
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function ldjson(html) {
  const out = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(html))) {
    try {
      const d = JSON.parse(m[1]);
      out.push(...(Array.isArray(d) ? d : [d]));
    } catch { /* skip malformed */ }
  }
  return out;
}

async function scrape([slug, sku, url, ts]) {
  const wb = `https://web.archive.org/web/${ts}id_/${url}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(wb, { headers: { 'user-agent': 'cuisinart-replica-catalog/1.0' } });
      if (res.status === 404) return { sku, url, error: 404 };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const items = ldjson(html);
      const p = items.find((i) => i['@type'] === 'Product');
      if (!p) return { sku, url, error: 'no-product' };
      const crumbs = (items.find((i) => i['@type'] === 'BreadcrumbList')?.itemListElement || [])
        .map((c) => c.name).filter((n) => n && n !== 'home');
      const rating = html.match(/"ratingValue"\s*:\s*"?([\d.]+)/);
      const reviews = html.match(/"reviewCount"\s*:\s*"?(\d+)/);
      return {
        slug,
        sku: p.sku || sku,
        url,
        captured: ts,
        name: p.name,
        description: p.description,
        images: [].concat(p.image || []),
        price: p.offers?.price ?? null,
        availability: (p.offers?.availability || '').split('/').pop(),
        crumbs,
        rating: rating ? Number(rating[1]) : null,
        reviews: reviews ? Number(reviews[1]) : null,
      };
    } catch (e) {
      await new Promise((r) => { setTimeout(r, 2000 * (attempt + 1)); });
      if (attempt === 2) return { sku, url, error: String(e.message || e) };
    }
  }
  return null;
}

(async () => {
  const todo = rows.filter(([, sku]) => !done[sku]);
  console.log(`total ${rows.length}, done ${rows.length - todo.length}, todo ${todo.length}`);
  let i = 0;
  let n = 0;
  async function worker() {
    while (i < todo.length) {
      const row = todo[i];
      i += 1;
      const r = await scrape(row);
      done[row[1]] = r;
      n += 1;
      if (n % 50 === 0) {
        fs.writeFileSync(OUT, JSON.stringify(done));
        console.log(`${n}/${todo.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(OUT, JSON.stringify(done));
  const ok = Object.values(done).filter((r) => r && !r.error).length;
  console.log(`finished: ${ok} ok of ${Object.keys(done).length}`);
})();
