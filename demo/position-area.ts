import polyfill from '../src/index-fn.ts';
import { getById } from './dom.ts';

const SUPPORTS_ANCHOR_POSITIONING =
  'anchorName' in document.documentElement.style;

const btn = getById('apply-polyfill');

// Add `?no-containing-block` to the URL to apply the polyfill with
// `positionAreaContainingBlock: false`, which positions targets
// directly instead of wrapping them. Add `?auto` to use `'auto'`, which
// wraps only targets whose styles resolve against the containing block.
const params = new URLSearchParams(location.search);
const positionAreaContainingBlock = params.has('no-containing-block')
  ? false
  : params.has('auto')
    ? 'auto'
    : true;

if (!SUPPORTS_ANCHOR_POSITIONING) {
  btn.addEventListener('click', () =>
    polyfill({ positionAreaContainingBlock }).then((rules) => {
      btn.innerText = 'Polyfill Applied';
      btn.setAttribute('disabled', '');
      console.log(rules);
      const toggleWrapper = getById('toggle-wrapper');
      toggleWrapper.removeAttribute('disabled');
      toggleWrapper.innerText = 'Toggle Wrapper Visibility';
    }),
  );
} else {
  btn.innerText = 'No Polyfill Needed';
  btn.setAttribute('disabled', '');
  console.log(
    'anchor-positioning is supported in this browser; polyfill skipped.',
  );
}

getById('toggle-wrapper').addEventListener('click', () => {
  document.body.classList.toggle('show-wrapper');
});
getById('switch-cascade').addEventListener('click', () => {
  document.body.classList.toggle('cascade-override');
});
