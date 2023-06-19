import { polyfill } from './polyfill.js';

// Used by the WPT test harness to delay test assertions
// and give the polyfill time to apply changes
window.CHECK_LAYOUT_DELAY = true;

// apply polyfill
if (document.readyState !== 'complete') {
  window.addEventListener('load', () => {
    polyfill();
  });
} else {
  polyfill();
}
