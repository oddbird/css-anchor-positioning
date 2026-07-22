import { type Strategy } from '@floating-ui/dom';
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

import { getCSSPropertyValue, type Selector } from './dom.js';
import type { AnchorPositioningRoot } from './polyfill.js';

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
// re-triggering the patched version (which would re-capture the text). In
// environments without support for constructed stylesheets, fallback to a
// no-op. This allows E2E tests to run, and is only called when a constructed
// stylesheet is being transformed, indicating the presence of CSSStyleSheet
// support.
export const originalReplaceSync =
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  globalThis.CSSStyleSheet?.prototype.replaceSync ?? (() => {});

// Maps a constructed stylesheet to the original (untransformed) CSS text that
// was passed to `replaceSync`, so the polyfill can re-parse the source styles.
export const adoptedSheetText = new WeakMap<CSSStyleSheet, string>();

/**
 * Records the original CSS text passed to a constructed stylesheet's
 * `replaceSync`, so it can later be re-parsed by the polyfill.
 */
export function captureAdoptedStylesheetText(
  sheet: CSSStyleSheet,
  text: string,
) {
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

// Constructed stylesheets the polyfill created as private, per-root copies of a
// user's (possibly shared) adopted stylesheet. These are safe to mutate in
// place; the user's original sheet is never modified.
const polyfillOwnedSheets = new WeakSet<CSSStyleSheet>();

/**
 * Writes transformed CSS for a constructed stylesheet, bypassing the patched
 * `replaceSync` so the original source text remains captured.
 *
 * A single constructed stylesheet can be adopted by multiple roots ("construct
 * once, adopt everywhere"). The polyfill rewrites a sheet's `anchor()` functions
 * to custom properties that each adopting host defines locally, so it must not
 * mutate the user's source sheet: a separate run for another root would rewrite
 * it again and leave earlier hosts pointing at custom properties that no longer
 * exist.
 *
 * Instead we create one polyfill-owned copy holding the transformed CSS and swap
 * it into every `roots` entry that currently adopts the original, leaving the
 * original pristine for roots transformed in other (later) runs. A sheet we
 * already own is rewritten in place. Returns the sheet that was written so
 * callers can keep tracking it.
 */
export function writeAdoptedStylesheet(
  sheet: CSSStyleSheet,
  css: string,
  roots?: AnchorPositioningRoot[],
): CSSStyleSheet {
  if (!polyfillOwnedSheets.has(sheet)) {
    const adopters = (roots ?? []).filter(
      (root): root is Document | ShadowRoot =>
        'adoptedStyleSheets' in root &&
        (root as Document | ShadowRoot).adoptedStyleSheets.includes(sheet),
    );
    if (adopters.length) {
      const copy = new CSSStyleSheet({
        media: sheet.media,
        disabled: sheet.disabled,
      });
      originalReplaceSync.call(copy, css);
      polyfillOwnedSheets.add(copy);
      for (const root of adopters) {
        root.adoptedStyleSheets = root.adoptedStyleSheets.map((s) =>
          s === sheet ? copy : s,
        );
      }
      return copy;
    }
  }
  // Either a copy we already own, or we couldn't locate an adopting root — safe
  // to write in place.
  originalReplaceSync.call(sheet, css);
  return sheet;
}

// Resolves the node that a polyfill-generated `<style>` should be appended to
// for a given root, so its rules apply within that root. Styles in
// `document.head` do not pierce into a shadow root, so styles for a shadow root
// (or an element inside one) must be appended there instead.
export function getRootStyleContainer(
  root: AnchorPositioningRoot,
): ShadowRoot | HTMLHeadElement {
  if (root instanceof ShadowRoot) return root;
  if (root instanceof Document) return root.head;
  const rootNode = root.getRootNode();
  return rootNode instanceof ShadowRoot ? rootNode : document.head;
}

export const POSITION_ANCHOR_PROPERTY = `--position-anchor-${INSTANCE_UUID}`;

// Names the custom property the polyfill uses to carry a resolved
// `position-area` value (e.g. `top`, `justify-self`) from the mapping
// stylesheet to the target or wrapper. Suffixed with `INSTANCE_UUID` so we
// don't squat on an author's custom property. Read and write sites all go
// through this helper so the names can't drift. Lives here (rather than in
// `position-area.ts`) so `cascade.ts` can register these as non-inherited
// without importing `position-area.ts` -- that would create a
// `cascade -> position-area -> dom -> cascade` import cycle.
export const paValueProperty = (prop: string) =>
  `--pa-value-${prop}-${INSTANCE_UUID}`;

// Names the custom properties for a wrapper's insets, so a shared `auto`
// selector's target insets don't collide.
export const paWrapperProperty = (prop: string) =>
  `--pa-wrapper-${prop}-${INSTANCE_UUID}`;

// The physical sides the polyfill sets as insets, on the wrapper or (in the
// unwrapped path) directly on the target.
export const PA_INSET_SIDES = ['top', 'left', 'right', 'bottom'] as const;

// Custom properties the polyfill both sets on and reads from the *same* element
// -- the wrapper's insets, and (in the unwrapped path) the target's insets.
// These must be registered non-inherited: unlike
// `--pa-value-{justify,align}-self` (which are set on the wrapper and read on
// the target child, and so must inherit), an inset set on one `position-area`
// target would otherwise leak through inheritance onto a descendant that is
// itself a `position-area` target, overriding its `auto` fallback. See
// `registerShiftedProperties` in cascade.ts and
// https://github.com/oddbird/css-anchor-positioning/issues/279.
export const NON_INHERITED_POSITION_AREA_PROPERTIES = [
  ...PA_INSET_SIDES.map((side) => paValueProperty(side)),
  ...PA_INSET_SIDES.map((side) => paWrapperProperty(side)),
];

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

export const strategyForElement = (el: HTMLElement): Strategy => {
  const position = getCSSPropertyValue(el, 'position');
  return position === 'fixed' ? 'fixed' : 'absolute';
};
