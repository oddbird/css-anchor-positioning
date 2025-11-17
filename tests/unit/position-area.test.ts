import type { Rule, StyleSheet } from 'css-tree';

import {
  activeWrapperStyles,
  axisForPositionAreaValue,
  dataForPositionAreaTarget,
  getPositionAreaDeclaration,
  wrapperForPositionedElement,
} from '../../src/position-area.js';
import { getAST } from '../../src/utils.js';

const createPositionAreaNode = (input: string[]) => {
  const css = getAST(`a{position-area:${input.join(' ')}}`) as StyleSheet;
  return (css.children.first! as Rule).block.children.first!;
};

const createEl = () => {
  const el = document.createElement('div');
  return el;
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
      ['self-x-start', 'inline'],
      ['self-y-end', 'block'],
      ['span-self-x-start', 'inline'],
      ['span-self-y-end', 'block'],
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
      [['self-x-start', 'self-y-end'], { block: 'self-y-end', inline: 'self-x-start' }],
    ])('%s parses', (input, expected) => {
      expect(
        getPositionAreaDeclaration(createPositionAreaNode(input))?.values,
      ).toMatchObject(expected);
    });

    // With ambiguous values
    it.each([
      [['left', 'center'], { block: 'center', inline: 'left' }],
      [['center', 'left'], { block: 'center', inline: 'left' }],
      [['span-all', 'y-end'], { block: 'y-end', inline: 'span-all' }],
    ])('%s parses values', (input, expected) => {
      expect(
        getPositionAreaDeclaration(createPositionAreaNode(input))?.values,
      ).toMatchObject(expected);
    });
    it.each([
      [
        ['left', 'center'],
        { block: [1, 2, 'Irrelevant'], inline: [0, 1, 'Irrelevant'] },
      ],
      [
        ['center', 'left'],
        { block: [1, 2, 'Irrelevant'], inline: [0, 1, 'Irrelevant'] },
      ],
      [
        ['span-all', 'y-end'],
        { block: [2, 3, 'Physical'], inline: [0, 3, 'Irrelevant'] },
      ],
    ])('%s parses grid', (input, expected) => {
      expect(
        getPositionAreaDeclaration(createPositionAreaNode(input))?.grid,
      ).toMatchObject(expected);
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
        getPositionAreaDeclaration(createPositionAreaNode(input))?.values,
      ).toMatchObject(expected);
    });

    // Invalid, can't parse
    it.each([[['left', 'left']], [['left', 'block-end']]])(
      '%s is undefined',
      (input) => {
        expect(
          getPositionAreaDeclaration(createPositionAreaNode(input)),
        ).toEqual(undefined);
      },
    );
  });

  describe('insets', () => {
    it.each([
      [
        ['top', 'right'],
        [0, 'top'],
        ['right', 0],
      ],
      [
        ['bottom', 'left'],
        ['bottom', 0],
        [0, 'left'],
      ],
      [
        ['center', 'center'],
        ['top', 'bottom'],
        ['left', 'right'],
      ],
    ])('%s', async (input, block, inline) => {
      const res = await dataForPositionAreaTarget(
        createEl(),
        getPositionAreaDeclaration(createPositionAreaNode(input))!,
        null,
      );
      const insets = res!.insets;
      expect(insets.block).toEqual(block);
      expect(insets.inline).toEqual(inline);
    });
  });

  describe('axisAlignment', () => {
    it.each([
      [['top', 'right'], 'end', 'start'],
      [['bottom', 'left'], 'start', 'end'],
      [['center', 'center'], 'center', 'center'],
    ])('%s', async (input, block, inline) => {
      const res = await dataForPositionAreaTarget(
        createEl(),
        getPositionAreaDeclaration(createPositionAreaNode(input))!,
        null,
      );
      const alignments = res!.alignments;
      expect(alignments.block).toEqual(block);
      expect(alignments.inline).toEqual(inline);
    });
  });

  describe('wrapperForPositionedElement', () => {
    let element: HTMLElement;
    beforeEach(() => {
      element = document.createElement('div');
    });
    it('creates a wrapper', () => {
      const wrapper = wrapperForPositionedElement(element, 'uuid');
      expect(wrapper.tagName).toBe('POLYFILL-POSITION-AREA');
      const style = getComputedStyle(wrapper);
      expect(style.position).toBe('absolute');
      expect(style.display).toBe('grid');
      expect(style.top).toBe(`var(--pa-value-top)`);
      expect(style.bottom).toBe(`var(--pa-value-bottom)`);
      expect(style.left).toBe(`var(--pa-value-left)`);
      expect(style.right).toBe(`var(--pa-value-right)`);
      expect(wrapper.getAttribute('data-pa-wrapper-for-uuid')).toBeDefined();
    });
    it('does not rewrap an element', () => {
      const wrapper = wrapperForPositionedElement(element, 'uuid1');
      const secondWrapper = wrapperForPositionedElement(element, 'uuid2');
      expect(
        secondWrapper.getAttribute('data-pa-wrapper-for-uuid1'),
      ).toBeDefined();
      expect(
        secondWrapper.getAttribute('data-pa-wrapper-for-uuid2'),
      ).toBeDefined();
      expect(wrapper).toBe(secondWrapper);
    });
  });

  describe('activeWrapperStyles', () => {
    it('returns the active styles', () => {
      expect(
        activeWrapperStyles('targetUUID', 'selectorUUID'),
      ).toMatchSnapshot();
    });
  });
});
