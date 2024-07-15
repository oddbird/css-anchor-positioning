import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

export const INSTANCE_UUID = nanoid();

export interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

export function isAnchorFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
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

export const POSITION_ANCHOR_PROPERTY = `--position-anchor-${INSTANCE_UUID}`;

export function splitCommaList(list: csstree.List<csstree.CssNode>) {
  return list.toArray().reduce(
    (acc: csstree.Identifier[][], child) => {
      if (child.type === 'Operator' && child.value === ',') {
        acc.push([]);
        return acc;
      }
      if (child.type === 'Identifier') {
        acc[acc.length - 1].push(child);
      }

      return acc;
    },
    [[]],
  );
}

export function getCSSPropertyValue(el: HTMLElement, prop: string) {
  return getComputedStyle(el).getPropertyValue(prop).trim();
}

export function getBlockId(el: HTMLElement) {
  return getCSSPropertyValue(el, `--block-id-${INSTANCE_UUID}`);
}
