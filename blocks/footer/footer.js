import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import SOCIAL from './social-icons.js';

const FOOTER_PATH = '/fragments/nav/footer';
const SVG_NS = 'http://www.w3.org/2000/svg';

function socialIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', SOCIAL[name]);
  svg.append(path);
  return svg;
}

/** Group each heading with the list that follows it into a column. */
function buildColumns(section) {
  const content = section.querySelector('.default-content') || section;
  const cols = document.createElement('div');
  cols.className = 'footer-columns';
  let col;
  [...content.children].forEach((child) => {
    if (/^H[1-6]$/.test(child.tagName) || !col) {
      col = document.createElement('div');
      col.className = 'footer-column';
      cols.append(col);
    }
    col.append(child);
  });
  // Social links render as icon buttons, labelled by their authored text.
  cols.querySelectorAll('a').forEach((a) => {
    const name = Object.keys(SOCIAL).find((n) => a.hostname.includes(n));
    if (!name) return;
    a.setAttribute('aria-label', a.textContent.trim());
    a.replaceChildren(socialIcon(name));
    a.closest('ul')?.classList.add('footer-social');
  });
  content.replaceChildren(cols);
}

/**
 * loads and decorates the footer
 * @param {Element} el The footer element
 */
export default async function init(el) {
  const { locale } = getConfig();
  // `footer` metadata is the block name (utils/footer.js); the path is its own key.
  const path = getMetadata('footer-path') || FOOTER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  fragment.classList.add('footer-content');

  const sections = [...fragment.querySelectorAll(':scope > .section')];
  // Tolerate minimal footers: one section is just the legal bar, none is empty.
  const legal = sections.length > 1 ? sections.pop() : null;
  legal?.classList.add('section-legal');
  sections.forEach((s) => {
    s.classList.add('section-links');
    buildColumns(s);
  });

  el.append(fragment);
}
