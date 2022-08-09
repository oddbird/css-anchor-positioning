import { fetchCSS } from '../../src/fetching.js';

describe('fetch stylesheet', () => {
  beforeAll(() => {
    // Set up our document head
    document.head.innerHTML = `
      <link type="text/css" />
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

    expect(inlineCSS).toHaveLength(1);
    expect(linkedCSS).toHaveLength(2);
  });
});
