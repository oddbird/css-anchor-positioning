import type * as csstree from 'css-tree';

import { getAST, splitCommaList } from '../../src/utils.js';

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
describe('getAST', () => {
  it('parses valid CSS', () => {
    const cssText = 'a { color: red; }';
    const ast = getAST(cssText);
    expect(ast.type).toBe('StyleSheet');
  });

  it('throws on invalid declaration', () => {
    const cssText = 'a { color; red; } ';
    expect(() => getAST(cssText)).toThrowError(
      /Invalid CSS could not be parsed/,
    );
  });
  it('throws on invalid selector', () => {
    const cssText = 'a-[1] { color: red; } ';
    expect(() => getAST(cssText)).toThrowError(
      /Invalid CSS could not be parsed/,
    );
  });
});
