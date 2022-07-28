import {
  parseCSS,
  parseAnchorFunctions,
  parsePositionFallback,
  fetchCSS,
} from "../src/css-anchor-positioning";
import { sampleAnchorCSS } from "./helpers";

const cssWithoutAnchorPositioning = ".a { color: red; } .b { color: green; }";

describe("fetch stylesheet", () => {
  it("fetches CSS", () => {
    const result = fetchCSS();
    console.log(result);
    expect( result).toBeTruthy();
  })
})


describe("parse stylesheet", () => {
  it("parses and finds @position-fallback at-rule", () => {
    const result = parsePositionFallback(sampleAnchorCSS);
    expect(result).toBeTruthy();
  });

  it("parses and finds anchor() function", () => {
    const result = parseAnchorFunctions(sampleAnchorCSS);
    expect(result).toBeTruthy();
  });

  it("parses and finds @position-fallback at-rule and anchor() function", () => {
    const result = parseCSS(sampleAnchorCSS);
    expect(result).toBeTruthy();
  });

  it("does not find @position-fallback at-rule or anchor() function", () => {
    const result = parseCSS(cssWithoutAnchorPositioning);
    expect(result).toBeFalsy();
  });

  it("can collect @position-fallback values to transform", () => {
    const result = parseCSS(sampleAnchorCSS);
    expect(result).toBe("123");
  });

  it("can collect anchor() values to transform", () => {
    const result = parseCSS(sampleAnchorCSS);
    expect(result).toBe("123");
  });

  it("can return all necessary anchor() and @position-fallback values to transform", () => {
    const result = parseCSS(sampleAnchorCSS);
    expect(result).toBe("123");
  });
});
