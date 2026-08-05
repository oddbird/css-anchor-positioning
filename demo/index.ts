import polyfill from '../src/index-fn.ts';
import { getById } from './dom.ts';

const SUPPORTS_ANCHOR_POSITIONING =
  'anchorName' in document.documentElement.style;

const btn = getById('apply-polyfill');

if (!SUPPORTS_ANCHOR_POSITIONING) {
  btn.addEventListener('click', () =>
    polyfill().then((rules) => {
      btn.innerText = 'Polyfill Applied';
      btn.setAttribute('disabled', '');
      console.log(rules);
    }),
  );
} else {
  btn.innerText = 'No Polyfill Needed';
  btn.setAttribute('disabled', '');
  console.log(
    'anchor-positioning is supported in this browser; polyfill skipped.',
  );
}
const polyfillCDN = `
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>`;

const copyButton = getById('copy-button');
copyButton.addEventListener('click', () => {
  navigator.clipboard.writeText(polyfillCDN);
});

const updateBtn = getById('toggle-anchor-width');
const updateAnchor = getById('my-anchor-update');
updateBtn.addEventListener('click', () => {
  if (updateAnchor.getAttribute('data-small')) {
    updateAnchor.setAttribute('data-large', '');
    updateAnchor.removeAttribute('data-small');
  } else {
    updateAnchor.setAttribute('data-small', '');
    updateAnchor.removeAttribute('data-large');
  }
});

function prepareManualPolyfill() {
  // anchor style element
  const anchorStyleEl = document.createElement('style');
  anchorStyleEl.id = 'my-style-manual-anchor';
  anchorStyleEl.textContent = [
    '#my-anchor-manual {',
    'anchor-name: --my-anchor-manual;',
    '}',
  ].join('');

  // style element
  const styleEl = document.createElement('style');
  styleEl.id = 'my-style-manual-style-el';
  styleEl.textContent = [
    '#my-target-manual-style-el {',
    'position: absolute;',
    'bottom: anchor(--my-anchor-manual top);',
    'right: anchor(--my-anchor-manual left);',
    '}',
  ].join('');

  // link element
  const linkEl = document.createElement('link');
  linkEl.id = 'my-style-manual-link-el';
  linkEl.rel = 'stylesheet';
  linkEl.href = '/anchor-manual.css';

  document.head.append(anchorStyleEl, styleEl, linkEl);

  // inline style
  document
    .getElementById('my-target-manual-inline-style')
    ?.setAttribute(
      'style',
      [
        'position: absolute',
        'top: anchor(--my-anchor-manual bottom)',
        'left: anchor(--my-anchor-manual right)',
      ].join(';'),
    );
}

// These event listeners are for E2E testing only
document
  .getElementById('prepare-manual-polyfill')
  ?.addEventListener('click', () => prepareManualPolyfill(), {
    once: true,
  });
const manualSet1Button = document.getElementById(
  'apply-polyfill-manually-set1',
);
manualSet1Button?.addEventListener('click', () => {
  polyfill({
    elements: [
      getById('my-style-manual-anchor'),
      getById('my-style-manual-style-el'),
    ],
    excludeInlineStyles: true,
  }).then(() => {
    manualSet1Button.setAttribute('disabled', '');
  });
});
const manualSet2Button = document.getElementById(
  'apply-polyfill-manually-set2',
);
manualSet2Button?.addEventListener('click', () => {
  polyfill({
    elements: [
      getById('my-style-manual-anchor'),
      getById('my-style-manual-link-el'),
      getById('my-target-manual-inline-style'),
    ],
    excludeInlineStyles: true,
  }).then(() => {
    manualSet2Button.setAttribute('disabled', '');
  });
});
const manualSet3Button = document.getElementById(
  'apply-polyfill-manually-set3',
);
manualSet3Button?.addEventListener('click', () => {
  polyfill({
    elements: [
      getById('my-style-manual-anchor'),
      getById('my-style-manual-style-el'),
    ],
  }).then(() => {
    manualSet3Button.setAttribute('disabled', '');
  });
});

const manualBtn = getById('apply-polyfill-manually');
if (SUPPORTS_ANCHOR_POSITIONING) {
  manualBtn.innerText = 'Load Anchor Positioning CSS';
}
manualBtn.addEventListener('click', () => {
  prepareManualPolyfill();

  if (!SUPPORTS_ANCHOR_POSITIONING) {
    polyfill({
      elements: [
        getById('my-style-manual-anchor'),
        getById('my-style-manual-link-el'),
        getById('my-style-manual-style-el'),
        getById('my-target-manual-inline-style'),
      ],
    }).then((rules) => {
      manualBtn.innerText = 'Polyfill Applied';
      manualBtn.setAttribute('disabled', '');
      console.log(rules);
    });
  } else {
    manualBtn.innerText = 'Anchor Positioning CSS applied';
    console.log(
      'anchor-positioning is supported in this browser; polyfill skipped.',
    );
  }
  manualBtn.setAttribute('disabled', '');
});
