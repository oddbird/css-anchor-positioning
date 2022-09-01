import { parseCSS } from '../../src/parse.js';
import { getSampleCSS, sampleBaseCSS } from './../helpers.js';

describe('parseCSS', () => {
  it('handles missing `@position-fallback` at-rule or `anchor()` fn', () => {
    const result = parseCSS(sampleBaseCSS);

    expect(result).toEqual({});
  });

  it('parses `anchor()` function (math)', () => {
    const css = getSampleCSS('anchor');
    const result = parseCSS(css);
    const expected = {
      '#my-floating': {
        declarations: {
          '--center': {
            anchorName: '--my-anchor',
            anchorEl: ['#my-anchor'],
            anchorEdge: '50%',
            fallbackValue: '0px',
          },
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `anchor()` function (positioning)', () => {
    const css = getSampleCSS('anchor-positioning');
    const result = parseCSS(css);
    const expected = {
      '#my-floating-positioning': {
        declarations: {
          top: {
            anchorName: '--my-anchor-positioning',
            anchorEl: ['#my-anchor-positioning'],
            anchorEdge: 'bottom',
            fallbackValue: '0px',
          },
          left: {
            anchorName: '--my-anchor-positioning',
            anchorEl: ['#my-anchor-positioning'],
            anchorEdge: 'right',
            fallbackValue: '50px',
          },
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('parses `@position-fallback` strategy', () => {
    const css = getSampleCSS('position-fallback');
    const result = parseCSS(css);
    const expected = {
      '#my-floating-fallback': {
        declarations: {
          left: {
            anchorName: '--my-anchor-fallback',
            anchorEl: ['#my-anchor-fallback'],
            anchorEdge: 'left',
            fallbackValue: '0px',
          },
        },
        fallbacks: [
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'right',
              fallbackValue: '10px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            right: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'bottom',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'left',
              fallbackValue: '0px',
            },
            bottom: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
          },
          {
            left: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'right',
              fallbackValue: '0px',
            },
            top: {
              anchorName: '--my-anchor-fallback',
              anchorEl: ['#my-anchor-fallback'],
              anchorEdge: 'top',
              fallbackValue: '0px',
            },
            width: '35px',
            height: '40px',
          },
        ],
      },
    };

    expect(result).toEqual(expected);
  });

  it('handles duplicate anchor-names', () => {
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
    const result = parseCSS(css);
    const expected = {
      '#f1': {
        declarations: {
          top: {
            anchorName: '--my-anchor',
            anchorEl: ['#a1', '#a2'],
            anchorEdge: 'bottom',
            fallbackValue: '0px',
          },
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('handles invalid/missing `position-fallback`', () => {
    const css = `
      #floating {
        position: absolute;
        position-fallback: --fallback;
      }
    `;
    const result = parseCSS(css);
    const expected = {};

    expect(result).toEqual(expected);
  });
});
