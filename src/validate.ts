import { platform, type VirtualElement } from '@floating-ui/dom';
import { nanoid } from 'nanoid/non-secure';

import { getCSSPropertyValue, type Selector } from './parse.js';

export interface PseudoElement extends VirtualElement {
  fakePseudoElement: HTMLElement;
  computedStyle: CSSStyleDeclaration;
  removeFakePseudoElement(): void;
}

function getAnchorsBySelectors(selectors: Selector[]) {
  const result: (HTMLElement | PseudoElement)[] = [];

  for (const { selector, elementPart, pseudoElementPart } of selectors) {
    const is_before = pseudoElementPart === '::before';
    const is_after = pseudoElementPart === '::after';

    if (pseudoElementPart && !(is_before || is_after)) continue;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(elementPart),
    );

    if (!pseudoElementPart) {
      result.push(...elements);
      continue;
    }

    for (const element of elements) {
      const computedStyle = getComputedStyle(element, pseudoElementPart);
      const fakePseudoElement = document.createElement('div');
      const styleSheet = new CSSStyleSheet();
      const originalStyles = Array.from(document.adoptedStyleSheets);

      fakePseudoElement.id = `fake-pseudo-element-${nanoid()}`;

      for (const property of Array.from(computedStyle)) {
        const value = computedStyle.getPropertyValue(property);
        fakePseudoElement.style.setProperty(property, value);
      }

      styleSheet.insertRule(
        `#${fakePseudoElement.id}::before { content: ${computedStyle.content}; }`,
      );
      styleSheet.insertRule(`${selector} { display: none !important; }`);

      document.adoptedStyleSheets = [...originalStyles, styleSheet];

      if (is_before) {
        element.insertAdjacentElement('afterbegin', fakePseudoElement);
      }

      if (is_after) {
        element.insertAdjacentElement('beforeend', fakePseudoElement);
      }

      const startingScrollY = window.scrollY;
      const startingScrollX = window.scrollX;
      const boundingClientRect = fakePseudoElement.getBoundingClientRect();

      result.push({
        fakePseudoElement,
        computedStyle,

        removeFakePseudoElement() {
          fakePseudoElement.remove();
          document.adoptedStyleSheets = originalStyles;
        },

        getBoundingClientRect() {
          // NOTE this only takes into account viewport scroll and not any of it's parents,
          // traversing parents on each scroll event would be expensive
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

  // TODO el is in scope for query el, per the effects of anchor-scope on query el or its ancestors.

  return true;
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
      )
    ) {
      if (isPseudoElement) anchor.removeFakePseudoElement();

      return anchor;
    }
  }

  return null;
}
