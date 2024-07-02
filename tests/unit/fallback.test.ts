import type * as csstree from 'css-tree';

import { applyTryTactic } from '../../src/fallback.js';
import { generateCSS, getAST } from '../../src/utils.js';
describe('fallback', () => {
  describe('applyTryTactic', () => {
    describe('flip-block', () => {
      it('flips raw values', () => {
        const ast = getAST('{bottom:12px}') as csstree.StyleSheet;
        const block = (ast.children.first as csstree.Rule).block;
        const result = generateCSS(applyTryTactic(block, 'flip-block'));
        expect(result).toBe('{top:12px}');
      });
      it('no change to none-inset', () => {
        const ast = getAST('{color:red}') as csstree.StyleSheet;
        const block = (ast.children.first as csstree.Rule).block;
        const result = generateCSS(applyTryTactic(block, 'flip-block'));
        expect(result).toBe('{color:red}');
      });
      it('flips anchors', () => {
        const ast = getAST(
          '{bottom:anchor(top);top:anchor(--a top)}',
        ) as csstree.StyleSheet;
        const block = (ast.children.first as csstree.Rule).block;
        const result = generateCSS(applyTryTactic(block, 'flip-block'));
        expect(result).toBe('{top:anchor(bottom);bottom:anchor(--a bottom)}');
      });
    });
  });
});
