import { polyfill } from './polyfill.js';

export { patchCSSOM } from './cssom.js';
export { patchAndPolyfillConstructedStylesheets } from './shadow.js';

export default polyfill;
