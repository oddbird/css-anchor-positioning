import * as csstree from 'css-tree';

export interface DeclarationWithValue extends csstree.Declaration {
  value: csstree.Value;
}

export function getAST(cssText: string) {
  const ast = csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseRulePrelude: false,
    parseCustomProperty: true,
  });

  return ast;
}

export function getDeclarationValue(node: DeclarationWithValue) {
  return (node.value.children.first as csstree.Identifier).name;
}

export interface StyleData {
  el: HTMLElement;
  css: string;
  url?: URL;
  changed?: boolean;
}
