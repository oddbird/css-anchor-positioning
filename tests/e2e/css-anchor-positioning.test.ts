import { expect, test } from '@playwright/test';

test('source CSS replaced with new polyfilled CSS source', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CSS Anchor Positioning Polyfill Demo');

  const stylesheets = page.locator('head link');
  const sheet = stylesheets.first();

  expect(await sheet.evaluate((s) => (s as HTMLLinkElement).href)).toContain(
    'blob',
  );

  const styleTags = page.locator('style');
  const anchorStyletag = styleTags.first();

  expect(await anchorStyletag.innerHTML()).not.toContain('position-fallback');
  expect(await anchorStyletag.innerHTML()).toContain('#my-popup');
});
