import { type StyleData } from '../../src/fetch.js';
import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

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

  it('handles duplicate anchor-names', async () => {
    document.body.innerHTML =
      '<div style="position: relative"><div id="f1"></div><div id="a2"></div></div>';
    const anchorEl = document.getElementById('a2');
    const css = `
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
    `;
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
    const css = `
      .anchor {
        anchor-name: --anchor;
      }

      .target {
        position: absolute;
        top: anchor(--anchor bottom);
      }
    `;
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
              anchorEl: document.getElementById('a1'),
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

  it('parses `@position-fallback` strategy', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="my-target-fallback" style="position: absolute"></div>
        <div id="my-anchor-fallback"></div>
      </div>
    `;
    const anchorEl = document.getElementById('my-anchor-fallback');
    const css = getSampleCSS('position-fallback');
    const { rules } = await parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-fallback': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              targetEl: document.getElementById('my-target-fallback'),
              anchorSide: 'right',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              targetEl: document.getElementById('my-target-fallback'),
              anchorSide: 25,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
        fallbacks: [
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'right',
              fallbackValue: '10px',
              uuid: expect.any(String),
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          },
          {
            right: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            bottom: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'right',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            width: '35px',
            height: '40px',
          },
        ],
      },
    };

    expect(rules).toEqual(expected);
  });

  it('parses `@position-fallback` with unknown anchor name', async () => {
    document.body.innerHTML = `
      <div style="position: relative">
        <div id="my-target-fallback" style="position: absolute"></div>
        <div id="my-anchor-fallback"></div>
      </div>
    `;
    const css = `
      #my-target-fallback {
        position: absolute;
        position-fallback: --fallback1;
      }

      @position-fallback --fallback1 {
        @try {
          left: anchor(--my-anchor-fallback right, 10px);
          top: anchor(--my-anchor-fallback top);
        }
      }
    `;
    const { rules } = await parseCSS([{ css }] as StyleData[]);

    const expected = {
      '#my-target-fallback': {
        fallbacks: [
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl: null,
              anchorSide: 'right',
              fallbackValue: '10px',
              uuid: expect.any(String),
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: null,
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          },
        ],
      },
    };

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
});
