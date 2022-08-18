import * as csstree from 'css-tree';

import { fetchCSS } from './fetch.js';

export function removeAnchorCSS(originalCSS: string) {
  const ast = csstree.parse(originalCSS);
  csstree.walk(ast, function (node, item, list) {
    // remove position fallback at-rules i.e. "@position-fallback --button-popup"
    if (node.type === 'Atrule' && node.name.includes('position-fallback')) {
      list.remove(item);
    }

    // remove position fallback declaration i.e. "position-fallback: --button-popup;"
    if (
      node.type === 'Declaration' &&
      node.property.includes('position-fallback')
    ) {
      list.remove(item);
    }
  });
  return csstree.generate(ast);
}

export async function transformCSS() {
  const fetchedCSS = await fetchCSS().then((fetchedCSS) => fetchedCSS);
  const cssFromStylesheet = fetchedCSS[1];

  cssFromStylesheet.forEach((sourceCSS) => {
    const updatedCSS = removeAnchorCSS(sourceCSS.css);
    const blob = new Blob([updatedCSS], { type: 'text/css' });
    const linkTags = document.querySelectorAll('link');
    linkTags.forEach((link) => {
      if (link.rel === 'stylesheet' && sourceCSS.source.includes(link.href)) {
        link.href = URL.createObjectURL(blob);
      }
    });
  });

  const styleTagCSS = document.querySelectorAll('style');
  styleTagCSS.forEach((element) => {
    element.innerHTML = removeAnchorCSS(element.innerHTML);
  });
}
