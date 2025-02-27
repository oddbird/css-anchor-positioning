import { type Block } from 'css-tree';
import { nanoid } from 'nanoid';

export type PositionAreaGridValue = 0 | 1 | 2 | 3;
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
export const POSITION_AREA_X = [
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

export const POSITION_AREA_Y = [
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

export const POSITION_AREA_BLOCK = [
  'block-start',
  'center',
  'block-end',
  'span-block-start',
  'span-block-end',
  'span-all',
] as string[];

export const POSITION_AREA_INLINE = [
  'inline-start',
  'center',
  'inline-end',
  'span-inline-start',
  'span-inline-end',
  'span-all',
] as string[];

export const POSITION_AREA_SELF_BLOCK = [
  'self-block-start',
  'center',
  'self-block-end',
  'span-self-block-start',
  'span-self-block-end',
  'span-all',
] as string[];

export const POSITION_AREA_SELF_INLINE = [
  'self-inline-start',
  'center',
  'self-inline-end',
  'span-self-inline-start',
  'span-self-inline-end',
  'span-all',
] as string[];

export const POSITION_AREA_SHORTHAND = [
  'start',
  'center',
  'end',
  'span-start',
  'span-end',
  'span-all',
] as string[];

export const POSITION_AREA_SELF_SHORTHAND = [
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
  uuid: string;
}

export function parsePositionAreaValue(
  value: string[],
  block: Block,
): PositionAreaData | undefined {
  if (value.length === 1) {
    if (axisForPositionAreaValue(value[0]) === 'ambiguous') {
      value.push(value[0]);
    } else {
      value.push('span-all');
    }
  }

  if (!isValidPositionAreaValue(value as [string, string])) return undefined;
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
  const uuid = `--anchor-position-area-${nanoid(12)}`;

  [
    'top',
    'left',
    'right',
    'bottom',
    'inline-size',
    'block-size',
    'justify-self',
    'align-self',
  ].forEach((prop) => {
    block.children.appendData({
      type: 'Declaration',
      property: prop,
      value: { type: 'Raw', value: `var(--position-area-${prop})` },
      important: false,
    });
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
    uuid,
    insets,
    alignments,
  };
}

export function applyPositionAreaInlineStyles(
  el: HTMLElement,
  uuid: string,
): void {
  const style = [
    'top',
    'left',
    'right',
    'bottom',
    'inline-size',
    'block-size',
    'justify-self',
    'align-self',
  ].reduce(
    (acc, prop) => {
      return acc + `--position-area-${prop}: var(${uuid}-${prop});`;
    },
    el.getAttribute('style') || '',
  );
  el.setAttribute('style', style);
}
