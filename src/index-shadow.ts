import { polyfill } from './polyfill.js';
import { installConstructedStylesheetPatches } from './shadow.js';

installConstructedStylesheetPatches();

export default polyfill;
