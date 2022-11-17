import { type StyleData } from '../../src/fetch.js';
import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

describe('parseCSS', () => {
  afterAll(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('handles missing `@position-fallback` at-rule or `anchor()` fn', () => {
    const result = parseCSS([{ css: sampleBaseCSS }] as StyleData[]);

    expect(result).toEqual({});
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
          top: {
            anchorName: '--my-anchor',
            anchorEl: null,
            anchorEdge: 'bottom',
            fallbackValue: '0px',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
          right: {
            anchorName: '--my-anchor',
            anchorEl: document.getElementById('my-anchor'),
            anchorEdge: 100,
            fallbackValue: '0px',
            original: 'anchor(--my-anchor 100%)',
          },
          top: {
            anchorEdge: 50,
            anchorEl: document.getElementById('my-anchor'),
            anchorName: '--my-anchor',
            fallbackValue: '0px',
            original: 'anchor(--my-anchor 50%)',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
          right: {
            customPropName: '--anchor-var',
            anchorEl: document.getElementById('my-anchor-name-prop'),
            anchorEdge: 'left',
            fallbackValue: '0px',
          },
          bottom: {
            anchorEdge: 'top',
            anchorEl: document.getElementById('my-anchor-name-prop'),
            customPropName: '--anchor-var',
            fallbackValue: '0px',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
  });

  it.skip('parses `anchor()` function (custom property passed through)', () => {
    document.body.innerHTML =
      '<div id="my-target-props"></div><div id="my-anchor-props"></div>';
    const css = getSampleCSS('anchor-custom-props');
    document.head.innerHTML = `<style>${css}</style>`;
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-props': {
        declarations: {
          left: {
            anchorName: '--my-anchor-props',
            anchorEl: document.getElementById('my-anchor-props'),
            anchorEdge: 150,
            fallbackValue: '0px',
            original: 'calc(var(--center) + 100px)',
          },
          top: {
            anchorEdge: 50,
            anchorEl: document.getElementById('my-anchor-props'),
            anchorName: '--my-anchor-props',
            fallbackValue: '0px',
            original: 'anchor(--my-anchor-props 50%)',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
          top: {
            anchorEdge: 50,
            anchorEl: document.getElementById('anchor-duplicate-custom-props'),
            anchorName: '--anchor-duplicate-custom-props',
            fallbackValue: '0px',
            original: 'anchor(--anchor-duplicate-custom-props 50%)',
          },
          left: {
            anchorEdge: 50,
            anchorEl: document.getElementById('anchor-duplicate-custom-props'),
            anchorName: '--anchor-duplicate-custom-props',
            fallbackValue: '0px',
            original: 'anchor(--anchor-duplicate-custom-props 50%)',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
          left: {
            anchorName: '--my-anchor-math',
            anchorEl: document.getElementById('my-anchor-math'),
            anchorEdge: 100,
            fallbackValue: '0px',
            original: 'calc(anchor(--my-anchor-math 100%) - 50px)',
          },
          top: {
            anchorEdge: 100,
            anchorEl: document.getElementById('my-anchor-math'),
            anchorName: '--my-anchor-math',
            fallbackValue: '0px',
            original: 'anchor(--my-anchor-math 100%)',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
  });

  it('parses `anchor()` function (positioning)', () => {
    document.body.innerHTML =
      '<div id="my-target-positioning"></div><div id="my-anchor-positioning"></div>';
    const anchorEl = document.getElementById('my-anchor-positioning');
    const css = getSampleCSS('anchor-positioning');
    const result = parseCSS([{ css }] as StyleData[]);
    const expected = {
      '#my-target-positioning': {
        declarations: {
          top: {
            anchorName: '--my-anchor-positioning',
            anchorEl,
            anchorEdge: 'bottom',
            fallbackValue: '0px',
          },
          right: {
            anchorName: '--my-anchor-positioning',
            anchorEl,
            anchorEdge: 'right',
            fallbackValue: '50px',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
          left: {
            anchorName: '--my-anchor-fallback',
            anchorEl,
            anchorEdge: 'right',
            fallbackValue: '0px',
          },
          bottom: {
            anchorName: '--my-anchor-fallback',
            anchorEl,
            anchorEdge: 25,
            fallbackValue: '0px',
          },
        },
        fallbacks: [
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'right',
              fallbackValue: '10px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            right: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'bottom',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            bottom: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'right',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
            width: '35px',
            height: '40px',
          },
        ],
      },
    };

    expect(result).toMatchObject(expected);
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
              anchorEdge: 'right',
              fallbackValue: '10px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: null,
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
        ],
      },
    };

    expect(result).toMatchObject(expected);
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
          top: {
            anchorName: '--my-anchor',
            anchorEl,
            anchorEdge: 'bottom',
            fallbackValue: '0px',
          },
        },
      },
    };

    expect(result).toMatchObject(expected);
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
