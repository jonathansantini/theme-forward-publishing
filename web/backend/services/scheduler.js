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
   * Execute a single schedule
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
      const executeAt = moment(schedule.executeAt).tz(this.shopTimezone);

      // Check if it's time to execute
      if (now.isSameOrAfter(executeAt)) {
        console.log(`Schedule ${schedule.id} is due for execution`);

        try {
          const result = await this.executeSchedule(schedule);
          results.push({ scheduleId: schedule.id, ...result });
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
    if (!scheduleData.executeAt) errors.push('Execution time is required');

    // Validate action
    if (!['show', 'hide'].includes(scheduleData.action)) {
      errors.push('Action must be either "show" or "hide"');
    }

    // Validate execution time is in the future
    const executeAt = moment(scheduleData.executeAt).tz(
      this.shopTimezone || 'UTC'
    );
    const now = moment().tz(this.shopTimezone || 'UTC');

    if (executeAt.isSameOrBefore(now)) {
      errors.push('Execution time must be in the future');
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
}

export default Scheduler;
