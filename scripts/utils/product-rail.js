import { getConfig, loadStyle } from '../ak.js';
import store, { setThumb } from '../commerce.js';
import buildPager from './rail.js';

/**
 * Catalog products rendered as native Cuisinart product tiles — the same
 * markup and styles as the authored `cards` block (image, title, price,
 * underlined "Add to Cart", arrow + dot paging) — so commerce-driven rails
 * (product-cards, persona-products) are indistinguishable from authored ones.
 */

const CTA = 'Add to Cart';

export function loadCardStyles() {
  const { codeBase } = getConfig();
  return loadStyle(`${codeBase}/blocks/cards/cards.css`);
}

function tile(product) {
  const href = `${store.pdpUrl}?sku=${encodeURIComponent(product.sku)}`;
  const li = document.createElement('li');
  li.className = 'cards-card';
  li.dataset.sku = product.sku;

  const media = document.createElement('div');
  media.className = 'cards-card-image';
  const link = document.createElement('a');
  link.href = href;
  link.tabIndex = -1;
  link.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  setThumb(img, product.image_url);
  link.append(img);
  media.append(link);

  const body = document.createElement('div');
  body.className = 'cards-card-body';
  const title = document.createElement('h3');
  title.className = 'cards-title';
  const titleLink = document.createElement('a');
  titleLink.href = href;
  titleLink.textContent = product.name;
  title.append(titleLink);

  const price = document.createElement('p');
  price.className = 'cards-price';
  price.textContent = store.formatPrice(store.resolvePrice(product, 1));

  const cta = document.createElement('p');
  cta.className = 'cards-cta';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'cards-cta-link';
  add.textContent = CTA;
  add.addEventListener('click', async () => {
    await store.addToQuote(product.sku, 1, 'web');
    add.textContent = 'Added ✓';
    add.classList.add('is-added');
    setTimeout(() => {
      add.textContent = CTA;
      add.classList.remove('is-added');
    }, 1400);
  });
  cta.append(add);

  body.append(title, price, cta);
  li.append(media, body);
  return li;
}

/** A `.cards` rail of catalog products, ready to append. */
export function productRail(products, label = 'products') {
  const rail = document.createElement('div');
  rail.className = 'cards cards-catalog';
  const track = document.createElement('ul');
  track.className = 'cards-track';
  track.append(...products.map(tile));
  rail.append(track);
  buildPager(rail, track, label);
  return rail;
}
