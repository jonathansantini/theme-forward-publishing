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

    // Create schedule
    const schedule = await storage.createSchedule(req.body);

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
 */
router.post('/:id/finalize', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);

    const schedule = await storage.updateSchedule(req.params.id, {
      finalized: true,
    });

    res.json({ schedule });
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
    const { storage } = initServices(req.shopifySession);

    const schedule = await storage.updateSchedule(req.params.id, {
      finalized: false,
    });

    res.json({ schedule });
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
