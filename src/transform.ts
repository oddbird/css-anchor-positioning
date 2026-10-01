import {
  CSSOM_STORED_PROPERTIES,
  POLYFILLED_STYLE_ATTRIBUTE,
} from './cascade.js';
import type { AnchorPositioningRoot } from './polyfill.js';
import {
  generateCSS,
  type GeneratedStyles,
  getAST,
  getRootStyleContainer,
  type StyleData,
  writeAdoptedStylesheet,
} from './utils.js';

// This is a list of non-global attributes that apply to link elements but do
// not apply to style elements. These should be removed when converting from a
// link element to a style element. These mostly define loading behavior, which
// is not relevant to style elements or our use case.
const excludeAttributes = [
  'as',
  'blocking',
  'crossorigin',
  // 'disabled' is not relevant for style elements, but this exclusion is
  // theoretical, as a <link rel=stylesheet disabled> will not be loaded, and
  // will not reach this part of the polyfill. See #246.
  'disabled',
  'fetchpriority',
  'href',
  'hreflang',
  'integrity',
  'referrerpolicy',
  'rel',
  'type',
];

/**
 * Splits the transformed CSS for an element's inline styles into the element's
 * own declarations and any rules the polyfill added alongside them -- a
 * generated `@position-try` block, for a target declaring
 * `position-try-fallbacks` inline. A `style` attribute holds declarations and
 * not rules, so those need a stylesheet of their own.
 */
function splitInlineStyles(css: string, selector: string) {
  // Almost always there is nothing to split: the element declared no
  // `position-try-fallbacks` inline, so its own rule is the whole of `css`.
  // Slice it out rather than parsing and re-serializing per element per run.
  //
  // The guard is exact rather than optimistic. A single `}` ending the string
  // means one block, and `startsWith` means it is this element's -- so no rule
  // can hide before or after it, and a `}` inside a declaration value falls
  // through to the parse below. `css` is always `generateCSS` output here
  // (every `styleObj.changed = true` follows a `styleObj.css = generateCSS()`),
  // so the slice is byte for byte what the parse would have produced.
  const prefix = `${selector}{`;
  if (css.startsWith(prefix) && css.indexOf('}') === css.length - 1) {
    return { declarations: css.slice(prefix.length, -1), rules: '' };
  }

  const ast = getAST(css);
  let declarations = '';
  const rules: string[] = [];
  if (ast.type === 'StyleSheet') {
    for (const node of ast.children) {
      if (node.type === 'Rule' && generateCSS(node.prelude) === selector) {
        // A generated block includes its braces.
        declarations = generateCSS(node.block).slice(1, -1);
      } else {
        rules.push(generateCSS(node));
      }
    }
  }
  return { declarations, rules: rules.join('') };
}

/**
 * Splits a declaration list (a `style` attribute, or the declarations generated
 * for one) into trimmed property/value pairs, ignoring anything without a
 * colon. Later duplicates come last, as they do in the cascade.
 */
function declarationPairs(text: string) {
  const pairs: [string, string][] = [];
  for (const declaration of text.split(';')) {
    const index = declaration.indexOf(':');
    if (index < 0) {
      continue;
    }
    const property = declaration.slice(0, index).trim();
    if (property) {
      pairs.push([property, declaration.slice(index + 1).trim()]);
    }
  }
  return pairs;
}

export function transformCSS(
  styleData: StyleData[],
  inlineStyles?: Map<HTMLElement, Record<string, string>>,
  roots?: AnchorPositioningRoot[],
) {
  const updatedStyleData: StyleData[] = [];
  for (const { el, css, changed, sheet } of styleData) {
    const updatedObject: StyleData = { el, css, changed: false, sheet };
    if (changed) {
      if (sheet) {
        // Handle constructed stylesheets adopted via `adoptedStyleSheets`.
        // Write the transformed CSS into a polyfill-owned copy of the sheet (so
        // a sheet shared across roots isn't clobbered), swapping it into every
        // adopting root in this run, and track that copy.
        updatedObject.sheet = writeAdoptedStylesheet(sheet, css, roots);
      } else if (el?.tagName.toLowerCase() === 'style') {
        // Handle inline stylesheets
        el.innerHTML = css;
      } else if (el instanceof HTMLLinkElement) {
        // Replace link elements with style elements.
        // We use inline style elements rather than link elements with blob
        // URLs, as relative URLs for things like images and fonts are not
        // supported in blob URLs. See
        // https://github.com/oddbird/css-anchor-positioning/pull/324 for more
        // discussion.
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        for (const name of el.getAttributeNames()) {
          if (!name.startsWith('on') && !excludeAttributes.includes(name)) {
            const attr = el.getAttribute(name);
            if (attr !== null) {
              styleEl.setAttribute(name, attr);
            }
          }
        }
        // Persist the href attribute to help with potential debugging.
        if (el.hasAttribute('href')) {
          styleEl.setAttribute('data-original-href', el.getAttribute('href')!);
        }
        el.insertAdjacentElement('beforebegin', styleEl);
        el.remove();
        updatedObject.el = styleEl;
      } else if (el?.hasAttribute('data-has-inline-styles')) {
        // Handle inline styles
        const attr = el.getAttribute('data-has-inline-styles');
        if (attr) {
          const { declarations, rules } = splitInlineStyles(
            css,
            `[data-has-inline-styles="${attr}"]`,
          );
          let styles = declarations;
          if (rules) {
            const container = getRootStyleContainer(el);
            if (container) {
              const styleEl = document.createElement('style');
              styleEl.setAttribute(POLYFILLED_STYLE_ATTRIBUTE, 'true');
              styleEl.textContent = rules;
              container.append(styleEl);
            }
          }
          // Check for custom anchor-element mapping, so it is not overwritten
          // when inline styles are updated
          const mappings = inlineStyles?.get(el);
          if (mappings) {
            for (const [key, val] of Object.entries(mappings)) {
              styles = `${key}: var(${val}); ${styles}`;
            }
          }
          // Overwriting the `style` attribute would drop declarations that
          // only ever lived on the element. Read the *current* attribute (not
          // the text captured at fetch time) and carry those over:
          //
          // - `--anchor-*` mappings a concurrently-running polyfill added
          //   after this run captured its inline styles, so we don't clobber
          //   another run's target. This run's own mappings win, so they go
          //   first and any property this run declares is skipped.
          // - values written through the CSSOM, which `patchCSSOM` stores in
          //   the shifted custom property. Every one of them is a candidate,
          //   not just the two that happen to share the `--anchor-` prefix.
          //   Such a write can land at any point during a run and is newer
          //   than the text this run captured, so it goes last and wins.
          const generated = new Map(declarationPairs(styles));
          const preserved: string[] = [];
          const cssomWrites: string[] = [];
          for (const [property, value] of declarationPairs(
            el.getAttribute('style') ?? '',
          )) {
            if (CSSOM_STORED_PROPERTIES[property]) {
              if (generated.get(property) !== value) {
                cssomWrites.push(`${property}: ${value}`);
              }
            } else if (
              property.startsWith('--anchor-') &&
              !generated.has(property)
            ) {
              preserved.push(`${property}: ${value}`);
            }
          }
          if (preserved.length) {
            styles = `${preserved.join('; ')}; ${styles}`;
          }
          if (cssomWrites.length) {
            styles = `${styles}; ${cssomWrites.join('; ')}`;
          }
          el.setAttribute('style', styles);
        }
      }
    }
    // Note: `data-has-inline-styles` is intentionally left in place. The id is
    // reused across runs (see `fetchInlineStyles`) so concurrent runs share a
    // stable selector for the element; removing it would let a later run mint a
    // new id and invalidate another run's anchor selector.
    updatedStyleData.push(updatedObject);
  }
  return updatedStyleData;
}

/**
 * Inserts styles the polyfill generated itself (the position-area mapping
 * styles) into the container recorded for each block of rules.
 */
export function insertGeneratedStyles(styles: GeneratedStyles) {
  for (const [container, css] of styles) {
    if (!css) continue;
    const styleEl = document.createElement('style');
    styleEl.setAttribute(POLYFILLED_STYLE_ATTRIBUTE, 'true');
    styleEl.textContent = css;
    container.append(styleEl);
  }
}
