/**
 * If not using the `test.globals: true` config.
 * Probably better for a TypeScript setup.
 */
// import { describe, beforeAll, afterAll, it, expect } from 'vitest';
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
