import type { Block, CssNode } from 'css-tree';
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
 * supported to the CSS cascade and inheritance rules.
 */
export const SHIFTED_PROPERTIES: Record<string, string> = [...ACCEPTED_POSITION_TRY_PROPERTIES, 'anchor-scope', 'anchor-name' ].reduce(
  (acc, prop) => {
    acc[prop] = `--${prop}-${INSTANCE_UUID}`;
    return acc;
  },
  {} as Record<string, string>);

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
  return {};
}

/**
 * Update the given style data to enable cascading and inheritance of properties
 * that are not yet natively supported.
 */
export function cascadeCSS(styleData: StyleData[]) {
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const block = this.rule?.block;
        const { updated } = shiftUnsupportedProperties(node, block);
        if (updated) {
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
