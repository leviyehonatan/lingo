import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Unit tests live next to the code. e2e/ is Playwright's, not Vitest's.
    include: ['src/**/*.test.ts'],
  },
});
