/**
 * Horizontal rail paging: prev/next arrows + one dot per "page" of a
 * scroll-snapping track. Shared by the cards and carousel blocks.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const ARROW = 'M15 5l-7 7 7 7';

function arrow() {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', ARROW);
  s.append(p);
  return s;
}

export default function buildPager(el, track, label = 'items') {
  const nav = document.createElement('div');
  nav.className = 'rail-pager';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'rail-arrow rail-prev';
  prev.setAttribute('aria-label', `Previous ${label}`);
  prev.append(arrow());
  const next = prev.cloneNode(true);
  next.className = 'rail-arrow rail-next';
  next.setAttribute('aria-label', `Next ${label}`);
  const dots = document.createElement('div');
  dots.className = 'rail-dots';
  nav.append(prev, dots, next);

  const page = () => track.clientWidth;
  const pages = () => Math.max(1, Math.ceil((track.scrollWidth - 4) / page()));
  const current = () => Math.round(track.scrollLeft / page());
  const go = (i) => track.scrollTo({ left: i * page(), behavior: 'smooth' });

  const sync = () => {
    const n = pages();
    if (dots.children.length !== n) {
      dots.replaceChildren(...Array.from({ length: n }, (_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', `Page ${i + 1} of ${n}`);
        d.addEventListener('click', () => go(i));
        return d;
      }));
    }
    const c = current();
    [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === c));
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + page() >= track.scrollWidth - 2;
    nav.hidden = n < 2;
  };

  prev.addEventListener('click', () => go(Math.max(0, current() - 1)));
  next.addEventListener('click', () => go(current() + 1));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  new ResizeObserver(sync).observe(track);
  el.append(nav);
}
