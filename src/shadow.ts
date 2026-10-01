import { type AnchorPositioningPolyfillOptions, polyfill } from './polyfill.js';
import {
  captureAdoptedStylesheetText,
  isWritingAdoptedStylesheet,
  originalReplaceSync,
} from './utils.js';

/**
 * Options accepted by `patchAndPolyfillConstructedStylesheets()`. `roots` and
 * `elements` are omitted because each polyfill run it sets up is scoped to a
 * single shadow root, and always overrides both.
 */
export type ConstructedStylesheetsPolyfillOptions = Omit<
  AnchorPositioningPolyfillOptions,
  'elements' | 'roots'
>;

// Marks host elements already queued for positioning, so that adopting several
// stylesheets into one shadow root only queues a single run. Cleared when that
// run starts, so a stylesheet adopted afterwards (a theme swap, an updated
// constructed stylesheet) queues a fresh one.
const queuedHosts = new WeakSet<HTMLElement>();

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

// Shadow roots that adopted a stylesheet before their host was connected,
// waiting to be positioned by the host's `connectedCallback`.
const pendingHosts = new WeakMap<HTMLElement, ShadowRoot>();

// Whether `CustomElementRegistry.prototype.define` has already been patched, so
// that repeated calls don't nest another wrapper.
let customElementsPatched = false;

/**
 * Patches `CustomElementRegistry.prototype.define` to wrap each element's
 * `connectedCallback` before the registry captures it, so that a host which
 * adopted a stylesheet while disconnected gets positioned once it is connected
 * and its shadow DOM has been populated.
 *
 * The wrapping has to happen here rather than on the host element: lifecycle
 * callbacks are looked up when the element is defined and stored on the
 * definition, so assigning `host.connectedCallback` afterwards has no effect on
 * the reaction. Watching the document for insertions doesn't work either —
 * mutation records don't cross shadow boundaries, so a host appended into
 * another component's shadow root would be missed.
 *
 * Patching the prototype rather than `customElements` covers scoped custom
 * element registries as well, since every registry inherits `define` from it.
 */
function patchCustomElementsDefine() {
  if (customElementsPatched || typeof CustomElementRegistry === 'undefined') {
    return;
  }
  customElementsPatched = true;

  const originalDefine = CustomElementRegistry.prototype.define;
  CustomElementRegistry.prototype.define = function (
    this: CustomElementRegistry,
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
  ) {
    const prototype = constructor.prototype as {
      connectedCallback?: (this: HTMLElement) => void;
    };
    const originalConnectedCallback = prototype.connectedCallback;
    const hadOwnConnectedCallback = Object.prototype.hasOwnProperty.call(
      prototype,
      'connectedCallback',
    );

    prototype.connectedCallback = function (this: HTMLElement) {
      originalConnectedCallback?.call(this);
      const shadowRoot = pendingHosts.get(this);
      if (shadowRoot) {
        pendingHosts.delete(this);
        queuedHosts.delete(this);
        void runPolyfill(shadowRoot);
      }
    };

    try {
      return originalDefine.call(this, name, constructor, options);
    } catch (error) {
      // The registry rejected the definition -- an invalid or already-taken
      // name, say -- so it never captured the wrapper. Put the prototype back
      // exactly as we found it: a constructor the registry refused can be
      // offered again under another name, and a wrapper left behind would be
      // captured as that call's original, stacking a second layer.
      if (hadOwnConnectedCallback) {
        prototype.connectedCallback = originalConnectedCallback;
      } else {
        delete prototype.connectedCallback;
      }
      throw error;
    }
  };
}

/**
 * Queues the polyfill run that positions a shadow root's anchored elements,
 * using the options given to `patchAndPolyfillConstructedStylesheets`. The run
 * is deferred until the host is connected and its shadow DOM is populated,
 * which is not yet the case when `adoptedStyleSheets` is assigned from a
 * constructor or before the host is inserted.
 */
function positionWhenPopulated(shadowRoot: ShadowRoot) {
  const host = shadowRoot.host as HTMLElement;
  if (queuedHosts.has(host)) {
    return;
  }
  queuedHosts.add(host);

  // Already connected (e.g. `adoptedStyleSheets` was assigned from within the
  // host's `connectedCallback`): run once that callback has finished and the
  // shadow DOM has been populated.
  if (host.isConnected) {
    queueMicrotask(() => {
      queuedHosts.delete(host);
      void runPolyfill(shadowRoot);
    });
  } else {
    // Positioned by the `connectedCallback` wrapper installed above -- but only
    // a custom element has one. Check back once the current task's DOM work is
    // done as well: building a shadow root and appending its host is normally a
    // single synchronous sequence, so by then a plain element is usually
    // connected too. Whichever of the two gets there first claims the entry.
    pendingHosts.set(host, shadowRoot);
    queueMicrotask(() => {
      if (host.isConnected && pendingHosts.get(host) === shadowRoot) {
        pendingHosts.delete(host);
        queuedHosts.delete(host);
        void runPolyfill(shadowRoot);
      }
    });
  }
}

/**
 * Installs patches on `CSSStyleSheet.prototype.replaceSync` and the
 * `ShadowRoot.prototype.adoptedStyleSheets` setter to support CSS anchor
 * positioning in constructed stylesheets adopted into shadow roots.
 *
 * Call this as early as possible — before any custom element is defined — so
 * that constructed stylesheets are captured and their shadow roots are queued
 * for positioning. A host that adopts a stylesheet before it is connected is
 * positioned by its `connectedCallback`, which can only be wrapped for elements
 * defined after this runs, or — for a plain element, which has no such callback
 * — as soon as the task that adopted the stylesheet ends. A plain element that
 * is still disconnected by then is only positioned once the polyfill is run
 * again, since nothing signals that it has been connected.
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

  patchCustomElementsDefine();

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
  // `adoptedStyleSheets` is assigned before `innerHTML` in `connectedCallback`),
  // so the run is deferred until the shadow DOM has been populated.
  if (adoptedStyleSheetsDescriptor && originalAdoptedStyleSheetsSet) {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      ...adoptedStyleSheetsDescriptor,
      set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
        originalAdoptedStyleSheetsSet.call(this, sheets);
        // Not for the polyfill swapping in its own transformed copy: that is
        // the tail end of a run, not a reason to start another one.
        if (sheets.length > 0 && !isWritingAdoptedStylesheet()) {
          positionWhenPopulated(this);
        }
      },
    });
    adoptedStyleSheetsPatched = true;
  }
}
