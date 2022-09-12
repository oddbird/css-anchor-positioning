// Given CSS selectors for a floating element and an anchor element,
// returns elements that pass validation,
// or `null` if no valid anchor element is found
export function validatedForPositioning(
  floatingEl: HTMLElement | null,
  anchorSelectors: string[],
) {
  if (!floatingEl) {
    return null;
  }

  const anchorElements: NodeListOf<HTMLElement> = document.querySelectorAll(
    anchorSelectors.join(', '),
  );

  for (const anchor of anchorElements) {
    if (isValidAnchorElement(anchor, floatingEl)) {
      return anchor;
    }
  }

  return null;
}

// Validates that anchor element is a valid anchor for given floating element
export function isValidAnchorElement(
  anchor: HTMLElement,
  floating: HTMLElement,
) {
  // el has the same containing block as the querying element,
  // el is not absolutely positioned
  const anchorAbsolutelyPositioned =
    anchor?.style.position === 'absolute' ||
    getComputedStyle(anchor).position === 'absolute';

  if (
    anchorAbsolutelyPositioned &&
    anchor.offsetParent === floating.offsetParent
  ) {
    return false;
  }

  // el has a different containing block from the querying element,
  // the last containing block in el’s containing block chain
  // before reaching the querying element’s containing block
  // is not absolutely positioned
  if (anchor.offsetParent != floating.offsetParent) {
    let currentCB: HTMLElement | null;
    const anchorCBchain: HTMLElement[] = [];

    currentCB = anchor.offsetParent as HTMLElement;
    while (currentCB && currentCB != floating.offsetParent) {
      anchorCBchain.push(currentCB);
      currentCB = currentCB?.offsetParent as HTMLElement;
    }

    const lastInChain = anchorCBchain[anchorCBchain.length - 1];
    if (
      lastInChain?.style.position === 'absolute' ||
      getComputedStyle(lastInChain).position === 'absolute'
    ) {
      return false;
    }
  }

  // el is a descendant of the querying element’s containing block,
  // or the quering element’s containing block is the initial containing block
  const descendant = floating?.offsetParent?.contains(anchor);
  const floatingCBIsInitialCB = floating?.offsetParent === null;

  if (descendant || floatingCBIsInitialCB) {
    return true;
  }

  return false;
}
