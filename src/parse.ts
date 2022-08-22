import * as csstree from 'css-tree';

interface TryBlockMap {
  [key: string]: string;
}

interface PositionFallbackRulesMap {
  [key: string]: TryBlockMap[];
}

export function isFallbackDeclaration(node: csstree.CssNode) {
  return (
    node.type === 'Declaration' && node.property.includes('position-fallback')
  );
}

export function isFallbackAtRule(node: csstree.CssNode) {
  return node.type === 'Atrule' && node.name.includes('position-fallback');
}

function parsePositionFallback(ast: csstree.CssNode) {
  const parsedFallbackRules = csstree.findAll(
    ast,
    isFallbackAtRule,
  ) as csstree.Atrule[];
  const fallbacks: PositionFallbackRulesMap = {};

  if (parsedFallbackRules) {
    parsedFallbackRules.forEach((fallback) => {
      const fallbackName = (fallback.prelude as csstree.Raw).value;
      const fallbackTryBlocks: TryBlockMap[] = [];

      const children = (fallback.block?.children || []) as csstree.Atrule[];
      children.forEach((childBlock) => {
        const tryBlock: TryBlockMap = {};

        if (childBlock.block?.children) {
          (
            childBlock.block?.children as csstree.List<csstree.Declaration>
          ).forEach((child) => {
            tryBlock[child.property] = (child.value as csstree.Raw).value;
          });
        }

        fallbackTryBlocks.push(tryBlock);
      });
      fallbacks[fallbackName] = fallbackTryBlocks;
    });
  }

  return fallbacks;
}

// @@@ This is not currently used anywhere...
export function parseCSS(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseValue: false,
  });

  return parsePositionFallback(ast);
}
