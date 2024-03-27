import { INLINE_STYLES_ID_ATTR } from './constants.js';
import { type StyleData } from './fetch.js';

export async function replaceLink(
  el: HTMLLinkElement,
  contents: string,
  url?: URL,
) {
  // Create new link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  let blobUrl;
  if (url) {
    link.href = url.toString();
  } else {
    const blob = new Blob([contents], { type: 'text/css' });
    blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
  }
  const promise = new Promise((res) => {
    link.onload = res;
  });
  el.replaceWith(link);
  // Wait for new stylesheet to be loaded
  await promise;
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
  }
  return link;
}

export async function transformCSS(
  styleData: StyleData[],
  inlineStyles?: Map<HTMLElement, Record<string, string>>,
) {
  styleData.forEach(async (data) => {
    const { el, css, changed } = data;
    if (changed) {
      if (el.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el.tagName.toLowerCase() === 'link') {
        data.el = await replaceLink(el as HTMLLinkElement, css);
      } else if (el.hasAttribute(INLINE_STYLES_ID_ATTR)) {
        // Handle inline styles
        const attr = el.getAttribute(INLINE_STYLES_ID_ATTR);
        if (attr) {
          const pre = `[${INLINE_STYLES_ID_ATTR}="${attr}"]{`;
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
    if (el.hasAttribute(INLINE_STYLES_ID_ATTR)) {
      el.removeAttribute(INLINE_STYLES_ID_ATTR);
    }
  });
}
