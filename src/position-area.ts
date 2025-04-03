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

// Each target is wrapped with a `polyfill-position-area` element. It sets its
// inset values from `--pa-value-*` values. The `justify-self` and `align-self`
// properties are mapped on the element itself.

import { type Block, type CssNode, type Identifier } from 'css-tree';
import { type List } from 'css-tree/utils';
import { nanoid } from 'nanoid';

import { type DeclarationWithValue } from './utils.js';

// Set this value on a target as a sibling to a position area declaration. Then
// check it to determine which position area declaration should win, if there
// are multiple.
export const POSITION_AREA_CASCADE_PROPERTY = '--pa-cascade-property';

// Set this as an attribute on a wrapper with the uuid of the winning
// `POSITION_AREA_CASCADE_PROPERTY` as the value.
export const POSITION_AREA_WRAPPER_ATTRIBUTE = 'data-anchor-position-wrapper';

const WRAPPER_TARGET_ATTRIBUTE_PRELUDE = 'data-pa-wrapper-for-';
const WRAPPER_ELEMENT = 'POLYFILL-POSITION-AREA';

type PositionAreaGridValue = 0 | 1 | 2 | 3;
const POSITION_AREA_SPANS: Record<
  string,
  [PositionAreaGridValue, PositionAreaGridValue]
> = {
  left: [0, 1],
  center: [1, 2],
  right: [2, 3],
  'span-left': [0, 2],
  'span-right': [1, 3],
  'x-start': [0, 1],
  'x-end': [2, 3],
  'span-x-start': [0, 2],
  'span-x-end': [1, 3],
  'x-self-start': [0, 1],
  'x-self-end': [2, 3],
  'span-x-self-start': [0, 2],
  'span-x-self-end': [1, 3],
  'span-all': [0, 3],
  top: [0, 1],
  bottom: [2, 3],
  'span-top': [0, 2],
  'span-bottom': [1, 3],
  'y-start': [0, 1],
  'y-end': [2, 3],
  'span-y-start': [0, 2],
  'span-y-end': [1, 3],
  'y-self-start': [0, 1],
  'y-self-end': [2, 3],
  'span-y-self-start': [0, 2],
  'span-y-self-end': [1, 3],
  'block-start': [0, 1],
  'block-end': [2, 3],
  'span-block-start': [0, 2],
  'span-block-end': [1, 3],
  'inline-start': [0, 1],
  'inline-end': [2, 3],
  'span-inline-start': [0, 2],
  'span-inline-end': [1, 3],
  'self-block-start': [0, 1],
  'self-block-end': [2, 3],
  'span-self-block-start': [0, 2],
  'span-self-block-end': [1, 3],
  'self-inline-start': [0, 1],
  'self-inline-end': [2, 3],
  'span-self-inline-start': [0, 2],
  'span-self-inline-end': [1, 3],
  start: [0, 1],
  end: [2, 3],
  'span-start': [0, 2],
  'span-end': [1, 3],
  'self-start': [0, 1],
  'self-end': [2, 3],
  'span-self-start': [0, 2],
  'span-self-end': [1, 3],
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
  'x-self-start',
  'x-self-end',
  'span-x-self-start',
  'span-x-self-end',
  'span-all',
] as string[];

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
  'y-self-start',
  'y-self-end',
  'span-y-self-start',
  'span-y-self-end',
  'span-all',
] as string[];

const POSITION_AREA_BLOCK = [
  'block-start',
  'center',
  'block-end',
  'span-block-start',
  'span-block-end',
  'span-all',
] as string[];

const POSITION_AREA_INLINE = [
  'inline-start',
  'center',
  'inline-end',
  'span-inline-start',
  'span-inline-end',
  'span-all',
] as string[];

const POSITION_AREA_SELF_BLOCK = [
  'self-block-start',
  'center',
  'self-block-end',
  'span-self-block-start',
  'span-self-block-end',
  'span-all',
] as string[];

const POSITION_AREA_SELF_INLINE = [
  'self-inline-start',
  'center',
  'self-inline-end',
  'span-self-inline-start',
  'span-self-inline-end',
  'span-all',
] as string[];

const POSITION_AREA_SHORTHAND = [
  'start',
  'center',
  'end',
  'span-start',
  'span-end',
  'span-all',
] as string[];

const POSITION_AREA_SELF_SHORTHAND = [
  'self-start',
  'center',
  'self-end',
  'span-self-start',
  'span-self-end',
  'span-all',
] as string[];

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

export interface PositionAreaData {
  values: AxisInfo<string>;
  grid: AxisInfo<[PositionAreaGridValue, PositionAreaGridValue]>;
  insets: AxisInfo<[InsetValue, InsetValue]>;
  alignments: AxisInfo<'start' | 'end' | 'center'>;
  changed: boolean;
  selectorUUID: string;
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
  return value as [string, string];
}

export function getPositionAreaData(
  node: CssNode,
  block: Block | null,
): PositionAreaData | undefined {
  if (!(isPositionAreaDeclaration(node) && block)) return undefined;

  const value = parsePositionAreaValue(node);
  // If it's not a value value, we can ignore it.
  if (!isValidPositionAreaValue(value)) return undefined;

  const positionAreas = {} as AxisInfo<string>;
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

  [
    // Insets are applied to a wrapping element
    'justify-self',
    'align-self',
  ].forEach((prop) => {
    block.children.appendData({
      type: 'Declaration',
      property: prop,
      value: { type: 'Raw', value: `var(--pa-value-${prop})` },
      important: false,
    });
  });
  block.children.appendData({
    type: 'Declaration',
    property: POSITION_AREA_CASCADE_PROPERTY,
    value: { type: 'Raw', value: selectorUUID },
    important: false,
  });

  const insets = getInsets(grid);
  const alignments = {
    block: getAxisAlignment(grid.block),
    inline: getAxisAlignment(grid.inline),
  };
  return {
    values: positionAreas,
    grid,
    changed: true,
    selectorUUID,
    insets,
    alignments,
  };
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
    wrapperEl.style.position = 'absolute';
    ['top', 'left', 'right', 'bottom'].forEach((prop) => {
      wrapperEl.style.setProperty(prop, `var(--pa-value-${prop})`);
    });
    targetEl.parentElement?.insertBefore(wrapperEl, targetEl);
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

export function activeWrapperStyles(targetUUID: string, selectorUUID: string) {
  return `
    [${POSITION_AREA_WRAPPER_ATTRIBUTE}="${selectorUUID}"][${WRAPPER_TARGET_ATTRIBUTE_PRELUDE}${targetUUID}] {
      --pa-value-top: var(${targetUUID}-top);
      --pa-value-left: var(${targetUUID}-left);
      --pa-value-right: var(${targetUUID}-right);
      --pa-value-bottom: var(${targetUUID}-bottom);
      --pa-value-justify-self: var(${targetUUID}-justify-self);
      --pa-value-align-self: var(${targetUUID}-align-self);
    }
  `.replaceAll('\n', '');
}

export function cascadedWrapperStyles(selector: string, targetUUID: string) {
  return `
  :where([${WRAPPER_TARGET_ATTRIBUTE_PRELUDE}${targetUUID}]):not(${selector}){
    --pa-value-top: var(${targetUUID}-top);
    --pa-value-left: var(${targetUUID}-left);
    --pa-value-right: var(${targetUUID}-right);
    --pa-value-bottom: var(${targetUUID}-bottom);
    --pa-value-justify-self: var(${targetUUID}-justify-self);
    --pa-value-align-self: var(${targetUUID}-align-self);
}`;
}
