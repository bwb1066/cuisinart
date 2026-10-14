import store, { setThumb } from '../../scripts/commerce.js';

/**
 * quote-cart — the draft-quote (B2B cart) drawer. Placing this block on a page
 * activates the commerce cart: it hydrates the header's .nav-cart-count badge,
 * opens an off-canvas quote drawer, and lets the buyer adjust quantities
 * (re-priced live on volume breaks) and submit a quote request. No payment is
 * taken — the merchant confirms pricing and terms, matching the B2B model.
 *
 * The block has no authored inputs; its inline footprint is hidden.
 * @param {Element} block The block element
 */

const L = store.labels;
let drawer = null;
let panel = null;

function setBadges(count) {
  document.querySelectorAll('.nav-cart-count').forEach((el) => {
    el.textContent = count;
    el.closest('a, button')?.classList.toggle('has-items', count > 0);
  });
}

function leadRollup(quote) {
  return quote.lines.reduce((max, l) => Math.max(max, l.lead_time_days || 0), 0);
}

function lineRow(line) {
  const row = document.createElement('div');
  row.className = 'quote-cart-line';
  row.dataset.sku = line.sku;
  const lead = line.lead_time_days > 0
    ? `<span class="quote-cart-lead">${line.lead_time_days}-day lead</span>` : '';
  row.innerHTML = `
    <img class="quote-cart-thumb" alt="" loading="lazy">
    <div class="quote-cart-info">
      <p class="quote-cart-name">${line.name}</p>
      <p class="quote-cart-meta">Item #${line.sku} · ${store.formatPrice(line.unit_price)} ea ${lead}</p>
      <div class="quote-cart-qty">
        <button type="button" class="quote-cart-step" data-step="-1" aria-label="Decrease quantity">−</button>
        <span class="quote-cart-qval">${line.qty}</span>
        <button type="button" class="quote-cart-step" data-step="1" aria-label="Increase quantity">+</button>
        <button type="button" class="quote-cart-remove" aria-label="Remove line">Remove</button>
      </div>
    </div>
    <p class="quote-cart-line-total">${store.formatPrice(line.qty * line.unit_price)}</p>`;

  row.querySelectorAll('.quote-cart-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.step, 10);
      store.setLineQty(line.sku, line.qty + delta);
    });
  });
  row.querySelector('.quote-cart-remove').addEventListener('click', () => store.removeLine(line.sku));
  setThumb(row.querySelector('.quote-cart-thumb'), line.image_url);
  return row;
}

function renderPanel() {
  const quote = store.getQuote();
  const buyer = store.getBuyer();
  panel.replaceChildren();

  const head = document.createElement('div');
  head.className = 'quote-cart-head';
  head.innerHTML = `<h2 class="quote-cart-title">${L.cart}</h2>`
    + `<button type="button" class="quote-cart-close" aria-label="${L.close}">×</button>`;
  head.querySelector('.quote-cart-close').addEventListener('click', () => drawer.classList.remove('is-open'));
  panel.append(head);

  if (buyer) {
    const banner = document.createElement('p');
    banner.className = 'quote-cart-buyer';
    banner.textContent = `${L.buyer} · ${buyer.company || buyer.key}`;
    panel.append(banner);
  }

  if (!quote.lines.length) {
    const empty = document.createElement('p');
    empty.className = 'quote-cart-empty';
    empty.textContent = L.empty;
    panel.append(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'quote-cart-list';
  quote.lines.forEach((l) => list.append(lineRow(l)));
  panel.append(list);

  const foot = document.createElement('div');
  foot.className = 'quote-cart-foot';
  const lead = leadRollup(quote);
  foot.innerHTML = `
    <div class="quote-cart-subtotal">
      <span>${L.subtotal}</span>
      <strong>${store.formatPrice(store.quoteTotal(quote))}</strong>
    </div>
    <p class="quote-cart-leadnote">${lead > 0 ? L.lead(lead) : L.inStock}</p>
    <textarea class="quote-cart-note" rows="2" placeholder="${L.note}"></textarea>
    <button type="button" class="quote-cart-submit">${L.submit}</button>
    <p class="quote-cart-terms">${L.terms}</p>`;

  foot.querySelector('.quote-cart-submit').addEventListener('click', async () => {
    const note = foot.querySelector('.quote-cart-note').value;
    const submitted = await store.submitQuote(note);
    panel.replaceChildren();
    const done = document.createElement('div');
    done.className = 'quote-cart-done';
    done.innerHTML = `<h2 class="quote-cart-title">${L.doneTitle}</h2>
      <p>${L.doneBody(submitted.quote_number)}</p>
      <button type="button" class="quote-cart-close-2">Done</button>`;
    done.querySelector('.quote-cart-close-2').addEventListener('click', () => drawer.classList.remove('is-open'));
    panel.append(done);
  });
  panel.append(foot);
}

function openDrawer() {
  renderPanel();
  drawer.classList.add('is-open');
}

function buildDrawer() {
  drawer = document.createElement('div');
  drawer.className = 'quote-cart-drawer';
  const backdrop = document.createElement('div');
  backdrop.className = 'quote-cart-backdrop';
  backdrop.addEventListener('click', () => drawer.classList.remove('is-open'));
  panel = document.createElement('aside');
  panel.className = 'quote-cart-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', L.cart);
  drawer.append(backdrop, panel);
  document.body.append(drawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') drawer.classList.remove('is-open');
  });
}

/** Attach the drawer opener to the header cart link once it exists. */
function wireHeaderCart() {
  const badge = document.querySelector('.nav-cart-count');
  const link = badge?.closest('a, button');
  if (link && !link.dataset.quoteWired) {
    link.dataset.quoteWired = 'true';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openDrawer();
    });
  }
  return !!link;
}

export default function decorate(block) {
  block.style.display = 'none';
  buildDrawer();

  const sync = () => {
    setBadges(store.quoteCount(store.getQuote()));
    if (drawer.classList.contains('is-open')) renderPanel();
  };
  store.subscribe(sync);

  // The header loads lazily; wire the badge/link as soon as it appears.
  if (!wireHeaderCart()) {
    const obs = new MutationObserver(() => {
      if (wireHeaderCart()) {
        setBadges(store.quoteCount(store.getQuote()));
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  setBadges(store.quoteCount(store.getQuote()));
}
