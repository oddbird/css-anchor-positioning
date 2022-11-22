import { transformCSS } from '../../src/transform.js';

describe('transformCSS', () => {
  beforeAll(() => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('/updated.css');
  });

  it('parses and removes new anchor positioning CSS after transformation to JS', () => {
    document.head.innerHTML = `
      <link type="text/css" href="/sample.css"/>
      <style>
        p { color: red; }
      </style>
    `;
    document.body.innerHTML = `
      <div id="div" data-anchor-polyfill="key" style="color: red;" />
      <div id="div2" data-anchor-polyfill="key2" style="color: red;" />
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
        css: '[data-anchor-polyfill="key"]{color:blue;}',
        changed: true,
      },
      {
        el: div2,
        css: '[data-anchor-polyfill="key2"]{color:blue;}',
        changed: false,
      },
    ];
    transformCSS(styleData);

    expect(link.href).toContain('/updated.css');
    expect(style.innerHTML).toBe('html { padding: 0; }');
    expect(div.style.color).toBe('blue');
    expect(div2.style.color).toBe('red');
  });
});
