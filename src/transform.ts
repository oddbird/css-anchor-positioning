import { autoUpdate, Axis, computePosition, Placement } from '@floating-ui/dom';
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
  const rules = parseCSS(allCSS.join('\n'));

  // @@@ Replace this with something that waits for DOM load?
  // Or make `autoUpdate` work.
  setTimeout(() => {
    position(rules);
  }, 1000);
}

const placementMapping: {
  [key: string]: { placement: Placement; coord: Axis };
} = {
  'top:top': {
    placement: 'left-start',
    coord: 'y',
  },
  'top:bottom': {
    placement: 'bottom',
    coord: 'y',
  },
  'bottom:bottom': {
    placement: 'left-end',
    coord: 'y',
  },
  'bottom:top': {
    placement: 'top',
    coord: 'y',
  },
  'left:left': {
    placement: 'top-start',
    coord: 'x',
  },
  'left:right': {
    placement: 'right',
    coord: 'x',
  },
  'right:right': {
    placement: 'top-end',
    coord: 'x',
  },
  'right:left': {
    placement: 'left',
    coord: 'x',
  },
};

export function position(rules: AnchorPositions) {
  console.log(rules);

  Object.entries(rules).forEach(([floatingEl, position]) => {
    const floating: HTMLElement | null = document.querySelector(floatingEl);

    if (!floating) {
      return;
    }

    const promises: Promise<{ left: string } | { top: string }>[] = [];

    Object.entries(position.declarations || {}).forEach(
      ([property, anchorValue]) => {
        // @@@ For now, assume the first element is valid
        if (anchorValue.anchorEl) {
          const anchor = document.querySelector(anchorValue.anchorEl[0]);
          const placement =
            placementMapping[`${property}:${anchorValue.anchorEdge}`];
          if (anchor && placement) {
            const promise = computePosition(anchor, floating, {
              placement: placement.placement,
            }).then(({ x, y }) => {
              if (placement.coord === 'x') {
                return { left: `${x}px` };
              }
              return { top: `${y}px` };
            });
            // @@@ Figure out how to handle `autoUpdate`
            autoUpdate(anchor, floating, () => {
              console.log('re-calculate');
            });
            promises.push(promise);
          }
        }
      },
    );

    if (promises.length) {
      Promise.all(promises).then((results) => {
        const placement = results.reduce(
          (prev, current) => ({ ...prev, ...current }),
          {},
        );
        console.log(floating, placement);
        Object.assign(floating.style, placement);
      });
    }
  });
}
