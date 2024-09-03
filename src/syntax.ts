// Inset properties
export const INSET_PROPS = [
  'left',
  'right',
  'top',
  'bottom',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block',
  'inset-inline',
  'inset',
] as const;

export type InsetProperty = (typeof INSET_PROPS)[number];

export function isInsetProp(
  property: string | AnchorSide,
): property is InsetProperty {
  return INSET_PROPS.includes(property as InsetProperty);
}

// Margin properties
export const MARGIN_PROPERTIES = [
  'margin-block-start',
  'margin-block-end',
  'margin-block',
  'margin-inline-start',
  'margin-inline-end',
  'margin-inline',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'margin',
] as const;

export type MarginProperty = (typeof MARGIN_PROPERTIES)[number];

export function isMarginProp(property: string): property is MarginProperty {
  return MARGIN_PROPERTIES.includes(property as MarginProperty);
}

// Sizing properties
export const SIZING_PROPS = [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'block-size',
  'inline-size',
  'min-block-size',
  'min-inline-size',
  'max-block-size',
  'max-inline-size',
] as const;

export type SizingProperty = (typeof SIZING_PROPS)[number];

export function isSizingProp(property: string): property is SizingProperty {
  return SIZING_PROPS.includes(property as SizingProperty);
}

// Self Alignment Properties
export const SELF_ALIGNMENT_PROPS = [
  'justify-self',
  'align-self',
  'place-self',
] as const;

export type SelfAlignmentProperty = (typeof SELF_ALIGNMENT_PROPS)[number];

export function isSelfAlignmentProp(
  property: string,
): property is SelfAlignmentProperty {
  return SELF_ALIGNMENT_PROPS.includes(property as SelfAlignmentProperty);
}

// Accepted position try properties
export const ACCEPTED_POSITION_TRY_PROPERTIES = [
  ...INSET_PROPS,
  ...MARGIN_PROPERTIES,
  ...SIZING_PROPS,
  ...SELF_ALIGNMENT_PROPS,
  'position-anchor',
  'position-area',
] as const;

export type AcceptedPositionTryProperty =
  (typeof ACCEPTED_POSITION_TRY_PROPERTIES)[number];

// Anchor Side properties
export const ANCHOR_SIDES = [
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'self-start',
  'self-end',
  'center',
];
export type AnchorSideKeyword = (typeof ANCHOR_SIDES)[number];

export type AnchorSide = AnchorSideKeyword | number;

export function isAnchorSide(property: string): property is AnchorSideKeyword {
  return ANCHOR_SIDES.includes(property as AnchorSideKeyword);
}

// Anchor Size
export const ANCHOR_SIZES = [
  'width',
  'height',
  'block',
  'inline',
  'self-block',
  'self-inline',
] as const;

export type AnchorSize = (typeof ANCHOR_SIZES)[number];

export function isAnchorSize(property: string): property is AnchorSize {
  return ANCHOR_SIZES.includes(property as AnchorSize);
}
