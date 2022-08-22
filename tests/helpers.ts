import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getSampleCSS = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../public', `${name}.css`), {
    encoding: 'utf8',
  });

export const sampleBaseCSS = '.a { color: red; } .b { color: green; }';
