import { removeAnchorCSS } from '../../src/transform';
import { sampleAnchorCSS } from '../helpers';

describe('remove anchor positioning CSS from source CSS', () => {
  it('parses and removes new anchor positioning CSS after transformation to JS', () => {
    const result = removeAnchorCSS(sampleAnchorCSS);

    expect(result).not.toBe(sampleAnchorCSS);
    expect(result).not.toContain('position-fallback');
    expect(result).not.toContain('@position-fallback');
    expect(result).not.toContain('@try');
  });
});
