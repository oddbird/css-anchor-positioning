import { getById, getShadowRoot } from './dom.ts';

function defineCustomElements() {
  class AnchorWebComponent extends HTMLElement {}
  customElements.define('anchor-web-component', AnchorWebComponent);

  // Hosts a declarative shadow root whose anchor is a `::before`
  // pseudo-element. Like `<anchor-web-component>`, it relies on the
  // explicit `polyfill({ roots })` call below rather than an
  // adopted-stylesheet patch.
  class AnchorPseudoElement extends HTMLElement {}
  customElements.define('anchor-pseudo-element', AnchorPseudoElement);

  class AnchorAdoptedStyles extends HTMLElement {
    connectedCallback() {
      const root = this.attachShadow({ mode: 'open' });

      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
        .anchor {
          anchor-name: --adopted-anchor;
        }
        .target {
          position: absolute;
          position-anchor: --adopted-anchor;
          position-area: bottom span-left;
        }
      `);
      root.adoptedStyleSheets = [sheet];

      root.innerHTML = `
        <link rel="stylesheet" href="/demo.css" />
        <div class="anchor">Anchor</div>
        <div class="target">Target</div>
      `;
    }
  }
  customElements.define('anchor-adopted-styles', AnchorAdoptedStyles);

  // One constructed stylesheet, shared (adopted) by every
  // `<position-anchor-on-host>` instance — the "construct once, adopt
  // everywhere" pattern. Each host resolves `anchor()` against its own
  // `position-anchor`, so the polyfill must transform this shared sheet
  // per host rather than clobbering it for all but the last one.
  const positionAnchorOnHostSheet = new CSSStyleSheet();
  positionAnchorOnHostSheet.replaceSync(`
    :host {
      --element-color: var(--target, var(--outer-anchored));
      background: var(--element-color);
      border: thin solid var(--border);
      border-radius: var(--radius-1);
      color: white;
      font-weight: bold;
      top: anchor(top);
      left: anchor(center);
      padding: 0.5em;
      white-space: nowrap;
      position: absolute;
      translate: -50% -100%;
    }
  `);

  class PositionAnchorOnHost extends HTMLElement {
    connectedCallback() {
      const root = this.attachShadow({ mode: 'open' });
      root.adoptedStyleSheets = [positionAnchorOnHostSheet];
      root.innerHTML = '<slot></slot>';
    }
  }
  customElements.define('position-anchor-on-host', PositionAnchorOnHost);
}

const btn = getById('apply-polyfill');

const SUPPORTS_ANCHOR_POSITIONING =
  'anchorName' in document.documentElement.style;

if (!SUPPORTS_ANCHOR_POSITIONING) {
  if (location.hash === '#apply-polyfill') {
    // Load the shadow entrypoint first so the `replaceSync` and
    // `adoptedStyleSheets` patches are installed before any custom
    // element's `connectedCallback` runs.
    const { default: polyfill, patchAndPolyfillConstructedStylesheets } =
      await import('../src/index-fn.ts');

    // Patch Constructed stylesheets
    patchAndPolyfillConstructedStylesheets();

    // Now define the custom elements
    defineCustomElements();

    // Load the polyfill explicitly for the <anchor-web-component> and
    // <anchor-pseudo-element> demos. The <anchor-adopted-styles> and
    // <position-anchor-on-host> demos use `adoptedStyleSheets`, so they
    // are already covered by the adopted stylesheet patch.
    await polyfill({
      roots: [
        getShadowRoot('anchor-web-component'),
        getShadowRoot('anchor-pseudo-element'),
      ],
    });

    btn.innerText = 'Polyfill Applied';
    btn.setAttribute('disabled', '');
  } else {
    btn.addEventListener('click', () => {
      location.hash = 'apply-polyfill';
      location.reload();
    });
    defineCustomElements();
  }
} else {
  btn.innerText = 'No Polyfill Needed';
  btn.setAttribute('disabled', '');
  console.log(
    'anchor-positioning is supported in this browser; polyfill skipped.',
  );

  defineCustomElements();
}
