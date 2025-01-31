export const POSITION_AREA_X = [
  'left', 'center', 'right', 'span-left', 'span-right',
  'x-start', 'x-end', 'span-x-start', 'span-x-end',
  'x-self-start', 'x-self-end', 'span-x-self-start', 'span-x-self-end',
  'span-all'
] as const;

export const POSITION_AREA_Y = [
  'top', 'center', 'bottom', 'span-top', 'span-bottom',
  'y-start', 'y-end', 'span-y-start', 'span-y-end',
  'y-self-start', 'y-self-end', 'span-y-self-start', 'span-y-self-end',
  'span-all'
] as const;

export const POSITION_AREA_BLOCK = [
  'block-start', 'center', 'block-end', 'span-block-start', 'span-block-end', 'span-all'
] as const;

export const POSITION_AREA_INLINE = [
  'inline-start', 'center', 'inline-end', 'span-inline-start', 'span-inline-end', 'span-all'
] as const;

export const POSITION_AREA_SELF_BLOCK = [
  'self-block-start', 'center', 'self-block-end', 'span-self-block-start', 'span-self-block-end', 'span-all'
] as const;

export const POSITION_AREA_SELF_INLINE = [
  'self-inline-start', 'center', 'self-inline-end', 'span-self-inline-start', 'span-self-inline-end', 'span-all'
] as const;

export const POSITION_AREA_SHORTHAND = [
  'start', 'center', 'end', 'span-start', 'span-end', 'span-all'
] as const;

export const POSITION_AREA_SELF_SHORTHAND = [
  'self-start', 'center', 'self-end', 'span-self-start', 'span-self-end', 'span-all'
] as const;

export type PositionAreaX = (typeof POSITION_AREA_X)[number];
export type PositionAreaY = (typeof POSITION_AREA_Y)[number];
export type PositionAreaBlock = (typeof POSITION_AREA_BLOCK)[number];
export type PositionAreaInline = (typeof POSITION_AREA_INLINE)[number];
export type PositionAreaSelfBlock = (typeof POSITION_AREA_SELF_BLOCK)[number];
export type PositionAreaSelfInline = (typeof POSITION_AREA_SELF_INLINE)[number];
export type PositionAreaShorthand = (typeof POSITION_AREA_SHORTHAND)[number];
export type PositionAreaSelfShorthand = (typeof POSITION_AREA_SELF_SHORTHAND)[number];

const BLOCK_KEYWORDS = ['block', 'top', 'bottom', 'y'];
const INLINE_KEYWORDS = ['inline', 'left', 'right', 'x'];

export function axisForPositionAreaValue(value: string): 'block' | 'inline' | 'ambiguous' {
  const parts = value.split('-');
  for (const part of parts) {
    if (BLOCK_KEYWORDS.includes(part)) return 'block';
    if (INLINE_KEYWORDS.includes(part)) return 'inline';
  }
  return 'ambiguous';
}

export function parsePositionAreaValue(value: string[]): {block: string, inline: string} | undefined {
  if(value.length === 1){
    if(axisForPositionAreaValue(value[0]) === 'ambiguous'){
      value.push(value[0]);
    } else {
      value.push('span-all');
    }
  }
  return undefined
}