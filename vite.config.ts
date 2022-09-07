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
      exclude: ['src/index.ts'],
      skipFull: true,
      all: true,
    },
  },
});
