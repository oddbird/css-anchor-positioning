import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

describe('parseCSS', () => {
  it('parses and returns @position-fallback strategy', () => {
    const css = getSampleCSS('position-fallback');
    const result = parseCSS(css);

    expect(result).toEqual({
      '--button-positioning': [
        { top: 'anchor(--my-anchor bottom)', left: 'anchor(--my-anchor left)' },
        { bottom: 'anchor(--my-anchor top)', left: 'anchor(--my-anchor left)' },
        {
          top: 'anchor(--my-anchor bottom)',
          right: 'anchor(--my-anchor right)',
        },
        {
          bottom: 'anchor(--my-anchor top)',
          right: 'anchor(--my-anchor right)',
        },
      ],
    });
  });

  it('does not find @position-fallback at-rule or anchor() function', () => {
    const result = parseCSS(sampleBaseCSS);

    expect(result).toEqual({});
  });
});
