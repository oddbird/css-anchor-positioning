import fetchMock from 'fetch-mock';

import { fetchCSS } from '../../src/fetch.js';
import { sampleAnchorCSS } from '../helpers.js';

describe('fetch stylesheet', () => {
  beforeAll(() => {
    // Set up our document head
    document.head.innerHTML = `
      <link type="text/css" href="/specExample.css"/>
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
    fetchMock.getOnce('end:specExample.css', sampleAnchorCSS);
    const [inlineCSS, linkedCSS] = await fetchCSS();

    expect(inlineCSS).toHaveLength(1);
    expect(inlineCSS[0].trim()).toBe('p { color: red; }');
    expect(linkedCSS).toHaveLength(1);
    expect(linkedCSS[0].source).toBe(`${location.origin}/specExample.css`);
    expect(linkedCSS[0].css).toEqual(sampleAnchorCSS);
  });
});
