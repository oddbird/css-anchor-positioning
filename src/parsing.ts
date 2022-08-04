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
  );
  const fallbacks: PositionFallbackRulesMap = {};

  if (parsedFallbackRules) {
    parsedFallbackRules.forEach((fallback: csstree.Atrule) => {
      const fallbackName = fallback.prelude.value;
      const fallbackTryBlocks: TryBlockMap[] = [];

      fallback.block.children?.forEach((childBlock) => {
        const tryBlock: TryBlockMap = {};

        // First edge position in try block is the `head` in the AST
        //  data.property : the edge direction (i.e. top, left, bottom, right)
        //  data.value.value : the anchor function (i.e. anchor(--button left))
        const firstEdge = childBlock.block.children.head;
        tryBlock[firstEdge.data.property] = firstEdge.data.value.value;

        // Second edge position in try block is the `tail` in the AST
        const secondEdge = childBlock.block.children.tail;
        tryBlock[secondEdge.data.property] = secondEdge.data.value.value;

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
