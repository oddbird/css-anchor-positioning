import fetchMock from 'fetch-mock';

import { fetchCSS } from '../../src/fetch.js';
import { getSampleCSS } from '../helpers.js';

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
    fetchMock.getOnce('end:sample.css', css);
    const styleData = await fetchCSS();

    expect(styleData).toHaveLength(2);
    expect(styleData[0].source).toBe(`${location.origin}/sample.css`);
    expect(styleData[0].css).toEqual(css);
    expect(styleData[1].source).toBe('style');
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
          Floating
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
    fetchMock.getOnce('end:sample.css', css);
    const styleData = await fetchCSS();

    expect(styleData).toHaveLength(4);
    expect(styleData[2].source).toBe('style');
    expect(styleData[3].source).toBe('style');
    expect(styleData[2].css.trim()).toContain('[data-anchor-polyfill=');
    expect(styleData[2].css.trim()).toContain(
      'top: anchor(--my-anchor-in-line end)',
    );
    expect(styleData[3].css.trim()).toContain('[data-anchor-polyfill=');
    expect(styleData[3].css.trim()).toContain(
      'anchor-name: --my-anchor-in-line',
    );
  });
});
