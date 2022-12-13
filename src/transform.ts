import { type StyleData } from './fetch.js';

export function transformCSS(styleData: StyleData[]) {
  styleData.forEach(({ el, css, changed }) => {
    if (!changed) {
      return;
    }
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
      const pre = `[data-anchor-polyfill="${attr}"]{`;
      const post = `}`;
      const inlineStyles = css.slice(pre.length, 0 - post.length);
      el.setAttribute('style', inlineStyles);
    }
  });
}
