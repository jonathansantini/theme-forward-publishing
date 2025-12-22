import express from 'express';
import { shopify } from '../services/shopify-api.js';

const router = express.Router();

/**
 * Webhook: app/uninstalled
 *
 * This webhook fires when a merchant uninstalls the app.
 * Use it to clean up data, cancel subscriptions, or perform other cleanup tasks.
 *
 * Reference: https://shopify.dev/docs/apps/build/webhooks/subscribe
 */
router.post('/app/uninstalled', async (req, res) => {
  try {
    console.log('[Webhook] App uninstalled event received');

    // Get shop domain from webhook headers
    const shop = req.headers['x-shopify-shop-domain'];
    console.log('[Webhook] Shop:', shop);

    if (!shop) {
      console.error('[Webhook] No shop domain in webhook headers');
      return res.status(400).send('Missing shop domain');
    }

    // Clean up sessions for this shop
    try {
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);

      if (sessions && sessions.length > 0) {
        for (const session of sessions) {
          await shopify.config.sessionStorage.deleteSession(session.id);
          console.log(`[Webhook] Deleted session: ${session.id}`);
        }
      }
    } catch (error) {
      console.error('[Webhook] Error deleting sessions:', error);
    }

    // Remove shop from active shops tracking
    if (global.activeShops && global.activeShops.has(shop)) {
      global.activeShops.delete(shop);
      console.log(`[Webhook] Removed ${shop} from active shops`);
    }

    // Additional cleanup tasks
    // TODO: Add any additional cleanup logic here:
    // - Cancel external subscriptions
    // - Archive merchant data
    // - Send notification to your team
    // - etc.

    console.log('[Webhook] App uninstall cleanup completed for:', shop);

    // Return 200 OK to acknowledge receipt
    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing app/uninstalled webhook:', error);
    // Still return 200 to prevent Shopify from retrying
    return res.status(200).send('Error acknowledged');
  }
});

/**
 * Optional: GDPR webhooks
 *
 * Shopify requires apps to provide endpoints for GDPR compliance.
 * Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */

// Webhook: customers/data_request
router.post('/customers/data_request', async (req, res) => {
  try {
    console.log('[Webhook] Customer data request received');
    const shop = req.headers['x-shopify-shop-domain'];
    const webhookData = req.body;

    // TODO: Implement logic to gather and send customer data
    // Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance#customer-data-request

    console.log('[Webhook] Customer data request for shop:', shop);
    console.log('[Webhook] Request data:', webhookData);

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing customers/data_request:', error);
    return res.status(200).send('Error acknowledged');
  }
});

// Webhook: customers/redact
router.post('/customers/redact', async (req, res) => {
  try {
    console.log('[Webhook] Customer redaction request received');
    const shop = req.headers['x-shopify-shop-domain'];
    const webhookData = req.body;

    // TODO: Implement logic to redact customer data
    // Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance#customer-data-erasure

    console.log('[Webhook] Customer redaction for shop:', shop);
    console.log('[Webhook] Redaction data:', webhookData);

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing customers/redact:', error);
    return res.status(200).send('Error acknowledged');
  }
});

// Webhook: shop/redact
router.post('/shop/redact', async (req, res) => {
  try {
    console.log('[Webhook] Shop redaction request received');
    const shop = req.headers['x-shopify-shop-domain'];

    // TODO: Implement logic to redact all shop data (48 hours after uninstall)
    // Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance#shop-data-erasure

    console.log('[Webhook] Shop redaction for:', shop);

    // Clean up all data for this shop
    try {
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
      if (sessions) {
        for (const session of sessions) {
          await shopify.config.sessionStorage.deleteSession(session.id);
        }
      }
    } catch (error) {
      console.error('[Webhook] Error during shop redaction:', error);
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing shop/redact:', error);
    return res.status(200).send('Error acknowledged');
  }
});

export default router;
