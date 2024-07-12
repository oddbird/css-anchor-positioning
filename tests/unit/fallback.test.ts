import { applyTryTactic } from '../../src/fallback.js';
import { INSTANCE_UUID } from '../../src/utils.js';

const setup = (styles: string) => {
  document.body.innerHTML = `<div id="ref" style="${styles}">Test</div>`;
};
const propWrap = (property: string) => `--${property}-${INSTANCE_UUID}`;
describe('fallback', () => {
  afterAll(() => {
    document.body.innerHTML = '';
  });
  describe('applyTryTactic', () => {
    describe('flip-block', () => {
      it.each([
        [
          'flips raw values',
          `${propWrap('bottom')}:12px`,
          { top: '12px', bottom: 'revert' },
        ],
        ['ignores non-inset values', `red:12px`, {}],
        [
          'flips top and bottom anchors',
          `${propWrap('bottom')}: anchor(top);${propWrap('top')}:anchor(--a top)`,
          {
            top: 'anchor(bottom)',
            bottom: 'anchor(--a bottom)',
          },
        ],
        [
          'flips top and bottom logical anchors',
          `${propWrap('bottom')}: anchor(start);${propWrap('top')}:anchor(end)`,
          {
            top: 'anchor(end)',
            bottom: 'anchor(start)',
          },
        ],
        [
          'flips top and bottom logical self anchors',
          `${propWrap('bottom')}: anchor(self-start);${propWrap('top')}:anchor(self-end)`,
          {
            top: 'anchor(self-end)',
            bottom: 'anchor(self-start)',
          },
        ],
        [
          'does not flip left and right anchors',
          `${propWrap('left')}: anchor(right);${propWrap('right')}:anchor(--a left)`,
          {
            left: 'anchor(right)',
            right: 'anchor(--a left)',
          },
        ],
        [
          'inset-area left top',
          `${propWrap('inset-area')}: left top;`,
          {
            'inset-area': 'left bottom'
          },
        ],
        [
          'inset-area right bottom',
          `${propWrap('inset-area')}: right bottom;`,
          {
            'inset-area': 'right top'
          },
        ],
        [
          'margin shorthand',
          `${propWrap('margin')}: 5px 15px 25px 35px;`,
          {
            'margin': '25px 15px 5px 35px'
          },
        ],
        [
          'margin long hands',
          `${propWrap('margin-top')}: 5px;
          ${propWrap('margin-bottom')}: 15px;
          ${propWrap('margin-left')}: 25px;
          ${propWrap('margin-right')}: 35px;
          `,
          {
            'margin-bottom': '5px',
            'margin-top': '15px',
            'margin-left': '25px',
            'margin-right': '35px',
          },
        ],
        [
          'margin medium hands',
          `${propWrap('margin-block')}: 5px 25px;
          ${propWrap('margin-inline')}: 15px 35px;
          `,
          {
            'margin-block': '25px 5px',
            'margin-inline': '15px 35px',
          },
        ],
      ])('%s', (name, styles, expected) => {
        setup(styles);
        expect(applyTryTactic('#ref', 'flip-block')).toMatchObject(expected);
      });
    });

    describe('flip-inline', () => {
      it.each([
        [
          'flips raw values',
          `${propWrap('left')}:12px`,
          { right: '12px', left: 'revert' },
        ],
        ['ignores non-inset values', `red:12px`, {}],
        [
          'flips left and right anchors',
          `${propWrap('left')}: anchor(right);${propWrap('right')}:anchor(--a left)`,
          {
            right: 'anchor(left)',
            left: 'anchor(--a right)',
          },
        ],
        [
          'flips left and right logical anchors',
          `${propWrap('right')}: anchor(start);${propWrap('left')}:anchor(end)`,
          {
            left: 'anchor(end)',
            right: 'anchor(start)',
          },
        ],
        [
          'flips left and right logical self anchors',
          `${propWrap('right')}: anchor(self-start);${propWrap('left')}:anchor(self-end)`,
          {
            left: 'anchor(end)',
            right: 'anchor(start)',
          },
        ],
        [
          'does not flip top and bottom anchors',
          `${propWrap('top')}: anchor(bottom);${propWrap('bottom')}:anchor(--a top)`,
          {
            top: 'anchor(bottom)',
            bottom: 'anchor(--a top)',
          },
        ],
        [
          'inset-area left top',
          `${propWrap('inset-area')}: left top;`,
          {
            'inset-area': 'right top'
          },
        ],
        [
          'inset-area right bottom',
          `${propWrap('inset-area')}: right bottom;`,
          {
            'inset-area': 'left bottom'
          },
        ],
        [
          'margin shorthand',
          `${propWrap('margin')}: 5px 15px 25px 35px;`,
          {
            'margin': '5px 35px 25px 15px'
          },
        ],
        [
          'margin long hands',
          `${propWrap('margin-top')}: 5px;
          ${propWrap('margin-bottom')}: 15px;
          ${propWrap('margin-left')}: 25px;
          ${propWrap('margin-right')}: 35px;
          `,
          {
            'margin-top': '5px',
            'margin-bottom': '15px',
            'margin-left': '35px',
            'margin-right': '25px',
          },
        ],
        [
          'margin medium hands',
          `${propWrap('margin-block')}: 5px 25px;
          ${propWrap('margin-inline')}: 15px 35px;
          `,
          {
            'margin-block': '5px 25px',
            'margin-inline': '35px 15px',
          },
        ],
      ])('%s', (name, styles, expected) => {
        setup(styles);
        expect(applyTryTactic('#ref', 'flip-inline')).toMatchObject(expected);
      });
    });
    describe('flip-start', () => {
      it.each([
        ['ignores non-inset values', `red:12px`, {}],
        [
          'flips physical anchors right to bottom',
          `${propWrap('right')}: anchor(left);`,
          {
            right: 'revert',
            bottom: 'anchor(top)',
          },
        ],
        [
          'flips physical anchors bottom to right',
          `${propWrap('bottom')}: anchor(top);`,
          {
            bottom: 'revert',
            right: 'anchor(left)',
          },
        ],
        [
          'flips physical anchors left to top',
          `${propWrap('left')}: anchor(right);`,
          {
            left: 'revert',
            top: 'anchor(bottom)',
          },
        ],
        [
          'flips physical anchors top to left',
          `${propWrap('top')}: anchor(bottom);`,
          {
            top: 'revert',
            left: 'anchor(right)',
          },
        ],
        [
          'flips bottom and right logical anchors',
          `${propWrap('right')}: anchor(start);`,
          {
            bottom: 'anchor(start)',
            right: 'revert',
          },
        ],
        [
          'flips left and top logical anchors',
          `${propWrap('left')}: anchor(end);`,
          {
            top: 'anchor(end)',
            left: 'revert',
          },
        ],
        [
          'flips left and top logical self anchors',
          `${propWrap('left')}: anchor(self-end);`,
          {
            left: 'revert',
            top: 'anchor(self-end)',
          },
        ],
        [
          'inset-area left top',
          `${propWrap('inset-area')}: left top;`,
          {
            'inset-area': 'left top'
          },
        ],
        [
          'inset-area left bottom',
          `${propWrap('inset-area')}: left bottom;`,
          {
            'inset-area': 'right top'
          },
        ],
        [
          'inset-area right bottom',
          `${propWrap('inset-area')}: right bottom;`,
          {
            'inset-area': 'right bottom'
          },
        ],
        [
          'inset-area right top',
          `${propWrap('inset-area')}: right top;`,
          {
            'inset-area': 'left bottom'
          },
        ],
        // [
        //   'margin shorthand',
        //   `${propWrap('margin')}: 5px 15px 25px 35px;`,
        //   {
        //     'margin': '5px 35px 25px 15px'
        //   },
        // ],
        // [
        //   'margin long hands',
        //   `${propWrap('margin-top')}: 5px;
        //   ${propWrap('margin-bottom')}: 15px;
        //   ${propWrap('margin-left')}: 25px;
        //   ${propWrap('margin-right')}: 35px;
        //   `,
        //   {
        //     'margin-top': '5px',
        //     'margin-bottom': '15px',
        //     'margin-left': '35px',
        //     'margin-right': '25px',
        //   },
        // ],
        // [
        //   'margin medium hands',
        //   `${propWrap('margin-block')}: 5px 25px;
        //   ${propWrap('margin-inline')}: 15px 35px;
        //   `,
        //   {
        //     'margin-block': '5px 25px',
        //     'margin-inline': '35px 15px',
        //   },
        // ],
      ])('%s', (name, styles, expected) => {
        setup(styles);
        expect(applyTryTactic('#ref', 'flip-inline')).toMatchObject(expected);
      });
    });
  });
});
