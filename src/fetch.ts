interface LinkedCSS {
  source: string;
  css: string;
}

export function isStyleLink(link: HTMLLinkElement) {
  return Boolean(
    (link.type === 'text/css' || link.rel === 'stylesheet') && link.href,
  );
}

async function handleLinkedStylesheets(): Promise<LinkedCSS[]> {
  const linkElements = document.querySelectorAll('link');
  const CSSlinks: URL[] = [];

  linkElements.forEach((link) => {
    const srcUrl = new URL(link.href, document.baseURI);
    if (srcUrl.origin !== location.origin) {
      return;
    }
    if (isStyleLink(link)) {
      CSSlinks.push(srcUrl);
    }
  });

  const linkedCSS = await Promise.all(
    CSSlinks.map(async (link) => {
      // fetch css and push into array of strings
      const response = await fetch(link.toString());
      const css = await response.text();
      return { source: link.toString(), css };
    }),
  );

  return linkedCSS;
}

function handleInlineStyles() {
  const styleElements = document.querySelectorAll('style');
  const inlineCSS: string[] = [];
  styleElements.forEach((el) => inlineCSS.push(el.innerHTML));

  return inlineCSS;
}

export async function fetchCSS(): Promise<[string[], LinkedCSS[]]> {
  const linkedCSS = await handleLinkedStylesheets();
  const inlineCSS = handleInlineStyles();

  return [inlineCSS, linkedCSS];
}
