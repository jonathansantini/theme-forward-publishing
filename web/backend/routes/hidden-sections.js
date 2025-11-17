/**
 * Hidden Sections API
 * Returns the list of currently hidden sections for a shop
 * Called by the storefront script tag
 */
import express from 'express';

const router = express.Router();

/**
 * GET /api/hidden-sections?shop=example.myshopify.com
 * Returns: { hiddenSections: ["section-id-1", "section-id-2"] }
 */
router.get('/hidden-sections', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }

    // Get session for this shop
    const sessionId = await req.app.get('shopify').session.getOfflineId(shop);
    const session = await req.app.get('shopify').config.sessionStorage.loadSession(sessionId);

    if (!session) {
      console.warn(`[HiddenSections] No session found for shop: ${shop}`);
      return res.json({ hiddenSections: [] });
    }

    // Import services
    const { ShopifyGraphQLClient } = await import('../services/shopify-api.js');
    const graphqlClient = new ShopifyGraphQLClient(session);

    // Fetch the hidden_sections metafield
    const shopInfo = await graphqlClient.getShopInfo();

    const query = `
      query getHiddenSections($ownerId: ID!) {
        node(id: $ownerId) {
          ... on Shop {
            metafield(namespace: "app_scheduler", key: "hidden_sections") {
              value
            }
          }
        }
      }
    `;

    const response = await graphqlClient.query(query, {
      ownerId: shopInfo.id,
    });

    const metafieldValue = response?.data?.node?.metafield?.value;

    if (!metafieldValue) {
      return res.json({ hiddenSections: [] });
    }

    const hiddenSections = JSON.parse(metafieldValue);

    // Set CORS headers to allow storefront access
    res.set('Access-Control-Allow-Origin', `https://${shop}`);
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    res.json({ hiddenSections });
  } catch (error) {
    console.error('[HiddenSections] Error:', error);
    res.status(500).json({ error: 'Internal server error', hiddenSections: [] });
  }
});

export default router;
