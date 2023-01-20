import { type StyleData } from './fetch.js';

export function transformCSS(
  styleData: StyleData[],
  inlineStyles?: Map<HTMLElement, Record<string, string>>,
) {
  styleData.forEach(({ el, css, changed }) => {
    if (changed) {
      if (el.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el.tagName.toLowerCase() === 'link') {
        // Handle linked stylesheets
        const blob = new Blob([css], { type: 'text/css' });
        (el as HTMLLinkElement).href = URL.createObjectURL(blob);
      } else if (el.hasAttribute('data-anchor-polyfill')) {
        // Handle inline styles
        const attr = el.getAttribute('data-anchor-polyfill');
        if (attr) {
          const pre = `[data-anchor-polyfill="${attr}"]{`;
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
    if (el.hasAttribute('data-anchor-polyfill')) {
      el.removeAttribute('data-anchor-polyfill');
    }
  });
}
