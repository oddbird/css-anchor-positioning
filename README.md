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

## Limitations

This polyfill doesn't (yet) support the following:

- top layer anchor elements
- `anchor-default` property
- `anchor-scroll` property
- anchor functions with `implicit` anchor-element
- automatic anchor positioning: anchor functions with `auto` or `auto-same`
  anchor-side
- dynamic anchor movement other than container resize/scroll
  ([#73](https://github.com/oddbird/css-anchor-positioning/issues/73))
- dynamically added/removed anchors or targets
- anchors or targets in the shadow-dom
- anchor functions assigned to `inset-*` properties or `inset` shorthand
  property
- vertical/rtl writing-modes (partial support)
- absolutely-positioned targets with `grid-column`/`grid-row`/`grid-area` in a
  CSS Grid layout
- `@position-fallback` where targets overflow the grid area but do not overflow
  the containing block
- `@position-fallback` where targets overflow their inset-modified containing
  block, overlapping the anchor element
- anchors in multi-column layouts
- anchor functions used as the fallback value for another anchor function
- anchor functions assigned to `bottom` or `right` properties on inline targets
  whose offset-parent is inline with `clientHeight`/`clientWidth` of `0`
  (partial support -- does not account for possible scrollbar width)
