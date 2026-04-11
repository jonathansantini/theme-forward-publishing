import moment from 'moment-timezone';

/**
 * Scheduler Service
 * Handles schedule execution logic and recurring schedule calculations
 */
export class Scheduler {
  constructor(graphqlClient, metafieldStorage, themeModifier) {
    this.client = graphqlClient;
    this.storage = metafieldStorage;
    this.modifier = themeModifier;
    this.shopTimezone = null;
  }

  /**
   * Initialize scheduler with shop timezone
   */
  async initialize() {
    const shopInfo = await this.client.getShopInfo();
    this.shopTimezone = shopInfo.ianaTimezone || 'UTC';
    console.log(`Scheduler initialized with timezone: ${this.shopTimezone}`);
  }

  /**
   * Execute a schedule action without managing schedule state
   * Used by processPendingSchedules for start/end time schedules
   */
  async executeScheduleAction(schedule, action) {
    const blockIds = schedule.blockIds || [];
    const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')} in` : '';
    console.log(`Executing action: ${action} ${target} ${schedule.sectionId}`);

    try {
      // Execute the theme modification (section or blocks)
      await this.modifier.modifyTemplateVisibility(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        action,
        blockIds
      );

      // Log successful execution
      await this.storage.logExecution({
        scheduleId: schedule.id,
        success: true,
        action: action,
        sectionId: schedule.sectionId,
        templateName: schedule.templateName,
      });

      return { success: true };
    } catch (error) {
      console.error(`Action execution failed:`, error);

      // Update status to failed
      await this.storage.updateSchedule(schedule.id, {
        status: 'failed',
        error: error.message,
      });

      // Log failed execution
      await this.storage.logExecution({
        scheduleId: schedule.id,
        success: false,
        action: action,
        sectionId: schedule.sectionId,
        templateName: schedule.templateName,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Execute a single schedule (legacy format with executeAt)
   */
  async executeSchedule(schedule) {
    const blockIds = schedule.blockIds || [];
    const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')} in` : '';
    console.log(`Executing schedule ${schedule.id}: ${schedule.action} ${target} ${schedule.sectionId}`);

    try {
      // Update status to active
      await this.storage.updateSchedule(schedule.id, { status: 'active' });

      // Execute the theme modification (section or blocks)
      await this.modifier.modifyTemplateVisibility(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        schedule.action,
        blockIds
      );

      // Determine next status
      let nextStatus = 'completed';
      let updates = {
        status: nextStatus,
        lastRun: new Date().toISOString(),
      };

      // If recurring, calculate next execution time
      if (schedule.recurrence && schedule.recurrence.enabled) {
        const nextExecuteAt = this.calculateNextOccurrence(schedule);
        updates = {
          status: 'pending', // Reset to pending for next occurrence
          lastRun: new Date().toISOString(),
          executeAt: nextExecuteAt,
        };
        console.log(`Next occurrence scheduled for: ${nextExecuteAt}`);
      }

      await this.storage.updateSchedule(schedule.id, updates);

      // Log successful execution
      await this.storage.logExecution({
        scheduleId: schedule.id,
        success: true,
        action: schedule.action,
        sectionId: schedule.sectionId,
        templateName: schedule.templateName,
      });

      return { success: true };
    } catch (error) {
      console.error(`Schedule execution failed:`, error);

      // Update status to failed
      await this.storage.updateSchedule(schedule.id, {
        status: 'failed',
        error: error.message,
      });

      // Log failed execution
      await this.storage.logExecution({
        scheduleId: schedule.id,
        success: false,
        action: schedule.action,
        sectionId: schedule.sectionId,
        templateName: schedule.templateName,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Calculate next occurrence for recurring schedules
   */
  calculateNextOccurrence(schedule) {
    const { recurrence, executeAt } = schedule;
    const now = moment().tz(this.shopTimezone);
    const lastExecution = moment(executeAt).tz(this.shopTimezone);

    let nextOccurrence;

    switch (recurrence.type) {
      case 'daily':
        // Execute at the same time every day
        nextOccurrence = lastExecution.clone().add(1, 'day');
        break;

      case 'weekly':
        // Execute on specific day of week at specific time
        nextOccurrence = lastExecution.clone().add(1, 'week');
        break;

      case 'monthly':
        // Execute on specific day of month at specific time
        nextOccurrence = lastExecution.clone().add(1, 'month');
        break;

      default:
        throw new Error(`Unknown recurrence type: ${recurrence.type}`);
    }

    // Ensure we're always scheduling in the future
    while (nextOccurrence.isSameOrBefore(now)) {
      if (recurrence.type === 'daily') {
        nextOccurrence.add(1, 'day');
      } else if (recurrence.type === 'weekly') {
        nextOccurrence.add(1, 'week');
      } else if (recurrence.type === 'monthly') {
        nextOccurrence.add(1, 'month');
      }
    }

    return nextOccurrence.toISOString();
  }

  /**
   * Calculate next recurring window (start and end times) based on recurrence settings
   */
  calculateNextRecurringWindow(schedule) {
    const { recurrence } = schedule;
    const now = moment().tz(this.shopTimezone);

    let nextStart, nextEnd;

    switch (recurrence.type) {
      case 'daily':
        // Daily: start at recurrence.time, end at recurrence.endTime same day
        nextStart = now.clone().startOf('day').add(moment.duration(recurrence.time));
        nextEnd = now.clone().startOf('day').add(moment.duration(recurrence.endTime));

        // If we've passed today's window, move to tomorrow
        if (now.isAfter(nextEnd)) {
          nextStart.add(1, 'day');
          nextEnd.add(1, 'day');
        }
        break;

      case 'weekly':
        // Weekly: start on recurrence.dayOfWeek at recurrence.time
        // end on recurrence.endDayOfWeek at recurrence.endTime
        const startDay = parseInt(recurrence.dayOfWeek);
        const endDay = parseInt(recurrence.endDayOfWeek);

        nextStart = now.clone().day(startDay).startOf('day').add(moment.duration(recurrence.time));
        nextEnd = now.clone().day(endDay).startOf('day').add(moment.duration(recurrence.endTime));

        // If end is before start (e.g., Friday to Monday), end is in the next week
        if (nextEnd.isSameOrBefore(nextStart)) {
          nextEnd.add(1, 'week');
        }

        // If we've passed this week's window, move to next week
        if (now.isAfter(nextEnd)) {
          nextStart.add(1, 'week');
          nextEnd.add(1, 'week');
        }
        break;

      case 'monthly':
        // Monthly: start on recurrence.dayOfMonth at recurrence.time
        // end on recurrence.endDayOfMonth at recurrence.endTime
        const startDayOfMonth = parseInt(recurrence.dayOfMonth);
        const endDayOfMonth = parseInt(recurrence.endDayOfMonth);

        nextStart = now.clone().date(startDayOfMonth).startOf('day').add(moment.duration(recurrence.time));
        nextEnd = now.clone().date(endDayOfMonth).startOf('day').add(moment.duration(recurrence.endTime));

        // If end is before start (e.g., 28th to 3rd), end is in next month
        if (nextEnd.isSameOrBefore(nextStart)) {
          nextEnd.add(1, 'month');
        }

        // If we've passed this month's window, move to next month
        if (now.isAfter(nextEnd)) {
          nextStart.add(1, 'month');
          nextEnd.add(1, 'month');
        }
        break;

      default:
        throw new Error(`Unknown recurrence type: ${recurrence.type}`);
    }

    return {
      startTime: nextStart.toISOString(),
      endTime: nextEnd.toISOString(),
    };
  }

  /**
   * Process all pending schedules
   */
  async processPendingSchedules() {
    if (!this.shopTimezone) {
      await this.initialize();
    }

    const now = moment().tz(this.shopTimezone);
    const pendingSchedules = await this.storage.getPendingSchedules();

    console.log(
      `Processing ${pendingSchedules.length} pending schedules at ${now.format()}`
    );

    const results = [];

    for (const schedule of pendingSchedules) {
      try {
        // Handle new format with startTime (endTime optional)
        if (schedule.startTime) {
          // Parse times as ALREADY being in the shop timezone (datetime-local sends local time)
          const startTime = moment.tz(schedule.startTime, this.shopTimezone);
          const endTime = schedule.endTime ? moment.tz(schedule.endTime, this.shopTimezone) : null;
          const startExecuted = schedule.startExecuted || false;
          const endExecuted = schedule.endExecuted || false;

          console.log(`[Schedule ${schedule.id}] Checking times:`, {
            now: now.format(),
            startTime: startTime.format(),
            endTime: endTime ? endTime.format() : 'none (runs forever)',
            startExecuted,
            endExecuted,
          });

          // Execute start action if it's time and not yet executed
          if (now.isSameOrAfter(startTime) && !startExecuted) {
            console.log(`Schedule ${schedule.id}: Executing START action (${schedule.action})`);
            const result = await this.executeScheduleAction(schedule, schedule.action);

            // Mark as active after start action (stays active until endTime or manual unpublish)
            const updates = {
              startExecuted: true,
              status: 'active',
            };

            await this.storage.updateSchedule(schedule.id, updates);
            results.push({ scheduleId: schedule.id, phase: 'start', ...result });
          }

          // Execute end action (reverse) if endTime exists and it's time
          if (endTime && now.isSameOrAfter(endTime) && !endExecuted) {
            const reverseAction = schedule.action === 'hide' ? 'show' : 'hide';
            console.log(`Schedule ${schedule.id}: Executing END action (${reverseAction})`);
            const result = await this.executeScheduleAction(schedule, reverseAction);

            // Check if this is a recurring schedule
            if (schedule.recurrence && schedule.recurrence.enabled) {
              // Calculate next occurrence
              const nextWindow = this.calculateNextRecurringWindow(schedule);
              console.log(`Schedule ${schedule.id}: Recurring - next window ${nextWindow.startTime} to ${nextWindow.endTime}`);

              await this.storage.updateSchedule(schedule.id, {
                startTime: nextWindow.startTime,
                endTime: nextWindow.endTime,
                startExecuted: false,
                endExecuted: false,
                status: 'pending',
                lastRun: new Date().toISOString(),
              });
            } else {
              // Non-recurring: mark as completed
              await this.storage.updateSchedule(schedule.id, {
                endExecuted: true,
                status: 'completed',
                lastRun: new Date().toISOString(),
              });
            }

            results.push({ scheduleId: schedule.id, phase: 'end', ...result });
          }
        } else {
          // Handle old format with single executeAt
          const executeAt = moment(schedule.executeAt).tz(this.shopTimezone);

          // Check if it's time to execute
          if (now.isSameOrAfter(executeAt)) {
            console.log(`Schedule ${schedule.id} is due for execution`);
            const result = await this.executeSchedule(schedule);
            results.push({ scheduleId: schedule.id, ...result });
          }
        }
      } catch (error) {
        console.error(`[EXECUTION ERROR] Failed to execute schedule ${schedule.id}:`, error);
        console.error(`[EXECUTION ERROR] Error details:`, {
          message: error.message,
          stack: error.stack,
          scheduleId: schedule.id,
          action: schedule.action,
          sectionId: schedule.sectionId,
        });

        results.push({
          scheduleId: schedule.id,
          success: false,
          error: error.message,
        });

        // Implement retry logic
        try {
          await this.retrySchedule(schedule, error);
        } catch (retryError) {
          console.error(`[RETRY ERROR] Failed to schedule retry for ${schedule.id}:`, retryError);
        }
      }
    }

    return results;
  }

  /**
   * Retry failed schedule with exponential backoff
   */
  async retrySchedule(schedule, error) {
    const maxRetries = 3;
    const retryCount = schedule.retryCount || 0;

    if (retryCount < maxRetries) {
      // Calculate backoff delay (2^retryCount minutes)
      const delayMinutes = Math.pow(2, retryCount);
      const nextAttempt = moment()
        .tz(this.shopTimezone)
        .add(delayMinutes, 'minutes')
        .toISOString();

      await this.storage.updateSchedule(schedule.id, {
        status: 'pending',
        retryCount: retryCount + 1,
        executeAt: nextAttempt,
        lastError: error.message,
      });

      console.log(
        `Scheduled retry ${retryCount + 1}/${maxRetries} for ${schedule.id} at ${nextAttempt}`
      );
    } else {
      // Max retries reached, mark as permanently failed
      await this.storage.updateSchedule(schedule.id, {
        status: 'failed',
        error: `Max retries (${maxRetries}) exceeded. Last error: ${error.message}`,
      });

      console.error(`Schedule ${schedule.id} failed after ${maxRetries} retries`);
    }
  }

  /**
   * Validate schedule before creation
   */
  async validateSchedule(scheduleData) {
    const errors = [];

    // Validate required fields
    if (!scheduleData.themeId) errors.push('Theme ID is required');
    if (!scheduleData.templateName) errors.push('Template name is required');
    if (!scheduleData.sectionId) errors.push('Section ID is required');
    if (!scheduleData.action) errors.push('Action is required');

    // Support both old (executeAt) and new (startTime/endTime) formats
    if (!scheduleData.executeAt && !scheduleData.startTime) {
      errors.push('Start time is required');
    }
    // Note: endTime is optional - if not provided, schedule runs indefinitely

    // Validate action
    if (!['show', 'hide'].includes(scheduleData.action)) {
      errors.push('Action must be either "show" or "hide"');
    }

    // Validate times
    const now = moment().tz(this.shopTimezone || 'UTC');

    if (scheduleData.startTime) {
      const startTime = moment.tz(scheduleData.startTime, this.shopTimezone || 'UTC');

      if (!startTime.isValid()) {
        errors.push('Invalid start time format');
      }

      // Validate endTime only if provided
      if (scheduleData.endTime) {
        const endTime = moment.tz(scheduleData.endTime, this.shopTimezone || 'UTC');

        if (!endTime.isValid()) {
          errors.push('Invalid end time format');
        }
        if (startTime.isValid() && endTime.isValid() && endTime.isSameOrBefore(startTime)) {
          errors.push('End time must be after start time');
        }
      }
    } else if (scheduleData.executeAt) {
      // Legacy support for executeAt
      const executeAt = moment.tz(scheduleData.executeAt, this.shopTimezone || 'UTC');
      if (executeAt.isSameOrBefore(now)) {
        errors.push('Execution time must be in the future');
      }
    }

    // Validate section exists in template
    try {
      const validation = await this.modifier.validateSection(
        scheduleData.themeId,
        scheduleData.templateName,
        scheduleData.sectionId
      );

      if (!validation.valid) {
        errors.push(validation.error);
      }
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    // Validate recurrence if provided
    if (scheduleData.recurrence && scheduleData.recurrence.enabled) {
      if (!['daily', 'weekly', 'monthly'].includes(scheduleData.recurrence.type)) {
        errors.push('Invalid recurrence type');
      }

      if (
        scheduleData.recurrence.type === 'weekly' &&
        (scheduleData.recurrence.dayOfWeek < 0 ||
          scheduleData.recurrence.dayOfWeek > 6)
      ) {
        errors.push('Day of week must be between 0 (Sunday) and 6 (Saturday)');
      }

      if (
        scheduleData.recurrence.type === 'monthly' &&
        (scheduleData.recurrence.dayOfMonth < 1 ||
          scheduleData.recurrence.dayOfMonth > 31)
      ) {
        errors.push('Day of month must be between 1 and 31');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for schedule conflicts
   */
  async checkConflicts(scheduleData) {
    const allSchedules = await this.storage.getSchedules();

    const conflicts = allSchedules.filter((s) => {
      // Check if targeting same section in same template
      if (
        s.themeId === scheduleData.themeId &&
        s.templateName === scheduleData.templateName &&
        s.sectionId === scheduleData.sectionId &&
        s.status !== 'completed' &&
        s.status !== 'failed'
      ) {
        // Check if execution times are close (within 1 minute)
        const existingTime = moment(s.executeAt);
        const newTime = moment(scheduleData.executeAt);
        const diffMinutes = Math.abs(existingTime.diff(newTime, 'minutes'));

        return diffMinutes < 1;
      }

      return false;
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Clean up old completed schedules (data retention policy)
   * Deletes completed schedules older than the retention period
   *
   * @param {number} retentionDays - Number of days to retain completed schedules (default: 90)
   * @returns {Object} Cleanup statistics
   */
  async cleanupOldSchedules(retentionDays = 90) {
    console.log(`[Cleanup] Starting cleanup of schedules older than ${retentionDays} days`);

    const schedules = await this.storage.getSchedules();
    const cutoffDate = moment().subtract(retentionDays, 'days');

    const stats = {
      total: schedules.length,
      checked: 0,
      deleted: 0,
      kept: 0,
      errors: [],
    };

    for (const schedule of schedules) {
      stats.checked++;

      // Only delete completed schedules (keep active and pending)
      if (schedule.status !== 'completed') {
        stats.kept++;
        continue;
      }

      // Check if schedule is older than retention period
      const updatedAt = moment(schedule.updatedAt);
      if (updatedAt.isBefore(cutoffDate)) {
        try {
          await this.storage.deleteSchedule(schedule.id);
          stats.deleted++;
          console.log(`[Cleanup] Deleted old schedule: ${schedule.id} (${schedule.name || 'unnamed'})`);
        } catch (error) {
          console.error(`[Cleanup] Error deleting schedule ${schedule.id}:`, error);
          stats.errors.push({
            scheduleId: schedule.id,
            error: error.message,
          });
        }
      } else {
        stats.kept++;
      }
    }

    console.log(`[Cleanup] Completed: ${stats.deleted} deleted, ${stats.kept} kept, ${stats.errors.length} errors`);
    return stats;
  }
}

export default Scheduler;
