import type { Block, CssNode } from 'css-tree';
import walk from 'css-tree/walker';

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
export const SHIFTED_PROPERTIES: Record<string, string> = {
  'position-anchor': `--position-anchor-${INSTANCE_UUID}`,
  'position-area': `--position-area-${INSTANCE_UUID}`,
  'anchor-scope': `--anchor-scope-${INSTANCE_UUID}`,
  'anchor-name': `--anchor-name-${INSTANCE_UUID}`,
  left: `--left-${INSTANCE_UUID}`,
  right: `--right-${INSTANCE_UUID}`,
  top: `--top-${INSTANCE_UUID}`,
  bottom: `--bottom-${INSTANCE_UUID}`,
  'inset-block-start': `--inset-block-start-${INSTANCE_UUID}`,
  'inset-block-end': `--inset-block-end-${INSTANCE_UUID}`,
  'inset-inline-start': `--inset-inline-start-${INSTANCE_UUID}`,
  'inset-inline-end': `--inset-inline-end-${INSTANCE_UUID}`,
  'inset-block': `--inset-block-${INSTANCE_UUID}`,
  'inset-inline': `--inset-inline-${INSTANCE_UUID}`,
  inset: `--inset-${INSTANCE_UUID}`,
};

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
