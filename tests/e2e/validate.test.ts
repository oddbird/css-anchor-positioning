import { type Page, expect, test } from '@playwright/test';

import {
  isAbsolutelyPositioned,
  isValidAnchorElement,
  validatedForPositioning,
} from '../../src/validate.js';

let sharedPage: Page;
test.describe.configure({ mode: 'parallel' });
test.beforeAll(async ({ browser }) => {
  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await sharedPage.addScriptTag({
    content: `${isAbsolutelyPositioned}\n${isValidAnchorElement}`,
  });
});

test.afterAll(async () => {
  await sharedPage.close();
});

const anchorName = '#my-anchor-positioning';
const floatingName = '#my-floating-positioning';

async function callValidFunction(sharedPage: Page) {
  return await sharedPage.evaluate(
    ([anchorName, floatingName]) => {
      const floatingElement = document.querySelector(
        floatingName,
      ) as HTMLElement;
      const anchorElement = document.querySelector(anchorName) as HTMLElement;
      return isValidAnchorElement(anchorElement, floatingElement);
    },
    [anchorName, floatingName],
  );
}

// el is a descendant of the querying element’s containing block,
// or the querying element’s containing block is the initial containing block
test("anchor is valid when it's is a descendant of the query element CB", async () => {
  await sharedPage.setContent(
    `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div style="position: relative">
          <div id="my-anchor-positioning">Anchor</div>
          <div id="my-floating-positioning">Floating</div>
        </div>
      </body>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

// el is a descendant of the querying element’s containing block,
// or the querying element’s containing block is the initial containing block
test("anchor is valid if it's not descendant of query element CB but query element CB is ICB", async () => {
  await sharedPage.setContent(
    `
      <div style="position: relative>
        <div id="my-other-anchor-positioning">Anchor</div>
        <div id="my-other-floating-positioning">Floating</div>
      </div>

      <div id="my-anchor-positioning">Anchor</div>

      <div id="my-floating-positioning">Floating<div>

  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

test("anchor is valid if it's not descendant of query element CB and query element CB is the ICB - position: fixed", async () => {
  await sharedPage.setContent(
    `
      <div id="my-floating-positioning" style="position: fixed">
        Floating
      </div>
      <div id="my-anchor-positioning">Anchor</div>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

test('anchor not descendant of query element CB and query element CB is the ICB - no positioned ancestor', async () => {
  await sharedPage.setContent(
    `
      <div id="my-floating-positioning">
        Floating
      </div>
      <div id="my-anchor-positioning">Anchor</div>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

test("anchor is NOT valid if it's not descendant of query element CB AND query element CB is not ICB", async () => {
  await sharedPage.setContent(
    `
      <div style="position: relative">
        <div id="my-other-anchor-positioning">Anchor</div>
        <div id="my-other-floating-positioning">Floating</div>
      </div>

      <div style="position: relative">
        <div id="my-anchor-positioning">Anchor</div>
      </div>

      <div style="position: relative">
        <div id="my-floating-positioning">Floating<div>
      </div>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(false);
});

// if el has the same containing block as the querying element,
// el is not absolutely positioned
test('anchor is valid when anchor has same CB as querying element and anchor is not absolutely positioned', async () => {
  await sharedPage.setContent(
    `
  <div style="position: relative">
    <div id="my-anchor-positioning">Anchor</div>
    <div id="my-floating-positioning">Floating</div>
  </div>;
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

test('anchor is NOT valid when anchor has same CB as querying element, but anchor is absolutely positioned', async () => {
  await sharedPage.setContent(
    `
  <div style="position: relative">
    <div id="my-anchor-positioning" style="position: absolute">Anchor</div>
    <div id="my-floating-positioning">Floating</div>
  </div>;
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(false);
});

// if el has a different containing block from the querying element,
// the last containing block in el’s containing block chain
// before reaching the querying element’s containing block
// is not absolutely positioned
test('anchor is valid if it has a different CB from the querying element, and the last CB in anchor CB chain block before the query element CB is not absolutely positioned', async () => {
  // HTML from WPT: https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-name-002.tentative.html
  await sharedPage.setContent(
    `
    <style>
      .relpos {
        position: relative;
      }
      .abspos {
        position: absolute;
      }
      .anchor1 {
        anchor-name: --a1;
        width: 10px;
        height: 10px;
        background: orange;
      }
      .target {
        position: absolute;
        width: anchor-size(--a1 width);
        height: 10px;
        background: lime;
      }
  </style>

    <div class="relpos">
      <div>
        <div class="relpos">
          <div class="abspos">
            <div class="relpos">
              <div
                class="anchor1"
                style="position: absolute"
                id="my-anchor-positioning"
              ></div>
              <!-- This target should not find the anchor, because the anchor is
                  positioned. -->
              <div class="target" data-expected-width="0"></div>
            </div>
            <!-- This target should find the anchor, because the last containing
                block has position: relative. -->
            <div
              class="target"
              data-expected-width="10"
              id="my-floating-positioning"
            ></div>
          </div>
        </div>
      </div>
    </div>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(true);
});

test('anchor is NOT valid if it has a different CB from the querying element, and the last CB in anchor CB chain before the query element CB is absolutely positioned', async () => {
  // HTML from WPT: https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-name-002.tentative.html
  await sharedPage.setContent(
    `
  <!DOCTYPE html>

    <style>
      .relpos {
        position: relative;
      }
      .abspos {
        position: absolute;
      }
      .anchor1 {
        anchor-name: --a1;
        width: 10px;
        height: 10px;
        background: orange;
      }
      .target {
        position: absolute;
        width: anchor-size(--a1 width);
        height: 10px;
        background: lime;
      }
    </style>
    <body>
      <div class="relpos"> Rel 1
        <div>
          <div class="relpos">Rel 1
            <div class="abspos"> Abs 1
              <div class="abspos"> Abs 2
                <div
                  class="anchor1"
                  style="position: absolute"
                  id="my-anchor-positioning"
                ></div>
                <!-- This target should not find the anchor, because the anchor is
                    positioned. -->
                <div class="target" data-expected-width="0"></div>
              </div>
              <!-- This target should find the anchor, because the last containing
                  block has position: relative. -->
              <div
                class="target"
                data-expected-width="10"
                id="my-floating-positioning"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </body>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  const result = await callValidFunction(sharedPage);

  expect(result).toBe(false);
});

test('when multiple anchor elements have the same name and are valid, the first is returned', async () => {
  // HTML from WPT: https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-name-001.tentative.html
  await sharedPage.setContent(
    `
    <style>
    .relpos {
      position: relative;
    }
    .anchor1 {
      anchor-name: --a1;
      width: 10px;
      height: 10px;
      background: orange;
    }
    .target {
      position: absolute;
      width: anchor-size(--a1 width);
      height: 10px;
      background: lime;
    }
    </style>
    <body onload="checkLayout('.target')">
      <!--
        All targets should find the 10px anchor, because it's the first
        one in the pre-order DFS from the 'relpos'.
      -->
      <div class="relpos">
        <div class="target" data-expected-width=10 id="my-floating-positioning">My Floating Element</div>
        <div class="anchor1" id="my-anchor-positioning" style="width: 10px">First Anchor Element
          <div class="anchor1" id="my-anchor-positioning" style="width: 20px">Second Anchor Element</div>
          <div class="target" data-expected-width=10></div>
        </div>
        <div class="anchor1" id="my-anchor-positioning" style="width: 30px">Third Anchor Element</div>
        <div class="target" data-expected-width=10></div>
      <div>
    </body>
  `,
    { waitUntil: 'domcontentloaded' },
  );

  await sharedPage.addScriptTag({
    content: `${validatedForPositioning}`,
  });

  const valid = await callValidFunction(sharedPage);
  expect(valid).toBe(true);

  const validationResults = await sharedPage.evaluate(
    ([anchorName, floatingName]) => {
      interface Data {
        results: {
          anchor: HTMLElement | null;
        };
        anchorWidth: string | undefined;
        anchorText: string | undefined;
      }

      const floatingElement = document.querySelector(
        floatingName,
      ) as HTMLElement;

      const validatedData = {} as Data;
      const anchor = validatedForPositioning(floatingElement, [anchorName]);

      validatedData.results = { anchor };
      validatedData.anchorWidth = anchor?.style.width;
      validatedData.anchorText = anchor?.innerHTML;

      return validatedData;
    },
    [anchorName, floatingName],
  );

  expect(validationResults.results.anchor).toBeTruthy;
  expect(validationResults.anchorText).toContain('First Anchor Element');
  expect(validationResults.anchorWidth).toBe('10px');
});
