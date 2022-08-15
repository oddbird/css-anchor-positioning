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
});
