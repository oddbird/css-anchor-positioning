import { SHIFTED_PROPERTIES } from '../../src/cascade.js';
import { cascadeCSSForTest, getSampleCSS } from './../helpers.js';

describe('cascadeCSS', () => {
  it('moves position-anchor to custom property', () => {
    const srcCSS = getSampleCSS('position-anchor');
    const css = cascadeCSSForTest(srcCSS);
    expect(css).toContain(
      `${SHIFTED_PROPERTIES['position-anchor']}:--my-position-anchor-b`,
    );
    expect(css).toContain(
      `${SHIFTED_PROPERTIES['position-anchor']}:--my-position-anchor-a`,
    );
  });
});
