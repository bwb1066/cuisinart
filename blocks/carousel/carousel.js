import buildPager from '../../scripts/utils/rail.js';

/**
 * carousel — a snap-scrolling rail with arrow + dot paging. One row per slide.
 *   default : image-only slides (e.g. the #aworkofcuisinart social feed)
 *   recipes : | image | linked title |  → horizontal recipe cards
 * @param {Element} el The block element
 */
export default function init(el) {
  const isRecipes = el.classList.contains('recipes');
  const track = document.createElement('ul');
  track.className = 'carousel-track';

  [...el.querySelectorAll(':scope > div')].forEach((row) => {
    // Drop broken placeholder images left by migration (src="about:error").
    row.querySelectorAll('img[src^="about:"]').forEach((img) => (img.closest('p') || img).remove());
    const slide = document.createElement('li');
    slide.className = 'carousel-slide';
    const pic = row.querySelector('picture');
    const link = row.querySelector('a');

    if (isRecipes) {
      const title = document.createElement('p');
      title.className = 'carousel-title';
      if (link) title.append(link);
      const media = document.createElement('div');
      media.className = 'carousel-media';
      if (pic) media.append(pic);
      slide.append(title, media);
      // Whole card is the click target; the title link stays the accessible one.
      if (link) slide.addEventListener('click', (e) => { if (!e.target.closest('a')) link.click(); });
    } else {
      slide.append(...[...row.children].flatMap((cell) => [...cell.childNodes]));
    }
    track.append(slide);
  });

  el.replaceChildren(track);
  buildPager(el, track, isRecipes ? 'recipes' : 'slides');
}
