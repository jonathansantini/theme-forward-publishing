# Testing Guide

Complete guide to testing the Smart Content Scheduler Shopify app.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### First Time Setup

```bash
# Install dependencies (already done during setup)
cd web/backend && npm install
cd ../frontend && npm install
cd ../.. && npm install

# Install Playwright browsers (only needed for E2E tests)
npx playwright install chromium
```

### Run All Tests

```bash
# ✅ Backend tests (11 tests - all passing)
npm test
# OR run from root: npm run test:backend

# ⚠️  Frontend tests (7 tests - run from frontend directory)
cd web/frontend && npm test

# Run with watch mode
npm run test:watch

# Run E2E tests (Playwright)
npm run test:e2e
```

**Note:** Frontend tests currently work best when run from `web/frontend` directory due to workspace configuration. Backend tests (11) run perfectly from root.

### Run Specific Tests

```bash
# Backend tests only (from root)
npm run test:backend
cd web/backend && npm test

# Frontend tests (from frontend directory)
cd web/frontend && npm test
cd web/frontend && npm run test:watch

# E2E tests
npm run test:e2e

# Specific test file
npm run test scheduler.test.js

# Tests matching pattern
npm run test -- schedule
```

---

## 📁 Test Structure

```
theme-forward-publishing/
├── web/
│   ├── backend/
│   │   ├── __tests__/              # Backend unit tests
│   │   │   ├── scheduler.test.js   # Schedule execution logic
│   │   │   ├── metafield-storage.test.js
│   │   │   ├── webhooks.test.js    # GDPR webhooks
│   │   │   └── api-routes.test.js  # API integration tests
│   │   ├── tests/
│   │   │   ├── setup.js            # Global test setup
│   │   │   └── helpers/
│   │   │       └── mocks.js        # Mock factories
│   │   └── vitest.config.js
│   │
│   └── frontend/
│       ├── __tests__/              # Frontend component tests
│       │   ├── ScheduleForm.test.jsx
│       │   └── Dashboard.test.jsx
│       ├── tests/
│       │   └── setup.js            # React test setup
│       └── vitest.config.js
│
├── e2e/                            # E2E tests
│   ├── schedule-workflow.spec.js
│   └── customizer-badges.spec.js
│
├── vitest.workspace.js             # Multi-project config
├── playwright.config.js            # E2E config
└── TESTING.md                      # This file
```

---

## 🏃 Running Tests

### Development Workflow

**Watch Mode (Recommended)**
```bash
npm run test:watch
```
- Reruns tests on file changes
- Fast feedback loop
- Great for TDD

**Interactive UI**
```bash
npm run test:ui
```
- Visual test runner
- See test results in browser
- Debug failing tests easily

### CI/CD Mode

```bash
# Run once, no watch, with coverage
npm run test:ci

# Generate coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# With visible browser (debugging)
npm run test:e2e -- --headed

# Interactive UI mode
npm run test:e2e -- --ui

# Specific test file
npm run test:e2e schedule-workflow.spec.js
```

### Debug Mode

```bash
# Run with Node debugger
node --inspect-brk ./node_modules/vitest/vitest.js run

# Playwright debug mode
npm run test:e2e -- --debug
```

---

## ✍️ Writing Tests

### Backend Unit Tests

**Location:** `web/backend/__tests__/`

**Example:**
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler } from '../services/scheduler.js';
import { createMockStorage, createMockSchedule } from '../tests/helpers/mocks.js';

describe('Scheduler', () => {
  let scheduler;
  let mockStorage;

  beforeEach(async () => {
    mockStorage = createMockStorage();
    scheduler = new Scheduler(mockClient, mockStorage, mockModifier);
    await scheduler.initialize();
  });

  it('should execute schedule at correct time', async () => {
    const schedule = createMockSchedule({
      startTime: moment().subtract(5, 'minutes').toISOString(),
      startExecuted: false,
      finalized: true,
    });

    mockStorage.getSchedules.mockResolvedValue([schedule]);

    await scheduler.processPendingSchedules();

    expect(mockStorage.updateSchedule).toHaveBeenCalledWith(
      schedule.id,
      expect.objectContaining({ startExecuted: true })
    );
  });
});
```

**Mock Helpers Available:**
- `createMockGraphQLClient()` - Mock Shopify API
- `createMockStorage()` - Mock metafield storage
- `createMockThemeModifier()` - Mock theme operations
- `createMockSchedule()` - Create test schedule data
- `createMockRecurringSchedule()` - Create recurring schedule
- `createMockRequest/Response()` - Mock Express objects

### Frontend Component Tests

**Location:** `web/frontend/__tests__/`

**Example:**
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleForm from '../components/ScheduleForm';

it('should validate required fields', async () => {
  const user = userEvent.setup();
  render(<ScheduleForm onSubmit={mockSubmit} onCancel={mockCancel} />);

  await user.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => {
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});
```

**Testing Library Queries (Priority Order):**
1. `getByRole` - Accessible, semantic
2. `getByLabelText` - Form fields
3. `getByText` - Text content
4. `getByTestId` - Last resort only

### E2E Tests

**Location:** `e2e/`

**Example:**
```javascript
import { test, expect } from '@playwright/test';

test('should create and publish schedule', async ({ page }) => {
  await page.goto('/');

  await page.click('button:has-text("Create Schedule")');
  await page.fill('input[name="name"]', 'Test Schedule');
  await page.click('button:has-text("Create")');

  await expect(page.locator('text=Test Schedule')).toBeVisible();
});
```

**E2E Best Practices:**
- Test critical user journeys only
- Keep tests independent
- Use fixtures for test data
- Clean up after tests

---

## 🎯 Best Practices

### General

✅ **DO:**
- Write tests for critical business logic
- Test behavior, not implementation
- Use descriptive test names
- Keep tests fast and focused
- Mock external dependencies (Shopify API)
- Test error cases

❌ **DON'T:**
- Test implementation details
- Write slow tests for everything
- Mock too much (test real code paths)
- Copy-paste tests
- Skip edge cases

### Test Organization

```javascript
describe('Feature', () => {
  describe('specific scenario', () => {
    beforeEach(() => {
      // Setup for this scenario
    });

    it('should do X when Y happens', () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Coverage Goals

- **Critical paths:** 100% (schedule execution, GDPR)
- **Business logic:** 80%+
- **UI components:** 60%+
- **Overall:** 70%+

*Coverage is a metric, not a goal. 70% well-tested code > 100% poorly tested code.*

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd web/backend && npm ci
          cd ../frontend && npm ci
          cd ../.. && npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run test:ci

if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

---

## 🐛 Troubleshooting

### Tests Timeout

```bash
# Increase timeout in vitest.config.js
export default defineConfig({
  test: {
    testTimeout: 10000, // 10 seconds
  },
});
```

### Mock Not Working

```javascript
// Make sure to call vi.mock() before imports
vi.mock('../services/shopify-api.js');
import { ShopifyGraphQLClient } from '../services/shopify-api.js';
```

### E2E Tests Fail

```bash
# Make sure browsers are installed
npx playwright install chromium

# Run with headed mode to see what's happening
npm run test:e2e -- --headed

# Check if dev server is running
npm run dev  # In another terminal
```

### React Component Not Rendering

```javascript
// Make sure to import testing library matchers
import '@testing-library/jest-dom';

// Wrap components in required providers
import { AppProvider } from '@shopify/polaris';

render(
  <AppProvider>
    <YourComponent />
  </AppProvider>
);
```

### Coverage Not Generated

```bash
# Run with coverage flag
npm run test:coverage

# Check coverage thresholds in vitest.config.js
```

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## 🤝 Contributing

When adding new features:

1. ✅ Write tests first (TDD)
2. ✅ Ensure tests pass locally
3. ✅ Add tests to cover edge cases
4. ✅ Update this documentation if needed
5. ✅ Run `npm run test:ci` before pushing

---

## ⚡ Quick Reference

```bash
# Most common commands
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # Visual UI
npm run test:backend      # Backend only
npm run test:frontend     # Frontend only
npm run test:e2e          # E2E tests
npm run test:coverage     # With coverage report

# Debugging
npm run test:e2e -- --headed    # See browser
npm run test:e2e -- --debug     # Debug mode
node --inspect-brk ...          # Node debugger
```

Happy Testing! 🎉
