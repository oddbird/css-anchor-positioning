import { POLYFILLED_STYLE_ATTRIBUTE } from './cascade.js';
import type { AnchorPositioningRoot } from './polyfill.js';
import {
  getRootStyleContainer,
  type StyleData,
  writeAdoptedStylesheet,
} from './utils.js';

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
  roots?: AnchorPositioningRoot[],
) {
  const updatedStyleData: StyleData[] = [];
  for (const { el, css, changed, created = false, sheet } of styleData) {
    const updatedObject: StyleData = { el, css, changed: false, sheet };
    if (changed) {
      if (sheet) {
        // Handle constructed stylesheets adopted via `adoptedStyleSheets`.
        // Write the transformed CSS into a polyfill-owned copy of the sheet (so
        // a sheet shared across roots isn't clobbered), swapping it into every
        // adopting root in this run, and track that copy.
        updatedObject.sheet = writeAdoptedStylesheet(sheet, css, roots);
      } else if (el?.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el instanceof HTMLLinkElement) {
        // Replace link elements with style elements.
        // We use inline style elements rather than link elements with blob
        // URLs, as relative URLs for things like images and fonts are not
        // supported in blob URLs. See
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
          styleEl.setAttribute(POLYFILLED_STYLE_ATTRIBUTE, 'true');
          // This is a new stylesheet (the position-area mapping styles). Its
          // rules target wrapper elements that live inside the roots being
          // polyfilled, so it must be inserted into each of those roots: a
          // `<style>` in `document.head` does not apply inside a shadow root.
          const containers = new Set(
            (roots?.length ? roots : [document]).map(getRootStyleContainer),
          );
          for (const container of containers) {
            // If there are multiple roots, clone the element for each root
            const node = styleEl.isConnected
              ? styleEl
              : styleEl.cloneNode(true);
            container.append(node);
          }
        }
        updatedObject.el = styleEl;
      } else if (el?.hasAttribute('data-has-inline-styles')) {
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
          // Preserve any `--anchor-*` mappings a concurrently-running polyfill
          // added to this element after this run captured its inline styles, so
          // we don't clobber another run's target. Read the *current* value here
          // (not the text captured at fetch time) so late writes are kept.
          const preserved = (el.getAttribute('style') ?? '')
            .split(';')
            .map((decl) => decl.trim())
            .filter((decl) => {
              const prop = decl.slice(0, decl.indexOf(':')).trim();
              return (
                prop.startsWith('--anchor-') && !styles.includes(`${prop}:`)
              );
            });
          if (preserved.length) {
            styles = `${preserved.join('; ')}; ${styles}`;
          }
          el.setAttribute('style', styles);
        }
      }
    }
    // Note: `data-has-inline-styles` is intentionally left in place. The id is
    // reused across runs (see `fetchInlineStyles`) so concurrent runs share a
    // stable selector for the element; removing it would let a later run mint a
    // new id and invalidate another run's anchor selector.
    updatedStyleData.push(updatedObject);
  }
  return updatedStyleData;
}
