import { fetchCSS } from '../../src/fetching.js';

describe('fetch stylesheet', () => {
  beforeAll(() => {
    // Set up our document head
    document.head.innerHTML = `
      <link type="text/css" href="specExample.css"/>
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

  it('fetches CSS', () => {
    const [inlineCSS, linkedCSS] = fetchCSS();

    console.log("inline -------", inlineCSS);
    console.log("linked ---0------->", linkedCSS);

    expect(inlineCSS).toHaveLength(1);
    expect(linkedCSS).toHaveLength(1);
  });
});
