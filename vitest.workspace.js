import { defineWorkspace } from 'vitest/config';

/**
 * Vitest Workspace Configuration
 *
 * This allows running backend and frontend tests together:
 * - Backend tests: Node environment, tests API/service logic
 * - Frontend tests: Happy-DOM environment, tests React components
 *
 * E2E tests (in e2e/) use Playwright and should NOT be run via Vitest.
 * Run them separately with: npm run test:e2e
 *
 * Usage:
 *   npm run test          - Run all tests (backend + frontend)
 *   npm run test:backend  - Run only backend tests
 *   npm run test:frontend - Run only frontend tests
 */
export default defineWorkspace([
  {
    extends: './web/backend/vitest.config.js',
    test: {
      name: 'backend',
      root: './web/backend',
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    },
  },
  {
    extends: './web/frontend/vitest.config.js',
    test: {
      name: 'frontend',
      root: './web/frontend',
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    },
  },
]);
