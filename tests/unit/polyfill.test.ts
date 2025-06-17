import {
  getAxis,
  getAxisProperty,
  getPixelValue,
  type GetPixelValueOpts,
  polyfill,
  resolveLogicalSideKeyword,
  resolveLogicalSizeKeyword,
} from '../../src/polyfill.js';
import { type AnchorSide, type AnchorSize } from '../../src/syntax.js';
import { cssParseErrors } from '../../src/utils.js';

describe('resolveLogicalSideKeyword', () => {
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
    'resolves logical side keyword %s to %i',
    (side, rtl, expected) => {
      const result = resolveLogicalSideKeyword(side, rtl);

      expect(result).toEqual(expected);
    },
  );
});

describe('resolveLogicalSizeKeyword', () => {
  it.each([
    ['block', false, 'height'],
    ['block', true, 'width'],
    ['self-block', false, 'height'],
    ['self-block', true, 'width'],
    ['inline', false, 'width'],
    ['inline', true, 'height'],
    ['self-inline', false, 'width'],
    ['self-inline', true, 'height'],
  ] as [AnchorSize, boolean, string | undefined][])(
    'resolves logical size keyword %s to %s',
    (size, vertical, expected) => {
      const result = resolveLogicalSizeKeyword(size, vertical);

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

describe('getPixelValue [anchor() fn]', () => {
  const anchorRect = {
    x: 10,
    y: 50,
    width: 20,
    height: 40,
  };
  const obj = {
    anchorRect,
    fallback: '0px',
    targetEl: document.createElement('test'),
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
    [{ ...obj, anchorSide: 'left', targetProperty: 'left' }, '10px'],
    [
      { ...obj, anchorSide: 'left', targetProperty: 'left', targetEl: null },
      '0px',
    ],
    [{ ...obj, anchorSide: 'left', targetProperty: 'top' }, '0px'],
    [{ ...obj, anchorSide: 'left', targetProperty: 'width' }, '0px'],
    [{ ...obj, anchorSide: 'right', targetProperty: 'left' }, '30px'],
    [{ ...obj, anchorSide: 'top', targetProperty: 'top' }, '50px'],
    [{ ...obj, anchorSide: 'bottom', targetProperty: 'top' }, '90px'],
    [{ ...obj, anchorSide: 'center', targetProperty: 'top' }, '70px'],
    [{ ...obj, anchorSide: 'center', targetProperty: 'left' }, '20px'],
    [
      {
        ...obj,
        anchorSide: 'center',
        fallback: '100px',
      },
      '100px',
    ],
    [{ ...obj, anchorSide: 25, targetProperty: 'top' }, '60px'],
    [
      {
        ...obj,
        anchorSide: 'end',
        targetProperty: 'left',
      },
      '30px',
    ],
    [
      {
        ...obj,
        anchorSide: 'start',
        fallback: '100px',
      },
      '100px',
    ],
  ] as [GetPixelValueOpts, string][])(
    'returns pixel value for anchor fn',
    async (opts, expected) => {
      const result = await getPixelValue(opts);

      expect(result).toEqual(expected);
    },
  );
});

describe('getPixelValue [anchor-size() fn]', () => {
  const anchorRect = {
    x: 10,
    y: 50,
    width: 20,
    height: 40,
  };
  const obj = {
    anchorRect,
    fallback: '0px',
    targetEl: document.createElement('test'),
  };

  beforeAll(() => {
    Object.defineProperty(window, 'getComputedStyle', {
      value: () => ({
        getPropertyValue: () => {
          return 'horizontal-tb';
        },
      }),
    });
  });

  it.each([
    [{ ...obj, anchorSize: 'width', targetProperty: 'width' }, '20px'],
    [{ ...obj, anchorSize: 'width', targetProperty: 'color' }, '0px'],
    [{ ...obj, anchorSize: 'foo', targetProperty: 'width' }, '0px'],
    [{ ...obj, anchorSize: 'block', targetProperty: 'height' }, '40px'],
    [
      { ...obj, anchorSize: 'width', targetProperty: 'width', targetEl: null },
      '0px',
    ],
  ] as [GetPixelValueOpts, string][])(
    'returns pixel value for anchor fn',
    async (opts, expected) => {
      const result = await getPixelValue(opts);

      expect(result).toEqual(expected);
    },
  );
});

const makeElements = (css) => {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = css;
  return [styleEl];
};

describe('polyfill', () => {
  let consoleGroup;
  let consoleWarn;
  beforeEach(() => {
    consoleGroup = vi.spyOn(console, 'group').mockImplementation(() => null);
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => null);
  });

  afterAll(() => {
    consoleGroup.mockReset();
    consoleWarn.mockReset();
  });
  it('describes parse error on polyfill failure', async () => {
    const elements = makeElements('.a-[1] { position-area: end; }');

    await expect(polyfill({ elements })).rejects.toThrow(
      'Cannot read properties',
    );
    expect(cssParseErrors).toHaveLength(1);
    expect(consoleGroup).toHaveBeenCalledWith(
      'The CSS anchor positioning polyfill was not applied due to a CSS parse error.',
    );
    expect(consoleWarn.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "Parse error: Identifier is expected
          1 |.a-[1] { position-area: end; }
      -----------^",
      ]
    `);
  });
  it('does not report parse errors when polyfill succeeds', async () => {
    const elements = makeElements('.a {width: var(a-[1a])}');

    await expect(polyfill({ elements })).resolves.toBeDefined();
    expect(cssParseErrors).toHaveLength(1);
    expect(consoleGroup).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
  it('parse errors do not persist across polyfill calls', async () => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = '.a {width: var(a-[1a])}';
    const elements = makeElements('.a {width: var(a-[1a])}');

    await expect(polyfill({ elements })).resolves.toBeDefined();
    expect(cssParseErrors).toHaveLength(1);

    // Call polyfill again with a parse error
    const elements1 = makeElements('.a {width: var(a-[1a])}');
    await expect(polyfill({ elements: elements1 })).resolves.toBeDefined();
    expect(cssParseErrors).toHaveLength(1);
  });
});
