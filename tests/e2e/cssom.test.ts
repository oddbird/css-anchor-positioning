import { expect, type Page, test } from '@playwright/test';

// `patchCSSOM()` makes the anchor positioning properties the polyfill supports
// settable through the CSSOM. Without it a browser with no native anchor
// positioning drops those assignments, so they never reach the `style`
// attribute the polyfill reads. Each test here wires a demo up the way a design
// system component would -- from JavaScript, never from CSS text -- and checks
// that the polyfill acted on it.

test.beforeEach(async ({ page }) => {
  // Listen for all console logs
  // eslint-disable-next-line no-console
  page.on('console', (msg) => console.log(msg.text()));
  await page.goto('/');
});

interface Box {
  top: number;
  left: number;
  bottom: number;
}

/**
 * Adds `styles` and `html` to the page, applies `cssom` -- `[id, property,
 * value]`, set through `CSSStyleDeclaration` -- and polyfills the page. Returns
 * each requested element's box relative to the element with id `container`.
 *
 * Note that only valid declarations can be set inline here: a CSSOM write
 * re-serializes the declaration block from what the browser parsed, dropping
 * the `anchor()` values it does not understand. Those belong in `styles`.
 */
async function polyfillWithCSSOM(
  page: Page,
  {
    styles,
    html,
    cssom,
    ids,
  }: {
    styles: string;
    html: string;
    cssom: [string, string, string][];
    ids: string[];
  },
): Promise<Record<string, Box>> {
  return await page.evaluate(
    async ({ styles, html, cssom, ids }) => {
      // Resolved by the Vite dev server at runtime; the indirection keeps `tsc`
      // and the import linter from trying to resolve it statically.
      const fnEntry = '/src/index-fn.ts';
      const { default: polyfill, patchCSSOM } = await import(fnEntry);

      // Before any value is set: an assignment made before the patch is
      // installed is dropped like any other.
      patchCSSOM();

      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.append(styleEl);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.append(wrapper);

      for (const [id, property, value] of cssom) {
        const el = document.getElementById(id)!;
        // Both spellings go through the patch: the camel-case property and the
        // dashed `setProperty()` form.
        if (property.includes('-')) {
          el.style.setProperty(property, value);
        } else {
          (el.style as unknown as Record<string, string>)[property] = value;
        }
      }

      await polyfill();

      const container = document
        .getElementById('container')!
        .getBoundingClientRect();
      const boxes: Record<string, Box> = {};
      for (const id of ids) {
        const { top, left, bottom } = document
          .getElementById(id)!
          .getBoundingClientRect();
        boxes[id] = {
          top: top - container.top,
          left: left - container.left,
          bottom: bottom - container.top,
        };
      }
      return boxes;
    },
    { styles, html, cssom, ids },
  );
}

test('applies a `position-area` set through the CSSOM', async ({ page }) => {
  const boxes = await polyfillWithCSSOM(page, {
    styles: '',
    html: `
      <div id="container" style="position: relative; width: 300px; height: 300px">
        <div id="anchor" style="position: absolute; top: 150px; left: 100px; width: 60px; height: 20px"></div>
        <div id="target" style="position: absolute; width: 40px; height: 30px"></div>
      </div>`,
    cssom: [
      ['anchor', 'anchorName', '--cssom-position-area'],
      ['target', 'position-anchor', '--cssom-position-area'],
      ['target', 'positionArea', 'top'],
    ],
    ids: ['anchor', 'target'],
  });

  // `position-area: top` puts the target's bottom edge on the anchor's top
  // edge. Its static position is the top of the container, so this only holds
  // if the `position-area` was seen.
  expect(boxes.target.bottom).toBeCloseTo(boxes.anchor.top, 0);
});

test('applies an `anchor-scope` set through the CSSOM', async ({ page }) => {
  const boxes = await polyfillWithCSSOM(page, {
    styles: `
      #inside, #outside {
        position: absolute;
        top: anchor(bottom);
        left: anchor(right);
        width: 20px;
        height: 20px;
      }`,
    html: `
      <div id="container" style="position: relative; width: 300px; height: 300px">
        <div id="scope" style="position: relative; width: 200px; height: 100px">
          <div id="anchor" style="position: absolute; top: 20px; left: 20px; width: 60px; height: 20px"></div>
          <div id="inside"></div>
        </div>
        <div id="outside"></div>
      </div>`,
    cssom: [
      ['anchor', 'anchorName', '--cssom-anchor-scope'],
      ['scope', 'anchorScope', '--cssom-anchor-scope'],
      ['inside', 'position-anchor', '--cssom-anchor-scope'],
      ['outside', 'position-anchor', '--cssom-anchor-scope'],
    ],
    ids: ['anchor', 'inside', 'outside'],
  });

  // Inside the scope the anchor resolves, so the target sits on its
  // bottom-right corner.
  expect(boxes.inside.top).toBeCloseTo(boxes.anchor.bottom, 0);
  expect(boxes.inside.left).toBeCloseTo(80, 0);
  // Outside it the name is out of scope, so `anchor()` never resolves and the
  // target stays at its static position -- below the 100px-tall scope element,
  // not on the anchor.
  expect(boxes.outside.top).toBeCloseTo(100, 0);
  expect(boxes.outside.left).toBeCloseTo(0, 0);
});

test('applies `position-try-fallbacks` set through the CSSOM', async ({
  page,
}) => {
  const boxes = await polyfillWithCSSOM(page, {
    styles: `
      #target {
        position: absolute;
        top: anchor(bottom);
        left: anchor(left);
        width: 40px;
        height: 100px;
      }
      @position-try --cssom-flip {
        bottom: anchor(top);
        top: revert;
      }`,
    html: `
      <div id="container" style="position: relative; width: 300px; height: 300px">
        <div id="anchor" style="position: absolute; top: 250px; left: 40px; width: 60px; height: 20px"></div>
        <div id="target"></div>
      </div>`,
    cssom: [
      ['anchor', 'anchorName', '--cssom-position-try'],
      ['target', 'position-anchor', '--cssom-position-try'],
      ['target', 'positionTryFallbacks', '--cssom-flip'],
    ],
    ids: ['anchor', 'target'],
  });

  // The target is anchored horizontally, which only holds if `anchor()`
  // resolved -- guarding against a trivial pass where nothing was positioned.
  expect(boxes.target.left).toBeCloseTo(boxes.anchor.left, 0);
  // The base position (below the anchor) overflows the 300px container, so the
  // fallback flips the target above its anchor.
  expect(boxes.target.bottom).toBeCloseTo(boxes.anchor.top, 0);
});

test('applies the `position-try` shorthand set through the CSSOM', async ({
  page,
}) => {
  const boxes = await polyfillWithCSSOM(page, {
    styles: `
      #target {
        position: absolute;
        top: anchor(bottom);
        left: anchor(left);
        width: 40px;
        height: 100px;
      }
      @position-try --cssom-shorthand-flip {
        bottom: anchor(top);
        top: revert;
      }`,
    html: `
      <div id="container" style="position: relative; width: 300px; height: 300px">
        <div id="anchor" style="position: absolute; top: 250px; left: 40px; width: 60px; height: 20px"></div>
        <div id="target"></div>
      </div>`,
    cssom: [
      ['anchor', 'anchorName', '--cssom-shorthand'],
      ['target', 'position-anchor', '--cssom-shorthand'],
      // The shorthand carries a `position-try-order` as well, which the
      // polyfill parses but does not act on (see the README limitations).
      ['target', 'positionTry', 'most-height --cssom-shorthand-flip'],
    ],
    ids: ['anchor', 'target'],
  });

  expect(boxes.target.left).toBeCloseTo(boxes.anchor.left, 0);
  expect(boxes.target.bottom).toBeCloseTo(boxes.anchor.top, 0);
});

test('keeps working when the same properties are set again', async ({
  page,
}) => {
  // A CSSOM write re-serializes the declaration block, so a second write has to
  // find the value the polyfill left behind rather than a property the browser
  // has already dropped.
  const boxes = await polyfillWithCSSOM(page, {
    styles: `
      #target {
        position: absolute;
        top: anchor(bottom);
        left: anchor(right);
        width: 20px;
        height: 20px;
      }`,
    html: `
      <div id="container" style="position: relative; width: 300px; height: 300px">
        <div id="anchor" style="position: absolute; top: 20px; left: 20px; width: 60px; height: 20px"></div>
        <div id="other" style="position: absolute; top: 150px; left: 150px; width: 60px; height: 20px"></div>
        <div id="target"></div>
      </div>`,
    cssom: [
      ['anchor', 'anchorName', '--cssom-first'],
      ['other', 'anchorName', '--cssom-second'],
      ['target', 'position-anchor', '--cssom-first'],
      // Re-pointed at the other anchor before the polyfill runs.
      ['target', 'position-anchor', '--cssom-second'],
    ],
    ids: ['anchor', 'other', 'target'],
  });

  expect(boxes.target.top).toBeCloseTo(boxes.other.bottom, 0);
  expect(boxes.target.left).toBeCloseTo(210, 0);
});
