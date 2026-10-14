import store from '../../scripts/commerce.js';
import { loadCardStyles, productRail } from '../../scripts/utils/product-rail.js';

/**
 * persona-products — a commerce product rail that swaps its selection to match
 * the visitor's AEP audience (window.aepAudience), and re-prices when a demo
 * buyer logs in. Reacts to `p13n:change` (fired on persona switch, browsing
 * signals, and demo-panel buyer toggles), re-querying window.brandCommerce.
 *
 * Soft dependency on the AEP tracking skill: it reads window.aepAudience and
 * listens for p13n:change, both of which simply never appear without it — so
 * on a commerce-only site this renders the `default` selection and stays put.
 *
 * Authoring: one row per persona — first cell the audience key (or `default`),
 * second cell a search query the commerce catalog is matched against.
 */

// Matches personalization.js's default audience global. If the AEP config
// overrides audienceGlobal, p13n:change events still carry the audience in
// their detail (and fire once on load), so only a pre-event first paint uses this.
const AUD_GLOBAL = 'aepAudience';
const LIMIT = 8;

function readGroups(block) {
  const groups = {};
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = row.children;
    const key = keyCell?.textContent.trim().toLowerCase().replace(/[\s/]+/g, '_');
    const query = valCell?.textContent.trim();
    if (key && query) groups[key] = query;
  });
  return groups;
}

export default function decorate(block) {
  const groups = readGroups(block);
  const keys = Object.keys(groups);
  if (!keys.length) return;

  block.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'persona-products-title';
  title.textContent = 'Recommended products';
  const grid = document.createElement('div');
  grid.className = 'persona-products-grid';
  block.append(title, grid);
  const styles = loadCardStyles();

  const pickKey = (aud) => {
    if (aud && groups[aud]) return aud;
    if (groups.default) return 'default';
    return keys[0];
  };

  let token = 0;
  const render = async (aud) => {
    const query = groups[pickKey(aud)];
    token += 1;
    const mine = token;
    const [products] = await Promise.all([store.search({ query, limit: LIMIT }), styles]);
    if (mine !== token) return; // a newer render superseded this one
    grid.replaceChildren(productRail(products));
    block.classList.remove('is-updated');
    // eslint-disable-next-line no-void
    void block.offsetWidth;
    block.classList.add('is-updated');
  };

  render(window[AUD_GLOBAL]);
  document.addEventListener('p13n:change', (e) => render(e.detail?.audience || window[AUD_GLOBAL]));
}
