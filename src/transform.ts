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

  Object.fromEntries(
    Object.entries(strategies).map(([key, value], index) => {
      const anchor = Object.fromEntries(
        Object.entries(strategies[key].declarations).map(
          ([declaration, value], index) => {
            if (strategies[key].declarations[declaration].anchorEl) {
              return strategies[key].declarations[declaration].anchorEl;
            }
          },
        ),
      );

      const floating = document.getElementById(key);

      if (anchor && floating) {
        autoUpdate(anchor, floating, () => {
          computePosition(anchor, floating, {
            placement: strategies.strategy[0],
            middleware: [
              flip({
                fallbackPlacements: [
                  strategies[key].declarations.left === '0px' ? '' : 'left',
                  strategies[key].declarations.bottom === '0px' ? '' : 'bottom',
                  strategies[key].declarations.right === '0px' ? '' : 'right',
                  strategies[key].declarations.top === '0px' ? '' : 'top',
                ],
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
    }),
  );
}

position();
