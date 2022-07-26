const csstree = require("css-tree");

export function fetchCSS(path: string) {
  // TODO - get link element to stylesheet, get URL, fetch contents
}

export function parsePositionFallback(ast: string) {
  return csstree.findAll(
    ast,
    (node) => node.type === "Atrule" && node.name.includes("position-fallback")
  );
}

export function parseAnchorFunctions(ast: string) {
  return csstree.findAll(
    ast,
    (node) => node.type === "Function" && node.name.includes("anchor")
  );
}

export function parseCSS(cssText: string) {
  const ast = csstree.parse(cssText);

  const positionFallbackRules = parsePositionFallback(ast);
  const anchors = parseAnchorFunctions(ast);

  return positionFallbackRules.length || anchors.length ? ast : false;
}

export function transformCSS(cssText: string) {}
