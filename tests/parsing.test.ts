import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { test, expect } from '@playwright/test';

import { parseCSS } from '../src/parsing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleStyles = fs.readFileSync(path.join(__dirname, 'specExample.css'), {
  encoding: 'utf8',
});

const cssWithoutAnchorPositioning = '.a { color: red; } .b { color: green; }';

test.describe('parse stylesheet', () => {
  test('parses and returns @position-fallback strategy', () => {
    const result = parseCSS(sampleStyles);

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
