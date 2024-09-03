import { cascadeCSS, SHIFTED_PROPERTIES } from '../../src/cascade.js';
import { INSTANCE_UUID, type StyleData } from '../../src/utils.js';
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
  it('adds insets with anchors as custom properties', async () => {
    const srcCSS = getSampleCSS('position-try-tactics');
    const styleData: StyleData[] = [
      { css: srcCSS, el: document.createElement('div') },
    ];
    const cascadeCausedChanges = await cascadeCSS(styleData);
    expect(cascadeCausedChanges).toBe(true);
    const { css } = styleData[0];
    expect(css).toContain(`--bottom-${INSTANCE_UUID}:anchor(top)`);
    expect(css).toContain(`--left-${INSTANCE_UUID}:anchor(right)`);
  });
});
