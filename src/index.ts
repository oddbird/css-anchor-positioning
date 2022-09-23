import { polyfill } from './polyfill.js';

// apply polyfill
if (document.readyState !== 'complete') {
  window.addEventListener('load', () => {
    polyfill();
  });
} else {
  polyfill();
}
