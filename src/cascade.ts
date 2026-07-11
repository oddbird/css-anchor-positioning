import type { Block, CssNode } from 'css-tree';
import { List } from 'css-tree/utils';
import walk from 'css-tree/walker';

import { ACCEPTED_POSITION_TRY_PROPERTIES } from './syntax.js';
import {
  generateCSS,
  getAST,
  INSTANCE_UUID,
  isDeclaration,
  type StyleData,
} from './utils.js';

/**
 * Map of CSS property to CSS custom property that the property's value is
 * shifted into. This is used to subject properties that are not yet natively
 * supported to the CSS cascade so later stages can read computed values. It is
 * also used by the fallback algorithm to find initial, non-computed values.
 */
export const SHIFTED_PROPERTIES: Record<string, string> = [
  ...ACCEPTED_POSITION_TRY_PROPERTIES,
  'anchor-scope',
  'anchor-name',
].reduce(
  (acc, prop) => {
    acc[prop] = `--${prop}-${INSTANCE_UUID}`;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Make the shifted custom properties non-inherited.
 *
 * Every property we shift (insets, margins, sizing, self-alignment,
 * `position-anchor`, `position-area`, `anchor-name`, `anchor-scope`) is
 * non-inherited in CSS, but custom properties inherit by default. Without
 * making them non-inherited, a value set on an ancestor (e.g. `height: 400px`
 * on a scroll container) would be inherited by descendants through the shifted
 * custom property and incorrectly read back as if it were set directly on them
 * -- leaking, for example, into every generated position fallback. See
 * https://github.com/oddbird/css-anchor-positioning/issues/279.
 *
 * Where `CSS.registerProperty` is supported (Safari 16.4+, Firefox 128+), we
 * register the properties with `inherits: false`. This is global to the
 * document (including shadow trees), so it only needs to run once.
 *
 * On older engines we fall back to injecting a universal rule that resets each
 * shifted property to `initial` on every element (and the `::before`/`::after`
 * pseudo-elements we read). For an unregistered custom property, `initial` is
 * the guaranteed-invalid value, so any element that doesn't explicitly set the
 * property reads back as empty instead of inheriting its ancestor's value --
 * emulating non-inheritance. The reset has the lowest possible specificity, so
 * real declarations still win, and it only touches our private custom
 * properties, never the native properties that drive layout. Injected into
 * `document.head`, this reset does not reach separate shadow trees.
 */
let propertiesMadeNonInheriting = false;
export function registerShiftedProperties() {
  if (propertiesMadeNonInheriting || typeof CSS === 'undefined') {
    return;
  }
  const customProperties = Object.values(SHIFTED_PROPERTIES);
  if (typeof CSS.registerProperty === 'function') {
    for (const customProperty of customProperties) {
      try {
        CSS.registerProperty({
          name: customProperty,
          syntax: '*',
          inherits: false,
        });
      } catch {
        // Ignore properties that are already registered (e.g. by an earlier run
        // of the polyfill).
      }
    }
    propertiesMadeNonInheriting = true;
  } else if (typeof document !== 'undefined') {
    const resets = customProperties
      .map((customProperty) => `${customProperty}: initial;`)
      .join('\n  ');
    const style = document.createElement('style');
    style.textContent = `*,\n::before,\n::after {\n  ${resets}\n}`;
    document.head.append(style);
    propertiesMadeNonInheriting = true;
  }
}

/**
 * Shift property declarations for properties that are not yet natively
 * supported into custom properties.
 */
function shiftUnsupportedProperties(node: CssNode, block?: Block) {
  if (isDeclaration(node) && SHIFTED_PROPERTIES[node.property] && block) {
    block.children.appendData({
      ...node,
      property: SHIFTED_PROPERTIES[node.property],
    });
    return { updated: true };
  }
  return { updated: false };
}

/**
 * Expand inset-* shorthand properties into their longhand equivalents.
 */
function expandInsetShorthands(node: CssNode, block?: Block) {
  const INSET_SHORTHANDS = ['inset', 'inset-block', 'inset-inline'];
  if (
    !isDeclaration(node) ||
    !block ||
    !INSET_SHORTHANDS.includes(node.property)
  ) {
    return { updated: false };
  }

  const appendProperty = (property: string, value?: CssNode) => {
    if (!value) return;
    block.children.appendData({
      ...node,
      property,
      value: {
        type: 'Value',
        children: new List<CssNode>().fromArray([value]),
      },
    });
  };

  if (node.property === 'inset') {
    const values = node.value.children.toArray();
    // `inset` shorthand expands to top, right, bottom, left
    // See https://drafts.csswg.org/css-position/#inset-shorthands
    const [top, right, bottom, left] = (() => {
      switch (values.length) {
        case 1:
          return [values[0], values[0], values[0], values[0]];
        case 2:
          return [values[0], values[1], values[0], values[1]];
        case 3:
          return [values[0], values[1], values[2], values[1]];
        case 4:
          return [values[0], values[1], values[2], values[3]];
        default:
          return [];
      }
    })();
    appendProperty('top', top);
    appendProperty('right', right);
    appendProperty('bottom', bottom);
    appendProperty('left', left);
  } else if (node.property === 'inset-block') {
    const values = node.value.children.toArray();
    const [blockStart, blockEnd] = (() => {
      switch (values.length) {
        case 1:
          return [values[0], values[0]];
        case 2:
          return [values[0], values[1]];
        default:
          return [];
      }
    })();
    appendProperty('inset-block-start', blockStart);
    appendProperty('inset-block-end', blockEnd);
  } else if (node.property === 'inset-inline') {
    const values = node.value.children.toArray();
    const [inlineStart, inlineEnd] = (() => {
      switch (values.length) {
        case 1:
          return [values[0], values[0]];
        case 2:
          return [values[0], values[1]];
        default:
          return [];
      }
    })();
    appendProperty('inset-inline-start', inlineStart);
    appendProperty('inset-inline-end', inlineEnd);
  }

  return { updated: true };
}

/**
 * Update the given style data to enable cascading and inheritance of properties
 * that are not yet natively supported, or are needed in a different format for
 * the polyfill to work as expected.
 */
export function cascadeCSS(styleData: StyleData[]) {
  registerShiftedProperties();

  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css, true);
    walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const block = this.rule?.block;
        const { updated: shorthandUpdated } = expandInsetShorthands(
          node,
          block,
        );
        const { updated } = shiftUnsupportedProperties(node, block);
        if (updated || shorthandUpdated) {
          changed = true;
        }
      },
    });

    if (changed) {
      // Update CSS
      styleObj.css = generateCSS(ast);
      styleObj.changed = true;
    }
  }
  return styleData.some((styleObj) => styleObj.changed === true);
}
