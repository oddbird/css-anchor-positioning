import { type Rect, autoUpdate, platform } from '@floating-ui/dom';

import { fetchCSS } from './fetch.js';
import { type AnchorPositions, type AnchorSide, parseCSS } from './parse.js';
import { transformCSS } from './transform.js';

export const resolveLogicalKeyword = (side: AnchorSide, rtl: boolean) => {
  let percentage: number | undefined;
  switch (side) {
    case 'start':
    case 'self-start':
      percentage = 0;
      break;
    case 'end':
    case 'self-end':
      percentage = 100;
      break;
    default:
      if (typeof side === 'number' && !Number.isNaN(side)) {
        percentage = side;
      }
  }
  if (percentage !== undefined) {
    return rtl ? 100 - percentage : percentage;
  }
  return undefined;
};

// This should also check the writing-mode
// See: https://github.com/oddbird/css-anchor-positioning/pull/22#discussion_r966348526
// https://trello.com/c/KnqCnHx3
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
  targetEl: HTMLElement;
  targetProperty: string;
  anchorRect: Rect;
  anchorSide?: AnchorSide;
  fallback: string;
}

export const getPixelValue = async ({
  targetEl,
  targetProperty,
  anchorRect,
  anchorSide,
  fallback,
}: GetPixelValueOpts) => {
  let percentage: number | undefined;
  let offsetParent: Element | Window | HTMLElement | undefined;
  const axis = getAxis(targetProperty);

  switch (anchorSide) {
    case 'left':
      percentage = 0;
      break;
    case 'right':
      percentage = 100;
      break;
    case 'top':
      percentage = 0;
      break;
    case 'bottom':
      percentage = 100;
      break;
    case 'center':
      percentage = 50;
      break;
    default:
      // Logical keywords require checking the writing direction
      // of the target element (or its containing block)
      if (anchorSide !== undefined && targetEl) {
        // `start` and `end` should use the writing-mode of the element's
        // containing block, not the element itself:
        // https://trello.com/c/KnqCnHx3
        const rtl = (await platform.isRTL?.(targetEl)) || false;
        percentage = resolveLogicalKeyword(anchorSide, rtl);
      }
  }

  const hasPercentage =
    typeof percentage === 'number' && !Number.isNaN(percentage);

  if (targetProperty === 'bottom' || targetProperty === 'right') {
    offsetParent = await platform.getOffsetParent?.(targetEl);
    if (!(await platform.isElement?.(offsetParent))) {
      offsetParent =
        (await platform.getDocumentElement?.(targetEl)) ||
        window.document.documentElement;
    }
  }

  const dir = getAxisProperty(axis);
  if (hasPercentage && axis && dir) {
    let value =
      anchorRect[axis] + anchorRect[dir] * ((percentage as number) / 100);
    switch (targetProperty) {
      case 'bottom':
        value = (offsetParent as HTMLElement).clientHeight - value;
        break;
      case 'right':
        value = (offsetParent as HTMLElement).clientWidth - value;
        break;
    }
    return `${value}px`;
  }

  return fallback;
};

function position(rules: AnchorPositions) {
  const root = document.documentElement;

  Object.entries(rules).forEach(([targetSel, position]) => {
    const target: HTMLElement | null = document.querySelector(targetSel);

    if (
      !target ||
      !position.declarations ||
      !Object.keys(position.declarations).length
    ) {
      return;
    }

    for (const [property, anchorValues] of Object.entries(
      position.declarations,
    )) {
      for (const anchorValue of anchorValues) {
        const anchor = anchorValue.anchorEl;
        if (anchor) {
          autoUpdate(anchor, target, async () => {
            const rects = await platform.getElementRects({
              reference: anchor,
              floating: target,
              strategy: 'absolute',
            });
            const resolved = await getPixelValue({
              targetEl: target,
              targetProperty: property,
              anchorRect: rects.reference,
              anchorSide: anchorValue.anchorSide,
              fallback: anchorValue.fallbackValue,
            });
            root.style.setProperty(anchorValue.uuid, resolved);
          });
        }
      }
    }
  });
}

export async function polyfill() {
  // fetch CSS from stylesheet and inline style
  const styleData = await fetchCSS();

  // parse CSS
  const rules = await parseCSS(styleData);

  if (Object.values(rules).length) {
    // calculate position values
    position(rules);

    // update source code
    transformCSS(styleData);
  }

  return rules;
}
