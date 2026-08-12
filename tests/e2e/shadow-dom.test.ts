import { expect, type Page, test } from '@playwright/test';

// Type-only: the entry is imported dynamically at runtime from a path the dev
// server resolves (see below), which would otherwise be typed `any`.
import type * as fnModule from '../../src/index-fn.js';
import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/shadow-dom.html');
});

const btnSelector = '#apply-polyfill';

async function applyPolyfill(page: Page) {
  const btn = page.locator(btnSelector);
  await btn.click();
  return await expect(btn).toBeDisabled();
}

async function getElementWidth(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.getBoundingClientRect().width);
}

async function getParentWidth(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.offsetParent?.clientWidth ?? 0);
}

async function getParentHeight(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.offsetParent?.clientHeight ?? 0);
}

test('applies polyfill inside shadow root', async ({ page }) => {
  const shadowAnchorSelector =
    'anchor-web-component #shadow-anchor-positioning';
  const shadowTargetSelector =
    'anchor-web-component #shadow-target-positioning';
  const target = page.locator(shadowTargetSelector);
  const width = await getElementWidth(page, shadowAnchorSelector);
  const parentWidth = await getParentWidth(page, shadowTargetSelector);
  const parentHeight = await getParentHeight(page, shadowTargetSelector);
  const expected = parentWidth - width;

  await expect(target).toHaveCSS('top', '0px');
  await expectWithinOne(target, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', parentHeight);
  await expectWithinOne(target, 'right', expected);
});

test('applies polyfill for adopted stylesheets in shadow root', async ({
  page,
}) => {
  const anchorSelector = 'anchor-adopted-styles .anchor';
  const anchor = page.locator(anchorSelector);

  // The empty value is `""`, so require more than one character.
  const nonEmptyValue = /.+/;
  // Before the polyfill is applied, anchor rules in adopted stylesheets are
  // stripped out, and not present in the stylesheet at all.
  await expect(anchor).not.toHaveCSS('anchor-name', nonEmptyValue);

  await applyPolyfill(page);

  // The target uses `position-area: bottom span-left`, so the polyfill wraps it
  // in a `<polyfill-position-area>` element that carries the position values.
  const targetWrapper = page.locator(
    'anchor-adopted-styles POLYFILL-POSITION-AREA',
  );
  const target = targetWrapper.locator('.target');

  // `span-left` aligns the inline (x) end; `bottom` aligns the block (y) start.
  await expect(target).toHaveCSS('justify-self', 'end');
  await expect(target).toHaveCSS('align-self', 'start');
  await expectWithinOne(targetWrapper, 'bottom', 0);
  await expectWithinOne(targetWrapper, 'left', 0);

  const anchorBox = await anchor.boundingBox();
  const targetWrapperBox = await targetWrapper.boundingBox();

  // Right sides should be aligned.
  expect(targetWrapperBox!.x + targetWrapperBox!.width).toBeCloseTo(
    anchorBox!.x + anchorBox!.width,
    0,
  );
  // Target top should be aligned with anchor bottom.
  expect(targetWrapperBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
});

test('applies global polyfill options to adopted stylesheets in shadow root', async ({
  page,
}) => {
  // `patchAndPolyfillConstructedStylesheets()` runs the polyfill itself for
  // each shadow root, so global options must carry over into those runs. With
  // `positionAreaContainingBlock: false`, the `position-area` target must be
  // positioned directly instead of wrapped in `<polyfill-position-area>`.
  await page.addInitScript(() => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: false,
    };
  });
  await page.goto('/shadow-dom.html');

  await applyPolyfill(page);

  const wrapper = page.locator('anchor-adopted-styles POLYFILL-POSITION-AREA');
  const target = page.locator('anchor-adopted-styles .target');
  const anchor = page.locator('anchor-adopted-styles .anchor');

  // The unwrapped path marks the target itself instead of adding a wrapper.
  await expect(target).toHaveAttribute('data-anchor-position-area');
  await expect(wrapper).toHaveCount(0);

  // The target is still positioned, not merely left unwrapped.
  const anchorBox = await anchor.boundingBox();
  const targetBox = await target.boundingBox();
  expect(targetBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
});

test('applies explicit polyfill options to adopted stylesheets in shadow root', async ({
  page,
}) => {
  // Options given to `patchAndPolyfillConstructedStylesheets()` are forwarded
  // to the polyfill run it sets up for each shadow root, and take precedence
  // over the global options.
  await page.addInitScript(() => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: true,
    };
  });
  await page.goto('/shadow-dom.html');

  await page.evaluate(async () => {
    // Resolved by the Vite dev server at runtime; the indirection keeps `tsc`
    // and the import linter from trying to resolve it statically. The cast
    // restores the type checking that a non-literal `import()` gives up.
    const fnEntry = '/src/index-fn.ts';
    const { patchAndPolyfillConstructedStylesheets } = (await import(
      fnEntry
    )) as typeof fnModule;

    patchAndPolyfillConstructedStylesheets({
      positionAreaContainingBlock: false,
    });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      .anchor { anchor-name: --explicit-anchor; }
      .target {
        position: absolute;
        position-anchor: --explicit-anchor;
        position-area: bottom span-left;
      }
    `);

    customElements.define(
      'explicit-options',
      class extends HTMLElement {
        connectedCallback() {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot!.adoptedStyleSheets = [sheet];
          this.shadowRoot!.innerHTML = `
            <div class="anchor">Anchor</div>
            <div class="target">Target</div>`;
        }
      },
    );

    document.body.append(document.createElement('explicit-options'));
  });

  const target = page.locator('explicit-options .target');
  const wrapper = page.locator('explicit-options POLYFILL-POSITION-AREA');
  const anchor = page.locator('explicit-options .anchor');

  // The attribute is only set on the unwrapped path, so waiting on it both
  // sequences the queued polyfill run and asserts which path was taken.
  await expect(target).toHaveAttribute('data-anchor-position-area');
  await expect(wrapper).toHaveCount(0);

  const anchorBox = await anchor.boundingBox();
  const targetBox = await target.boundingBox();
  expect(targetBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
});

test('positions a host that adopts its stylesheet before being connected', async ({
  page,
}) => {
  // A custom element that builds its shadow root in the constructor adopts its
  // stylesheet while still disconnected. Custom element lifecycle callbacks are
  // captured when the element is defined, so the polyfill can't hook the host's
  // `connectedCallback` at that point — it has to wait for the host to enter
  // the document.
  await page.goto('/shadow-dom.html');

  await page.evaluate(async () => {
    const fnEntry = '/src/index-fn.ts';
    const { patchAndPolyfillConstructedStylesheets } = (await import(
      fnEntry
    )) as typeof fnModule;

    patchAndPolyfillConstructedStylesheets();

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      .anchor { anchor-name: --constructor-anchor; }
      .target {
        position: absolute;
        position-anchor: --constructor-anchor;
        position-area: bottom span-left;
      }
    `);

    customElements.define(
      'adopts-in-constructor',
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this.shadowRoot!.adoptedStyleSheets = [sheet];
          this.shadowRoot!.innerHTML = `
            <div class="anchor">Anchor</div>
            <div class="target">Target</div>`;
        }
      },
    );

    // Constructed (and adopting) well before it is connected.
    const host = document.createElement('adopts-in-constructor');
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.body.append(host);
  });

  const anchor = page.locator('adopts-in-constructor .anchor');
  const wrapper = page.locator('adopts-in-constructor POLYFILL-POSITION-AREA');

  // Assert the generated wrapper, not geometry. An unresolved `anchor()` or
  // `position-area` leaves the target at its static position, which for a
  // target that directly follows its anchor in flow is the same place the
  // anchored position would put it — so position assertions alone pass whether
  // or not the polyfill ran. The wrapper only exists if it ran.
  await expect(wrapper).toHaveCount(1);

  const anchorBox = await anchor.boundingBox();
  const wrapperBox = await wrapper.boundingBox();

  // `bottom` aligns the target's top with the anchor's bottom; `span-left`
  // aligns their right edges.
  expect(wrapperBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
  expect(wrapperBox!.x + wrapperBox!.width).toBeCloseTo(
    anchorBox!.x + anchorBox!.width,
    0,
  );
});

test('positions every custom-element host sharing one constructed stylesheet', async ({
  page,
}) => {
  // Two `<position-anchor-on-host>` hosts, each linked (via `position-anchor`)
  // to its own anchor, all driven by a single shared constructed stylesheet.
  const anchors = page.locator('#host-custom-element .anchor');
  const tooltips = page.locator('#host-custom-element position-anchor-on-host');

  const getRect = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((node: HTMLElement) =>
      node.getBoundingClientRect().toJSON(),
    );

  await applyPolyfill(page);

  const count = await tooltips.count();
  expect(count).toBe(2);

  // Each host's `:host` rule uses `top: anchor(top)`, `left: anchor(center)`
  // and `translate: -50% -100%`, so every host should sit above its own anchor,
  // horizontally centered on it — not just the last one to be processed.
  for (let i = 0; i < count; i++) {
    const anchorRect = await getRect(anchors.nth(i));
    const tooltipRect = await getRect(tooltips.nth(i));
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const tooltipCenterX = tooltipRect.left + tooltipRect.width / 2;
    expect(tooltipCenterX, `host ${i} horizontal center`).toBeCloseTo(
      anchorCenterX,
      0,
    );
    expect(tooltipRect.bottom, `host ${i} sits above anchor`).toBeCloseTo(
      anchorRect.top,
      0,
    );
  }
});

test('anchors to a pseudo-element inside a shadow root', async ({ page }) => {
  // `#shadow-pseudo-anchor::before` (a block, 100px tall) is the anchor; the
  // target uses `top: anchor(bottom)`. To measure a pseudo-element the polyfill
  // builds a temporary "fake pseudo-element" plus a `<style>` that supplies the
  // `content` and hides the real pseudo-element during measurement. That style
  // must be appended to the shadow root: a `<style>` in `document.head` does not
  // apply inside a shadow root, so the real `::before` would not be hidden and
  // would push the measured anchor (and thus the target) a full `::before`
  // height below the anchor box. See issue #425.
  const anchor = page.locator('anchor-pseudo-element #shadow-pseudo-anchor');
  const target = page.locator('anchor-pseudo-element #shadow-pseudo-target');

  await applyPolyfill(page);

  const anchorBox = await anchor.boundingBox();
  const targetBox = await target.boundingBox();

  // The anchor `<span>` wraps only the block `::before`, so their boxes match.
  // With the pseudo-element correctly hidden during measurement, the target's
  // `anchor(bottom)` resolves within the anchor's own box, so its top stays
  // above the anchor's bottom edge. Without the fix the un-hidden 100px
  // `::before` pushes the target well below that edge.
  expect(targetBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height);
});

test('emulates non-inheritance of shifted properties inside a shadow root without `CSS.registerProperty`', async ({
  page,
}) => {
  // Without `CSS.registerProperty` (e.g. Firefox < 128) the polyfill emulates
  // non-inheritance with a universal `initial` reset. A `<style>` in
  // `document.head` can't pierce a shadow boundary, so the reset must be
  // injected into each shadow root passed in `options.roots`. See
  // https://github.com/oddbird/css-anchor-positioning/issues/279.
  await page.addInitScript(() => {
    delete (CSS as unknown as { registerProperty?: unknown }).registerProperty;
  });
  await page.goto('/shadow-dom.html');

  const result = await page.evaluate(async () => {
    // Resolved by the Vite dev server at runtime; the indirection keeps `tsc`
    // and the import linter from trying to resolve it statically.
    const fnEntry = '/src/index-fn.ts';
    const { default: polyfill } = await import(fnEntry);

    // A scroll container inside a shadow root sets an explicit `height` (a
    // shifted sizing property); its descendant target never sets one.
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>.container { height: 400px; overflow: scroll; position: static; }</style>
      <div class="container">
        <span id="s-anchor" style="anchor-name: --s-anchor">anchor</span>
        <div id="s-target"
             style="position: absolute; position-anchor: --s-anchor; top: anchor(bottom)">target</div>
      </div>`;

    await polyfill({ roots: [shadow] });

    // Discover the shifted `--height-<uuid>` name from the reset in the shadow.
    const resetText = [...shadow.querySelectorAll('style')]
      .map((el) => el.textContent ?? '')
      .find((text) => /--height-[\w-]+:\s*initial/.test(text));
    const heightProp = resetText?.match(/(--height-[\w-]+):\s*initial/)?.[1];
    const container = shadow.querySelector('.container') as HTMLElement;
    const target = shadow.getElementById('s-target') as HTMLElement;
    return {
      resetInShadow: Boolean(resetText),
      containerHeight: heightProp
        ? getComputedStyle(container).getPropertyValue(heightProp).trim()
        : null,
      targetHeight: heightProp
        ? getComputedStyle(target).getPropertyValue(heightProp).trim()
        : null,
    };
  });

  // The reset was injected into the shadow root, and the descendant target
  // reads the shifted value back as empty instead of inheriting the container's.
  expect(result.resetInShadow).toBe(true);
  expect(result.containerHeight).toBe('400px');
  expect(result.targetHeight).toBe('');
});
