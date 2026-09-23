import { defineConfig } from 'tsdown';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false, // Use .js extension for ESM output (instead of .mjs)
});
