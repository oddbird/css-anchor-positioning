import { type Rect, autoUpdate, platform } from '@floating-ui/dom';

import { fetchCSS } from './fetch.js';
import {
  type AnchorPositions,
  type AnchorSide,
  type AnchorSize,
  getCSSPropertyValue,
  parseCSS,
} from './parse.js';
import { transformCSS } from './transform.js';

export const resolveLogicalSideKeyword = (side: AnchorSide, rtl: boolean) => {
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

export const resolveLogicalSizeKeyword = (
  size: AnchorSize,
  vertical: boolean,
) => {
  let resolved: 'width' | 'height' | undefined;
  switch (size) {
    case 'block':
    case 'self-block':
      resolved = vertical ? 'width' : 'height';
      break;
    case 'inline':
    case 'self-inline':
      resolved = vertical ? 'height' : 'width';
      break;
  }
  return resolved;
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
  anchorEl: HTMLElement;
  targetEl: HTMLElement;
  targetProperty: string;
  anchorRect: Rect;
  anchorSide?: AnchorSide;
  anchorSize?: AnchorSize;
  fallback: string;
}

export const getPixelValue = async ({
  anchorEl,
  targetEl,
  targetProperty,
  anchorRect,
  anchorSide,
  anchorSize,
  fallback,
}: GetPixelValueOpts) => {
  if (anchorSize) {
    // Calculate value for `anchor-size()` fn...
    let size: AnchorSize | undefined;
    switch (anchorSize) {
      case 'width':
      case 'height':
        size = anchorSize;
        break;
      default: {
        let vertical = false;
        // Logical keywords require checking the writing-mode
        // of the target element (or its containing block)
        if (targetEl) {
          // `block` and `inline` should use the writing-mode of the element's
          // containing block, not the element itself:
          // https://trello.com/c/KnqCnHx3
          vertical = getCSSPropertyValue(targetEl, 'writing-mode').startsWith(
            'vertical-',
          );
        }
        size = resolveLogicalSizeKeyword(anchorSize, vertical);
      }
    }
    if (size) {
      // Why this instead of `anchorRect[size]`? Should we use this throughout?
      // https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-name-multicol-004.html
      return `${anchorEl.getBoundingClientRect()[size]}px`;
    }
  } else if (anchorSide !== undefined) {
    // Calculate value for `anchor()` fn...
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
          percentage = resolveLogicalSideKeyword(anchorSide, rtl);
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
              anchorEl: anchor,
              targetEl: target,
              targetProperty: property,
              anchorRect: rects.reference,
              anchorSide: anchorValue.anchorSide,
              anchorSize: anchorValue.anchorSize,
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
