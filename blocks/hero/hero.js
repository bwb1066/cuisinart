function setBackgroundFocus(img) {
  const { title } = img.dataset;
  if (!title?.includes('data-focal')) return;
  delete img.dataset.title;
  const [x, y] = title.split(':')[1].split(',');
  img.style.objectPosition = `${x}% ${y}%`;
}

function decorateBackground(bg) {
  const bgPic = bg.querySelector('picture');
  if (!bgPic) return;

  const img = bgPic.querySelector('img');
  setBackgroundFocus(img);

  const vidLink = bgPic.closest('a[href*=".mp4"]');
  if (!vidLink) return;
  const video = document.createElement('video');
  video.src = vidLink.href;
  video.loop = true;
  video.muted = true;
  video.inert = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.load();
  video.addEventListener('canplay', () => {
    video.play();
    bgPic.remove();
  });
  vidLink.parentElement.append(video, bgPic);
  vidLink.remove();
}

function decorateForeground(fg) {
  const { children } = fg;
  for (const [idx, child] of [...children].entries()) {
    const heading = child.querySelector('h1, h2, h3, h4, h5, h6');
    const text = heading || child.querySelector('p, a, ul');
    if (heading) {
      heading.classList.add('hero-heading');
      const detail = heading.previousElementSibling;
      if (detail) {
        detail.classList.add('hero-detail');
      }
    }
    // Determine foreground column types
    if (text) {
      child.classList.add('fg-text');
      if (idx === 0) {
        child.closest('.hero').classList.add('hero-text-start');
      } else {
        child.closest('.hero').classList.add('hero-text-end');
      }
    }
  }
}

/**
 * A one-row hero authored with its image as the first paragraph of the text
 * cell (common in migrated content) is really a background image: lift it into
 * its own background row so it fills the hero instead of sitting inline.
 */
function liftInlineBackground(el, fg) {
  const firstCell = fg.querySelector(':scope > div');
  const first = firstCell?.firstElementChild;
  const pic = first?.tagName === 'P' && first.children.length === 1 && first.querySelector(':scope > picture');
  if (!pic || first.textContent.trim()) return null;
  const bg = document.createElement('div');
  const cell = document.createElement('div');
  cell.append(pic);
  bg.append(cell);
  first.remove();
  el.prepend(bg);
  return bg;
}

function decorateSplit(fg) {
  for (const cell of fg.children) {
    const pic = cell.querySelector('picture');
    if (pic && !cell.querySelector('h1, h2, h3, h4, h5, h6, p:not(:has(> picture))')) {
      cell.classList.add('fg-media');
      setBackgroundFocus(pic.querySelector('img'));
    }
  }
}

export default async function init(el) {
  const rows = [...el.querySelectorAll(':scope > div')];
  const fg = rows.pop();
  if (!rows.length && !el.classList.contains('split')) {
    const lifted = liftInlineBackground(el, fg);
    if (lifted) rows.push(lifted);
  }
  if (el.classList.contains('split')) decorateSplit(fg);
  fg.classList.add('hero-foreground');
  decorateForeground(fg);
  if (rows.length) {
    const bg = rows.pop();
    bg.classList.add('hero-background');
    decorateBackground(bg);
  }
}
