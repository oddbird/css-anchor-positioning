import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sampleAnchorCSS = fs.readFileSync(
  path.join(__dirname, 'specExample.css'),
  {
    encoding: 'utf8',
  },
);

export const sampleNoAnchorCSS = '.a { color: red; } .b { color: green; }';
