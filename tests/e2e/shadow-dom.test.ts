import { expect, type Page, test } from '@playwright/test';

import { expectWithinOne } from './utils.js';

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/shadow-dom.html');
});

const btnSelector = '#apply-polyfill';

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

test('applies polyfill inside shadow root', async ({ page }) => {
  const shadowAnchorSelector =
    'anchor-web-component #shadow-anchor-positioning';
  const shadowTargetSelector =
    'anchor-web-component #shadow-target-positioning';
  const target = page.locator(shadowTargetSelector);
  const width = await getElementWidth(page, shadowAnchorSelector);
  const parentWidth = await getParentWidth(page, shadowTargetSelector);
  const parentHeight = await getParentHeight(page, shadowTargetSelector);
  const expected = parentWidth - width;

  await expect(target).toHaveCSS('top', '0px');
  await expectWithinOne(target, 'right', expected, true);

  await applyPolyfill(page);

  await expectWithinOne(target, 'top', parentHeight);
  await expectWithinOne(target, 'right', expected);
});

test('applies polyfill for adopted stylesheets in shadow root', async ({
  page,
}) => {
  const anchorSelector = 'anchor-adopted-styles .anchor';
  const anchor = page.locator(anchorSelector);

  // The empty value is `""`, so require more than one character.
  const nonEmptyValue = /.+/;
  // Before the polyfill is applied, anchor rules in adopted stylesheets are
  // stripped out, and not present in the stylesheet at all.
  await expect(anchor).not.toHaveCSS('anchor-name', nonEmptyValue);

  await applyPolyfill(page);

  // The target uses `position-area: bottom span-left`, so the polyfill wraps it
  // in a `<polyfill-position-area>` element that carries the position values.
  const targetWrapper = page.locator(
    'anchor-adopted-styles POLYFILL-POSITION-AREA',
  );
  const target = targetWrapper.locator('.target');

  // `span-left` aligns the inline (x) end; `bottom` aligns the block (y) start.
  await expect(target).toHaveCSS('justify-self', 'end');
  await expect(target).toHaveCSS('align-self', 'start');
  await expectWithinOne(targetWrapper, 'bottom', 0);
  await expectWithinOne(targetWrapper, 'left', 0);

  const anchorBox = await anchor.boundingBox();
  const targetWrapperBox = await targetWrapper.boundingBox();

  // Right sides should be aligned.
  expect(targetWrapperBox!.x + targetWrapperBox!.width).toBeCloseTo(
    anchorBox!.x + anchorBox!.width,
    0,
  );
  // Target top should be aligned with anchor bottom.
  expect(targetWrapperBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height, 0);
});

test('applies global polyfill options to adopted stylesheets in shadow root', async ({
  page,
}) => {
  // `patchAndPolyfillConstructedStylesheets()` runs the polyfill itself for
  // each shadow root, so global options must carry over into those runs. With
  // `positionAreaContainingBlock: false`, the `position-area` target must be
  // positioned directly instead of wrapped in `<polyfill-position-area>`.
  await page.addInitScript(() => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: false,
    };
  });
  await page.goto('/shadow-dom.html');

  await applyPolyfill(page);

  const wrapper = page.locator('anchor-adopted-styles POLYFILL-POSITION-AREA');
  const target = page.locator('anchor-adopted-styles .target');

  // The unwrapped path marks the target itself instead of adding a wrapper.
  await expect(target).toHaveAttribute('data-anchor-position-area');
  await expect(wrapper).toHaveCount(0);
});

test('applies explicit polyfill options to adopted stylesheets in shadow root', async ({
  page,
}) => {
  // Options given to `patchAndPolyfillConstructedStylesheets()` are forwarded
  // to the polyfill run it sets up for each shadow root, and take precedence
  // over the global options.
  await page.addInitScript(() => {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      positionAreaContainingBlock: true,
    };
  });
  await page.goto('/shadow-dom.html');

  await page.evaluate(async () => {
    // Resolved by the Vite dev server at runtime; the indirection keeps `tsc`
    // and the import linter from trying to resolve it statically.
    const fnEntry = '/src/index-fn.ts';
    const { patchAndPolyfillConstructedStylesheets } = await import(fnEntry);

    patchAndPolyfillConstructedStylesheets({
      positionAreaContainingBlock: false,
    });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      .anchor { anchor-name: --explicit-anchor; }
      .target {
        position: absolute;
        position-anchor: --explicit-anchor;
        position-area: bottom span-left;
      }
    `);

    customElements.define(
      'explicit-options',
      class extends HTMLElement {
        connectedCallback() {
          this.attachShadow({ mode: 'open' });
          this.shadowRoot!.adoptedStyleSheets = [sheet];
          this.shadowRoot!.innerHTML = `
            <div class="anchor">Anchor</div>
            <div class="target">Target</div>`;
        }
      },
    );

    document.body.append(document.createElement('explicit-options'));
  });

  const target = page.locator('explicit-options .target');
  const wrapper = page.locator('explicit-options POLYFILL-POSITION-AREA');

  // Waiting on the attribute lets the queued polyfill run finish before the
  // wrapper is asserted to be absent.
  await expect(target).toHaveAttribute('data-anchor-position-area');
  await expect(wrapper).toHaveCount(0);
});

test('positions every custom-element host sharing one constructed stylesheet', async ({
  page,
}) => {
  // Two `<position-anchor-on-host>` hosts, each linked (via `position-anchor`)
  // to its own anchor, all driven by a single shared constructed stylesheet.
  const anchors = page.locator('#host-custom-element .anchor');
  const tooltips = page.locator('#host-custom-element position-anchor-on-host');

  const getRect = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((node: HTMLElement) =>
      node.getBoundingClientRect().toJSON(),
    );

  await applyPolyfill(page);

  const count = await tooltips.count();
  expect(count).toBe(2);

  // Each host's `:host` rule uses `top: anchor(top)`, `left: anchor(center)`
  // and `translate: -50% -100%`, so every host should sit above its own anchor,
  // horizontally centered on it — not just the last one to be processed.
  for (let i = 0; i < count; i++) {
    const anchorRect = await getRect(anchors.nth(i));
    const tooltipRect = await getRect(tooltips.nth(i));
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const tooltipCenterX = tooltipRect.left + tooltipRect.width / 2;
    expect(tooltipCenterX, `host ${i} horizontal center`).toBeCloseTo(
      anchorCenterX,
      0,
    );
    expect(tooltipRect.bottom, `host ${i} sits above anchor`).toBeCloseTo(
      anchorRect.top,
      0,
    );
  }
});

test('positions a custom-element host with `position-area` in a `:host` rule', async ({
  page,
}) => {
  // The `position-area` is declared in a `:host` rule, so the element it
  // positions is the host, which lives in the *outer* tree rather than in the
  // shadow root the declaration came from. The polyfill generates a stylesheet
  // mapping the computed insets onto the target; it has to be inserted into the
  // host's own tree, since a `<style>` inside the shadow root never matches the
  // host. Without that, the `--pa-value-*` custom properties the target's
  // insets read stay undefined and the host is left unpositioned.
  await applyPolyfill(page);

  // The page has already installed the adopted-stylesheet patches, so adopting
  // a sheet into this element's shadow root queues a polyfill run for it.
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host {
        padding: 0.5em;
        position: absolute;
        position-area: top;
        white-space: nowrap;
      }
    `);

    customElements.define(
      'position-area-host-fixture',
      class extends HTMLElement {
        connectedCallback() {
          // Moving the host into the `position-area` wrapper disconnects and
          // reconnects it, so this runs more than once.
          if (this.shadowRoot) return;

          this.attachShadow({ mode: 'open' });
          this.shadowRoot!.adoptedStyleSheets = [sheet];
          this.shadowRoot!.innerHTML = '<slot></slot>';
        }
      },
    );

    const container = document.createElement('div');
    container.id = 'pa-host-fixture';
    container.setAttribute('style', 'position: relative; margin-top: 5rem');
    // Written as attribute text: the CSSOM drops `anchor-name` and
    // `position-anchor` in a browser without native support, and the polyfill
    // reads the `style` attribute.
    container.innerHTML = `
      <div class="anchor" style="anchor-name: --pa-host-fixture">Anchor</div>
      <position-area-host-fixture style="position-anchor: --pa-host-fixture">Target</position-area-host-fixture>`;
    document.body.append(container);
  });

  const anchor = page.locator('#pa-host-fixture .anchor');
  const target = page.locator('#pa-host-fixture position-area-host-fixture');
  // Playwright's CSS engine pierces open shadow roots, so a descendant
  // combinator here would also match wrappers inside the host's shadow tree.
  // The wrapper the polyfill inserts replaces the host in its own parent, so
  // scope this to direct children.
  const wrapper = page.locator('#pa-host-fixture > POLYFILL-POSITION-AREA');

  // The wrapper is added by the queued polyfill run, with or without the
  // mapping styles reaching the host's tree, so waiting on it does not mask the
  // failure this test guards against.
  await expect(wrapper).toHaveCount(1);

  // The generated mapping rules (keyed on the `data-pa-*` attributes the
  // polyfill sets on the target or its wrapper) belong in the host's tree.
  const mappingStylesInDocument = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) =>
          /data-pa-(wrapper|target)-for-/.test(rule.cssText),
        );
      } catch {
        return false;
      }
    }),
  );
  expect(mappingStylesInDocument, 'mapping styles in the host tree').toBe(true);

  // The wrapper exists as soon as the CSS is parsed, but its insets are only
  // resolved later, when the polyfill computes positions. Wait for that (this
  // assertion retries) so the measurements below cannot race it.
  await expect(wrapper).not.toHaveCSS('bottom', 'auto');

  const anchorBox = (await anchor.boundingBox())!;
  const targetBox = (await target.boundingBox())!;

  // `position-area: top` puts the target directly above the anchor.
  expect(targetBox.y + targetBox.height).toBeCloseTo(anchorBox.y, 0);
  expect(targetBox.x + targetBox.width / 2).toBeCloseTo(
    anchorBox.x + anchorBox.width / 2,
    0,
  );
});

test('positions the `position-area` on a `:host` rule demo', async ({
  page,
}) => {
  // Covers the documented `#position-area-on-host` example itself, where the
  // custom element is defined before the polyfill runs, rather than the
  // dynamically-defined fixture above.
  const anchor = page.locator('#position-area-on-host .anchor');
  const target = page.locator('#position-area-on-host position-area-on-host');
  // Scoped to a direct child: Playwright locators pierce open shadow roots.
  const wrapper = page.locator(
    '#position-area-on-host .demo-elements > POLYFILL-POSITION-AREA',
  );

  await applyPolyfill(page);

  await expect(wrapper).not.toHaveCSS('bottom', 'auto');
  const anchorBox = (await anchor.boundingBox())!;
  const targetBox = (await target.boundingBox())!;

  // `position-area: top` puts the target directly above the anchor.
  expect(targetBox.y + targetBox.height).toBeCloseTo(anchorBox.y, 0);
  expect(targetBox.x + targetBox.width / 2).toBeCloseTo(
    anchorBox.x + anchorBox.width / 2,
    0,
  );
});

test('gives each tree only its own `position-area` mapping rules', async ({
  page,
}) => {
  // One polyfill run, two style containers: the `:host` rule targets the host
  // (which lives in the outer tree, so its rules belong in `document.head`),
  // while `.inner` targets an element inside the shadow root. Each container
  // must receive its own rules, and only its own.
  await applyPolyfill(page);

  await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host { position: absolute; position-area: top; padding: 0.5em; }
      .inner-anchor { anchor-name: --inner; }
      .inner {
        position: absolute;
        position-anchor: --inner;
        position-area: bottom;
      }
    `);

    customElements.define(
      'two-container-fixture',
      class extends HTMLElement {
        connectedCallback() {
          // Moving the host into the `position-area` wrapper reconnects it.
          if (this.shadowRoot) return;

          this.attachShadow({ mode: 'open' });
          this.shadowRoot!.adoptedStyleSheets = [sheet];
          this.shadowRoot!.innerHTML = `
            <div style="position: relative; height: 80px">
              <div class="inner-anchor" style="margin-top: 20px">Inner anchor</div>
              <div class="inner">Inner target</div>
            </div>`;
        }
      },
    );

    const container = document.createElement('div');
    container.id = 'two-container';
    container.setAttribute('style', 'position: relative; margin-top: 12rem');
    container.innerHTML = `
      <div class="anchor" style="anchor-name: --two-container">Anchor</div>
      <two-container-fixture style="position-anchor: --two-container">Target</two-container-fixture>`;
    document.body.append(container);
  });

  const host = page.locator('#two-container two-container-fixture');
  const outerAnchor = page.locator('#two-container .anchor');
  const innerAnchor = host.locator('.inner-anchor');
  const innerTarget = host.locator('.inner');

  // Both wrappers must resolve their insets. Scoped to direct children, since
  // Playwright locators pierce open shadow roots and would otherwise match the
  // outer and inner wrappers together.
  await expect(
    page.locator('#two-container > POLYFILL-POSITION-AREA'),
  ).not.toHaveCSS('bottom', 'auto');
  await expect(innerTarget.locator('xpath=..')).not.toHaveCSS('top', 'auto');

  const outerAnchorBox = (await outerAnchor.boundingBox())!;
  const hostBox = (await host.boundingBox())!;
  const innerAnchorBox = (await innerAnchor.boundingBox())!;
  const innerTargetBox = (await innerTarget.boundingBox())!;

  // The host is positioned by rules in `document.head`...
  expect(hostBox.y + hostBox.height, 'host above its outer anchor').toBeCloseTo(
    outerAnchorBox.y,
    0,
  );
  // ...and the inner target by rules in the shadow root.
  expect(innerTargetBox.y, 'inner target below its inner anchor').toBeCloseTo(
    innerAnchorBox.y + innerAnchorBox.height,
    0,
  );

  // Neither container carries the other's rules. Counting rule blocks keyed on
  // a `data-pa-*-for-` attribute catches a regression to inserting the whole
  // generated stylesheet into every container.
  const ruleCounts = await page.evaluate(() => {
    const keyed = /data-pa-(wrapper|target)-for-/;
    const count = (root: Document | ShadowRoot) =>
      [...root.querySelectorAll('style[data-generated-by-polyfill]')]
        .flatMap((el) => (el.textContent ?? '').split('}'))
        .filter((rule) => keyed.test(rule)).length;
    const shadowRoot = document.querySelector(
      'two-container-fixture',
    )!.shadowRoot!;
    return { shadow: count(shadowRoot), head: count(document) };
  });

  // `.inner` needs a wrapper, which emits two rules (the wrapper's insets and
  // its `> *` alignment). The host's rules are not among them.
  expect(ruleCounts.shadow, 'rules in the shadow root').toBe(2);
  // The head holds the host's two rules plus the two for the demo section's
  // own `position-area` host.
  expect(ruleCounts.head, 'rules in the document head').toBe(4);
});

test('anchors to a pseudo-element inside a shadow root', async ({ page }) => {
  // `#shadow-pseudo-anchor::before` (a block, 100px tall) is the anchor; the
  // target uses `top: anchor(bottom)`. To measure a pseudo-element the polyfill
  // builds a temporary "fake pseudo-element" plus a `<style>` that supplies the
  // `content` and hides the real pseudo-element during measurement. That style
  // must be appended to the shadow root: a `<style>` in `document.head` does not
  // apply inside a shadow root, so the real `::before` would not be hidden and
  // would push the measured anchor (and thus the target) a full `::before`
  // height below the anchor box. See issue #425.
  const anchor = page.locator('anchor-pseudo-element #shadow-pseudo-anchor');
  const target = page.locator('anchor-pseudo-element #shadow-pseudo-target');

  await applyPolyfill(page);

  const anchorBox = await anchor.boundingBox();
  const targetBox = await target.boundingBox();

  // The anchor `<span>` wraps only the block `::before`, so their boxes match.
  // With the pseudo-element correctly hidden during measurement, the target's
  // `anchor(bottom)` resolves within the anchor's own box, so its top stays
  // above the anchor's bottom edge. Without the fix the un-hidden 100px
  // `::before` pushes the target well below that edge.
  expect(targetBox!.y).toBeCloseTo(anchorBox!.y + anchorBox!.height);
});

test('emulates non-inheritance of shifted properties inside a shadow root without `CSS.registerProperty`', async ({
  page,
}) => {
  // Without `CSS.registerProperty` (e.g. Firefox < 128) the polyfill emulates
  // non-inheritance with a universal `initial` reset. A `<style>` in
  // `document.head` can't pierce a shadow boundary, so the reset must be
  // injected into each shadow root passed in `options.roots`. See
  // https://github.com/oddbird/css-anchor-positioning/issues/279.
  await page.addInitScript(() => {
    delete (CSS as unknown as { registerProperty?: unknown }).registerProperty;
  });
  await page.goto('/shadow-dom.html');

  const result = await page.evaluate(async () => {
    // Resolved by the Vite dev server at runtime; the indirection keeps `tsc`
    // and the import linter from trying to resolve it statically.
    const fnEntry = '/src/index-fn.ts';
    const { default: polyfill } = await import(fnEntry);

    // A scroll container inside a shadow root sets an explicit `height` (a
    // shifted sizing property); its descendant target never sets one.
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>.container { height: 400px; overflow: scroll; position: static; }</style>
      <div class="container">
        <span id="s-anchor" style="anchor-name: --s-anchor">anchor</span>
        <div id="s-target"
             style="position: absolute; position-anchor: --s-anchor; top: anchor(bottom)">target</div>
      </div>`;

    await polyfill({ roots: [shadow] });

    // Discover the shifted `--height-<uuid>` name from the reset in the shadow.
    const resetText = [...shadow.querySelectorAll('style')]
      .map((el) => el.textContent ?? '')
      .find((text) => /--height-[\w-]+:\s*initial/.test(text));
    const heightProp = resetText?.match(/(--height-[\w-]+):\s*initial/)?.[1];
    const container = shadow.querySelector('.container') as HTMLElement;
    const target = shadow.getElementById('s-target') as HTMLElement;
    return {
      resetInShadow: Boolean(resetText),
      containerHeight: heightProp
        ? getComputedStyle(container).getPropertyValue(heightProp).trim()
        : null,
      targetHeight: heightProp
        ? getComputedStyle(target).getPropertyValue(heightProp).trim()
        : null,
    };
  });

  // The reset was injected into the shadow root, and the descendant target
  // reads the shifted value back as empty instead of inheriting the container's.
  expect(result.resetInShadow).toBe(true);
  expect(result.containerHeight).toBe('400px');
  expect(result.targetHeight).toBe('');
});
