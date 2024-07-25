import { type AnchorPositions, parseCSS } from '../../src/parse.js';
import { type StyleData } from '../../src/utils.js';
import {
  cascadeCSSForTest,
  getSampleCSS,
  sampleBaseCSS,
} from './../helpers.js';

describe('parseCSS', () => {
  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('handles css with no `anchor()` fn', async () => {
    const { rules } = await parseCSS([{ css: sampleBaseCSS }] as StyleData[]);

    expect(rules).toEqual({});
  });

  it('parses `anchor()` function', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="my-target-positioning" class="target">Target</div>
        <div id="my-anchor-positioning" class="anchor">Anchor</div>
      </div>
    `;
    const anchorEl = document.getElementById('my-anchor-positioning');
    const targetEl = document.getElementById('my-target-positioning');
    const css = getSampleCSS('anchor-positioning');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);

    const expected = {
      '#my-target-positioning': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor-positioning',
              anchorEl,
              targetEl,
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          right: [
            {
              anchorName: '--my-anchor-positioning',
              anchorEl,
              targetEl,
              anchorSide: 'right',
              fallbackValue: '50px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` (implicit name via `anchor` attr)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-implicit-anchor"></div>' +
      '<div id="my-implicit-target" anchor="my-implicit-anchor"></div></div>';
    const css = getSampleCSS('anchor-implicit');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-implicit-target': {
        declarations: {
          right: [
            {
              anchorName: undefined,
              customPropName: undefined,
              anchorEl: document.getElementById('my-implicit-anchor'),
              targetEl: document.getElementById('my-implicit-target'),
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorName: undefined,
              customPropName: undefined,
              anchorEl: document.getElementById('my-implicit-anchor'),
              targetEl: document.getElementById('my-implicit-target'),
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` (name set via custom property)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-target-name-prop"></div>' +
      '<div id="my-anchor-name-prop"></div></div>';
    const css = getSampleCSS('anchor-name-custom-prop');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-name-prop': {
        declarations: {
          right: [
            {
              customPropName: '--anchor-var',
              anchorEl: document.getElementById('my-anchor-name-prop'),
              targetEl: document.getElementById('my-target-name-prop'),
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorSide: 'top',
              anchorEl: document.getElementById('my-anchor-name-prop'),
              targetEl: document.getElementById('my-target-name-prop'),
              customPropName: '--anchor-var',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function with unknown anchor name', async () => {
    document.body.innerHTML = '<div id="f1"></div>';
    const css = `
      #f1 {
        position: absolute;
        top: anchor(--my-anchor bottom);
      }
    `;
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#f1': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor',
              anchorEl: null,
              targetEl: document.getElementById('f1'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `position-anchor` on different selector', async () => {
    document.body.innerHTML = `
    <div style="position: relative">
      <div id="my-anchor"></div>
      <div id="my-target-1" class="my-targets"></div>
      <div id="my-target-2" class="my-targets"></div>
    </div>`;
    const css = cascadeCSSForTest(`
      #my-target-1 {
        top: anchor(bottom);
      }
      #my-target-2 {
        bottom: anchor(top);
      }
      .my-targets {
        position: absolute;
        position-anchor: --my-anchor;
      }
      #my-anchor {
        anchor-name: --my-anchor;
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-1': {
        declarations: {
          top: [
            {
              anchorName: undefined,
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target-1'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
      '#my-target-2': {
        declarations: {
          bottom: [
            {
              anchorName: undefined,
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target-2'),
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };
    expect(rules).toEqual(expected);
  });

  it('parses `position-anchor` declared multiple times', async () => {
    document.body.innerHTML = `
    <div style="position: relative">
      <div id="my-anchor"></div>
      <div id="my-target-1"></div>
      <div id="my-target-2"></div>
    </div>`;
    const css = cascadeCSSForTest(`
      #my-target-1 {
        top: anchor(bottom);
        position-anchor: --my-anchor;
        position: absolute;
      }
      #my-target-2 {
        bottom: anchor(top);
        position-anchor: --my-anchor;
        position: absolute;
      }
      #my-anchor {
        anchor-name: --my-anchor;
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-1': {
        declarations: {
          top: [
            {
              anchorName: undefined,
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target-1'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
      '#my-target-2': {
        declarations: {
          bottom: [
            {
              anchorName: undefined,
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target-2'),
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };
    expect(rules).toEqual(expected);
  });

  it('handles duplicate anchor-names', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="f1"></div><div id="a2"></div></div>';
    const anchorEl = document.getElementById('a2');
    const css = cascadeCSSForTest(`
      #a1 {
        anchor-name: --my-anchor;
      }
      #a2 {
        anchor-name: --my-anchor;
      }
      #f1 {
        position: absolute;
        top: anchor(--my-anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#f1': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor',
              anchorEl,
              targetEl: document.getElementById('f1'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function (custom properties)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-target"></div><div id="my-anchor"></div></div>';
    const css = getSampleCSS('anchor');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target': {
        declarations: {
          right: [
            {
              anchorName: '--my-anchor',
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target'),
              anchorSide: 100,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          top: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById('my-anchor'),
              targetEl: document.getElementById('my-target'),
              anchorName: '--my-anchor',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function (custom property passed through)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-target-props"></div><div id="my-anchor-props"></div></div>';
    const css = getSampleCSS('anchor-custom-props');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-props': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-props',
              anchorEl: document.getElementById('my-anchor-props'),
              targetEl: document.getElementById('my-target-props'),
              anchorSide: 50,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById('my-anchor-props'),
              targetEl: document.getElementById('my-target-props'),
              anchorName: '--my-anchor-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function (multiple duplicate custom properties)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="target-duplicate-custom-props"></div><div id="anchor-duplicate-custom-props"></div></div>';
    const css = getSampleCSS('anchor-duplicate-custom-props');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#target-duplicate-custom-props': {
        declarations: {
          top: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
              ),
              targetEl: document.getElementById(
                'target-duplicate-custom-props',
              ),
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorSide: 100,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
              ),
              targetEl: document.getElementById(
                'target-duplicate-custom-props',
              ),
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          left: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
              ),
              targetEl: document.getElementById(
                'target-duplicate-custom-props',
              ),
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorSide: 100,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
              ),
              targetEl: document.getElementById(
                'target-duplicate-custom-props',
              ),
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor-name` with a list of names', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-anchor-name-list"></div><div id="my-target-name-list-a"></div><div id="my-target-name-list-b"></div></div>';
    const css = getSampleCSS('anchor-name-list');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-name-list-a': {
        declarations: {
          right: [
            {
              anchorSide: 'left',
              anchorEl: document.getElementById('my-anchor-name-list'),
              targetEl: document.getElementById('my-target-name-list-a'),
              anchorName: '--my-anchor-name-a',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorSide: 'top',
              anchorEl: document.getElementById('my-anchor-name-list'),
              targetEl: document.getElementById('my-target-name-list-a'),
              anchorName: '--my-anchor-name-a',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
      '#my-target-name-list-b': {
        declarations: {
          left: [
            {
              anchorSide: 'right',
              anchorEl: document.getElementById('my-anchor-name-list'),
              targetEl: document.getElementById('my-target-name-list-b'),
              anchorName: '--my-anchor-name-b',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          top: [
            {
              anchorSide: 'bottom',
              anchorEl: document.getElementById('my-anchor-name-list'),
              targetEl: document.getElementById('my-target-name-list-b'),
              anchorName: '--my-anchor-name-b',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function (math)', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="my-target-math"></div><div id="my-anchor-math"></div></div>';
    const css = getSampleCSS('anchor-math');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-math': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-math',
              anchorEl: document.getElementById('my-anchor-math'),
              targetEl: document.getElementById('my-target-math'),
              anchorSide: 100,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          top: [
            {
              anchorSide: 100,
              anchorEl: document.getElementById('my-anchor-math'),
              targetEl: document.getElementById('my-target-math'),
              anchorName: '--my-anchor-math',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor()` function with multiple anchors/targets', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="a1" class="anchor"></div>
        <div id="t1" class="target"></div>
      </div>
      <div style="position: relative">
        <div id="a2" class="anchor"></div>
        <div id="t2" class="target"></div>
      </div>
      <div id="t3" class="target"></div>
      <div style="position: absolute">
        <div id="t4" class="target"></div>
      </div>
    `;
    const css = cascadeCSSForTest(`
      .anchor {
        anchor-name: --anchor;
      }

      .target {
        position: absolute;
        top: anchor(--anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '.target': {
        declarations: {
          top: [
            {
              anchorName: '--anchor',
              anchorEl: document.getElementById('a1'),
              targetEl: document.getElementById('t1'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorName: '--anchor',
              anchorEl: document.getElementById('a2'),
              targetEl: document.getElementById('t2'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorName: '--anchor',
              anchorEl: document.getElementById('a2'),
              targetEl: document.getElementById('t3'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorName: '--anchor',
              anchorEl: null,
              targetEl: document.getElementById('t4'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `anchor-size()` function', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="my-target-size" class="target">Target</div>
        <div id="my-anchor-size" class="anchor">Anchor</div>
      </div>
    `;
    const anchorEl = document.getElementById('my-anchor-size');
    const css = getSampleCSS('anchor-size');
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);

    const expected = {
      '#my-target-size': {
        declarations: {
          width: [
            {
              anchorName: '--my-anchor',
              anchorEl,
              targetEl: document.getElementById('my-target-size'),
              anchorSide: undefined,
              anchorSize: 'width',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `@position-fallback`', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="my-target-fallback" style="position: absolute"></div>
        <div id="my-anchor-fallback"></div>
      </div>
    `;
    const css = getSampleCSS('position-fallback');
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected: AnchorPositions = {
      '#my-target-fallback': {
        fallbacks: [
          {
            uuid: expect.any(String),
            declarations: {
              bottom: 'anchor(--my-anchor-fallback top)',
              left: 'anchor(--my-anchor-fallback left)',
            },
          },
          {
            uuid: expect.any(String),
            declarations: {
              top: 'anchor(--my-anchor-fallback bottom)',
              left: 'anchor(--my-anchor-fallback left)',
            },
          },
          {
            uuid: expect.any(String),
            declarations: {
              bottom: 'anchor(--my-anchor-fallback top)',
              right: 'anchor(--my-anchor-fallback right)',
            },
          },
          {
            uuid: expect.any(String),
            declarations: {
              top: 'anchor(--my-anchor-fallback bottom)',
              right: 'anchor(--my-anchor-fallback right)',
              width: '100px',
              height: '100px',
            },
          },
        ],
      },
    };
    for (const { uuid } of rules['#my-target-fallback']?.fallbacks ?? []) {
      expected[`[data-anchor-polyfill="${uuid}"]`] = {
        declarations: expect.any(Object),
      };
    }

    expect(rules).toEqual(expected);
  });

  it('handles invalid/missing `position-fallback`', async () => {
    const css = `
      #target {
        position: absolute;
        position-fallback: --fallback;
      }
    `;
    const { rules } = await parseCSS([{ css }] as StyleData[]);

    expect(rules).toEqual({});
  });

  it('respects `anchor-scope` when matching', async () => {
    document.body.innerHTML = `
      <ul>
        <li><span class="positioned"></span></li>
        <li><span class="positioned"></span></li>
      </ul>
    `;
    const css = cascadeCSSForTest(`
      li {
        anchor-name: --list-item;
        anchor-scope: --list-item;
      }
      li .positioned {
        position: absolute;
        top: anchor(--list-item bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const li = document.querySelectorAll('li');
    const positioned = document.querySelectorAll<HTMLElement>('.positioned');
    const expected: AnchorPositions = {
      'li .positioned': {
        declarations: {
          top: [
            {
              anchorName: '--list-item',
              anchorEl: li[0],
              targetEl: positioned[0],
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorName: '--list-item',
              anchorEl: li[1],
              targetEl: positioned[1],
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('does not allow matches from outside declaration `anchor-scope`', async () => {
    document.body.innerHTML = `
      <div class="scope anchor"></div>
      <div class="positioned"></div>
    `;
    const css = cascadeCSSForTest(`
      .scope {
        anchor-scope: all;
      }
      .anchor {
        anchor-name: --scoped-anchor;
      }
      .positioned {
        position: absolute;
        top: anchor(--scoped-anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected: AnchorPositions = {
      '.positioned': {
        declarations: {
          top: [
            {
              anchorName: '--scoped-anchor',
              anchorEl: null,
              targetEl: document.querySelector<HTMLElement>('.positioned'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('does not allow matching anchor declared in an inner `anchor-scope`', async () => {
    document.body.innerHTML = `
      <div class="scope">
        <div class="anchor"></div>
        <div class="scope anchor"></div>
        <div class="positioned"></div>
      </div>
    `;
    const css = cascadeCSSForTest(`
      .scope {
        anchor-scope: all;
      }
      .anchor {
        anchor-name: --scoped-anchor;
      }
      .positioned {
        position: absolute;
        top: anchor(--scoped-anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected: AnchorPositions = {
      '.positioned': {
        declarations: {
          top: [
            {
              anchorName: '--scoped-anchor',
              anchorEl: document.querySelector<HTMLElement>('.anchor'),
              targetEl: document.querySelector<HTMLElement>('.positioned'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('does not allow matching anchor declared in an outer `anchor-scope`', async () => {
    document.body.innerHTML = `
      <div class="scope">
        <div class="anchor"></div>
        <div class="scope positioned"></div>
      </div>
    `;
    const css = cascadeCSSForTest(`
      .scope {
        anchor-scope: --scoped-anchor;
      }
      .anchor {
        anchor-name: --scoped-anchor;
      }
      .positioned {
        position: absolute;
        top: anchor(--scoped-anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected: AnchorPositions = {
      '.positioned': {
        declarations: {
          top: [
            {
              anchorName: '--scoped-anchor',
              anchorEl: null,
              targetEl: document.querySelector<HTMLElement>('.positioned'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('should respect cascade when determining `anchor-scope`', async () => {
    document.body.innerHTML = `
      <div class="scope anchor"></div>
      <div class="positioned"></div>
    `;
    const css = cascadeCSSForTest(`
      .scope {
        anchor-scope: --scoped-anchor;
      }
      .anchor {
        anchor-name: --scoped-anchor;
        anchor-scope: none;
      }
      .positioned {
        position: absolute;
        top: anchor(--scoped-anchor bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '.positioned': {
        declarations: {
          top: [
            {
              anchorName: '--scoped-anchor',
              anchorEl: document.querySelector<HTMLElement>('.anchor'),
              targetEl: document.querySelector<HTMLElement>('.positioned'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });

  it('should respect cascade when determining `anchor-name`', async () => {
    document.body.innerHTML = `
      <div class="anchor"></div>
      <div class="positioned"></div>
    `;
    const css = cascadeCSSForTest(`
      .anchor {
        anchor-name: --name;
      }
      .anchor {
        anchor-name: --other-name;
      }
      .positioned {
        position: absolute;
        top: anchor(--name bottom);
      }
    `);
    document.head.innerHTML = `<style>${css}</style>`;
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '.positioned': {
        declarations: {
          top: [
            {
              anchorName: '--name',
              anchorEl: null,
              targetEl: document.querySelector<HTMLElement>('.positioned'),
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(rules).toEqual(expected);
  });
});
