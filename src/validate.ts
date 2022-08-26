/* eslint-disable no-warning-comments */

export function validatedForPositioning(
  anchorName: string,
  floatingName: string,
) {
  const floatingElement = document.querySelector(floatingName) as HTMLElement;
  const anchorElements = document.querySelectorAll(
    anchorName,
  ) as unknown as HTMLElement[];
  const validAnchors: HTMLElement[] = [];

  anchorElements.forEach((anchor: HTMLElement) => {
    if (validAnchorElement(anchor, floatingElement)) {
      validAnchors.push(anchor);
    }
  });

  return validAnchors.length
    ? { anchor: validAnchors[0], floating: floatingElement }
    : { anchor: null, floating: null };
}

export function validAnchorElement(
  anchorElement: HTMLElement,
  floatingElement: HTMLElement,
) {
  // el has the same containing block as the querying element, el is not absolutely positioned
  const anchorAbsolutelyPositioned =
    anchorElement?.style.position === 'absolute' ||
    getComputedStyle(anchorElement).position === 'aboslute';

  if (
    anchorAbsolutelyPositioned &&
    anchorElement.offsetParent === floatingElement.offsetParent
  )
    return false;

  // el has a different containing block from the querying element, the last containing block in el’s containing block chain before reaching the querying element’s containing block is not absolutely positioned
  if (anchorElement.offsetParent != floatingElement.offsetParent) {
    let currentCB: HTMLElement | null;
    const anchorCBchain: HTMLElement[] = [];

    currentCB = anchorElement.offsetParent as HTMLElement;
    while (currentCB && currentCB != floatingElement.offsetParent) {
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

  // el is a descendant of the querying element’s containing block, or the quering element’s containing block is the initial containing block
  const descendant = floatingElement?.offsetParent?.contains(anchorElement);
  const floatingCBIsInitialCB = floatingElement?.offsetParent === null;

  if (descendant || floatingCBIsInitialCB) return true;

  return false;
}

// export function validAnchorQuery(anchorQuery) {
//   return false;
// }
