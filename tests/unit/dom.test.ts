import { querySelectorAllScoped } from '../../src/dom.js';

describe('querySelectorAllScoped', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scopes each selector to the tree (root) it was authored in', () => {
    document.body.innerHTML = `
      <div class="target" id="light-target"></div>
      <div id="host"></div>
    `;
    const lightTarget = document.getElementById('light-target')!;
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div class="target" id="shadow-target"></div>';
    const shadowTarget = shadow.getElementById('shadow-target')!;

    // A selector authored in the document only resolves within the document.
    expect(
      querySelectorAllScoped([{ selector: '.target', root: document }]),
    ).toEqual([lightTarget]);

    // The same selector authored in the shadow root only resolves there.
    expect(
      querySelectorAllScoped([{ selector: '.target', root: shadow }]),
    ).toEqual([shadowTarget]);

    // Selectors from different roots each resolve within their own tree.
    expect(
      querySelectorAllScoped([
        { selector: '.target', root: document },
        { selector: '.target', root: shadow },
      ]),
    ).toEqual([lightTarget, shadowTarget]);
  });

  it('resolves `:host` against the shadow root host element', () => {
    document.body.innerHTML = '<div id="host" class="card"></div>';
    const host = document.getElementById('host')!;
    const shadow = host.attachShadow({ mode: 'open' });

    expect(
      querySelectorAllScoped([{ selector: ':host', root: shadow }]),
    ).toEqual([host]);
    expect(
      querySelectorAllScoped([{ selector: ':host(.card)', root: shadow }]),
    ).toEqual([host]);
    expect(
      querySelectorAllScoped([{ selector: ':host(.other)', root: shadow }]),
    ).toEqual([]);
  });

  it('collapses duplicate matches for selectors sharing a root', () => {
    document.body.innerHTML = '<div class="a b" id="el"></div>';
    const el = document.getElementById('el')!;

    // `.a` and `.a.b` both match the same element; like a comma-separated
    // `querySelectorAll`, the element is only returned once.
    expect(
      querySelectorAllScoped([
        { selector: '.a', root: document },
        { selector: '.a.b', root: document },
      ]),
    ).toEqual([el]);
  });
});
