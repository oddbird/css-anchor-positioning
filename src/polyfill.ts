import {
  type ElementRects,
  type FloatingElement,
  type Platform,
  type Rect,
  type ReferenceElement,
  type Strategy,
  autoUpdate,
  platform,
} from '@floating-ui/dom';

import { fetchCSS } from './fetch.js';
import { type AnchorPositions, type AnchorSide, parseCSS } from './parse.js';

// DOM platform does not have async methods
interface DomPlatform extends Platform {
  getDocumentElement: (element: Element) => HTMLElement;
  getElementRects: (args: {
    reference: ReferenceElement;
    floating: FloatingElement;
    strategy: Strategy;
  }) => ElementRects;
  getOffsetParent: (element: Element) => Element | Window;
  isElement: (value: unknown) => boolean;
  isRTL: (element: Element) => boolean;
}

const {
  getDocumentElement,
  getElementRects,
  getOffsetParent,
  isElement,
  isRTL,
} = platform as DomPlatform;

export const resolveLogicalKeyword = (edge: AnchorSide, rtl: boolean) => {
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
  anchorEdge?: AnchorSide;
  fallback: string;
}

export const getPixelValue = ({
  targetEl,
  targetProperty,
  anchorRect,
  anchorEdge,
  fallback,
}: GetPixelValueOpts) => {
  let percentage: number | undefined;
  let offsetParent: Element | Window | HTMLElement | undefined;
  const axis = getAxis(targetProperty);

  switch (anchorEdge) {
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
      if (anchorEdge !== undefined && targetEl) {
        // `start` and `end` should use the writing-mode of the element's
        // containing block, not the element itself:
        // https://trello.com/c/KnqCnHx3
        const rtl = isRTL(targetEl) || false;
        percentage = resolveLogicalKeyword(anchorEdge, rtl);
      }
  }

  const hasPercentage =
    typeof percentage === 'number' && !Number.isNaN(percentage);

  if (targetProperty === 'bottom' || targetProperty === 'right') {
    offsetParent = getOffsetParent(targetEl);
    if (!isElement(offsetParent)) {
      offsetParent = getDocumentElement(targetEl);
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

export function position(rules: AnchorPositions) {
  Object.entries(rules).forEach(([targetSel, position]) => {
    const target: HTMLElement | null = document.querySelector(targetSel);

    if (!target) {
      return;
    }

    Object.entries(position.declarations || {}).forEach(
      ([property, anchorValue]) => {
        const anchor = anchorValue.anchorEl;
        if (anchor) {
          autoUpdate(anchor, target, () => {
            const rects = getElementRects({
              reference: anchor,
              floating: target,
              strategy: 'absolute',
            });
            const resolved = getPixelValue({
              targetEl: target,
              targetProperty: property,
              anchorRect: rects.reference,
              anchorEdge: anchorValue.anchorEdge,
              fallback: anchorValue.fallbackValue,
            });
            Object.assign(target.style, { [property]: resolved });
          });
        }
      },
    );
  });
}

export async function polyfill() {
  // fetch CSS from stylesheet and inline style
  const styleData = await fetchCSS();

  // parse CSS
  const rules = parseCSS(styleData.map(({ css }) => css).join('\n'));

  if (Object.values(rules).length) {
    position(rules);

    // update source code
    // https://trello.com/c/f1L7Ti8m
    // transformCSS(styleData);
  }

  return rules;
}
