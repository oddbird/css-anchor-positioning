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

  await expect(floating).toHaveCSS('top', '0px');
  await expect(floating).toHaveCSS('left', '0px');

  await applyPolyfill(page);

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('left', '200px');
});

test('updates when sizes change', async ({ page }) => {
  const floating = page.locator(floatingSelector);
  await applyPolyfill(page);

  await expect(floating).toHaveCSS('top', '100px');
  await expect(floating).toHaveCSS('left', '200px');

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));

  await expect(floating).toHaveCSS('left', '150px');
});
