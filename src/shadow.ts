import { type AnchorPositioningPolyfillOptions, polyfill } from './polyfill.js';
import { captureAdoptedStylesheetText, originalReplaceSync } from './utils.js';

/**
 * Options accepted by `patchAndPolyfillConstructedStylesheets()`. `roots` and
 * `elements` are omitted because each polyfill run it sets up is scoped to a
 * single shadow root, and always overrides both.
 */
export type ConstructedStylesheetsPolyfillOptions = Omit<
  AnchorPositioningPolyfillOptions,
  'elements' | 'roots'
>;

// Marks host elements whose `connectedCallback` has already been wrapped, so we
// don't wrap it more than once if multiple stylesheets are adopted.
const patchedHosts = new WeakSet<HTMLElement>();

// Whether the `adoptedStyleSheets` setter has already been patched. The patched
// setter can't be compared against the original (we only have the original from
// the descriptor we're replacing), so track it here — otherwise every call to
// `patchAndPolyfillConstructedStylesheets()` would nest another wrapper.
let adoptedStyleSheetsPatched = false;

// Options given to the most recent `patchAndPolyfillConstructedStylesheets()`
// call, if any. Read at run time rather than captured, so that a global set
// after the patch call (or a later call with different options) is honored.
let polyfillOptions: ConstructedStylesheetsPolyfillOptions | undefined;

function runPolyfill(shadowRoot: ShadowRoot) {
  return polyfill({
    ...(polyfillOptions ?? window.ANCHOR_POSITIONING_POLYFILL_OPTIONS ?? {}),
    // Both are always overridden: the run is scoped to this shadow root, and an
    // explicit `elements` list opts out of fetching adopted stylesheets
    // entirely, which is the very thing we're here to polyfill.
    elements: undefined,
    roots: [shadowRoot],
  });
}

// Hosts that adopted a stylesheet while disconnected, mapped to the run that
// positions them once they enter the document. Emptied by `connectionObserver`.
const pendingHosts = new Map<HTMLElement, () => void>();
let connectionObserver: MutationObserver | undefined;

/**
 * Runs `onConnected` once `host` is in the document. Custom element lifecycle
 * callbacks are captured when the element is defined, so patching the host's
 * own `connectedCallback` here would never be invoked for the reaction; watch
 * the document for the host being inserted instead.
 */
function whenConnected(host: HTMLElement, onConnected: () => void) {
  pendingHosts.set(host, onConnected);

  // `connectedCallback` reactions run synchronously during insertion, so by the
  // time observer records are delivered the shadow DOM has been populated.
  connectionObserver ??= new MutationObserver(() => {
    for (const [pendingHost, callback] of pendingHosts) {
      if (pendingHost.isConnected) {
        pendingHosts.delete(pendingHost);
        callback();
      }
    }
    if (pendingHosts.size === 0) {
      connectionObserver?.disconnect();
      connectionObserver = undefined;
    }
  });
  connectionObserver.observe(document, { childList: true, subtree: true });
}

/**
 * Queues the polyfill run that positions a shadow root's anchored elements,
 * using the options given to `patchAndPolyfillConstructedStylesheets`. The run
 * is deferred until the host is connected and its shadow DOM is populated,
 * which is not yet the case when `adoptedStyleSheets` is assigned from a
 * constructor or before the host is inserted.
 */
function patchHostConnectedCallback(shadowRoot: ShadowRoot) {
  const host = shadowRoot.host as HTMLElement;
  if (patchedHosts.has(host)) {
    return;
  }
  patchedHosts.add(host);

  const run = () => {
    void runPolyfill(shadowRoot);
  };

  // Already connected (e.g. `adoptedStyleSheets` was assigned from within the
  // host's `connectedCallback`): run once that callback has finished and the
  // shadow DOM has been populated.
  if (host.isConnected) {
    queueMicrotask(run);
  } else {
    whenConnected(host, run);
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
 * `roots` and `elements`, which are always scoped to the shadow root being
 * positioned. When omitted, options are read from
 * `window.ANCHOR_POSITIONING_POLYFILL_OPTIONS` at the time each run happens, so
 * the global can still be set after this is called. Calling this more than once
 * replaces the options used by subsequent runs.
 */
export function patchAndPolyfillConstructedStylesheets(
  options?: ConstructedStylesheetsPolyfillOptions,
) {
  polyfillOptions = options;

  // Patch `replaceSync` to capture the source text of constructed stylesheets
  // so the polyfill can later re-parse it.
  if (CSSStyleSheet.prototype.replaceSync === originalReplaceSync) {
    CSSStyleSheet.prototype.replaceSync = function (text: string) {
      captureAdoptedStylesheetText(this, text);
      return originalReplaceSync.call(this, text);
    };
  }

  if (adoptedStyleSheetsPatched) {
    return;
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
  if (adoptedStyleSheetsDescriptor && originalAdoptedStyleSheetsSet) {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      ...adoptedStyleSheetsDescriptor,
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        originalAdoptedStyleSheetsSet.call(this, sheets);
        if (sheets.length > 0) {
          patchHostConnectedCallback(this);
        }
      },
    });
    adoptedStyleSheetsPatched = true;
  }
}
