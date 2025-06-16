import type {
  CssNode,
  Declaration,
  FunctionNode,
  Identifier,
  List,
  Selector as CssTreeSelector,
  SelectorList,
  SyntaxParseError,
  Value,
} from 'css-tree';
import generate from 'css-tree/generator';
import parse from 'css-tree/parser';
import { clone } from 'css-tree/utils';
import { nanoid } from 'nanoid/non-secure';

import type { Selector } from './dom.js';

export const INSTANCE_UUID = nanoid();

export const cssParseErrors = [] as SyntaxParseError[];

// https://github.com/import-js/eslint-plugin-import/issues/3019

export interface DeclarationWithValue extends Declaration {
  value: Value;
}

export function isAnchorFunction(node: CssNode | null): node is FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
}

export function getAST(cssText: string, captureErrors = false) {
  return parse(cssText, {
    parseAtrulePrelude: false,
    parseCustomProperty: true,
    onParseError: (err) => {
      if(captureErrors) cssParseErrors.push(err);
    },
  });
}

export function generateCSS(ast: CssNode) {
  return generate(ast, {
    // Default `safe` adds extra (potentially breaking) spaces for compatibility
    // with old browsers.
    mode: 'spec',
  });
}

export function isDeclaration(node: CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration';
}

export function getDeclarationValue(node: DeclarationWithValue) {
  return (node.value.children.first as Identifier).name;
}

export interface StyleData {
  el: HTMLElement;
  css: string;
  url?: URL;
  changed?: boolean;
  created?: boolean; // Whether the element is created by the polyfill
}

export const POSITION_ANCHOR_PROPERTY = `--position-anchor-${INSTANCE_UUID}`;

export function splitCommaList(list: List<CssNode>) {
  return list.toArray().reduce(
    (acc: Identifier[][], child) => {
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

export function getSelectors(rule: SelectorList | undefined) {
  if (!rule) return [];

  return (rule.children as List<CssTreeSelector>)
    .map((selector) => {
      let pseudoElementPart: string | undefined;

      if (selector.children.last?.type === 'PseudoElementSelector') {
        selector = clone(selector) as CssTreeSelector;
        pseudoElementPart = generateCSS(selector.children.last!);
        selector.children.pop();
      }

      const elementPart = generateCSS(selector);

      return {
        selector: elementPart + (pseudoElementPart ?? ''),
        elementPart,
        pseudoElementPart,
      } satisfies Selector;
    })
    .toArray();
}
