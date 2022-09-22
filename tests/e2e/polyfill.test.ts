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

test('applies polyfill', async ({ page }) => {
  const floating = page.locator(floatingSelector);
  const pageWidth = await page
    .locator('body')
    .evaluate((node) => node.clientWidth);
  const expected = `${pageWidth - 200}px`;

  await expect(floating).toHaveCSS('top', '0px');
  await expect(floating).not.toHaveCSS('right', expected);

  await applyPolyfill(page);

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('right', expected);
});

test('updates when sizes change', async ({ page }) => {
  const pageWidth = await page
    .locator('body')
    .evaluate((node) => node.clientWidth);
  const floating = page.locator(floatingSelector);
  await applyPolyfill(page);
  let expected = `${pageWidth - 200}px`;

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('right', expected);

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));
  expected = `${pageWidth - 150}px`;

  await expect(floating).toHaveCSS('right', expected);
});
