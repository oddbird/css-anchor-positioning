import { expect, type Page, test } from '@playwright/test';

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

  // The unwrapped path marks the target itself instead of adding a wrapper.
  await expect(target).toHaveAttribute('data-anchor-position-area');
  await expect(wrapper).toHaveCount(0);
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
