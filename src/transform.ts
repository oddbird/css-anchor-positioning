import {
  autoUpdate,
  Axis,
  computePosition,
  offset,
  Placement,
  Rect,
} from '@floating-ui/dom';
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

const getPixelValue = (
  anchor: Rect,
  edge: string | undefined,
  fallback: string,
) => {
  switch (edge) {
    case 'left':
      return `${anchor.x}px`;
    case 'right':
      return `${anchor.x + anchor.width}px`;
    case 'top':
      return `${anchor.y}px`;
    case 'bottom':
      return `${anchor.y + anchor.height}px`;
  }
  return fallback;
};

export function position(rules: AnchorPositions) {
  console.log(rules);

  Object.entries(rules).forEach(([floatingEl, position]) => {
    const floating: HTMLElement | null = document.querySelector(floatingEl);

    if (!floating) {
      return;
    }

    const promises: Promise<{ [key: string]: string }>[] = [];

    Object.entries(position.declarations || {}).forEach(
      ([property, anchorValue]) => {
        // @@@ For now, assume the first element is valid
        if (anchorValue.anchorEl) {
          const anchor = document.querySelector(anchorValue.anchorEl[0]);
          if (anchor) {
            const promise = new Promise<{ [key: string]: string }>(
              (resolve) => {
                computePosition(anchor, floating, {
                  middleware: [
                    offset(({ rects }) => {
                      resolve({
                        // @@@ Ideally we would directly replace these values
                        // in the CSS, so that we don't worry about the cascade,
                        // and we could ignore `property` (e.g. handling `calc`)
                        [property]: getPixelValue(
                          rects.reference,
                          anchorValue.anchorEdge,
                          anchorValue.fallbackValue,
                        ),
                      });
                      return 0;
                    }),
                  ],
                });
              },
            );
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
