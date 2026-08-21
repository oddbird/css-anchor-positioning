import { CSSOM_PROPERTIES, SHIFTED_PROPERTIES } from './cascade.js';

// Camel-case name to define on `CSSStyleDeclaration`, mapped to the CSS
// property it writes.
const PATCHED_PROPERTIES: Record<string, string> = Object.fromEntries(
  CSSOM_PROPERTIES.map((property) => [
    property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()),
    property,
  ]),
);

const PATCHED_CSS_PROPERTIES: string[] = Object.values(PATCHED_PROPERTIES);

let patched = false;

/**
 * Makes the anchor positioning properties settable through the CSSOM, so that
 * anchors wired up from JavaScript — `element.style.anchorName = '--foo'` — are
 * visible to the polyfill in browsers without native anchor positioning, which
 * drop what they do not know before it reaches the `style` attribute.
 *
 * The value is stored in the custom property `cascadeCSS` would have shifted the
 * declaration into anyway (`SHIFTED_PROPERTIES`), which the browser cannot drop,
 * and `cascadeCSS` restores it to the property it was set on. That keeps all the
 * bookkeeping out of here, so `CSSStyleDeclaration` is the only thing patched.
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

  const { getPropertyValue, removeProperty, setProperty } =
    CSSStyleDeclaration.prototype;

  // Writes through the native accessors, so the patched ones below can call
  // this without recursing.
  const writeValue = (
    style: CSSStyleDeclaration,
    cssProperty: string,
    value: string | null,
    priority?: string,
  ) => {
    const property = SHIFTED_PROPERTIES[cssProperty];
    const trimmed = `${value ?? ''}`.trim();
    if (trimmed) {
      setProperty.call(style, property, trimmed, priority);
    } else {
      removeProperty.call(style, property);
    }
  };

  // The property this declaration stores `cssProperty` in, for the properties
  // we own; anything else is passed through untouched.
  const storedAs = (cssProperty: string) =>
    PATCHED_CSS_PROPERTIES.includes(cssProperty)
      ? SHIFTED_PROPERTIES[cssProperty]
      : cssProperty;

  for (const [property, cssProperty] of Object.entries(PATCHED_PROPERTIES)) {
    Object.defineProperty(CSSStyleDeclaration.prototype, property, {
      configurable: true,
      enumerable: true,
      get(this: CSSStyleDeclaration) {
        return getPropertyValue.call(this, SHIFTED_PROPERTIES[cssProperty]);
      },
      set(this: CSSStyleDeclaration, value: string) {
        writeValue(this, cssProperty, value);
      },
    });
  }

  // The dashed form goes through these, and is dropped just the same.
  CSSStyleDeclaration.prototype.setProperty = function (
    property: string,
    value: string | null,
    priority?: string,
  ) {
    if (PATCHED_CSS_PROPERTIES.includes(property)) {
      writeValue(this, property, value, priority);
      return;
    }
    return setProperty.call(this, property, value, priority);
  };

  CSSStyleDeclaration.prototype.getPropertyValue = function (
    property: string,
  ): string {
    return getPropertyValue.call(this, storedAs(property));
  };

  CSSStyleDeclaration.prototype.removeProperty = function (
    property: string,
  ): string {
    return removeProperty.call(this, storedAs(property));
  };
}
