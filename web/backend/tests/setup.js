/**
 * Backend Test Setup
 *
 * Global setup for all backend tests.
 * Runs before each test file.
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';
process.env.SHOPIFY_APP_URL = 'https://test.ngrok-free.app';
process.env.SCOPES = 'read_content,write_content,read_themes,write_themes';
process.env.NODE_ENV = 'test';

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Create mock shop domain
  mockShop: () => 'test-shop.myshopify.com',

  // Create mock session
  mockSession: () => ({
    id: 'test-session-id',
    shop: 'test-shop.myshopify.com',
    state: 'test-state',
    isOnline: true,
    accessToken: 'test-access-token',
    scope: 'read_content,write_content,read_themes,write_themes',
  }),
};
