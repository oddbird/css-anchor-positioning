import { type Page, expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

const btnSelector = '#apply-polyfill';
const floatingSelector = '#my-floating-positioning';
const anchorSelector = '#my-anchor-positioning';

async function applyPolyfill(page: Page) {
  const btn = page.locator(btnSelector);
  return await btn.click();
}

async function getParentWidth(page: Page) {
  return page
    .locator(floatingSelector)
    .evaluate((node: HTMLElement) => node.offsetParent?.clientWidth ?? 0);
}

test('applies polyfill', async ({ page }) => {
  const floating = page.locator(floatingSelector);
  const parentWidth = await getParentWidth(page);
  const expected = `${parentWidth - 200}px`;

  await expect(floating).toHaveCSS('top', '0px');
  await expect(floating).not.toHaveCSS('right', expected);

  await applyPolyfill(page);

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('right', expected);
});

test('updates when sizes change', async ({ page }) => {
  const parentWidth = await getParentWidth(page);
  const floating = page.locator(floatingSelector);
  await applyPolyfill(page);
  let expected = `${parentWidth - 200}px`;

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('right', expected);

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));
  expected = `${parentWidth - 150}px`;

  await expect(floating).toHaveCSS('right', expected);
});
