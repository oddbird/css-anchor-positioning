import { type VirtualElement } from '@floating-ui/dom';
import { nanoid } from 'nanoid/non-secure';
import { SHIFTED_PROPERTIES } from './utils.js';

export interface Selector {
  selector: string;
  elementPart: string;
  pseudoElementPart?: string;
}

export interface PseudoElement extends VirtualElement {
  fakePseudoElement: HTMLElement;
  computedStyle: CSSStyleDeclaration;
  removeFakePseudoElement(): void;
}

export function getCSSPropertyValue(
  el: HTMLElement | PseudoElement,
  prop: string,
) {
  prop = SHIFTED_PROPERTIES[prop] ?? prop;
  const computedStyle =
    el instanceof HTMLElement ? getComputedStyle(el) : el.computedStyle;
  return computedStyle.getPropertyValue(prop).trim();
}

// Given an element and CSS style property,
// checks if the CSS property equals a certain value
export function hasStyle(
  element: HTMLElement | PseudoElement,
  cssProperty: string,
  value: string,
) {
  return getCSSPropertyValue(element, cssProperty) === value;
}

function createFakePseudoElement(
  element: HTMLElement,
  { selector, pseudoElementPart }: Selector,
) {
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

  const insertionPoint =
    pseudoElementPart === '::before' ? 'afterbegin' : 'beforeend';
  element.insertAdjacentElement(insertionPoint, fakePseudoElement);
  return { fakePseudoElement, sheet, computedStyle };
}

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
  Like `document.querySelectorAll`, but if the selector has a pseudo-element
  it will return a wrapper for the rest of the polyfill to use.
*/
export function getElementsBySelector(selector: Selector) {
  const { elementPart, pseudoElementPart } = selector;
  const result: (HTMLElement | PseudoElement)[] = [];
  const isBefore = pseudoElementPart === '::before';
  const isAfter = pseudoElementPart === '::after';

  // Current we only support `::before` and `::after` pseudo-elements.
  if (pseudoElementPart && !(isBefore || isAfter)) return result;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(elementPart),
  );

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

      // For https://floating-ui.com/docs/autoupdate#ancestorscroll to work on `VirtualElement`s.
      contextElement: element,

      // https://floating-ui.com/docs/virtual-elements.
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
