import * as csstree from 'css-tree';

import { isPositionAnchorDeclaration } from './parse.js';
import {
  generateCSS,
  getAST,
  getDeclarationValue,
  isAnchorFunction,
  POSITION_ANCHOR_PROPERTY,
  type StyleData,
} from './utils.js';

// Move `position-anchor` declaration to cascadable `--position-anchor`
// property.
function shiftPositionAnchorData(node: csstree.CssNode, block?: csstree.Block) {
  if (isPositionAnchorDeclaration(node) && block) {
    block.children.appendData({
      type: 'Declaration',
      important: false,
      property: POSITION_ANCHOR_PROPERTY,
      value: {
        type: 'Raw',
        value: getDeclarationValue(node),
      },
    });
    return { updated: true };
  }
  return {};
}

// Move inset declarations to cascadable properties
// property.
function shiftInsetData(node: csstree.CssNode, block?: csstree.Block) {
  if (isAnchorFunction(node) && block) {
    block.children.appendData({
      type: 'Declaration',
      important: false,
      property: POSITION_ANCHOR_PROPERTY,
      value: {
        type: 'Raw',
        value: node,
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
        const { updated: insetUpdated} = shiftInsetData(node, block);
        if (insetUpdated) {
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
