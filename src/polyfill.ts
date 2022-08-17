import { transformCSS } from './transform.js';

export function polyfill(): void {
  // fetch CSS from stylesheet and inline style

  // parse and see if polyfill / JS needed

  // JS anchoring logic here (takes results from parsing i.e. fallback strategy)

  // after JS logic done, update source code, remove anchoring CSS
  transformCSS();
}
