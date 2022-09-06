import { autoUpdate, computePosition, flip, Placement } from '@floating-ui/dom';
import * as csstree from 'css-tree';

import { fetchCSS, isStyleLink } from './fetch.js';
import {
  AnchorPositions,
  getAST,
  isFallbackAtRule,
  isFallbackDeclaration,
  parseCSS,
} from './parse.js';

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

export async function transformCSS() {
  const styleData = await fetchCSS();
  const allCSS: string[] = [];

  // Handle inline stylesheets
  const styleTagCSS = document.querySelectorAll('style');
  styleTagCSS.forEach((element) => {
    element.innerHTML = removeAnchorCSS(element.innerHTML);
  });

  // Handle linked stylesheets
  styleData.forEach(({ source, css }) => {
    allCSS.push(css);

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

  // Get data from concatenated styles
  parseCSS(allCSS.join('\n'));
}

export function position(rules: AnchorPositions) {
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

  Object.entries(rules).map(([key, value]) => {
    // For now, grab just the first declaration
    // @@@ How do we handle multiple declarations?
    const anchorObjArray = [];

    // was thinking that we need this key and value, but i'm unsure how to handle them now lol
    // obvs pushing into an array is not helpful esp. with the dashes
    Object.entries(value.declarations).map(([anchorKey, anchorValue]) => {
      anchorObjArray.push({ [anchorKey]: anchorValue });
    });

    const floating: HTMLElement | null = document.querySelector(key);
    const anchor = document.querySelector(
      anchorObjArray[0]['--center'].anchorEl[0],
    );

    if (anchor && floating) {
      autoUpdate(anchor, floating, () => {
        computePosition(anchor, floating, {
          // @@@ We should convert `anchorEdge` to valid placement options
          //
          // @@@ This is way too "smart" -- we're ignoring the property
          // declaration entirely, and just assuming that the property is the
          // opposite of the `anchorEdge`. What if we want the `top` of the
          // floating element to line up with the `top` of the anchor element?
          placement: anchorObjArray[0]['--center'].anchorEdge as Placement,
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
fetchCSS().then((data) => {
  const rules = data.map((datum) => {
    return parseCSS(datum.css);
  });
  return rules.map((ruleset) => {
    return position(ruleset);
  });
});
