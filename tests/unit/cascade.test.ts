import { cascadeCSS } from '../../src/cascade.js';
import { type StyleData } from '../../src/utils.js';
import { getSampleCSS } from './../helpers.js';

describe('cascadeCSS', () => {
  it('moves position-anchor to custom property', async () => {
    const srcCSS = getSampleCSS('position-anchor');
    const { changedStyles } = await cascadeCSS([
      { css: srcCSS },
    ] as StyleData[]);
    expect(changedStyles[0].changed).toBe(true);
    const { css } = changedStyles[0];
    expect(css).toContain('--position-anchor:--my-position-anchor-b');
    expect(css).toContain('--position-anchor:--my-position-anchor-a');
  });
});
