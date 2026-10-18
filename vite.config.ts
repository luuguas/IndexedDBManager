/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['fake-indexeddb/auto'],
    coverage: {
      include: ['src/**'],
      provider: 'v8',
    },
  },
});
