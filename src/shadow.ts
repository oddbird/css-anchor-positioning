import { type AnchorPositioningPolyfillOptions, polyfill } from './polyfill.js';
import { captureAdoptedStylesheetText, originalReplaceSync } from './utils.js';

interface CustomElementHost extends HTMLElement {
  connectedCallback?: () => void;
}

// Marks host elements whose `connectedCallback` has already been wrapped, so we
// don't wrap it more than once if multiple stylesheets are adopted.
const patchedHosts = new WeakSet<HTMLElement>();

/**
 * Wraps the `connectedCallback` of a shadow root's host element so that, after
 * the original callback runs (and the shadow DOM is populated), the polyfill is
 * run for that shadow root to position its anchored elements, using the options
 * given to `patchAndPolyfillConstructedStylesheets`.
 */
function patchHostConnectedCallback(
  shadowRoot: ShadowRoot,
  options: AnchorPositioningPolyfillOptions,
) {
  const host = shadowRoot.host as CustomElementHost;
  if (patchedHosts.has(host)) {
    return;
  }
  patchedHosts.add(host);

  // `roots` is always overridden, to scope the run to this shadow root.
  const runPolyfill = () => polyfill({ ...options, roots: [shadowRoot] });

  const originalConnectedCallback = host.connectedCallback;
  host.connectedCallback = function (this: CustomElementHost) {
    originalConnectedCallback?.call(this);
    void runPolyfill();
  };

  // If the host is already connected (e.g. `adoptedStyleSheets` was assigned
  // from within the host's `connectedCallback`), the wrapper above won't run
  // for the current connection, so run the polyfill once the current callback
  // has finished and the shadow DOM has been populated.
  if (host.isConnected) {
    queueMicrotask(() => {
      void runPolyfill();
    });
  }
}

/**
 * Installs patches on `CSSStyleSheet.prototype.replaceSync` and the
 * `ShadowRoot.prototype.adoptedStyleSheets` setter to support CSS anchor
 * positioning in constructed stylesheets adopted into shadow roots.
 *
 * Call this as early as possible — before any custom element's
 * `connectedCallback` runs — so that constructed stylesheets are captured and
 * their shadow roots are queued for positioning.
 *
 * The given options are passed on to each polyfill run this sets up, except for
 * `roots`, which is always the shadow root being positioned. Defaults to
 * `window.ANCHOR_POSITIONING_POLYFILL_OPTIONS`, matching `polyfill()`.
 */
export function patchAndPolyfillConstructedStylesheets(
  options: AnchorPositioningPolyfillOptions = window.ANCHOR_POSITIONING_POLYFILL_OPTIONS ??
    {},
) {
  // Patch `replaceSync` to capture the source text of constructed stylesheets
  // so the polyfill can later re-parse it.
  if (CSSStyleSheet.prototype.replaceSync === originalReplaceSync) {
    CSSStyleSheet.prototype.replaceSync = function (text: string) {
      captureAdoptedStylesheetText(this, text);
      return originalReplaceSync.call(this, text);
    };
  }

  const adoptedStyleSheetsDescriptor = Object.getOwnPropertyDescriptor(
    ShadowRoot.prototype,
    'adoptedStyleSheets',
  );
  const originalAdoptedStyleSheetsSet = adoptedStyleSheetsDescriptor?.set;

  // Patch the `adoptedStyleSheets` setter so that anchors/targets styled by
  // constructed stylesheets get positioned. We have access to the `ShadowRoot`
  // here (`this`), but the shadow root's children may not exist yet (e.g. when
  // `adoptedStyleSheets` is assigned before `innerHTML` in `connectedCallback`).
  // To position only after the shadow DOM is populated, we wrap the host
  // element's `connectedCallback` and run the polyfill for the shadow root once
  // the (original) callback has finished.
  if (
    adoptedStyleSheetsDescriptor &&
    originalAdoptedStyleSheetsSet &&
    adoptedStyleSheetsDescriptor.set === originalAdoptedStyleSheetsSet
  ) {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      ...adoptedStyleSheetsDescriptor,
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        originalAdoptedStyleSheetsSet.call(this, sheets);
        if (sheets.length > 0) {
          patchHostConnectedCallback(this, options);
        }
      },
    });
  }
}
