import { platform } from '@floating-ui/dom';

import { getCSSPropertyValue } from './parse.js';

// Given an element and CSS style property,
// checks if the CSS property equals a certain value
function hasStyle(element: HTMLElement, cssProperty: string, value: string) {
  return getCSSPropertyValue(element, cssProperty) === value;
}

// Given a target element's containing block (CB) and an anchor element,
// determines if the anchor element is a descendant of the target CB.
// An additional check is added to see if the target CB is the anchor,
// because `.contains()` will return true: "a node is contained inside itself."
// https://developer.mozilla.org/en-US/docs/Web/API/Node/contains
function isContainingBlockDescendant(
  containingBlock: Element | Window | undefined,
  anchor: Element,
): boolean {
  if (!containingBlock || containingBlock === anchor) {
    return false;
  }

  if (isWindow(containingBlock)) {
    return containingBlock.document.contains(anchor);
  } else {
    return containingBlock.contains(anchor);
  }
}

function isWindow(el: Element | Window | undefined): el is Window {
  return Boolean(el && el === (el as Window).window);
}

function isFixedPositioned(el: HTMLElement) {
  return hasStyle(el, 'position', 'fixed');
}

function isAbsolutelyPositioned(el?: HTMLElement | null) {
  return Boolean(
    el && (isFixedPositioned(el) || hasStyle(el, 'position', 'absolute')),
  );
}

function isTopLayer(el: HTMLElement) {
  // check for the specific top layer element types...
  // Currently, the top layer elements are:
  // popovers, modal dialogs, and elements in a fullscreen mode.
  // See https://developer.chrome.com/blog/top-layer-devtools/#what-are-the-top-layer-and-top-layer-elements
  // TODO:
  //   - only check for "open" popovers
  //   - add support for fullscreen elements
  const topLayerElements = document.querySelectorAll('dialog, [popover]');
  return Boolean(Array.from(topLayerElements).includes(el));
}

function precedes(self: HTMLElement, other: HTMLElement) {
  return (
    self.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING ||
    isTopLayer(other)
  );
}

/**
 * Validates that el is a acceptable anchor element for an absolutely positioned element query el
 * https://drafts.csswg.org/css-anchor-position-1/#acceptable-anchor-element
 */
export async function isAcceptableAnchorElement(
  el: HTMLElement,
  queryEl: HTMLElement,
) {
  const elContainingBlock = await platform.getOffsetParent(el);
  const queryElContainingBlock = await platform.getOffsetParent(queryEl);

  // Either el is a descendant of query el’s containing block
  // or query el’s containing block is the initial containing block.
  if (
    !(
      isContainingBlockDescendant(queryElContainingBlock, el) ||
      isWindow(queryElContainingBlock)
    )
  ) {
    return false;
  }

  // If el has the same containing block as query el,
  // then either el is not absolutely positioned,
  // or el precedes query el in the tree order.
  if (
    elContainingBlock === queryElContainingBlock &&
    !(!isAbsolutelyPositioned(el) || precedes(el, queryEl))
  ) {
    return false;
  }

  // If el has a different containing block from query el,
  // then the last containing block in el’s containing block chain
  // before reaching query el’s containing block
  // is either not absolutely positioned or precedes query el in the tree order.
  if (elContainingBlock !== queryElContainingBlock) {
    let currentCB: Element | Window | undefined;
    const anchorCBchain: (typeof currentCB)[] = [];

    currentCB = elContainingBlock;
    while (
      currentCB &&
      currentCB !== queryElContainingBlock &&
      currentCB !== window
    ) {
      anchorCBchain.push(currentCB);
      currentCB = await platform.getOffsetParent?.(currentCB as HTMLElement);
    }
    const lastInChain = anchorCBchain[anchorCBchain.length - 1];

    if (
      lastInChain instanceof HTMLElement &&
      !(!isAbsolutelyPositioned(lastInChain) || precedes(lastInChain, queryEl))
    ) {
      return false;
    }
  }

  // TODO el is either an element or a part-like pseudo-element.

  // el is not in the skipped contents of another element.
  {
    let currentParent = el.parentElement;

    while (currentParent) {
      if (getComputedStyle(currentParent).contentVisibility === 'hidden') {
        return false;
      }

      currentParent = currentParent.parentElement;
    }
  }

  return true;
}

// Given a target element and CSS selector(s) for potential anchor element(s),
// returns the first element that passes validation,
// or `null` if no valid anchor element is found
export async function validatedForPositioning(
  targetEl: HTMLElement | null,
  anchorSelectors: string[],
) {
  if (
    !(
      targetEl instanceof HTMLElement &&
      anchorSelectors.length &&
      isAbsolutelyPositioned(targetEl)
    )
  ) {
    return null;
  }

  const anchorElements: NodeListOf<HTMLElement> = document.querySelectorAll(
    anchorSelectors.join(', '),
  );

  let acceptableAnchorElement: HTMLElement | undefined;

  for (const anchor of anchorElements) {
    if (await isAcceptableAnchorElement(anchor, targetEl)) {
      acceptableAnchorElement = anchor;
    }
  }

  return acceptableAnchorElement;
}
