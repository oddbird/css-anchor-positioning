import { type StyleData } from './utils.js';

export async function transformCSS(
  styleData: StyleData[],
  inlineStyles?: Map<HTMLElement, Record<string, string>>,
  cleanup = false,
) {
  const updatedStyleData: StyleData[] = [];
  for (const { el, css, changed } of styleData) {
    const updatedObject: StyleData = { el, css, changed: false };
    if (changed) {
      if (el.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el instanceof HTMLLinkElement) {
        // Create new link
        const blob = new Blob([css], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.id = el.id;
        link.media = el.media;
        link.title = el.title;
        const promise = new Promise((res) => {
          link.onload = res;
        });
        el.insertAdjacentElement('afterend', link);
        // Wait for new stylesheet to be loaded
        await promise;
        el.remove();
        URL.revokeObjectURL(url);
        updatedObject.el = link;
      } else if (el.hasAttribute('data-has-inline-styles')) {
        // Handle inline styles
        const attr = el.getAttribute('data-has-inline-styles');
        if (attr) {
          const pre = `[data-has-inline-styles="${attr}"]{`;
          const post = `}`;
          let styles = css.slice(pre.length, 0 - post.length);
          // Check for custom anchor-element mapping, so it is not overwritten
          // when inline styles are updated
          const mappings = inlineStyles?.get(el);
          if (mappings) {
            for (const [key, val] of Object.entries(mappings)) {
              styles = `${key}: var(${val}); ${styles}`;
            }
          }
          el.setAttribute('style', styles);
        }
      }
    }
    // Remove no-longer-needed data-attribute
    if (cleanup && el.hasAttribute('data-has-inline-styles')) {
      el.removeAttribute('data-has-inline-styles');
    }
    updatedStyleData.push(updatedObject);
  }
  return updatedStyleData;
}
