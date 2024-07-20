import { platform, type VirtualElement } from '@floating-ui/dom';
import { nanoid } from 'nanoid/non-secure';

import { getCSSPropertyValue, type Selector } from './parse.js';

export interface PseudoElement extends VirtualElement {
  fakePseudoElement: HTMLElement;
  computedStyle: CSSStyleDeclaration;
  removeFakePseudoElement(): void;
}

/**
  Like `document.querySelectorAll`, but if the selector has a pseudo-element
  it will return a wrapper for the rest of the polyfill to use.
*/
function getAnchorsBySelectors(selectors: Selector[]) {
  const result: (HTMLElement | PseudoElement)[] = [];

  for (const { selector, elementPart, pseudoElementPart } of selectors) {
    const isBefore = pseudoElementPart === '::before';
    const isAfter = pseudoElementPart === '::after';

    // Current we only support `::before` and `::after` pseudo-elements.
    if (pseudoElementPart && !(isBefore || isAfter)) continue;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(elementPart),
    );

    if (!pseudoElementPart) {
      result.push(...elements);
      continue;
    }

    for (const element of elements) {
      // Floating UI needs `Element.getBoundingClientRect` to calculate the position for the anchored element,
      // since there isn't a way to get it for pseudo-elements;
      // we create a temporary "fake pseudo-element" that we use as reference.
      const computedStyle = getComputedStyle(element, pseudoElementPart);
      const fakePseudoElement = document.createElement('div');
      const sheet = document.createElement('style');

      fakePseudoElement.id = `fake-pseudo-element-${nanoid()}`;

      // Copy styles from pseudo-element to the "fake pseudo-element", `.cssText` does not work on Firefox.
      for (const property of Array.from(computedStyle)) {
        const value = computedStyle.getPropertyValue(property);
        fakePseudoElement.style.setProperty(property, value);
      }

      // For the `content` property, since normal elements don't have it,
      // we add the content to a pseudo-element of the "fake pseudo-element".
      sheet.textContent += `#${fakePseudoElement.id}${pseudoElementPart} { content: ${computedStyle.content}; }`;
      // Hide the pseudo-element while the "fake pseudo-element" is visible.
      sheet.textContent += `${selector} { display: none !important; }`;

      document.head.append(sheet);

      if (isBefore) {
        element.insertAdjacentElement('afterbegin', fakePseudoElement);
      }

      if (isAfter) {
        element.insertAdjacentElement('beforeend', fakePseudoElement);
      }

      const startingScrollY = window.scrollY;
      const startingScrollX = window.scrollX;
      const boundingClientRect = fakePseudoElement.getBoundingClientRect();

      result.push({
        // Passed to `isAcceptableAnchorElement`.
        fakePseudoElement,
        // For testing.
        computedStyle,

        // For `validatedForPositioning` to "undo" the "fake pseudo-element" after it's been used.
        removeFakePseudoElement() {
          fakePseudoElement.remove();
          sheet.remove();
        },

        // https://floating-ui.com/docs/virtual-elements.
        getBoundingClientRect() {
          // NOTE this only takes into account viewport scroll and not any of it's parents,
          // traversing parents on each scroll event would be expensive.
          return DOMRect.fromRect({
            x: boundingClientRect.x - (window.scrollX - startingScrollX),
            y: boundingClientRect.y - (window.scrollY - startingScrollY),
            width: boundingClientRect.width,
            height: boundingClientRect.height,
          });
        },
      });
    }
  }

  return result;
}

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
 * Validates that el is a acceptable anchor element for an absolutely positioned element query el
 * https://drafts.csswg.org/css-anchor-position-1/#acceptable-anchor-element
 */
export async function isAcceptableAnchorElement(
  el: HTMLElement,
  queryEl: HTMLElement,
  scopeSelectors: Selector[],
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

  // el is in scope for query el, per the effects of anchor-scope on query el or its ancestors.
  if (getScope(el, scopeSelectors) !== getScope(queryEl, scopeSelectors)) {
    return false;
  }

  return true;
}

function getScope(element: Element, scopeSelectors: Selector[]) {
  while (
    !scopeSelectors.some((selector) => element.matches(selector.selector))
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

  const anchorElements = getAnchorsBySelectors(anchorSelectors);

  for (let index = anchorElements.length - 1; index >= 0; index--) {
    const anchor = anchorElements[index];
    const isPseudoElement = 'fakePseudoElement' in anchor;

    if (
      await isAcceptableAnchorElement(
        isPseudoElement ? anchor.fakePseudoElement : anchor,
        targetEl,
        scopeSelectors,
      )
    ) {
      if (isPseudoElement) anchor.removeFakePseudoElement();

      return anchor;
    }
  }

  return null;
}
