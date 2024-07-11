import {
  ACCEPTED_POSITION_TRY_PROPERTIES,
  type AcceptedPositionTryProperty,
  getCSSPropertyValue,
  type PositionTryOptionsTryTactics,
  type TryBlock,
} from './parse.js';
import {
  generateCSS,
  getAST,
  INSTANCE_UUID,
  isAnchorFunction,
} from './utils.js';

export function applyTryTactic(
  selector: string,
  tactic: PositionTryOptionsTryTactics,
) {
  const elements: NodeListOf<HTMLElement> = document.querySelectorAll(selector);
  return [...elements].map((el) => {
    const rules = getExistingInsetRules(el);
    const adjustedRules = applyTryTacticToBlock(rules, tactic);
    return adjustedRules;
  });
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

const tryTacticsMapping = {
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
};

export function applyTryTacticToBlock(
  rules: InsetRules,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = tryTacticsMapping[tactic] || {};
  const declarations: TryBlock['declarations'] = {};

  Object.keys(rules).forEach((key) => {
    const property = mapping[key] || key;
    if (property !== key) {
      declarations[key] = 'revert';
    }
    let rule = rules[key];
    const ast = getAST(`#id{${key}: ${rule};}`);
    const astPart =
      ast.children.first.block.children.first.value.children.first;
    if (isAnchorFunction(astPart)) {
      astPart.children.map((item) => {
        if (item.type === 'Identifier') {
          item.name = mapping[item.name] || item.name;
        }
      });
      rule = generateCSS(astPart);
    }
    declarations[property] = rule;
  });

  return declarations;
}
