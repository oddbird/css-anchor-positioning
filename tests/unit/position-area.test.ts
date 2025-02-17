import type { Rule, StyleSheet } from 'css-tree';

import {
  axisForPositionAreaValue,
  parsePositionAreaValue,
} from '../../src/position-area.js';
import { getAST } from '../../src/utils.js';

const createBlock = (input = 'a{b:c}') => {
  const css = getAST(input) as StyleSheet;
  return (css.children.first! as Rule).block;
};

describe('position-area', () => {
  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  describe('axisForPositionAreaValue', () => {
    it.each([
      ['block-start', 'block'],
      ['block-end', 'block'],
      ['top', 'block'],
      ['span-top', 'block'],
      ['span-self-block-end', 'block'],
      ['left', 'inline'],
      ['span-right', 'inline'],
      ['span-x-self-start', 'inline'],
      ['center', 'ambiguous'],
      ['span-all', 'ambiguous'],
      ['start', 'ambiguous'],
      ['end', 'ambiguous'],
      ['span-end', 'ambiguous'],
      ['self-span-start', 'ambiguous'],
    ])('%s as %s', (input, expected) => {
      expect(axisForPositionAreaValue(input)).toBe(expected);
    });
  });
  describe('parsePositionAreaValue', () => {
    // Valid cases
    it.each([
      [['left', 'bottom'], { block: 'bottom', inline: 'left' }],
      [['bottom', 'left'], { block: 'bottom', inline: 'left' }],
      [['x-start', 'y-end'], { block: 'y-end', inline: 'x-start' }],
    ])('%s parses', (input, expected) => {
      expect(
        parsePositionAreaValue(input, createBlock())?.values,
      ).toMatchObject(expected);
    });

    // With ambiguous values
    it.each([
      [['left', 'center'], { block: 'center', inline: 'left' }],
      [['center', 'left'], { block: 'center', inline: 'left' }],
      [['span-all', 'y-end'], { block: 'y-end', inline: 'span-all' }],
    ])('%s parses values', (input, expected) => {
      expect(
        parsePositionAreaValue(input, createBlock())?.values,
      ).toMatchObject(expected);
    });
    it.each([
      [['left', 'center'], { block: [1, 2], inline: [0, 1] }],
      [['center', 'left'], { block: [1, 2], inline: [0, 1] }],
      [['span-all', 'y-end'], { block: [2, 3], inline: [0, 3] }],
    ])('%s parses grid', (input, expected) => {
      expect(parsePositionAreaValue(input, createBlock())?.grid).toMatchObject(
        expected,
      );
    });

    // With single values
    it.each([
      [['top'], { block: 'top', inline: 'span-all' }],
      [['center'], { block: 'center', inline: 'center' }],
      [['start'], { block: 'start', inline: 'start' }],
      [['self-start'], { block: 'self-start', inline: 'self-start' }],
      [['span-end'], { block: 'span-end', inline: 'span-end' }],
    ])('%s parses', (input, expected) => {
      expect(
        parsePositionAreaValue(input, createBlock())?.values,
      ).toMatchObject(expected);
    });

    // Invalid, can't parse
    it.each([[['left', 'left']], [['left', 'block-end']]])(
      '%s is undefined',
      (input) => {
        expect(parsePositionAreaValue(input, createBlock())).toEqual(undefined);
      },
    );
  });

  describe('insets', () => {
    it.each([
      [
        ['top', 'right'],
        [0, 'ANCHOR_TOP'],
        ['ANCHOR_RIGHT', 0],
      ],
      [
        ['bottom', 'left'],
        ['ANCHOR_BOTTOM', 0],
        [0, 'ANCHOR_LEFT'],
      ],
      [
        ['center', 'center'],
        ['ANCHOR_TOP', 'ANCHOR_BOTTOM'],
        ['ANCHOR_LEFT', 'ANCHOR_RIGHT'],
      ],
    ])('%s', (input, block, inline) => {
      const res = parsePositionAreaValue(input, createBlock())!.insets;
      expect(res.block).toEqual(block);
      expect(res.inline).toEqual(inline);
    });
  });

  describe('axisAlignment', () => {
    it.each([
      [['top', 'right'], 'end', 'start'],
      [['bottom', 'left'], 'start', 'end'],
      [['center', 'center'], 'center', 'center'],
    ])('%s', (input, block, inline) => {
      const res = parsePositionAreaValue(input, createBlock())!.alignments;
      expect(res.block).toEqual(block);
      expect(res.inline).toEqual(inline);
    });
  });
});
