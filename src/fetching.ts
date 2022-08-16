import { computePosition } from '@floating-ui/dom';
import http from 'http';

import { parseCSS, PositionFallbackRulesMap } from './parsing.js';

function handleLinkedStylesheets() {
  const linkElements = document.querySelectorAll('link');
  const CSSlinks: HTMLLinkElement[] = [];
  linkElements.forEach((link) => {
    if ((link.type === 'text/css' || link.rel === 'stylesheet') && link.href) {
      CSSlinks.push(link);
    }
  });

  const linkedCss = CSSlinks.map((link) => {
    // fetch css and push into array of strings
    console.log(link.href);
    http.get(link.href).toString();
  });
  console.log(linkedCss);
  return linkedCss;
}

export function fetchCSS() {
  const linkedCSS = handleLinkedStylesheets();
  const inlineCSS = document.querySelectorAll('style');
  console.log(linkedCSS);
  const inlineString = inlineCSS.forEach((inline) => inline.innerHTML);
  console.log(inlineString);

  return [inlineCSS, linkedCSS];
}

export function transformCSS(positionFallbackRules: PositionFallbackRulesMap) {
  // for each position fallback set, get the anchor and floating element for that set
  // call floating-ui's compute position (fallback rules go in middleware)
  // remove anchor-positioning spec CSS (anchor() and @position-fallback and @try) from CSS
  const raw = fetchCSS();
  // let parsed = parseCSS(raw);
  // @@@ Testing purposes...
  console.log('running');
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
