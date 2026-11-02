import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  resolve: {
    // Component demos simulate downloads without requiring an extension context.
    alias: { 'wxt/browser': resolve(import.meta.dirname, 'browser-stub.ts') },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    fs: {
      allow: [resolve(import.meta.dirname, '..')],
    },
  },
});
