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

If you want to manually apply the polyfill, you can instead import the
`polyfill` function directly from the
`@oddbird/css-anchor-positioning/dist/css-anchor-positioning-fn.js` file.

For build tools such as Vite, Webpack, and Parcel, that will look like this:

```js
import polyfill from '@oddbird/css-anchor-positioning/fn';
```

The `polyfill` function returns a promise that resolves when the polyfill has
been applied.

You can view a more complete demo [here](https://anchor-polyfill.netlify.app/).

## Configuration

The polyfill accepts one argument (type: `boolean`, default: `false`), which
determines whether anchor calculations should [update on every animation
frame](https://floating-ui.com/docs/autoUpdate#animationframe) (e.g. when the
anchor element is animated using `transform`s), in addition to always updating
on scroll/resize. While this option is optimized for performance, it should be
used sparingly.

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

- `anchor-default` property
- `anchor-scroll` property
- anchor functions with `implicit` anchor-element
- automatic anchor positioning: anchor functions with `auto` or `auto-same`
  anchor-side
- dynamically added/removed anchors or targets
- anchors or targets in the shadow-dom
- tracking the order of elements in the
  [top-layer](https://fullscreen.spec.whatwg.org/#new-stacking-layer) to
  invalidate top-layer target elements from anchoring to succeeding top-layer
  anchors. See [this
  WPT](https://github.com/web-platform-tests/wpt/blob/master/css/css-anchor-position/anchor-position-top-layer-006.html)
  for an example.
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

## Sponsor OddBird's OSS Work

At OddBird, we love contributing to the languages & tools developers rely on. 
We're currently working on polyfills 
for new Popover & Anchor Positioning functionality, 
as well as CSS specifications for functions, mixins, and responsive typography. 
Help us keep this work sustainable 
and centered on your needs as a developer! 
We display sponsor logos and avatars 
on our [website](https://www.oddbird.net/polyfill/#popover-polyfill).

[Sponsor OddBird's OSS Work](https://opencollective.com/oddbird-open-source)
