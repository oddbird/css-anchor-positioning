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
  expect(targetBox!.y).toBeLessThan(anchorBox!.y + anchorBox!.height);
});
