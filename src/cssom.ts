// The properties this patch makes settable through the CSSOM, mapped to the CSS
// property they write. A browser without native anchor positioning does not
// know them, and the CSSOM drops what it does not know: `el.style.anchorName =
// '--foo'` only sets a property on the style object and never produces a CSS
// declaration, while `el.style.setProperty('anchor-name', '--foo')` is ignored
// outright. Reading the value back still returns it, so the assignment looks
// like it worked. The polyfill reads the `style` attribute, so without this
// patch it never sees anchors that are wired up from JavaScript.
const PATCHED_PROPERTIES = {
  anchorName: 'anchor-name',
  positionAnchor: 'position-anchor',
} as const;

const PATCHED_CSS_PROPERTIES: string[] = Object.values(PATCHED_PROPERTIES);

// The element an inline `CSSStyleDeclaration` belongs to. Inline styles have no
// `ownerNode`, so the only way back to the element is to record it while
// `element.style` is being accessed — which is exactly when a declaration is
// about to be read or written.
const inlineStyleOwners = new WeakMap<CSSStyleDeclaration, Element>();

// The values set through the patched accessors, and the authoritative copy of
// them. They are mirrored into the `style` attribute for the polyfill (and for
// devtools) to read, but any later CSSOM write reserializes the declaration
// block and drops declarations the browser does not understand, so the
// attribute on its own cannot be trusted:
//
//   el.setAttribute('style', 'anchor-name: --foo; color: red');
//   el.style.top = '1px';
//   el.getAttribute('style'); // 'color: red; top: 1px;'
const inlineValues = new WeakMap<Element, Map<string, string>>();

// Every element that has a value in `inlineValues`, so the mirrors can be
// restored before a polyfill run reads them. Held weakly, so this never keeps
// an element alive.
const patchedElements = new Set<WeakRef<Element>>();

let patched = false;

/** Reads a declaration from an element's `style` attribute. */
function getInlineDeclaration(element: Element, property: string) {
  const [, value = ''] =
    new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`, 'i').exec(
      element.getAttribute('style') ?? '',
    ) ?? [];
  return value.trim();
}

/**
 * Writes a declaration into an element's `style` attribute, leaving the other
 * declarations untouched. An empty value removes the declaration.
 *
 * The attribute is edited as text rather than through the CSSOM, which would
 * drop the declaration again.
 */
function setInlineDeclaration(
  element: Element,
  property: string,
  value: string,
) {
  let style = (element.getAttribute('style') ?? '')
    .replace(new RegExp(`(^|;)\\s*${property}\\s*:[^;]*;?`, 'i'), '$1')
    .replace(/^\s*;/, '')
    .trim();

  if (value) {
    style = style && !style.endsWith(';') ? `${style};` : style;
    style = `${style}${style ? ' ' : ''}${property}: ${value};`;
  }

  if (style) {
    element.setAttribute('style', style);
  } else if (element.hasAttribute('style')) {
    element.setAttribute('style', '');
  }
}

function writeValue(element: Element, property: string, value: string) {
  let values = inlineValues.get(element);
  if (!values) {
    values = new Map();
    inlineValues.set(element, values);
    patchedElements.add(new WeakRef(element));
  }

  if (value) {
    values.set(property, value);
  } else {
    values.delete(property);
  }

  setInlineDeclaration(element, property, value);
}

/**
 * Re-applies the values set through the patched accessors to the `style`
 * attributes they were mirrored into, in case a later CSSOM write dropped them,
 * and drops elements that have been garbage collected.
 *
 * Called at the start of a polyfill run, so that everything downstream can keep
 * reading the `style` attribute as the single source of inline styles.
 */
export function restoreInlineAnchorValues() {
  if (!patched) return;

  for (const ref of patchedElements) {
    const element = ref.deref();
    if (!element) {
      patchedElements.delete(ref);
      continue;
    }

    for (const [property, value] of inlineValues.get(element) ?? []) {
      if (getInlineDeclaration(element, property) !== value) {
        setInlineDeclaration(element, property, value);
      }
    }
  }
}

/**
 * Makes `anchor-name` and `position-anchor` settable through the CSSOM, so that
 * anchors wired up from JavaScript — `element.style.anchorName = '--foo'` — are
 * visible to the polyfill in browsers without native anchor positioning.
 *
 * This is opt-in, and does nothing when anchor positioning is supported
 * natively, because it has a side effect worth knowing about: defining these
 * properties makes `'anchorName' in document.documentElement.style` return
 * `true`, which is a common way to detect native support. Use
 * `CSS.supports('anchor-name: --a')` for that instead — it is unaffected.
 *
 * Values set before this is called are not picked up; call it as early as
 * possible, alongside the other patches.
 */
export function patchCSSOM() {
  if (patched || CSS.supports('anchor-name: --a')) return;
  patched = true;

  // Record which element an inline declaration belongs to.
  for (const proto of [HTMLElement.prototype, SVGElement.prototype]) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'style');
    const getStyle = descriptor?.get;
    if (!descriptor || !getStyle) continue;

    Object.defineProperty(proto, 'style', {
      ...descriptor,
      get(this: Element) {
        const style = getStyle.call(this) as CSSStyleDeclaration;
        inlineStyleOwners.set(style, this);
        return style;
      },
    });
  }

  const ownerOf = (style: CSSStyleDeclaration) => inlineStyleOwners.get(style);

  for (const [property, cssProperty] of Object.entries(PATCHED_PROPERTIES)) {
    Object.defineProperty(CSSStyleDeclaration.prototype, property, {
      configurable: true,
      enumerable: true,
      get(this: CSSStyleDeclaration) {
        const element = ownerOf(this);
        // Not an inline style (a computed style, say), so there is no value of
        // ours to report.
        return (element && inlineValues.get(element)?.get(cssProperty)) ?? '';
      },
      set(this: CSSStyleDeclaration, value: string) {
        const element = ownerOf(this);
        if (element) {
          writeValue(element, cssProperty, `${value ?? ''}`.trim());
        }
      },
    });
  }

  // The dashed form goes through these, and is dropped just the same.
  const { getPropertyValue, removeProperty, setProperty } =
    CSSStyleDeclaration.prototype;

  CSSStyleDeclaration.prototype.setProperty = function (
    property: string,
    value: string | null,
    priority?: string,
  ) {
    const element = PATCHED_CSS_PROPERTIES.includes(property)
      ? ownerOf(this)
      : undefined;
    if (element) {
      writeValue(element, property, `${value ?? ''}`.trim());
      return;
    }
    return setProperty.call(this, property, value, priority);
  };

  CSSStyleDeclaration.prototype.getPropertyValue = function (
    property: string,
  ): string {
    const element = PATCHED_CSS_PROPERTIES.includes(property)
      ? ownerOf(this)
      : undefined;
    if (element) {
      return inlineValues.get(element)?.get(property) ?? '';
    }
    return getPropertyValue.call(this, property);
  };

  CSSStyleDeclaration.prototype.removeProperty = function (
    property: string,
  ): string {
    const element = PATCHED_CSS_PROPERTIES.includes(property)
      ? ownerOf(this)
      : undefined;
    if (element) {
      const previous = inlineValues.get(element)?.get(property) ?? '';
      writeValue(element, property, '');
      return previous;
    }
    return removeProperty.call(this, property);
  };
}
