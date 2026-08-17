// This is a compiled module rather than an ambient `.d.ts`, so that `tsc`
// emits it to `dist/` and the entry points can pull it in with a side-effect
// import — otherwise these `Window` properties would be missing for consumers.
import { type AnchorPositioningPolyfillOptions } from './polyfill.js';

export {};

declare global {
  interface Window {
    UPDATE_ANCHOR_ON_ANIMATION_FRAME?: boolean;
    ANCHOR_POSITIONING_POLYFILL_OPTIONS?: AnchorPositioningPolyfillOptions;
    CHECK_LAYOUT_DELAY?: boolean;
  }
}
