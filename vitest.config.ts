import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'core/**/*.test.ts', 'db/**/*.test.ts', 'collector/**/*.test.ts'],
    environment: 'node',
  },
});
