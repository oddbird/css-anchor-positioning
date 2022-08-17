import { expect, test } from '@playwright/test';

test('source CSS replaced with new polyfilled CSS source', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CSS Anchor Positioning Polyfill Demo');

  const stylesheets = await page.locator('head link');
  const sheet = await stylesheets.first();

  await expect(
    await sheet.evaluate((s) => (s as HTMLLinkElement).href),
  ).toContain('blob');

  const heading = await page.locator('h1');
  await expect(heading).toHaveCSS('color', 'rgb(0, 128, 0)');
});
