import type {
  CssNode,
  Declaration,
  FunctionNode,
  Identifier,
  List,
  Percentage,
  SelectorList,
} from 'css-tree';
import walk from 'css-tree/walker';
import { nanoid } from 'nanoid/non-secure';

import {
  AnchorScopeValue,
  getCSSPropertyValue,
  type PseudoElement,
  type Selector,
} from './dom.js';
import { parsePositionFallbacks, type PositionTryOrder } from './fallback.js';
import type { AnchorPositioningPolyfillOptions, AnchorPositioningRoot } from './polyfill.js';
import {
  activeWrapperStyles,
  addPositionAreaDeclarationBlockStyles,
  dataForPositionAreaTarget,
  getPositionAreaDeclaration,
  type PositionAreaDeclaration,
  type PositionAreaTargetData,
} from './position-area.js';
import {
  type AcceptedAnchorSizeProperty,
  type AcceptedPositionTryProperty,
  type AnchorSide,
  type AnchorSize,
  type InsetProperty,
  isAcceptedAnchorSizeProp,
  isAnchorSide,
  isAnchorSize,
  isInsetProp,
  isSizingProp,
  type SizingProperty,
} from './syntax.js';
import {
  type DeclarationWithValue,
  generateCSS,
  getAST,
  getSelectors,
  isAnchorFunction,
  type StyleData,
} from './utils.js';
import { validatedForPositioning } from './validate.js';

// `key` is the `anchor-name` value
// `value` is an array of all selectors associated with that `anchor-name`
type AnchorSelectors = Record<string, Selector[]>;

export interface AnchorFunction {
  targetEl?: HTMLElement | null;
  anchorEl?: HTMLElement | PseudoElement | null;
  anchorName?: string;
  anchorSide?: AnchorSide;
  anchorSize?: AnchorSize;
  fallbackValue: string;
  customPropName?: string;
  uuid: string;
}

// - `key` is the property being declared
// - `value` is the anchor-positioning data for that property
// The valid properties for `anchor()` is a subset of the properties that are
// valid for `anchor-size()`, so functional validation should be used as well.
export type AnchorFunctionDeclaration = Partial<
  Record<
    AcceptedAnchorSizeProperty | 'position-area',
    (AnchorFunction | PositionAreaTargetData)[]
  >
>;

// `key` is the target element selector
// `value` is an object with all anchor-function declarations on that element
type AnchorFunctionDeclarations = Record<string, AnchorFunctionDeclaration>;

// `key` is the target element selector
// `value` is the position-area data for that property
type PositionAreaDeclarations = Record<string, PositionAreaDeclaration[]>;

export interface AnchorPosition {
  declarations?: AnchorFunctionDeclaration;
  fallbacks?: TryBlock[];
  order?: PositionTryOrder;
}

// `key` is the target element selector
// `value` is an object with all anchor-positioning data for that element
export type AnchorPositions = Record<string, AnchorPosition>;

export interface TryBlock {
  uuid: string;
  // `key` is the property being declared
  // `value` is the property value
  declarations: Partial<Record<AcceptedPositionTryProperty, string>>;
}

function isAnchorNameDeclaration(node: CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'anchor-name';
}

function isAnchorScopeDeclaration(node: CssNode): node is DeclarationWithValue {
  return node.type === 'Declaration' && node.property === 'anchor-scope';
}

function isAnchorSizeFunction(node: CssNode | null): node is FunctionNode {
  return Boolean(
    node && node.type === 'Function' && node.name === 'anchor-size',
  );
}

function isVarFunction(node: CssNode | null): node is FunctionNode {
  return Boolean(node && node.type === 'Function' && node.name === 'var');
}

export function isIdentifier(node: CssNode): node is Identifier {
  return Boolean(node.type === 'Identifier' && node.name);
}

function isPercentage(node: CssNode): node is Percentage {
  return Boolean(node.type === 'Percentage' && node.value);
}

function parseAnchorFn(
  node: FunctionNode,
  replaceCss?: boolean,
): AnchorFunction {
  let anchorName: string | undefined,
    anchorSide: AnchorSide | undefined,
    anchorSize: AnchorSize | undefined,
    fallbackValue = '',
    foundComma = false,
    customPropName: string | undefined;

  const args: CssNode[] = [];
  node.children.toArray().forEach((child) => {
    if (foundComma) {
      fallbackValue = `${fallbackValue}${generateCSS(child)}`;
      return;
    }
    if (child.type === 'Operator' && child.value === ',') {
      foundComma = true;
      return;
    }
    args.push(child);
  });

  let [name, sideOrSize]: (CssNode | undefined)[] = args;
  if (!sideOrSize) {
    // If we only have one argument assume it is the (required) anchor-side/size
    sideOrSize = name;
    name = undefined;
  }
  if (name) {
    if (isIdentifier(name) && name.name.startsWith('--')) {
      // Store anchor name
      anchorName = name.name;
    } else if (isVarFunction(name) && name.children.first) {
      // Store CSS custom prop for anchor name
      customPropName = (name.children.first as Identifier).name;
    }
  }
  if (sideOrSize) {
    if (isAnchorFunction(node)) {
      if (isIdentifier(sideOrSize) && isAnchorSide(sideOrSize.name)) {
        anchorSide = sideOrSize.name;
      } else if (isPercentage(sideOrSize)) {
        const number = Number(sideOrSize.value);
        anchorSide = Number.isNaN(number) ? undefined : number;
      }
    } else if (
      isAnchorSizeFunction(node) &&
      isIdentifier(sideOrSize) &&
      isAnchorSize(sideOrSize.name)
    ) {
      anchorSize = sideOrSize.name;
    }
  }

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
    anchorSide,
    anchorSize,
    fallbackValue: fallbackValue || '0px',
    customPropName,
    uuid,
  };
}

function getAnchorNames(node: DeclarationWithValue) {
  return (node.value.children as List<Identifier>).map(({ name }) => name);
}

let anchorNames: AnchorSelectors = {};
let anchorScopes: AnchorSelectors = {};
// Mapping of custom property names, to anchor function data objects referenced
// in their values
let customPropAssignments: Record<string, AnchorFunction[]> = {};
// Mapping of custom property names, to the original values that have been
// replaced in the CSS
let customPropOriginals: Record<string, string> = {};
// Top-level key (`uuid`) is the original uuid to find in the updated CSS
// - `key` (`propUuid`) is the new property-specific uuid to append to the
//   original custom property name
// - `value` is the new property-specific custom property value to use
let customPropReplacements: Record<string, Record<string, string>> = {};

// Objects are declared at top-level to keep code cleaner,
// but we reset them on every `parseCSS()` call
// to prevent data leaking from one call to another.
function resetStores() {
  anchorNames = {};
  anchorScopes = {};
  customPropAssignments = {};
  customPropOriginals = {};
  customPropReplacements = {};
}

function getAnchorFunctionData(node: CssNode, declaration: Declaration | null) {
  if ((isAnchorFunction(node) || isAnchorSizeFunction(node)) && declaration) {
    if (declaration.property.startsWith('--')) {
      const original = generateCSS(declaration.value);
      const data = parseAnchorFn(node, true);
      // Store the original anchor function so that we can restore it later
      customPropOriginals[data.uuid] = original;
      customPropAssignments[declaration.property] = [
        ...(customPropAssignments[declaration.property] ?? []),
        data,
      ];
      return { changed: true };
    }
    if (
      (isAnchorFunction(node) && isInsetProp(declaration.property)) ||
      (isAnchorSizeFunction(node) &&
        isAcceptedAnchorSizeProp(declaration.property))
    ) {
      const data = parseAnchorFn(node, true);
      return { prop: declaration.property, data, changed: true };
    }
  }
  return {};
}

async function getAnchorEl(
  targetEl: HTMLElement | null,
  anchorObj: AnchorFunction | null,
  options: { root: AnchorPositioningRoot[] },
) {
  let anchorName = anchorObj?.anchorName;
  const customPropName = anchorObj?.customPropName;
  if (targetEl && !anchorName) {
    const positionAnchorProperty = getCSSPropertyValue(
      targetEl,
      'position-anchor',
    );

    if (positionAnchorProperty) {
      anchorName = positionAnchorProperty;
    } else if (customPropName) {
      anchorName = getCSSPropertyValue(targetEl, customPropName);
    }
  }
  const anchorSelectors = anchorName ? anchorNames[anchorName] || [] : [];
  const allScopeSelectors = anchorName
    ? anchorScopes[AnchorScopeValue.All] || []
    : [];
  const anchorNameScopeSelectors = anchorName
    ? anchorScopes[anchorName] || []
    : [];
  return await validatedForPositioning(
    targetEl,
    anchorName || null,
    anchorSelectors,
    [...allScopeSelectors, ...anchorNameScopeSelectors],
    { root: options.root },
  );
}

export async function parseCSS(
  styleData: StyleData[],
  options: AnchorPositioningPolyfillOptions,
) {
  const anchorFunctions: AnchorFunctionDeclarations = {};
  const positionAreas: PositionAreaDeclarations = {};
  resetStores();

  // Parse `position-try` and related declarations/rules
  const { fallbackTargets, validPositions } = parsePositionFallbacks(styleData);

  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    walk(ast, function (node) {
      const rule = this.rule?.prelude as SelectorList | undefined;
      const selectors = getSelectors(rule);

      // Parse `anchor-name` declaration
      if (isAnchorNameDeclaration(node) && selectors.length) {
        for (const name of getAnchorNames(node)) {
          anchorNames[name] ??= [];
          anchorNames[name].push(...selectors);
        }
      }

      // Parse `anchor-scope` declarations
      if (isAnchorScopeDeclaration(node) && selectors.length) {
        for (const name of getAnchorNames(node)) {
          anchorScopes[name] ??= [];
          anchorScopes[name].push(...selectors);
        }
      }

      // Parse `anchor()` function
      const {
        prop,
        data,
        changed: updated,
      } = getAnchorFunctionData(node, this.declaration);
      if (prop && data && selectors.length) {
        // This will override earlier declarations
        // with the same exact rule selector
        // *and* the same exact declaration property:
        // (e.g. multiple `top: anchor(...)` declarations
        // for the same `.foo {...}` selector)
        for (const { selector } of selectors) {
          anchorFunctions[selector] = {
            ...anchorFunctions[selector],
            [prop]: [...(anchorFunctions[selector]?.[prop] ?? []), data],
          };
        }
      }

      let positionAreaDeclaration: PositionAreaDeclaration | undefined;
      if (this.block) {
        positionAreaDeclaration = getPositionAreaDeclaration(node);
        if (positionAreaDeclaration) {
          addPositionAreaDeclarationBlockStyles(
            positionAreaDeclaration,
            this.block,
          );
          for (const { selector } of selectors) {
            positionAreas[selector] = [
              ...(positionAreas[selector] ?? []),
              positionAreaDeclaration,
            ];
          }
        }
      }
      if (updated || positionAreaDeclaration) {
        changed = true;
      }
    });
    if (changed) {
      // Update CSS
      styleObj.css = generateCSS(ast);
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
      walk(ast, {
        visit: 'Function',
        enter(node) {
          const rule = this.rule?.prelude as SelectorList | undefined;
          const declaration = this.declaration;
          const prop = declaration?.property;
          if (
            rule?.children.isEmpty === false &&
            isVarFunction(node) &&
            declaration &&
            prop &&
            node.children.first &&
            customPropsToCheck.has((node.children.first as Identifier).name) &&
            // For now, we only want assignments to other CSS custom properties
            prop.startsWith('--')
          ) {
            const child = node.children.first as Identifier;
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
            const original = generateCSS(declaration.value);
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
        styleObj.css = generateCSS(ast);
        styleObj.changed = true;
      }
    }
    customPropsToCheck.clear();
    toCheckAgain.forEach((s) => customPropsToCheck.add(s));
  }

  // Then find where CSS custom properties are used in inset/sizing properties:
  for (const styleObj of styleData) {
    let changed = false;
    const ast = getAST(styleObj.css);
    walk(ast, {
      visit: 'Function',
      enter(node) {
        const rule = this.rule?.prelude as SelectorList | undefined;
        const declaration = this.declaration;
        const prop = declaration?.property;

        if (
          rule?.children.isEmpty === false &&
          isVarFunction(node) &&
          declaration &&
          prop &&
          node.children.first &&
          // Now we only want assignments to inset/sizing properties
          (isInsetProp(prop) || isSizingProp(prop))
        ) {
          const child = node.children.first as Identifier;
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
            An anchor (or anchor-size) fn was assigned to an inset (or sizing)
            property.

            It's possible that there are multiple uses of the same CSS
            custom property name, with different anchor function calls
            assigned to them. Instead of trying to figure out which one has
            cascaded to the given location, we iterate over all anchor
            functions that were assigned to the given CSS custom property
            name. For each one, we add a new custom prop with the value
            for that target and inset/sizing property, and let CSS determine
            which one cascades down to where it's used.

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
          // this given inset/sizing property (e.g. top or width). We do this
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
                        // - `key` (`propUuid`) is the property-specific
                        //   uuid to append to the new custom property name
                        // - `value` is the new property-specific custom
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

          // When `anchor()` is used multiple times in different inset/sizing
          // properties, the value will be different each time. So we append
          // the property to the uuid, and update the CSS property to point
          // to the new uuid...
          const selectors = getSelectors(rule);

          for (const anchorFnData of [...anchorFns, ...referencedFns]) {
            const data = { ...anchorFnData };
            const uuidWithProp = `--anchor-${nanoid(12)}-${prop}`;
            const uuid = data.uuid;
            data.uuid = uuidWithProp;

            for (const { selector } of selectors) {
              anchorFunctions[selector] = {
                ...anchorFunctions[selector],
                [prop]: [...(anchorFunctions[selector]?.[prop] ?? []), data],
              };
            }
            // Store new name with declaration prop appended,
            // so that we can go back and update the original custom
            // property value...
            // Top-level key (`uuid`) is the original uuid to find in
            // the updated CSS:
            customPropReplacements[uuid] = {
              ...customPropReplacements[uuid],
              // - `key` (`propUuid`) is the property-specific
              //   uuid to append to the new custom property name
              // - `value` is the new property-specific custom
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
      styleObj.css = generateCSS(ast);
      styleObj.changed = true;
    }
  }

  // Add new CSS custom properties, and restore original values of
  // previously-replaced custom properties
  if (Object.keys(customPropReplacements).length > 0) {
    for (const styleObj of styleData) {
      let changed = false;
      const ast = getAST(styleObj.css);
      walk(ast, {
        visit: 'Function',
        enter(node) {
          if (
            isVarFunction(node) &&
            (node.children.first as Identifier)?.name?.startsWith('--') &&
            this.declaration?.property?.startsWith('--') &&
            this.block
          ) {
            const child = node.children.first as Identifier;
            const positions = customPropReplacements[child.name];
            if (positions) {
              for (const [propUuid, value] of Object.entries(positions)) {
                // Add new property-specific declarations
                this.block.children.appendData({
                  type: 'Declaration',
                  important: false,
                  property: `${this.declaration.property}-${propUuid}`,
                  value: {
                    type: 'Raw',
                    value: generateCSS(this.declaration.value).replace(
                      `var(${child.name})`,
                      `var(${value})`,
                    ),
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
        styleObj.css = generateCSS(ast);
        styleObj.changed = true;
      }
    }
  }

  // Store inline style custom property mappings for each target element
  const inlineStyles = new Map<HTMLElement, Record<string, string>>();
  // Store any `anchor()` fns
  for (const [targetSel, anchorFns] of Object.entries(anchorFunctions)) {
    let targets: NodeListOf<HTMLElement>;
    if (
      targetSel.startsWith('[data-anchor-polyfill=') &&
      fallbackTargets[targetSel]?.length
    ) {
      // If we're dealing with a `@position-try` block,
      // then the targets are places where that `position-fallback` is used.
      targets = options.root![0].querySelectorAll(
        fallbackTargets[targetSel].join(','),
      );
    } else {
      targets = options.root![0].querySelectorAll(targetSel);
    }
    for (const [targetProperty, anchorObjects] of Object.entries(anchorFns) as [
      InsetProperty | SizingProperty,
      AnchorFunction[],
    ][]) {
      for (const anchorObj of anchorObjects) {
        for (const targetEl of targets) {
          // For every target element, find a valid anchor element
          const anchorEl = await getAnchorEl(targetEl, anchorObj, { root: options.root! });
          const uuid = `--anchor-${nanoid(12)}`;
          // Store new mapping, in case inline styles have changed and will
          // be overwritten -- in which case new mappings will be re-added
          inlineStyles.set(targetEl, {
            ...(inlineStyles.get(targetEl) ?? {}),
            [anchorObj.uuid]: uuid,
          });
          // Point original uuid to new uuid
          targetEl.setAttribute(
            'style',
            `${anchorObj.uuid}: var(${uuid}); ${
              targetEl.getAttribute('style') ?? ''
            }`,
          );
          // Populate new data for each anchor/target combo
          validPositions[targetSel] = {
            ...validPositions[targetSel],
            declarations: {
              ...validPositions[targetSel]?.declarations,
              [targetProperty]: [
                ...(validPositions[targetSel]?.declarations?.[
                  targetProperty as InsetProperty
                ] ?? []),
                { ...anchorObj, anchorEl, targetEl, uuid },
              ],
            },
          };
        }
      }
    }
  }

  // Create a new stylesheet for the position-area mapping styles
  const positionAreaMappingStyleElement: StyleData = {
    el: document.createElement('link'),
    changed: false,
    created: true,
    css: '',
  };
  styleData.push(positionAreaMappingStyleElement);

  // We loop through each selector that has been used to apply a position-area
  // declaration, and find all elements that match the selector. The same
  // selector may be used twice, for instance:
  //
  // .foo { position-area: start }
  // .foo { position-area: end }

  for (const [targetSel, positions] of Object.entries(positionAreas)) {
    const targets: NodeListOf<HTMLElement> = options.root![0].querySelectorAll(targetSel);
    for (const targetEl of targets) {
      // For every target element, find a valid anchor element.
      const anchorEl = await getAnchorEl(targetEl, null, { root: options.root! });
      // For every position-area declaration with this selector, create a new
      // UUID, and make sure the target has a wrapper.
      for (const positionData of positions) {
        const targetData = await dataForPositionAreaTarget(
          targetEl,
          positionData,
          anchorEl,
        );
        positionAreaMappingStyleElement.css += activeWrapperStyles(
          targetData.targetUUID,
          positionData.selectorUUID,
        );
        positionAreaMappingStyleElement.changed = true;
        // Populate new data for each anchor/target combo
        validPositions[targetSel] = {
          ...validPositions[targetSel],
          declarations: {
            ...validPositions[targetSel]?.declarations,
            'position-area': [
              ...(validPositions[targetSel]?.declarations?.['position-area'] ??
                []),
              targetData,
            ],
          },
        };
      }
    }
  }

  return { rules: validPositions, inlineStyles, anchorScopes };
}
