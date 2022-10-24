import { AnchorSide } from '../../src/parse.js';
import {
  getAxis,
  getAxisProperty,
  getPixelValue,
  GetPixelValueOpts,
  resolveLogicalKeyword,
} from '../../src/polyfill.js';

describe('resolveLogicalKeyword', () => {
  it.each([
    ['start', false, 0],
    ['start', true, 100],
    ['self-start', false, 0],
    ['self-start', true, 100],
    ['end', false, 100],
    ['end', true, 0],
    ['self-end', false, 100],
    ['self-end', true, 0],
    ['center', false, undefined],
    [10, false, 10],
    [10, true, 90],
  ] as [AnchorSide, boolean, number | undefined][])(
    'resolves logical keyword %s to %i',
    (edge, rtl, expected) => {
      const result = resolveLogicalKeyword(edge, rtl);

      expect(result).toEqual(expected);
    },
  );
});

describe('getAxis', () => {
  it.each([
    ['top', 'y'],
    ['bottom', 'y'],
    ['left', 'x'],
    ['right', 'x'],
    ['--my-var', null],
    [undefined, null],
  ])('resolves position %s to axis %s', (position, expected) => {
    const result = getAxis(position);

    expect(result).toEqual(expected);
  });
});

describe('getAxisProperty', () => {
  it.each([
    ['x', 'width'],
    ['y', 'height'],
    [null, null],
  ] as ['x' | 'y' | null, 'width' | 'height' | null][])(
    'resolves axis %s to length property %s',
    (axis, expected) => {
      const result = getAxisProperty(axis);

      expect(result).toEqual(expected);
    },
  );
});

describe('getPixelValue', () => {
  const anchorRect = {
    x: 10,
    y: 50,
    width: 20,
    height: 40,
  };
  const obj = {
    anchorRect,
    fallback: '0px',
  };

  beforeAll(() => {
    Object.defineProperty(window, 'getComputedStyle', {
      value: () => ({
        getPropertyValue: () => {
          return 'ltr';
        },
      }),
    });
  });

  it.each([
    [{ ...obj, anchorEdge: 'left', targetProperty: 'left' }, '10px'],
    [{ ...obj, anchorEdge: 'right', targetProperty: 'left' }, '30px'],
    [{ ...obj, anchorEdge: 'top', targetProperty: 'top' }, '50px'],
    [{ ...obj, anchorEdge: 'bottom', targetProperty: 'top' }, '90px'],
    [{ ...obj, anchorEdge: 'center', targetProperty: 'top' }, '70px'],
    [{ ...obj, anchorEdge: 'center', targetProperty: 'left' }, '20px'],
    [
      {
        ...obj,
        anchorEdge: 'center',
        fallback: '100px',
      },
      '100px',
    ],
    [{ ...obj, anchorEdge: 25, targetProperty: 'top', targetEl: {} }, '60px'],
    [
      {
        ...obj,
        anchorEdge: 'end',
        targetProperty: 'left',
        targetEl: {},
      },
      '30px',
    ],
    [
      {
        ...obj,
        anchorEdge: 'start',
        targetEl: {},
        fallback: '100px',
      },
      '100px',
    ],
  ] as [GetPixelValueOpts, string][])(
    'returns pixel value for anchor fn',
    (opts, expected) => {
      const result = getPixelValue(opts);

      expect(result).toEqual(expected);
    },
  );
});
