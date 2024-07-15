import * as csstree from 'css-tree';

import { isInsetProp, isPositionAnchorDeclaration } from './parse.js';
import {
  generateCSS,
  getAST,
  getDeclarationValue,
  INSTANCE_UUID,
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
        const { updated: positionUpdated } = shiftPositionAnchorData(
          node,
          block,
        );

        const insetUpdated = shiftInsetProperties(node, block);

        changed = changed || positionUpdated || insetUpdated;
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
