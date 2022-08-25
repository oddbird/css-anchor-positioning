import { autoUpdate, computePosition, flip, Placement } from '@floating-ui/dom';
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
    '#my-floating-positioning': {
      declarations: {
        top: {
          anchorName: '--my-anchor-positioning',
          anchorEdge: 'bottom',
          fallbackValue: '0px',
          anchorEl: ['#my-anchor-positioning'],
        },
        left: {
          anchorName: '--my-anchor-positioning',
          anchorEdge: 'right',
          fallbackValue: '50px',
          anchorEl: ['#my-anchor-positioning'],
        },
      },
    },
    '#inner-anchored': {
      declarations: {
        left: {
          anchorName: '--scroll-anchor',
          anchorEdge: 'left',
          fallbackValue: '0px',
          anchorEl: ['#scroll-anchor'],
        },
        bottom: {
          anchorName: '--scroll-anchor',
          anchorEdge: 'top',
          fallbackValue: '0px',
          anchorEl: ['#scroll-anchor'],
        },
      },
    },
    '#outer-anchored': {
      declarations: {
        left: {
          anchorName: '--scroll-anchor',
          anchorEdge: 'left',
          fallbackValue: '0px',
          anchorEl: ['#scroll-anchor'],
        },
        top: {
          anchorName: '--scroll-anchor',
          anchorEdge: 'bottom',
          fallbackValue: '0px',
          anchorEl: ['#scroll-anchor'],
        },
      },
    },
    '#my-floating-inline': {
      declarations: {
        top: {
          anchorName: '--my-anchor-inline',
          anchorEdge: 'bottom',
          fallbackValue: '0px',
          anchorEl: ['#my-anchor-inline'],
        },
        left: {
          anchorName: '--my-anchor-inline',
          anchorEdge: 'right',
          fallbackValue: '0px',
          anchorEl: ['#my-anchor-inline'],
        },
      },
    },
  };

  Object.entries(strategies).map(([key, value]) => {
    // For now, grab just the first declaration
    // @@@ How do we handle multiple declarations?
    const anchorObj = Object.values(value.declarations)[0];
    const floating: HTMLElement | null = document.querySelector(key);
    // @@@ For now, assume the first element is valid
    const anchor = document.querySelector(anchorObj.anchorEl[0]);

    if (anchor && floating) {
      autoUpdate(anchor, floating, () => {
        computePosition(anchor, floating, {
          // @@@ We should convert `anchorEdge` to valid placement options
          //
          // @@@ This is way too "smart" -- we're ignoring the property
          // declaration entirely, and just assuming that the property is the
          // opposite of the `anchorEdge`. What if we want the `top` of the
          // floating element to line up with the `top` of the anchor element?
          placement: anchorObj.anchorEdge as Placement,
          // @@@ These should pull from `value.fallbacks`, not `fallbackValue`
          // middleware: [
          //   flip({
          //     fallbackPlacements: [
          //       value.declarations.left === '0px' ? '' : 'left',
          //       value.declarations.bottom === '0px' ? '' : 'bottom',
          //       value.declarations.right === '0px' ? '' : 'right',
          //       value.declarations.top === '0px' ? '' : 'top',
          //     ],
          //   }),
          // ],
        }).then(({ x, y }) => {
          Object.assign(floating.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
      });
    }
  });
}

position();
