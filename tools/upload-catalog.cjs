/* eslint-disable no-console */
/**
 * Upload tools/catalog-upload.json to the shared Brand Concierge backend via
 * the brand-products edge function (it writes the embeddings). The FIRST
 * request replaces site_key=cuisinart's catalog; any further chunks append.
 * Only rows for site_key "cuisinart" are touched.
 *
 * The admin token is read from the environment — never pass it on the
 * command line or paste it anywhere:
 *   export BRAND_ADMIN_TOKEN=…   (in your own shell)
 *   node tools/upload-catalog.cjs
 */
const fs = require('fs');
const path = require('path');

const URL_BASE = process.env.BRAND_SUPABASE_URL || 'https://cyjquwhkmzyedkwuaffc.supabase.co';
const TOKEN = process.env.BRAND_ADMIN_TOKEN;
// The Supabase gateway wants a JWT on every function call; the public anon key
// (the same one the site ships in scripts/commerce.js) satisfies it. The admin
// token is what actually authorizes the write.
const ANON = process.env.BRAND_ANON_KEY
  || fs.readFileSync(path.join(__dirname, '../scripts/commerce.js'), 'utf8').match(/DEFAULT_KEY = '([^']+)'/)[1];
const CHUNK = 100; // embeddings run per request; keep requests well under the edge timeout

if (!TOKEN) {
  console.error('Set BRAND_ADMIN_TOKEN in your shell first.');
  process.exit(1);
}

const { site_key: siteKey, products } = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog-upload.json'), 'utf8'));
if (siteKey !== 'cuisinart') throw new Error(`refusing to upload for site_key ${siteKey}`);

(async () => {
  let total = 0;
  for (let i = 0; i < products.length; i += CHUNK) {
    const body = { site_key: siteKey, products: products.slice(i, i + CHUNK), append: i > 0 };
    const res = await fetch(`${URL_BASE}/functions/v1/brand-products`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: ANON,
        authorization: `Bearer ${ANON}`,
        'x-admin-token': TOKEN,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`chunk ${i / CHUNK + 1} failed: HTTP ${res.status}`, json);
      process.exit(1);
    }
    total += json.inserted || 0;
    console.log(`chunk ${i / CHUNK + 1}: inserted ${json.inserted} (total ${total}/${products.length})`);
  }
  console.log('done');
})();
