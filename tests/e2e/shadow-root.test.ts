import { expect, type Page, test } from '@playwright/test';

import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/shadow-root.html');
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
