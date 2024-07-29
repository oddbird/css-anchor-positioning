import { platform } from '@floating-ui/dom';
import { nanoid } from 'nanoid/non-secure';

import {
  AnchorScopeValue,
  getCSSPropertyValue,
  getElementsBySelector,
  hasAnchorName,
  hasAnchorScope,
  hasStyle,
  PseudoElement,
  type Selector,
} from './dom.js';
import type {
  AnchorFunction,
  AnchorSelectors,
  InsetProperty,
  ParsedAnchorData,
  SizingProperty,
  TryBlock,
} from './parse.js';

/**
 * Represents an anchor function with the anchor and target elements resolved.
 */
export interface ResolvedAnchorFunction extends AnchorFunction {
  targetEl?: HTMLElement | null;
  anchorEl?: HTMLElement | PseudoElement | null;
}

/**
 * Mapping of declared properties to resolved anchor functions for the property.
 */
export type ResolvedAnchorFunctionDeclaration = Partial<
  Record<InsetProperty | SizingProperty, ResolvedAnchorFunction[]>
>;

/**
 * The complete resolved anchor position data for a selector.
 */
interface ResolvedAnchorPosition {
  declarations?: ResolvedAnchorFunctionDeclaration;
  fallbacks?: TryBlock[];
}

/**
 * Mapping of selectors to resolved anchor position data for that selector.
 */
export type ResolvedAnchorPositions = Record<string, ResolvedAnchorPosition>;

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

/**
 * Resolves the anchor element for the givne target element and anchor function.
 */
async function resolveAnchorEl(
  targetEl: HTMLElement | null,
  anchorObj: AnchorFunction,
  anchorNames: AnchorSelectors,
  anchorScopes: AnchorSelectors,
) {
  let anchorName = anchorObj.anchorName;
  const customPropName = anchorObj.customPropName;
  if (targetEl && !anchorName) {
    const anchorAttr = targetEl.getAttribute('anchor');
    const positionAnchorProperty = getCSSPropertyValue(
      targetEl,
      'position-anchor',
    );

    if (positionAnchorProperty) {
      anchorName = positionAnchorProperty;
    } else if (customPropName) {
      anchorName = getCSSPropertyValue(targetEl, customPropName);
    } else if (anchorAttr) {
      const elementPart = `#${CSS.escape(anchorAttr)}`;

      return await validatedForPositioning(
        targetEl,
        null,
        [{ selector: elementPart, elementPart }],
        [],
      );
    }
  }
  const anchorSelectors = anchorName ? anchorNames[anchorName] || [] : [];
  const allScopeSelectors = anchorName
    ? anchorScopes[AnchorScopeValue.All] || []
    : [];
  const anchorNameScopeSelectors = anchorName
    ? anchorScopes[anchorName] || []
    : [];
  return await validatedForPositioning(
    targetEl,
    anchorName || null,
    anchorSelectors,
    [...allScopeSelectors, ...anchorNameScopeSelectors],
  );
}

/**
 * Resolves all anchor functions and returns combined data for the rest of the
 * polyfill to use.
 */
export async function resolveAnchors({
  anchorFunctions,
  tryBlockTargets,
  tryBlocks,
  anchorNames,
  anchorScopes,
}: ParsedAnchorData) {
  const resolvedAnchors: ResolvedAnchorPositions = {};
  for (const [selector, blocks] of Object.entries(tryBlocks)) {
    resolvedAnchors[selector] = { fallbacks: blocks };
  }

  // Store inline style custom property mappings for each target element
  const inlineStyles = new Map<HTMLElement, Record<string, string>>();
  // Store any `anchor()` fns
  for (const [targetSel, anchorFns] of Object.entries(anchorFunctions)) {
    let targets: NodeListOf<HTMLElement>;
    if (
      targetSel.startsWith('[data-anchor-polyfill=') &&
      tryBlockTargets[targetSel]
    ) {
      // If we're dealing with a `@position-fallback` `@try` block,
      // then the targets are places where that `position-fallback` is used.
      targets = document.querySelectorAll(tryBlockTargets[targetSel]);
    } else {
      targets = document.querySelectorAll(targetSel);
    }
    for (const [targetProperty, anchorObjects] of Object.entries(anchorFns) as [
      InsetProperty | SizingProperty,
      AnchorFunction[],
    ][]) {
      for (const anchorObj of anchorObjects) {
        for (const targetEl of targets) {
          // For every target element, find a valid anchor element
          const anchorEl = await resolveAnchorEl(
            targetEl,
            anchorObj,
            anchorNames,
            anchorScopes,
          );
          const uuid = `--anchor-${nanoid(12)}`;
          // Store new mapping, in case inline styles have changed and will
          // be overwritten -- in which case new mappings will be re-added
          inlineStyles.set(targetEl, {
            ...(inlineStyles.get(targetEl) ?? {}),
            [anchorObj.uuid]: uuid,
          });
          // Point original uuid to new uuid
          targetEl.setAttribute(
            'style',
            `${anchorObj.uuid}: var(${uuid}); ${
              targetEl.getAttribute('style') ?? ''
            }`,
          );
          // Populate new data for each anchor/target combo
          resolvedAnchors[targetSel] = {
            ...(resolvedAnchors[targetSel] ?? {}),
            declarations: {
              ...(resolvedAnchors[targetSel]?.declarations ?? {}),
              [targetProperty]: [
                ...(resolvedAnchors[targetSel]?.declarations?.[
                  targetProperty as InsetProperty
                ] ?? []),
                { ...anchorObj, anchorEl, targetEl, uuid },
              ],
            },
          };
        }
      }
    }
  }

  return { resolvedAnchors, inlineStyles };
}
