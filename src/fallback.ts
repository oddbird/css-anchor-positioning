import type * as csstree from 'css-tree';

import {
  ACCEPTED_POSITION_TRY_PROPERTIES,
  type AcceptedPositionTryProperty,
  type PositionTryOptionsTryTactics,
  type TryBlock,
} from './parse.js';
import {
  generateCSS,
  getAST,
  getCSSPropertyValue,
  INSTANCE_UUID,
  isAnchorFunction,
} from './utils.js';

export function applyTryTactic(
  selector: string,
  tactic: PositionTryOptionsTryTactics,
) {
  // todo: This currently only uses the styles from the first match. Each
  // element may have different styles and need a separate fallback definition.
  const el: HTMLElement | null = document.querySelector(selector);
  if (el) {
    const rules = getExistingInsetRules(el);
    const adjustedRules = applyTryTacticToBlock(rules, tactic);
    return adjustedRules;
  }
}

type InsetRules = Partial<Record<AcceptedPositionTryProperty, string>>;

export function getExistingInsetRules(el: HTMLElement) {
  const rules: InsetRules = {};
  ACCEPTED_POSITION_TRY_PROPERTIES.forEach((prop) => {
    const propVal = getCSSPropertyValue(
      el as HTMLElement,
      `--${prop}-${INSTANCE_UUID}`,
    );
    if (propVal) {
      rules[prop] = propVal;
    }
  });
  return rules;
}

const tryTacticsMapping: Record<
  PositionTryOptionsTryTactics,
  Partial<Record<AcceptedPositionTryProperty, AcceptedPositionTryProperty>>
> = {
  'flip-block': {
    top: 'bottom',
    bottom: 'top',
    'inset-block-start': 'inset-block-end',
    'inset-block-end': 'inset-block-start',
  },
  'flip-inline': {
    left: 'right',
    right: 'left',
    'inset-inline-start': 'inset-inline-end',
    'inset-inline-end': 'inset-inline-start',
  },
  'flip-start': {},
};

function mapProperty(
  property: AcceptedPositionTryProperty,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = tryTacticsMapping[tactic];

  return mapping[property] || property;
}

export function applyTryTacticToBlock(
  rules: InsetRules,
  tactic: PositionTryOptionsTryTactics,
) {
  const declarations: TryBlock['declarations'] = {};
  const keys = Object.keys(rules) as AcceptedPositionTryProperty[];
  keys.forEach((key) => {
    const property = mapProperty(key, tactic);
    // If we changed the property, set the original to `revert`,
    // but don't overwrite values already set
    if (property !== key) {
      declarations[key] ??= 'revert';
    }
    let rule = rules[key];
    const ast = getAST(`#id{${key}: ${rule};}`) as csstree.Block;
    const astPart = (
      (
        (ast.children.first as csstree.Rule)?.block.children
          .first as csstree.Declaration
      )?.value as csstree.Value
    ).children.first as csstree.CssNode;
    if (isAnchorFunction(astPart)) {
      astPart.children.map((item) => {
        if (
          item.type === 'Identifier' &&
          ACCEPTED_POSITION_TRY_PROPERTIES.includes(
            item.name as AcceptedPositionTryProperty,
          )
        ) {
          item.name = mapProperty(
            item.name as AcceptedPositionTryProperty,
            tactic,
          );
        }
      });
      rule = generateCSS(astPart);
    }
    declarations[property] = rule;
  });

  return declarations;
}
