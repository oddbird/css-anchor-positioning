import type { Rule, StyleSheet } from 'css-tree';

import { SHIFTED_PROPERTIES } from '../../src/cascade.js';
import {
  activeTargetStyles,
  activeWrapperStyles,
  addPositionAreaDeclarationBlockStyles,
  axisForPositionAreaValue,
  dataForPositionAreaTarget,
  getPositionAreaDeclaration,
  hasContainingBlockDependentDeclaration,
  markPositionAreaTarget,
  wrapperForPositionedElement,
} from '../../src/position-area.js';
import { generateCSS, getAST, INSTANCE_UUID } from '../../src/utils.js';

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
      [
        ['self-x-start', 'self-y-end'],
        { block: 'self-y-end', inline: 'self-x-start' },
      ],
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
      expect(style.top).toBe(`var(--pa-wrapper-top-${INSTANCE_UUID})`);
      expect(style.bottom).toBe(`var(--pa-wrapper-bottom-${INSTANCE_UUID})`);
      expect(style.left).toBe(`var(--pa-wrapper-left-${INSTANCE_UUID})`);
      expect(style.right).toBe(`var(--pa-wrapper-right-${INSTANCE_UUID})`);
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

  describe('markPositionAreaTarget', () => {
    let element: HTMLElement;
    beforeEach(() => {
      element = document.createElement('div');
    });
    it('marks a target', () => {
      markPositionAreaTarget(element, 'uuid');
      expect(element.hasAttribute('data-pa-target-for-uuid')).toBe(true);
    });
    it('marks a target for multiple declarations', () => {
      markPositionAreaTarget(element, 'uuid1');
      markPositionAreaTarget(element, 'uuid2');
      expect(element.hasAttribute('data-pa-target-for-uuid1')).toBe(true);
      expect(element.hasAttribute('data-pa-target-for-uuid2')).toBe(true);
    });
  });

  describe('dataForPositionAreaTarget', () => {
    it('wraps the target by default', async () => {
      const element = createEl();
      const res = await dataForPositionAreaTarget(
        element,
        getPositionAreaDeclaration(createPositionAreaNode(['top', 'right']))!,
        null,
      );
      expect(res.wrapperEl).toBeDefined();
      expect(res.wrapperEl!.tagName).toBe('POLYFILL-POSITION-AREA');
      expect(element.parentElement).toBe(res.wrapperEl);
    });
    it('marks the target without `positionAreaContainingBlock`', async () => {
      const element = createEl();
      const res = await dataForPositionAreaTarget(
        element,
        getPositionAreaDeclaration(createPositionAreaNode(['top', 'right']))!,
        null,
        false,
      );
      expect(res.wrapperEl).toBeUndefined();
      expect(element.parentElement).toBeNull();
      expect(element.hasAttribute(`data-pa-target-for-${res.targetUUID}`)).toBe(
        true,
      );
    });

    it('resolves insets and alignments for an unwrapped target', async () => {
      // The unwrapped path resolves alignment via the physical
      // (writing-mode-modified) grid; under the default LTR horizontal writing
      // mode this matches the wrapped path, so the values are the reference
      // for the physical `top right` placement.
      const res = await dataForPositionAreaTarget(
        createEl(),
        getPositionAreaDeclaration(createPositionAreaNode(['top', 'right']))!,
        null,
        false,
      );
      expect(res.insets.block).toEqual([0, 'top']);
      expect(res.insets.inline).toEqual(['right', 0]);
      expect(res.alignments.block).toBe('end');
      expect(res.alignments.inline).toBe('start');
    });
  });

  describe('activeWrapperStyles', () => {
    it('returns the active styles', () => {
      // Built with `INSTANCE_UUID` rather than a stored snapshot, since the
      // UUID differs per run (see `paValueProperties`).
      const u = INSTANCE_UUID;
      expect(activeWrapperStyles('targetUUID', 'selectorUUID')).toBe(
        '    [data-anchor-position-wrapper="selectorUUID"]' +
          '[data-pa-wrapper-for-targetUUID] {' +
          `      --pa-wrapper-top-${u}: var(targetUUID-top);` +
          `      --pa-wrapper-left-${u}: var(targetUUID-left);` +
          `      --pa-wrapper-right-${u}: var(targetUUID-right);` +
          `      --pa-wrapper-bottom-${u}: var(targetUUID-bottom);` +
          `    }` +
          '    [data-anchor-position-wrapper="selectorUUID"]' +
          '[data-pa-wrapper-for-targetUUID] > * {' +
          `      --pa-value-justify-self-${u}: var(targetUUID-justify-self);` +
          `      --pa-value-align-self-${u}: var(targetUUID-align-self);` +
          '    }  ',
      );
    });
  });

  describe('activeTargetStyles', () => {
    it('returns the active styles', () => {
      const u = INSTANCE_UUID;
      expect(activeTargetStyles('targetUUID', 'selectorUUID')).toBe(
        '    [data-anchor-position-area="selectorUUID"][data-pa-target-for-targetUUID] {' +
          `      --pa-value-top-${u}: var(targetUUID-top);` +
          `      --pa-value-left-${u}: var(targetUUID-left);` +
          `      --pa-value-right-${u}: var(targetUUID-right);` +
          `      --pa-value-bottom-${u}: var(targetUUID-bottom);` +
          '    }  ',
      );
    });
  });

  describe('hasContainingBlockDependentDeclaration', () => {
    // `getCSSPropertyValue` (used internally) reads position-try-accepted
    // properties from their shifted custom property, since the polyfill
    // rewrites the document's CSS to duplicate those declarations there.
    const elementWithStyle = (property: string, value: string) => {
      const el = createEl();
      el.style.setProperty(SHIFTED_PROPERTIES[property] ?? property, value);
      return el;
    };

    it.each([
      // Sizes resolved against the containing block.
      ['width', '50%', true],
      ['height', '100%', true],
      ['min-width', '10%', true],
      ['max-block-size', '50%', true],
      ['width', 'stretch', true],
      ['width', '-webkit-fill-available', true],
      // `fit-content` clamps to the stretch-fit (containing-block) size.
      ['height', 'fit-content', true],
      ['width', 'fit-content(200px)', true],
      // Sizes that do not depend on the containing block.
      ['width', '200px', false],
      ['width', 'auto', false],
      ['width', 'max-content', false],
      ['width', 'min-content', false],
      // Margins: percentages and `auto` distribute against the CB.
      ['margin', '5%', true],
      ['margin-left', 'auto', true],
      ['margin-inline', 'auto', true],
      ['margin', '10px', false],
      // Padding: only percentages depend on the CB.
      ['padding', '5%', true],
      ['padding-top', '1em', false],
      // Self-alignment: only stretch / anchor-center depend on the area.
      ['justify-self', 'stretch', true],
      ['align-self', 'anchor-center', true],
      ['justify-self', 'center', false],
      ['align-self', 'normal', false],
      // Insets are overridden by the polyfill, so they never force a wrapper.
      ['top', '50%', false],
      ['inset', '0', false],
      // Unrelated properties.
      ['color', 'red', false],
    ])('%s: %s -> %s', (property, value, expected) => {
      expect(
        hasContainingBlockDependentDeclaration(
          elementWithStyle(property, value),
        ),
      ).toBe(expected);
    });
  });

  describe('addPositionAreaDeclarationBlockStyles', () => {
    const blockFor = (mode: boolean | 'auto') => {
      const ast = getAST('a{position-area:top right}') as StyleSheet;
      const block = (ast.children.first! as Rule).block;
      const declaration = getPositionAreaDeclaration(block.children.first!)!;
      addPositionAreaDeclarationBlockStyles(declaration, block, mode);
      return block.children
        .toArray()
        .filter((node) => node.type === 'Declaration')
        .map((node) => `${node.property}:${generateCSS(node.value)}`);
    };

    it('applies insets to a wrapper when true', () => {
      const decls = blockFor(true);
      const u = INSTANCE_UUID;
      expect(decls).toContain(`justify-self:var(--pa-value-justify-self-${u})`);
      expect(decls).toContain(`align-self:var(--pa-value-align-self-${u})`);
      expect(decls.some((d) => d.startsWith('top:'))).toBe(false);
    });

    it('applies insets to the target when false', () => {
      const decls = blockFor(false);
      const u = INSTANCE_UUID;
      expect(decls).toContain(`top:var(--pa-value-top-${u})`);
      expect(decls).toContain(`bottom:var(--pa-value-bottom-${u})`);
      expect(decls.some((d) => d.startsWith('justify-self:'))).toBe(false);
    });

    it('emits both alignment and inset declarations with fallbacks in auto mode', () => {
      const u = INSTANCE_UUID;
      const decls = blockFor('auto');
      expect(decls).toContain(
        `justify-self:var(--pa-value-justify-self-${u}, normal)`,
      );
      expect(decls).toContain(
        `align-self:var(--pa-value-align-self-${u}, normal)`,
      );
      expect(decls).toContain(`top:var(--pa-value-top-${u}, auto)`);
      expect(decls).toContain(`left:var(--pa-value-left-${u}, auto)`);
      expect(decls).toContain(`right:var(--pa-value-right-${u}, auto)`);
      expect(decls).toContain(`bottom:var(--pa-value-bottom-${u}, auto)`);
    });
  });
});
