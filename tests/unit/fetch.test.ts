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
