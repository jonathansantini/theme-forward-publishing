/**
 * E2E Test: Schedule Workflow
 *
 * Tests the complete user journey from creating to publishing a schedule.
 * This is a slow test - only use for critical paths.
 */

import { test, expect } from '@playwright/test';

test.describe('Schedule Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('text=Section Scheduler', { timeout: 10000 });
  });

  test('should create, publish, and unpublish a schedule', async ({ page }) => {
    // Step 1: Click "Create Schedule" button
    await page.click('button:has-text("Create Schedule")');

    // Step 2: Select template and section
    await page.selectOption('select[name="template"]', 'index.json');
    await page.waitForTimeout(500); // Wait for sections to load

    await page.selectOption('select[name="section"]', { index: 0 });

    // Step 3: Fill out schedule form
    await page.fill('input[type="datetime-local"][name="startTime"]', '2026-04-20T09:00');
    await page.fill('input[type="datetime-local"][name="endTime"]', '2026-04-20T17:00');
    await page.fill('input[name="name"]', 'E2E Test Schedule');

    // Step 4: Create schedule (draft)
    await page.click('button:has-text("Create Schedule")');

    // Wait for redirect back to dashboard
    await expect(page.locator('text=E2E Test Schedule')).toBeVisible();

    // Step 5: Publish the schedule
    await page.click('button:has-text("Publish"):near(:text("E2E Test Schedule"))');

    // Confirm publish dialog
    await page.click('button:has-text("Publish"):last');

    // Verify published state
    await expect(page.locator('text=Published:near(:text("E2E Test Schedule"))')).toBeVisible();

    // Step 6: Unpublish the schedule
    await page.click('button:has-text("Unpublish"):near(:text("E2E Test Schedule"))');

    // Verify unpublished state
    await expect(page.locator('button:has-text("Publish"):near(:text("E2E Test Schedule"))')).toBeVisible();

    // Step 7: Delete the schedule
    await page.click('button:has-text("Edit"):near(:text("E2E Test Schedule"))');
    await page.click('button:has-text("Delete")');

    // Confirm deletion
    page.on('dialog', (dialog) => dialog.accept());

    // Verify schedule is gone
    await expect(page.locator('text=E2E Test Schedule')).not.toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    await page.click('button:has-text("Create Schedule")');

    // Try to submit without required fields
    await page.click('button:has-text("Create Schedule")');

    // Should show validation errors
    await expect(page.locator('text=/template.*required/i')).toBeVisible();
  });

  test('should filter schedules by status', async ({ page }) => {
    // Create multiple schedules with different statuses first
    // (This assumes test data exists or we create it)

    // Click "Active" tab
    await page.click('button:has-text("Active")');

    // Should only show active schedules
    await expect(page.locator('[data-status="active"]')).toBeVisible();
    await expect(page.locator('[data-status="pending"]')).not.toBeVisible();

    // Click "Pending" tab
    await page.click('button:has-text("Pending")');

    // Should only show pending schedules
    await expect(page.locator('[data-status="pending"]')).toBeVisible();
  });
});

test.describe('Customizer Badges', () => {
  test('should show badges for active schedules in customizer', async ({ page }) => {
    // This test requires:
    // 1. A published schedule
    // 2. Access to the theme customizer
    // 3. The schedule to be for a visible section

    // Navigate to theme customizer
    await page.goto('/admin/themes/current/editor');

    // Wait for customizer to load
    await page.waitForSelector('iframe#storefront-iframe-1');

    // Switch to iframe context
    const iframe = page.frameLocator('iframe#storefront-iframe-1');

    // Look for schedule badge
    const badge = iframe.locator('.section-scheduler-badge');
    await expect(badge).toBeVisible();

    // Verify badge content
    await expect(badge.locator('text=/Hide Section|Show Section/')).toBeVisible();
    await expect(badge.locator('text=/ACTIVE NOW|PENDING/')).toBeVisible();

    // Verify badge link is clickable
    const editLink = badge.locator('a:has-text("Edit Schedule")');
    await expect(editLink).toBeVisible();
  });
});
