export {};

declare global {
  interface Window {
    UPDATE_ANCHOR_ON_ANIMATION_FRAME?: boolean;
    CHECK_LAYOUT_DELAY?: boolean;
  }
}
