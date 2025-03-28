import { expect, type Page, test } from '@playwright/test';

import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/position-area.html');
});

const btnSelector = '#apply-polyfill';

async function applyPolyfill(page: Page) {
  const btn = page.locator(btnSelector);
  await btn.click();
  return await expect(btn).toBeDisabled();
}

test('applies polyfill for position-area`', async ({ page }) => {
  await applyPolyfill(page);
  const section = page.locator('#spanleft-top');
  const anchor = section.locator('.anchor');
  const anchorBox = await anchor.boundingBox();

  const targetWrapper = section.locator('POLYFILL-POSITION-AREA');
  const targetWrapperBox = await targetWrapper.boundingBox();
  const target = targetWrapper.locator('.target');

  await expect(target).toHaveCSS('justify-self', 'end');
  await expect(target).toHaveCSS('align-self', 'end');
  await expectWithinOne(targetWrapper, 'top', 0);
  await expectWithinOne(targetWrapper, 'left', 0);

  // Right sides should be aligned
  expect(targetWrapperBox!.x + targetWrapperBox!.width).toBeCloseTo(
    anchorBox!.x + anchorBox!.width,
    0,
  );
  // Target bottom should be aligned with anchor top
  expect(targetWrapperBox!.y + targetWrapperBox!.height).toBeCloseTo(
    anchorBox!.y,
    0,
  );
});
test('applies to declarations with different containing blocks`', async ({
  page,
}) => {
  await applyPolyfill(page);
  const section = page.locator('#different-containers');

  // get elements
  const container1 = section.getByTestId('container1');
  const container2 = section.getByTestId('container2');
  const anchor1 = container1.locator('.anchor');
  const anchor1Box = await anchor1.boundingBox();
  const anchor2 = container2.locator('.anchor');
  const anchor2Box = await anchor2.boundingBox();
  const target1Wrapper = container1.locator('POLYFILL-POSITION-AREA');
  const target1WrapperBox = await target1Wrapper.boundingBox();
  const target2Wrapper = container2.locator('POLYFILL-POSITION-AREA');
  const target2WrapperBox = await target2Wrapper.boundingBox();
  const target1 = target1Wrapper.locator('.target');
  const target2 = target2Wrapper.locator('.target');

  // test container 1
  await expect(target1).toHaveCSS('justify-self', 'start');
  await expect(target1).toHaveCSS('align-self', 'start');
  await expectWithinOne(target1Wrapper, 'bottom', 0);
  await expectWithinOne(target1Wrapper, 'right', 0);

  // Target Left should be aligned with anchor right
  expect(target1WrapperBox!.x).toBeCloseTo(
    anchor1Box!.x + anchor1Box!.width,
    0,
  );
  // Target top should be aligned with anchor bottom
  expect(target1WrapperBox!.y).toBeCloseTo(
    anchor1Box!.y + anchor1Box!.height,
    0,
  );

  // test container 2
  await expect(target2).toHaveCSS('justify-self', 'start');
  await expect(target2).toHaveCSS('align-self', 'start');
  await expectWithinOne(target2Wrapper, 'bottom', 0);
  await expectWithinOne(target2Wrapper, 'right', 0);

  // Target Left should be aligned with anchor right
  expect(target2WrapperBox!.x).toBeCloseTo(
    anchor2Box!.x + anchor2Box!.width,
    0,
  );
  // Target top should be aligned with anchor bottom
  expect(target2WrapperBox!.y).toBeCloseTo(
    anchor2Box!.y + anchor2Box!.height,
    0,
  );
});

test('respects cascade`', async ({ page }) => {
  await applyPolyfill(page);
  const section = page.locator('#spanleft-top');
  const anchor = section.locator('.anchor');
  const anchorBox = await anchor.boundingBox();

  const targetWrapper = section.locator('POLYFILL-POSITION-AREA');
  const targetWrapperBox = await targetWrapper.boundingBox();
  const target = targetWrapper.locator('.target');

  await expect(target).toHaveCSS('justify-self', 'end');
  await expect(target).toHaveCSS('align-self', 'end');
  await expectWithinOne(targetWrapper, 'top', 0);
  await expectWithinOne(targetWrapper, 'left', 0);

  // Right sides should be aligned
  expect(targetWrapperBox!.x + targetWrapperBox!.width).toBeCloseTo(
    anchorBox!.x + anchorBox!.width,
    0,
  );
  // Target bottom should be aligned with anchor top
  expect(targetWrapperBox!.y + targetWrapperBox!.height).toBeCloseTo(
    anchorBox!.y,
    0,
  );
});
