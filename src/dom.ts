import { platform, type VirtualElement } from '@floating-ui/dom';
import { nanoid } from 'nanoid/non-secure';

import { SHIFTED_PROPERTIES } from './cascade.js';
import { type AnchorPositioningRoot } from './polyfill.js';

/**
 * Representation of a CSS selector that allows getting the element part and
 * pseudo-element part.
 */
export interface Selector {
  selector: string;
  elementPart: string;
  pseudoElementPart?: string;
}

/**
 * Used instead of an HTMLElement as a handle for pseudo-elements.
 */
export interface PseudoElement extends VirtualElement {
  fakePseudoElement: HTMLElement;
  computedStyle: CSSStyleDeclaration;
  removeFakePseudoElement(): void;
}

/**
 * Possible values for `anchor-scope`
 * (in addition to any valid dashed identifier)
 */
export const enum AnchorScopeValue {
  All = 'all',
  None = 'none',
}

/**
 * Gets the computed value of a CSS property for an element or pseudo-element.
 *
 * Note: values for properties that are not natively supported are *always*
 * subject to CSS inheritance.
 */
export function getCSSPropertyValue(
  el: HTMLElement | PseudoElement,
  prop: string,
) {
  prop = SHIFTED_PROPERTIES[prop] ?? prop;
  const computedStyle =
    el instanceof HTMLElement ? getComputedStyle(el) : el.computedStyle;
  return computedStyle.getPropertyValue(prop).trim();
}

/**
 * Checks whether a given element or pseudo-element has the given property
 * value.
 *
 * Note: values for properties that are not natively supported are *always*
 * subject to CSS inheritance.
 */
export function hasStyle(
  element: HTMLElement | PseudoElement,
  cssProperty: string,
  value: string,
) {
  return getCSSPropertyValue(element, cssProperty) === value;
}

/**
 * Creates a DOM element to use in place of a pseudo-element.
 */
function createFakePseudoElement(
  element: HTMLElement,
  { selector, pseudoElementPart }: Selector,
) {
  // Floating UI needs `Element.getBoundingClientRect` to calculate the position
  // for the anchored element, since there isn't a way to get it for
  // pseudo-elements; we create a temporary "fake pseudo-element" that we use as
  // reference.
  const computedStyle = getComputedStyle(element, pseudoElementPart);
  const fakePseudoElement = document.createElement('div');
  const sheet = document.createElement('style');

  fakePseudoElement.id = `fake-pseudo-element-${nanoid()}`;

  // Copy styles from pseudo-element to the "fake pseudo-element", `.cssText`
  // does not work on Firefox.
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

  const insertionPoint =
    pseudoElementPart === '::before' ? 'afterbegin' : 'beforeend';
  element.insertAdjacentElement(insertionPoint, fakePseudoElement);
  return { fakePseudoElement, sheet, computedStyle };
}

/**
 * Finds the first scrollable parent of the given element
 * (or the element itself if the element is scrollable).
 */
function findFirstScrollingElement(element: HTMLElement) {
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    if (hasStyle(currentElement, 'overflow', 'scroll')) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return currentElement;
}

/**
 * Gets the scroll position of the first scrollable parent
 * (or the scroll position of the element itself, if it is scrollable).
 */
function getContainerScrollPosition(element: HTMLElement) {
  let containerScrollPosition: {
    scrollTop: number;
    scrollLeft: number;
  } | null = findFirstScrollingElement(element);

  // Avoid doubled scroll
  if (containerScrollPosition === document.documentElement) {
    containerScrollPosition = null;
  }

  return containerScrollPosition ?? { scrollTop: 0, scrollLeft: 0 };
}

/**
 * Like `document.querySelectorAll`, but if the selector has a pseudo-element it
 * will return a wrapper for the rest of the polyfill to use.
 */
export function getElementsBySelector(
  selector: Selector,
  options: { roots: AnchorPositioningRoot[] },
) {
  const { elementPart, pseudoElementPart } = selector;
  const result: (HTMLElement | PseudoElement)[] = [];
  const isBefore = pseudoElementPart === '::before';
  const isAfter = pseudoElementPart === '::after';

  // Currently we only support `::before` and `::after` pseudo-elements.
  if (pseudoElementPart && !(isBefore || isAfter)) return result;

  const elements = querySelectorAllRoots(options.roots, elementPart);

  if (!pseudoElementPart) {
    result.push(...elements);
    return result;
  }

  for (const element of elements) {
    const { fakePseudoElement, sheet, computedStyle } = createFakePseudoElement(
      element,
      selector,
    );

    const boundingClientRect = fakePseudoElement.getBoundingClientRect();
    const { scrollY: startingScrollY, scrollX: startingScrollX } = globalThis;
    const containerScrollPosition = getContainerScrollPosition(element);

    result.push({
      fakePseudoElement,
      computedStyle,

      removeFakePseudoElement() {
        fakePseudoElement.remove();
        sheet.remove();
      },

      // For https://floating-ui.com/docs/autoupdate#ancestorscroll to work on
      // `VirtualElement`s.
      contextElement: element,

      // https://floating-ui.com/docs/virtual-elements
      getBoundingClientRect() {
        const { scrollY, scrollX } = globalThis;
        const { scrollTop, scrollLeft } = containerScrollPosition;

        return DOMRect.fromRect({
          y:
            boundingClientRect.y +
            (startingScrollY - scrollY) +
            (containerScrollPosition.scrollTop - scrollTop),
          x:
            boundingClientRect.x +
            (startingScrollX - scrollX) +
            (containerScrollPosition.scrollLeft - scrollLeft),

          width: boundingClientRect.width,
          height: boundingClientRect.height,
        });
      },
    });
  }

  return result;
}

/**
 * Checks whether the given element has the given anchor name, based on the
 * element's computed style.
 *
 * Note: because our `--anchor-name` custom property inherits, this function
 * should only be called for elements which are known to have an explicitly set
 * value for `anchor-name`.
 */
export function hasAnchorName(
  el: PseudoElement | HTMLElement,
  anchorName: string | null,
) {
  const computedAnchorName = getCSSPropertyValue(el, 'anchor-name');
  if (!anchorName) {
    return !computedAnchorName;
  }
  return computedAnchorName
    .split(',')
    .map((name) => name.trim())
    .includes(anchorName);
}

/**
 * Checks whether the given element serves as a scope for the given anchor.
 *
 * Note: because our `--anchor-scope` custom property inherits, this function
 * should only be called for elements which are known to have an explicitly set
 * value for `anchor-scope`.
 */
export function hasAnchorScope(
  el: PseudoElement | HTMLElement,
  anchorName: string,
) {
  const computedAnchorScope = getCSSPropertyValue(el, 'anchor-scope');
  return (
    computedAnchorScope === anchorName ||
    computedAnchorScope === AnchorScopeValue.All
  );
}

export const getOffsetParent = async (el: HTMLElement) => {
  let offsetParent = await platform.getOffsetParent?.(el);
  if (!(await platform.isElement?.(offsetParent))) {
    offsetParent =
      (await platform.getDocumentElement?.(el)) ||
      window.document.documentElement;
  }
  return offsetParent as HTMLElement;
};

export const querySelectorAllRoots = (
  roots: AnchorPositioningRoot[],
  selector: string,
): HTMLElement[] => {
  return roots.flatMap(
    (e) => [...e.querySelectorAll(selector)] as HTMLElement[],
  );
};
