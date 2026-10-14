import buildPager from '../../scripts/utils/rail.js';

/**
 * cards — product tiles. One row per product:
 *   | image | [eyebrow] / h3 title / "4.6 (591)" / "$64.95 $35.95" / [savings] / CTA |
 * Rows render as a horizontal, snap-scrolling rail with arrow + dot paging.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

function svg(d, cls) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.classList.add(cls);
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
}

/** "4.6 (591)" → five stars filled to 4.6, then the authored text. */
function decorateRating(p) {
  const m = p.textContent.trim().match(/^(\d(?:\.\d)?)\s*(\(\s*[\d,]+\s*\))?$/);
  if (!m) return false;
  const score = parseFloat(m[1]);
  p.className = 'cards-rating';
  p.setAttribute('aria-label', `Rated ${score} out of 5${m[2] ? `, ${m[2].replace(/[()]/g, '').trim()} reviews` : ''}`);
  const stars = document.createElement('span');
  stars.className = 'cards-stars';
  stars.style.setProperty('--rating', score / 5);
  for (let i = 0; i < 5; i += 1) stars.append(svg(STAR));
  const text = document.createElement('span');
  text.setAttribute('aria-hidden', 'true');
  text.textContent = p.textContent.trim();
  p.replaceChildren(stars, text);
  return true;
}

/** "$349.95" or "$64.95 $35.95" (was / now). */
function decoratePrice(p) {
  const prices = p.textContent.trim().match(/\$[\d,]+(?:\.\d{2})?/g);
  if (!prices || p.textContent.replace(/\$[\d,]+(?:\.\d{2})?/g, '').trim()) return false;
  p.className = 'cards-price';
  if (prices.length > 1) {
    const [first] = prices;
    const was = document.createElement('s');
    was.textContent = first;
    const now = document.createElement('strong');
    now.className = 'is-sale';
    now.textContent = prices[prices.length - 1];
    p.replaceChildren(was, ' ', now);
  }
  return true;
}

function decorateBody(body) {
  body.className = 'cards-card-body';
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  heading?.classList.add('cards-title');
  const kids = [...body.children];
  const headingAt = kids.indexOf(heading);
  [...body.querySelectorAll(':scope > p')].forEach((p) => {
    const a = p.querySelector('a');
    if (a && p.textContent.trim() === a.textContent.trim()) {
      p.className = 'cards-cta';
      a.className = 'cards-cta-link';
      return;
    }
    if (decorateRating(p) || decoratePrice(p)) return;
    if (/off$/i.test(p.textContent.trim())) p.className = 'cards-savings';
    else if (headingAt > kids.indexOf(p)) p.className = 'cards-eyebrow';
  });
  // An unlinked "Add to Cart" (strong text only) still reads as the CTA.
  body.querySelectorAll(':scope > p > strong:only-child').forEach((s) => {
    if (/^add to cart$/i.test(s.textContent.trim())) s.parentElement.className = 'cards-cta';
  });
}

/** Model number from a cuisinart.com product URL: /slug/TOA-95NAS.html → TOA-95NAS */
function skuFromHref(href) {
  try {
    return new URL(href, window.location.href).pathname.match(/\/([A-Z0-9][A-Z0-9-]*)\.html$/)?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Authored product tiles link to cuisinart.com. When the SKU is in this site's
 * catalog, point the tile at our PDP and make "Add to Cart" add to the shared
 * cart (site, concierge and agents all see the same cart).
 */
async function connectCommerce(track) {
  const { default: store } = await import('../../scripts/commerce.js');
  await Promise.all([...track.querySelectorAll('.cards-card')].map(async (card) => {
    const titleLink = card.querySelector('.cards-title a');
    const sku = skuFromHref(titleLink?.href || card.querySelector('a')?.href || '');
    const product = sku ? await store.getProduct(sku) : null;
    if (!product) return;
    card.dataset.sku = product.sku;
    const pdp = `${store.pdpUrl}?sku=${encodeURIComponent(product.sku)}`;
    card.querySelectorAll('.cards-card-image a, .cards-title a').forEach((a) => { a.href = pdp; });

    const cta = card.querySelector('.cards-cta');
    if (!cta) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cards-cta-link';
    btn.textContent = cta.textContent.trim() || store.ctaLabel;
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      await store.addToQuote(product.sku, 1, 'web');
      btn.textContent = 'Added ✓';
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove('is-added');
      }, 1400);
    });
    cta.replaceChildren(btn);
  }));
}

/**
 * @param {Element} el The block element
 */
export default function init(el) {
  const track = document.createElement('ul');
  track.className = 'cards-track';
  [...el.querySelectorAll(':scope > div')].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-card';
    [...row.children].forEach((cell) => {
      const pic = cell.querySelector('picture');
      if (pic && cell.textContent.trim() === '') {
        cell.className = 'cards-card-image';
        // Link the image to the product, like the title.
        const href = row.querySelector('h1 a, h2 a, h3 a, h4 a')?.getAttribute('href');
        if (href) {
          const a = document.createElement('a');
          a.href = href;
          a.tabIndex = -1;
          a.setAttribute('aria-hidden', 'true');
          a.append(pic);
          cell.replaceChildren(a);
        }
      } else {
        decorateBody(cell);
      }
      li.append(cell);
    });
    track.append(li);
  });
  el.replaceChildren(track);
  // Rows with no price/rating/CTA (e.g. "Find Your Perfect Product") are
  // plain image tiles: a static grid rather than a paged product rail.
  const isProducts = !!track.querySelector('.cards-price, .cards-rating, .cards-cta');
  if (isProducts) {
    buildPager(el, track, 'products');
    // eslint-disable-next-line no-use-before-define
    connectCommerce(track);
  } else {
    el.classList.add('cards-tiles');
  }
}
