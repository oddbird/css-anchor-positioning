import { platform } from '@floating-ui/dom';

import {
  getCSSPropertyValue,
  getElementsBySelector,
  hasAnchorName,
  hasAnchorScope,
  hasStyle,
  type Selector,
} from './dom.js';

// Given a target element's containing block (CB) and an anchor element,
// determines if the anchor element is a descendant of the target CB.
// An additional check is added to see if the target CB is the anchor,
// because `.contains()` will return true: "a node is contained inside itself."
// https://developer.mozilla.org/en-US/docs/Web/API/Node/contains
function isContainingBlockDescendant(
  containingBlock: Element | Window,
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

function precedes(self: HTMLElement, other: HTMLElement) {
  return self.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING;
}

/** https://drafts.csswg.org/css-display-4/#formatting-context */
async function getFormattingContext(element: HTMLElement) {
  return await platform.getOffsetParent(element);
}

/** https://drafts.csswg.org/css-display-4/#containing-block */
async function getContainingBlock(element: HTMLElement) {
  if (
    !['absolute', 'fixed'].includes(getCSSPropertyValue(element, 'position'))
  ) {
    return await getFormattingContext(element);
  }

  let currentParent = element.parentElement;

  while (currentParent) {
    if (
      !hasStyle(currentParent, 'position', 'static') &&
      hasStyle(currentParent, 'display', 'block')
    ) {
      return currentParent;
    }

    currentParent = currentParent.parentElement;
  }

  return window;
}

/**
 * Validates that el is a acceptable anchor element for an absolutely positioned
 * element query el
 * https://drafts.csswg.org/css-anchor-position-1/#acceptable-anchor-element
 */
export async function isAcceptableAnchorElement(
  el: HTMLElement,
  anchorName: string | null,
  queryEl: HTMLElement,
  scopeSelector: string | null,
) {
  const elContainingBlock = await getContainingBlock(el);
  const queryElContainingBlock = await getContainingBlock(queryEl);

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
    let currentCB: Element | Window;
    const anchorCBchain: (typeof currentCB)[] = [];

    currentCB = elContainingBlock;
    while (
      currentCB &&
      currentCB !== queryElContainingBlock &&
      currentCB !== window
    ) {
      anchorCBchain.push(currentCB);
      currentCB = await getContainingBlock(currentCB as HTMLElement);
    }
    const lastInChain = anchorCBchain[anchorCBchain.length - 1];

    if (
      lastInChain instanceof HTMLElement &&
      !(!isAbsolutelyPositioned(lastInChain) || precedes(lastInChain, queryEl))
    ) {
      return false;
    }
  }

  // el is not in the skipped contents of another element.
  {
    let currentParent = el.parentElement;

    while (currentParent) {
      if (hasStyle(currentParent, 'content-visibility', 'hidden')) {
        return false;
      }

      currentParent = currentParent.parentElement;
    }
  }

  // el is in scope for query el, per the effects of anchor-scope on query el or
  // its ancestors.
  if (
    anchorName &&
    scopeSelector &&
    getScope(el, anchorName, scopeSelector) !==
      getScope(queryEl, anchorName, scopeSelector)
  ) {
    return false;
  }

  return true;
}

function getScope(
  element: HTMLElement,
  anchorName: string,
  scopeSelector: string,
) {
  // Unlike the real `anchor-scope`, our `--anchor-scope` custom property
  // inherits. We first check that the element matches the scope selector, so we
  // can be guaranteed that the computed value we read was set explicitly, not
  // inherited. Then we verify that the specified anchor scope is actually the
  // one applied by the CSS cascade.
  while (
    !(element.matches(scopeSelector) && hasAnchorScope(element, anchorName))
  ) {
    if (!element.parentElement) {
      return null;
    }
    element = element.parentElement;
  }
  return element;
}

/**
 * Given a target element and CSS selector(s) for potential anchor element(s),
 * returns the first element that passes validation,
 * or `null` if no valid anchor element is found
 * https://drafts.csswg.org/css-anchor-position-1/#target
 */
export async function validatedForPositioning(
  targetEl: HTMLElement | null,
  anchorName: string | null,
  anchorSelectors: Selector[],
  scopeSelectors: Selector[],
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

  const anchorElements = anchorSelectors
    // Any element that matches a selector that sets the specified `anchor-name`
    // could be a potential match.
    .flatMap(getElementsBySelector)
    // Narrow down the potential match elements to just the ones whose computed
    // `anchor-name` matches the specified one. This accounts for the
    // `anchor-name` value that was actually applied by the CSS cascade.
    .filter((el) => hasAnchorName(el, anchorName));

  // TODO: handle anchor-scope for pseudo-elements.
  const scopeSelector = scopeSelectors.map((s) => s.selector).join(',') || null;

  for (let index = anchorElements.length - 1; index >= 0; index--) {
    const anchor = anchorElements[index];
    const isPseudoElement = 'fakePseudoElement' in anchor;

    if (
      await isAcceptableAnchorElement(
        isPseudoElement ? anchor.fakePseudoElement : anchor,
        anchorName,
        targetEl,
        scopeSelector,
      )
    ) {
      if (isPseudoElement) anchor.removeFakePseudoElement();

      return anchor;
    }
  }

  return null;
}
