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
  it('returns false if no changes were made', async () => {
    const srcCSS = `.my-class { color: blue; }`;
    const styleData: StyleData[] = [
      { css: srcCSS, el: document.createElement('div') },
    ];
    const cascadeCausedChanges = await cascadeCSS(styleData);
    expect(cascadeCausedChanges).toBe(false);
  });
});

describe('expandInsetShorthands', () => {
  it.each([
    [
      'inset-block:anchor(inside)',
      ['inset-block-start:anchor(inside)', 'inset-block-end:anchor(inside)'],
    ],
    [
      'inset-block:anchor(inside) 20px',
      ['inset-block-start:anchor(inside)', 'inset-block-end:20px'],
    ],
    [
      'inset-inline:anchor(inside)',
      ['inset-inline-start:anchor(inside)', 'inset-inline-end:anchor(inside)'],
    ],
    [
      'inset-inline:anchor(inside) 20px',
      ['inset-inline-start:anchor(inside)', 'inset-inline-end:20px'],
    ],
    [
      'inset:anchor(inside)',
      [
        'top:anchor(inside)',
        'right:anchor(inside)',
        'bottom:anchor(inside)',
        'left:anchor(inside)',
      ],
    ],
    [
      'inset:anchor(inside) 10px',
      [
        'top:anchor(inside)',
        'right:10px',
        'bottom:anchor(inside)',
        'left:10px',
      ],
    ],
    [
      'inset:anchor(inside) 10px 20px',
      ['top:anchor(inside)', 'right:10px', 'bottom:20px', 'left:10px'],
    ],
    [
      'inset:anchor(inside) 10px 20px 30px',
      ['top:anchor(inside)', 'right:10px', 'bottom:20px', 'left:30px'],
    ],
    [
      'inset:anchor(inside) 20px 30px 40px',
      ['top:anchor(inside)', 'right:20px', 'bottom:30px', 'left:40px'],
    ],
  ])('expands %s to longhand properties', (shorthand, longhands) => {
    const css = cascadeCSSForTest(`#target{${shorthand}}`);
    longhands.forEach((longhand) => {
      expect(css).toContain(longhand);
    });
  });
  it.each([
    ['inset:;'],
    ['inset:10px 20px 30px 40px 50px;'],
    ['inset-block:;'],
    ['inset-block:10px 20px 30px;'],
    ['inset-inline:;'],
    ['inset-inline:10px 20px 30px;'],
  ])(
    'does not expand shorthands with invalid list lengths: %s',
    (shorthand) => {
      const css = cascadeCSSForTest(`#target{${shorthand}}`);
      [
        'inset-block-start',
        'inset-block-end',
        'inset-inline-start',
        'inset-inline-end',
        'top',
        'right',
        'bottom',
        'left',
      ].forEach((longhand) => {
        expect(css).not.toContain(longhand);
      });
    },
  );
});
