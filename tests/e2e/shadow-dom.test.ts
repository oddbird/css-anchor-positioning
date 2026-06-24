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
  const targetSelector = 'anchor-adopted-styles .target';
  const target = page.locator(targetSelector);
  const anchor = page.locator(anchorSelector);
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  const expected = parentWidth - width;

  // The empty value is `""`, so require more than one character.
  const nonEmptyValue = /.+/;
  // Before the polyfill is applied, anchor rules in adopted stylesheets are
  // stripped out, and not present in the stylesheet at all.
  await expect(anchor).not.toHaveCSS('anchor-name', nonEmptyValue);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', parentHeight);
  await expectWithinOne(target, 'right', expected);
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
