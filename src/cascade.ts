import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import { generateCSS, getAST, isDeclaration, type StyleData } from './utils.js';

/**
 * Map of CSS property to CSS custom property that the property's value is
 * shifted into. This is used to subject properties that are not yet natively
 * supported to the CSS cascade and inheritance rules.
 */
export const SHIFTED_PROPERTIES: Record<string, string> = {
  'position-anchor': `--position-anchor-${nanoid(12)}`,
  'anchor-scope': `--anchor-scope-${nanoid(12)}`,
  'anchor-name': `--anchor-name-${nanoid(12)}`,
};

/**
 * Shift property declarations for properties that are not yet natively
 * supported into custom properties.
 */
function shiftUnsupportedProperties(
  node: csstree.CssNode,
  block?: csstree.Block,
) {
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
    csstree.walk(ast, {
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
