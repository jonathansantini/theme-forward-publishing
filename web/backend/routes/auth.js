import express from 'express';
import { shopify } from '../services/shopify-api.js';

const router = express.Router();

/**
 * Begin OAuth flow
 */
router.get('/auth', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    // Begin OAuth process (v12 API)
    await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(shop),
      callbackPath: '/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error('Auth begin error:', error);
    res.status(500).json({ error: 'Failed to begin authentication' });
  }
});

/**
 * OAuth callback
 */
router.get('/auth/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Store session
    await shopify.config.sessionStorage.storeSession(session);

    // Track this shop as active for schedule processing
    if (global.activeShops) {
      global.activeShops.set(session.shop, session);
      console.log(`Added ${session.shop} to active shops for schedule processing`);
    }

    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;

    // Redirect to app
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication callback failed' });
  }
});

export default router;
