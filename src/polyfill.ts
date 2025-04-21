import {
  autoUpdate,
  detectOverflow,
  type MiddlewareState,
  platform,
  type Rect,
  type VirtualElement,
} from '@floating-ui/dom';

import { cascadeCSS } from './cascade.js';
import { getCSSPropertyValue, getOffsetParent } from './dom.js';
import { fetchCSS } from './fetch.js';
import {
  type AnchorFunction,
  type AnchorFunctionDeclaration,
  type AnchorPositions,
  parseCSS,
  type TryBlock,
} from './parse.js';
import {
  type InsetValue,
  POSITION_AREA_CASCADE_PROPERTY,
  POSITION_AREA_WRAPPER_ATTRIBUTE,
  type PositionAreaTargetData,
} from './position-area.js';
import {
  type AnchorSide,
  type AnchorSize,
  type InsetProperty,
  isAcceptedAnchorSizeProp,
  isInsetProp,
  type SizingProperty,
} from './syntax.js';
import { transformCSS } from './transform.js';

const platformWithCache = { ...platform, _c: new Map() };

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
// See:
// https://github.com/oddbird/css-anchor-positioning/pull/22#discussion_r966348526
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
  targetProperty: InsetProperty | SizingProperty | 'position-area';
  anchorRect?: Rect;
  anchorSide?: AnchorSide;
  anchorSize?: AnchorSize;
  fallback?: string | null;
}

export const getPixelValue = async ({
  targetEl,
  targetProperty,
  anchorRect,
  anchorSide,
  anchorSize,
  fallback = null,
}: GetPixelValueOpts) => {
  if (!((anchorSize || anchorSide !== undefined) && targetEl && anchorRect)) {
    return fallback;
  }
  if (anchorSize) {
    if (!isAcceptedAnchorSizeProp(targetProperty)) {
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
    // Since the polyfill does not yet support anchor functions on `inset-*`
    // properties, they are omitted here.
    const startwardProperties = ['top', 'left'];

    switch (anchorSide) {
      case 'left':
      case 'top':
        percentage = 0;
        break;
      case 'right':
      case 'bottom':
        percentage = 100;
        break;
      case 'center':
        percentage = 50;
        break;
      case 'inside':
        percentage = startwardProperties.includes(targetProperty) ? 0 : 100;
        break;
      case 'outside':
        percentage = startwardProperties.includes(targetProperty) ? 100 : 0;
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

// Use `isPositionAreaDeclaration` instead for type narrowing AST nodes.
const isPositionAreaTarget = (
  value: AnchorFunction | PositionAreaTargetData,
): value is PositionAreaTargetData => {
  return 'wrapperEl' in value;
};

const isAnchorFunction = (
  value: AnchorFunction | PositionAreaTargetData,
): value is AnchorFunction => {
  return 'uuid' in value;
};

async function applyAnchorPositions(
  declarations: AnchorFunctionDeclaration,
  useAnimationFrame = false,
) {
  const root = document.documentElement;

  for (const [property, anchorValues] of Object.entries(declarations) as [
    InsetProperty | SizingProperty | 'position-area',
    (AnchorFunction | PositionAreaTargetData)[],
  ][]) {
    for (const anchorValue of anchorValues) {
      const anchor = anchorValue.anchorEl;
      const target = anchorValue.targetEl;
      if (anchor && target) {
        if (isPositionAreaTarget(anchorValue)) {
          const wrapper = anchorValue.wrapperEl!;
          const getPositionAreaPixelValue = async (
            inset: InsetValue,
            targetProperty: GetPixelValueOpts['targetProperty'],
            anchorRect: GetPixelValueOpts['anchorRect'],
          ) => {
            if (inset === 0) return '0px';
            return await getPixelValue({
              targetEl: wrapper,
              targetProperty: targetProperty,
              anchorRect: anchorRect,
              anchorSide: inset,
            });
          };

          autoUpdate(
            anchor,
            wrapper,
            async () => {
              // Check which `position-area` declaration would win based on the
              // cascade, and apply an attribute on the wrapper. This activates
              // the generated CSS styles that map the inset and alignment
              // values to their respective properties.
              const appliedId = getCSSPropertyValue(
                target,
                POSITION_AREA_CASCADE_PROPERTY,
              );
              wrapper.setAttribute(POSITION_AREA_WRAPPER_ATTRIBUTE, appliedId);

              const rects = await platform.getElementRects({
                reference: anchor,
                floating: wrapper,
                strategy: 'absolute',
              });
              const insets = anchorValue.insets;

              const topInset = await getPositionAreaPixelValue(
                insets.block[0],
                'top',
                rects.reference,
              );
              const bottomInset = await getPositionAreaPixelValue(
                insets.block[1],
                'bottom',
                rects.reference,
              );
              const leftInset = await getPositionAreaPixelValue(
                insets.inline[0],
                'left',
                rects.reference,
              );
              const rightInset = await getPositionAreaPixelValue(
                insets.inline[1],
                'right',
                rects.reference,
              );

              root.style.setProperty(
                `${anchorValue.targetUUID}-top`,
                topInset || null,
              );
              root.style.setProperty(
                `${anchorValue.targetUUID}-left`,
                leftInset || null,
              );
              root.style.setProperty(
                `${anchorValue.targetUUID}-right`,
                rightInset || null,
              );
              root.style.setProperty(
                `${anchorValue.targetUUID}-bottom`,
                bottomInset || null,
              );
              root.style.setProperty(
                `${anchorValue.targetUUID}-justify-self`,
                anchorValue.alignments.inline,
              );
              root.style.setProperty(
                `${anchorValue.targetUUID}-align-self`,
                anchorValue.alignments.block,
              );
            },
            { animationFrame: useAnimationFrame },
          );
        } else {
          autoUpdate(
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
        }
      } else if (isAnchorFunction(anchorValue)) {
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

async function checkOverflow(target: HTMLElement, offsetParent: HTMLElement) {
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
  return overflow;
}

async function applyPositionFallbacks(
  targetSel: string,
  fallbacks: TryBlock[],
  useAnimationFrame = false,
) {
  if (!fallbacks.length) {
    return;
  }

  const targets: NodeListOf<HTMLElement> = document.querySelectorAll(targetSel);

  for (const target of targets) {
    let checking = false;
    const offsetParent = await getOffsetParent(target);

    autoUpdate(
      // We're just checking whether the target element overflows, so we don't
      // care about the position of the anchor element in this case. Passing in
      // an empty object instead of a reference element avoids unnecessarily
      // watching for irrelevant changes.
      {} as VirtualElement,
      target,
      async () => {
        // If this auto-update was triggered while the polyfill is already
        // looping through the possible `position-try-fallbacks` blocks, do not
        // check again.
        if (checking) {
          return;
        }
        checking = true;
        target.removeAttribute('data-anchor-polyfill');
        const defaultOverflow = await checkOverflow(target, offsetParent);
        // If none of the sides overflow, don't try fallbacks
        if (Object.values(defaultOverflow).every((side) => side <= 0)) {
          target.removeAttribute('data-anchor-polyfill-last-successful');
          checking = false;
          return;
        }
        // Apply the styles from each fallback block (in order), stopping when
        // we reach one that does not cause the target's margin-box to overflow
        // its offsetParent (containing block).
        for (const [index, { uuid }] of fallbacks.entries()) {
          target.setAttribute('data-anchor-polyfill', uuid);

          const overflow = await checkOverflow(target, offsetParent);

          // If none of the sides overflow, use this fallback and stop loop.
          if (Object.values(overflow).every((side) => side <= 0)) {
            target.setAttribute('data-anchor-polyfill-last-successful', uuid);
            checking = false;
            break;
          }
          // If it's the last fallback, and none have matched, revert to the
          // last successful fallback.
          if (index === fallbacks.length - 1) {
            const lastSuccessful = target.getAttribute(
              'data-anchor-polyfill-last-successful',
            );
            if (lastSuccessful) {
              target.setAttribute('data-anchor-polyfill', lastSuccessful);
            } else {
              target.removeAttribute('data-anchor-polyfill');
            }
            checking = false;
            break;
          }
        }
      },
      { animationFrame: useAnimationFrame, layoutShift: false },
    );
  }
}

async function position(rules: AnchorPositions, useAnimationFrame = false) {
  for (const pos of Object.values(rules)) {
    // Handle `anchor()` and `anchor-size()` functions and `position-area`
    // properties..
    await applyAnchorPositions(pos.declarations ?? {}, useAnimationFrame);
  }

  for (const [targetSel, position] of Object.entries(rules)) {
    // Handle `@position-try` blocks...
    await applyPositionFallbacks(
      targetSel,
      position.fallbacks ?? [],
      useAnimationFrame,
    );
  }
}

export interface AnchorPositioningPolyfillOptions {
  // Whether to use `requestAnimationFrame()` when updating target elements’
  // positions
  useAnimationFrame?: boolean;

  // An array of explicitly targeted elements to polyfill
  elements?: HTMLElement[];

  // Whether to exclude elements with eligible inline styles. When not defined
  // or set to `false`, the polyfill will be applied to all elements that have
  // eligible inline styles, regardless of whether the `elements` option is
  // defined. When set to `true`, elements with eligible inline styles listed
  // in the `elements` option will still be polyfilled, but no other elements
  // in the document will be implicitly polyfilled.
  excludeInlineStyles?: boolean;
}

function normalizePolyfillOptions(
  useAnimationFrameOrOption: boolean | AnchorPositioningPolyfillOptions = {},
) {
  const options =
    typeof useAnimationFrameOrOption === 'boolean'
      ? { useAnimationFrame: useAnimationFrameOrOption }
      : useAnimationFrameOrOption;
  const useAnimationFrame =
    options.useAnimationFrame === undefined
      ? Boolean(window.UPDATE_ANCHOR_ON_ANIMATION_FRAME)
      : options.useAnimationFrame;

  if (!Array.isArray(options.elements)) {
    options.elements = undefined;
  }

  return Object.assign(options, { useAnimationFrame });
}

// Support a boolean option for backwards compatibility.
export async function polyfill(
  useAnimationFrameOrOption?: boolean | AnchorPositioningPolyfillOptions,
) {
  const options = normalizePolyfillOptions(
    useAnimationFrameOrOption ?? window.ANCHOR_POSITIONING_POLYFILL_OPTIONS,
  );

  // fetch CSS from stylesheet and inline style
  let styleData = await fetchCSS(options.elements, options.excludeInlineStyles);

  // pre parse CSS styles that we need to cascade
  const cascadeCausedChanges = cascadeCSS(styleData);
  if (cascadeCausedChanges) {
    styleData = transformCSS(styleData);
  }
  // parse CSS
  const { rules, inlineStyles } = await parseCSS(styleData);

  if (Object.values(rules).length) {
    // update source code
    transformCSS(styleData, inlineStyles, true);

    // calculate position values
    await position(rules, options.useAnimationFrame);
  }

  return rules;
}
