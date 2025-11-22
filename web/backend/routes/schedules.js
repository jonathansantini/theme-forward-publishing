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
    const { storage, scheduler } = initServices(req.shopifySession);

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
    };

    console.log(`[Create] Creating schedule in draft state (finalized=false)`);

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
 */
router.delete('/:id', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);

    await storage.deleteSchedule(req.params.id);

    res.json({ success: true });
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

    // Forward Publishing: If action is 'show', immediately hide the section
    // It will be shown when the schedule executes at the scheduled time
    if (schedule.action === 'show') {
      console.log(`[Finalize] Forward publishing: hiding section ${schedule.sectionId} until scheduled show time`);

      try {
        // Immediately hide the section by adding it to hidden_sections metafield
        const hiddenSections = await modifier.getHiddenSections();
        const updatedSections = await modifier.hideSection(schedule.sectionId, hiddenSections);
        await modifier.updateHiddenSectionsMetafield(updatedSections);

        console.log(`[Finalize] Section ${schedule.sectionId} hidden successfully`);
      } catch (hideError) {
        console.error('[Finalize] Error hiding section for forward publishing:', hideError);
        return res.status(500).json({
          error: 'Failed to hide section for forward publishing',
          details: hideError.message
        });
      }
    }

    // Now finalize the schedule
    const updatedSchedule = await storage.updateSchedule(req.params.id, {
      finalized: true,
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

    // If the schedule has already been executed, revert the changes
    if (schedule.status === 'completed' || schedule.lastRun) {
      console.log(`[Unpublish] Reverting executed schedule ${req.params.id}`);
      console.log(`[Unpublish] Original action was: ${schedule.action}`);

      // Reverse the action: if we hid the section, show it. If we showed it, hide it.
      const reverseAction = schedule.action === 'hide' ? 'show' : 'hide';

      console.log(`[Unpublish] Executing reverse action: ${reverseAction}`);

      result = await modifier.modifyTemplateVisibility(
        schedule.themeId,
        schedule.templateName,
        schedule.sectionId,
        reverseAction
      );

      console.log(`[Unpublish] Reverse action result:`, result);
    } else {
      // Schedule hasn't executed yet
      console.log(`[Unpublish] Cancelling pending schedule ${req.params.id}`);

      // Forward Publishing: If this is a 'show' schedule that was finalized,
      // it was immediately hidden. Now we need to show it again.
      if (schedule.action === 'show' && schedule.finalized) {
        console.log(`[Unpublish] Reverting forward publishing: showing section ${schedule.sectionId}`);

        try {
          result = await modifier.modifyTemplateVisibility(
            schedule.themeId,
            schedule.templateName,
            schedule.sectionId,
            'show'
          );
          console.log(`[Unpublish] Section ${schedule.sectionId} shown successfully`);
        } catch (showError) {
          console.error('[Unpublish] Error showing section:', showError);
        }
      }
    }

    // Update schedule status
    const updatedSchedule = await storage.updateSchedule(req.params.id, {
      status: 'cancelled',
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
