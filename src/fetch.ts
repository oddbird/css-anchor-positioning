import { nanoid } from 'nanoid/non-secure';

import { type StyleData } from './utils.js';

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

// Searches for all elements with inline style attributes that include `anchor`.
// For each element found, adds a new 'data-has-inline-styles' attribute with a
// random UUID value, and then formats the styles in the same manner as CSS from
// style tags.
function fetchInlineStyles() {
  const elementsWithInlineAnchorStyles: NodeListOf<HTMLElement> =
    document.querySelectorAll('[style*="anchor"]');
  const inlineStyles: Partial<StyleData>[] = [];

  elementsWithInlineAnchorStyles.forEach((el) => {
    const selector = nanoid(12);
    const dataAttribute = 'data-has-inline-styles';
    el.setAttribute(dataAttribute, selector);
    const styles = el.getAttribute('style');
    const css = `[${dataAttribute}="${selector}"] { ${styles} }`;
    inlineStyles.push({ el, css });
  });

  return inlineStyles;
}

export async function fetchCSS(): Promise<StyleData[]> {
  const elements: NodeListOf<HTMLElement> =
    document.querySelectorAll('link, style');
  const sources: Partial<StyleData>[] = [];

  elements.forEach((el) => {
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

  const inlines = fetchInlineStyles();

  return await fetchLinkedStylesheets([...sources, ...inlines]);
}
