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
test('applies logical properties based on writing mode`', async ({ page }) => {
  await applyPolyfill(page);
  const section = page.getByTestId('vertical-rl-rtl');
  const anchor = section.locator('.anchor');
  const anchorBox = await anchor.boundingBox();

  const targetWrapper = section.locator('POLYFILL-POSITION-AREA');
  const targetWrapperBox = await targetWrapper.boundingBox();
  const target = targetWrapper.locator('.target');
  expect(target).toHaveText('vertical-rl rtl');

  await expect(target).toHaveCSS('justify-self', 'start');
  await expect(target).toHaveCSS('align-self', 'start');
  await expectWithinOne(targetWrapper, 'top', 0);
  await expectWithinOne(targetWrapper, 'left', 0);

  // Right side should be aligned with anchor left
  expect(targetWrapperBox!.x + targetWrapperBox!.width).toBeCloseTo(
    anchorBox!.x,
    0,
  );
  // Target bottom should be aligned with anchor top
  expect(targetWrapperBox!.y + targetWrapperBox!.height).toBeCloseTo(
    anchorBox!.y,
    0,
  );
});
test('applies logical self properties based on writing mode`', async ({
  page,
}) => {
  await applyPolyfill(page);
  const section = page.getByTestId('self-vertical-lr-rtl');
  const anchor = section.locator('.anchor');
  const anchorBox = await anchor.boundingBox();

  const targetWrapper = section.locator('POLYFILL-POSITION-AREA');
  const targetWrapperBox = await targetWrapper.boundingBox();
  const target = targetWrapper.locator('.target');
  expect(target).toHaveText('vertical-lr rtl');

  await expect(target).toHaveCSS('justify-self', 'start');
  await expect(target).toHaveCSS('align-self', 'end');
  await expectWithinOne(targetWrapper, 'top', 0);
  await expectWithinOne(targetWrapper, 'right', 0);

  // Left side should be aligned with anchor right
  expect(targetWrapperBox!.x).toBeCloseTo(anchorBox!.x + anchorBox!.width, 0);
  // Target bottom should be aligned with anchor top
  expect(targetWrapperBox!.y + targetWrapperBox!.height).toBeCloseTo(
    anchorBox!.y,
    0,
  );
});

test('does not leak alignment onto a descendant of a position-area target', async ({
  page,
}) => {
  // The alignment value props (`--pa-value-{justify,align}-self`) are set
  // directly on the wrapped target's child and registered non-inherited, so a
  // wrapped target's alignment must not leak onto a descendant (which could
  // itself be a `position-area` target relying on its own `normal` fallback).
  // Mirror the inset-leak guard in `polyfill.test.ts` for alignment; exercise
  // the `CSS.registerProperty`-absent fallback path (the universal `initial`
  // reset), where a missing reset would let the value inherit. See #438 / #279.
  await page.addInitScript(() => {
    delete (CSS as unknown as { registerProperty?: unknown }).registerProperty;
  });
  await page.goto('/position-area.html');
  expect(await page.evaluate(() => typeof CSS.registerProperty)).not.toBe(
    'function',
  );
  await applyPolyfill(page);

  const values = await page.evaluate(() => {
    // Discover the shifted `--pa-value-justify-self-<uuid>` name from the reset.
    const resetText = [...document.head.querySelectorAll('style')]
      .map((el) => el.textContent ?? '')
      .find((text) => /--pa-value-justify-self-[\w-]+:\s*initial/.test(text));
    // A missing reset is itself the regression under test (the alignment prop
    // dropped from the non-inherited set); fail with a legible message rather
    // than a cryptic "Cannot read properties of undefined" from the `.match`.
    if (!resetText) {
      throw new Error(
        'no `--pa-value-justify-self` reset found — likely dropped from ' +
          'NON_INHERITED_POSITION_AREA_PROPERTIES',
      );
    }
    const prop = resetText.match(
      /(--pa-value-justify-self-[\w-]+):\s*initial/,
    )![1];
    const target = document.getElementById('nested-alignment-target')!;
    const wrapper = target.parentElement!; // POLYFILL-POSITION-AREA
    const descendant = document.getElementById('nested-alignment-descendant')!;
    const read = (el: Element) =>
      getComputedStyle(el).getPropertyValue(prop).trim();
    return {
      wrapperTag: wrapper.tagName,
      wrapperValue: read(wrapper),
      targetValue: read(target),
      descendantValue: read(descendant),
    };
  });

  // The target is wrapped, and its own alignment resolves on the child.
  expect(values.wrapperTag).toBe('POLYFILL-POSITION-AREA');
  expect(values.targetValue).toBe('end');
  // The alignment value prop lives on the child, not the wrapper...
  expect(values.wrapperValue).toBe('');
  // ...and does not inherit down to a descendant of the target.
  expect(values.descendantValue).toBe('');
});

test.describe('with `positionAreaContainingBlock: false`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/position-area.html?no-containing-block');
  });

  test('does not wrap the target element', async ({ page }) => {
    await applyPolyfill(page);
    await expect(page.locator('polyfill-position-area')).toHaveCount(0);
    // The target is still a direct child of its original parent, so selectors
    // that rely on a direct relationship with the target keep working.
    await expect(
      page.locator('#spanleft-top .demo-elements > .target'),
    ).toHaveCount(1);
  });

  test('applies polyfill for position-area', async ({ page }) => {
    await applyPolyfill(page);
    const section = page.locator('#spanleft-top');
    const anchor = section.locator('.anchor');
    const anchorBox = await anchor.boundingBox();

    const target = section.locator('.target');
    const targetBox = await target.boundingBox();

    // Right sides should be aligned
    expect(targetBox!.x + targetBox!.width).toBeCloseTo(
      anchorBox!.x + anchorBox!.width,
      0,
    );
    // Target bottom should be aligned with anchor top
    expect(targetBox!.y + targetBox!.height).toBeCloseTo(anchorBox!.y, 0);
  });

  test('applies to declarations with different containing blocks', async ({
    page,
  }) => {
    await applyPolyfill(page);
    const section = page.locator('#different-containers');

    for (const testId of ['container1', 'container2']) {
      const container = section.getByTestId(testId);
      const anchorBox = await container.locator('.anchor').boundingBox();
      const targetBox = await container.locator('.target').boundingBox();

      // Target left should be aligned with anchor right
      expect(targetBox!.x).toBeCloseTo(anchorBox!.x + anchorBox!.width, 0);
      // Target top should be aligned with anchor bottom
      expect(targetBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
    }
  });

  test('respects cascade', async ({ page }) => {
    await applyPolyfill(page);
    const section = page.locator('#cascade');
    const anchor = section.locator('.anchor');
    const target = section.locator('#cascade-target');

    const anchorBox = await anchor.boundingBox();
    const targetBox = await target.boundingBox();

    // `right top` should win initially
    expect(targetBox!.x).toBeCloseTo(anchorBox!.x + anchorBox!.width, 0);
    expect(targetBox!.y + targetBox!.height).toBeCloseTo(anchorBox!.y, 0);

    // Switch the cascade so `right bottom` wins, and trigger a position
    // recalculation by scrolling.
    await page.locator('#switch-cascade').click();
    await page.mouse.wheel(0, 10);

    await expect(async () => {
      const aBox = await anchor.boundingBox();
      const tBox = await target.boundingBox();
      expect(tBox!.x).toBeCloseTo(aBox!.x + aBox!.width, 0);
      expect(tBox!.y).toBeCloseTo(aBox!.y + aBox!.height, 0);
    }).toPass();
  });

  test('applies logical properties based on writing mode', async ({ page }) => {
    await applyPolyfill(page);
    const section = page.getByTestId('vertical-rl-rtl');
    const anchorBox = await section.locator('.anchor').boundingBox();

    const target = section.locator('.target');
    const targetBox = await target.boundingBox();
    await expect(target).toHaveText('vertical-rl rtl');

    // Right side should be aligned with anchor left
    expect(targetBox!.x + targetBox!.width).toBeCloseTo(anchorBox!.x, 0);
    // Target bottom should be aligned with anchor top
    expect(targetBox!.y + targetBox!.height).toBeCloseTo(anchorBox!.y, 0);
  });

  test('applies logical self properties based on writing mode', async ({
    page,
  }) => {
    await applyPolyfill(page);
    const section = page.getByTestId('self-vertical-lr-rtl');
    const anchorBox = await section.locator('.anchor').boundingBox();

    const target = section.locator('.target');
    const targetBox = await target.boundingBox();
    await expect(target).toHaveText('vertical-lr rtl');

    // Left side should be aligned with anchor right
    expect(targetBox!.x).toBeCloseTo(anchorBox!.x + anchorBox!.width, 0);
    // Target bottom should be aligned with anchor top
    expect(targetBox!.y + targetBox!.height).toBeCloseTo(anchorBox!.y, 0);
  });
});

test.describe('with `positionAreaContainingBlock: auto`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/position-area.html?auto');
  });

  test('wraps only targets whose styles resolve against the containing block', async ({
    page,
  }) => {
    await applyPolyfill(page);

    // `.target.spanleft-top` has `padding-right: 50%`, which resolves against
    // the containing block, so it must be wrapped.
    await expect(
      page.locator('#spanleft-top polyfill-position-area'),
    ).toHaveCount(1);

    // `.target.center-left` has no containing-block-dependent styles, so it is
    // positioned directly, without a wrapper.
    await expect(
      page.locator('#center-left polyfill-position-area'),
    ).toHaveCount(0);
    await expect(
      page.locator('#center-left .demo-elements > .target'),
    ).toHaveCount(1);
  });

  test('positions a wrapped target correctly', async ({ page }) => {
    await applyPolyfill(page);
    const section = page.locator('#spanleft-top');
    const anchorBox = await section.locator('.anchor').boundingBox();

    const targetWrapper = section.locator('polyfill-position-area');
    const targetWrapperBox = await targetWrapper.boundingBox();
    const target = targetWrapper.locator('.target');

    await expect(target).toHaveCSS('justify-self', 'end');
    await expect(target).toHaveCSS('align-self', 'end');

    // The reason this target is wrapped: its `padding-right: 50%` must resolve
    // against the wrapper (the position-area cell), not the original parent.
    // Confirm the computed padding is half the wrapper's content width.
    const wrapperContentWidth = await targetWrapper.evaluate(
      (el) => el.clientWidth,
    );
    const paddingRight = await target.evaluate((el) =>
      parseFloat(getComputedStyle(el).paddingRight),
    );
    expect(paddingRight).toBeCloseTo(wrapperContentWidth / 2, 0);

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

  test('positions an unwrapped target correctly', async ({ page }) => {
    await applyPolyfill(page);
    const section = page.locator('#center-left');
    const anchorBox = await section.locator('.anchor').boundingBox();
    const targetBox = await section.locator('.target').boundingBox();

    // `center left`: target sits to the left of the anchor, vertically centered.
    expect(targetBox!.x + targetBox!.width).toBeCloseTo(anchorBox!.x, 0);
    expect(targetBox!.y + targetBox!.height / 2).toBeCloseTo(
      anchorBox!.y + anchorBox!.height / 2,
      0,
    );
  });
});
