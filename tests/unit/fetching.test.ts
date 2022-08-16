import fetchMock from 'fetch-mock-jest';

import { fetchCSS } from '../../src/fetching.js';
import { sampleAnchorCSS } from './../helpers.js';

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
    expect(linkedCSS).toHaveLength(1);
  });
});
