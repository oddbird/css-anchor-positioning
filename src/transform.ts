import { type StyleData } from './utils.js';

const excludeAttributes = [
  'crossorigin',
  'href',
  'integrity',
  'referrerpolicy',
];

export async function transformCSS(
  styleData: StyleData[],
  inlineStyles?: Map<HTMLElement, Record<string, string>>,
  cleanup = false,
) {
  const updatedStyleData: StyleData[] = [];
  for (const { el, css, changed, created = false } of styleData) {
    const updatedObject: StyleData = { el, css, changed: false };
    if (changed) {
      if (el.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el instanceof HTMLLinkElement) {
        // Create new link
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        for (const name of el.getAttributeNames()) {
          if (!name.startsWith('on') && !excludeAttributes.includes(name)) {
            const attr = el.getAttribute(name);
            if (attr !== null) {
              styleEl.setAttribute(name, attr);
            }
          }
        }
        if (!created) {
          // This is an existing stylesheet, so we replace it.
          el.insertAdjacentElement('beforebegin', styleEl);
          // Wait for new stylesheet to be loaded
          el.remove();
        } else {
          // This is a new stylesheet, so we append it.
          document.head.insertAdjacentElement('beforeend', styleEl);
          // Wait for new stylesheet to be loaded
        }
        updatedObject.el = styleEl;
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
