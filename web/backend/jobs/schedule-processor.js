import cron from 'node-cron';

/**
 * Schedule Processor Cron Job
 * Runs every minute to check and execute pending schedules
 */
export class ScheduleProcessor {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Start the cron job
   */
  start() {
    if (this.cronJob) {
      console.log('Schedule processor is already running');
      return;
    }

    // Run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        console.log('Previous job still running, skipping...');
        return;
      }

      this.isRunning = true;

      try {
        console.log('Schedule processor: Starting execution cycle');
        const results = await this.scheduler.processPendingSchedules();

        if (results.length > 0) {
          console.log(`Processed ${results.length} schedule(s)`);
          results.forEach((result) => {
            if (result.success) {
              console.log(`  ✓ Schedule ${result.scheduleId} executed successfully`);
            } else {
              console.error(`  ✗ Schedule ${result.scheduleId} failed: ${result.error}`);
            }
          });
        }
      } catch (error) {
        console.error('Schedule processor error:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('Schedule processor started - running every minute');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Schedule processor stopped');
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      running: this.cronJob !== null,
      processing: this.isRunning,
    };
  }

  /**
   * Manually trigger processing (for testing)
   */
  async triggerManually() {
    console.log('Manually triggering schedule processor...');

    if (this.isRunning) {
      throw new Error('Processor is already running');
    }

    this.isRunning = true;

    try {
      const results = await this.scheduler.processPendingSchedules();
      return results;
    } finally {
      this.isRunning = false;
    }
  }
}

export default ScheduleProcessor;
