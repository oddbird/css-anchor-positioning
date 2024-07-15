import { cascadeCSS } from '../../src/cascade.js';
import {
  INSTANCE_UUID,
  POSITION_ANCHOR_PROPERTY,
  type StyleData,
} from '../../src/utils.js';
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
    expect(css).toContain(`${POSITION_ANCHOR_PROPERTY}:--my-position-anchor-b`);
    expect(css).toContain(`${POSITION_ANCHOR_PROPERTY}:--my-position-anchor-a`);
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
