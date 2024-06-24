import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

export interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

export function getAST(cssText: string) {
  return csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseCustomProperty: true,
  });
}

export function generateCSS(ast: csstree.CssNode) {
  return csstree.generate(ast, {
    // Default `safe` adds extra (potentially breaking) spaces for compatibility
    // with old browsers.
    mode: 'spec',
  });
}

export function getDeclarationValue(node: DeclarationWithValue) {
  return (node.value.children.first as csstree.Identifier).name;
}

export interface StyleData {
  el: HTMLElement;
  css: string;
  url?: URL;
  changed?: boolean;
}

export const POSITION_ANCHOR_PROPERTY = `--position-anchor-${nanoid(12)}`;
