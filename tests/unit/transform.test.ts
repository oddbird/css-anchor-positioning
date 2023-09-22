import { INLINE_STYLES_ID_ATTR } from '../../src/constants.js';
import { transformCSS } from '../../src/transform.js';

describe('transformCSS', () => {
  beforeAll(() => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('/updated.css');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('parses and removes new anchor positioning CSS after transformation to JS', async () => {
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css"/>
      <style>
        p { color: red; }
      </style>
    `;
    document.body.innerHTML = `
      <div id="div" ${INLINE_STYLES_ID_ATTR}="key" style="--foo: var(--bar); color: red;" />
      <div id="div2" ${INLINE_STYLES_ID_ATTR}="key2" style="color: red;" />
    `;
    let link = document.querySelector('link') as HTMLLinkElement;
    const style = document.querySelector('style') as HTMLStyleElement;
    const div = document.getElementById('div') as HTMLDivElement;
    const div2 = document.getElementById('div2') as HTMLDivElement;
    const styleData = [
      {
        el: link,
        css: 'html { margin: 0; }',
        changed: true,
        original: 'html { margin: 1; }',
        url: new URL(link.href, document.baseURI),
      },
      {
        el: style,
        css: 'html { padding: 0; }',
        changed: true,
        original: 'p { color: red; }',
      },
      {
        el: div,
        css: `[${INLINE_STYLES_ID_ATTR}="key"]{color:blue;}`,
        changed: true,
        original: '--foo: var(--bar); color: red;',
      },
      {
        el: div2,
        css: `[${INLINE_STYLES_ID_ATTR}="key2"]{color:red;}`,
        changed: false,
        original: 'color: red;',
      },
    ];
    const inlineStyles = new Map();
    inlineStyles.set(div, { '--foo': '--bar' });
    const promise = transformCSS(styleData, inlineStyles);
    link = document.querySelector('link') as HTMLLinkElement;
    link.dispatchEvent(new Event('load'));
    await promise;

    expect(link.href).toContain('/updated.css');
    expect(style.innerHTML).toBe('html { padding: 0; }');
    expect(div.getAttribute('style')).toBe('--foo: var(--bar); color:blue;');
    expect(div2.getAttribute('style')).toBe('color: red;');
    expect(div.hasAttribute(INLINE_STYLES_ID_ATTR)).toBeFalsy();
    expect(div2.hasAttribute(INLINE_STYLES_ID_ATTR)).toBeFalsy();
  });
});
