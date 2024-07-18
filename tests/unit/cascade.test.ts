import { cascadeCSS } from '../../src/cascade.js';
import { POSITION_ANCHOR_PROPERTY, type StyleData } from '../../src/utils.js';
import { getSampleCSS } from './../helpers.js';

describe('cascadeCSS', () => {
  it('moves position-anchor to custom property', async () => {
    const srcCSS = getSampleCSS('position-anchor');
    const styleData: StyleData[] = [
      { css: srcCSS, el: document.createElement('div'), original: srcCSS },
    ];
    const cascadeCausedChanges = await cascadeCSS(styleData);
    expect(cascadeCausedChanges).toBe(true);
    const { css } = styleData[0];
    expect(css).toContain(`${POSITION_ANCHOR_PROPERTY}:--my-position-anchor-b`);
    expect(css).toContain(`${POSITION_ANCHOR_PROPERTY}:--my-position-anchor-a`);
  });
});
