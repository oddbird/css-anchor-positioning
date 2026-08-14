import { nanoid } from 'nanoid/non-secure';

import { POLYFILLED_STYLE_ATTRIBUTE, SHIFTED_PROPERTIES } from './cascade.js';
import { querySelectorAllRoots } from './dom.js';
import {
  type AnchorPositioningRoot,
  type NormalizedAnchorPositioningPolyfillOptions,
} from './polyfill.js';
import { getAdoptedStylesheetText, type StyleData } from './utils.js';

const INVALID_MIME_TYPE_ERROR = 'InvalidMimeType';

export function isStyleLink(link: HTMLLinkElement): link is HTMLLinkElement {
  return Boolean(
    (link.type === 'text/css' || link.rel === 'stylesheet') && link.href,
  );
}

function getStylesheetUrl(link: HTMLLinkElement): URL | undefined {
  const srcUrl = new URL(link.href, document.baseURI);
  if (isStyleLink(link) && srcUrl.origin === location.origin) {
    return srcUrl;
  }
}

async function fetchLinkedStylesheets(
  sources: Partial<StyleData>[],
): Promise<StyleData[]> {
  const results = await Promise.all(
    sources.map(async (data) => {
      if (!data.url) {
        return data as StyleData;
      }
      // TODO: Add MutationObserver to watch for disabled links being enabled
      // https://github.com/oddbird/css-anchor-positioning/issues/246
      if ((data.el as HTMLLinkElement | undefined)?.disabled) {
        // Do not fetch or parse disabled stylesheets
        return null;
      }
      // fetch css and add to array
      try {
        const response = await fetch(data.url.toString());
        const type = response.headers.get('content-type');
        if (!type?.startsWith('text/css')) {
          const error = new Error(
            `Error loading ${data.url}: expected content-type "text/css", got "${type}".`,
          );
          error.name = INVALID_MIME_TYPE_ERROR;
          throw error;
        }
        const css = await response.text();
        return { ...data, css } as StyleData;
      } catch (error) {
        if (error instanceof Error && error.name === INVALID_MIME_TYPE_ERROR) {
          // eslint-disable-next-line no-console
          console.warn(error);
          return null;
        }
        throw error;
      }
    }),
  );
  return results.filter((loaded) => loaded !== null);
}

// Inline styles are collected so that `cascadeCSS` can shift their declarations
// into custom properties, like it does for the rest of the CSS. That has to
// cover every property the polyfill later reads back through
// `getCSSPropertyValue` — insets, margins, sizing, padding, self-alignment,
// `position-area` — and not just the anchor-specific ones: a target can take
// its `position-area` from a stylesheet while setting its margin inline.
// `anchor` is matched on its own as well, for `anchor()`/`anchor-size()` values.
//
// Matching tests the `style` attribute against a single regex rather than
// handing `querySelectorAll` one `[style*="..."]` clause per property. Engines
// do not bucket attribute-substring selectors by attribute presence, so a
// ~50-clause query runs every substring test against every element in the
// document; querying `[style]` and filtering here is an order of magnitude
// faster, and scales with the number of styled elements rather than with the
// size of the document.
//
// A term that contains another term is redundant -- `margin` already matches
// `margin-inline-start`, `anchor` already matches `anchor-name` -- so only the
// shortest distinct ones are kept.
//
// Built on first use rather than at module evaluation: `cascade.js` and this
// module are part of an import cycle, so `SHIFTED_PROPERTIES` is not
// necessarily initialized yet when this module is evaluated.
let inlineAnchorStylesRegex: RegExp | undefined;
/**
 * Checks if the given element has inline styles used by the polyfill, including
 * margin, inset, sizing, padding, self-alignment, `position-area`, and anchor
 * properties.
 *
 * @param el The element to check.
 * @returns True if the element has inline styles used by the polyfill.
 */
export function hasInlineAnchorStyles(el: HTMLElement) {
  if (!inlineAnchorStylesRegex) {
    const terms = ['anchor', ...Object.keys(SHIFTED_PROPERTIES)];
    // Match at a declaration boundary, so a term appearing in a *value* does
    // not count: `float: left` and `line-height: 1.5` are not styles we read.
    inlineAnchorStylesRegex = new RegExp(
      `(?:^|;)\\s*(?:${terms.join('|')})`,
      'i',
    );
  }
  return inlineAnchorStylesRegex.test(el.getAttribute('style') ?? '');
}
// Searches for all elements with inline style attributes that include `anchor`.
// For each element found, adds a new 'data-has-inline-styles' attribute with a
// random UUID value, and then formats the styles in the same manner as CSS from
// style tags.
function fetchInlineStyles(elements?: HTMLElement[]) {
  const elementsWithInlineAnchorStyles: HTMLElement[] = (
    elements ?? Array.from(document.querySelectorAll<HTMLElement>('[style]'))
  ).filter((el) => el instanceof HTMLElement && hasInlineAnchorStyles(el));
  const inlineStyles: Partial<StyleData>[] = [];

  elementsWithInlineAnchorStyles.forEach((el) => {
    const dataAttribute = 'data-has-inline-styles';
    // Reuse an existing id rather than minting a new one each run: a
    // concurrent run (e.g. another shadow root being polyfilled) may already
    // be relying on this element's id in an anchor selector, and re-stamping
    // it would invalidate that selector.
    const selector = el.getAttribute(dataAttribute) ?? nanoid(12);
    el.setAttribute(dataAttribute, selector);
    const styles = el.getAttribute('style');
    const css = `[${dataAttribute}="${selector}"] { ${styles} }`;
    inlineStyles.push({ el, css });
  });

  return inlineStyles;
}

// Collects constructed stylesheets that have been adopted (via
// `adoptedStyleSheets`) on any of the given roots. The source text captured
// when the stylesheet was constructed (or its serialized rules as a fallback)
// is used so the styles can be re-parsed and transformed by the polyfill.
function fetchAdoptedStyleSheets(roots: AnchorPositioningRoot[]) {
  const adoptedStyles: Partial<StyleData>[] = [];
  const seen = new Set<CSSStyleSheet>();
  for (const root of roots) {
    const sheets = (root as Document | ShadowRoot).adoptedStyleSheets;
    if (!sheets) {
      continue;
    }
    for (const sheet of sheets) {
      if (seen.has(sheet)) {
        continue;
      }
      seen.add(sheet);
      adoptedStyles.push({
        css: getAdoptedStylesheetText(sheet),
        sheet,
      });
    }
  }
  return adoptedStyles;
}

export async function fetchCSS(
  options: NormalizedAnchorPositioningPolyfillOptions,
): Promise<StyleData[]> {
  const targetElements: HTMLElement[] =
    options.elements ?? querySelectorAllRoots(options.roots, 'link, style');
  const sources: Partial<StyleData>[] = [];

  targetElements
    .filter((el) => el instanceof HTMLElement)
    // Skip `<style>` elements the polyfill generated itself (the
    // non-inheritance reset and the position-area mapping styles), so we don't
    // re-collect and re-process our own output on subsequent runs.
    .filter((el) => !el.hasAttribute(POLYFILLED_STYLE_ATTRIBUTE))
    .forEach((el) => {
      if (el.tagName.toLowerCase() === 'link') {
        const url = getStylesheetUrl(el as HTMLLinkElement);
        if (url) {
          sources.push({ el, url });
        }
      }
      if (el.tagName.toLowerCase() === 'style') {
        sources.push({ el, css: el.innerHTML });
      }
    });

  const elementsForInlines = options.excludeInlineStyles
    ? (options.elements ?? [])
    : undefined;

  const inlines = fetchInlineStyles(elementsForInlines);

  // Collect constructed stylesheets adopted on the polyfill roots. Skipped when
  // an explicit `elements` list is provided, as that opts into element-only
  // polyfilling.
  const adopted = options.elements
    ? []
    : fetchAdoptedStyleSheets(options.roots);

  return await fetchLinkedStylesheets([...sources, ...inlines, ...adopted]);
}
