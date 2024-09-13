import type * as csstree from 'css-tree';

import {
  applyTryTacticsToSelector,
  getPositionTryDeclaration,
} from '../../src/fallback.js';
import { getAST, INSTANCE_UUID } from '../../src/utils.js';

const setup = (styles: string) => {
  document.body.innerHTML = `<div id="ref" style="${styles}">Test</div>`;
};
const propWrap = (property: string) => `--${property}-${INSTANCE_UUID}`;
describe('fallback', () => {
  afterAll(() => {
    document.body.innerHTML = '';
  });
  describe('applyTryTactics', () => {
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
          'flips anchor functions that are nested',
          `${propWrap('bottom')}: calc(anchor(top) + 5px);${propWrap('top')}:calc(calc(anchor(--a top) + 5px) - 0.5em)`,
          {
            top: 'calc(anchor(bottom) + 5px)',
            bottom: 'calc(calc(anchor(--a bottom) + 5px) - 0.5em)',
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
          'position-area left top',
          `${propWrap('position-area')}: left top;`,
          {
            'position-area': 'left bottom',
          },
        ],
        [
          'position-area right bottom',
          `${propWrap('position-area')}: right bottom;`,
          {
            'position-area': 'right top',
          },
        ],
        [
          'margin shorthand',
          `${propWrap('margin')}: 5px 15px 25px 35px;`,
          {
            margin: '25px 15px 5px 35px',
          },
        ],
        [
          'margin shorthand 3 values',
          `${propWrap('margin')}: 5px 15px 25px;`,
          {
            margin: '25px 15px 5px',
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
        expect(applyTryTacticsToSelector('#ref', ['flip-block'])).toMatchObject(
          expected,
        );
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
            left: 'anchor(self-end)',
            right: 'anchor(self-start)',
          },
        ],
        [
          'flips anchor functions that are nested',
          `${propWrap('right')}: calc(anchor(left) + 5px);${propWrap('left')}:calc(calc(anchor(--a left) + 5px) - 0.5em)`,
          {
            left: 'calc(anchor(right) + 5px)',
            right: 'calc(calc(anchor(--a right) + 5px) - 0.5em)',
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
          'position-area left top',
          `${propWrap('position-area')}: left top;`,
          {
            'position-area': 'right top',
          },
        ],
        [
          'position-area right bottom',
          `${propWrap('position-area')}: right bottom;`,
          {
            'position-area': 'left bottom',
          },
        ],
        [
          'margin shorthand',
          `${propWrap('margin')}: 5px 15px 25px 35px;`,
          {
            margin: '5px 35px 25px 15px',
          },
        ],
        [
          'margin shorthand 3 values',
          `${propWrap('margin')}: 5px 15px 25px;`,
          {
            margin: '5px 15px 25px',
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
        expect(
          applyTryTacticsToSelector('#ref', ['flip-inline']),
        ).toMatchObject(expected);
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
          'position-area left top',
          `${propWrap('position-area')}: left top;`,
          {
            'position-area': 'left top',
          },
        ],
        // [
        //   'position-area left bottom',
        //   `${propWrap('position-area')}: left bottom;`,
        //   {
        //     'position-area': 'right top',
        //   },
        // ],
        [
          'position-area right bottom',
          `${propWrap('position-area')}: right bottom;`,
          {
            'position-area': 'right bottom',
          },
        ],
        // [
        //   'position-area right top',
        //   `${propWrap('position-area')}: right top;`,
        //   {
        //     'position-area': 'left bottom',
        //   },
        // ],
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
        expect(applyTryTacticsToSelector('#ref', ['flip-start'])).toMatchObject(
          expected,
        );
      });
    });
  });

  describe('getPositionTryDeclaration', () => {
    const getResult = (css: string) => {
      const res = getAST(`a{${css}}`);

      return getPositionTryDeclaration(
        ((res as csstree.StyleSheet).children.first as csstree.Rule).block
          .children.first as csstree.Declaration,
      );
    };

    it('parses order', () => {
      const res = getResult('position-try: most-inline-size flip-block');
      expect(res).toMatchObject({
        order: 'most-inline-size',
        options: [{ tactics: ['flip-block'], type: 'try-tactic' }],
      });
    });

    it('parses try-tactics', () => {
      const res = getResult('position-try: flip-block, flip-inline;');
      expect(res).toMatchObject({
        order: undefined,
        options: [
          { tactics: ['flip-block'], type: 'try-tactic' },
          { tactics: ['flip-inline'], type: 'try-tactic' },
        ],
      });
    });
    it('parses try-tactics with multiple', () => {
      const res = getResult(
        'position-try: flip-block flip-start, flip-inline;',
      );
      expect(res).toMatchObject({
        order: undefined,
        options: [
          { tactics: ['flip-block', 'flip-start'], type: 'try-tactic' },
          { tactics: ['flip-inline'], type: 'try-tactic' },
        ],
      });
    });
    it('parses position-try rules', () => {
      const res = getResult('position-try: --top, --bottom;');
      expect(res).toMatchObject({
        order: undefined,
        options: [
          { atRule: '--top', type: 'at-rule' },
          { atRule: '--bottom', type: 'at-rule' },
        ],
      });
    });
    it('parses position-try rules modified by try tactic', () => {
      const res = getResult(
        'position-try: --top flip-block, flip-inline --bottom;',
      );
      expect(res).toMatchObject({
        order: undefined,
        options: [
          {
            atRule: '--top',
            tactics: ['flip-block'],
            type: 'at-rule-with-try-tactic',
          },
          {
            atRule: '--bottom',
            tactics: ['flip-inline'],
            type: 'at-rule-with-try-tactic',
          },
        ],
      });
    });
  });
});
