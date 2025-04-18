import {
  type Atrule,
  type CssNode,
  type Declaration,
  type FunctionNode,
  type Identifier,
  List,
  type Selector as CssTreeSelector,
  type SelectorList,
  type StyleSheet,
  type Value,
} from 'css-tree';
import generate from 'css-tree/generator';
import parse from 'css-tree/parser';
import { clone } from 'css-tree/utils';
import { nanoid } from 'nanoid/non-secure';

import type { Selector } from './dom.js';

export const INSTANCE_UUID = nanoid();

// https://github.com/import-js/eslint-plugin-import/issues/3019

export interface DeclarationWithValue extends Declaration {
  value: Value;
}

export function isAnchorFunction(node: CssNode | null): node is FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
}

export function getAST(cssText: string, parseAtrulePrelude = false) {
  return parse(cssText, {
    parseAtrulePrelude: parseAtrulePrelude,
    parseCustomProperty: true,
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

function isImportRule(node: CssNode): node is Atrule {
  return node.type === 'Atrule' && node.name === 'import';
}

export function makeImportUrlAbsolute(node: CssNode): boolean {
  if (!isImportRule(node)) return false;
  // AtRulePreludes are not parsed by default, so we need to reparse the node
  // to get the URL.
  const reparsedNode = (getAST(generateCSS(node), true) as StyleSheet).children
    .first;
  if (!reparsedNode || !isImportRule(reparsedNode)) return false;
  if (reparsedNode.prelude?.type !== 'AtrulePrelude') return false;

  // URL is always the first child of the prelude
  const url = reparsedNode.prelude.children.first;
  if (!url) return false;
  if (url.type !== 'Url' && url.type !== 'String') return false;
  url.value = new URL(url.value, document.baseURI).href;
  node.prelude = reparsedNode.prelude;
  return true;
}

export function makeDeclarationValueUrlAbsolute(node: CssNode): boolean {
  if (!isDeclaration(node)) return false;

  if (node.value.type !== 'Value') return false;
  let changed = false;

  const mapped = node.value.children.toArray().map((child) => {
    if (!child) return child;
    if (child.type !== 'Url') return child;
    child.value = new URL(child.value, document.baseURI).href;
    changed = true;
    return child;
  });
  node.value.children = new List<CssNode>().fromArray(mapped);
  return changed;
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
