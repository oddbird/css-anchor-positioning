import { expect, test } from '@playwright/test';

test('source CSS replaced with new polyfilled CSS source', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CSS Anchor Positioning Polyfill Demo');

  const stylesheet = page.locator('head link[data-style-anchor-positioning]');

  expect(
    await stylesheet.evaluate((s) => (s as HTMLLinkElement).href),
  ).toContain('blob');

  // @@@ This should also remove `anchor()` css
  // const styleTag = page.locator('style').first();

  // expect(await styleTag.innerHTML()).not.toContain('anchor(');
  // expect(await styleTag.innerHTML()).toContain('#my-anchor-inline');
});
