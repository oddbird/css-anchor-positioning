import * as csstree from 'css-tree';

import { fetchCSS } from './fetch.js';

export const sampleAnchorCSSString =
  '#my-popup {position: fixed;position-fallback: --button-popup;overflow: auto;min-width: anchor-size(--button width);min-height: 6em;}@position-fallback --button-popup {@try {top: anchor(--button bottom);left: anchor(--button left);}@try {bottom: anchor(--button top);left: anchor(--button left);}@try {top: anchor(--button bottom);right: anchor(--button right);}@try {bottom: anchor(--button top);right: anchor(--button right);}}h1{color: green}';

export function removeAnchorCSS(originalCSS: string) {
  const ast = csstree.parse(originalCSS);
  csstree.walk(ast, function (node, item, list) {
    // TODO - refactor if statements to be cleaner
    if (node.type === 'Atrule' && node.name.includes('position-fallback')) {
      list.remove(item);
    }
    if (
      node.type === 'Declaration' &&
      node.property.includes('position-fallback')
    ) {
      list.remove(item);
    }
  });
  return csstree.generate(ast);
}

export function transformCSS() {
  console.log('transforming!');
  // 1 - fetch CSS - get stylesheets and inline styles
  //const fetched = fetchCSS();

  // temp
  const cssFromStylesheet = [sampleAnchorCSSString]; // TODO eventuall call fetchCSS() once fixes pushed up;

  // const cssFromStyletag = [sampleAnchorCSSString];

  // const [cssFromStyletag, cssFromStylesheet] = fetchCSS();

  //   const updatedCSS = removeAnchorCSS(cssToTransform);

  //   const blob = new Blob([updatedCSS], { type: 'text/css' });
  //   const linkTags = document.querySelectorAll('link');
  //   linkTags.forEach((link) => {
  //     if (link.rel === 'stylesheet') {
  //       link.href = URL.createObjectURL(blob);
  //     }
  //   });

  cssFromStylesheet.map((sourceCSS) => {
    //   const cssText = await fetch(sourceCSS.toString()).then((r) => r.text());
    //   const updatedCSS = removeAnchorCSS(cssText);
    const updatedCSS = removeAnchorCSS(sourceCSS);
    const blob = new Blob([updatedCSS], { type: 'text/css' });
    const linkTags = document.querySelectorAll('link');
    linkTags.forEach((link) => {
      if (link.rel === 'stylesheet') {
        link.href = URL.createObjectURL(blob);
      }
    });
  });

  // TODO style tags
}
