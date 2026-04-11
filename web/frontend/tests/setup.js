/**
 * Frontend Test Setup
 *
 * Global setup for all frontend React component tests.
 * Runs before each test file.
 */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  // Reset any runtime state
  vi.restoreAllMocks();
});

// Mock Shopify App Bridge
global.mockAppBridge = {
  createApp: vi.fn(() => ({
    getState: vi.fn(),
    dispatch: vi.fn(),
    subscribe: vi.fn(),
    error: vi.fn(),
    featuresAvailable: vi.fn(() => ({ Admin: { Action: true } })),
  })),
};

// Mock window.matchMedia (used by Polaris)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Global test utilities
global.testUtils = {
  // Create mock schedule data
  mockSchedule: (overrides = {}) => ({
    id: 'test-schedule-id',
    name: 'Test Schedule',
    action: 'hide',
    status: 'pending',
    themeId: 'gid://shopify/OnlineStoreTheme/123',
    templateName: 'index.json',
    sectionId: 'test-section',
    startTime: '2026-04-15T10:00',
    endTime: '2026-04-15T12:00',
    finalized: false,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    ...overrides,
  }),

  // Create mock form data
  mockFormData: (overrides = {}) => ({
    name: 'Test Schedule',
    action: 'hide',
    startTime: '2026-04-15T10:00',
    endTime: '2026-04-15T12:00',
    recurrenceEnabled: false,
    ...overrides,
  }),
};
