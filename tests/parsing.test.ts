import { test, expect } from '@playwright/test';

import { parseCSS } from '../src/parsing.js';
import { sampleAnchorCSS } from './helpers.js';

const cssWithoutAnchorPositioning = '.a { color: red; } .b { color: green; }';

test.describe('parse stylesheet', () => {
  test('parses and returns @position-fallback strategy', () => {
    const result = parseCSS(sampleAnchorCSS);
    expect(result).toBeTruthy();
    expect(result).toEqual({
      '--button-popup': [
        { top: 'anchor(--button bottom)', left: 'anchor(--button left)' },
        { bottom: 'anchor(--button top)', left: 'anchor(--button left)' },
        { top: 'anchor(--button bottom)', right: 'anchor(--button right)' },
        { bottom: 'anchor(--button top)', right: 'anchor(--button right)' },
      ],
    });
  });

  test('does not find @position-fallback at-rule', () => {
    const result = parseCSS(cssWithoutAnchorPositioning);
    expect(result.fallbackStrategy).toBeUndefined();
  });
});
