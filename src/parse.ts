import * as csstree from 'css-tree';

interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
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
    fallbackValue,
  };
}

export function getDataFromCSS(css: string) {
  const anchorNames: any = {};
  const anchorFunctions: any = [];
  const fallbackDeclarations: any = {};
  const fallbacks: any = {};
  const ast = parseCSS(css);
  csstree.walk(ast, function (node) {
    const rule = this.rule?.prelude as csstree.Raw | undefined;
    if (
      isAnchorNameDeclaration(node) &&
      node.value.children.first &&
      rule?.value
    ) {
      const name = (node.value.children.first as unknown as csstree.Identifier)
        .name;
      if (anchorNames[name]) {
        anchorNames[name].push(rule.value);
      } else {
        anchorNames[name] = [rule.value];
      }
    }
    if (isAnchorFunction(node) && rule?.value && this.declaration) {
      const { anchorName, anchorEdge, fallbackValue } = parseAnchorFn(node);
      anchorFunctions.push({
        floatingEl: rule.value,
        floatingEdge: this.declaration.property,
        anchorName,
        anchorEdge,
        fallbackValue,
      });
    }
    if (
      isFallbackDeclaration(node) &&
      node.value.children.first &&
      rule?.value
    ) {
      const name = (node.value.children.first as unknown as csstree.Identifier)
        .name;
      if (fallbackDeclarations[name]) {
        fallbackDeclarations[name].push(rule.value);
      } else {
        fallbackDeclarations[name] = [rule.value];
      }
    }
    if (isFallbackAtRule(node) && node.prelude?.value && node.block?.children) {
      const name = node.prelude.value;
      const tryBlocks: any = [];
      const atRules = node.block.children.filter(isTryAtRule);
      atRules.forEach((atRule) => {
        if (atRule.block?.children) {
          const tryBlock: any = {};
          const declarations = atRule.block.children.filter(isDeclaration);
          declarations.forEach((child) => {
            const firstChild = child.value.children
              .first as unknown as csstree.CssNode;
            if (firstChild && isAnchorFunction(firstChild)) {
              tryBlock[child.property] = parseAnchorFn(firstChild);
            } else {
              tryBlock[child.property] = csstree.generate(child.value);
            }
          });

          tryBlocks.push(tryBlock);
        }
      });
      fallbacks[name] = tryBlocks;
    }
  });
  console.log(anchorNames);
  console.log(anchorFunctions);
  console.log(fallbackDeclarations);
  console.log(fallbacks);
}

export function parseCSS(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
  });

  return ast;
}
