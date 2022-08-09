import { parseCSS } from '../../src/parsing.js';
import { sampleAnchorCSS, sampleNoAnchorCSS } from './../helpers.js';

describe('parseCSS', () => {
  it('parses and returns @position-fallback strategy', () => {
    const result = parseCSS(sampleAnchorCSS);

    expect(result).toEqual({
      '--button-popup': [
        { top: 'anchor(--button bottom)', left: 'anchor(--button left)' },
        { bottom: 'anchor(--button top)', left: 'anchor(--button left)' },
        { top: 'anchor(--button bottom)', right: 'anchor(--button right)' },
        { bottom: 'anchor(--button top)', right: 'anchor(--button right)' },
      ],
    });
  });

  it('does not find @position-fallback at-rule or anchor() function', () => {
    const result = parseCSS(sampleNoAnchorCSS);

    expect(result).toEqual({});
  });
});
