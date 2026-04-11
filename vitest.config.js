import { defineConfig } from 'vitest/config';

/**
 * Root Vitest Configuration
 *
 * This config excludes e2e tests globally.
 * Actual test configs are in vitest.workspace.js
 */
export default defineConfig({
  test: {
    // Global exclude patterns to prevent e2e tests from being picked up
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.spec.js',
      '**/*.spec.jsx',
      '**/playwright.config.js',
    ],
  },
});
