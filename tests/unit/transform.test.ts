import { removeAnchorCSS } from '../../src/transform.js';
import { getSampleCSS } from '../helpers.js';

describe('remove anchor positioning CSS from source CSS', () => {
  it('parses and removes new anchor positioning CSS after transformation to JS', () => {
    const css = getSampleCSS('position-fallback');
    const result = removeAnchorCSS(css);

    expect(result).not.toBe(css);
    expect(result).not.toContain('position-fallback');
    expect(result).not.toContain('@position-fallback');
    expect(result).not.toContain('@try');
  });

  // invalid selection
  // different declaration combinations
  //
});
