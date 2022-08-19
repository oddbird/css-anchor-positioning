import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

describe('parseCSS', () => {
  it('parses and returns @position-fallback strategy', () => {
    const css = getSampleCSS('position-fallback');
    const result = parseCSS(css);

    expect(result).toEqual({
      '--fallback1': [
        {
          top: 'anchor(--my-anchor-fallback top)',
          left: 'anchor(--my-anchor-fallback right)',
        },
        {
          right: 'anchor(--my-anchor-fallback left)',
          top: 'anchor(--my-anchor-fallback top)',
        },
        {
          left: 'anchor(--my-anchor-fallback left)',
          top: 'anchor(--my-anchor-fallback bottom)',
        },
        {
          left: 'anchor(--my-anchor-fallback left)',
          bottom: 'anchor(--my-anchor-fallback top)',
        },
        {
          left: 'anchor(--my-anchor-fallback right)',
          top: 'anchor(--my-anchor-fallback top)',
          width: '35px',
          height: '40px',
        },
      ],
    });
  });

  it('does not find @position-fallback at-rule or anchor() function', () => {
    const result = parseCSS(sampleBaseCSS);

    expect(result).toEqual({});
  });
});
