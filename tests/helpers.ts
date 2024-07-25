import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { cascadeCSS } from '../src/cascade.js';
import { type StyleData } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getSampleCSS = (name: string) =>
  cascadeCSSForTest(
    fs.readFileSync(path.join(__dirname, '../public', `${name}.css`), {
      encoding: 'utf8',
    }),
  );

export const sampleBaseCSS = '.a { color: red; } .b { color: green; }';

/**
 * Update a CSS string used in tests by running it through `cascadeCSS`.
 */
export function cascadeCSSForTest(css: string) {
  const styleObj: StyleData = { el: null!, css };
  cascadeCSS([styleObj]);
  return styleObj.css;
}
