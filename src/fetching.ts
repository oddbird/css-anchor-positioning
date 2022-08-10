import type { PositionFallbackRulesMap } from './parsing.js';

function handleLinkedStylesheets() {
  const linkElements = document.querySelectorAll('link');
  const CSSlinks: HTMLLinkElement[] = [];
  linkElements.forEach((link) => {
    if (link.type === 'text/css' || link.rel === 'stylesheet') {
      CSSlinks.push(link);
    }
  });
  return CSSlinks;
}

export function fetchCSS() {
  const linkedCSS = handleLinkedStylesheets();
  const inlineCSS = document.querySelectorAll('style');

  return [inlineCSS, linkedCSS];
}

export function transformCSS(positionFallbackRules: PositionFallbackRulesMap) {
  // for each position fallback set, get the anchor and floating element for that set
  // call floating-ui's compute position (fallback rules go in middleware)
  // remove anchor-positioning spec CSS (anchor() and @position-fallback and @try) from CSS
  console.log('running');
}
