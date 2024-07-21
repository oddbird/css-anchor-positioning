import * as csstree from 'css-tree';

import { isDeclaration } from './parse.js';
import {
  generateCSS,
  getAST,
  getDeclarationValue,
  SHIFTED_PROPERTIES,
  type StyleData,
} from './utils.js';

// Shift property declarations custom properties which are subject to cascade and inheritance.
function shiftPositionAnchorData(node: csstree.CssNode, block?: csstree.Block) {
  if (isDeclaration(node) && SHIFTED_PROPERTIES[node.property] && block) {
    block.children.appendData({
      type: 'Declaration',
      important: false,
      property: SHIFTED_PROPERTIES[node.property],
      value: {
        type: 'Raw',
        value: getDeclarationValue(node),
      },
    });
    return { updated: true };
  }
  return {};
}

export async function cascadeCSS(styleData: StyleData[]) {
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const block = this.rule?.block;
        const { updated } = shiftPositionAnchorData(node, block);
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
