import { type AnchorPositioningPolyfillOptions } from '../polyfill.ts';

export {};

declare global {
  interface Window {
    UPDATE_ANCHOR_ON_ANIMATION_FRAME?: boolean;
    ANCHOR_POSITIONING_POLYFILL_OPTIONS?: AnchorPositioningPolyfillOptions;
    CHECK_LAYOUT_DELAY?: boolean;
  }
}
