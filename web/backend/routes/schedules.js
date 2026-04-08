import express from 'express';
import { ShopifyGraphQLClient } from '../services/shopify-api.js';
import { MetafieldStorage } from '../services/metafield-storage.js';
import { Scheduler } from '../services/scheduler.js';
import { ThemeModifier } from '../services/theme-modifier.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Initialize services with session
 */
function initServices(session) {
  const graphqlClient = new ShopifyGraphQLClient(session);
  const storage = new MetafieldStorage(graphqlClient);
  const modifier = new ThemeModifier(graphqlClient, storage);
  const scheduler = new Scheduler(graphqlClient, storage, modifier);

  return { graphqlClient, storage, modifier, scheduler };
}

/**
 * GET /api/schedules - Get all schedules
 */
router.get('/', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);
    const schedules = await storage.getSchedules();

    res.json({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schedules/:id - Get a specific schedule
 */
router.get('/:id', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);
    const schedule = await storage.getSchedule(req.params.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedules - Create a new schedule
 * Note: Schedules are always created in draft (finalized=false) state
 * Must explicitly call /finalize to activate forward publishing
 */
router.post('/', verifyAuth, async (req, res) => {
  try {
    const { storage, scheduler, modifier } = initServices(req.shopifySession);

    // Initialize scheduler to get shop timezone
    await scheduler.initialize();

    // Validate schedule data
    const validation = await scheduler.validateSchedule(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    // Check for conflicts
    const conflicts = await scheduler.checkConflicts(req.body);

    if (conflicts.hasConflicts) {
      return res.status(409).json({
        error: 'Schedule conflicts detected',
        conflicts: conflicts.conflicts,
      });
    }

    // IMPORTANT: Always create schedules as drafts (finalized=false)
    // This prevents forward publishing from happening until user explicitly finalizes
    const scheduleData = {
      ...req.body,
      finalized: false, // Force draft state
      startExecuted: false, // Track if start action has been executed
      endExecuted: false, // Track if end action has been executed
    };

    // Handle recurring schedules: calculate first window
    if (req.body.recurrence && req.body.recurrence.enabled) {
      const firstWindow = scheduler.calculateNextRecurringWindow(req.body);
      scheduleData.startTime = firstWindow.startTime;
      scheduleData.endTime = firstWindow.endTime;
      scheduleData.executeAt = firstWindow.startTime;
      console.log(`[Create] Creating recurring schedule - first window from ${firstWindow.startTime} to ${firstWindow.endTime}`);
    } else if (req.body.startTime) {
      // Non-recurring with startTime/endTime
      scheduleData.executeAt = req.body.startTime;
      console.log(`[Create] Creating schedule window from ${req.body.startTime} to ${req.body.endTime || 'none (indefinite)'}`);
    } else {
      console.log(`[Create] Creating schedule in draft state (finalized=false)`);
    }

    // CLEANUP: For 'show' schedules, ensure the section/blocks are visible when created
    // This clears any leftover hidden state from previous schedules
    if (req.body.action === 'show') {
      const blockIds = req.body.blockIds || [];
      const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')}` : `section`;
      console.log(`[Create] Ensuring ${target} in ${req.body.sectionId} is visible for new 'show' schedule`);

      try {
        await modifier.modifyTemplateVisibility(
          req.body.themeId,
          req.body.templateName,
          req.body.sectionId,
          'show',
          blockIds
        );
        console.log(`[Create] ${target} cleanup complete`);
      } catch (cleanupError) {
        console.error('[Create] Error during cleanup:', cleanupError);
        // Continue with schedule creation even if cleanup fails
      }
    }

    // Create schedule
    const schedule = await storage.createSchedule(scheduleData);

    res.status(201).json({ schedule });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schedules/:id - Update a schedule
 */
router.put('/:id', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);

    const schedule = await storage.updateSchedule(req.params.id, req.body);

    res.json({ schedule });
  } catch (error) {
    console.error('Update schedule error:', error);

    if (error.message.includes('finalized')) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schedules/:id - Delete a schedule
 * Always ensures sections are visible after deletion
 */
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { storage, modifier } = initServices(req.shopifySession);

    // Get the schedule first to check if we need to revert changes
    const schedule = await storage.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    let result = null;

    // SIMPLE RULE: Deleting any schedule always shows the section/blocks
    // This ensures content is visible after schedule removal
    const blockIds = schedule.blockIds || [];
    const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')}` : `section`;
    console.log(`[Delete] Ensuring ${target} in ${schedule.sectionId} is visible`);

    try {
      result = await modifier.modifyTemplateVisibility(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        'show',
        blockIds
      );
      console.log(`[Delete] ${target} shown successfully`);
    } catch (showError) {
      console.error('[Delete] Error showing content:', showError);
      // Continue with deletion even if show fails
    }

    // Now delete the schedule
    await storage.deleteSchedule(req.params.id);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedules/:id/finalize - Finalize a schedule (lock it)
 * For 'show' schedules: implements forward publishing by immediately hiding the section
 */
router.post('/:id/finalize', verifyAuth, async (req, res) => {
  try {
    const { storage, modifier } = initServices(req.shopifySession);

    // Get the schedule details first
    const schedule = await storage.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Forward Publishing: If action is 'show', immediately hide the section/blocks
    // They will be shown when the schedule executes at the scheduled time
    if (schedule.action === 'show') {
      const blockIds = schedule.blockIds || [];
      const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')}` : `section`;
      console.log(`[Finalize] Forward publishing: hiding ${target} in ${schedule.sectionId} until scheduled show time`);

      try {
        // Immediately hide the section/blocks
        if (blockIds.length > 0) {
          // Hide specific blocks - use modifyBlockVisibility to properly store positions
          await modifier.modifyBlockVisibility(
            schedule.themeId,
            schedule.templateName,
            schedule.sectionId,
            blockIds,
            'hide'
          );
        } else {
          // Hide entire section
          const hiddenSections = await modifier.getHiddenSections();
          const updatedSections = await modifier.hideSection(schedule.sectionId, hiddenSections);
          await modifier.updateHiddenSectionsMetafield(updatedSections);
        }

        console.log(`[Finalize] ${target} hidden successfully`);
      } catch (hideError) {
        console.error('[Finalize] Error hiding content for forward publishing:', hideError);
        return res.status(500).json({
          error: 'Failed to hide content for forward publishing',
          details: hideError.message
        });
      }
    }

    // Now finalize the schedule - also ensure status is pending
    const updatedSchedule = await storage.updateSchedule(req.params.id, {
      finalized: true,
      status: 'pending',
    });

    res.json({
      schedule: updatedSchedule,
      forwardPublished: schedule.action === 'show'
    });
  } catch (error) {
    console.error('Finalize schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedules/:id/unpublish - Unpublish a schedule (unlock it)
 * Always ensures sections are visible after unpublishing
 */
router.post('/:id/unpublish', verifyAuth, async (req, res) => {
  try {
    const { storage, modifier } = initServices(req.shopifySession);

    // Get the schedule
    const schedule = await storage.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    let result = null;

    // SIMPLE RULE: Unpublishing any schedule always shows the section/blocks
    // This ensures content is visible when schedules are cancelled
    const blockIds = schedule.blockIds || [];
    const target = blockIds.length > 0 ? `blocks ${blockIds.join(', ')}` : `section`;
    console.log(`[Unpublish] Ensuring ${target} in ${schedule.sectionId} is visible`);

    try {
      result = await modifier.modifyTemplateVisibility(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        'show',
        blockIds
      );
      console.log(`[Unpublish] ${target} shown successfully`);
    } catch (showError) {
      console.error('[Unpublish] Error showing content:', showError);
      // Continue with unpublish even if show fails
    }

    // Update schedule status - set to pending so it can be re-executed
    const updatedSchedule = await storage.updateSchedule(req.params.id, {
      status: 'pending',
      finalized: false,
    });

    res.json({ schedule: updatedSchedule, result });
  } catch (error) {
    console.error('Unpublish schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schedules/logs - Get execution logs
 */
router.get('/logs/all', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);
    const logs = await storage.getExecutionLogs();

    res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
