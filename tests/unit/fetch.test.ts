import fetchMock from 'fetch-mock';

import { fetchCSS, hasInlineAnchorStyles } from '../../src/fetch.js';
import { getSampleCSS, requestWithCSSType } from '../helpers.js';

describe('fetch stylesheet', () => {
  beforeAll(() => {
    // Set up our document head
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css" />
      <link rel="stylesheet" />
      <link />
      <style>
        p { color: red; }
      </style>
    `;
    // `fetchCSS` scans the whole document for inline anchor styles, so clear the
    // body too: otherwise an anchor-styled element leaked into a shared document
    // by another test would be collected as an extra stylesheet here.
    document.body.innerHTML = '';
  });

  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('fetches CSS', async () => {
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', requestWithCSSType(css));
    const styleData = await fetchCSS({
      roots: [document],
      positionAreaContainingBlock: true,
    });

    expect(styleData).toHaveLength(2);
    expect(styleData[0].url?.toString()).toBe(`${location.origin}/sample.css`);
    expect(styleData[0].css).toEqual(css);
    expect(styleData[1].url).toBeUndefined();
    expect(styleData[1].css.trim()).toBe('p { color: red; }');
  });
});

describe('fetch inline styles', () => {
  beforeAll(() => {
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css"/>
      <link rel="stylesheet" />
      <link />
      <style>
        p { color: red; }
      </style>
    `;
    document.body.innerHTML = `
      <div style="position: relative">
        <div
          class="shared-class"
          style="
            position: absolute;
            top: anchor(--my-anchor-in-line end);
            left: anchor(--my-anchor-in-line end);
            background: green;
          "
        >
          Target
        </div>
        <div
          class="shared-class"
          id="my-anchor-in-line"
          style="
            anchor-name: --my-anchor-in-line;
            background: orange;
            margin-left: 100px;
            margin-top: 100px;
            width: 100px;
            height: 100px;
          "
        >
          Anchor
        </div>
      </div>
    `;
  });

  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('fetch returns inline CSS', async () => {
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', requestWithCSSType(css));
    const styleData = await fetchCSS({
      roots: [document],
      positionAreaContainingBlock: true,
    });

    expect(styleData).toHaveLength(4);
    expect(styleData[2].url).toBeUndefined();
    expect(styleData[3].url).toBeUndefined();
    expect(styleData[2].css.trim()).toContain('[data-has-inline-styles=');
    expect(styleData[2].css.trim()).toContain(
      'top: anchor(--my-anchor-in-line end)',
    );
    expect(styleData[3].css.trim()).toContain('[data-has-inline-styles=');
    expect(styleData[3].css.trim()).toContain(
      'anchor-name: --my-anchor-in-line',
    );
  });
});

describe('fetch styles manually', () => {
  let target5Css: string;
  let target6Css: string;

  beforeAll(() => {
    document.head.innerHTML = `
      <style id="el1">
        .anchor { anchor-name: --anchor }
      </style>
      <style id="el2">
        .target1 {
          position: absolute;
          right: anchor(--anchor left);
          bottom: anchor(--anchor top);
        }
      </style>
      <style>
        .target2 {
          position: absolute;
          left: anchor(--anchor right);
          bottom: anchor(--anchor top);
        }
      </style>
      <link rel="stylesheet" href="/target5.css" id="el3" />
      <link rel="stylesheet" href="/target6.css" />
    `;
    document.body.innerHTML = `
      <div class="anchor">Anchor</div>
      <div class="target1">Target 1</div>
      <div class="target2">Target 2</div>
      <div class="target3" id="el4" style="
        position: absolute;
        right: anchor(--anchor left);
        top: anchor(--anchor bottom);
      ">Target 3</div>
      <div class="target4" style="
        position: absolute;
        left: anchor(--anchor right);
        top: anchor(--anchor bottom);
      ">Target 3</div>
      <div class="target5" id="el5">Target 5</div>
      <div class="target6">Target 6</div>
    `;
    target5Css = `
      .target5 {
        position: absolute;
        left: anchor(--anchor center);
        bottom: anchor(--anchor top);
      }
    `;
    target6Css = `
      .target6 {
        position: absolute;
        left: anchor(--anchor center);
        top: anchor(--anchor bottom);
      }
    `;
  });

  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('fetches only inline styles if `elements` is empty', async () => {
    const styleData = await fetchCSS({
      roots: [document],
      elements: [],
      positionAreaContainingBlock: true,
    });

    expect(styleData).toHaveLength(2);
  });

  it('fetches nothing if `elements` is empty and exclusing inline styles', async () => {
    const styleData = await fetchCSS({
      roots: [document],
      elements: [],
      excludeInlineStyles: true,
      positionAreaContainingBlock: true,
    });

    expect(styleData).toHaveLength(0);
  });

  it('fetches styles only from the given elements', async () => {
    fetchMock.getOnce('end:target5.css', requestWithCSSType(target5Css));
    fetchMock.getOnce('end:target6.css', requestWithCSSType(target6Css));

    const el1 = document.getElementById('el1')!;
    const el2 = document.getElementById('el2')!;
    const el3 = document.getElementById('el3')!;
    const el4 = document.getElementById('el4')!;
    const el5 = document.getElementById('el5')!;

    const styleData = await fetchCSS({
      roots: [document],
      elements: [
        el1,
        el2,
        el3,
        el4,
        // should be ignored
        el5,
        // @ts-expect-error should be ignored
        undefined,
        // @ts-expect-error should be ignored
        null,
        // @ts-expect-error should be ignored
        123,
      ],
      excludeInlineStyles: true,
    });

    expect(styleData).toHaveLength(4);

    expect(styleData[0].el).toBe(el1);
    expect(styleData[0].url).toBeUndefined();
    expect(styleData[0].css).toContain('anchor-name: --anchor');

    expect(styleData[1].el).toBe(el2);
    expect(styleData[1].url).toBeUndefined();
    expect(styleData[1].css).toContain('right: anchor(--anchor left);');
    expect(styleData[1].css).toContain('bottom: anchor(--anchor top);');

    expect(styleData[2].el).toBe(el3);
    expect(styleData[2].url?.toString()).toBe(`${location.origin}/target5.css`);
    expect(styleData[2].css).toContain('left: anchor(--anchor center);');
    expect(styleData[2].css).toContain('bottom: anchor(--anchor top);');

    expect(styleData[3].el).toBe(el4);
    expect(styleData[3].url).toBeUndefined();
    expect(styleData[3].css.trim()).toContain('[data-has-inline-styles=');
    expect(styleData[3].css).toContain('right: anchor(--anchor left);');
    expect(styleData[3].css).toContain('top: anchor(--anchor bottom);');
  });
});

describe('hasInlineAnchorStyles', () => {
  function elWithStyle(style: string) {
    const el = document.createElement('div');
    el.setAttribute('style', style);
    return el;
  }

  it('returns false when the element has no style attribute', () => {
    const el = document.createElement('div');
    expect(hasInlineAnchorStyles(el)).toBe(false);
  });

  it('returns false for an empty style attribute', () => {
    expect(hasInlineAnchorStyles(elWithStyle(''))).toBe(false);
  });

  it.each([
    ['color', 'color: red;'],
    ['background', 'background: blue;'],
    ['font-weight', 'font-weight: bold;'],
    ['display', 'display: flex;'],
    ['z-index', 'z-index: 1;'],
    ['clear', 'clear: both;'],
    ['vertical-align', 'vertical-align: middle;'],
    ['letter-spacing', 'letter-spacing: 1px;'],
    ['box-sizing', 'box-sizing: border-box;'],
  ])(
    'returns false for %s, which is unrelated to the polyfill',
    (_name, style) => {
      expect(hasInlineAnchorStyles(elWithStyle(style))).toBe(false);
    },
  );

  // Don't match terms that appear in other property names or values.
  it.each([
    ['border-top (contains "top")', 'border-top: 1px solid red;'],
    ['border-left-width (contains "left")', 'border-left-width: 2px;'],
    ['line-height (contains "height")', 'line-height: 1.5;'],
    ['float: left (contains "left")', 'float: left;'],
    ['text-align: right (contains "right")', 'text-align: right;'],
    ['outline-width (contains "width")', 'outline-width: 1px;'],
    [
      'background-position: top (contains "top")',
      'background-position: top right;',
    ],
    ['column-width (contains "width")', 'column-width: 100px;'],
    ['transform-origin: top left', 'transform-origin: top left;'],
    ['term as custom property', '--anchor: anchor(--my-anchor);'],
  ])('returns false for %s', (_name, style) => {
    expect(hasInlineAnchorStyles(elWithStyle(style))).toBe(false);
  });

  it.each([
    ['anchor()', 'top: anchor(--my-anchor end);'],
    ['anchor-name', 'anchor-name: --my-anchor;'],
    ['anchor-scope', 'anchor-scope: --my-anchor;'],
    ['position-anchor', 'position-anchor: --my-anchor;'],
    ['position-area', 'position-area: top;'],
    ['an inset longhand', 'inset-block-start: 1px;'],
    ['a plain inset property', 'top: 1px;'],
    ['a margin longhand', 'margin-inline-start: 1px;'],
    ['a plain margin property', 'margin-left: 1px;'],
    ['a sizing property', 'width: 100px;'],
    ['a min-sizing longhand', 'min-inline-size: 100px;'],
    ['a padding longhand', 'padding-inline-start: 1px;'],
    ['a plain padding property', 'padding: 1px;'],
    ['a self-alignment property', 'justify-self: center;'],
  ])('returns true when the style includes %s', (_name, style) => {
    expect(hasInlineAnchorStyles(elWithStyle(style))).toBe(true);
  });

  it('matches regardless of where the relevant declaration falls', () => {
    const el = elWithStyle('color: red; anchor-name: --my-anchor; z-index: 1;');
    expect(hasInlineAnchorStyles(el)).toBe(true);
  });
});
