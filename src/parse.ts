import * as csstree from 'css-tree';

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

interface AnchorFunction {
  anchorEl?: string[];
  anchorName?: string;
  anchorEdge?: string;
  fallbackValue: string;
}

interface AnchorFunctionDeclaration {
  // `key` is the property being declared
  // `value` is the anchor-positioning data for that property
  [key: string]: AnchorFunction;
}

interface AnchorFunctionDeclarations {
  // `key` is the floating element selector
  // `value` is an object with all anchor-function declarations on that element
  [key: string]: AnchorFunctionDeclaration;
}

interface AnchorPosition {
  declarations: {
    // `key` is the property being declared
    // `value` is the anchor-positioning data for that property
    [key: string]: AnchorFunction;
  };
  fallbacks?: TryBlock[];
}

interface AnchorPositions {
  // `key` is the floating element selector
  // `value` is an object with all anchor-positioning data for that element
  [key: string]: AnchorPosition;
}

interface TryBlock {
  // `key` is the property being declared
  // `value` is the property value, or parsed anchor-fn data
  [key: string]: string | AnchorFunction;
}

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

function parseAnchorFn(node: csstree.FunctionNode) {
  let anchorName: string | undefined,
    anchorEdge: string | undefined,
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
    if (child.type === 'Identifier' && child.name) {
      switch (idx) {
        case 0:
          anchorName = child.name;
          break;
        case 1:
          anchorEdge = child.name;
          break;
      }
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
    const name = (node.value.children.first as unknown as csstree.Identifier)
      .name;
    return { name, selector: rule.value };
  }
  return {};
}

function getAnchorFunctionData(
  node: csstree.CssNode,
  declaration: csstree.Declaration | null,
  rule?: csstree.Raw,
) {
  if (isAnchorFunction(node) && rule?.value && declaration) {
    return { [declaration.property]: parseAnchorFn(node) };
  }
}

function getPositionFallbackDeclaration(
  node: csstree.CssNode,
  rule?: csstree.Raw,
) {
  if (isFallbackDeclaration(node) && node.value.children.first && rule?.value) {
    const name = (node.value.children.first as unknown as csstree.Identifier)
      .name;
    return { name, selector: rule.value };
  }
  return {};
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
          const firstChild = child.value.children
            .first as unknown as csstree.CssNode;
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

export function getDataFromCSS(css: string) {
  const anchorNames: AnchorNames = {};
  const anchorFunctions: AnchorFunctionDeclarations = {};
  const fallbackNames: FallbackNames = {};
  const fallbacks: Fallbacks = {};
  const ast = parseCSS(css);
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

  // Merge data together under floating-element selector key
  const validPositions: AnchorPositions = {};
  for (const [floatingEl, anchorFns] of Object.entries(anchorFunctions)) {
    const fallbackName = fallbackNames[floatingEl];
    const positionFallbacks = fallbackName
      ? fallbacks[fallbackName]
      : undefined;
    if (positionFallbacks) {
      // Populate `anchorEl` for each fallback `anchor()` fn
      positionFallbacks.forEach((tryBlock) => {
        for (const [prop, value] of Object.entries(tryBlock)) {
          if (typeof value === 'object') {
            const anchorName = (value as AnchorFunction).anchorName;
            const anchorEl = anchorName ? anchorNames[anchorName] : undefined;
            (tryBlock[prop] as AnchorFunction).anchorEl = anchorEl;
          }
        }
      });
    }
    validPositions[floatingEl] = {
      fallbacks: positionFallbacks,
      declarations: {},
    };
    for (const [floatingEdge, anchorObj] of Object.entries(anchorFns)) {
      // Populate `anchorEl` for each `anchor()` fn
      const anchorEl = anchorObj.anchorName
        ? anchorNames[anchorObj.anchorName]
        : undefined;
      validPositions[floatingEl].declarations[floatingEdge] = {
        ...anchorObj,
        anchorEl,
      };
    }
  }

  console.log(validPositions);

  /* Example data shape:
    {
      '#my-floating-element': {
        declarations: {
          top: {
            anchorName: '--my-anchor',
            anchorEl: '#my-target-anchor-element',
            anchorEdge: 'bottom',
            fallbackValue: '50px',
          },
        },
        fallbacks: [
          {
            top: {
              anchorName: '--my-anchor',
              anchorEl: '#my-target-anchor-element',
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

export function parseCSS(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
  });

  return ast;
}
