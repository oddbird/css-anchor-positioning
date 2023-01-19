import { type StyleData } from './fetch.js';

export function transformCSS(styleData: StyleData[]) {
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
          // Check for custom anchor-element mapping, so it is not overwritten
          // when inline styles are updated
          const mapping = el.getAttribute('data-anchor-polyfill-mapping');
          const pre = `[data-anchor-polyfill="${attr}"]{`;
          const post = `}`;
          const inlineStyles = css.slice(pre.length, 0 - post.length);
          el.setAttribute('style', `${mapping ?? ''} ${inlineStyles}`);
        }
      }
    }
    // Remove no-longer-needed data-attributes
    if (el.hasAttribute('data-anchor-polyfill')) {
      el.removeAttribute('data-anchor-polyfill');
    }
    if (el.hasAttribute('data-anchor-polyfill-mapping')) {
      el.removeAttribute('data-anchor-polyfill-mapping');
    }
  });
}
