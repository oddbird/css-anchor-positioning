export {};

declare global {
  interface AnchorPositioningPolyfillOptions {
    // Whether to use `requestAnimationFrame()` when updating target elements’
    // positions
    useAnimationFrame?: boolean;

    // An array of explicitly targeted elements to polyfill
    elements?: HTMLElement[];

    // Whether to exclude elements with eligible inline styles. When not defined
    // or set to `false`, the polyfill will be applied to all elements that have
    // eligible inline styles, regardless of whether the `elements` option is
    // defined. When set to `true`, elements with eligible inline styles listed
    // in the `elements` option will still be polyfilled, but no other elements
    // in the document will be implicitly polyfilled.
    excludeInlineStyles?: boolean;
  }

  interface Window {
    UPDATE_ANCHOR_ON_ANIMATION_FRAME?: boolean;
    ANCHOR_POSITIONING_POLYFILL_OPTIONS?: AnchorPositioningPolyfillOptions;
    CHECK_LAYOUT_DELAY?: boolean;
  }
}
