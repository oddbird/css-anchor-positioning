import * as csstree from 'css-tree';

import {
  type DeclarationWithValue,
  getAST,
  getDeclarationValue,
  type StyleData,
} from './utils.js';

function isPositionAnchorDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-anchor';
}

// Move `position-anchor` declaration to cascadable `--position-anchor`
// property.
function shiftPositionAnchorData(node: csstree.CssNode, block?: csstree.Block) {
  if (isPositionAnchorDeclaration(node) && block) {
    const newProp = {
      type: 'Declaration',
      important: false,
      property: '--position-anchor',
      value: {
        type: 'Raw',
        value: getDeclarationValue(node),
      },
    } as const;

    block.children.append(block.children.createItem(newProp));
    return { updated: true };
  }
  return {};
}

export async function cascadeCSS(styleData: StyleData[]) {
  const changedStyles = [];
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, function (node) {
      const block = this.rule?.block;

      const { updated } = shiftPositionAnchorData(node, block);
      if (updated) {
        changed = true;
      }
    });
    if (changed) {
      // Update CSS
      styleObj.css = csstree.generate(ast);
      styleObj.changed = true;
      changedStyles.push(styleObj);
    }
  }
  return { changedStyles };
}
