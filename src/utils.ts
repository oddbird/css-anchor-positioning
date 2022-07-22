const stylis = require("stylis");

export function fetchCSS(path: string) {
  // TODO - get link element to stylesheet, get URL, fetch contents
}

export function parseCSS(cssText: string) {
  const cssAst = stylis.compile(cssText);

  // TODO - walk elements

  return cssAst;
}
