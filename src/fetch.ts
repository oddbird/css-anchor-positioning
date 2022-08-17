import { computePosition } from '@floating-ui/dom';

import type { PositionFallbackRulesMap } from './parse.js';

interface LinkedCSS {
  source: string;
  css: string;
}

async function handleLinkedStylesheets(): Promise<LinkedCSS[]> {
  const linkElements = document.querySelectorAll('link');
  const CSSlinks: URL[] = [];

  linkElements.forEach((link) => {
    const srcUrl = new URL(link.href, document.baseURI);
    if (srcUrl.origin !== location.origin) {
      return;
    }
    if ((link.type === 'text/css' || link.rel === 'stylesheet') && link.href) {
      CSSlinks.push(srcUrl);
    }
  });

  const linkedCSS = await Promise.all(
    CSSlinks.map(async (link) => {
      // fetch css and push into array of strings
      const response = await fetch(link.toString());
      const text = await response.text();
      return { source: link.toString(), css: text };
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

export async function transformCSS(
  positionFallbackRules: PositionFallbackRulesMap,
) {
  // for each position fallback set, get the anchor and floating element for that set
  // call floating-ui's compute position (fallback rules go in middleware)
  // remove anchor-positioning spec CSS (anchor() and @position-fallback and @try) from CSS
  const raw = await fetchCSS();
  // let parsed = parseCSS(raw);
  // @@@ Testing purposes...
  console.log(raw);
  applyPolyfill();
}

// @@@ This is just to test that the floating-ui code can run...
function applyPolyfill() {
  const referenceElement: HTMLElement | null =
    document.querySelector('#button');
  const floatingElement: HTMLElement | null =
    document.querySelector('#my-popup');

  if (referenceElement && floatingElement) {
    const applyStyles = ({ x = 0, y = 0, strategy = 'absolute' } = {}) => {
      Object.assign(floatingElement.style, {
        position: strategy,
        left: `${x}px`,
        top: `${y}px`,
      });
    };

    computePosition(referenceElement, floatingElement, {
      placement: 'bottom',
    }).then(applyStyles);
  }
}
