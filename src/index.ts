import { polyfill } from './polyfill.js';

// @ts-expect-error Used by the WPT test harness to delay test assertions
// and give the polyfill time to apply changes
window.CHECK_LAYOUT_DELAY_MS = 100;

// apply polyfill
if (document.readyState !== 'complete') {
  window.addEventListener('load', () => {
    polyfill();
  });
} else {
  polyfill();
}
