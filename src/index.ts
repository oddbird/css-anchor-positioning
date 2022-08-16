// Polyfill `fetch` for older browsers
import 'whatwg-fetch';

import { transformCSS } from './fetching.js';

// Expose API
// @@@ This should be replaced with the actual API we want to expose
export default transformCSS;
