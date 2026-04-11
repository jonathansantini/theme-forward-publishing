/**
 * Mock Factories for Testing
 *
 * Helpers to create mock data and services for tests.
 */

import { vi } from 'vitest';

/**
 * Mock Shopify GraphQL Client
 */
export function createMockGraphQLClient() {
  return {
    query: vi.fn(),
    getShopInfo: vi.fn().mockResolvedValue({
      id: 'gid://shopify/Shop/123',
      name: 'Test Shop',
      email: 'test@shop.com',
      domain: 'test-shop.myshopify.com',
      ianaTimezone: 'America/New_York',
    }),
    getThemes: vi.fn().mockResolvedValue([
      {
        id: 'gid://shopify/OnlineStoreTheme/123',
        name: 'Dawn',
        role: 'main',
      },
    ]),
    setShopMetafields: vi.fn().mockResolvedValue([]),
    getShopMetafield: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Mock Metafield Storage
 */
export function createMockStorage() {
  const schedules = [];

  return {
    getSchedules: vi.fn().mockImplementation(() => Promise.resolve([...schedules])),
    getPendingSchedules: vi.fn().mockImplementation(() =>
      Promise.resolve(schedules.filter((s) => s.finalized && !s.startExecuted))
    ),
    getSchedule: vi.fn().mockImplementation((id) =>
      Promise.resolve(schedules.find((s) => s.id === id) || null)
    ),
    createSchedule: vi.fn().mockImplementation((data) => {
      const schedule = {
        id: `schedule-${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      schedules.push(schedule);
      return Promise.resolve(schedule);
    }),
    updateSchedule: vi.fn().mockImplementation((id, updates) => {
      const index = schedules.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Schedule not found');
      schedules[index] = { ...schedules[index], ...updates };
      return Promise.resolve(schedules[index]);
    }),
    deleteSchedule: vi.fn().mockImplementation((id) => {
      const index = schedules.findIndex((s) => s.id === id);
      if (index !== -1) {
        schedules.splice(index, 1);
      }
      // Don't throw error if not found - mimics metafield behavior
      return Promise.resolve();
    }),
    saveSchedules: vi.fn().mockResolvedValue(undefined),
    // Allow tests to directly manipulate the schedules array for setup
    _schedules: schedules,
  };
}

/**
 * Mock Theme Modifier
 */
export function createMockThemeModifier() {
  return {
    modifyTemplateVisibility: vi.fn().mockResolvedValue({
      success: true,
      modified: true,
    }),
    validateSection: vi.fn().mockResolvedValue({
      valid: true,
    }),
  };
}

/**
 * Create Mock Schedule
 */
export function createMockSchedule(overrides = {}) {
  return {
    id: `schedule-${Date.now()}`,
    name: 'Test Schedule',
    action: 'hide',
    status: 'pending',
    themeId: 'gid://shopify/OnlineStoreTheme/123',
    templateName: 'index.json',
    sectionId: 'test-section',
    startTime: '2026-04-15T10:00:00.000Z',
    endTime: '2026-04-15T12:00:00.000Z',
    finalized: false,
    startExecuted: false,
    endExecuted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recurrence: { enabled: false },
    ...overrides,
  };
}

/**
 * Create Mock Recurring Schedule
 */
export function createMockRecurringSchedule(type = 'daily', overrides = {}) {
  return createMockSchedule({
    recurrence: {
      enabled: true,
      type,
      time: '09:00',
      endTime: '17:00',
      dayOfWeek: type === 'weekly' ? 1 : undefined,
      endDayOfWeek: type === 'weekly' ? 5 : undefined,
      dayOfMonth: type === 'monthly' ? 1 : undefined,
      endDayOfMonth: type === 'monthly' ? 15 : undefined,
    },
    ...overrides,
  });
}

/**
 * Mock Express Request
 */
export function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    shopifySession: {
      id: 'test-session',
      shop: 'test-shop.myshopify.com',
      accessToken: 'test-token',
    },
    ...overrides,
  };
}

/**
 * Mock Express Response
 */
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Mock Next Function
 */
export function createMockNext() {
  return vi.fn();
}
