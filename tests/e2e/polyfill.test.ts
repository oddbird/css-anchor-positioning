import { type Page, expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/');
});

const btnSelector = '#apply-polyfill';
const floatingSelector = '#my-floating-positioning';
const anchorSelector = '#my-anchor-positioning';

async function applyPolyfill(page: Page) {
  const btn = page.locator(btnSelector);
  return await btn.click();
}

async function getAnchorWidth(page: Page) {
  return page
    .locator(anchorSelector)
    .evaluate((node: HTMLElement) => node.getBoundingClientRect().width);
}

async function getParentWidth(page: Page) {
  return page
    .locator(floatingSelector)
    .evaluate((node: HTMLElement) => node.offsetParent?.clientWidth ?? 0);
}

async function getParentHeight(page: Page) {
  return page
    .locator(floatingSelector)
    .evaluate((node: HTMLElement) => node.offsetParent?.clientHeight ?? 0);
}

test('applies polyfill', async ({ page }) => {
  const floating = page.locator(floatingSelector);
  const width = await getAnchorWidth(page);
  const parentWidth = await getParentWidth(page);
  const parentHeight = await getParentHeight(page);
  const expected = `${parentWidth - width}px`;

  await expect(floating).toHaveCSS('top', '0px');
  await expect(floating).not.toHaveCSS('right', expected);

  await applyPolyfill(page);

  await expect(floating).toHaveCSS('top', `${parentHeight}px`);
  await expect(floating).toHaveCSS('right', expected);
});

test('applies polyfill from inline styles', async ({ page }) => {
  const floatingInLine = page.locator('#my-floating-in-line');

  await expect(floatingInLine).toHaveCSS('top', '0px');
  await expect(floatingInLine).toHaveCSS('left', '0px');

  await applyPolyfill(page);

  await expect(floatingInLine).toHaveCSS('top', '100px');
  await expect(floatingInLine).toHaveCSS('left', '200px');
});

test('updates when sizes change', async ({ page }) => {
  const floating = page.locator(floatingSelector);
  const width = await getAnchorWidth(page);
  const parentWidth = await getParentWidth(page);
  const parentHeight = await getParentHeight(page);
  await applyPolyfill(page);
  let expected = `${parentWidth - width}px`;

  await expect(floating).toHaveCSS('top', `${parentHeight}px`);
  await expect(floating).toHaveCSS('right', expected);

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));
  expected = `${parentWidth - 50}px`;

  await expect(floating).toHaveCSS('right', expected);
});
