import { transformCSS } from '../../src/transform.js';

describe('transformCSS', () => {
  beforeAll(() => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('/updated.css');
  });

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
    let link = document.querySelector('link') as HTMLLinkElement;
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
    const promise = transformCSS(styleData, inlineStyles, true);
    link = document.querySelector('link') as HTMLLinkElement;
    link.dispatchEvent(new Event('load'));
    await promise;

    expect(link.href).toContain('/updated.css');
    expect(link.getAttribute('data-link')).toBe('true');
    expect(link.getAttribute('crossorigin')).toBeNull();
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
    let link = document.querySelector('link') as HTMLLinkElement;
    const styleData = [{ el: link, css: 'html { margin: 0; }', changed: true }];
    const inlineStyles = new Map();
    const promise = transformCSS(styleData, inlineStyles, true);
    link = document.querySelector('link') as HTMLLinkElement;
    link.dispatchEvent(new Event('load'));
    await promise;

    expect(link.href).toContain('/updated.css');
    expect(link.id).toBe('the-link');
    expect(link.media).toBe('screen');
    expect(link.title).toBe('stylish');
  });
});
