interface StyleData {
  source: 'style' | string;
  css: string;
}

export function isStyleLink(link: HTMLLinkElement) {
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
  sources: (string | URL)[],
): Promise<StyleData[]> {
  return Promise.all(
    sources.map(async (src) => {
      if (typeof src === 'string') {
        return { source: 'style', css: src };
      }
      // fetch css and push into array of strings
      const response = await fetch(src.toString());
      const css = await response.text();
      return { source: src.toString(), css };
    }),
  );
}

export async function fetchCSS(): Promise<StyleData[]> {
  const elements = document.querySelectorAll('link, style');
  const sources: (string | URL)[] = [];

  elements.forEach((el) => {
    if (el.tagName.toLowerCase() === 'link') {
      const url = getStylesheetUrl(el as HTMLLinkElement);
      if (url) {
        sources.push(url);
      }
    }
    if (el.tagName.toLowerCase() === 'style') {
      sources.push(el.innerHTML);
    }
  });

  return await fetchLinkedStylesheets(sources);
}
