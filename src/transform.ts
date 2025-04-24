import { type StyleData } from './utils.js';

// This is a list of non-global attributes that apply to link elements but do
// not apply to style elements. These should be removed when converting from a
// link element to a style element. These mostly define loading behavior, which
// is not relevant to style elements or our use case.
const excludeAttributes = [
  'as',
  'blocking',
  'crossorigin',
  // 'disabled' is not relevant for style elements, but this exclusion is
  // theoretical, as a <link rel=stylesheet disabled> will not be loaded, and
  // will not reach this part of the polyfill. See #246.
  'disabled',
  'fetchpriority',
  'href',
  'hreflang',
  'integrity',
  'referrerpolicy',
  'rel',
  'type',
];

export function transformCSS(
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
        // Replace link elements with style elements We use inline style
        // elements rather link elements with blob URLs, as relative URLs for
        // things like images and fonts are not supported in blob URLs. See
        // https://github.com/oddbird/css-anchor-positioning/pull/324 for more
        // discussion.
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
        // Persist the href attribute to help with potential debugging.
        if (el.hasAttribute('href')) {
          styleEl.setAttribute('data-original-href', el.getAttribute('href')!);
        }
        if (!created) {
          // This is an existing stylesheet, so we replace it.
          el.insertAdjacentElement('beforebegin', styleEl);
          el.remove();
        } else {
          styleEl.setAttribute('data-generated-by-polyfill', 'true');
          // This is a new stylesheet, so we append it.
          document.head.insertAdjacentElement('beforeend', styleEl);
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
