import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'backend',
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['**/__tests__/**/*.test.js', '**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '**/__tests__/**',
      ],
    },
    // Mock timers for testing time-dependent code
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
