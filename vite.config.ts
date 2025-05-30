import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/guide/build.html#library-mode

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'my-lib',
      fileName: 'my-lib',
    },
  },
  test: {
    testTimeout: 10000
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
});
