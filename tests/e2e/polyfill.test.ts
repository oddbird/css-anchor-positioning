import { expect, type Page, test } from '@playwright/test';

import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/');
});

const btnSelector = '#apply-polyfill';
const targetSelector = '#my-target-positioning';
const anchorSelector = '#my-anchor-positioning';

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
async function getElementHeight(page: Page, sel: string) {
  return page
    .locator(sel)
    .first()
    .evaluate((node: HTMLElement) => node.getBoundingClientRect().height);
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

test('applies polyfill for `anchor()`', async ({ page }) => {
  const target = page.locator(targetSelector);
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  const expected = parentWidth - width;

  await expect(target).toHaveCSS('top', '0px');
  await expectWithinOne(target, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', parentHeight);
  await expectWithinOne(target, 'right', expected);
});

test('applies polyfill for inside and outside keywords', async ({ page }) => {
  const inoutAnchorSelector = '#inside-outside .anchor';
  const inoutTargetSelector = '#inside-outside .target';
  const target = page.locator(inoutTargetSelector);
  const height = await getParentHeight(page, inoutAnchorSelector);
  const parentWidth = await getParentWidth(page, inoutTargetSelector);
  const parentHeight = await getParentHeight(page, inoutTargetSelector);
  const expected = parentHeight - height;

  await expectWithinOne(target, 'left', 0);
  await expectWithinOne(target, 'bottom', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(target, 'left', parentWidth);
  await expectWithinOne(target, 'bottom', expected);
});

test('applies polyfill for inset- full longhands', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset .anchor';
  const insetTargetSelector = '#anchor-inset .target';
  const target = page.locator(insetTargetSelector);
  const parentWidth = await getParentWidth(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', anchorHeight + padding, true);
  await expectWithinOne(target, 'bottom', 0);

  await applyPolyfill(page);

  await expectWithinOne(target, 'right', parentWidth - padding);
  await expectWithinOne(target, 'top', anchorHeight + padding);
  await expectWithinOne(target, 'bottom', 0);
});

test('applies polyfill for inset-[axis] shorthands', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset-shorthand .anchor';
  const insetTargetSelector = '#anchor-inset-shorthand .target';
  const target = page.locator(insetTargetSelector);
  const parentHeight = await getParentHeight(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);

  await applyPolyfill(page);

  await expectWithinOne(target, 'right', 10);
  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);
  await expectWithinOne(
    target,
    'bottom',
    parentHeight - padding - anchorHeight,
  );
});
test('applies polyfill for inset shorthand', async ({ page }) => {
  const padding = 30;
  const insetAnchorSelector = '#anchor-inset-shortesthand .anchor';
  const insetTargetSelector = '#anchor-inset-shortesthand .target';
  const target = page.locator(insetTargetSelector);
  const parentHeight = await getParentHeight(page, insetTargetSelector);
  const anchorHeight = await getElementHeight(page, insetAnchorSelector);

  await expectWithinOne(target, 'left', padding);
  await expectWithinOne(target, 'top', padding);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', padding);
  await expectWithinOne(
    target,
    'bottom',
    parentHeight - padding - anchorHeight,
  );
  await expectWithinOne(target, 'right', 0);
  await expectWithinOne(target, 'left', 0);
});

test('applies polyfill from inline styles', async ({ page }) => {
  const targetInLine = page.locator('#my-target-inline');
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  const expected = parentWidth - width;

  await expect(targetInLine).toHaveCSS('top', '0px');
  await expectWithinOne(targetInLine, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(targetInLine, 'top', parentHeight);
  await expectWithinOne(targetInLine, 'right', expected);
});

test('updates when sizes change', async ({ page }) => {
  const target = page.locator(targetSelector);
  const width = await getElementWidth(page, anchorSelector);
  const parentWidth = await getParentWidth(page, targetSelector);
  const parentHeight = await getParentHeight(page, targetSelector);
  await applyPolyfill(page);

  await expectWithinOne(target, 'top', parentHeight);
  await expectWithinOne(target, 'right', parentWidth - width);

  await page
    .locator(anchorSelector)
    .evaluate((anchor) => (anchor.style.width = '50px'));

  await expectWithinOne(target, 'right', parentWidth - 50);
});

test('applies polyfill for `@position-fallback`', async ({ page }) => {
  const targetSel = '#my-target-fallback';
  const target = page.locator(targetSel);
  await target.scrollIntoViewIfNeeded();

  await expect(target).toHaveCSS('left', '0px');

  await applyPolyfill(page);

  await expect(target).not.toHaveCSS('left', '0px');
  await expect(target).not.toHaveCSS('width', '100px');

  await target.evaluate((node: HTMLElement) => {
    (node.offsetParent as HTMLElement).scrollLeft = 180;
    (node.offsetParent as HTMLElement).scrollTop = 120;
  });

  await expect(target).toHaveCSS('width', '100px');
  await expect(target).toHaveCSS('height', '100px');
});

test('applies manual polyfill', async ({ page }) => {
  const applyButton = page.locator('#apply-polyfill-manually');
  await applyButton.click();
  await expect(applyButton).toBeDisabled();
  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('applies manual polyfill for multiple elements separately', async ({
  page,
}) => {
  const buttonContainer = page.locator('#anchor-manual-test-buttons');
  await buttonContainer.evaluate((node: HTMLDivElement) => {
    node.hidden = false;
  });
  await buttonContainer.waitFor({ state: 'visible' });

  const prepareButton = page.locator('#prepare-manual-polyfill');
  await prepareButton.click();

  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).not.toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).not.toBeCloseTo(anchorBox.y + anchorBox.height, 0);

  const set1Button = page.locator('#apply-polyfill-manually-set1');
  const set2Button = page.locator('#apply-polyfill-manually-set2');

  await set1Button.click();
  await expect(set1Button).toBeDisabled();

  const newTarget1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;

  expect(newTarget1Box.x + newTarget1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(newTarget1Box.y + newTarget1Box.height).toBeCloseTo(anchorBox.y, 0);

  await set2Button.click();
  await expect(set2Button).toBeDisabled();

  const newTarget2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const newTarget3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(newTarget2Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget2Box.y + newTarget2Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(newTarget3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('applies manual polyfill with automatic inline style polyfill', async ({
  page,
}) => {
  const buttonContainer = page.locator('#anchor-manual-test-buttons');
  await buttonContainer.evaluate((node: HTMLDivElement) => {
    node.hidden = false;
  });
  await buttonContainer.waitFor({ state: 'visible' });

  const prepareButton = page.locator('#prepare-manual-polyfill');
  await prepareButton.click();

  const anchorBox = (await page.locator('#my-anchor-manual').boundingBox())!;
  const target1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;
  const target2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const target3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(target1Box.x + target1Box.width).not.toBeCloseTo(anchorBox.x, 0);
  expect(target1Box.y + target1Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target2Box.y + target2Box.height).not.toBeCloseTo(anchorBox.y, 0);

  expect(target3Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(target3Box.y).not.toBeCloseTo(anchorBox.y + anchorBox.height, 0);

  const set3Button = page.locator('#apply-polyfill-manually-set3');

  await set3Button.click();
  await expect(set3Button).toBeDisabled();

  const newTarget1Box = (await page
    .locator('#my-target-manual-style-el')
    .boundingBox())!;

  const newTarget2Box = (await page
    .locator('#my-target-manual-link-el')
    .boundingBox())!;
  const newTarget3Box = (await page
    .locator('#my-target-manual-inline-style')
    .boundingBox())!;

  expect(newTarget1Box.x + newTarget1Box.width).toBeCloseTo(anchorBox.x, 0);
  expect(newTarget1Box.y + newTarget1Box.height).toBeCloseTo(anchorBox.y, 0);

  expect(newTarget2Box.x).not.toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget2Box.y + newTarget2Box.height).not.toBeCloseTo(
    anchorBox.y,
    0,
  );

  expect(newTarget3Box.x).toBeCloseTo(anchorBox.x + anchorBox.width, 0);
  expect(newTarget3Box.y).toBeCloseTo(anchorBox.y + anchorBox.height, 0);
});

test('does not change position if anchor is invalid', async ({ page }) => {
  const target = page.locator('#my-target-invalid');
  await applyPolyfill(page);

  await expectWithinOne(target, 'top', 0);
  await expectWithinOne(target, 'left', 0);
});
