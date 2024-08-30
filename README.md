# CSS Anchor Positioning Polyfill

[![Build Status](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml/badge.svg)](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml)

[![Netlify Status](https://api.netlify.com/api/v1/badges/61a20096-7925-4775-99a9-b40a010197c0/deploy-status)](https://app.netlify.com/sites/anchor-polyfill/deploys)

<!-- [WPT results](https://anchor-position-wpt.netlify.app/) -->

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

This polyfill was implemented against an early version of the spec, and updates
were paused to allow the syntax to solidify. Now that browsers are working on
implementation, we would like to bring it up to date.

While this polyfill supports many basic use cases, it doesn't (yet) support the
following features:

- The following portions of Position Fallback:
  - `position-try-order`. If `try-size` is specified in `position-try`
    shorthand, it will be parsed, and `try-tactics` will be applied, but the
    `try-size` will be ignored.
  - The `flip-start` `try-tactic` is only partially supported. The tactic is
    only applied to property names and anchor sides.
  - a `position-area` as a `try-tactic`
  - Fallback does does not support anchor functions that are nested or passed
    through custom properties.
  - Multiple selectors for a single `position-try-fallbacks` rule that uses an
    `@position-try` rule is not supported.
- Polyfill allows anchoring in scroll more permissively than the spec allows,
  for instance without a default `position-anchor`.
- `anchor-scope` property on pseudo-elements
- `position-area` property
- `anchor-center` value for `justify-self`, `align-self`, `justify-items`, and
  `align-items` properties
- anchor functions with `implicit` anchor-element
- automatic anchor positioning: anchor functions with `inside` or `outside`
  anchor-side
- `position-visibility` property
- dynamically added/removed anchors or targets
- anchors or targets in the shadow-dom
- anchor functions assigned to `inset-*` properties or `inset` shorthand
  property
- vertical/rtl writing-modes (partial support)

In addition, JS APIs like `CSSPositionTryRule` or `CSS.supports` will not be
polyfilled.

## Sponsor OddBird's OSS Work

At OddBird, we love contributing to the languages & tools developers rely on.
We're currently working on polyfills
for new Popover & Anchor Positioning functionality,
as well as CSS specifications for functions, mixins, and responsive typography.
Help us keep this work sustainable
and centered on your needs as a developer!
We display sponsor logos and avatars
on our [website](https://www.oddbird.net/polyfill/#open-source-sponsors).

[Sponsor OddBird's OSS Work](https://github.com/sponsors/oddbird)
