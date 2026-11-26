import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    css: { include: [/interface-layout\.css$/] },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
  },
});
