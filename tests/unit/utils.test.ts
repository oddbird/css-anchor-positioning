import type * as csstree from 'css-tree';

import {
  getAST,
  splitCommaList,
  splitCommaListValues,
} from '../../src/utils.js';

describe('splitCommaList', () => {
  it('works', () => {
    const { children } = getAST('a{b: c d, e, f;}') as csstree.StyleSheet;
    const value = (
      (children.first as csstree.Rule).block.children
        .first as csstree.Declaration
    ).value as csstree.Value;
    const res = splitCommaList(value.children);
    expect(res).toEqual([
      [
        { name: 'c', type: 'Identifier', loc: null },
        { name: 'd', type: 'Identifier', loc: null },
      ],
      [{ name: 'e', type: 'Identifier', loc: null }],
      [{ name: 'f', type: 'Identifier', loc: null }],
    ]);
  });
});

describe('splitCommaListValues', () => {
  it('returns names', () => {
    const { children } = getAST('a{b: c d, e, f;}') as csstree.StyleSheet;
    const value = (
      (children.first as csstree.Rule).block.children
        .first as csstree.Declaration
    ).value as csstree.Value;
    const res = splitCommaListValues(value.children);
    expect(res).toEqual(['c d', 'e', 'f']);
  });
});
