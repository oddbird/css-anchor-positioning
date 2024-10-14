import fetchMock from 'fetch-mock';

import { fetchCSS } from '../../src/fetch.js';
import { getSampleCSS, requestWithCSSType } from '../helpers.js';

describe('fetch stylesheet', () => {
  beforeAll(() => {
    // Set up our document head
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css"/>
      <link rel="stylesheet" />
      <link />
      <style>
        p { color: red; }
      </style>
    `;
  });

  afterAll(() => {
    document.head.innerHTML = '';
  });

  it('fetches CSS', async () => {
    const css = getSampleCSS('anchor-positioning');
    fetchMock.getOnce('end:sample.css', requestWithCSSType(css));
    const styleData = await fetchCSS();

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
    const styleData = await fetchCSS();

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
    const styleData = await fetchCSS([]);

    expect(styleData).toHaveLength(2);
  });

  it('fetches nothing if `elements` is empty and exclusing inline styles', async () => {
    const styleData = await fetchCSS([], true);

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

    const styleData = await fetchCSS(
      [
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
      true,
    );

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
