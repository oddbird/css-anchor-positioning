import { axisForPositionAreaValue } from '../../src/position-area.js';

describe('position-area', () => {
  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  describe('axisForPositionAreaValue', () => {
      it.each([
        ['block-start', 'block'],
        ['block-end', 'block'],
        ['top', 'block'],
        ['span-top', 'block'],
        ['span-self-block-end', 'block'],
        ['left', 'inline'],
        ['span-right', 'inline'],
        ['span-x-self-start', 'inline'],
        ['center', 'ambiguous'],
        ['span-all', 'ambiguous'],
        ['start', 'ambiguous'],
        ['end', 'ambiguous'],
        ['span-end', 'ambiguous'],
        ['self-span-start', 'ambiguous'],
      ])('%s as %s', (input, expected) => {
        expect(axisForPositionAreaValue(input)).toBe(expected);
      });
  });
});
