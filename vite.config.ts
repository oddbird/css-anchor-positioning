/// <reference types="vitest" />

import replace from '@rollup/plugin-replace';
import { resolve } from 'path';
import { bundleStats } from 'rollup-plugin-bundle-stats';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: process.env.BUILD_DEMO
    ? {
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
            positionArea: resolve(__dirname, 'position-area.html'),
          },
        },
      }
    : {
        lib: process.env.BUILD_WPT
          ? // build that adds a delay variable for WPT test-runner
            {
              entry: resolve(__dirname, 'src/index-wpt.ts'),
              name: 'CssAnchorPositioning',
              formats: ['umd'],
              // the proper extensions will be added
              fileName: 'css-anchor-positioning-wpt',
            }
          : process.env.BUILD_FN
            ? // build that exposes the polyfill as a fn
              {
                entry: resolve(__dirname, 'src/index-fn.ts'),
                name: 'CssAnchorPositioning',
                // the proper extensions will be added
                fileName: 'css-anchor-positioning-fn',
              }
            : // build that runs the polyfill on import
              {
                entry: resolve(__dirname, 'src/index.ts'),
                name: 'CssAnchorPositioning',
                // the proper extensions will be added
                fileName: 'css-anchor-positioning',
              },
        emptyOutDir: false,
        target: 'es6',
        sourcemap: true,
        rollupOptions: {
          plugins: [
            // Remove unused source-map-js module to minimize build size
            replace({
              values: {
                "import { SourceMapGenerator } from 'source-map-js/lib/source-map-generator.js';":
                  '',
              },
              delimiters: ['', ''],
              preventAssignment: true,
            }),
          ],
        },
      },
  plugins: [bundleStats({ compare: false, silent: true })],
  /**
   * @see https://vitest.dev/config/#configuration
   */
  test: {
    include: ['./tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globals: true,
    environment: 'jsdom',
    watch: false,
    setupFiles: './tests/unit/setup.ts',
    clearMocks: true,
    reporters: 'dot',
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/index.ts', 'src/index-fn.ts', 'src/index-wpt.ts'],
      skipFull: true,
      all: true,
    },
  },
});
