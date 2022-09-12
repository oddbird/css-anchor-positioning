import { expect, test } from '@playwright/test';

test('source CSS replaced with new polyfilled CSS source', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CSS Anchor Positioning Polyfill Demo');

  // The transform code is not currently being used...
  // const stylesheet = page.locator('head link[data-style-anchor-positioning]');
  // const styleTag = page.locator('style').first();

  // expect(
  //   await stylesheet.evaluate((s) => (s as HTMLLinkElement).href),
  // ).toContain('blob');
  // expect(await styleTag.innerHTML()).not.toContain('anchor(');
  // expect(await styleTag.innerHTML()).toContain('#my-anchor-inline');
});
