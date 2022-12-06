import { type StyleData } from '../../src/fetch.js';
import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

describe('parseCSS', () => {
  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('handles css with no `anchor()` fn', () => {
    const result = parseCSS([{ css: sampleBaseCSS }] as StyleData[]);

    expect(result).toEqual({});
  });

  it('parses `anchor()` function', () => {
    document.body.innerHTML =
      '<div id="my-target-positioning"></div><div id="my-anchor-positioning"></div>';
    const anchorEl = document.getElementById('my-anchor-positioning');
    const css = getSampleCSS('anchor-positioning');
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-positioning': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor-positioning',
              anchorEl,
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          right: [
            {
              anchorName: '--my-anchor-positioning',
              anchorEl,
              anchorSide: 'right',
              fallbackValue: '50px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` (implicit name via `anchor` attr)', () => {
    document.body.innerHTML =
      '<div id="my-implicit-anchor"></div>' +
      '<div id="my-implicit-target" anchor="my-implicit-anchor"></div>';
    const css = getSampleCSS('anchor-implicit');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-implicit-target': {
        declarations: {
          right: [
            {
              anchorName: undefined,
              customPropName: undefined,
              anchorEl: document.getElementById('my-implicit-anchor'),
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
              anchorSide: 'top',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` (name set via custom property)', () => {
    document.body.innerHTML =
      '<div id="my-target-name-prop"></div>' +
      '<div id="my-anchor-name-prop"></div>';
    const css = getSampleCSS('anchor-name-custom-prop');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-name-prop': {
        declarations: {
          right: [
            {
              customPropName: '--anchor-var',
              anchorEl: document.getElementById('my-anchor-name-prop'),
              anchorSide: 'left',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorSide: 'top',
              anchorEl: document.getElementById('my-anchor-name-prop'),
              customPropName: '--anchor-var',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function with unknown anchor name', () => {
    document.body.innerHTML = '<div id="f1"></div>';
    const css = `
      #f1 {
        position: absolute;
        top: anchor(--my-anchor bottom);
      }
    `;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#f1': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor',
              anchorEl: null,
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('handles duplicate anchor-names', () => {
    document.body.innerHTML = '<div id="f1"></div><div id="a2"></div>';
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
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#f1': {
        declarations: {
          top: [
            {
              anchorName: '--my-anchor',
              anchorEl,
              anchorSide: 'bottom',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function (custom properties)', () => {
    document.body.innerHTML =
      '<div id="my-target"></div><div id="my-anchor"></div>';
    const css = getSampleCSS('anchor');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target': {
        declarations: {
          right: [
            {
              anchorName: '--my-anchor',
              anchorEl: document.getElementById('my-anchor'),
              anchorSide: 100,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          top: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById('my-anchor'),
              anchorName: '--my-anchor',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function (custom property passed through)', () => {
    document.body.innerHTML =
      '<div id="my-target-props"></div><div id="my-anchor-props"></div>';
    const css = getSampleCSS('anchor-custom-props');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-props': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-props',
              anchorEl: document.getElementById('my-anchor-props'),
              anchorSide: 50,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById('my-anchor-props'),
              anchorName: '--my-anchor-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function (multiple duplicate custom properties)', () => {
    document.body.innerHTML =
      '<div id="target-duplicate-custom-props"></div><div id="anchor-duplicate-custom-props"></div>';
    const css = getSampleCSS('anchor-duplicate-custom-props');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#target-duplicate-custom-props': {
        declarations: {
          top: [
            {
              anchorSide: 50,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
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
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
            {
              anchorSide: 100,
              anchorEl: document.getElementById(
                'anchor-duplicate-custom-props',
              ),
              anchorName: '--anchor-duplicate-custom-props',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function (math)', () => {
    document.body.innerHTML =
      '<div id="my-target-math"></div><div id="my-anchor-math"></div>';
    const css = getSampleCSS('anchor-math');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-math': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-math',
              anchorEl: document.getElementById('my-anchor-math'),
              anchorSide: 100,
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          top: [
            {
              anchorSide: 100,
              anchorEl: document.getElementById('my-anchor-math'),
              anchorName: '--my-anchor-math',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `@position-fallback` strategy', () => {
    document.body.innerHTML =
      '<div id="my-target-fallback"></div><div id="my-anchor-fallback"></div>';
    const anchorEl = document.getElementById('my-anchor-fallback');
    const css = getSampleCSS('position-fallback');
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-fallback': {
        declarations: {
          left: [
            {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorSide: 'right',
              fallbackValue: '0px',
              uuid: expect.any(String),
            },
          ],
          bottom: [
            {
              anchorName: '--my-anchor-fallback',
              anchorEl,
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

    expect(result).toEqual(expected);
  });

  it('parses `@position-fallback` with unknown anchor name', () => {
    document.body.innerHTML = '<div id="my-target-fallback"></div>';
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
    const result = parseCSS([{ css }] as StyleData[]);
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

    expect(result).toEqual(expected);
  });

  it('handles invalid/missing `position-fallback`', () => {
    const css = `
      #target {
        position: absolute;
        position-fallback: --fallback;
      }
    `;
    const result = parseCSS([{ css }] as StyleData[]);

    expect(result).toEqual({});
  });
});
