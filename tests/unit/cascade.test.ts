import { cascadeCSS } from '../../src/cascade.js';
import { SHIFTED_PROPERTIES, type StyleData } from '../../src/utils.js';
import { getSampleCSS } from './../helpers.js';

describe('cascadeCSS', () => {
  it('moves position-anchor to custom property', async () => {
    const srcCSS = getSampleCSS('position-anchor');
    const styleData: StyleData[] = [
      { css: srcCSS, el: document.createElement('div') },
    ];
    const cascadeCausedChanges = await cascadeCSS(styleData);
    expect(cascadeCausedChanges).toBe(true);
    const { css } = styleData[0];
    expect(css).toContain(
      `${SHIFTED_PROPERTIES['position-anchor']}:--my-position-anchor-b`,
    );
    expect(css).toContain(
      `${SHIFTED_PROPERTIES['position-anchor']}:--my-position-anchor-a`,
    );
  });
});
