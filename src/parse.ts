import * as csstree from 'css-tree';

import { validatedForPositioning } from './validate.js';

interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
}

interface AnchorNames {
  // `key` is the `anchor-name` value
  // `value` is an array of all element selectors with that anchor name
  [key: string]: string[];
}

export type InsetProperty = 'top' | 'left' | 'right' | 'bottom';

export type AnchorSideKeyword =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end'
  | 'center';

export type AnchorSide = AnchorSideKeyword | number;

interface AnchorFunction {
  anchorEl?: HTMLElement | null;
  anchorName?: string;
  anchorEdge?: AnchorSide;
  fallbackValue: string;
}

// `key` is the property being declared
// `value` is the anchor-positioning data for that property
type AnchorFunctionDeclaration = Partial<Record<InsetProperty, AnchorFunction>>;

interface AnchorFunctionDeclarations {
  // `key` is the floating element selector
  // `value` is an object with all anchor-function declarations on that element
  [key: string]: AnchorFunctionDeclaration;
}

interface AnchorPosition {
  declarations?: AnchorFunctionDeclaration;
  fallbacks?: TryBlock[];
}

export interface AnchorPositions {
  // `key` is the floating element selector
  // `value` is an object with all anchor-positioning data for that element
  [key: string]: AnchorPosition;
}

// `key` is the property being declared
// `value` is the property value, or parsed anchor-fn data
type TryBlock = Partial<
  Record<string | InsetProperty, string | AnchorFunction>
>;

interface FallbackNames {
  // `key` is the floating element selector
  // `value` is the `position-fallback` value (name)
  [key: string]: string;
}

interface Fallbacks {
  // `key` is the `position-fallback` value (name)
  // `value` is an array of `@try` block declarations (in order)
  [key: string]: TryBlock[];
}

export function isDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration';
}

export function isAnchorNameDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'anchor-name';
}

export function isAnchorFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
}

export function isVarFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'var');
}

export function isFallbackDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-fallback';
}

export function isFallbackAtRule(node: csstree.CssNode): node is AtRuleRaw {
  return node.type === 'Atrule' && node.name === 'position-fallback';
}

export function isTryAtRule(node: csstree.CssNode): node is AtRuleRaw {
  return node.type === 'Atrule' && node.name === 'try';
}

export function isIdentifier(
  node: csstree.CssNode,
): node is csstree.Identifier {
  return Boolean(node.type === 'Identifier' && node.name);
}

export function isPercentage(
  node: csstree.CssNode,
): node is csstree.Percentage {
  return Boolean(node.type === 'Percentage' && node.value);
}

function parseAnchorFn(node: csstree.FunctionNode) {
  let anchorName: string | undefined,
    anchorEdge: AnchorSide | undefined,
    fallbackValue = '',
    foundComma = false;
  node.children.toArray().forEach((child, idx) => {
    if (foundComma) {
      fallbackValue = `${fallbackValue}${csstree.generate(child)}`;
      return;
    }
    if (child.type === 'Operator' && child.value === ',') {
      foundComma = true;
      return;
    }
    switch (idx) {
      case 0:
        if (isIdentifier(child)) {
          anchorName = child.name;
        }
        break;
      case 1:
        if (isIdentifier(child)) {
          anchorEdge = child.name as AnchorSideKeyword;
        } else if (isPercentage(child)) {
          const number = Number(child.value);
          anchorEdge = Number.isNaN(number) ? undefined : number;
        }
        break;
    }
  });
  return {
    anchorName,
    anchorEdge,
    fallbackValue: fallbackValue || '0px',
  };
}

function getAnchorNameData(node: csstree.CssNode, rule?: csstree.Raw) {
  if (
    isAnchorNameDeclaration(node) &&
    node.value.children.first &&
    rule?.value
  ) {
    const name = (node.value.children.first as csstree.Identifier).name;
    return { name, selector: rule.value };
  }
  return {};
}

const customProperties: Record<string, AnchorFunction> = {};

function getAnchorFunctionData(
  node: csstree.CssNode,
  declaration: csstree.Declaration | null,
  rule?: csstree.Raw,
) {
  if (isAnchorFunction(node) && rule?.value && declaration) {
    const data = parseAnchorFn(node);
    if (declaration.property.startsWith('--')) {
      customProperties[declaration.property] = data;
      return;
    }
    if (isInset(declaration.property)) {
      return { [declaration.property]: data };
    }
  }
}

function getPositionFallbackDeclaration(
  node: csstree.CssNode,
  rule?: csstree.Raw,
) {
  if (isFallbackDeclaration(node) && node.value.children.first && rule?.value) {
    const name = (node.value.children.first as csstree.Identifier).name;
    return { name, selector: rule.value };
  }
  return {};
}

function isInset(property: string): property is InsetProperty {
  const insetProperties: InsetProperty[] = ['left', 'right', 'top', 'bottom'];

  return insetProperties.includes(property as InsetProperty);
}

function getPositionFallbackRules(node: csstree.CssNode) {
  if (isFallbackAtRule(node) && node.prelude?.value && node.block?.children) {
    const name = node.prelude.value;
    const tryBlocks: TryBlock[] = [];
    const tryAtRules = node.block.children.filter(isTryAtRule);
    tryAtRules.forEach((atRule) => {
      if (atRule.block?.children) {
        const tryBlock: TryBlock = {};
        // Only declarations are allowed inside a `@try` block
        const declarations = atRule.block.children.filter(isDeclaration);
        declarations.forEach((child) => {
          const firstChild = child.value.children.first as csstree.CssNode;
          // Parse value if it's an `anchor()` fn; otherwise store it raw
          if (firstChild && isAnchorFunction(firstChild)) {
            tryBlock[child.property] = parseAnchorFn(firstChild);
          } else {
            tryBlock[child.property] = csstree.generate(child.value);
          }
        });
        tryBlocks.push(tryBlock);
      }
    });
    return { name, fallbacks: tryBlocks };
  }
  return {};
}

export function getAST(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseCustomProperty: true,
  });

  return ast;
}

export function parseCSS(css: string) {
  const anchorNames: AnchorNames = {};
  const anchorFunctions: AnchorFunctionDeclarations = {};
  const fallbackNames: FallbackNames = {};
  const fallbacks: Fallbacks = {};
  const ast = getAST(css);
  csstree.walk(ast, function (node) {
    const rule = this.rule?.prelude as csstree.Raw | undefined;

    // Parse `anchor-name` declaration
    const { name: anchorName, selector: anchorSelector } = getAnchorNameData(
      node,
      rule,
    );
    if (anchorName && anchorSelector) {
      if (anchorNames[anchorName]) {
        anchorNames[anchorName].push(anchorSelector);
      } else {
        anchorNames[anchorName] = [anchorSelector];
      }
    }

    // Parse `anchor()` function
    const anchorFnData = getAnchorFunctionData(node, this.declaration, rule);
    if (anchorFnData && rule?.value) {
      // This will override earlier declarations
      // with the same exact rule selector
      // *and* the same exact declaration property:
      // (e.g. multiple `top: anchor(...)` declarations
      // for the same `.foo {...}` selector)
      anchorFunctions[rule.value] = {
        ...anchorFunctions[rule.value],
        ...anchorFnData,
      };
    }

    // Parse `position-fallback` declaration
    const { name: fbName, selector: fbSelector } =
      getPositionFallbackDeclaration(node, rule);
    if (fbName && fbSelector) {
      // This will override earlier `position-fallback` declarations
      // with the same rule selector:
      // (e.g. multiple `position-fallback:` declarations
      // for the same `.foo {...}` selector)
      fallbackNames[fbSelector] = fbName;
    }

    // Parse `@position-fallback` rule
    const { name: fbRuleName, fallbacks: fbTryBlocks } =
      getPositionFallbackRules(node);
    if (fbRuleName && fbTryBlocks.length) {
      // This will override earlier `@position-fallback` lists
      // with the same name:
      // (e.g. multiple `@position-fallback --my-fallback {...}` uses
      // with the same `--my-fallback` name)
      fallbacks[fbRuleName] = fbTryBlocks;
    }
  });

  // Find where CSS custom properties are used
  if (Object.values(customProperties).length > 0) {
    csstree.walk(ast, function (node) {
      const rule = this.rule?.prelude as csstree.Raw | undefined;
      if (
        rule?.value &&
        isVarFunction(node) &&
        node.children.first &&
        this.declaration &&
        isInset(this.declaration.property)
      ) {
        const name = (node.children.first as csstree.Identifier).name;
        const anchorFnData = customProperties[name];
        if (anchorFnData) {
          anchorFunctions[rule.value] = {
            ...anchorFunctions[rule.value],
            [this.declaration.property]: anchorFnData,
          };
        }
      }
    });
  }

  // Merge data together under floating-element selector key
  const validPositions: AnchorPositions = {};

  // Store any `position-fallback` declarations
  for (const [floatingSel, fallbackName] of Object.entries(fallbackNames)) {
    const positionFallbacks = fallbacks[fallbackName];
    if (positionFallbacks) {
      const floatingEl: HTMLElement | null =
        document.querySelector(floatingSel);
      // Populate `anchorEl` for each fallback `anchor()` fn
      positionFallbacks.forEach((tryBlock) => {
        for (const [prop, value] of Object.entries(tryBlock)) {
          if (typeof value === 'object') {
            const anchorName = (value as AnchorFunction).anchorName;
            const anchorSelectors = anchorName ? anchorNames[anchorName] : [];
            const anchorEl = validatedForPositioning(
              floatingEl,
              anchorSelectors,
            );
            (tryBlock[prop] as AnchorFunction).anchorEl = anchorEl;
          }
        }
      });
      validPositions[floatingSel] = {
        fallbacks: positionFallbacks,
      };
    }
  }

  // Store any `anchor()` fns
  for (const [floatingSel, anchorFns] of Object.entries(anchorFunctions)) {
    const floatingEl: HTMLElement | null = document.querySelector(floatingSel);
    for (const [floatingEdge, anchorObj] of Object.entries(anchorFns)) {
      // Populate `anchorEl` for each `anchor()` fn
      const anchorSelectors = anchorObj.anchorName
        ? anchorNames[anchorObj.anchorName]
        : [];
      validPositions[floatingSel] = {
        ...validPositions[floatingSel],
        declarations: {
          ...validPositions[floatingSel]?.declarations,
          [floatingEdge]: {
            ...anchorObj,
            anchorEl: validatedForPositioning(floatingEl, anchorSelectors),
          },
        },
      };
    }
  }

  /* Example data shape:
    {
      '#my-floating-element': {
        declarations: {
          top: {
            floatingEl: <HTMLElement>,
            anchorName: '--my-anchor',
            anchorEl: <HTMLElement>,
            anchorEdge: 'bottom',
            fallbackValue: '50px',
          },
        },
        fallbacks: [
          {
            top: {
              floatingEl: <HTMLElement>,
              anchorName: '--my-anchor',
              anchorEl: <HTMLElement>,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
            width: '35px',
          },
        ],
      },
    }
    */
  return validPositions;
}
