import type * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import {
  ACCEPTED_POSITION_TRY_PROPERTIES,
  type AcceptedPositionTryProperty,
  ANCHOR_SIDES,
  type AnchorSideKeyword,
  type InsetProperty,
  isInsetProp,
  isMarginProp,
  isSelfAlignmentProp,
  isSizingProp,
  type TryBlock,
} from './parse.js';
import {
  type DeclarationWithValue,
  generateCSS,
  getAST,
  getCSSPropertyValue,
  INSTANCE_UUID,
  isAnchorFunction,
  splitCommaList,
} from './utils.js';

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
}

type InsetAreaProperty =
  | 'left'
  | 'center'
  | 'right'
  | 'span-left'
  | 'span-right'
  | 'x-start'
  | 'x-end'
  | 'span-x-start'
  | 'span-x-end'
  | 'x-self-start'
  | 'x-self-end'
  | 'span-x-self-start'
  | 'span-x-self-end'
  | 'span-all'
  | 'top'
  | 'bottom'
  | 'span-top'
  | 'span-bottom'
  | 'y-start'
  | 'y-end'
  | 'span-y-start'
  | 'span-y-end'
  | 'y-self-start'
  | 'y-self-end'
  | 'span-y-self-start'
  | 'span-y-self-end'
  | 'block-start'
  | 'block-end'
  | 'span-block-start'
  | 'span-block-end'
  | 'inline-start'
  | 'inline-end'
  | 'span-inline-start'
  | 'span-inline-end'
  | 'self-block-start'
  | 'self-block-end'
  | 'span-self-block-start'
  | 'span-self-block-end'
  | 'self-inline-start'
  | 'self-inline-end'
  | 'span-self-inline-start'
  | 'span-self-inline-end'
  | 'start'
  | 'end'
  | 'span-start'
  | 'span-end'
  | 'self-start'
  | 'self-end'
  | 'span-self-start'
  | 'span-self-end';

const INSET_AREA_PROPS: InsetAreaProperty[] = [
  'left',
  'center',
  'right',
  'span-left',
  'span-right',
  'x-start',
  'x-end',
  'span-x-start',
  'span-x-end',
  'x-self-start',
  'x-self-end',
  'span-x-self-start',
  'span-x-self-end',
  'span-all',
  'top',
  'bottom',
  'span-top',
  'span-bottom',
  'y-start',
  'y-end',
  'span-y-start',
  'span-y-end',
  'y-self-start',
  'y-self-end',
  'span-y-self-start',
  'span-y-self-end',
  'block-start',
  'block-end',
  'span-block-start',
  'span-block-end',
  'inline-start',
  'inline-end',
  'span-inline-start',
  'span-inline-end',
  'self-block-start',
  'self-block-end',
  'span-self-block-start',
  'span-self-block-end',
  'self-inline-start',
  'self-inline-end',
  'span-self-inline-start',
  'span-self-inline-end',
  'start',
  'end',
  'span-start',
  'span-end',
  'self-start',
  'self-end',
  'span-self-start',
  'span-self-end',
];

type InsetAreaPropertyChunks =
  | 'left'
  | 'center'
  | 'right'
  | 'span'
  | 'x'
  | 'start'
  | 'end'
  | 'self'
  | 'all'
  | 'top'
  | 'bottom'
  | 'y'
  | 'block'
  | 'inline';

export type PositionTryOrder =
  | 'normal'
  | 'most-width'
  | 'most-height'
  | 'most-block-size'
  | 'most-inline-size';

const POSITION_TRY_ORDERS: PositionTryOrder[] = [
  'normal',
  'most-width',
  'most-height',
  'most-block-size',
  'most-inline-size',
];

export type PositionTryOptionsTryTactics =
  | 'flip-block'
  | 'flip-inline'
  | 'flip-start';

const POSITION_TRY_TACTICS = ['flip-block', 'flip-inline', 'flip-start'];

interface PositionTryDefTactic {
  type: 'try-tactic';
  tactic: PositionTryOptionsTryTactics;
}
interface PositionTryDefInsetArea {
  type: 'inset-area';
  insetArea: InsetProperty;
}
interface PositionTryDefAtRule {
  type: 'at-rule';
  atRule: csstree.Identifier['name'];
}
interface PositionTryDefAtRuleWithTactic {
  type: 'at-rule-with-try-tactic';
  tactic: PositionTryOptionsTryTactics;
  atRule: csstree.Identifier['name'];
}

type PositionTryObject =
  | PositionTryDefTactic
  | PositionTryDefInsetArea
  | PositionTryDefAtRule
  | PositionTryDefAtRuleWithTactic;

export function isInsetAreaProp(
  property: string | InsetAreaProperty,
): property is InsetAreaProperty {
  return INSET_AREA_PROPS.includes(property as InsetAreaProperty);
}

function isDeclaration(node: csstree.CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration';
}

function isPositionTryFallbacksDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return (
    node.type === 'Declaration' && node.property === 'position-try-fallbacks'
  );
}

function isPositionTryOrderDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-try-order';
}

function isPositionTryDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-try';
}

function isPositionTryAtRule(node: csstree.CssNode): node is AtRuleRaw {
  return node.type === 'Atrule' && node.name === 'position-try';
}

function isPositionTryTactic(
  name: string,
): name is PositionTryOptionsTryTactics {
  return POSITION_TRY_TACTICS.includes(name);
}

function isPositionTryOrder(name: string): name is PositionTryOrder {
  return POSITION_TRY_ORDERS.includes(name as PositionTryOrder);
}

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
    'margin-top': 'margin-bottom',
    'margin-bottom': 'margin-top',
  },
  'flip-inline': {
    left: 'right',
    right: 'left',
    'inset-inline-start': 'inset-inline-end',
    'inset-inline-end': 'inset-inline-start',
    'margin-left': 'margin-right',
    'margin-right': 'margin-left',
  },
  'flip-start': {
    left: 'top',
    right: 'bottom',
    top: 'left',
    bottom: 'right',
    'inset-block-start': 'inset-block-end',
    'inset-block-end': 'inset-block-start',
    'inset-inline-start': 'inset-inline-end',
    'inset-inline-end': 'inset-inline-start',
    'inset-block': 'inset-inline',
    'inset-inline': 'inset-block',
  },
};

const anchorSideMapping: Record<
  PositionTryOptionsTryTactics,
  Partial<Record<AnchorSideKeyword, AnchorSideKeyword>>
> = {
  'flip-block': {
    top: 'bottom',
    bottom: 'top',
    start: 'end',
    end: 'start',
    'self-end': 'self-start',
    'self-start': 'self-end',
  },
  'flip-inline': {
    left: 'right',
    right: 'left',
    start: 'end',
    end: 'start',
    'self-end': 'self-start',
    'self-start': 'self-end',
  },
  'flip-start': {
    top: 'left',
    left: 'top',
    right: 'bottom',
    bottom: 'right',
  },
};

const insetAreaPropertyMapping: Record<
  PositionTryOptionsTryTactics,
  Partial<Record<InsetAreaPropertyChunks, InsetAreaPropertyChunks>>
> = {
  'flip-block': {
    top: 'bottom',
    bottom: 'top',
    start: 'end',
    end: 'start',
  },
  'flip-inline': {
    left: 'right',
    right: 'left',
    start: 'end',
    end: 'start',
  },
  'flip-start': {
    // TODO: Requires fuller logic
  },
};

function mapProperty(
  property: AcceptedPositionTryProperty,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = tryTacticsMapping[tactic];
  return mapping[property] || property;
}

function mapAnchorSide(
  side: AnchorSideKeyword,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = anchorSideMapping[tactic];
  return mapping[side] || side;
}

function mapInsetArea(
  prop: InsetAreaProperty,
  tactic: PositionTryOptionsTryTactics,
) {
  if (tactic === 'flip-start') {
    return prop;
  } else {
    const mapping = insetAreaPropertyMapping[tactic];
    return prop
      .split('-')
      .map((value) => mapping[value as InsetAreaPropertyChunks] || value)
      .join('-');
  }
}

function mapMargin(
  key: string,
  valueAst: csstree.Value,
  tactic: PositionTryOptionsTryTactics,
) {
  // TODO: Handle flip-start
  if (key === 'margin') {
    const [first, second, third, fourth] = valueAst.children.toArray();
    if (tactic === 'flip-block') {
      if (fourth) {
        valueAst.children.fromArray([third, second, first, fourth]);
      } else if (third) {
        valueAst.children.fromArray([third, second, first]);
      } // No change needed for 1 or 2 values
    } else if (tactic === 'flip-inline') {
      if (fourth) {
        valueAst.children.fromArray([first, fourth, third, second]);
      } // No change needed for 1, 2 or 3 values
    }
  } else if (key === 'margin-block') {
    const [first, second] = valueAst.children.toArray();
    if (tactic === 'flip-block') {
      if (second) {
        valueAst.children.fromArray([second, first]);
      }
    }
  } else if (key === 'margin-inline') {
    const [first, second] = valueAst.children.toArray();
    if (tactic === 'flip-inline') {
      if (second) {
        valueAst.children.fromArray([second, first]);
      }
    }
  }
}

const getValueAST = (property: string, val: string) => {
  const ast = getAST(`#id{${property}: ${val};}`) as csstree.Block;
  const astDeclaration = (ast.children.first as csstree.Rule)?.block.children
    .first as csstree.Declaration;
  return astDeclaration.value as csstree.Value;
};

export function applyTryTacticToBlock(
  rules: InsetRules,
  tactic: PositionTryOptionsTryTactics,
) {
  const declarations: TryBlock['declarations'] = {};
  Object.entries(rules).forEach(([_key, value]) => {
    const key = _key as AcceptedPositionTryProperty;
    const valueAst = getValueAST(key, value);

    const newKey = mapProperty(key as AcceptedPositionTryProperty, tactic);

    // If we're changing the property, revert the original if it hasn't been set.
    if (newKey !== key) {
      declarations[key] ??= 'revert';
    }

    if (isAnchorFunction(valueAst.children.first)) {
      valueAst.children.first.children.map((item) => {
        if (
          item.type === 'Identifier' &&
          ANCHOR_SIDES.includes(item.name as AnchorSideKeyword)
        ) {
          item.name = mapAnchorSide(item.name as AnchorSideKeyword, tactic);
        }
      });
    }

    if (key === 'inset-area') {
      valueAst.children.map((id) => {
        if (id.type === 'Identifier' && isInsetAreaProp(id.name)) {
          id.name = mapInsetArea(id.name, tactic);
        }
        return id;
      });
    }
    if (key.startsWith('margin')) {
      mapMargin(key, valueAst, tactic);
    }

    declarations[newKey] = generateCSS(valueAst);
  });
  return declarations;
}

function parsePositionTryFallbacks(list: csstree.List<csstree.CssNode>) {
  const positionOptions = splitCommaList(list);
  const tryObjects: PositionTryObject[] = [];
  positionOptions.forEach((option) => {
    if (option.length === 2 && isPositionTryTactic(option[0].name)) {
      tryObjects.push({
        tactic: option[0].name,
        atRule: option[1].name,
        type: 'at-rule-with-try-tactic',
      });
    } else if (option[0].name.startsWith('--')) {
      tryObjects.push({
        atRule: option[0].name,
        type: 'at-rule',
      });
    } else if (isPositionTryTactic(option[0].name)) {
      tryObjects.push({
        tactic: option[0].name,
        type: 'try-tactic',
      });
    } else if (isInsetProp(option[0].name)) {
      tryObjects.push({
        insetArea: option[0].name,
        type: 'inset-area',
      });
    }
  });
  return tryObjects;
}

function getPositionTryOptionsDeclaration(
  node: csstree.Declaration,
  rule?: csstree.Raw,
) {
  if (
    isPositionTryFallbacksDeclaration(node) &&
    node.value.children.first &&
    rule?.value
  ) {
    return parsePositionTryFallbacks(node.value.children);
  }
  return [];
}

function getPositionTryDeclaration(
  node: csstree.Declaration,
  rule?: csstree.Raw,
): { order?: PositionTryOrder; options?: PositionTryObject[] } {
  if (
    isPositionTryDeclaration(node) &&
    node.value.children.first &&
    rule?.value
  ) {
    let order: PositionTryOrder | undefined;
    // get potential order
    const firstName = (node.value.children.first as csstree.Identifier).name;
    if (firstName && isPositionTryOrder(firstName)) {
      order = firstName;
      node.value.children.shift();
    }
    const options = parsePositionTryFallbacks(node.value.children);

    return { order, options };
  }
  return {};
}

function getPositionTryOrderDeclaration(
  node: csstree.Declaration,
  rule?: csstree.Raw,
) {
  if (
    isPositionTryOrderDeclaration(node) &&
    node.value.children.first &&
    rule?.value
  ) {
    return {
      order: (node.value.children.first as csstree.Identifier)
        .name as PositionTryOrder,
    };
  }
  return {};
}

export function getPositionFallbackValues(
  node: csstree.Declaration,
  rule?: csstree.Raw,
): { order?: PositionTryOrder; options?: PositionTryObject[] } {
  const { order, options } = getPositionTryDeclaration(node, rule);
  if (order || options) {
    return { order, options };
  }
  const { order: orderDeclaration } = getPositionTryOrderDeclaration(
    node,
    rule,
  );
  const optionsNames = getPositionTryOptionsDeclaration(node, rule);
  if (orderDeclaration || optionsNames) {
    return { order: orderDeclaration, options: optionsNames };
  }
  return {};
}

// https://drafts.csswg.org/css-anchor-position-1/#accepted-position-try-properties
export function isAcceptedPositionTryProperty(
  declaration: csstree.Declaration,
) {
  return (
    isInsetProp(declaration.property) ||
    isMarginProp(declaration.property) ||
    isSizingProp(declaration.property) ||
    isSelfAlignmentProp(declaration.property) ||
    ['position-anchor', 'inset-area'].includes(declaration.property)
  );
}

export function getPositionTryRules(node: csstree.Atrule) {
  if (
    isPositionTryAtRule(node) &&
    node.prelude?.value &&
    node.block?.children
  ) {
    const name = node.prelude.value;
    const tryBlocks: TryBlock[] = [];
    const declarations = node.block.children.filter(
      (d): d is DeclarationWithValue =>
        isDeclaration(d) && isAcceptedPositionTryProperty(d),
    );
    const tryBlock: TryBlock = {
      uuid: `${name}-try-${nanoid(12)}`,
      declarations: Object.fromEntries(
        declarations.map((d) => [d.property, generateCSS(d.value)]),
      ),
    };

    tryBlocks.push(tryBlock);

    return { name, blocks: tryBlocks };
  }
  return {};
}
