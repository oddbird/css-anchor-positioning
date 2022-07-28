const csstree = require("css-tree");

function handleLinkedStylesheets() {
  let linkElements = document.querySelectorAll('link');
  let CSSlinks = [];
  linkElements.forEach(link => {
    if(link.type === 'text/css') {
       CSSlinks.push(link);
       console.log('link', link)
    }
  })
  return CSSlinks;
}

export function fetchCSS(rawCSS: string) {
  let linkedCSS = handleLinkedStylesheets();
  let inlineCSS = document.querySelectorAll('style');
  return linkedCSS
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
