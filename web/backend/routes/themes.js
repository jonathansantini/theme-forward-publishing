import express from 'express';
import { ShopifyGraphQLClient } from '../services/shopify-api.js';
import { MetafieldStorage } from '../services/metafield-storage.js';
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

  return { graphqlClient, storage, modifier };
}

/**
 * GET /api/themes/published - Get the published theme
 */
router.get('/published', verifyAuth, async (req, res) => {
  try {
    const { graphqlClient } = initServices(req.shopifySession);

    console.log('[DEBUG] Fetching published theme...');
    const theme = await graphqlClient.getPublishedTheme();
    console.log('[DEBUG] Published theme result:', JSON.stringify(theme, null, 2));

    if (!theme) {
      console.log('[DEBUG] No theme found, returning 404');
      return res.status(404).json({ error: 'No published theme found' });
    }

    res.json({ theme });
  } catch (error) {
    console.error('Get published theme error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/themes/:themeId/templates - List all JSON templates in a theme
 */
router.get('/:themeId/templates', verifyAuth, async (req, res) => {
  try {
    const { modifier } = initServices(req.shopifySession);
    const templates = await modifier.listTemplates(req.params.themeId);

    res.json({ templates });
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/themes/:themeId/templates/:templateName/sections - Get sections from a template
 */
router.get('/:themeId/templates/:templateName/sections', verifyAuth, async (req, res) => {
  try {
    const { modifier } = initServices(req.shopifySession);
    const { themeId, templateName } = req.params;

    const sections = await modifier.getTemplateSections(themeId, templateName);

    if (!sections) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ sections });
  } catch (error) {
    console.error('Get template sections error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/themes/:themeId/files/:filename - Get a specific theme file
 */
router.get('/:themeId/files/*', verifyAuth, async (req, res) => {
  try {
    const { graphqlClient } = initServices(req.shopifySession);
    const { themeId } = req.params;
    const filename = req.params[0]; // Get the wildcard part

    const file = await graphqlClient.getThemeFile(themeId, filename);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get theme file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/themes/:themeId/validate-section - Validate that a section exists
 */
router.post('/:themeId/validate-section', verifyAuth, async (req, res) => {
  try {
    const { modifier } = initServices(req.shopifySession);
    const { themeId } = req.params;
    const { templateName, sectionId } = req.body;

    if (!templateName || !sectionId) {
      return res.status(400).json({
        error: 'templateName and sectionId are required',
      });
    }

    const validation = await modifier.validateSection(
      themeId,
      templateName,
      sectionId
    );

    res.json(validation);
  } catch (error) {
    console.error('Validate section error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/themes/backups - Get all backups
 */
router.get('/backups/all', verifyAuth, async (req, res) => {
  try {
    const { storage } = initServices(req.shopifySession);
    const backups = await storage.getBackups();

    res.json({ backups });
  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/themes/backups/:backupId/restore - Restore from backup
 */
router.post('/backups/:backupId/restore', verifyAuth, async (req, res) => {
  try {
    const { modifier } = initServices(req.shopifySession);
    const result = await modifier.restoreFromBackup(req.params.backupId);

    res.json(result);
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
