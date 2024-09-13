import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import { getCSSPropertyValue } from './dom.js';
import {
  type AnchorPosition,
  type AnchorPositions,
  isIdentifier,
  type TryBlock,
} from './parse.js';
import {
  ACCEPTED_POSITION_TRY_PROPERTIES,
  type AcceptedPositionTryProperty,
  type AnchorSideKeyword,
  isAnchorSide,
  isInsetProp,
  isMarginProp,
  isSelfAlignmentProp,
  isSizingProp,
} from './syntax.js';
import {
  type DeclarationWithValue,
  generateCSS,
  getAST,
  getSelectors,
  INSTANCE_UUID,
  isAnchorFunction,
  splitCommaList,
  type StyleData,
} from './utils.js';

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
}

// `key` is the `@position-try` block uuid
// `value` is the target element selector
type FallbackTargets = Record<string, string[]>;

type Fallbacks = Record<
  // `key` is a reference to a specific `position-try-fallbacks` value, which
  // may be a dashed ident name of a `@position-try` rule, or the selector
  // combined with `try-tactics` and `@position-try` rules.
  string,
  // `value` is a block of `@position-try` declarations
  TryBlock
>;

const POSITION_AREA_PROPS = [
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
] as const;

type PositionAreaProperty = (typeof POSITION_AREA_PROPS)[number];

type PositionAreaPropertyChunks =
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

const POSITION_TRY_ORDERS = [
  'normal',
  'most-width',
  'most-height',
  'most-block-size',
  'most-inline-size',
] as const;

export type PositionTryOrder = (typeof POSITION_TRY_ORDERS)[number];

const POSITION_TRY_TACTICS = [
  'flip-block',
  'flip-inline',
  'flip-start',
] as const;

export type PositionTryOptionsTryTactics =
  (typeof POSITION_TRY_TACTICS)[number];

interface PositionTryDefTactic {
  type: 'try-tactic';
  tactics: PositionTryOptionsTryTactics[];
}
interface PositionTryDefPositionArea {
  type: 'position-area';
  positionArea: PositionAreaProperty;
}
interface PositionTryDefAtRule {
  type: 'at-rule';
  atRule: csstree.Identifier['name'];
}
interface PositionTryDefAtRuleWithTactic {
  type: 'at-rule-with-try-tactic';
  tactics: PositionTryOptionsTryTactics[];
  atRule: csstree.Identifier['name'];
}

type PositionTryObject =
  | PositionTryDefTactic
  | PositionTryDefPositionArea
  | PositionTryDefAtRule
  | PositionTryDefAtRuleWithTactic;

export function isPositionAreaProp(
  property: string | PositionAreaProperty,
): property is PositionAreaProperty {
  return POSITION_AREA_PROPS.includes(property as PositionAreaProperty);
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
  return POSITION_TRY_TACTICS.includes(name as PositionTryOptionsTryTactics);
}

function isPositionTryOrder(name: string): name is PositionTryOrder {
  return POSITION_TRY_ORDERS.includes(name as PositionTryOrder);
}

export function applyTryTacticsToSelector(
  selector: string,
  tactics: PositionTryOptionsTryTactics[],
) {
  // todo: This currently only uses the styles from the first match. Each
  // element may have different styles and need a separate fallback definition.
  const el: HTMLElement | null = document.querySelector(selector);
  if (el) {
    let rules = getExistingInsetRules(el);
    tactics.forEach((tactic) => {
      rules = applyTryTacticToBlock(rules, tactic);
    });
    return rules;
  }
}
export function applyTryTacticsToAtRule(
  block: TryBlock,
  tactics: PositionTryOptionsTryTactics[],
) {
  let rules = block.declarations;
  tactics.forEach((tactic) => {
    rules = applyTryTacticToBlock(rules, tactic);
  });
  return rules;
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

const tryTacticsPropertyMapping: Record<
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

const PositionAreaPropertyMapping: Record<
  PositionTryOptionsTryTactics,
  Partial<Record<PositionAreaPropertyChunks, PositionAreaPropertyChunks>>
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
  const mapping = tryTacticsPropertyMapping[tactic];
  return mapping[property] || property;
}

function mapAnchorSide(
  side: AnchorSideKeyword,
  tactic: PositionTryOptionsTryTactics,
) {
  const mapping = anchorSideMapping[tactic];
  return mapping[side] || side;
}

function mapPositionArea(
  prop: PositionAreaProperty,
  tactic: PositionTryOptionsTryTactics,
) {
  if (tactic === 'flip-start') {
    // TODO: Handle flip-start
    return prop;
  } else {
    const mapping = PositionAreaPropertyMapping[tactic];
    return prop
      .split('-')
      .map((value) => mapping[value as PositionAreaPropertyChunks] || value)
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

// Parses a value into an AST.
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

    const newKey = mapProperty(key, tactic);

    // If we're changing the property, revert the original if it hasn't been set.
    if (newKey !== key) {
      declarations[key] ??= 'revert';
    }

    // todo: This does not support percentage anchor-side values, nor anchor
    // functions that are passed through custom properties.
    csstree.walk(valueAst, {
      visit: 'Function',
      enter(node) {
        if (isAnchorFunction(node)) {
          node.children.forEach((item) => {
            if (isIdentifier(item) && isAnchorSide(item.name)) {
              item.name = mapAnchorSide(item.name, tactic);
            }
          });
        }
      },
    });

    if (key === 'position-area') {
      valueAst.children.forEach((id) => {
        if (isIdentifier(id) && isPositionAreaProp(id.name)) {
          id.name = mapPositionArea(id.name, tactic);
        }
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
    const identifiers: {
      atRules: PositionTryDefAtRuleWithTactic['atRule'][];
      tactics: PositionTryOptionsTryTactics[];
      positionAreas: PositionAreaProperty[];
    } = {
      atRules: [],
      tactics: [],
      positionAreas: [],
    };
    option.forEach((opt) => {
      if (isPositionTryTactic(opt.name)) identifiers.tactics.push(opt.name);
      else if (opt.name.startsWith('--')) identifiers.atRules.push(opt.name);
      else if (isPositionAreaProp(opt.name))
        identifiers.positionAreas.push(opt.name);
    });
    // Position area can not be combined or have multiple
    if (identifiers.positionAreas.length) {
      tryObjects.push({
        positionArea: identifiers.positionAreas[0],
        type: 'position-area',
      });
      // multiple tactics can modify a single at rule
    } else if (identifiers.atRules.length && identifiers.tactics.length) {
      tryObjects.push({
        tactics: identifiers.tactics,
        atRule: identifiers.atRules[0],
        type: 'at-rule-with-try-tactic',
      });
      // A single at rule
    } else if (identifiers.atRules.length) {
      tryObjects.push({
        atRule: identifiers.atRules[0],
        type: 'at-rule',
      });
      // One or multiple combined try tactics
    } else if (identifiers.tactics.length) {
      tryObjects.push({
        tactics: identifiers.tactics,
        type: 'try-tactic',
      });
    }
  });
  return tryObjects;
}

function getPositionTryFallbacksDeclaration(node: csstree.Declaration) {
  if (isPositionTryFallbacksDeclaration(node) && node.value.children.first) {
    return parsePositionTryFallbacks(node.value.children);
  }
  return [];
}

export function getPositionTryDeclaration(node: csstree.Declaration): {
  order?: PositionTryOrder;
  options?: PositionTryObject[];
} {
  if (isPositionTryDeclaration(node) && node.value.children.first) {
    const declarationNode = csstree.clone(node) as DeclarationWithValue;
    let order: PositionTryOrder | undefined;
    // get potential order
    const firstName = (
      declarationNode.value.children.first as csstree.Identifier
    ).name;
    if (firstName && isPositionTryOrder(firstName)) {
      order = firstName;
      declarationNode.value.children.shift();
    }
    const options = parsePositionTryFallbacks(declarationNode.value.children);

    return { order, options };
  }
  return {};
}

function getPositionTryOrderDeclaration(node: csstree.Declaration) {
  if (isPositionTryOrderDeclaration(node) && node.value.children.first) {
    return {
      order: (node.value.children.first as csstree.Identifier)
        .name as PositionTryOrder,
    };
  }
  return {};
}

export function getPositionFallbackValues(node: csstree.Declaration): {
  order?: PositionTryOrder;
  options?: PositionTryObject[];
} {
  const { order, options } = getPositionTryDeclaration(node);
  if (order || options) {
    return { order, options };
  }
  const { order: orderDeclaration } = getPositionTryOrderDeclaration(node);
  const optionsNames = getPositionTryFallbacksDeclaration(node);
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
    ['position-anchor', 'position-area'].includes(declaration.property)
  );
}

export function getPositionTryRules(node: csstree.Atrule) {
  if (
    isPositionTryAtRule(node) &&
    node.prelude?.value &&
    node.block?.children
  ) {
    const name = node.prelude.value;
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

    return { name, tryBlock };
  }
  return {};
}

export function parsePositionFallbacks(styleData: StyleData[]) {
  const fallbacks: Fallbacks = {};
  const fallbackTargets: FallbackTargets = {};
  const validPositions: AnchorPositions = {};

  // First, find all uses of `@position-try`
  for (const styleObj of styleData) {
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        // Parse `@position-try` rules
        const { name, tryBlock } = getPositionTryRules(node);
        if (name && tryBlock) {
          // This will override earlier `@position-try` lists with the same
          // name: (e.g. multiple `@position-try --my-fallback {...}` uses with
          // the same `--my-fallback` name)
          fallbacks[name] = tryBlock;
        }
      },
    });
  }

  // Then, find all `position-try` and related declarations,
  // and add in block contents (scoped to unique data-attrs)
  for (const styleObj of styleData) {
    let changed = false;
    const fallbacksAdded = new Set();
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const rule = this.rule?.prelude as csstree.SelectorList | undefined;
        const selectors = getSelectors(rule);
        if (!selectors.length) return;

        // Parse `position-try`, `position-try-order`, and
        // `position-try-fallbacks` declarations
        const { order, options } = getPositionFallbackValues(node);
        const anchorPosition: AnchorPosition = {};
        if (order) {
          anchorPosition.order = order;
        }
        selectors.forEach(({ selector }) => {
          options?.forEach((tryObject) => {
            let name;
            // Apply try fallback
            if (tryObject.type === 'at-rule') {
              name = tryObject.atRule;
            } else if (tryObject.type === 'try-tactic') {
              // get existing styles and adjust based on the specified tactic
              name = `${selector}-${tryObject.tactics.join('-')}`;
              const tacticAppliedRules = applyTryTacticsToSelector(
                selector,
                tryObject.tactics,
              );
              if (tacticAppliedRules) {
                // add new item to fallbacks store
                fallbacks[name] = {
                  uuid: `${selector}-${tryObject.tactics.join('-')}-try-${nanoid(12)}`,
                  declarations: tacticAppliedRules,
                };
              }
            } else if (tryObject.type === 'at-rule-with-try-tactic') {
              // get `@position-try` block styles and adjust based on the tactic
              name = `${selector}-${tryObject.atRule}-${tryObject.tactics.join('-')}`;
              const declarations = fallbacks[tryObject.atRule];
              const tacticAppliedRules = applyTryTacticsToAtRule(
                declarations,
                tryObject.tactics,
              );
              if (tacticAppliedRules) {
                // add new item to fallbacks store
                fallbacks[name] = {
                  uuid: `${selector}-${tryObject.atRule}-${tryObject.tactics.join('-')}-try-${nanoid(12)}`,
                  declarations: tacticAppliedRules,
                };
              }
            }

            if (name && fallbacks[name]) {
              const dataAttr = `[data-anchor-polyfill="${fallbacks[name].uuid}"]`;
              // Store mapping of data-attr to target selectors
              fallbackTargets[dataAttr] ??= [];
              fallbackTargets[dataAttr].push(selector);

              if (!fallbacksAdded.has(name)) {
                anchorPosition.fallbacks ??= [];
                anchorPosition.fallbacks.push(fallbacks[name]);
                fallbacksAdded.add(name);

                // Add `@position-try` block, scoped to a unique data-attr
                this.stylesheet?.children.prependData({
                  type: 'Rule',
                  prelude: {
                    type: 'Raw',
                    value: dataAttr,
                  },
                  block: {
                    type: 'Block',
                    children: new csstree.List<csstree.CssNode>().fromArray(
                      Object.entries(fallbacks[name].declarations).map(
                        ([prop, val]) => ({
                          type: 'Declaration',
                          important: true,
                          property: prop,
                          value: {
                            type: 'Raw',
                            value: val,
                          },
                        }),
                      ),
                    ),
                  },
                });
                changed = true;
              }
            }
          });
          if (Object.keys(anchorPosition).length > 0) {
            if (validPositions[selector]) {
              if (anchorPosition.order) {
                validPositions[selector].order = anchorPosition.order;
              }
              if (anchorPosition.fallbacks) {
                validPositions[selector].fallbacks ??= [];
                validPositions[selector].fallbacks.push(
                  ...anchorPosition.fallbacks,
                );
              }
              //  = {order: anchorPosition.order, fallbacks: [...[validPositions[selector].fallbacks], ...[anchorPosition.fallbacks]]};
            } else {
              validPositions[selector] = anchorPosition;
            }
          }
        });
      },
    });
    if (changed) {
      // Update CSS
      styleObj.css = generateCSS(ast);
      styleObj.changed = true;
    }
  }
  return { fallbackTargets, validPositions };
}
