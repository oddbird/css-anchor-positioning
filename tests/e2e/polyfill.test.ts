import { expect, type Page, test } from '@playwright/test';

import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/');
});

const btnSelector = '#apply-polyfill';
const targetSelector = '#my-target-positioning';
const anchorSelector = '#my-anchor-positioning';
const DEMO_ELEMENT_PADDING = '30px';
const DEMO_ELEMENT_PADDING_NUMBER = 30;

async function applyPolyfill(page: Page) {
  const btn = page.locator(btnSelector);
  await btn.click();
  // The button only disables after `polyfill()` resolves; completion time is
  // variable on CI (especially WebKit on the heaviest pages), so allow more
  // than the default 10s.
  await expect(btn).toBeDisabled({ timeout: 30 * 1000 });
  // The demo pages load external web fonts, which reflow text after loading and
  // shift measured element positions. Wait for fonts to settle so later
  // `boundingBox()` reads are stable.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function getElementWidth(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.getBoundingClientRect().width);
}
async function getElementHeight(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.getBoundingClientRect().height);
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

test('applies polyfill for `anchor()`', async ({ page }) => {
  const target = page.locator(targetSelector);
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  const expected = parentWidth - width;

  await expect(target).toHaveCSS('top', DEMO_ELEMENT_PADDING);
  await expectWithinOne(target, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(
    target,
    'top',
    parentHeight - DEMO_ELEMENT_PADDING_NUMBER,
  );
  await expectWithinOne(
    target,
    'right',
    expected - DEMO_ELEMENT_PADDING_NUMBER,
  );
});

test('applies polyfill for inside and outside keywords', async ({ page }) => {
  const inoutAnchorSelector = '#inside-outside .anchor';
  const inoutTargetSelector = '#inside-outside .target';
  const target = page.locator(inoutTargetSelector);
  const height = await getParentHeight(page, inoutAnchorSelector);
  const parentWidth = await getParentWidth(page, inoutTargetSelector);
  const parentHeight = await getParentHeight(page, inoutTargetSelector);
  const expected = parentHeight - height;

  await expectWithinOne(target, 'left', DEMO_ELEMENT_PADDING_NUMBER);
  await expectWithinOne(target, 'bottom', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(
    target,
    'left',
    parentWidth - DEMO_ELEMENT_PADDING_NUMBER,
  );
  await expectWithinOne(
    target,
    'bottom',
    expected + DEMO_ELEMENT_PADDING_NUMBER,
  );
});

test('applies polyfill for inset- full longhands', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset .anchor';
  const insetTargetSelector = '#anchor-inset .target';
  const target = page.locator(insetTargetSelector);
  const parentWidth = await getParentWidth(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', anchorHeight + padding, true);
  await expectWithinOne(target, 'bottom', 0);

  await applyPolyfill(page);

  await expectWithinOne(target, 'right', parentWidth - padding);
  await expectWithinOne(target, 'top', anchorHeight + padding);
  await expectWithinOne(target, 'bottom', 0);
});

test('applies polyfill for inset-[axis] shorthands', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset-shorthand .anchor';
  const insetTargetSelector = '#anchor-inset-shorthand .target';
  const target = page.locator(insetTargetSelector);
  const parentHeight = await getParentHeight(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);

  await applyPolyfill(page);

  await expectWithinOne(target, 'right', 10);
  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);
  await expectWithinOne(
    target,
    'bottom',
    parentHeight - padding - anchorHeight,
  );
});
test('applies polyfill for inset shorthand', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset-shortesthand .anchor';
  const insetTargetSelector = '#anchor-inset-shortesthand .target';
  const target = page.locator(insetTargetSelector);
  const parentHeight = await getParentHeight(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', padding);
  await expectWithinOne(
    target,
    'bottom',
    parentHeight - padding - anchorHeight,
  );
  await expectWithinOne(target, 'right', 0);
  await expectWithinOne(target, 'left', 0);
});

test('applies polyfill from inline styles', async ({ page }) => {
  const targetInLine = page.locator('#my-target-inline');
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  const expected = parentWidth - width;

  await expect(targetInLine).toHaveCSS('top', DEMO_ELEMENT_PADDING);
  await expectWithinOne(targetInLine, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(
    targetInLine,
    'top',
    parentHeight - DEMO_ELEMENT_PADDING_NUMBER,
  );
  await expectWithinOne(
    targetInLine,
    'right',
    expected - DEMO_ELEMENT_PADDING_NUMBER,
  );
});

test('updates when sizes change', async ({ page }) => {
  const target = page.locator(targetSelector);
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  await applyPolyfill(page);

  await expectWithinOne(
    target,
    'top',
    parentHeight - DEMO_ELEMENT_PADDING_NUMBER,
  );
  await expectWithinOne(
    target,
    'right',
    parentWidth - width - DEMO_ELEMENT_PADDING_NUMBER,
  );

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));

  await expectWithinOne(
    target,
    'right',
    parentWidth - 50 - DEMO_ELEMENT_PADDING_NUMBER,
  );
});

test('applies polyfill for `@position-fallback`', async ({ page }) => {
  const targetSel = '#my-target-fallback';
  const target = page.locator(targetSel);
  await target.scrollIntoViewIfNeeded();

  // Capture the target's pre-polyfill (static) position so we can assert the
  // polyfill moves it.
  const initialLeft = await target.evaluate(
    (node) => getComputedStyle(node).left,
  );

  await applyPolyfill(page);

  await expect(target).not.toHaveCSS('left', initialLeft);
  await expect(target).not.toHaveCSS('width', '100px');

  await target.evaluate((node: HTMLElement) => {
    const scrollContainer = node.closest('.scroll-container') as HTMLElement;
    scrollContainer.scrollLeft = 180;
    scrollContainer.scrollTop = 120;
  });

  await expect(target).toHaveCSS('width', '100px');
  await expect(target).toHaveCSS('height', '100px');
});

test('applies `@position-try` fallback for a fixed-positioned target', async ({
  page,
}) => {
  // A fixed-positioned target's containing block is the viewport, so its
  // `offsetParent` resolves to the document element. This exercises the
  // viewport branch of `checkOverflow`. The anchor sits near the bottom of the
  // viewport, so the base position (below the anchor) overflows and the
  // fallback (above the anchor) should be applied.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #fixed-fallback-anchor {
        anchor-name: --fixed-fallback-anchor;
        position: fixed;
        top: 90vh;
        left: 50px;
        width: 100px;
        height: 20px;
      }
      #fixed-fallback-target {
        position: fixed;
        position-anchor: --fixed-fallback-anchor;
        top: anchor(bottom);
        left: anchor(left);
        width: 100px;
        height: 100px;
        position-try-fallbacks: --fixed-flip;
      }
      @position-try --fixed-flip {
        bottom: anchor(top);
        top: revert;
      }
    `;
    document.head.append(style);
    const anchor = document.createElement('div');
    anchor.id = 'fixed-fallback-anchor';
    const target = document.createElement('div');
    target.id = 'fixed-fallback-target';
    document.body.append(anchor, target);
  });

  await applyPolyfill(page);

  const { anchor, target } = await page.evaluate(() => {
    const anchorEl = document.getElementById('fixed-fallback-anchor')!;
    const targetEl = document.getElementById('fixed-fallback-target')!;
    return {
      anchor: anchorEl.getBoundingClientRect(),
      target: targetEl.getBoundingClientRect(),
    };
  });

  // The target is anchored horizontally (`left: anchor(left)`), which only
  // holds if `anchor()` actually resolved — guarding against a trivial pass
  // where the polyfill didn't run and the target sits at its static position.
  expect(target.left).toBeCloseTo(anchor.left, 0);
  // The base position (below the anchor) overflows the viewport, so the
  // fallback flips the target above its anchor to keep it in view.
  expect(target.bottom).toBeLessThanOrEqual(anchor.top + 1);
});

test('applies manual polyfill', async ({ page }) => {
  const applyButton = page.locator('#apply-polyfill-manually');
  await applyButton.click();
  await expect(applyButton).toBeDisabled();
  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('applies manual polyfill for multiple elements separately', async ({
  page,
}) => {
  const buttonContainer = page.locator('#anchor-manual-test-buttons');
  await buttonContainer.evaluate((node: HTMLDivElement) => {
    node.hidden = false;
  });
  await buttonContainer.waitFor({ state: 'visible' });

  const prepareButton = page.locator('#prepare-manual-polyfill');
  await prepareButton.click();

  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).not.toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).not.toBeCloseTo(anchorBox.y + anchorBox.height, 0);

  const set1Button = page.locator('#apply-polyfill-manually-set1');
  const set2Button = page.locator('#apply-polyfill-manually-set2');

  await set1Button.click();
  await expect(set1Button).toBeDisabled();

  const newTarget1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;

  expect(newTarget1Box.x + newTarget1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(newTarget1Box.y + newTarget1Box.height).toBeCloseTo(anchorBox.y, 0);

  await set2Button.click();
  await expect(set2Button).toBeDisabled();

  const newTarget2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const newTarget3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(newTarget2Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget2Box.y + newTarget2Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(newTarget3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('applies manual polyfill with automatic inline style polyfill', async ({
  page,
}) => {
  const buttonContainer = page.locator('#anchor-manual-test-buttons');
  await buttonContainer.evaluate((node: HTMLDivElement) => {
    node.hidden = false;
  });
  await buttonContainer.waitFor({ state: 'visible' });

  const prepareButton = page.locator('#prepare-manual-polyfill');
  await prepareButton.click();

  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).not.toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).not.toBeCloseTo(anchorBox.y + anchorBox.height, 0);

  const set3Button = page.locator('#apply-polyfill-manually-set3');

  await set3Button.click();
  await expect(set3Button).toBeDisabled();

  const newTarget1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;

  const newTarget2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const newTarget3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(newTarget1Box.x + newTarget1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(newTarget1Box.y + newTarget1Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(newTarget2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget2Box.y + newTarget2Box.height).not.toBeCloseTo(
    anchorBox.y,
    0,
  );

  expect(newTarget3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('does not change position if anchor is invalid', async ({ page }) => {
  const target = page.locator('#my-target-invalid');
  await applyPolyfill(page);

  await expectWithinOne(target, 'top', 0);
  await expectWithinOne(target, 'left', 0);
});

test('emulates non-inheritance of shifted properties without `CSS.registerProperty`', async ({
  page,
}) => {
  // Simulate an engine without `CSS.registerProperty` (e.g. Firefox < 128),
  // where the shifted custom properties would otherwise inherit. The polyfill
  // falls back to injecting a universal `initial` reset to emulate the
  // non-inherited behavior of the properties they stand in for. See
  // https://github.com/oddbird/css-anchor-positioning/issues/279.
  await page.addInitScript(() => {
    delete (CSS as unknown as { registerProperty?: unknown }).registerProperty;
  });
  await page.goto('/');
  expect(await page.evaluate(() => typeof CSS.registerProperty)).not.toBe(
    'function',
  );

  await applyPolyfill(page);

  // The combined-tactics demo's `.scroll-container` sets `height: 400px`, which
  // is shifted into `--height-<uuid>`. Without emulated non-inheritance that
  // value would leak onto the descendant target and corrupt its generated
  // fallback (the Firefox < 128 bug). Assert the container reads back the
  // shifted value while the descendant target reads back empty.
  const { containerHeight, targetHeight } = await page.evaluate(() => {
    // Discover the shifted `--height-<uuid>` property name from the reset style.
    const resetText = [...document.head.querySelectorAll('style')]
      .map((el) => el.textContent ?? '')
      .find((text) => /--height-[\w-]+:\s*initial/.test(text))!;
    const heightProp = resetText.match(/(--height-[\w-]+):\s*initial/)![1];
    const container = document.querySelector(
      '#position-try-tactics-combined .scroll-container',
    ) as HTMLElement;
    const target = document.getElementById(
      'my-target-try-tactics-combined',
    ) as HTMLElement;
    return {
      containerHeight: getComputedStyle(container)
        .getPropertyValue(heightProp)
        .trim(),
      targetHeight: getComputedStyle(target)
        .getPropertyValue(heightProp)
        .trim(),
    };
  });

  expect(containerHeight).toBe('400px');
  expect(targetHeight).toBe('');
});
