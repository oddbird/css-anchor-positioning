import { platform } from '@floating-ui/dom';

import { getCSSPropertyValue } from './parse.js';

function hasStyle(element: HTMLElement, cssProperty: string, value: string) {
  return getCSSPropertyValue(element, cssProperty) === value;
}

// Given a target element and CSS selector(s) for potential anchor element(s),
// returns the first element that passes validation,
// or `null` if no valid anchor element is found
export async function validatedForPositioning(
  targetEl: HTMLElement | null,
  anchorSelectors: string[],
) {
  if (!targetEl || anchorSelectors.length === 0) {
    return null;
  }

  const anchorElements: NodeListOf<HTMLElement> = document.querySelectorAll(
    anchorSelectors.join(', '),
  );

  for (const anchor of anchorElements) {
    if (await isValidAnchorElement(anchor, targetEl)) {
      return anchor;
    }
  }

  return null;
}

export function isFixedPositioned(el: HTMLElement) {
  return hasStyle(el, 'position', 'fixed');
}

export function isAbsolutelyPositioned(el?: HTMLElement | null) {
  return Boolean(
    el && (isFixedPositioned(el) || hasStyle(el, 'position', 'absolute')),
  );
}

// Determines whether the containing block (CB) of the element
// is the initial containing block (ICB)
export function isContainingBlockICB(
  targetContainingBlock: Element | Window | undefined,
) {
  return Boolean(targetContainingBlock === window);
}

// Validates that anchor element is a valid anchor for given target element
export async function isValidAnchorElement(
  anchor: HTMLElement,
  target: HTMLElement,
) {
  const anchorContainingBlock = await platform.getOffsetParent?.(anchor);
  const targetContainingBlock = await platform.getOffsetParent?.(target);

  // If el has the same containing block as the querying element,
  // el must not be absolutely positioned.
  if (
    isAbsolutelyPositioned(anchor) &&
    anchorContainingBlock === targetContainingBlock
  ) {
    return false;
  }

  // If el has a different containing block from the querying element,
  // the last containing block in el's containing block chain
  // before reaching the querying element's containing block
  // must not be absolutely positioned:
  if (anchorContainingBlock !== targetContainingBlock) {
    let currentCB: Element | Window | undefined;
    const anchorCBchain: typeof currentCB[] = [];

    currentCB = anchorContainingBlock;
    while (
      currentCB &&
      currentCB !== targetContainingBlock &&
      currentCB !== window
    ) {
      anchorCBchain.push(currentCB);
      currentCB = await platform.getOffsetParent?.(currentCB as HTMLElement);
    }
    const lastInChain = anchorCBchain[anchorCBchain.length - 1];

    if (lastInChain && isAbsolutelyPositioned(lastInChain as HTMLElement)) {
      return false;
    }
  }

  // Either el is a descendant of query el’s containing block,
  // or query el’s containing block is the initial containing block
  // https://drafts4.csswg.org/css-anchor-1/#determining
  let isDescendant;
  if (targetContainingBlock && targetContainingBlock === window) {
    isDescendant = (targetContainingBlock as Window).document.contains(anchor);
  } else if (targetContainingBlock) {
    isDescendant = (targetContainingBlock as HTMLElement).contains(anchor);
  }

  const targetCBIsInitialCB = isContainingBlockICB(targetContainingBlock);

  if (isDescendant || targetCBIsInitialCB) {
    return true;
  }

  return false;
}
