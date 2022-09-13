import { autoUpdate, computePosition, offset, Rect } from '@floating-ui/dom';

import { fetchCSS } from './fetch.js';
import { AnchorPositions, AnchorSide, parseCSS } from './parse.js';

export const resolveLogicalKeyword = (edge: AnchorSide, isRTL: boolean) => {
  let percentage: number | undefined;
  switch (edge) {
    case 'start':
    case 'self-start':
      percentage = 0;
      break;
    case 'end':
    case 'self-end':
      percentage = 100;
      break;
    default:
      if (typeof edge === 'number' && !Number.isNaN(edge)) {
        percentage = edge;
      }
  }
  if (percentage !== undefined) {
    return isRTL ? 100 - percentage : percentage;
  }
  return undefined;
};

// @@@ This should also check the writing-mode
// See: https://github.com/oddbird/css-anchor-positioning/pull/22#discussion_r966348526
export const getAxis = (position?: string) => {
  switch (position) {
    case 'top':
    case 'bottom':
      return 'y';
    case 'left':
    case 'right':
      return 'x';
  }
  return null;
};

export const getAxisProperty = (axis: 'x' | 'y' | null) => {
  switch (axis) {
    case 'x':
      return 'width';
    case 'y':
      return 'height';
  }
  return null;
};

export interface GetPixelValueOpts {
  floatingEl: HTMLElement;
  anchorRect: Rect;
  anchorEdge?: AnchorSide;
  floatingPosition?: string;
  fallback: string;
}

export const getPixelValue = ({
  floatingEl,
  anchorRect,
  anchorEdge,
  floatingPosition,
  fallback,
}: GetPixelValueOpts) => {
  let percentage: number | undefined;
  // This is required when the anchor edge is a logical keyword
  // (`start/end/self-start/self-end/center`) or a percentage,
  // not a physical keyword (`top/bottom/left/right`)
  let axis: 'x' | 'y' | null = getAxis(floatingPosition);

  switch (anchorEdge) {
    case 'left':
      percentage = 0;
      axis = 'x';
      break;
    case 'right':
      percentage = 100;
      axis = 'x';
      break;
    case 'top':
      percentage = 0;
      axis = 'y';
      break;
    case 'bottom':
      percentage = 100;
      axis = 'y';
      break;
    case 'center':
      percentage = 50;
      break;
    default:
      // Logical keywords require knowledge about the inset property,
      // as well as the writing direction of the floating element
      // (or its containing block)
      if (anchorEdge !== undefined && floatingEl) {
        // @@@ `start` and `end` should use the writing-mode of the element's
        // containing block, not the element itself
        const isRTL = getComputedStyle(floatingEl).direction === 'rtl';
        percentage = resolveLogicalKeyword(anchorEdge, isRTL);
      }
  }

  const dir = getAxisProperty(axis);
  if (
    axis &&
    dir &&
    typeof percentage === 'number' &&
    !Number.isNaN(percentage)
  ) {
    return `${anchorRect[axis] + (anchorRect[dir] * percentage) / 100}px`;
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
        const anchor = anchorValue.anchorEl;
        if (anchor) {
          const promise = new Promise<{ [key: string]: string }>((resolve) => {
            computePosition(anchor, floating, {
              middleware: [
                offset(({ elements, rects }) => {
                  resolve({
                    // @@@ Ideally we would directly replace these values
                    // in the CSS, so that we don't worry about the cascade,
                    // and we could usually ignore `property` entirely
                    [property]: getPixelValue({
                      floatingEl: elements.floating,
                      anchorRect: rects.reference,
                      anchorEdge: anchorValue.anchorEdge,
                      floatingPosition: property,
                      fallback: anchorValue.fallbackValue,
                    }),
                  });
                  return 0;
                }),
              ],
            });
          });
          // @@@ Figure out how to handle `autoUpdate`
          autoUpdate(anchor, floating, () => {
            console.log('re-calculate');
          });
          promises.push(promise);
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

export async function polyfill() {
  // fetch CSS from stylesheet and inline style
  const styleData = await fetchCSS();

  // parse CSS
  const rules = parseCSS(styleData.map(({ css }) => css).join('\n'));

  if (Object.values(rules).length) {
    // apply polyfill
    // @@@ Wait for DOM load?
    // Or make `autoUpdate` work.

    if (document.readyState === 'complete') {
      position(rules);
    }
    // @@@ update source code
    // transformCSS(styleData);
  }
}
