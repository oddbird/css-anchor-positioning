import {
  autoUpdate,
  detectOverflow,
  MiddlewareState,
  platform,
  type Rect,
} from '@floating-ui/dom';

import { POLYFILL_ID_ATTR, TARGET_STYLE_ATTR } from './constants.js';
import { fetchCSS, StyleData } from './fetch.js';
import {
  AnchorFunction,
  AnchorFunctionDeclaration,
  type AnchorPositions,
  type AnchorSide,
  type AnchorSize,
  getCSSPropertyValue,
  InsetProperty,
  isInsetProp,
  isSizingProp,
  parseCSS,
  SizingProperty,
  TryBlock,
} from './parse.js';
import { replaceLink, transformCSS } from './transform.js';

const platformWithCache = { ...platform, _c: new Map() };

const getOffsetParent = async (el: HTMLElement) => {
  let offsetParent = await platform.getOffsetParent?.(el);
  if (!(await platform.isElement?.(offsetParent))) {
    offsetParent =
      (await platform.getDocumentElement?.(el)) ||
      window.document.documentElement;
  }
  return offsetParent as HTMLElement;
};

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

const getMargin = (el: HTMLElement, dir: 'top' | 'right' | 'bottom' | 'left') =>
  parseInt(getCSSPropertyValue(el, `margin-${dir}`), 10) || 0;

const getMargins = (el: HTMLElement) => {
  return {
    top: getMargin(el, 'top'),
    right: getMargin(el, 'right'),
    bottom: getMargin(el, 'bottom'),
    left: getMargin(el, 'left'),
  };
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
    let offsetParent;
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
        offsetParent = await getOffsetParent(targetEl);
      }
      let value =
        anchorRect[axis] + anchorRect[dir] * ((percentage as number) / 100);
      switch (targetProperty) {
        case 'bottom': {
          if (!offsetParent) {
            break;
          }
          let offsetHeight = offsetParent.clientHeight;
          // This is a hack for inline elements with `clientHeight: 0`,
          // but it doesn't take scrollbar size into account
          if (offsetHeight === 0 && isInline(offsetParent)) {
            const border = getBorders(offsetParent, axis);
            offsetHeight = offsetParent.offsetHeight - border;
          }
          value = offsetHeight - value;
          break;
        }
        case 'right': {
          if (!offsetParent) {
            break;
          }
          let offsetWidth = offsetParent.clientWidth;
          // This is a hack for inline elements with `clientWidth: 0`,
          // but it doesn't take scrollbar size into account
          if (offsetWidth === 0 && isInline(offsetParent)) {
            const border = getBorders(offsetParent, axis);
            offsetWidth = offsetParent.offsetWidth - border;
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

async function applyAnchorPositions(
  declarations: AnchorFunctionDeclaration,
  useAnimationFrame = false,
) {
  const root = document.documentElement;
  const cleanups: (() => void)[] = [];

  for (const [property, anchorValues] of Object.entries(declarations) as [
    InsetProperty | SizingProperty,
    AnchorFunction[],
  ][]) {
    for (const anchorValue of anchorValues) {
      const anchor = anchorValue.anchorEl;
      const target = anchorValue.targetEl;
      if (anchor && target) {
        const cleanup = autoUpdate(
          anchor,
          target,
          async () => {
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
          },
          { animationFrame: useAnimationFrame },
        );
        cleanups.push(cleanup);
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
  return cleanups;
}

async function applyPositionFallbacks(
  targetSel: string,
  fallbacks: TryBlock[],
  useAnimationFrame = false,
) {
  const cleanups: (() => void)[] = [];
  if (!fallbacks.length) {
    return cleanups;
  }

  const targets: NodeListOf<HTMLElement> = document.querySelectorAll(targetSel);

  for (const target of targets) {
    let checking = false;
    const offsetParent = await getOffsetParent(target);
    const cleanup = autoUpdate(
      target,
      target,
      async () => {
        // If this auto-update was triggered while the polyfill is already looping
        // through the possible `@try` blocks, do not check again.
        if (checking) {
          return;
        }
        checking = true;
        // Apply the styles from each `@try` block (in order), stopping when we
        // reach one that does not cause the target's margin-box to overflow
        // its offsetParent (containing block).
        for (const [index, { uuid }] of fallbacks.entries()) {
          target.setAttribute(POLYFILL_ID_ATTR, uuid);
          if (index === fallbacks.length - 1) {
            checking = false;
            break;
          }
          const rects = await platform.getElementRects({
            reference: target,
            floating: target,
            strategy: 'absolute',
          });
          const overflow = await detectOverflow(
            {
              x: target.offsetLeft,
              y: target.offsetTop,
              platform: platformWithCache,
              rects,
              elements: { floating: target },
              strategy: 'absolute',
            } as unknown as MiddlewareState,
            {
              boundary: offsetParent,
              rootBoundary: 'document',
              padding: getMargins(target),
            },
          );
          // If none of the sides overflow, use this `@try` block and stop loop...
          if (Object.values(overflow).every((side) => side <= 0)) {
            checking = false;
            break;
          }
        }
      },
      { animationFrame: useAnimationFrame },
    );
    cleanups.push(cleanup);
  }
  return cleanups;
}

async function position(rules: AnchorPositions, useAnimationFrame = false) {
  const cleanups = [];
  for (const pos of Object.values(rules)) {
    // Handle `anchor()` and `anchor-size()` functions...
    cleanups.push(
      ...(await applyAnchorPositions(
        pos.declarations ?? {},
        useAnimationFrame,
      )),
    );
  }

  for (const [targetSel, position] of Object.entries(rules)) {
    // Handle `@position-fallback` blocks...
    cleanups.push(
      ...(await applyPositionFallbacks(
        targetSel,
        position.fallbacks ?? [],
        useAnimationFrame,
      )),
    );
  }
  return cleanups;
}

let styleData: StyleData[] = [];
let rootStyle: string | null;
let cleanups: (() => void)[] = [];
let polyfilled = false;

export async function polyfill(animationFrame?: boolean) {
  if (polyfilled) {
    await restore();
  }
  rootStyle = document.documentElement.getAttribute('style');
  const useAnimationFrame =
    animationFrame === undefined
      ? Boolean(window.UPDATE_ANCHOR_ON_ANIMATION_FRAME)
      : animationFrame;
  // fetch CSS from stylesheet and inline style
  styleData = await fetchCSS();

  // parse CSS
  const { rules, inlineStyles } = await parseCSS(styleData);

  if (Object.values(rules).length) {
    // update source code
    await transformCSS(styleData, inlineStyles);

    // calculate position values
    cleanups = await position(rules, useAnimationFrame);
  }

  polyfilled = true;
  return rules;
}

export async function restore() {
  for (const cleanup of cleanups) {
    cleanup();
  }
  document.querySelectorAll(`[${POLYFILL_ID_ATTR}]`).forEach((el) => {
    el.removeAttribute(POLYFILL_ID_ATTR);
  });
  document.querySelectorAll(`[${TARGET_STYLE_ATTR}]`).forEach((el) => {
    const original = el.getAttribute(TARGET_STYLE_ATTR);
    if (original) {
      el.setAttribute('style', original);
    } else {
      el.removeAttribute('style');
    }
    el.removeAttribute(TARGET_STYLE_ATTR);
  });
  for (const { el, original, changed, url } of styleData) {
    if (changed) {
      if (el.tagName.toLowerCase() === 'style') {
        el.innerHTML = original;
      } else if (el.tagName.toLowerCase() === 'link') {
        await replaceLink(el as HTMLLinkElement, original, url);
      } else {
        el.setAttribute('style', original);
      }
    }
  }
  if (rootStyle) {
    document.documentElement.setAttribute('style', rootStyle);
  } else {
    document.documentElement.removeAttribute('style');
  }
  polyfilled = false;
}
