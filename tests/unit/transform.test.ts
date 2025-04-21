import { transformCSS } from '../../src/transform.js';

describe('transformCSS', () => {
  it('parses and removes new anchor positioning CSS after transformation to JS', async () => {
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css" data-link="true" crossorigin="anonymous" />
      <style>
        p { color: red; }
      </style>
    `;
    document.body.innerHTML = `
      <div id="div" data-has-inline-styles="key" style="--foo: var(--bar); color: red;" />
      <div id="div2" data-has-inline-styles="key2" style="color: red;" />
    `;
    const link = document.querySelector('link') as HTMLLinkElement;
    const style = document.querySelector('style') as HTMLStyleElement;
    const div = document.getElementById('div') as HTMLDivElement;
    const div2 = document.getElementById('div2') as HTMLDivElement;
    const styleData = [
      { el: link, css: 'html { margin: 0; }', changed: true },
      { el: style, css: 'html { padding: 0; }', changed: true },
      {
        el: div,
        css: '[data-has-inline-styles="key"]{color:blue;}',
        changed: true,
      },
      {
        el: div2,
        css: '[data-has-inline-styles="key2"]{color:blue;}',
        changed: false,
      },
    ];
    const inlineStyles = new Map();
    inlineStyles.set(div, { '--foo': '--bar' });
    await transformCSS(styleData, inlineStyles, true);

    expect(link.isConnected).toBe(false);
    const newLink = document.querySelector(
      'style[data-original-href]',
    ) as HTMLStyleElement;
    expect(newLink.getAttribute('data-link')).toBe('true');
    expect(newLink.getAttribute('crossorigin')).toBeNull();
    expect(newLink.textContent).toBe('html { margin: 0; }');

    expect(style.innerHTML).toBe('html { padding: 0; }');
    expect(div.getAttribute('style')).toBe('--foo: var(--bar); color:blue;');
    expect(div2.getAttribute('style')).toBe('color: red;');
    expect(div.hasAttribute('data-has-inline-styles')).toBeFalsy();
    expect(div2.hasAttribute('data-has-inline-styles')).toBeFalsy();
  });

  it('preserves id, media, and title attributes when replacing link elements', async () => {
    document.head.innerHTML = `
      <link id="the-link" media="screen" title="stylish" rel="stylesheet" href="/sample.css"/>
    `;
    const link = document.querySelector('link') as HTMLLinkElement;
    const styleData = [{ el: link, css: 'html { margin: 0; }', changed: true }];
    const inlineStyles = new Map();
    const initialStyleElement = document.querySelector('style');
    expect(initialStyleElement).toBe(null);
    await transformCSS(styleData, inlineStyles, true);
    const transformedStyleElement = document.querySelector(
      'style',
    ) as HTMLStyleElement;
    expect(transformedStyleElement.id).toBe('the-link');
    expect(transformedStyleElement.media).toBe('screen');
    expect(transformedStyleElement.title).toBe('stylish');

    const transformedLink = document.querySelector('link') as HTMLLinkElement;
    expect(transformedLink).toBe(null);
  });

  it('creates new style elements for created styles', async () => {
    document.head.innerHTML = ``;
    const styleData = [
      {
        el: document.createElement('link'),
        css: 'html { margin: 0; }',
        changed: true,
        created: true,
      },
    ];
    await transformCSS(styleData, undefined, true);

    const createdStyleElement = document.querySelector(
      'style',
    ) as HTMLStyleElement;
    expect(createdStyleElement.hasAttribute('data-original-href')).toBe(false);
    expect(createdStyleElement.hasAttribute('data-generated-by-polyfill')).toBe(
      true,
    );
    expect(createdStyleElement.textContent).toBe('html { margin: 0; }');
  });
});
