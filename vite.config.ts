import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/css-anchor-positioning.ts'),
      name: 'CssAnchorPositioning',
      // the proper extensions will be added
      fileName: 'css-anchor-positioning',
      formats: ['es', 'umd', 'iife'],
    },
  },
});
