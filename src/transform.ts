import * as csstree from 'css-tree';

import { isStyleLink, StyleData } from './fetch.js';
import { getAST, isFallbackAtRule, isFallbackDeclaration } from './parse.js';

export function removeAnchorCSS(originalCSS: string) {
  const ast = getAST(originalCSS);
  csstree.walk(ast, function (node, item, list) {
    if (list) {
      // remove position fallback declaration
      // e.g. `position-fallback: --button-popup;`
      if (isFallbackDeclaration(node)) {
        list.remove(item);
      }

      // remove position fallback at-rules
      // e.g. `@position-fallback --button-popup {...}`
      if (isFallbackAtRule(node)) {
        list.remove(item);
      }
    }
  });
  return csstree.generate(ast);
}

export function transformCSS(styleData: StyleData[]) {
  // Handle inline stylesheets
  const styleTagCSS = document.querySelectorAll('style');
  styleTagCSS.forEach((element) => {
    element.innerHTML = removeAnchorCSS(element.innerHTML);
  });

  // Handle linked stylesheets
  styleData.forEach(({ source, css }) => {
    if (source !== 'style') {
      const updatedCSS = removeAnchorCSS(css);
      const blob = new Blob([updatedCSS], { type: 'text/css' });
      const linkTags = document.querySelectorAll('link');
      linkTags.forEach((link) => {
        if (isStyleLink(link) && source.includes(link.href)) {
          link.href = URL.createObjectURL(blob);
        }
      });
    }
  });
}
