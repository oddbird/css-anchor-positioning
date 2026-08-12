import { type AnchorPositioningPolyfillOptions } from '../../src/polyfill.js';

const polyfillMock = vi.hoisted(() =>
  vi.fn<(options?: AnchorPositioningPolyfillOptions) => Promise<void>>(() =>
    Promise.resolve(),
  ),
);

vi.mock('../../src/polyfill.js', () => ({ polyfill: polyfillMock }));

// jsdom's `ShadowRoot.prototype` has no own `adoptedStyleSheets` descriptor, so
// there is nothing for the polyfill to patch. Install a minimal accessor that
// behaves like the real one for the purposes of these tests.
const adoptedSheets = new WeakMap<ShadowRoot, CSSStyleSheet[]>();

function installAdoptedStyleSheets() {
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
    configurable: true,
    get(this: ShadowRoot) {
      return adoptedSheets.get(this) ?? [];
    },
    set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
      adoptedSheets.set(this, sheets);
    },
  });
}

// Imports the module fresh, so its patched-once state doesn't leak between
// tests.
async function loadShadowModule() {
  vi.resetModules();
  return await import('../../src/shadow.js');
}

// Attaches a connected shadow root and adopts a stylesheet into it, then waits
// for the polyfill run queued by the patched setter.
async function adoptStylesheet() {
  const host = document.createElement('div');
  document.body.append(host);
  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.adoptedStyleSheets = [{} as CSSStyleSheet];
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  return shadowRoot;
}

function optionsOfLastRun() {
  return polyfillMock.mock.lastCall?.[0];
}

describe('patchAndPolyfillConstructedStylesheets', () => {
  // Each `loadShadowModule()` re-evaluates `utils.js`, which captures whatever
  // `replaceSync` is current as the "original" — so without restoring it, every
  // test would leave another wrapper stacked on the shared prototype.
  let originalReplaceSync: typeof CSSStyleSheet.prototype.replaceSync;

  beforeEach(() => {
    originalReplaceSync = CSSStyleSheet.prototype.replaceSync;
    installAdoptedStyleSheets();
    polyfillMock.mockClear();
  });

  afterEach(() => {
    CSSStyleSheet.prototype.replaceSync = originalReplaceSync;
    delete (ShadowRoot.prototype as Partial<ShadowRoot>).adoptedStyleSheets;
    delete window.ANCHOR_POSITIONING_POLYFILL_OPTIONS;
    document.body.replaceChildren();
  });

  it('runs the polyfill scoped to the shadow root', async () => {
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets();

    const shadowRoot = await adoptStylesheet();

    expect(polyfillMock).toHaveBeenCalledTimes(1);
    expect(optionsOfLastRun()).toMatchObject({ roots: [shadowRoot] });
  });

  it('applies global options set before the patch call', async () => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: false,
    };
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets();

    await adoptStylesheet();

    expect(optionsOfLastRun()).toMatchObject({
      positionAreaContainingBlock: false,
    });
  });

  it('applies global options set after the patch call', async () => {
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets();
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: false,
    };

    await adoptStylesheet();

    expect(optionsOfLastRun()).toMatchObject({
      positionAreaContainingBlock: false,
    });
  });

  it('prefers explicit options over global options', async () => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: true,
    };
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets({
      positionAreaContainingBlock: false,
    });

    await adoptStylesheet();

    expect(optionsOfLastRun()).toMatchObject({
      positionAreaContainingBlock: false,
    });
  });

  it('uses the options from the most recent call', async () => {
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets({
      positionAreaContainingBlock: true,
    });
    patchAndPolyfillConstructedStylesheets({
      positionAreaContainingBlock: false,
    });

    await adoptStylesheet();

    // A second call must neither nest another setter wrapper (which would run
    // the polyfill twice) nor keep the first call's options.
    expect(polyfillMock).toHaveBeenCalledTimes(1);
    expect(optionsOfLastRun()).toMatchObject({
      positionAreaContainingBlock: false,
    });
  });

  it('overrides `roots` and `elements` from the given options', async () => {
    // An explicit `elements` list opts out of fetching adopted stylesheets, so
    // it must not carry over into these runs.
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      elements: [document.createElement('div')],
      roots: [document],
    };
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets();

    const shadowRoot = await adoptStylesheet();

    expect(optionsOfLastRun()).toMatchObject({
      elements: undefined,
      roots: [shadowRoot],
    });
  });

  it('does not run the polyfill when no stylesheets are adopted', async () => {
    const { patchAndPolyfillConstructedStylesheets } = await loadShadowModule();
    patchAndPolyfillConstructedStylesheets();

    const host = document.createElement('div');
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).adoptedStyleSheets = [];
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(polyfillMock).not.toHaveBeenCalled();
  });
});
