import * as csstree from 'css-tree';
import { nanoid } from 'nanoid';

import { isPositionAnchorDeclaration } from './parse.js';
import {
  generateCSS,
  getAST,
  getDeclarationValue,
  INSTANCE_UUID,
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
function shiftAnchorFunctionDeclarations(
  node: csstree.Declaration,
  block?: csstree.Block,
) {
  const value = (node.value as csstree.Value)?.children?.first;
  if (value && isAnchorFunction(value) && block) {
    let existingBlockId = block.children.filter(
      (item) =>
        item.type === 'Declaration' &&
        item.property === `--block-id-${INSTANCE_UUID}`,
    )?.first?.value.value;

    if (!existingBlockId) {
      existingBlockId = nanoid();
      block.children.appendData({
        type: 'Declaration',
        important: false,
        property: `--block-id-${INSTANCE_UUID}`,
        value: { type: 'Raw', value: existingBlockId },
      });
    }
    block.children.appendData({
      type: 'Declaration',
      important: false,
      property: `--${node.property}-${INSTANCE_UUID}`,
      value: { type: 'Raw', value: existingBlockId },
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
        const { updated: insetUpdated } = shiftAnchorFunctionDeclarations(
          node,
          block,
        );
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
