import { type Rect, autoUpdate, platform } from '@floating-ui/dom';

import { fetchCSS } from './fetch.js';
import {
  type AnchorPositions,
  type AnchorSide,
  type AnchorSize,
  AnchorFunction,
  getCSSPropertyValue,
  InsetProperty,
  isInsetProp,
  isSizingProp,
  parseCSS,
  SizingProperty,
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

const isInline = (el: HTMLElement) =>
  getCSSPropertyValue(el, 'display') === 'inline';

const getBorders = (el: HTMLElement, axis: 'x' | 'y') => {
  const props =
    axis === 'x'
      ? ['border-left-width', 'border-right-width']
      : ['border-top-width', 'border-bottom-width'];
  return (
    props.reduce(
      (total, prop) => total + parseInt(getCSSPropertyValue(el, prop), 10),
      0,
    ) || 0
  );
};

export interface GetPixelValueOpts {
  targetEl?: HTMLElement;
  targetProperty: InsetProperty | SizingProperty;
  anchorRect?: Rect;
  anchorSide?: AnchorSide;
  anchorSize?: AnchorSize;
  fallback: string;
}

export const getPixelValue = async ({
  targetEl,
  targetProperty,
  anchorRect,
  anchorSide,
  anchorSize,
  fallback,
}: GetPixelValueOpts) => {
  if (!((anchorSize || anchorSide !== undefined) && targetEl && anchorRect)) {
    return fallback;
  }
  if (anchorSize) {
    // anchor-size() can only be assigned to sizing properties:
    // https://drafts.csswg.org/css-anchor-1/#queries
    if (!isSizingProp(targetProperty)) {
      return fallback;
    }
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
        // of the target element (or its containing block):
        // `block` and `inline` should use the writing-mode of the element's
        // containing block, not the element itself:
        // https://trello.com/c/KnqCnHx3
        const writingMode = getCSSPropertyValue(targetEl, 'writing-mode');
        vertical =
          writingMode.startsWith('vertical-') ||
          writingMode.startsWith('sideways-');
        size = resolveLogicalSizeKeyword(anchorSize, vertical);
      }
    }
    if (size) {
      return `${anchorRect[size]}px`;
    }
    return fallback;
  }

  if (anchorSide !== undefined) {
    // Calculate value for `anchor()` fn...
    let percentage: number | undefined;
    let offsetParent: Element | Window | HTMLElement | undefined;
    const axis = getAxis(targetProperty);

    // anchor() can only be assigned to inset properties,
    // and if a physical keyword ('left', 'right', 'top', 'bottom') is used,
    // the axis of the keyword must match the axis of the inset property:
    // https://drafts.csswg.org/css-anchor-1/#queries
    if (
      !(
        isInsetProp(targetProperty) &&
        axis &&
        (!isInsetProp(anchorSide) || axis === getAxis(anchorSide))
      )
    ) {
      return fallback;
    }

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
        if (targetEl) {
          // `start` and `end` should use the writing-mode of the element's
          // containing block, not the element itself:
          // https://trello.com/c/KnqCnHx3
          const rtl = (await platform.isRTL?.(targetEl)) || false;
          percentage = resolveLogicalSideKeyword(anchorSide, rtl);
        }
    }

    const hasPercentage =
      typeof percentage === 'number' && !Number.isNaN(percentage);

    const dir = getAxisProperty(axis);
    if (hasPercentage && dir) {
      if (targetProperty === 'bottom' || targetProperty === 'right') {
        offsetParent = await platform.getOffsetParent?.(targetEl);
        if (!(await platform.isElement?.(offsetParent))) {
          offsetParent =
            (await platform.getDocumentElement?.(targetEl)) ||
            window.document.documentElement;
        }
      }
      let value =
        anchorRect[axis] + anchorRect[dir] * ((percentage as number) / 100);
      switch (targetProperty) {
        case 'bottom': {
          let offsetHeight = (offsetParent as HTMLElement).clientHeight;
          // This is a hack for inline elements with `clientHeight: 0`,
          // but it doesn't take scrollbar size into account
          if (offsetHeight === 0 && isInline(offsetParent as HTMLElement)) {
            const border = getBorders(offsetParent as HTMLElement, axis);
            offsetHeight = (offsetParent as HTMLElement).offsetHeight - border;
          }
          value = offsetHeight - value;
          break;
        }
        case 'right': {
          let offsetWidth = (offsetParent as HTMLElement).clientWidth;
          // This is a hack for inline elements with `clientWidth: 0`,
          // but it doesn't take scrollbar size into account
          if (offsetWidth === 0 && isInline(offsetParent as HTMLElement)) {
            const border = getBorders(offsetParent as HTMLElement, axis);
            offsetWidth = (offsetParent as HTMLElement).offsetWidth - border;
          }
          value = offsetWidth - value;
          break;
        }
      }
      return `${value}px`;
    }
  }

  return fallback;
};

async function position(rules: AnchorPositions) {
  const root = document.documentElement;

  for (const position of Object.values(rules)) {
    if (!position.declarations || !Object.keys(position.declarations).length) {
      continue;
    }

    for (const [property, anchorValues] of Object.entries(
      position.declarations,
    ) as [InsetProperty | SizingProperty, AnchorFunction[]][]) {
      for (const anchorValue of anchorValues) {
        const anchor = anchorValue.anchorEl;
        const target = anchorValue.targetEl;
        if (anchor && target) {
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
              anchorSize: anchorValue.anchorSize,
              fallback: anchorValue.fallbackValue,
            });
            root.style.setProperty(anchorValue.uuid, resolved);
          });
        } else {
          // Use fallback value
          const resolved = await getPixelValue({
            targetProperty: property,
            anchorSide: anchorValue.anchorSide,
            anchorSize: anchorValue.anchorSize,
            fallback: anchorValue.fallbackValue,
          });
          root.style.setProperty(anchorValue.uuid, resolved);
        }
      }
    }
  }
}

export async function polyfill() {
  // fetch CSS from stylesheet and inline style
  const styleData = await fetchCSS();

  // parse CSS
  const { rules, inlineStyles } = await parseCSS(styleData);

  if (Object.values(rules).length) {
    // calculate position values
    await position(rules);

    // update source code
    transformCSS(styleData, inlineStyles);
  }

  return rules;
}
