import { autoUpdate, computePosition, flip } from '@floating-ui/dom';
import * as csstree from 'css-tree';

import { fetchCSS, isStyleLink } from './fetch.js';
import { isFallbackAtRule, isFallbackDeclaration } from './parse.js';

export function removeAnchorCSS(originalCSS: string) {
  const ast = csstree.parse(originalCSS);
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
  const [, linkedCSS] = await fetchCSS();

  linkedCSS.forEach((sourceCSS) => {
    const updatedCSS = removeAnchorCSS(sourceCSS.css);
    const blob = new Blob([updatedCSS], { type: 'text/css' });
    const linkTags = document.querySelectorAll('link');
    linkTags.forEach((link) => {
      if (isStyleLink(link) && sourceCSS.source.includes(link.href)) {
        link.href = URL.createObjectURL(blob);
      }
    });
  });

  const styleTagCSS = document.querySelectorAll('style');
  styleTagCSS.forEach((element) => {
    element.innerHTML = removeAnchorCSS(element.innerHTML);
  });
}

export function position() {
  const strategies = {
    anchor: 'my-anchor-positioning',
    floating: 'my-floating-positioning',
    strategy: ['bottom', 'right'],
  };

  const anchor = document.getElementById(strategies.anchor);
  const floating = document.getElementById(strategies.floating);

  if (anchor && floating) {
    autoUpdate(anchor, floating, () => {
      computePosition(anchor, floating, {
        placement: strategies.strategy[0],
        middleware: [
          flip({
            fallbackPlacements: ['left', 'bottom'],
          }),
        ],
      }).then(({ x, y }) => {
        Object.assign(floating.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    });
  }
}

position();
