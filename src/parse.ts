import * as csstree from 'css-tree';

interface TryBlockMap {
  [key: string]: string;
}

export interface PositionFallbackRulesMap {
  [key: string]: TryBlockMap[];
}

export function parsePositionFallback(ast: csstree.CssNode) {
  const parsedFallbackRules = csstree.findAll(
    ast,
    (node) => node.type === 'Atrule' && node.name.includes('position-fallback'),
  ) as csstree.Atrule[];
  const fallbacks: PositionFallbackRulesMap = {};

  if (parsedFallbackRules) {
    parsedFallbackRules.forEach((fallback) => {
      const fallbackName = (fallback.prelude as csstree.Raw).value;
      const fallbackTryBlocks: TryBlockMap[] = [];

      const children = (fallback.block?.children || []) as csstree.Atrule[];
      children.forEach((childBlock) => {
        const tryBlock: TryBlockMap = {};

        // First edge position in try block is the `head` in the AST
        //  property : the edge direction (i.e. top, left, bottom, right)
        //  value.value : the anchor function (i.e. anchor(--button left))
        if (childBlock.block?.children) {
          const firstEdge = childBlock.block.children
            .first as unknown as csstree.Declaration;
          tryBlock[firstEdge.property] = (firstEdge.value as csstree.Raw).value;

          // Second edge position in try block is the `tail` in the AST
          const secondEdge = childBlock.block.children
            .last as unknown as csstree.Declaration;
          tryBlock[secondEdge.property] = (
            secondEdge.value as csstree.Raw
          ).value;
        }

        fallbackTryBlocks.push(tryBlock);
      });
      fallbacks[fallbackName] = fallbackTryBlocks;
    });
  }

  return fallbacks;
}

export function parseCSS(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseValue: false,
  });

  const positionFallbackRules: PositionFallbackRulesMap =
    parsePositionFallback(ast);

  return positionFallbackRules;
}
