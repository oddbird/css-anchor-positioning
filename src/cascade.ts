import * as csstree from 'css-tree';
import { nanoid } from 'nanoid';

import { isInsetProp, isPositionAnchorDeclaration } from './parse.js';
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

// Add unique id to each block with an anchor function
// Add custom property identifying which properties have anchor functions applied
// We may be able to remove this,
// if moving all inset properties to custom properties captures required info.
function shiftAnchorFunctionDeclarations(
  node: csstree.Declaration,
  block?: csstree.Block,
) {
  const value = (node.value as csstree.Value)?.children?.first;
  if (value && isAnchorFunction(value) && block) {
    let existingBlockId;
    const existingBlockIdDeclaration = block.children.filter(
      (item) =>
        item.type === 'Declaration' &&
        item.property === `--block-id-${INSTANCE_UUID}`,
    );
    if (existingBlockIdDeclaration) {
      existingBlockId = (
        (existingBlockIdDeclaration.first as csstree.Declaration)
          ?.value as csstree.Raw
      )?.value;
    } else return false;

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
    return true;
  }
  return false;
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

        const anchorUpdated = shiftAnchorFunctionDeclarations(node, block);

        const insetUpdated = shiftInsetProperties(node, block);

        changed = changed || positionUpdated || anchorUpdated || insetUpdated;
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
