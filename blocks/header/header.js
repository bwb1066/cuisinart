import { getConfig, getMetadata, loadBlock } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import store from '../../scripts/commerce.js';
import { SPARKLE_SVG } from '../../scripts/sparkle-icon.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';
const SVG_NS = 'http://www.w3.org/2000/svg';

// Stroke icons, keyed by the authored utility link text.
const ICONS = {
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zm5.3-2.2L21 21',
  login: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0',
  cart: 'M5 8h14l-1.2 12H6.2L5 8zm4 0V6.5a3 3 0 0 1 6 0V8',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M5 5l14 14M19 5L5 19',
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('header-icon', `header-icon-${name}`);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/* ---------- menus ---------- */

function closeAllMenus(header) {
  header.querySelectorAll('.main-nav-item.is-open').forEach((li) => {
    li.classList.remove('is-open');
    li.querySelector(':scope > .main-nav-link')?.setAttribute('aria-expanded', 'false');
  });
}

function toggleMenu(header, li) {
  const open = li.classList.contains('is-open');
  closeAllMenus(header);
  if (open) return;
  li.classList.add('is-open');
  li.querySelector(':scope > .main-nav-link')?.setAttribute('aria-expanded', 'true');
}

/**
 * One top-level nav item. Authored as `<li><p>[link|text]</p><ul>…</ul></li>`;
 * an item with a sub-list becomes a disclosure button + dropdown panel. A
 * sub-list whose items carry their own lists (Shop) is a category mega menu;
 * a long flat list (Parts & Accessories) flows into columns.
 */
let menuId = 0;
function decorateNavItem(header, li) {
  li.classList.add('main-nav-item');
  const label = li.querySelector(':scope > p') || li.firstElementChild;
  const link = label?.querySelector('a');
  const list = li.querySelector(':scope > ul');

  if (!list) {
    const a = link || document.createElement('a');
    a.className = 'main-nav-link';
    if (!link) a.textContent = label?.textContent.trim() || '';
    label?.replaceWith(a);
    return;
  }

  menuId += 1;
  const panel = document.createElement('div');
  panel.className = 'nav-menu';
  panel.id = `nav-menu-${menuId}`;
  const inner = document.createElement('div');
  inner.className = 'nav-menu-inner';

  const isMega = !!list.querySelector(':scope > li > ul');
  list.className = isMega ? 'nav-menu-categories' : 'nav-menu-links';
  if (!isMega && list.children.length > 12) list.classList.add('is-long');
  list.querySelectorAll(':scope > li').forEach((cat) => {
    const catLink = cat.querySelector(':scope > p > a');
    if (isMega && catLink) {
      catLink.classList.add('nav-menu-heading');
      cat.querySelector(':scope > p').replaceWith(catLink);
    }
  });
  // "Help me choose…" quiz links get the small bold treatment.
  list.querySelectorAll('a').forEach((a) => {
    if (/^help me choose/i.test(a.textContent.trim())) a.classList.add('nav-menu-help');
  });

  inner.append(list);
  panel.append(inner);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'main-nav-link';
  btn.textContent = label?.textContent.trim() || '';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', panel.id);
  btn.addEventListener('click', () => toggleMenu(header, li));
  label?.replaceWith(btn);
  li.append(panel);
}

function buildNav(header, section) {
  const list = section?.querySelector('ul');
  if (!list) return null;
  const nav = document.createElement('nav');
  nav.className = 'header-nav';
  nav.setAttribute('aria-label', 'Main');
  list.className = 'main-nav-list';
  [...list.children].forEach((li) => decorateNavItem(header, li));
  nav.append(list);
  return nav;
}

/* ---------- brand / search / actions ---------- */

function buildBrand(section) {
  const brand = document.createElement('a');
  brand.className = 'header-brand';
  brand.href = '/';
  brand.setAttribute('aria-label', 'Cuisinart home');
  const pic = section?.querySelector('picture, img');
  if (pic) {
    const img = pic.querySelector('img') || pic;
    img.loading = 'eager';
    img.alt = '';
    brand.append(pic);
  } else {
    brand.textContent = 'Cuisinart';
  }
  return brand;
}

function buildSearch() {
  const form = document.createElement('form');
  form.className = 'header-search';
  form.setAttribute('role', 'search');
  // WebMCP: lets AI agents call the search form as a tool.
  form.setAttribute('toolname', 'search_or_ask');
  form.setAttribute('tooldescription', 'Search Cuisinart products or ask Hollis, the Cuisinart concierge, a question. Opens the concierge with the answer.');
  form.innerHTML = '<label><span class="a11y">Search</span><input type="search" name="q" placeholder="Search or ask Hollis" autocomplete="off" toolparamdescription="A product search or a question, e.g. best coffee maker for a small kitchen"></label>';
  form.querySelector('label').prepend(icon('search'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.q.value.trim();
    if (!q) return;
    form.q.value = '';
    // Search is answered by the Brand Concierge (catalog-grounded), not a SERP.
    import('../../scripts/brand-concierge-trigger.js').then(({ default: open }) => open(q));
  });
  return form;
}

// Load the quote-cart drawer on demand, so the header cart works on every
// page without authoring the block. quote-cart's decorate() finds
// `.nav-cart-count`, marks its link `data-quote-wired` and opens the drawer.
let cartLoading = null;
function loadCartDrawer() {
  if (!cartLoading) {
    const block = document.createElement('div');
    block.className = 'quote-cart';
    document.body.append(block);
    cartLoading = loadBlock(block);
  }
  return cartLoading;
}

// Cart badge, kept in sync with the commerce store on every page. The first
// click loads the drawer, then replays the click so quote-cart opens it.
function wireCart(a, count) {
  const sync = (quote) => {
    const n = store.quoteCount(quote);
    count.textContent = n;
    a.classList.toggle('has-items', n > 0);
  };
  store.subscribe(sync);
  sync(store.getQuote());
  a.addEventListener('click', async (e) => {
    if (a.dataset.quoteWired) return; // quote-cart's own handler opens it
    e.preventDefault();
    await loadCartDrawer();
    if (a.dataset.quoteWired) a.click();
  });
}

// "Ask Hollis" — Brand Concierge trigger, first in the utility row.
function conciergeAction() {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'header-action header-action-concierge';
  btn.innerHTML = `${SPARKLE_SVG}<span class="a11y">Ask Hollis</span>`;
  btn.querySelector('svg').classList.add('header-icon');
  btn.addEventListener('click', async () => {
    const { default: open } = await import('../../scripts/brand-concierge-trigger.js');
    open();
  });
  li.append(btn);
  return li;
}

function buildActions(section) {
  const list = section?.querySelector('ul') || document.createElement('ul');
  list.className = 'header-actions';
  list.querySelectorAll('a').forEach((a) => {
    const key = a.textContent.trim().toLowerCase();
    if (!ICONS[key]) return;
    const text = document.createElement('span');
    text.className = 'a11y';
    text.textContent = a.textContent.trim();
    a.className = `header-action header-action-${key}`;
    a.replaceChildren(icon(key), text);
    if (key === 'cart') {
      const count = document.createElement('span');
      count.className = 'cart-count nav-cart-count';
      count.textContent = '0';
      a.append(count);
      wireCart(a, count);
    }
    const p = a.closest('p');
    if (p) p.replaceWith(a);
  });
  list.prepend(conciergeAction());
  return list;
}

function buildToggle(header) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'header-toggle';
  btn.setAttribute('aria-label', 'Open menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.append(icon('menu'), icon('close'));
  btn.addEventListener('click', () => {
    const open = header.classList.toggle('is-mobile-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);
  });
  return btn;
}

/**
 * loads and decorates the header
 * @param {Element} el The header element
 */
export default async function init(el) {
  // `header` metadata is the block name (ak.js); the fragment path is its own key.
  const path = getMetadata('header-path') || HEADER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  const [brandSection, navSection, actionSection] = fragment.querySelectorAll(':scope > .section');

  const bar = document.createElement('div');
  bar.className = 'header-bar';
  bar.append(buildToggle(el), buildBrand(brandSection), buildSearch(), buildActions(actionSection));

  const content = document.createElement('div');
  content.className = 'header-content';
  content.append(bar);
  const nav = buildNav(el, navSection);
  if (nav) content.append(nav);
  el.append(content);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.main-nav-item')) closeAllMenus(el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = el.querySelector('.main-nav-item.is-open > .main-nav-link');
    closeAllMenus(el);
    open?.focus();
  });
}
