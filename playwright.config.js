import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Tests real user workflows in a browser environment.
 * Use sparingly - E2E tests are slower than unit/integration tests.
 *
 * Focus E2E tests on:
 * - Critical user journeys
 * - Cross-browser compatibility issues
 * - Visual regression testing
 *
 * Usage:
 *   npm run test:e2e           - Run all E2E tests
 *   npm run test:e2e -- --ui   - Run with UI mode
 *   npm run test:e2e -- --headed  - See browser while testing
 */
export default defineConfig({
  testDir: './e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all tests
  use: {
    // Base URL for navigation
    baseURL: process.env.SHOPIFY_APP_URL || 'https://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment to test on more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
