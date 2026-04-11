/**
 * Scheduler Service Tests
 *
 * Tests the core schedule execution logic.
 * This is the most critical part of the app - schedule bugs = merchant issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scheduler } from '../services/scheduler.js';
import {
  createMockGraphQLClient,
  createMockStorage,
  createMockThemeModifier,
  createMockSchedule,
  createMockRecurringSchedule,
} from '../tests/helpers/mocks.js';
import moment from 'moment-timezone';

describe('Scheduler', () => {
  let scheduler;
  let mockClient;
  let mockStorage;
  let mockModifier;

  beforeEach(() => {
    mockClient = createMockGraphQLClient();
    mockStorage = createMockStorage();
    mockModifier = createMockThemeModifier();
    scheduler = new Scheduler(mockClient, mockStorage, mockModifier);
  });

  describe('initialize', () => {
    it('should fetch and set shop timezone', async () => {
      await scheduler.initialize();

      expect(mockClient.getShopInfo).toHaveBeenCalled();
      expect(scheduler.shopTimezone).toBe('America/New_York');
    });

    it('should default to UTC if timezone not available', async () => {
      mockClient.getShopInfo.mockResolvedValueOnce({
        id: 'test',
        ianaTimezone: null,
      });

      await scheduler.initialize();

      expect(scheduler.shopTimezone).toBe('UTC');
    });
  });

  describe('processPendingSchedules', () => {
    beforeEach(async () => {
      await scheduler.initialize();
    });

    it('should execute schedule when start time has passed', async () => {
      const pastTime = moment().subtract(5, 'minutes').toISOString();
      const futureTime = moment().add(1, 'hour').toISOString();

      const schedule = createMockSchedule({
        startTime: pastTime,
        endTime: futureTime,
        finalized: true,
        status: 'pending',
        startExecuted: false,
      });

      mockStorage.getSchedules.mockResolvedValue([schedule]);

      await scheduler.processPendingSchedules();

      expect(mockModifier.modifyTemplateVisibility).toHaveBeenCalledWith(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        schedule.action,
        []
      );

      expect(mockStorage.updateSchedule).toHaveBeenCalledWith(
        schedule.id,
        expect.objectContaining({
          startExecuted: true,
          status: 'active',
        })
      );
    });

    it('should not execute schedule if startExecuted is true', async () => {
      const pastTime = moment().subtract(5, 'minutes').toISOString();

      const schedule = createMockSchedule({
        startTime: pastTime,
        finalized: true,
        status: 'active',
        startExecuted: true,
      });

      mockStorage.getSchedules.mockResolvedValue([schedule]);

      await scheduler.processPendingSchedules();

      expect(mockModifier.modifyTemplateVisibility).not.toHaveBeenCalled();
    });

    it('should mark as active (not completed) when no endTime', async () => {
      const pastTime = moment().subtract(5, 'minutes').toISOString();

      const schedule = createMockSchedule({
        startTime: pastTime,
        endTime: null, // No end time = runs indefinitely
        finalized: true,
        status: 'pending',
        startExecuted: false,
      });

      mockStorage.getSchedules.mockResolvedValue([schedule]);

      await scheduler.processPendingSchedules();

      expect(mockStorage.updateSchedule).toHaveBeenCalledWith(
        schedule.id,
        expect.objectContaining({
          status: 'active', // Should be active, not completed
        })
      );
    });

    it('should execute reverse action when end time has passed', async () => {
      const pastStartTime = moment().subtract(2, 'hours').toISOString();
      const pastEndTime = moment().subtract(5, 'minutes').toISOString();

      const schedule = createMockSchedule({
        action: 'hide',
        startTime: pastStartTime,
        endTime: pastEndTime,
        finalized: true,
        status: 'active',
        startExecuted: true,
        endExecuted: false,
      });

      mockStorage.getSchedules.mockResolvedValue([schedule]);

      await scheduler.processPendingSchedules();

      // Should execute reverse action (show)
      expect(mockModifier.modifyTemplateVisibility).toHaveBeenCalledWith(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        'show', // Reverse of 'hide'
        []
      );

      expect(mockStorage.updateSchedule).toHaveBeenCalledWith(
        schedule.id,
        expect.objectContaining({
          endExecuted: true,
          status: 'completed',
        })
      );
    });

    it('should skip non-finalized schedules', async () => {
      const schedule = createMockSchedule({
        finalized: false,
        status: 'pending',
      });

      mockStorage.getSchedules.mockResolvedValue([schedule]);

      await scheduler.processPendingSchedules();

      expect(mockModifier.modifyTemplateVisibility).not.toHaveBeenCalled();
    });
  });

  describe('calculateNextRecurringWindow', () => {
    beforeEach(async () => {
      await scheduler.initialize();
    });

    it('should calculate next daily recurrence correctly', () => {
      const schedule = createMockRecurringSchedule('daily', {
        recurrence: {
          enabled: true,
          type: 'daily',
          time: '09:00',
          endTime: '17:00',
        },
      });

      const result = scheduler.calculateNextRecurringWindow(schedule);

      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('endTime');

      const start = moment(result.startTime);
      const end = moment(result.endTime);

      expect(start.format('HH:mm')).toBe('09:00');
      expect(end.format('HH:mm')).toBe('17:00');
      expect(start.isBefore(end)).toBe(true);
    });

    it('should calculate next weekly recurrence correctly', () => {
      const schedule = createMockRecurringSchedule('weekly', {
        recurrence: {
          enabled: true,
          type: 'weekly',
          dayOfWeek: 1, // Monday
          endDayOfWeek: 5, // Friday
          time: '09:00',
          endTime: '17:00',
        },
      });

      const result = scheduler.calculateNextRecurringWindow(schedule);

      const start = moment(result.startTime);
      const end = moment(result.endTime);

      expect(start.day()).toBe(1); // Monday
      expect(end.day()).toBe(5); // Friday
      expect(start.format('HH:mm')).toBe('09:00');
      expect(end.format('HH:mm')).toBe('17:00');
    });
  });

  describe('cleanupOldSchedules', () => {
    beforeEach(async () => {
      await scheduler.initialize();
    });

    it('should delete completed schedules older than retention period', async () => {
      const oldSchedule = createMockSchedule({
        status: 'completed',
        updatedAt: moment().subtract(100, 'days').toISOString(),
      });

      const recentSchedule = createMockSchedule({
        status: 'completed',
        updatedAt: moment().subtract(10, 'days').toISOString(),
      });

      mockStorage.getSchedules.mockResolvedValue([oldSchedule, recentSchedule]);

      const stats = await scheduler.cleanupOldSchedules(90);

      expect(stats.deleted).toBe(1);
      expect(stats.kept).toBe(1);
      expect(mockStorage.deleteSchedule).toHaveBeenCalledWith(oldSchedule.id);
    });

    it('should not delete active or pending schedules regardless of age', async () => {
      const oldActiveSchedule = createMockSchedule({
        status: 'active',
        updatedAt: moment().subtract(100, 'days').toISOString(),
      });

      mockStorage.getSchedules.mockResolvedValue([oldActiveSchedule]);

      const stats = await scheduler.cleanupOldSchedules(90);

      expect(stats.deleted).toBe(0);
      expect(stats.kept).toBe(1);
      expect(mockStorage.deleteSchedule).not.toHaveBeenCalled();
    });
  });
});
