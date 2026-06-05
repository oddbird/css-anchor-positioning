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

/** Singleton to hold CSS parse errors in case polyfill fails.
 *
 * Not included in the store in parse.ts, as it has a different lifecycle.
 */
export const cssParseErrors = new Set() as Set<SyntaxParseError>;

export interface DeclarationWithValue extends Declaration {
  value: Value;
}

export function isAnchorFunction(node: CssNode | null): node is FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
}
/**
 * @param cssText
 * @param captureErrors `true` only on the initial parse of CSS before the
 * polyfill changes it
 */
export function getAST(cssText: string, captureErrors = false) {
  return parse(cssText, {
    parseAtrulePrelude: false,
    parseCustomProperty: true,
    onParseError: (err) => {
      if (captureErrors) cssParseErrors.add(err);
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
  el?: HTMLElement;
  css: string;
  url?: URL;
  changed?: boolean;
  created?: boolean; // Whether the element is created by the polyfill
  // The constructed stylesheet this data came from, when the styles were
  // adopted via `adoptedStyleSheets` rather than a `<style>`/`<link>` element.
  sheet?: CSSStyleSheet;
}

// Reference to the native `CSSStyleSheet.prototype.replaceSync` so that the
// polyfill can write transformed CSS back into a constructed stylesheet without
// re-triggering the patched version (which would re-capture the text).
export const originalReplaceSync = CSSStyleSheet.prototype.replaceSync;

// Maps a constructed stylesheet to the original (untransformed) CSS text that
// was passed to `replaceSync`, so the polyfill can re-parse the source styles.
export const adoptedSheetText = new WeakMap<CSSStyleSheet, string>();

/**
 * Records the original CSS text passed to a constructed stylesheet's
 * `replaceSync`, so it can later be re-parsed by the polyfill.
 */
export function captureAdoptedStylesheetText(sheet: CSSStyleSheet, text: string) {
  adoptedSheetText.set(sheet, text);
}

/**
 * Serializes the current rules of a constructed stylesheet. Used as a fallback
 * when the original `replaceSync` text was not captured (e.g. the sheet was
 * populated before the polyfill patched `replaceSync`).
 */
export function getAdoptedStylesheetText(sheet: CSSStyleSheet) {
  const captured = adoptedSheetText.get(sheet);
  if (captured !== undefined) {
    return captured;
  }
  return Array.from(sheet.cssRules)
    .map((rule) => rule.cssText)
    .join('\n');
}

/**
 * Writes transformed CSS back into a constructed stylesheet, bypassing the
 * patched `replaceSync` so the original source text remains captured.
 */
export function writeAdoptedStylesheet(sheet: CSSStyleSheet, css: string) {
  originalReplaceSync.call(sheet, css);
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

export function reportParseErrorsOnFailure() {
  if (cssParseErrors.size > 0) {
    // eslint-disable-next-line no-console
    console.group(
      `The CSS anchor positioning polyfill was not applied due to ${
        cssParseErrors.size === 1 ? 'a CSS parse error' : 'CSS parse errors'
      }.`,
    );
    cssParseErrors.forEach((err) => {
      // eslint-disable-next-line no-console
      console.warn(err.formattedMessage);
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

export function resetParseErrors() {
  cssParseErrors.clear();
}
