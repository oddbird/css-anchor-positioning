import type * as csstree from 'css-tree';

import {
  getCSSPropertyValue,
  INSET_PROPS,
  type InsetProperty,
  type PositionTryOptionsTryTactics,
} from './parse.js';
import { isAnchorFunction } from './utils.js';

export function getExistingInsetRules(el: HTMLElement) {
  const rules: { [K in InsetProperty]?: string } = {};
  INSET_PROPS.forEach((prop) => {
    // todo: better typing than as HTMLElement
    const val = getCSSPropertyValue(el as HTMLElement, `${prop}`);
    if (val) {
      rules[prop] = val;
    }
    const propVal = getCSSPropertyValue(el as HTMLElement, `--${prop}`);
    if (propVal) {
      rules[prop] = propVal;
    }
  });
  return rules;
}

const tryTacticsMapping = {
  'flip-block': {
    top: 'bottom',
    bottom: 'top',
    'inset-block-start': 'inset-block-end',
    'inset-block-end': 'inset-block-start',
  },
};

export function applyTryTacticToBlock(
  block: csstree.Block,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = tryTacticsMapping[tactic];
  block.children.map((node) => {
    if (node.type === 'Declaration') {
      node.property = mapping[node.property] || node.property;
      if (node.value.type === 'Value') {
        node.value.children.map((valueChild) => {
          if (isAnchorFunction(valueChild)) {
            valueChild.children.map((functionChild) => {
              if (functionChild.type === 'Identifier') {
                functionChild.name =
                  mapping[functionChild.name] || functionChild.name;
              }
            });
          }
        });
      }
    } else return node;
  });
  return block;
}
