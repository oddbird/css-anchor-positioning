import { expect, test } from '@playwright/test';

test('source CSS replaced with new polyfilled CSS source', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CSS Anchor Positioning Polyfill Demo');

  const stylesheets = await page.locator('head link');
  const sheet = await stylesheets.first();
  await expect(
    await sheet.evaluate((s) => (s as HTMLLinkElement).href),
  ).toContain('blob');

  const styleTags = await page.locator('style');
  const anchorStyletag = await styleTags.last();
  await expect(await anchorStyletag.innerHTML()).not.toContain(
    'position-fallback',
  );
  await expect(await anchorStyletag.innerHTML()).toContain('#my-popup');
});
