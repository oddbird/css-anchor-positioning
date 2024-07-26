import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import { isInsetProp } from './parse.js';
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

// Move all inset properties to custom properties
function shiftInsetProperties(
  node: csstree.Declaration,
  block?: csstree.Block,
) {
  if (block && isInsetProp(node.property)) {
    block.children.appendData({
      type: 'Declaration',
      important: false,
      property: `--${node.property}-${INSTANCE_UUID}`,
      value: node.value,
    });
    return true;
  }
  return false;
}

export async function cascadeCSS(styleData: StyleData[]) {
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const block = this.rule?.block;

        const insetUpdated = shiftInsetProperties(node, block);

        const { updated } = shiftUnsupportedProperties(node, block);
        changed = changed || updated || insetUpdated;
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
