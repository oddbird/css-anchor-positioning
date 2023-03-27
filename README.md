# CSS Anchor Positioning Polyfill

[![Build Status](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml/badge.svg)](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml)

[![Netlify Status](https://api.netlify.com/api/v1/badges/61a20096-7925-4775-99a9-b40a010197c0/deploy-status)](https://app.netlify.com/sites/anchor-polyfill/deploys)

[WPT results](https://anchor-position-wpt.netlify.app/)

## Browser Support

- Firefox 54+
- Chrome 51+
- Edge 79+
- Safari 10+

## Getting Started

To use the polyfill, add this script tag to your document `<head>`:

```js
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

You can view a more complete demo [here](https://anchor-polyfill.netlify.app/).

## Configuration

The polyfill accepts one argument (type: `boolean`, default: `false`), which
determines whether anchor calculations should [update on every animation
frame](https://floating-ui.com/docs/autoUpdate#animationframe) (e.g. when the
anchor element moves), in addition to always updating on scroll/resize. While
this option is optimized for performance, it should be used sparingly.

```js
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    const { default: polyfill } = await import("https://unpkg.com/@oddbird/css-anchor-positioning/dist/css-anchor-positioning-fn.js");

    polyfill(true);
  }
</script>
```

When using the default version of the polyfill that executes automatically, this
option can be set by setting the value of
`window.UPDATE_ANCHOR_ON_ANIMATION_FRAME`.

```js
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    window.UPDATE_ANCHOR_ON_ANIMATION_FRAME = true;
    import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

## Limitations

This polyfill doesn't (yet) support the following:

- Tracking the order of elements in the [top-layer](https://fullscreen.spec.whatwg.org/#new-stacking-layer) to invalidate top-layer target elements from anchoring to succeding top-layer anchors. See [this WPT](https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-position-top-layer-006.html) for an example.
- `anchor-default` property
- `anchor-scroll` property
- anchor functions with `implicit` anchor-element
- automatic anchor positioning: anchor functions with `auto` or `auto-same`
  anchor-side
- dynamically added/removed anchors or targets
- anchors or targets in the shadow-dom
- anchor functions assigned to `inset-*` properties or `inset` shorthand
  property
- vertical/rtl writing-modes (partial support)
- absolutely-positioned targets with `grid-column`/`grid-row`/`grid-area` in a
  CSS Grid layout
- `@position-fallback` where targets in a CSS Grid layout overflow the grid area
  but do not overflow the containing block
- `@position-fallback` where targets overflow their inset-modified containing
  block, overlapping the anchor element
- anchors in multi-column layouts
- anchor functions used as the fallback value in another anchor function
- anchor functions assigned to `bottom` or `right` properties on inline targets
  whose offset-parent is inline with `clientHeight`/`clientWidth` of `0`
  (partial support -- does not account for possible scrollbar width)
