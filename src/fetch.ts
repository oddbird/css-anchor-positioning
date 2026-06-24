import { nanoid } from 'nanoid/non-secure';

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

const ELEMENTS_WITH_INLINE_ANCHOR_STYLES_QUERY = '[style*="anchor"]';
const ELEMENTS_WITH_INLINE_POSITION_AREA = '[style*="position-area"]';
// Searches for all elements with inline style attributes that include `anchor`.
// For each element found, adds a new 'data-has-inline-styles' attribute with a
// random UUID value, and then formats the styles in the same manner as CSS from
// style tags.
function fetchInlineStyles(elements?: HTMLElement[]) {
  const elementsWithInlineAnchorStyles: HTMLElement[] = elements
    ? elements.filter(
        (el) =>
          el instanceof HTMLElement &&
          (el.matches(ELEMENTS_WITH_INLINE_ANCHOR_STYLES_QUERY) ||
            el.matches(ELEMENTS_WITH_INLINE_POSITION_AREA)),
      )
    : Array.from(
        document.querySelectorAll(
          [
            ELEMENTS_WITH_INLINE_ANCHOR_STYLES_QUERY,
            ELEMENTS_WITH_INLINE_POSITION_AREA,
          ].join(','),
        ),
      );
  const inlineStyles: Partial<StyleData>[] = [];

  elementsWithInlineAnchorStyles
    .filter((el) => el instanceof HTMLElement)
    .forEach((el) => {
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
