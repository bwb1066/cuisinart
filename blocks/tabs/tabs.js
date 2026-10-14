import { loadBlock } from '../../scripts/ak.js';

/**
 * A table pasted inside a cell (e.g. a `cards` table inside a tab) arrives as
 * a raw <table>: the pipeline only turns top-level tables into blocks. Rebuild
 * it as block markup — first row = block name (+ variants), remaining rows =
 * the block's rows — and decorate it.
 */
function nestedTableToBlock(table) {
  const rows = [...table.querySelectorAll(':scope > tbody > tr, :scope > tr')];
  const head = rows.shift();
  const name = head?.textContent.trim().toLowerCase() || '';
  const match = name.match(/^([a-z0-9-]+)\s*(?:\((.*)\))?$/);
  if (!match) return null;
  const block = document.createElement('div');
  block.classList.add(match[1], ...(match[2] || '').split(',').map((v) => v.trim().replace(/\s+/g, '-')).filter(Boolean));
  rows.forEach((tr) => {
    const row = document.createElement('div');
    [...tr.children].forEach((td) => {
      const cell = document.createElement('div');
      cell.append(...td.childNodes);
      row.append(cell);
    });
    block.append(row);
  });
  table.replaceWith(block);
  return block;
}

let tabsId = 0;

/**
 * tabs — one row per tab: | label | panel content |
 * @param {Element} el The block element
 */
export default async function init(el) {
  tabsId += 1;
  const rows = [...el.querySelectorAll(':scope > div')];
  const list = document.createElement('div');
  list.className = 'tabs-list';
  list.setAttribute('role', 'tablist');
  const panels = document.createElement('div');
  panels.className = 'tabs-panels';

  const tabs = rows.map((row, i) => {
    const [labelCell, contentCell] = row.children;
    const id = `tabs-${tabsId}-${i + 1}`;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tabs-tab';
    tab.id = `${id}-tab`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${id}-panel`);
    tab.textContent = labelCell?.textContent.trim() || `Tab ${i + 1}`;

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `${id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    if (contentCell) panel.append(...contentCell.childNodes);

    list.append(tab);
    panels.append(panel);
    return { tab, panel };
  });

  const select = (idx, focus = false) => {
    tabs.forEach(({ tab, panel }, i) => {
      const on = i === idx;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    if (focus) tabs[idx].tab.focus();
  };

  tabs.forEach(({ tab }, i) => tab.addEventListener('click', () => select(i)));
  list.addEventListener('keydown', (e) => {
    const cur = tabs.findIndex(({ tab }) => tab === document.activeElement);
    if (cur < 0) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) select((cur + step + tabs.length) % tabs.length, true);
    if (e.key === 'Home') select(0, true);
    if (e.key === 'End') select(tabs.length - 1, true);
  });

  el.replaceChildren(list, panels);
  select(0);

  const nested = [...panels.querySelectorAll('table')].map(nestedTableToBlock).filter(Boolean);
  await Promise.all(nested.map((block) => loadBlock(block)));
}
