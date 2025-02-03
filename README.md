# CSS Anchor Positioning Polyfill

[![Build Status](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml/badge.svg)](https://github.com/oddbird/css-anchor-positioning/actions/workflows/test.yml) [![npm version](https://badge.fury.io/js/@oddbird%2Fcss-anchor-positioning.svg)](https://www.npmjs.com/package/@oddbird/css-anchor-positioning) [![Netlify Status](https://api.netlify.com/api/v1/badges/61a20096-7925-4775-99a9-b40a010197c0/deploy-status)](https://app.netlify.com/sites/anchor-polyfill/deploys)

<!-- [WPT results](https://anchor-position-wpt.netlify.app/) -->

- [Demo](https://anchor-positioning.oddbird.net/)
- [Draft Spec](https://drafts.csswg.org/css-anchor-position/)

The CSS anchor positioning
[specification](https://drafts.csswg.org/css-anchor-position/) defines anchor
positioning, "where a positioned element can size and position itself relative
to one or more 'anchor elements' elsewhere on the page." This CSS Anchor
Positioning Polyfill supports and is based on this specification.

## Browser Support

- Firefox 54+ (includes Android)
- Chrome 51 - 124 (includes Android)
- Edge 79 - 124
- Safari 10+ (includes iOS)

Anchor positioning was added to Chrome, Chrome Android, and Edge in Chromium
125, so the polyfill will not be applied to versions after 124. Some aspects of
anchor positioning were shipped later in Chromium, meaning that they are not
polyfilled and are not present in those versions.

- `position-try-fallbacks` was added in 128 after being renamed from
  `position-try-order`. Use both `-fallbacks` and `-order` or the `position-try`
  shorthand to make sure all versions are covered.
- `position-area` was added in 129. This is also not yet implemented in the
  polyfill, so we recommend not using this yet.
- `anchor-scope` was added in 131.

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

You can view a more complete demo
[here](https://anchor-positioning.oddbird.net/).

## Configuration

The polyfill supports a small number of options. When using the default version
of the polyfill that executes automatically, options can be set by setting the
value of `window.ANCHOR_POSITIONING_POLYFILL_OPTIONS`.

```js
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    window.ANCHOR_POSITIONING_POLYFILL_OPTIONS = {
      elements: undefined,
      excludeInlineStyles: false,
      useAnimationFrame: false,
    };
    import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

When manually applying the polyfill, options can be set by passing an object as
an argument.

```js
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    const { default: polyfill } = await import("https://unpkg.com/@oddbird/css-anchor-positioning/dist/css-anchor-positioning-fn.js");

    polyfill({
      elements: undefined,
      excludeInlineStyles: false,
      useAnimationFrame: false,
    });
  }
</script>
```

### elements

type: `HTMLElements[]`, default: `undefined`

If set, the polyfill will only be applied to the specified elements instead of
to all styles. Any specified `<link>` and `<style>` elements will be polyfilled.
By default, all inline styles in the document will also be polyfilled, but if
`excludeInlineStyles` is true, only inline styles on specified elements will be
polyfilled.

### excludeInlineStyles

type: `boolean`, default: `false`

When not defined or set to `false`, the polyfill will be applied to all elements
that have eligible inline styles, regardless of whether the `elements` option is
defined. When set to `true`, elements with eligible inline styles listed in the
`elements` option will still be polyfilled, but no other elements in the
document will be implicitly polyfilled.

### useAnimationFrame

type: `boolean`, default: `false`

Determines whether anchor calculations should [update on every animation
frame](https://floating-ui.com/docs/autoUpdate#animationframe) (e.g. when the
anchor element is animated using `transform`s), in addition to always updating
on scroll/resize. While this option is optimized for performance, it should be
used sparingly.

For legacy support, this option can also be set by setting the value of
`window.UPDATE_ANCHOR_ON_ANIMATION_FRAME`, or, when applying the polyfill
manually, by passing a single boolean with `polyfill(true)`.

## Limitations

While this polyfill supports many basic use cases, it doesn't (yet) support the
following features:

- The following portions of Position Fallback:
  - `position-try-order`. If `try-size` is specified in `position-try`
    shorthand, it will be parsed, and `try-tactics` will be applied, but the
    `try-size` will be ignored.
  - The `flip-start` `try-tactic` is only partially supported. The tactic is
    only applied to property names and anchor sides.
  - a `position-area` as a `try-tactic`
  - Fallback does not support percentage anchor-side values, nor anchor
    functions that are passed through custom properties.
- Polyfill allows anchoring in scroll more permissively than the spec allows,
  for instance without a default `position-anchor`.
- `anchor-scope` property on pseudo-elements
- `position-area` property
- `anchor-center` value for `justify-self`, `align-self`, `justify-items`, and
  `align-items` properties
- automatic anchor positioning: anchor functions with `inside` or `outside`
  anchor-side
- `position-visibility` property
- dynamically added/removed anchors or targets
- anchors or targets in the shadow-dom
- anchors or targets in constructed stylesheets (https://github.com/oddbird/css-anchor-positioning/issues/228)
- anchor functions assigned to `inset-*` properties or `inset` shorthand
  property
- vertical/rtl writing-modes (partial support)
- implicit anchors or the `position-anchor: auto` keyword (pending resolution of
  https://github.com/whatwg/html/pull/9144)

In addition, JS APIs like `CSSPositionTryRule` or `CSS.supports` will not be
polyfilled.

### Inline styles

Browsers provide some validation for imperatively setting inline styles.
`el.style.color = "foo"` and `el.style.foo = "bar"` do not change the inline
styles of `el`. This is problematic for this polyfill, as we would like to
support `el.style.anchorName = "--foo"`, but that won't work in browsers that
don't support the `anchor-name` property.

While `el.setAttribute('style', 'anchor-name: --foo')` or `<div
style="anchor-name: --foo" />` both work, developers are often using tools that
generate the DOM. Both React and Vue use methods that remove the unknown inline
style properties at runtime.

If you are using inline styles to set anchor-related properties and the polyfill
isn't working, verify that the inline styles are actually showing up in the DOM.

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
