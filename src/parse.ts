import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import { applyTryTacticToBlock } from './fallback.js';
import {
  type DeclarationWithValue,
  generateCSS,
  getAST,
  isAnchorFunction,
  POSITION_ANCHOR_PROPERTY,
  splitCommaList,
  type StyleData,
} from './utils.js';
import { validatedForPositioning } from './validate.js';

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
}

// `key` is the `anchor-name` value
// `value` is an array of all element selectors with that anchor name
type AnchorNames = Record<string, string[]>;

export type InsetProperty =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'inset-block-start'
  | 'inset-block-end'
  | 'inset-inline-start'
  | 'inset-inline-end'
  | 'inset-block'
  | 'inset-inline'
  | 'inset';

export const INSET_PROPS: InsetProperty[] = [
  'left',
  'right',
  'top',
  'bottom',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block',
  'inset-inline',
  'inset',
];

export type MarginProperty =
  | 'margin-block-start'
  | 'margin-block-end'
  | 'margin-block'
  | 'margin-inline-start'
  | 'margin-inline-end'
  | 'margin-inline'
  | 'margin-bottom'
  | 'margin-left'
  | 'margin-right'
  | 'margin-top'
  | 'margin';

export const MARGIN_PROPERTIES: MarginProperty[] = [
  'margin-block-start',
  'margin-block-end',
  'margin-block',
  'margin-inline-start',
  'margin-inline-end',
  'margin-inline',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'margin',
];

export type SizingProperty =
  | 'width'
  | 'height'
  | 'min-width'
  | 'min-height'
  | 'max-width'
  | 'max-height'
  | 'block-size'
  | 'inline-size'
  | 'min-block-size'
  | 'min-inline-size'
  | 'max-block-size'
  | 'max-inline-size';

const SIZING_PROPS: SizingProperty[] = [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'block-size',
  'inline-size',
  'min-block-size',
  'min-inline-size',
  'max-block-size',
  'max-inline-size',
];

export type SelfAlignmentProperty =
  | 'justify-self'
  | 'align-self'
  | 'place-self';

const SELF_ALIGNMENT_PROPS: SelfAlignmentProperty[] = [
  'justify-self',
  'align-self',
  'place-self',
];

type AnchorSideKeyword =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end'
  | 'center';

const ANCHOR_SIDES: AnchorSideKeyword[] = [
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'self-start',
  'self-end',
  'center',
];

export type AnchorSide = AnchorSideKeyword | number;

export type AnchorSize =
  | 'width'
  | 'height'
  | 'block'
  | 'inline'
  | 'self-block'
  | 'self-inline';

const ANCHOR_SIZES: AnchorSize[] = [
  'width',
  'height',
  'block',
  'inline',
  'self-block',
  'self-inline',
];

type PositionTryOrder =
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

export interface AnchorFunction {
  targetEl?: HTMLElement | null;
  anchorEl?: HTMLElement | null;
  anchorName?: string;
  anchorSide?: AnchorSide;
  anchorSize?: AnchorSize;
  fallbackValue: string;
  customPropName?: string;
  uuid: string;
}

// `key` is the property being declared
// `value` is the anchor-positioning data for that property
export type AnchorFunctionDeclaration = Partial<
  Record<InsetProperty | SizingProperty, AnchorFunction[]>
>;

// `key` is the target element selector
// `value` is an object with all anchor-function declarations on that element
type AnchorFunctionDeclarations = Record<string, AnchorFunctionDeclaration>;

interface AnchorPosition {
  declarations?: AnchorFunctionDeclaration;
  fallbacks?: TryBlock[];
  order?: PositionTryOrder;
}

// `key` is the target element selector
// `value` is an object with all anchor-positioning data for that element
export type AnchorPositions = Record<string, AnchorPosition>;

export interface TryBlock {
  uuid: string;
  // `key` is the property being declared
  // `value` is the property value
  declarations: Partial<
    Record<InsetProperty | MarginProperty | SizingProperty | SelfAlignmentProperty | 'position-anchor' | 'inset-area', string>
  >;
}

// `key` is the `@position-try` block uuid
// `value` is the target element selector
type FallbackTargets = Record<string, string>;

type Fallbacks = Record<
  // `key` is the `position-fallback` value (name)
  string,
  {
    // `targets` is an array of selectors where this `position-fallback` is used
    targets: string[];
    // `blocks` is an array of `@try` block declarations (in order)
    blocks: TryBlock[];
  }
>;

function isDeclaration(node: csstree.CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration';
}

function isAnchorNameDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'anchor-name';
}

function isAnchorSizeFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(
    node && node.type === 'Function' && node.name === 'anchor-size',
  );
}

function isVarFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'var');
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

function isIdentifier(node: csstree.CssNode): node is csstree.Identifier {
  return Boolean(node.type === 'Identifier' && node.name);
}

function isPercentage(node: csstree.CssNode): node is csstree.Percentage {
  return Boolean(node.type === 'Percentage' && node.value);
}

export function isInsetProp(
  property: string | AnchorSide,
): property is InsetProperty {
  return INSET_PROPS.includes(property as InsetProperty);
}

function isAnchorSide(property: string): property is AnchorSideKeyword {
  return ANCHOR_SIDES.includes(property as AnchorSideKeyword);
}

export function isSizingProp(property: string): property is SizingProperty {
  return SIZING_PROPS.includes(property as SizingProperty);
}

export function isMarginProp(property: string): property is MarginProperty {
  return MARGIN_PROPERTIES.includes(property as MarginProperty);
}

function isAnchorSize(property: string): property is AnchorSize {
  return ANCHOR_SIZES.includes(property as AnchorSize);
}

export function isSelfAlignmentProp(
  property: string,
): property is SelfAlignmentProperty {
  return SELF_ALIGNMENT_PROPS.includes(property as SelfAlignmentProperty);
}

export function isPositionAnchorDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-anchor';
}

function parseAnchorFn(
  node: csstree.FunctionNode,
  replaceCss?: boolean,
): AnchorFunction {
  let anchorName: string | undefined,
    anchorSide: AnchorSide | undefined,
    anchorSize: AnchorSize | undefined,
    fallbackValue = '',
    foundComma = false,
    customPropName: string | undefined;

  const args: csstree.CssNode[] = [];
  node.children.toArray().forEach((child) => {
    if (foundComma) {
      fallbackValue = `${fallbackValue}${generateCSS(child)}`;
      return;
    }
    if (child.type === 'Operator' && child.value === ',') {
      foundComma = true;
      return;
    }
    args.push(child);
  });

  let [name, sideOrSize]: (csstree.CssNode | undefined)[] = args;
  if (!sideOrSize) {
    // If we only have one argument assume it is the (required) anchor-side/size
    sideOrSize = name;
    name = undefined;
  }
  if (name) {
    if (isIdentifier(name)) {
      if (name.name === 'implicit') {
        name = undefined;
      } else if (name.name.startsWith('--')) {
        // Store anchor name
        anchorName = name.name;
      }
    } else if (isVarFunction(name) && name.children.first) {
      // Store CSS custom prop for anchor name
      customPropName = (name.children.first as csstree.Identifier).name;
    }
  }
  if (sideOrSize) {
    if (isAnchorFunction(node)) {
      if (isIdentifier(sideOrSize) && isAnchorSide(sideOrSize.name)) {
        anchorSide = sideOrSize.name;
      } else if (isPercentage(sideOrSize)) {
        const number = Number(sideOrSize.value);
        anchorSide = Number.isNaN(number) ? undefined : number;
      }
    } else if (
      isAnchorSizeFunction(node) &&
      isIdentifier(sideOrSize) &&
      isAnchorSize(sideOrSize.name)
    ) {
      anchorSize = sideOrSize.name;
    }
  }

  const uuid = `--anchor-${nanoid(12)}`;
  if (replaceCss) {
    // Replace anchor function with unique CSS custom property.
    // This allows us to update the value of the new custom property
    // every time the position changes.
    Object.assign(node, {
      type: 'Raw',
      value: `var(${uuid})`,
      children: null,
    });
    Reflect.deleteProperty(node, 'name');
  }

  return {
    anchorName,
    anchorSide,
    anchorSize,
    fallbackValue: fallbackValue || '0px',
    customPropName,
    uuid,
  };
}

function getAnchorNameData(node: csstree.CssNode, rule?: csstree.Raw) {
  if (
    isAnchorNameDeclaration(node) &&
    !node.value.children.isEmpty &&
    rule?.value
  ) {
    return node.value.children.map((item) => {
      const { name } = item as csstree.Identifier;
      return { name, selector: rule.value };
    });
  }
  return [];
}

let anchorNames: AnchorNames = {};
// Mapping of custom property names, to anchor function data objects referenced
// in their values
let customPropAssignments: Record<string, AnchorFunction[]> = {};
// Mapping of custom property names, to the original values that have been
// replaced in the CSS
let customPropOriginals: Record<string, string> = {};
// Top-level key (`uuid`) is the original uuid to find in the updated CSS
// - `key` (`propUuid`) is the new property-specific uuid to append to the
//   original custom property name
// - `value` is the new property-specific custom property value to use
let customPropReplacements: Record<string, Record<string, string>> = {};

// Objects are declared at top-level to keep code cleaner,
// but we reset them on every `parseCSS()` call
// to prevent data leaking from one call to another.
function resetStores() {
  anchorNames = {};
  customPropAssignments = {};
  customPropOriginals = {};
  customPropReplacements = {};
}

function getAnchorFunctionData(
  node: csstree.CssNode,
  declaration: csstree.Declaration | null,
) {
  if ((isAnchorFunction(node) || isAnchorSizeFunction(node)) && declaration) {
    if (declaration.property.startsWith('--')) {
      const original = generateCSS(declaration.value);
      const data = parseAnchorFn(node, true);
      // Store the original anchor function so that we can restore it later
      customPropOriginals[data.uuid] = original;
      customPropAssignments[declaration.property] = [
        ...(customPropAssignments[declaration.property] ?? []),
        data,
      ];
      return { changed: true };
    }
    if (
      isInsetProp(declaration.property) ||
      isSizingProp(declaration.property)
    ) {
      const data = parseAnchorFn(node, true);
      return { prop: declaration.property, data, changed: true };
    }
  }
  return {};
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

function getPositionFallbackValues(
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

function getPositionTryRules(node: csstree.Atrule) {
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

// Takes a selector, and for each element, creates a new block with the tactic
function applyTryTactic(
  selector: string,
  tactic: PositionTryOptionsTryTactics,
) {
  const elements = document.querySelectorAll(selector);
  return [...elements].map((el) => {
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
    const adjustedRules = applyTryTacticToBlock(rules, tactic);
    return adjustedRules;
  });
}

export function getCSSPropertyValue(el: HTMLElement, prop: string) {
  return getComputedStyle(el).getPropertyValue(prop).trim();
}

async function getAnchorEl(
  targetEl: HTMLElement | null,
  anchorObj: AnchorFunction,
) {
  let anchorName = anchorObj.anchorName;
  const customPropName = anchorObj.customPropName;
  if (targetEl && !anchorName) {
    const anchorAttr = targetEl.getAttribute('anchor');
    const positionAnchorProperty = getCSSPropertyValue(
      targetEl,
      POSITION_ANCHOR_PROPERTY,
    );

    if (positionAnchorProperty) {
      anchorName = positionAnchorProperty;
    } else if (customPropName) {
      anchorName = getCSSPropertyValue(targetEl, customPropName);
    } else if (anchorAttr) {
      return await validatedForPositioning(targetEl, [
        `#${CSS.escape(anchorAttr)}`,
      ]);
    }
  }
  const anchorSelectors = anchorName ? anchorNames[anchorName] ?? [] : [];
  return await validatedForPositioning(targetEl, anchorSelectors);
}

export async function parseCSS(styleData: StyleData[]) {
  const anchorFunctions: AnchorFunctionDeclarations = {};
  const fallbackTargets: FallbackTargets = {};
  const fallbacks: Fallbacks = {};
  // Final data merged together under target-element selector key
  const validPositions: AnchorPositions = {};
  resetStores();

  // First, find all uses of `@position-try`
  for (const styleObj of styleData) {
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        // Parse `@position-try` rules
        const { name, blocks } = getPositionTryRules(node);
        if (name && blocks?.length) {
          // This will override earlier `@position-try` lists
          // with the same name:
          // (e.g. multiple `@position-try --my-fallback {...}` uses
          // with the same `--my-fallback` name)
          fallbacks[name] = {
            targets: [],
            blocks: blocks,
          };
        }
      },
    });
  }

  // Then, find all `position-try-fallbacks` declarations,
  // and add in block contents (scoped to unique data-attrs)
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const rule = this.rule?.prelude as csstree.Raw | undefined;
        // Parse `position-try-fallbacks` declaration
        const { order, options } = getPositionFallbackValues(node, rule);
        const selector = rule?.value;
        if (!selector) return;
        const anchorPosition: AnchorPosition = {};
        if (order && selector) {
          anchorPosition.order = order;
        }
        options?.forEach((tryObject) => {
          let name;
          if (tryObject.type === 'at-rule') {
            name = tryObject.atRule;
          }
          if (tryObject.type === 'try-tactic') {
            // add new item to fallbacks store
            name = `${selector}-${tryObject.tactic}`;
            fallbacks[name] = {
              targets: [selector],
              blocks: [
                {
                  uuid: `${tryObject.tactic}-try-${nanoid(12)}`,
                  declarations: Object.fromEntries(
                    [{ property: 'top', value: '123px' }].map((d) => [
                      d.property,
                      d.value,
                    ]),
                  ),
                },
              ],
            };
            console.log(applyTryTactic(selector, tryObject.tactic));
          }
          if (name && selector && fallbacks[name]) {
            if (anchorPosition.fallbacks) {
              anchorPosition.fallbacks = [
                ...anchorPosition.fallbacks,
                ...fallbacks[name].blocks,
              ];
            } else {
              anchorPosition.fallbacks = fallbacks[name].blocks;
            }

            if (!fallbacks[name].targets.includes(selector)) {
              fallbacks[name].targets.push(selector);
            }
            // Add each `@position-try` block, scoped to a unique data-attr
            for (const block of fallbacks[name].blocks) {
              const dataAttr = `[data-anchor-polyfill="${block.uuid}"]`;
              this.stylesheet?.children.prependData({
                type: 'Rule',
                prelude: {
                  type: 'Raw',
                  value: dataAttr,
                },
                block: {
                  type: 'Block',
                  children: new csstree.List<csstree.CssNode>().fromArray(
                    Object.entries(block.declarations).map(([prop, val]) => ({
                      type: 'Declaration',
                      important: true,
                      property: prop,
                      value: {
                        type: 'Raw',
                        value: val,
                      },
                    })),
                  ),
                },
              });
              // Store mapping of data-attr to target selector
              fallbackTargets[dataAttr] = selector;
            }
            changed = true;
          }
        });
        if (selector && Object.keys(anchorPosition).length > 0) {
          if (validPositions[selector]) {
            if (anchorPosition.order) {
              validPositions[selector].order = anchorPosition.order;
            }
            if (anchorPosition.fallbacks) {
              if (!validPositions[selector].fallbacks)
                validPositions[selector].fallbacks = [];
              validPositions[selector].fallbacks?.push(
                ...anchorPosition.fallbacks,
              );
            }
            //  = {order: anchorPosition.order, fallbacks: [...[validPositions[selector].fallbacks], ...[anchorPosition.fallbacks]]};
          } else {
            validPositions[selector] = anchorPosition;
          }
        }
      },
    });
    if (changed) {
      // Update CSS
      styleObj.css = generateCSS(ast);
      styleObj.changed = true;
    }
  }

  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, function (node) {
      const rule = this.rule?.prelude as csstree.Raw | undefined;

      // Parse `anchor-name` declaration
      const anchorNameData = getAnchorNameData(node, rule);
      anchorNameData.forEach(
        ({ name: anchorName, selector: anchorSelector }) => {
          if (anchorName && anchorSelector) {
            if (anchorNames[anchorName]) {
              anchorNames[anchorName].push(anchorSelector);
            } else {
              anchorNames[anchorName] = [anchorSelector];
            }
          }
        },
      );

      // Parse `anchor()` function
      const {
        prop,
        data,
        changed: updated,
      } = getAnchorFunctionData(node, this.declaration);
      if (prop && data && rule?.value) {
        // This will override earlier declarations
        // with the same exact rule selector
        // *and* the same exact declaration property:
        // (e.g. multiple `top: anchor(...)` declarations
        // for the same `.foo {...}` selector)
        anchorFunctions[rule.value] = {
          ...anchorFunctions[rule.value],
          [prop]: [...(anchorFunctions[rule.value]?.[prop] ?? []), data],
        };
      }
      if (updated) {
        changed = true;
      }
    });
    if (changed) {
      // Update CSS
      styleObj.css = generateCSS(ast);
      styleObj.changed = true;
    }
  }

  // List of CSS custom properties that include anchor fns
  const customPropsToCheck = new Set(Object.keys(customPropAssignments));
  // Mapping of a custom property name, to the name(s) and uuid(s) of other
  // custom properties "up" the chain that contain (eventually) a reference to
  // an anchor function
  const customPropsMapping: Record<
    // custom property name
    string,
    // other custom property name(s) and uuid(s) referenced by this custom prop
    { names: string[]; uuids: string[] }
  > = {};

  // Find (recursively) anchor data assigned to another custom property, and
  // that custom property is referenced by (i.e. passed through) the given
  // custom property
  const getReferencedFns = (prop: string) => {
    const referencedFns: AnchorFunction[] = [];
    const ancestorProps = new Set(customPropsMapping[prop]?.names ?? []);
    while (ancestorProps.size > 0) {
      for (const prop of ancestorProps) {
        referencedFns.push(...(customPropAssignments[prop] ?? []));
        ancestorProps.delete(prop);
        if (customPropsMapping[prop]?.names?.length) {
          // Continue checking recursively "up" the chain of custom properties
          customPropsMapping[prop].names.forEach((n) => ancestorProps.add(n));
        }
      }
    }
    return referencedFns;
  };

  // First find where CSS custom properties are used in other custom properties
  while (customPropsToCheck.size > 0) {
    const toCheckAgain: string[] = [];
    for (const styleObj of styleData) {
      let changed = false;
      const ast = getAST(styleObj.css);
      csstree.walk(ast, {
        visit: 'Function',
        enter(node) {
          const rule = this.rule?.prelude as csstree.Raw | undefined;
          const declaration = this.declaration;
          const prop = declaration?.property;
          if (
            rule?.value &&
            isVarFunction(node) &&
            declaration &&
            prop &&
            node.children.first &&
            customPropsToCheck.has(
              (node.children.first as csstree.Identifier).name,
            ) &&
            // For now, we only want assignments to other CSS custom properties
            prop.startsWith('--')
          ) {
            const child = node.children.first as csstree.Identifier;
            // Find anchor data assigned to this custom property
            const anchorFns = customPropAssignments[child.name] ?? [];
            // Find anchor data assigned to another custom property referenced
            // by this custom property (recursively)
            const referencedFns = getReferencedFns(child.name);

            // Return if there are no anchor fns related to this custom property
            if (!(anchorFns.length || referencedFns.length)) {
              return;
            }

            // An anchor fn was assigned to a custom property, which is
            // now being re-assigned to another custom property...
            const uuid = `${child.name}-anchor-${nanoid(12)}`;
            // Store the original declaration so that we can restore it later
            const original = generateCSS(declaration.value);
            customPropOriginals[uuid] = original;
            // Store a mapping of the new property to the original property
            // name, as well as the unique uuid(s) temporarily used to replace
            // the original property value.
            if (!customPropsMapping[prop]) {
              customPropsMapping[prop] = { names: [], uuids: [] };
            }
            const mapping = customPropsMapping[prop];
            if (!mapping.names.includes(child.name)) {
              mapping.names.push(child.name);
            }
            mapping.uuids.push(uuid);
            // Note that we need to do another pass of the CSS looking for
            // usage of the new property name:
            toCheckAgain.push(prop);
            // Temporarily replace the original property with a new unique key
            child.name = uuid;
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
    customPropsToCheck.clear();
    toCheckAgain.forEach((s) => customPropsToCheck.add(s));
  }

  // Then find where CSS custom properties are used in inset/sizing properties:
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Function',
      enter(node) {
        const rule = this.rule?.prelude as csstree.Raw | undefined;
        const declaration = this.declaration;
        const prop = declaration?.property;
        if (
          rule?.value &&
          isVarFunction(node) &&
          declaration &&
          prop &&
          node.children.first &&
          // Now we only want assignments to inset/sizing properties
          (isInsetProp(prop) || isSizingProp(prop))
        ) {
          const child = node.children.first as csstree.Identifier;
          // Find anchor data assigned to this custom property
          const anchorFns = customPropAssignments[child.name] ?? [];
          // Find anchor data assigned to another custom property referenced
          // by this custom property (recursively)
          const referencedFns = getReferencedFns(child.name);

          // Return if there are no anchor fns related to this custom property
          if (!(anchorFns.length || referencedFns.length)) {
            return;
          }

          /*

            An anchor (or anchor-size) fn was assigned to an inset (or sizing)
            property.

            It's possible that there are multiple uses of the same CSS
            custom property name, with different anchor function calls
            assigned to them. Instead of trying to figure out which one has
            cascaded to the given location, we iterate over all anchor
            functions that were assigned to the given CSS custom property
            name. For each one, we add a new custom prop with the value
            for that target and inset/sizing property, and let CSS determine
            which one cascades down to where it's used.

            For example, this:

              .one {
                --center: anchor(--anchor-name 50%);
              }

              .two {
                --center: anchor(--anchor-name 100%);
              }

              #target {
                top: var(--center);
              }

            Becomes this:

              .one {
                --center-top-EnmDEkZ5mBLp: var(--anchor-aPyy7qLK9f38-top);
                --center: anchor(--anchor-name 50%);
              }

              .two {
                --center-top-EnmDEkZ5mBLp: var(--anchor-SgrF5vARDf6H-top);
                --center: anchor(--anchor-name 100%);
              }

              #target {
                top: var(--center-top-EnmDEkZ5mBLp);
              }

            */
          const propUuid = `${prop}-${nanoid(12)}`;

          // If this is a custom property which was assigned a value from
          // another custom property (and not a direct reference to an anchor
          // fn), we want to replace the reference to its "parent" property with
          // a direct reference to the resolved value of the parent property for
          // this given inset/sizing property (e.g. top or width). We do this
          // recursively back up the chain of references...
          if (referencedFns.length) {
            const ancestorProps = new Set([child.name]);
            while (ancestorProps.size > 0) {
              for (const propToCheck of ancestorProps) {
                const mapping = customPropsMapping[propToCheck];
                if (mapping?.names?.length && mapping?.uuids?.length) {
                  for (const name of mapping.names) {
                    for (const uuid of mapping.uuids) {
                      // Top-level key (`uuid`) is the original uuid to find in
                      // the updated CSS
                      customPropReplacements[uuid] = {
                        ...customPropReplacements[uuid],
                        // - `key` (`propUuid`) is the property-specific
                        //   uuid to append to the new custom property name
                        // - `value` is the new property-specific custom
                        //   property value to use
                        [propUuid]: `${name}-${propUuid}`,
                      };
                    }
                  }
                }
                ancestorProps.delete(propToCheck);
                // Check (recursively) for custom properties up the chain...
                if (mapping?.names?.length) {
                  mapping.names.forEach((n) => ancestorProps.add(n));
                }
              }
            }
          }

          // When `anchor()` is used multiple times in different inset/sizing
          // properties, the value will be different each time. So we append
          // the property to the uuid, and update the CSS property to point
          // to the new uuid...
          for (const anchorFnData of [...anchorFns, ...referencedFns]) {
            const data = { ...anchorFnData };
            const uuidWithProp = `--anchor-${nanoid(12)}-${prop}`;
            const uuid = data.uuid;
            data.uuid = uuidWithProp;
            anchorFunctions[rule.value] = {
              ...anchorFunctions[rule.value],
              [prop]: [...(anchorFunctions[rule.value]?.[prop] ?? []), data],
            };
            // Store new name with declaration prop appended,
            // so that we can go back and update the original custom
            // property value...
            // Top-level key (`uuid`) is the original uuid to find in
            // the updated CSS:
            customPropReplacements[uuid] = {
              ...customPropReplacements[uuid],
              // - `key` (`propUuid`) is the property-specific
              //   uuid to append to the new custom property name
              // - `value` is the new property-specific custom
              //   property value to use
              [propUuid]: uuidWithProp,
            };
          }
          // Update CSS property to new name with declaration prop added
          child.name = `${child.name}-${propUuid}`;
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

  // Add new CSS custom properties, and restore original values of
  // previously-replaced custom properties
  if (Object.keys(customPropReplacements).length > 0) {
    for (const styleObj of styleData) {
      let changed = false;
      const ast = getAST(styleObj.css);
      csstree.walk(ast, {
        visit: 'Function',
        enter(node) {
          if (
            isVarFunction(node) &&
            (node.children.first as csstree.Identifier)?.name?.startsWith(
              '--',
            ) &&
            this.declaration?.property?.startsWith('--') &&
            this.block
          ) {
            const child = node.children.first as csstree.Identifier;
            const positions = customPropReplacements[child.name];
            if (positions) {
              for (const [propUuid, value] of Object.entries(positions)) {
                // Add new property-specific declarations
                this.block.children.appendData({
                  type: 'Declaration',
                  important: false,
                  property: `${this.declaration.property}-${propUuid}`,
                  value: {
                    type: 'Raw',
                    value: generateCSS(this.declaration.value).replace(
                      `var(${child.name})`,
                      `var(${value})`,
                    ),
                  },
                });
                changed = true;
              }
            }
            if (customPropOriginals[child.name]) {
              // Restore original (now unused) CSS custom property value
              this.declaration.value = {
                type: 'Raw',
                value: customPropOriginals[child.name],
              };
              changed = true;
            }
          }
        },
      });
      if (changed) {
        // Update CSS
        styleObj.css = generateCSS(ast);
        styleObj.changed = true;
      }
    }
  }

  // Store inline style custom property mappings for each target element
  const inlineStyles = new Map<HTMLElement, Record<string, string>>();
  // Store any `anchor()` fns
  for (const [targetSel, anchorFns] of Object.entries(anchorFunctions)) {
    let targets: NodeListOf<HTMLElement>;
    if (
      targetSel.startsWith('[data-anchor-polyfill=') &&
      fallbackTargets[targetSel]
    ) {
      // If we're dealing with a `@position-fallback` `@try` block,
      // then the targets are places where that `position-fallback` is used.
      targets = document.querySelectorAll(fallbackTargets[targetSel]);
    } else {
      targets = document.querySelectorAll(targetSel);
    }
    for (const [targetProperty, anchorObjects] of Object.entries(anchorFns) as [
      InsetProperty | SizingProperty,
      AnchorFunction[],
    ][]) {
      for (const anchorObj of anchorObjects) {
        for (const targetEl of targets) {
          // For every target element, find a valid anchor element
          const anchorEl = await getAnchorEl(targetEl, anchorObj);
          const uuid = `--anchor-${nanoid(12)}`;
          // Store new mapping, in case inline styles have changed and will
          // be overwritten -- in which case new mappings will be re-added
          inlineStyles.set(targetEl, {
            ...(inlineStyles.get(targetEl) ?? {}),
            [anchorObj.uuid]: uuid,
          });
          // Point original uuid to new uuid
          targetEl.setAttribute(
            'style',
            `${anchorObj.uuid}: var(${uuid}); ${
              targetEl.getAttribute('style') ?? ''
            }`,
          );
          // Populate new data for each anchor/target combo
          validPositions[targetSel] = {
            ...validPositions[targetSel],
            declarations: {
              ...validPositions[targetSel]?.declarations,
              [targetProperty]: [
                ...(validPositions[targetSel]?.declarations?.[
                  targetProperty as InsetProperty
                ] ?? []),
                { ...anchorObj, anchorEl, targetEl, uuid },
              ],
            },
          };
        }
      }
    }
  }

  return { rules: validPositions, inlineStyles };
}
