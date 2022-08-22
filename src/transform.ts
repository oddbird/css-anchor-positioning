import * as csstree from 'css-tree';

import { fetchCSS, isStyleLink } from './fetch.js';
import {
  getDataFromCSS,
  isFallbackAtRule,
  isFallbackDeclaration,
  parseCSS,
} from './parse.js';

export function removeAnchorCSS(originalCSS: string) {
  const ast = parseCSS(originalCSS);
  csstree.walk(ast, function (node, item, list) {
    if (list) {
      // remove position fallback at-rules
      // e.g. `@position-fallback --button-popup {...}`
      if (isFallbackAtRule(node)) {
        list.remove(item);
      }

      // remove position fallback declaration
      // e.g. `position-fallback: --button-popup;`
      if (isFallbackDeclaration(node)) {
        list.remove(item);
      }
    }
  });
  return csstree.generate(ast);
}

export async function transformCSS() {
  const [inlineCSS, linkedCSS] = await fetchCSS();

  // Handle linked stylesheets
  linkedCSS.forEach((sourceCSS) => {
    getDataFromCSS(sourceCSS.css);

    const updatedCSS = removeAnchorCSS(sourceCSS.css);
    const blob = new Blob([updatedCSS], { type: 'text/css' });
    const linkTags = document.querySelectorAll('link');
    linkTags.forEach((link) => {
      if (isStyleLink(link) && sourceCSS.source.includes(link.href)) {
        link.href = URL.createObjectURL(blob);
      }
    });
  });

  // Handle inline stylesheets
  inlineCSS.forEach((sourceCSS) => {
    getDataFromCSS(sourceCSS);
  });
  const styleTagCSS = document.querySelectorAll('style');
  styleTagCSS.forEach((element) => {
    element.innerHTML = removeAnchorCSS(element.innerHTML);
  });
}
