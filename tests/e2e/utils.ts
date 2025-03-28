import { expect, type Locator } from '@playwright/test';

export async function expectWithinOne(
  locator: Locator,
  attr: string,
  expected: number,
  not?: boolean,
) {
  const getValue = async () => {
    const actual = await locator.evaluate(
      (node: HTMLElement, attribute: string) =>
        window.getComputedStyle(node).getPropertyValue(attribute),
      attr,
    );
    return Number(actual.slice(0, -2));
  };
  if (not) {
    return expect
      .poll(getValue, { timeout: 10 * 1000 })
      .not.toBeCloseTo(expected, 0);
  }
  return expect.poll(getValue, { timeout: 10 * 1000 }).toBeCloseTo(expected, 0);
}
