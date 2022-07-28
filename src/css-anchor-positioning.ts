import { PositionFallbackRulesMap } from "./parsing";

export function fetchCSS(path: string) {
  // TODO - get link element to stylesheet, get URL, fetch contents
}

export function transformCSS(positionFallbackRules: PositionFallbackRulesMap) {
  // for each position fallback set, get the anchor and floating element for that set
  // call floating-ui's compute position (fallback rules go in middleware)
  // remove anchor-positioning spec CSS (anchor() and @position-fallback and @try) from CSS
}
