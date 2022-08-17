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

export const sampleAnchorCSSString =
  '#my-popup {position: fixed;position-fallback: --button-popup;overflow: auto;min-width: anchor-size(--button width);min-height: 6em;}@position-fallback --button-popup {@try {top: anchor(--button bottom);left: anchor(--button left);}@try {bottom: anchor(--button top);left: anchor(--button left);}@try {top: anchor(--button bottom);right: anchor(--button right);}@try {bottom: anchor(--button top);right: anchor(--button right);}}h1{color: green}';
