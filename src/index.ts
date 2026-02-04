import { polyfill } from './polyfill.js';

// apply polyfill
if (typeof window !== 'undefined') {
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
      polyfill();
    });
  } else {
    polyfill();
  }
}