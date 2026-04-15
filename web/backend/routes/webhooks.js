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

    console.log('[Webhook] Customer data request for shop:', shop);
    console.log('[Webhook] Customer ID:', webhookData.customer?.id);
    console.log('[Webhook] Request ID:', webhookData.shop_domain);

    // This app does not collect or store customer-specific data
    // We only store shop-level schedule configuration (sections, times, actions)
    // No customer PII is collected or stored

    const responseData = {
      app_name: 'Smart Content Scheduler',
      shop_domain: shop,
      customer_id: webhookData.customer?.id,
      data_collected: 'none',
      explanation: 'This app does not collect or store customer-specific data. It only stores shop-level section scheduling configuration which is not tied to individual customers.',
      schedules: 'Shop-level section visibility schedules (not customer-specific)',
      processed_at: new Date().toISOString(),
    };

    console.log('[Webhook] Data request response:', responseData);

    // In a real implementation, you might want to:
    // 1. Log this request for audit purposes
    // 2. Email the data to the merchant
    // 3. Store the request in a compliance log

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

    console.log('[Webhook] Customer redaction for shop:', shop);
    console.log('[Webhook] Customer ID:', webhookData.customer?.id);
    console.log('[Webhook] Request ID:', webhookData.shop_domain);

    // This app does not collect or store customer-specific data
    // No action needed as there is no customer PII to redact
    // We only store shop-level configuration data

    // Log the redaction request for compliance audit trail
    console.log('[Webhook] Customer redaction completed (no data stored)');
    console.log('[Webhook] Processed at:', new Date().toISOString());

    // In a production app, you might:
    // 1. Search for any customer-specific data
    // 2. Delete or anonymize it
    // 3. Log the deletion for compliance audit
    // 4. Confirm deletion via email

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
    const webhookData = req.body;

    console.log('[Webhook] Shop redaction for:', shop);
    console.log('[Webhook] Shop ID:', webhookData.shop_id);
    console.log('[Webhook] Shop domain:', webhookData.shop_domain);

    // This webhook fires 48 hours after app uninstall
    // We must delete ALL shop data per GDPR requirements

    const deletionLog = {
      shop,
      startTime: new Date().toISOString(),
      sessionsDeleted: 0,
      errors: [],
    };

    // 1. Delete all sessions for this shop
    try {
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
      if (sessions && sessions.length > 0) {
        for (const session of sessions) {
          await shopify.config.sessionStorage.deleteSession(session.id);
          deletionLog.sessionsDeleted++;
          console.log(`[Webhook] Deleted session: ${session.id}`);
        }
      }
      console.log(`[Webhook] Deleted ${deletionLog.sessionsDeleted} session(s)`);
    } catch (error) {
      console.error('[Webhook] Error deleting sessions:', error);
      deletionLog.errors.push(`Session deletion: ${error.message}`);
    }

    // 2. Note: Metafields are automatically deleted by Shopify when app is uninstalled
    // Our app uses shop metafields which Shopify removes on app uninstall
    // Reference: https://shopify.dev/docs/apps/build/privacy-law-compliance#shop-data-erasure
    console.log('[Webhook] Metafields automatically deleted by Shopify on uninstall');

    // 3. Remove from any active tracking
    if (global.activeShops && global.activeShops.has(shop)) {
      global.activeShops.delete(shop);
      console.log(`[Webhook] Removed ${shop} from active shops tracking`);
    }

    deletionLog.completedAt = new Date().toISOString();
    deletionLog.status = deletionLog.errors.length === 0 ? 'success' : 'partial';

    console.log('[Webhook] Shop redaction completed:', deletionLog);

    // In production, you might want to:
    // 1. Store deletion log for compliance audit
    // 2. Send confirmation email
    // 3. Update external systems
    // 4. Archive data in compliance-approved long-term storage

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error processing shop/redact:', error);
    return res.status(200).send('Error acknowledged');
  }
});

export default router;
