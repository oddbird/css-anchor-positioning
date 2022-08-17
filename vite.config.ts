/// <reference types="vitest" />

import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CssAnchorPositioning',
      // the proper extensions will be added
      fileName: 'css-anchor-positioning',
    },
    target: 'es6',
    sourcemap: true,
  },

  /**
   * @see https://vitest.dev/config/#configuration
   */
  test: {
    globals: true,
    clearMocks: true,
    environment: 'jsdom',
    include: ['./tests/unit/**/*(*.)@(spec|test).[jt]s?(x)'],
    coverage: {
      reportsDirectory: 'coverage',
      include: ['src/**/*.{js,ts}', '!src/index.ts'],
      // Threshold
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
});
