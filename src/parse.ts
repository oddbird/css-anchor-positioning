import * as csstree from 'css-tree';
import { nanoid } from 'nanoid/non-secure';

import { StyleData } from './fetch.js';
import { validatedForPositioning } from './validate.js';

interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

interface AtRuleRaw extends csstree.Atrule {
  prelude: csstree.Raw | null;
}

interface AnchorNames {
  // `key` is the `anchor-name` value
  // `value` is an array of all element selectors with that anchor name
  [key: string]: string[];
}

type InsetProperty = 'top' | 'left' | 'right' | 'bottom';

type AnchorSideKeyword =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end'
  | 'center';

export type AnchorSide = AnchorSideKeyword | number;

interface AnchorFunction {
  anchorEl?: HTMLElement | null;
  anchorName?: string;
  anchorEdge?: AnchorSide;
  fallbackValue: string;
  customPropName?: string;
  uuid: string;
}

// `key` is the property being declared
// `value` is the anchor-positioning data for that property
type AnchorFunctionDeclaration = Partial<
  Record<InsetProperty, AnchorFunction[]>
>;

interface AnchorFunctionDeclarations {
  // `key` is the target element selector
  // `value` is an object with all anchor-function declarations on that element
  [key: string]: AnchorFunctionDeclaration;
}

interface AnchorPosition {
  declarations?: AnchorFunctionDeclaration;
  fallbacks?: TryBlock[];
}

export interface AnchorPositions {
  // `key` is the target element selector
  // `value` is an object with all anchor-positioning data for that element
  [key: string]: AnchorPosition;
}

// `key` is the property being declared
// `value` is the property value, or parsed anchor-fn data
type TryBlock = Partial<
  Record<string | InsetProperty, string | AnchorFunction>
>;

interface FallbackNames {
  // `key` is the target element selector
  // `value` is the `position-fallback` value (name)
  [key: string]: string;
}

interface Fallbacks {
  // `key` is the `position-fallback` value (name)
  // `value` is an array of `@try` block declarations (in order)
  [key: string]: TryBlock[];
}

function isDeclaration(node: csstree.CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration';
}

function isAnchorNameDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'anchor-name';
}

function isAnchorFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'anchor');
}

function isVarFunction(
  node: csstree.CssNode | null,
): node is csstree.FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'var');
}

function isFallbackDeclaration(
  node: csstree.CssNode,
): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'position-fallback';
}

function isFallbackAtRule(node: csstree.CssNode): node is AtRuleRaw {
  return node.type === 'Atrule' && node.name === 'position-fallback';
}

function isTryAtRule(node: csstree.CssNode): node is AtRuleRaw {
  return node.type === 'Atrule' && node.name === 'try';
}

function isIdentifier(node: csstree.CssNode): node is csstree.Identifier {
  return Boolean(node.type === 'Identifier' && node.name);
}

function isPercentage(node: csstree.CssNode): node is csstree.Percentage {
  return Boolean(node.type === 'Percentage' && node.value);
}

function parseAnchorFn(
  node: csstree.FunctionNode,
  replaceCss?: boolean,
): AnchorFunction {
  let anchorName: string | undefined,
    anchorEdge: AnchorSide | undefined,
    fallbackValue = '',
    foundComma = false,
    customPropName: string | undefined;

  node.children.toArray().forEach((child, idx) => {
    if (foundComma) {
      fallbackValue = `${fallbackValue}${csstree.generate(child)}`;
      return;
    }
    if (child.type === 'Operator' && child.value === ',') {
      foundComma = true;
      return;
    }
    switch (idx) {
      case 0:
        if (isIdentifier(child)) {
          // Store anchor name
          anchorName = child.name;
        } else if (isVarFunction(child) && child.children.first) {
          // Store CSS custom prop for anchor name
          const name = (child.children.first as csstree.Identifier).name;
          customPropName = name;
        }
        break;
      case 1:
        if (isIdentifier(child)) {
          anchorEdge = child.name as AnchorSideKeyword;
        } else if (isPercentage(child)) {
          const number = Number(child.value);
          anchorEdge = Number.isNaN(number) ? undefined : number;
        }
        break;
    }
  });

  const uuid = `--anchor-${nanoid(12)}`;
  if (replaceCss) {
    // Replace anchor function with unique CSS custom property.
    // This allows us to update the value of the new custom property
    // every time the position changes.
    Object.assign(node, {
      type: 'Raw',
      value: `var(${uuid})`,
      children: null,
    });
    Reflect.deleteProperty(node, 'name');
  }

  return {
    anchorName,
    anchorEdge,
    fallbackValue: fallbackValue || '0px',
    customPropName,
    uuid,
  };
}

function getAnchorNameData(node: csstree.CssNode, rule?: csstree.Raw) {
  if (
    isAnchorNameDeclaration(node) &&
    node.value.children.first &&
    rule?.value
  ) {
    const name = (node.value.children.first as csstree.Identifier).name;
    return { name, selector: rule.value };
  }
  return {};
}

// Mapping of custom property names, to anchor function data objects referenced
// in their values
const customPropAssignments: Record<string, AnchorFunction[]> = {};
// Mapping of custom property names, to the original values that have been
// replaced in the CSS
const customPropOriginals: Record<string, string> = {};
// Top-level key (`uuid`) is the original uuid to find in the updated CSS
// - `key` (`propUuid`) is the new inset-property-specific uuid to append to the
//   original custom property name
// - `value` is the new inset-property-specific custom property value to use
const customPropReplacements: Record<string, Record<string, string>> = {};

function getAnchorFunctionData(
  node: csstree.CssNode,
  declaration: csstree.Declaration | null,
  rule?: csstree.Raw,
) {
  if (isAnchorFunction(node) && rule?.value && declaration) {
    if (declaration.property.startsWith('--')) {
      const original = csstree.generate(declaration.value);
      const data = parseAnchorFn(node, true);
      // Store the original anchor function so that we can restore it later
      customPropOriginals[data.uuid] = original;
      customPropAssignments[declaration.property] = [
        ...(customPropAssignments[declaration.property] ?? []),
        data,
      ];
      return { changed: true };
    }
    if (isInset(declaration.property)) {
      const data = parseAnchorFn(node, true);
      return { prop: declaration.property, data, changed: true };
    }
  }
  return {};
}

function getPositionFallbackDeclaration(
  node: csstree.CssNode,
  rule?: csstree.Raw,
) {
  if (isFallbackDeclaration(node) && node.value.children.first && rule?.value) {
    const name = (node.value.children.first as csstree.Identifier).name;
    return { name, selector: rule.value };
  }
  return {};
}

function isInset(property: string): property is InsetProperty {
  const insetProperties: InsetProperty[] = ['left', 'right', 'top', 'bottom'];

  return insetProperties.includes(property as InsetProperty);
}

function getPositionFallbackRules(node: csstree.CssNode) {
  if (isFallbackAtRule(node) && node.prelude?.value && node.block?.children) {
    const name = node.prelude.value;
    const tryBlocks: TryBlock[] = [];
    const tryAtRules = node.block.children.filter(isTryAtRule);
    tryAtRules.forEach((atRule) => {
      if (atRule.block?.children) {
        const tryBlock: TryBlock = {};
        // Only declarations are allowed inside a `@try` block
        const declarations = atRule.block.children.filter(isDeclaration);
        declarations.forEach((child) => {
          const firstChild = child.value.children.first as csstree.CssNode;
          // Parse value if it's an `anchor()` fn; otherwise store it raw
          if (firstChild && isAnchorFunction(firstChild)) {
            tryBlock[child.property] = parseAnchorFn(firstChild);
          } else {
            tryBlock[child.property] = csstree.generate(child.value);
          }
        });
        tryBlocks.push(tryBlock);
      }
    });
    return { name, fallbacks: tryBlocks };
  }
  return {};
}

function getCSSPropertyValue(el: HTMLElement, prop: string) {
  return getComputedStyle(el).getPropertyValue(prop).trim();
}

const anchorNames: AnchorNames = {};

function getAnchorEl(targetEl: HTMLElement | null, anchorObj: AnchorFunction) {
  let anchorName = anchorObj.anchorName;
  const customPropName = anchorObj.customPropName;
  if (targetEl && !anchorName && customPropName) {
    anchorName = getCSSPropertyValue(targetEl, customPropName);
  }
  const anchorSelectors = anchorName ? anchorNames[anchorName] ?? [] : [];
  return validatedForPositioning(targetEl, anchorSelectors);
}

function getAST(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseCustomProperty: true,
  });

  return ast;
}

export function parseCSS(styleData: StyleData[]) {
  const anchorFunctions: AnchorFunctionDeclarations = {};
  const fallbackNames: FallbackNames = {};
  const fallbacks: Fallbacks = {};
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, function (node) {
      const rule = this.rule?.prelude as csstree.Raw | undefined;

      // Parse `anchor-name` declaration
      const { name: anchorName, selector: anchorSelector } = getAnchorNameData(
        node,
        rule,
      );
      if (anchorName && anchorSelector) {
        if (anchorNames[anchorName]) {
          anchorNames[anchorName].push(anchorSelector);
        } else {
          anchorNames[anchorName] = [anchorSelector];
        }
      }

      // Parse `anchor()` function
      const {
        prop,
        data,
        changed: updated,
      } = getAnchorFunctionData(node, this.declaration, rule);
      if (prop && data && rule?.value) {
        // This will override earlier declarations
        // with the same exact rule selector
        // *and* the same exact declaration property:
        // (e.g. multiple `top: anchor(...)` declarations
        // for the same `.foo {...}` selector)
        anchorFunctions[rule.value] = {
          ...anchorFunctions[rule.value],
          [prop]: [...(anchorFunctions[rule.value]?.[prop] ?? []), data],
        };
      }
      if (updated) {
        changed = true;
      }

      // Parse `position-fallback` declaration
      const { name: fbName, selector: fbSelector } =
        getPositionFallbackDeclaration(node, rule);
      if (fbName && fbSelector) {
        // This will override earlier `position-fallback` declarations
        // with the same rule selector:
        // (e.g. multiple `position-fallback:` declarations
        // for the same `.foo {...}` selector)
        fallbackNames[fbSelector] = fbName;
      }

      // Parse `@position-fallback` rule
      const { name: fbRuleName, fallbacks: fbTryBlocks } =
        getPositionFallbackRules(node);
      if (fbRuleName && fbTryBlocks.length) {
        // This will override earlier `@position-fallback` lists
        // with the same name:
        // (e.g. multiple `@position-fallback --my-fallback {...}` uses
        // with the same `--my-fallback` name)
        fallbacks[fbRuleName] = fbTryBlocks;
      }
    });
    if (changed) {
      // Update CSS
      styleObj.css = csstree.generate(ast);
      styleObj.changed = true;
    }
  }

  // List of CSS custom properties that include anchor fns
  const customPropsToCheck = new Set(Object.keys(customPropAssignments));
  // Mapping of a custom property name, to the name(s) and uuid(s) of other
  // custom properties "up" the chain that contain (eventually) a reference to
  // an anchor function
  const customPropsMapping: Record<
    // custom property name
    string,
    // other custom property name(s) and uuid(s) referenced by this custom prop
    { names: string[]; uuids: string[] }
  > = {};

  // Find (recursively) anchor data assigned to another custom property, and
  // that custom property is referenced by (i.e. passed through) the given
  // custom property
  const getReferencedFns = (prop: string) => {
    const referencedFns: AnchorFunction[] = [];
    const ancestorProps = new Set(customPropsMapping[prop]?.names ?? []);
    while (ancestorProps.size > 0) {
      for (const prop of ancestorProps) {
        referencedFns.push(...(customPropAssignments[prop] ?? []));
        ancestorProps.delete(prop);
        if (customPropsMapping[prop]?.names?.length) {
          // Continue checking recursively "up" the chain of custom properties
          customPropsMapping[prop].names.forEach((n) => ancestorProps.add(n));
        }
      }
    }
    return referencedFns;
  };

  // First find where CSS custom properties are used in other custom properties
  while (customPropsToCheck.size > 0) {
    const toCheckAgain: string[] = [];
    for (const styleObj of styleData) {
      let changed = false;
      const ast = getAST(styleObj.css);
      csstree.walk(ast, {
        visit: 'Function',
        enter(node) {
          const rule = this.rule?.prelude as csstree.Raw | undefined;
          const declaration = this.declaration;
          const prop = declaration?.property;
          if (
            rule?.value &&
            isVarFunction(node) &&
            declaration &&
            prop &&
            node.children.first &&
            customPropsToCheck.has(
              (node.children.first as csstree.Identifier).name,
            ) &&
            // For now, we only want assignments to other CSS custom properties
            prop.startsWith('--')
          ) {
            const child = node.children.first as csstree.Identifier;
            // Find anchor data assigned to this custom property
            const anchorFns = customPropAssignments[child.name] ?? [];
            // Find anchor data assigned to another custom property referenced
            // by this custom property (recursively)
            const referencedFns = getReferencedFns(child.name);

            // Return if there are no anchor fns related to this custom property
            if (!(anchorFns.length || referencedFns.length)) {
              return;
            }

            // An anchor fn was assigned to a custom property, which is
            // now being re-assigned to another custom property...
            const uuid = `${child.name}-anchor-${nanoid(12)}`;
            // Store the original declaration so that we can restore it later
            const original = csstree.generate(declaration.value);
            customPropOriginals[uuid] = original;
            // Store a mapping of the new property to the original property
            // name, as well as the unique uuid(s) temporarily used to replace
            // the original property value.
            if (!customPropsMapping[prop]) {
              customPropsMapping[prop] = { names: [], uuids: [] };
            }
            const mapping = customPropsMapping[prop];
            if (!mapping.names.includes(child.name)) {
              mapping.names.push(child.name);
            }
            mapping.uuids.push(uuid);
            // Note that we need to do another pass of the CSS looking for
            // usage of the new property name:
            toCheckAgain.push(prop);
            // Temporarily replace the original property with a new unique key
            child.name = uuid;
            changed = true;
          }
        },
      });
      if (changed) {
        // Update CSS
        styleObj.css = csstree.generate(ast);
        styleObj.changed = true;
      }
    }
    customPropsToCheck.clear();
    toCheckAgain.forEach((s) => customPropsToCheck.add(s));
  }

  // Then find where CSS custom properties are used in inset properties...
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    csstree.walk(ast, {
      visit: 'Function',
      enter(node) {
        const rule = this.rule?.prelude as csstree.Raw | undefined;
        const declaration = this.declaration;
        const prop = declaration?.property;
        if (
          rule?.value &&
          isVarFunction(node) &&
          declaration &&
          prop &&
          node.children.first &&
          // Now we only want assignments to inset properties
          isInset(prop)
        ) {
          const child = node.children.first as csstree.Identifier;
          // Find anchor data assigned to this custom property
          const anchorFns = customPropAssignments[child.name] ?? [];
          // Find anchor data assigned to another custom property referenced
          // by this custom property (recursively)
          const referencedFns = getReferencedFns(child.name);

          // Return if there are no anchor fns related to this custom property
          if (!(anchorFns.length || referencedFns.length)) {
            return;
          }

          /*

            An anchor fn was assigned to an inset property.

            It's possible that there are multiple uses of the same CSS
            custom property name, with different anchor function calls
            assigned to them. Instead of trying to figure out which one has
            cascaded to the given location, we iterate over all anchor
            functions that were assigned to the given CSS custom property
            name. For each one, we add a new custom prop with the value
            for that target and inset property, and let CSS determine which
            one cascades through to where it's used.

            For example, this:

              .one {
                --center: anchor(--anchor-name 50%);
              }

              .two {
                --center: anchor(--anchor-name 100%);
              }

              #target {
                top: var(--center);
              }

            Becomes this:

              .one {
                --center-top-EnmDEkZ5mBLp: var(--anchor-aPyy7qLK9f38-top);
                --center: anchor(--anchor-name 50%);
              }

              .two {
                --center-top-EnmDEkZ5mBLp: var(--anchor-SgrF5vARDf6H-top);
                --center: anchor(--anchor-name 100%);
              }

              #target {
                top: var(--center-top-EnmDEkZ5mBLp);
              }

            */
          const propUuid = `${prop}-${nanoid(12)}`;

          // If this is a custom property which was assigned a value from
          // another custom property (and not a direct reference to an anchor
          // fn), we want to replace the reference to its "parent" property with
          // a direct reference to the resolved value of the parent property for
          // this given inset property (e.g. top or left). We do this
          // recursively back up the chain of references...
          if (referencedFns.length) {
            const ancestorProps = new Set([child.name]);
            while (ancestorProps.size > 0) {
              for (const propToCheck of ancestorProps) {
                const mapping = customPropsMapping[propToCheck];
                if (mapping?.names?.length && mapping?.uuids?.length) {
                  for (const name of mapping.names) {
                    for (const uuid of mapping.uuids) {
                      // Top-level key (`uuid`) is the original uuid to find in
                      // the updated CSS
                      customPropReplacements[uuid] = {
                        ...customPropReplacements[uuid],
                        // - `key` (`propUuid`) is the inset-property-specific
                        //   uuid to append to the new custom property name
                        // - `value` is the new inset-property-specific custom
                        //   property value to use
                        [propUuid]: `${name}-${propUuid}`,
                      };
                    }
                  }
                }
                ancestorProps.delete(propToCheck);
                // Check (recursively) for custom properties up the chain...
                if (mapping?.names?.length) {
                  mapping.names.forEach((n) => ancestorProps.add(n));
                }
              }
            }
          }

          // When `anchor()` is used multiple times in different inset
          // properties, the value will be different each time. So we append
          // the property to the uuid, and update the CSS property to point
          // to the new uuid...
          for (const anchorFnData of [...anchorFns, ...referencedFns]) {
            const data = { ...anchorFnData };
            const uuidWithProp = `--anchor-${nanoid(12)}-${prop}`;
            const uuid = data.uuid;
            data.uuid = uuidWithProp;
            anchorFunctions[rule.value] = {
              ...anchorFunctions[rule.value],
              [prop]: [...(anchorFunctions[rule.value]?.[prop] ?? []), data],
            };
            // Store new name with declaration prop appended,
            // so that we can go back and update the original custom
            // property value...
            // Top-level key (`uuid`) is the original uuid to find in
            // the updated CSS:
            customPropReplacements[uuid] = {
              ...customPropReplacements[uuid],
              // - `key` (`propUuid`) is the inset-property-specific
              //   uuid to append to the new custom property name
              // - `value` is the new inset-property-specific custom
              //   property value to use
              [propUuid]: uuidWithProp,
            };
          }
          // Update CSS property to new name with declaration prop added
          child.name = `${child.name}-${propUuid}`;
          changed = true;
        }
      },
    });
    if (changed) {
      // Update CSS
      styleObj.css = csstree.generate(ast);
      styleObj.changed = true;
    }
  }

  // Add new CSS custom properties, and restore original values of
  // previously-replaced custom properties
  if (Object.keys(customPropReplacements).length > 0) {
    for (const styleObj of styleData) {
      let changed = false;
      const ast = getAST(styleObj.css);
      csstree.walk(ast, {
        visit: 'Function',
        enter(node) {
          if (
            isVarFunction(node) &&
            (node.children.first as csstree.Identifier)?.name?.startsWith(
              '--',
            ) &&
            this.declaration?.property?.startsWith('--') &&
            this.block
          ) {
            const child = node.children.first as csstree.Identifier;
            const positions = customPropReplacements[child.name];
            if (positions) {
              for (const [propUuid, value] of Object.entries(positions)) {
                // Add new inset-property-specific declarations
                this.block.children.appendData({
                  type: 'Declaration',
                  important: false,
                  property: `${this.declaration.property}-${propUuid}`,
                  value: {
                    type: 'Raw',
                    value: csstree
                      .generate(this.declaration.value)
                      .replace(`var(${child.name})`, `var(${value})`),
                  },
                });
                changed = true;
              }
            }
            if (customPropOriginals[child.name]) {
              // Restore original (now unused) CSS custom property value
              this.declaration.value = {
                type: 'Raw',
                value: customPropOriginals[child.name],
              };
              changed = true;
            }
          }
        },
      });
      if (changed) {
        // Update CSS
        styleObj.css = csstree.generate(ast);
        styleObj.changed = true;
      }
    }
  }

  // Merge data together under target-element selector key
  const validPositions: AnchorPositions = {};

  // Store any `position-fallback` declarations
  for (const [targetSel, fallbackName] of Object.entries(fallbackNames)) {
    const positionFallbacks = fallbacks[fallbackName];
    if (positionFallbacks) {
      const targetEl: HTMLElement | null = document.querySelector(targetSel);
      // Populate `anchorEl` for each fallback `anchor()` fn
      positionFallbacks.forEach((tryBlock) => {
        for (const [prop, value] of Object.entries(tryBlock)) {
          if (typeof value === 'object') {
            const anchorEl = getAnchorEl(targetEl, value as AnchorFunction);
            (tryBlock[prop] as AnchorFunction).anchorEl = anchorEl;
          }
        }
      });
      validPositions[targetSel] = {
        fallbacks: positionFallbacks,
      };
    }
  }

  // Store any `anchor()` fns
  for (const [targetSel, anchorFns] of Object.entries(anchorFunctions)) {
    const targetEl: HTMLElement | null = document.querySelector(targetSel);
    for (const [targetProperty, anchorObjects] of Object.entries(anchorFns)) {
      for (const anchorObj of anchorObjects) {
        const anchorEl = getAnchorEl(targetEl, anchorObj);
        // Populate `anchorEl` for each `anchor()` fn
        validPositions[targetSel] = {
          ...validPositions[targetSel],
          declarations: {
            ...validPositions[targetSel]?.declarations,
            [targetProperty]: [
              ...(validPositions[targetSel]?.declarations?.[
                targetProperty as InsetProperty
              ] ?? []),
              {
                ...anchorObj,
                anchorEl,
              },
            ],
          },
        };
      }
    }
  }

  return validPositions;
}
