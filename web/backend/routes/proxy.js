import express from 'express';
import { ShopifyGraphQLClient } from '../services/shopify-api.js';
import { shopify } from '../services/shopify-api.js';

const router = express.Router();

/**
 * App Proxy Route for Section Visibility
 *
 * Shopify App Proxy automatically forwards requests from:
 *   https://store.myshopify.com/apps/scheduler/*
 * to:
 *   https://your-app.com/proxy/*
 *
 * Shopify adds these headers:
 *   - X-Shopify-Shop-Domain: the shop domain
 *   - HTTP_X_SHOPIFY_SHOP_DOMAIN: alternative header
 *
 * Configuration in Partner Dashboard:
 *   Subpath: /apps/scheduler
 *   Proxy URL: https://your-backend-url.com/proxy
 */

/**
 * GET /proxy/visibility.js
 * Returns JavaScript that removes hidden sections from the DOM
 *
 * Supports two modes via query param ?mode=js or ?mode=css
 * - js: Returns JavaScript that removes sections from DOM (default)
 * - css: Returns CSS that hides sections with display:none
 */
router.get('/visibility.js', async (req, res) => {
  try {
    // Get shop domain from Shopify proxy headers
    const shop = req.headers['x-shopify-shop-domain'] ||
                 req.headers['http_x_shopify_shop_domain'] ||
                 req.query.shop; // Fallback for testing

    console.log('[Proxy] visibility.js request from shop:', shop);

    if (!shop) {
      console.error('[Proxy] No shop domain in request headers');
      return res.status(400).type('text/javascript').send(
        '// Error: Shop domain not found in request headers'
      );
    }

    // Get the mode (js or css)
    const mode = req.query.mode || 'js';
    console.log('[Proxy] Mode:', mode);

    // Look up session for this shop
    const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);

    if (!sessions || sessions.length === 0) {
      console.error('[Proxy] No session found for shop:', shop);
      return res.status(200).type('text/javascript').send(
        '// No active session - sections will remain visible'
      );
    }

    // Use the first session (in production, you'd want to handle this better)
    const session = sessions[0];

    // Get hidden sections from metafield
    const graphqlClient = new ShopifyGraphQLClient(session);
    const hiddenSections = await getHiddenSections(graphqlClient);

    console.log('[Proxy] Hidden sections:', hiddenSections);

    if (!hiddenSections || hiddenSections.length === 0) {
      return res.status(200).type('text/javascript').send(
        '// No sections to hide'
      );
    }

    // Generate response based on mode
    let response;
    if (mode === 'css') {
      response = generateCSS(hiddenSections);
      res.type('text/css');
    } else {
      response = generateJavaScript(hiddenSections);
      res.type('text/javascript');
    }

    // Set caching headers (cache for 1 minute to balance freshness vs performance)
    res.set('Cache-Control', 'public, max-age=60');

    return res.status(200).send(response);

  } catch (error) {
    console.error('[Proxy] Error in visibility.js:', error);
    return res.status(500).type('text/javascript').send(
      `// Error: ${error.message}`
    );
  }
});

/**
 * GET /proxy/health
 * Simple health check endpoint for the proxy
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    proxy: 'active',
    timestamp: new Date().toISOString()
  });
});

/**
 * Helper: Get hidden sections from shop metafield
 */
async function getHiddenSections(graphqlClient) {
  try {
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
      return [];
    }

    return JSON.parse(metafieldValue);
  } catch (error) {
    console.error('[Proxy] Error getting hidden sections:', error);
    return [];
  }
}

/**
 * Helper: Generate JavaScript to remove sections from DOM
 * This runs inline in <head> before sections render
 */
function generateJavaScript(hiddenSections) {
  return `/**
 * Section Scheduler - Dynamic Section Visibility
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${hiddenSections.join(', ')}
 */
(function() {
  'use strict';

  var hiddenSections = ${JSON.stringify(hiddenSections)};

  // Function to remove sections
  function removeSections() {
    var removed = 0;
    hiddenSections.forEach(function(sectionId) {
      var sectionElement = document.getElementById('shopify-section-' + sectionId);
      if (sectionElement) {
        sectionElement.remove();
        removed++;
      }
    });

    if (removed > 0 && window.console) {
      console.log('[Section Scheduler] Removed ' + removed + ' section(s) from DOM');
    }
  }

  // Try to remove sections as early as possible
  if (document.readyState === 'loading') {
    // Document still loading, wait for DOM to be interactive
    document.addEventListener('DOMContentLoaded', removeSections);
  } else {
    // Document already loaded, remove immediately
    removeSections();
  }
})();
`;
}

/**
 * Helper: Generate CSS to hide sections
 * Fallback mode using display:none
 */
function generateCSS(hiddenSections) {
  const rules = hiddenSections.map(sectionId =>
    `#shopify-section-${sectionId} { display: none !important; }`
  ).join('\n');

  return `/**
 * Section Scheduler - Section Visibility
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${hiddenSections.join(', ')}
 */

${rules}
`;
}

export default router;
