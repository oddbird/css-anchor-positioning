import type * as csstree from 'css-tree';

import {
  cssParseErrors,
  getAST,
  getRootStyleContainer,
  splitCommaList,
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
describe('getAST', () => {
  beforeEach(() => {
    cssParseErrors.clear();
  });
  it('parses valid CSS', () => {
    const cssText = 'a { color: red; }';
    const ast = getAST(cssText);
    expect(ast.type).toBe('StyleSheet');
  });

  it('stores cssParseError on invalid declaration', () => {
    const cssText = 'a { color; red; } ';
    getAST(cssText, true);
    expect(cssParseErrors.size).toBe(2);
  });
  it('stores cssParseError on invalid selector', () => {
    const cssText = 'a-[1] { color: red; } ';
    getAST(cssText, true);
    expect(cssParseErrors.size).toBe(1);
  });
});

describe('getRootStyleContainer', () => {
  it('resolves a document to its head', () => {
    expect(getRootStyleContainer(document)).toBe(document.head);
  });

  it('resolves a shadow root to itself', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    expect(getRootStyleContainer(shadowRoot)).toBe(shadowRoot);
  });

  it('resolves an element in the document to the document head', () => {
    const el = document.createElement('div');
    document.body.append(el);

    expect(getRootStyleContainer(el)).toBe(document.head);
  });

  it('resolves an element inside a shadow root to that shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const el = document.createElement('div');
    shadowRoot.append(el);

    expect(getRootStyleContainer(el)).toBe(shadowRoot);
  });

  it('resolves a shadow host to the tree the host lives in, not its own shadow root', () => {
    // The case this exists for: a `:host` rule styles the host, which sits in
    // the *outer* tree, so its generated styles must go there.
    const host = document.createElement('div');
    document.body.append(host);
    host.attachShadow({ mode: 'open' });

    expect(getRootStyleContainer(host)).toBe(document.head);
  });

  it('returns null for a detached element', () => {
    // No stylesheet reaches a detached tree, so there is no container whose
    // rules could apply; `document.head` would silently never match.
    expect(getRootStyleContainer(document.createElement('div'))).toBe(null);
  });
});
