// How this works:

// As we walk the AST, we parse each `position-area` declaration, and determine
// how it would be applied. We store a selectorUUID for each declaration, and
// add a custom property to the selector's block called `--pa-cascade-property`.
// When we apply the polyfill, we check the value of `--pa-cascade-property` on
// the target to determine which declaration should win and apply those rules.

// Because each declaration may apply to multiple targets, and the generated
// containing block for each target may be different, we create a targetUUID for
// each element targeted by a selector. This is the UUID that is used to
// generate the inset and alignment values in polyfill.ts that are applied to
// the root element.

// The rules are created in a new stylesheet that matches the selectorUUID that
// won the cascade and the targetUUID. This stylesheet maps the properties set
// on the root element to `--pa-value-*:`.

// By default (the `positionAreaContainingBlock` option is `true`), each target
// is wrapped with a `polyfill-position-area` element that approximates the
// containing block created by `position-area`. The wrapper sets its own inset
// values from `--pa-wrapper-*` values, and the `justify-self` and `align-self`
// properties are mapped on the target itself.

// When the `positionAreaContainingBlock` option is `false`, no wrapper element
// is added. Instead of the wrapper approximating the containing block, the
// target's position within the position-area grid area is resolved to pixel
// inset values in polyfill.ts, so the target is positioned directly.

// When the option is `'auto'`, the choice is made per target: a target whose
// styles resolve against the containing block (see
// `hasContainingBlockDependentDeclaration`) is wrapped, and any other target is
// positioned directly. Because the generated declarations are shared by every
// element matching a selector, both the wrapped (`justify-self`/`align-self`)
// and unwrapped (inset) declarations are emitted, each falling back to its
// initial value so only the relevant set takes effect per target.

import { type Block, type CssNode, type Identifier } from 'css-tree';
import { type List } from 'css-tree/utils';
import { nanoid } from 'nanoid';

import {
  getCSSPropertyValue,
  getOffsetParent,
  type PseudoElement,
} from './dom.js';
import {
  MARGIN_PROPS,
  PADDING_PROPS,
  SELF_ALIGNMENT_PROPS,
  SIZING_PROPS,
} from './syntax.js';
import {
  type DeclarationWithValue,
  INSTANCE_UUID,
  strategyForElement,
} from './utils.js';

// Set this value on a target as a sibling to a position area declaration. Then
// check it to determine which position area declaration should win, if there
// are multiple. Suffixed with `INSTANCE_UUID` so we don't squat on a custom
// property an author might be using.
export const POSITION_AREA_CASCADE_PROPERTY = `--pa-cascade-property-${INSTANCE_UUID}`;

// Names the custom property the polyfill uses to carry a resolved
// `position-area` value (e.g. `top`, `justify-self`) from the mapping
// stylesheet to the wrapper. Suffixed with `INSTANCE_UUID` so we don't squat on
// an author's custom property. Read and write sites all go through this helper
// so the names can't drift.
const paValueProperty = (prop: string) => `--pa-value-${prop}-${INSTANCE_UUID}`;

// Names the custom properties for a wrapper's insets, so a shared `auto`
// selector's target insets don't collide.
const paWrapperProperty = (prop: string) =>
  `--pa-wrapper-${prop}-${INSTANCE_UUID}`;

// The physical sides the polyfill sets as insets, on the wrapper or (in the
// unwrapped path) directly on the target. A single source of truth so the
// mapping-stylesheet writes, the `var()` reads, and the non-inheritance
// registration below can't drift out of sync.
const PA_INSET_SIDES = ['top', 'left', 'right', 'bottom'] as const;

// Custom properties the polyfill both sets on and reads from the *same* element
// -- the wrapper's insets, and (in the unwrapped path) the target's insets.
// These must be registered non-inherited: unlike
// `--pa-value-{justify,align}-self` (which are set on the wrapper and read on
// the target child, and so must inherit), an inset set on one `position-area`
// target would otherwise leak through inheritance onto a descendant that is
// itself a `position-area` target, overriding its `auto` fallback. See
// `registerShiftedProperties` in cascade.ts and
// https://github.com/oddbird/css-anchor-positioning/issues/279.
export const NON_INHERITED_POSITION_AREA_PROPERTIES = [
  ...PA_INSET_SIDES.map((side) => paValueProperty(side)),
  ...PA_INSET_SIDES.map((side) => paWrapperProperty(side)),
];

// Set this as an attribute on a wrapper with the uuid of the winning
// `POSITION_AREA_CASCADE_PROPERTY` as the value.
export const POSITION_AREA_WRAPPER_ATTRIBUTE = 'data-anchor-position-wrapper';

// Set this as an attribute on the target with the uuid of the winning
// `POSITION_AREA_CASCADE_PROPERTY` as the value, when the target is not wrapped
// (the `positionAreaContainingBlock` option is `false`, or `'auto'` and the
// target's styles don't depend on the containing block).
export const POSITION_AREA_TARGET_ATTRIBUTE = 'data-anchor-position-area';

const WRAPPER_TARGET_ATTRIBUTE_PRELUDE = 'data-pa-wrapper-for-';
const TARGET_ATTRIBUTE_PRELUDE = 'data-pa-target-for-';
const WRAPPER_ELEMENT = 'POLYFILL-POSITION-AREA';

// The `positionAreaContainingBlock` option. `true` always wraps the target,
// `false` never does, and `'auto'` wraps only targets that have styles which
// resolve against the containing block (and so need the area-sized block that
// `position-area` would natively create).
export type PositionAreaContainingBlock = boolean | 'auto';

/**
 * Whether a declaration's value resolves against the containing block, and so
 * would compute differently inside the area-sized block that `position-area`
 * creates than against the original containing block. Used by the `'auto'`
 * mode of `positionAreaContainingBlock` to decide whether a target needs the
 * wrapper element.
 *
 * The check is intentionally conservative: when in doubt it returns `true` so
 * the wrapper is kept (the always-correct behavior). Inset properties are
 * ignored because the polyfill overrides them on the target regardless.
 */
export function hasContainingBlockDependentDeclaration(
  element: HTMLElement,
): boolean {
  for (const prop of SIZING_PROPS) {
    const val = getCSSPropertyValue(element, prop);
    if (
      ['%', 'stretch', 'fit-content', '-webkit-fill-available'].some(
        (testVal) => val.includes(testVal),
      )
    ) {
      return true;
    }
  }
  for (const prop of MARGIN_PROPS) {
    const val = getCSSPropertyValue(element, prop);
    if (['%', 'auto'].some((testVal) => val.includes(testVal))) {
      return true;
    }
  }
  for (const prop of PADDING_PROPS) {
    if (getCSSPropertyValue(element, prop).includes('%')) {
      return true;
    }
  }
  for (const prop of SELF_ALIGNMENT_PROPS) {
    const val = getCSSPropertyValue(element, prop);
    if (['stretch', 'anchor-center'].some((testVal) => val.includes(testVal))) {
      return true;
    }
  }
  return false;
}

type PositionAreaGridValue = 0 | 1 | 2 | 3;

enum WritingMode {
  Logical = 'Logical',
  LogicalSelf = 'LogicalSelf',
  Physical = 'Physical',
  PhysicalSelf = 'PhysicalSelf',
  Irrelevant = 'Irrelevant',
}

export const POSITION_AREA_PROPS = [
  'left',
  'center',
  'right',
  'span-left',
  'span-right',
  'x-start',
  'x-end',
  'span-x-start',
  'span-x-end',
  'self-x-start',
  'self-x-end',
  'span-self-x-start',
  'span-self-x-end',
  'span-all',
  'top',
  'bottom',
  'span-top',
  'span-bottom',
  'y-start',
  'y-end',
  'span-y-start',
  'span-y-end',
  'self-y-start',
  'self-y-end',
  'span-self-y-start',
  'span-self-y-end',
  'block-start',
  'block-end',
  'span-block-start',
  'span-block-end',
  'inline-start',
  'inline-end',
  'span-inline-start',
  'span-inline-end',
  'self-block-start',
  'self-block-end',
  'span-self-block-start',
  'span-self-block-end',
  'self-inline-start',
  'self-inline-end',
  'span-self-inline-start',
  'span-self-inline-end',
  'start',
  'end',
  'span-start',
  'span-end',
  'self-start',
  'self-end',
  'span-self-start',
  'span-self-end',
] as const;

export type PositionAreaProperty = (typeof POSITION_AREA_PROPS)[number];

export function isPositionAreaProp(
  property: string | PositionAreaProperty,
): property is PositionAreaProperty {
  return POSITION_AREA_PROPS.includes(property as PositionAreaProperty);
}
const POSITION_AREA_SPANS: Record<
  PositionAreaProperty,
  [PositionAreaGridValue, PositionAreaGridValue, WritingMode]
> = {
  left: [0, 1, WritingMode.Irrelevant],
  center: [1, 2, WritingMode.Irrelevant],
  right: [2, 3, WritingMode.Irrelevant],
  'span-left': [0, 2, WritingMode.Irrelevant],
  'span-right': [1, 3, WritingMode.Irrelevant],
  'x-start': [0, 1, WritingMode.Physical],
  'x-end': [2, 3, WritingMode.Physical],
  'span-x-start': [0, 2, WritingMode.Physical],
  'span-x-end': [1, 3, WritingMode.Physical],
  'self-x-start': [0, 1, WritingMode.PhysicalSelf],
  'self-x-end': [2, 3, WritingMode.PhysicalSelf],
  'span-self-x-start': [0, 2, WritingMode.PhysicalSelf],
  'span-self-x-end': [1, 3, WritingMode.PhysicalSelf],
  'span-all': [0, 3, WritingMode.Irrelevant],
  top: [0, 1, WritingMode.Irrelevant],
  bottom: [2, 3, WritingMode.Irrelevant],
  'span-top': [0, 2, WritingMode.Irrelevant],
  'span-bottom': [1, 3, WritingMode.Irrelevant],
  'y-start': [0, 1, WritingMode.Physical],
  'y-end': [2, 3, WritingMode.Physical],
  'span-y-start': [0, 2, WritingMode.Physical],
  'span-y-end': [1, 3, WritingMode.Physical],
  'self-y-start': [0, 1, WritingMode.PhysicalSelf],
  'self-y-end': [2, 3, WritingMode.PhysicalSelf],
  'span-self-y-start': [0, 2, WritingMode.PhysicalSelf],
  'span-self-y-end': [1, 3, WritingMode.PhysicalSelf],
  'block-start': [0, 1, WritingMode.Logical],
  'block-end': [2, 3, WritingMode.Logical],
  'span-block-start': [0, 2, WritingMode.Logical],
  'span-block-end': [1, 3, WritingMode.Logical],
  'inline-start': [0, 1, WritingMode.Logical],
  'inline-end': [2, 3, WritingMode.Logical],
  'span-inline-start': [0, 2, WritingMode.Logical],
  'span-inline-end': [1, 3, WritingMode.Logical],
  'self-block-start': [0, 1, WritingMode.LogicalSelf],
  'self-block-end': [2, 3, WritingMode.LogicalSelf],
  'span-self-block-start': [0, 2, WritingMode.LogicalSelf],
  'span-self-block-end': [1, 3, WritingMode.LogicalSelf],
  'self-inline-start': [0, 1, WritingMode.LogicalSelf],
  'self-inline-end': [2, 3, WritingMode.LogicalSelf],
  'span-self-inline-start': [0, 2, WritingMode.LogicalSelf],
  'span-self-inline-end': [1, 3, WritingMode.LogicalSelf],
  start: [0, 1, WritingMode.Logical],
  end: [2, 3, WritingMode.Logical],
  'span-start': [0, 2, WritingMode.Logical],
  'span-end': [1, 3, WritingMode.Logical],
  'self-start': [0, 1, WritingMode.LogicalSelf],
  'self-end': [2, 3, WritingMode.LogicalSelf],
  'span-self-start': [0, 2, WritingMode.LogicalSelf],
  'span-self-end': [1, 3, WritingMode.LogicalSelf],
};
const POSITION_AREA_X = [
  'left',
  'center',
  'right',
  'span-left',
  'span-right',
  'x-start',
  'x-end',
  'span-x-start',
  'span-x-end',
  'self-x-start',
  'self-x-end',
  'span-self-x-start',
  'span-self-x-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_Y = [
  'top',
  'center',
  'bottom',
  'span-top',
  'span-bottom',
  'y-start',
  'y-end',
  'span-y-start',
  'span-y-end',
  'self-y-start',
  'self-y-end',
  'span-self-y-start',
  'span-self-y-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_BLOCK = [
  'block-start',
  'center',
  'block-end',
  'span-block-start',
  'span-block-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_INLINE = [
  'inline-start',
  'center',
  'inline-end',
  'span-inline-start',
  'span-inline-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_SELF_BLOCK = [
  'self-block-start',
  'center',
  'self-block-end',
  'span-self-block-start',
  'span-self-block-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_SELF_INLINE = [
  'self-inline-start',
  'center',
  'self-inline-end',
  'span-self-inline-start',
  'span-self-inline-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_SHORTHAND = [
  'start',
  'center',
  'end',
  'span-start',
  'span-end',
  'span-all',
] as PositionAreaProperty[];

const POSITION_AREA_SELF_SHORTHAND = [
  'self-start',
  'center',
  'self-end',
  'span-self-start',
  'span-self-end',
  'span-all',
] as PositionAreaProperty[];

export type PositionAreaX = (typeof POSITION_AREA_X)[number];
export type PositionAreaY = (typeof POSITION_AREA_Y)[number];
export type PositionAreaBlock = (typeof POSITION_AREA_BLOCK)[number];
export type PositionAreaInline = (typeof POSITION_AREA_INLINE)[number];
export type PositionAreaSelfBlock = (typeof POSITION_AREA_SELF_BLOCK)[number];
export type PositionAreaSelfInline = (typeof POSITION_AREA_SELF_INLINE)[number];
export type PositionAreaShorthand = (typeof POSITION_AREA_SHORTHAND)[number];
export type PositionAreaSelfShorthand =
  (typeof POSITION_AREA_SELF_SHORTHAND)[number];

const BLOCK_KEYWORDS = ['block', 'top', 'bottom', 'y'];
const INLINE_KEYWORDS = ['inline', 'left', 'right', 'x'];

export function axisForPositionAreaValue(
  value: string,
): 'block' | 'inline' | 'ambiguous' {
  const parts = value.split('-');
  for (const part of parts) {
    if (BLOCK_KEYWORDS.includes(part)) return 'block';
    if (INLINE_KEYWORDS.includes(part)) return 'inline';
  }
  return 'ambiguous';
}

function isValidPositionAreaPair(
  value: [string, string],
  options: [string[], string[]],
): boolean {
  return (
    (options[0].includes(value[0]) && options[1].includes(value[1])) ||
    (options[0].includes(value[1]) && options[1].includes(value[0]))
  );
}

const validPairs: [string[], string[]][] = [
  [POSITION_AREA_X, POSITION_AREA_Y],
  [POSITION_AREA_BLOCK, POSITION_AREA_INLINE],
  [POSITION_AREA_SELF_BLOCK, POSITION_AREA_SELF_INLINE],
  [POSITION_AREA_SHORTHAND, POSITION_AREA_SHORTHAND],
  [POSITION_AREA_SELF_SHORTHAND, POSITION_AREA_SELF_SHORTHAND],
];
function isValidPositionAreaValue(value: [string, string]): boolean {
  for (const pair of validPairs) {
    if (isValidPositionAreaPair(value, pair)) return true;
  }
  return false;
}

export type InsetValue = 0 | 'top' | 'bottom' | 'left' | 'right';

const getDirectionalStyles = (el: HTMLElement) => {
  const styles = getComputedStyle(el);
  return {
    writingMode: styles.writingMode,
    direction: styles.direction,
  };
};

const getWritingMode = async (el: HTMLElement, type: WritingMode) => {
  const offsetParent = await getOffsetParent(el);
  switch (type) {
    case WritingMode.Logical:
    case WritingMode.Physical:
      return getDirectionalStyles(offsetParent);
    case WritingMode.LogicalSelf:
    case WritingMode.PhysicalSelf:
      return getDirectionalStyles(el);
    default:
      return null;
  }
};

const flipValues = (
  values: [PositionAreaGridValue, PositionAreaGridValue],
): [PositionAreaGridValue, PositionAreaGridValue] => {
  return values.reverse().map((value) => 3 - value) as [
    PositionAreaGridValue,
    PositionAreaGridValue,
  ];
};

// Validation ensures that there is only one non-Irrelevant writing mode
const getRelevantWritingMode = (block: WritingMode, inline: WritingMode) => {
  return block === WritingMode.Irrelevant ? inline : block;
};

const getWritingModeModifiedGrid = async (
  {
    block,
    inline,
  }: {
    block: [PositionAreaGridValue, PositionAreaGridValue, WritingMode];
    inline: [PositionAreaGridValue, PositionAreaGridValue, WritingMode];
  },
  targetElement: HTMLElement,
) => {
  const relevantWritingMode = getRelevantWritingMode(block[2], inline[2]);

  const writingMode = await getWritingMode(targetElement, relevantWritingMode);

  const grid = {
    block: [block[0], block[1]],
    inline: [inline[0], inline[1]],
  } as AxisInfo<[PositionAreaGridValue, PositionAreaGridValue]>;

  if (writingMode) {
    if (writingMode.direction === 'rtl') {
      grid.inline = flipValues(grid.inline);
    }
    if (writingMode.writingMode.startsWith('vertical')) {
      const temp = grid.block;
      grid.block = grid.inline;
      grid.inline = temp;
    }
    if (writingMode.writingMode.startsWith('sideways')) {
      const temp = grid.block;
      grid.block = grid.inline;
      grid.inline = temp;
      if (writingMode.writingMode.endsWith('lr')) {
        grid.block = flipValues(grid.block);
      }
    }
    if (writingMode.writingMode.endsWith('rl')) {
      grid.inline = flipValues(grid.inline);
    }
  }

  return grid;
};

// This function approximates setting the containing block.
const getInsets = ({
  block,
  inline,
}: {
  block: [PositionAreaGridValue, PositionAreaGridValue];
  inline: [PositionAreaGridValue, PositionAreaGridValue];
}) => {
  // Or should these be abstracted to CB_LEFT, CB_RIGHT, etc?
  const blockValues: InsetValue[] = [0, 'top', 'bottom', 0];
  const inlineValues: InsetValue[] = [0, 'left', 'right', 0];

  return {
    block: [blockValues[block[0]], blockValues[block[1]]] as [
      InsetValue,
      InsetValue,
    ],
    inline: [inlineValues[inline[0]], inlineValues[inline[1]]] as [
      InsetValue,
      InsetValue,
    ],
  };
};

function getAxisAlignment([start, end]: [
  PositionAreaGridValue,
  PositionAreaGridValue,
]): 'start' | 'end' | 'center' {
  if (start === 0 && end === 3) return 'center';
  if (start === 0) return 'end';
  if (end === 3) return 'start';
  return 'center';
}

interface AxisInfo<T> {
  block: T;
  inline: T;
}

export interface PositionAreaDeclaration {
  values: AxisInfo<string>;
  grid: AxisInfo<[PositionAreaGridValue, PositionAreaGridValue, WritingMode]>;
  selectorUUID: string;
}

export interface PositionAreaData {
  values: AxisInfo<string>;
  grid: AxisInfo<[PositionAreaGridValue, PositionAreaGridValue]>;
  insets: AxisInfo<[InsetValue, InsetValue]>;
  alignments: AxisInfo<'start' | 'end' | 'center'>;
  changed: boolean;
  selectorUUID: string;
}

// Once we have a target, we can determine values based on the writing mode.
export interface PositionAreaTargetData {
  values: AxisInfo<string>;
  grid: AxisInfo<[PositionAreaGridValue, PositionAreaGridValue, WritingMode]>;
  insets: AxisInfo<[InsetValue, InsetValue]>;
  alignments: AxisInfo<'start' | 'end' | 'center'>;
  selectorUUID: string;
  targetUUID: string;
  anchorEl: HTMLElement | PseudoElement | null;
  // Present only when the target is wrapped (see `positionAreaContainingBlock`).
  wrapperEl?: HTMLElement;
  targetEl: HTMLElement;
}

function isPositionAreaDeclaration(
  node: CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-area';
}

function parsePositionAreaValue(node: DeclarationWithValue) {
  const value = (node.value.children as List<Identifier>)
    .toArray()
    .map(({ name }) => name);
  if (value.length === 1) {
    if (axisForPositionAreaValue(value[0]) === 'ambiguous') {
      value.push(value[0]);
    } else {
      value.push('span-all');
    }
  }
  return value as [PositionAreaProperty, PositionAreaProperty];
}

export function getPositionAreaDeclaration(
  node: CssNode,
): PositionAreaDeclaration | undefined {
  if (!isPositionAreaDeclaration(node)) return undefined;

  const value = parsePositionAreaValue(node);
  // If it's not a valid value, we can ignore it.
  if (!isValidPositionAreaValue(value)) return undefined;

  const positionAreas = {} as AxisInfo<PositionAreaProperty>;
  switch (axisForPositionAreaValue(value[0])) {
    case 'block':
      positionAreas.block = value[0];
      positionAreas.inline = value[1];
      break;
    case 'inline':
      positionAreas.inline = value[0];
      positionAreas.block = value[1];
      break;
    case 'ambiguous':
      if (axisForPositionAreaValue(value[1]) == 'block') {
        positionAreas.block = value[1];
        positionAreas.inline = value[0];
      } else {
        positionAreas.inline = value[1];
        positionAreas.block = value[0];
      }
      break;
  }
  const grid = {
    block: POSITION_AREA_SPANS[positionAreas.block],
    inline: POSITION_AREA_SPANS[positionAreas.inline],
  };

  const selectorUUID = `--pa-declaration-${nanoid(12)}`;

  return {
    values: positionAreas,
    grid,
    selectorUUID,
  };
}

export function addPositionAreaDeclarationBlockStyles(
  declaration: PositionAreaDeclaration,
  block: Block,
  positionAreaContainingBlock: PositionAreaContainingBlock = true,
) {
  const appendDeclaration = (property: string, value: string) => {
    block.children.appendData({
      type: 'Declaration',
      property,
      value: { type: 'Raw', value },
      important: false,
    });
  };

  if (positionAreaContainingBlock === 'auto') {
    // The decision to wrap is made per target, but these declarations are
    // shared by every element matching the selector. Emit both the wrapped
    // (alignment) and unwrapped (inset) declarations, each with a fallback to
    // its initial value. A wrapped target only receives the alignment values
    // (the insets fall back to `auto`); a directly-positioned target only
    // receives the inset values (the alignments fall back to `normal`).
    appendDeclaration(
      'justify-self',
      `var(${paValueProperty('justify-self')}, normal)`,
    );
    appendDeclaration(
      'align-self',
      `var(${paValueProperty('align-self')}, normal)`,
    );
    PA_INSET_SIDES.forEach((prop) =>
      appendDeclaration(prop, `var(${paValueProperty(prop)}, auto)`),
    );
  } else {
    const props = positionAreaContainingBlock
      ? // Insets are applied to a wrapping element
        ['justify-self', 'align-self']
      : // Insets are applied to the target itself
        [...PA_INSET_SIDES];
    props.forEach((prop) =>
      appendDeclaration(prop, `var(${paValueProperty(prop)})`),
    );
  }
  appendDeclaration(POSITION_AREA_CASCADE_PROPERTY, declaration.selectorUUID);
}

export function wrapperForPositionedElement(
  targetEl: HTMLElement,
  targetUUID: string,
): HTMLElement {
  let wrapperEl: HTMLElement;
  if (targetEl.parentElement?.tagName === WRAPPER_ELEMENT) {
    wrapperEl = targetEl.parentElement as HTMLElement;
  } else {
    wrapperEl = document.createElement(WRAPPER_ELEMENT);
    wrapperEl.style.display = 'grid';
    wrapperEl.style.position = strategyForElement(targetEl);

    // The wrapper should not receive pointer events, but the target's initial
    // `pointer-events` value should be preserved.
    const originalPointerEvents = getComputedStyle(targetEl).pointerEvents;
    wrapperEl.style.pointerEvents = 'none';
    targetEl.style.pointerEvents = originalPointerEvents;

    // When a popover is shown it is promoted to the top layer, so its
    // containing block becomes the viewport rather than this wrapper. That means
    // any non-`auto` `inset` on the popover — the UA stylesheet's `inset: 0`, or
    // an author value such as `inset: 10px` — pins it to the viewport instead of
    // letting it take its place inside the wrapper's grid cell. Strip the inset
    // off the target so the wrapper drives positioning, and re-apply any author
    // offset as padding on the wrapper. Because the wrapper represents the
    // `position-area` cell and the target is aligned within it, padding shrinks
    // the cell and offsets the target inward — matching `inset` semantics. Non-popover
    // targets stay in this wrapper's containing block, so their own `inset`
    // already works and is left untouched.
    if (targetEl.hasAttribute('popover')) {
      const targetStyles = getComputedStyle(targetEl);
      // Logical insets can also be retrieved via their physical equivalents, so
      // we don't need to loop through those as well.
      (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
        const value = targetStyles[side];
        if (value && value !== 'auto' && parseFloat(value) !== 0) {
          wrapperEl.style.setProperty(`padding-${side}`, value);
        }
      });
      targetEl.style.inset = 'auto';
    }

    // The wrapper's own insets use a dedicated custom property namespace. In
    // `'auto'` mode the (shared) target rule reads `--pa-value-*` for its insets
    // with an `auto` fallback; using `--pa-wrapper-*` here keeps the wrapper's
    // inset values from being inherited by the target as its own insets.
    PA_INSET_SIDES.forEach((prop) => {
      wrapperEl.style.setProperty(prop, `var(${paWrapperProperty(prop)})`);
    });
    // Insert the wrapper relative to the target itself rather than going
    // through its parent: when `targetEl` sits directly inside a shadow root,
    // `parentElement` is `null` (a `ShadowRoot` is a `Node`, not an `Element`),
    // which would skip the insert while still appending the target to the
    // wrapper — detaching it from the DOM entirely.
    targetEl.insertAdjacentElement('beforebegin', wrapperEl);
    wrapperEl.appendChild(targetEl);
  }
  // Wrapper can be be reused by multiple declarations, so set all as boolean
  // attributes instead of values.
  wrapperEl.setAttribute(
    `${WRAPPER_TARGET_ATTRIBUTE_PRELUDE}${targetUUID}`,
    '',
  );

  return wrapperEl;
}

export function markPositionAreaTarget(
  targetEl: HTMLElement,
  targetUUID: string,
) {
  // A target can be affected by multiple declarations, so set each targetUUID
  // as a boolean attribute instead of a value.
  targetEl.setAttribute(`${TARGET_ATTRIBUTE_PRELUDE}${targetUUID}`, '');
}

export async function dataForPositionAreaTarget(
  targetEl: HTMLElement,
  positionAreaData: PositionAreaDeclaration,
  anchorEl: HTMLElement | PseudoElement | null,
  wrap = true,
): Promise<PositionAreaTargetData> {
  const targetUUID = `--pa-target-${nanoid(12)}`;
  const writingModeModifiedGrid = await getWritingModeModifiedGrid(
    positionAreaData.grid,
    targetEl,
  );
  const insets = getInsets(writingModeModifiedGrid);

  let alignmentGrid;
  if (wrap) {
    // The wrapper inherits the writing mode of the containing block, so
    // logical alignment values are resolved natively by CSS. Only `self`
    // writing modes (based on the target's own writing mode) need the
    // writing-mode-modified grid.
    const relevantWritingMode = getRelevantWritingMode(
      positionAreaData.grid.block[2],
      positionAreaData.grid.inline[2],
    );
    alignmentGrid = [
      WritingMode.LogicalSelf,
      WritingMode.PhysicalSelf,
    ].includes(relevantWritingMode)
      ? writingModeModifiedGrid
      : positionAreaData.grid;
  } else {
    // Alignments are resolved to physical inset values in polyfill.ts, so
    // they are always based on the writing-mode-modified (physical) grid,
    // like the insets.
    alignmentGrid = writingModeModifiedGrid;
  }
  const alignments = {
    block: getAxisAlignment([alignmentGrid.block[0], alignmentGrid.block[1]]),
    inline: getAxisAlignment([
      alignmentGrid.inline[0],
      alignmentGrid.inline[1],
    ]),
  };

  let wrapperEl;
  if (wrap) {
    wrapperEl = wrapperForPositionedElement(targetEl, targetUUID);
  } else {
    markPositionAreaTarget(targetEl, targetUUID);
  }

  return {
    insets,
    alignments,
    targetUUID,
    targetEl,
    anchorEl,
    wrapperEl,
    values: positionAreaData.values,
    grid: positionAreaData.grid,
    selectorUUID: positionAreaData.selectorUUID,
  };
}

export function activeWrapperStyles(targetUUID: string, selectorUUID: string) {
  const insets = PA_INSET_SIDES.map(
    (side) => `${paWrapperProperty(side)}: var(${targetUUID}-${side});`,
  ).join('\n      ');
  return `
    [${POSITION_AREA_WRAPPER_ATTRIBUTE}="${selectorUUID}"][${WRAPPER_TARGET_ATTRIBUTE_PRELUDE}${targetUUID}] {
      ${insets}
      ${paValueProperty('justify-self')}: var(${targetUUID}-justify-self);
      ${paValueProperty('align-self')}: var(${targetUUID}-align-self);
    }
  `.replaceAll('\n', '');
}

export function activeTargetStyles(targetUUID: string, selectorUUID: string) {
  const insets = PA_INSET_SIDES.map(
    (side) => `${paValueProperty(side)}: var(${targetUUID}-${side});`,
  ).join('\n      ');
  return `
    [${POSITION_AREA_TARGET_ATTRIBUTE}="${selectorUUID}"][${TARGET_ATTRIBUTE_PRELUDE}${targetUUID}] {
      ${insets}
    }
  `.replaceAll('\n', '');
}
