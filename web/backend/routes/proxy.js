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

    // Get hidden sections and blocks from metafields
    const graphqlClient = new ShopifyGraphQLClient(session);
    const hiddenSections = await getHiddenSections(graphqlClient);
    const hiddenBlocks = await getHiddenBlocks(graphqlClient);

    console.log('[Proxy] Hidden sections:', hiddenSections);
    console.log('[Proxy] Hidden blocks:', hiddenBlocks);

    if ((!hiddenSections || hiddenSections.length === 0) &&
        (!hiddenBlocks || Object.keys(hiddenBlocks).length === 0)) {
      return res.status(200).type('text/javascript').send(
        '// No sections or blocks to hide'
      );
    }

    // Generate response based on mode
    let response;
    if (mode === 'css') {
      response = generateCSS(hiddenSections, hiddenBlocks);
      res.type('text/css');
    } else {
      response = generateJavaScript(hiddenSections, hiddenBlocks);
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
 * Helper: Get hidden blocks from shop metafield
 * Returns object like: { "section_id": [{"blockId": "block_1", "position": 0}, ...] }
 * Legacy format with strings is also supported
 */
async function getHiddenBlocks(graphqlClient) {
  try {
    const shopInfo = await graphqlClient.getShopInfo();

    const query = `
      query getHiddenBlocks($ownerId: ID!) {
        node(id: $ownerId) {
          ... on Shop {
            metafield(namespace: "app_scheduler", key: "hidden_blocks") {
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
      return {};
    }

    return JSON.parse(metafieldValue);
  } catch (error) {
    console.error('[Proxy] Error getting hidden blocks:', error);
    return {};
  }
}

/**
 * Helper: Generate JavaScript to remove sections and blocks from DOM
 * This runs inline in <head> before sections render
 * Includes CSS injection for immediate hiding before theme scripts initialize
 */
function generateJavaScript(hiddenSections, hiddenBlocks) {
  const sectionsList = hiddenSections || [];
  const blocksList = hiddenBlocks || {};

  // Generate inline CSS rules for immediate block hiding
  let inlineCSS = '';
  for (const sectionId in blocksList) {
    if (!blocksList.hasOwnProperty(sectionId)) continue;

    const blocks = blocksList[sectionId];
    blocks.forEach(block => {
      const blockId = typeof block === 'string' ? block : block.blockId;
      const position = typeof block === 'object' ? block.position : -1;

      if (position >= 0) {
        // Position-based CSS rules (nth-child is 1-indexed)
        const nthChild = position + 1;
        // Target multiple possible block patterns
        inlineCSS += `[id*="__${sectionId}"] .slideshow__slide:nth-child(${nthChild}),\n`;
        inlineCSS += `[id*="__${sectionId}"] [class$="__slide"]:nth-child(${nthChild}),\n`;
        inlineCSS += `[id*="__${sectionId}"] [id^="Slide-"]:nth-child(${nthChild}),\n`;
        inlineCSS += `[id*="__${sectionId}"] .collapsible-content__item:nth-child(${nthChild}),\n`;
        inlineCSS += `[id*="__${sectionId}"] li:nth-child(${nthChild}) { display: none !important; }\n`;
      }

      // Also hide by block ID as fallback
      inlineCSS += `[id*="${blockId}"] { display: none !important; }\n`;
    });
  }

  // Generate CSS for hidden sections
  sectionsList.forEach(sectionId => {
    inlineCSS += `#shopify-section-${sectionId} { display: none !important; }\n`;
  });

  return `/**
 * Section Scheduler - Dynamic Section & Block Visibility
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${sectionsList.join(', ')}
 * Hidden blocks: ${JSON.stringify(blocksList)}
 */
(function() {
  'use strict';

  // Inject CSS immediately to hide blocks before theme scripts initialize
  var styleElement = document.createElement('style');
  styleElement.id = 'section-scheduler-css';
  styleElement.textContent = \`${inlineCSS}\`;
  document.head.appendChild(styleElement);

  var hiddenSections = ${JSON.stringify(sectionsList)};
  var hiddenBlocks = ${JSON.stringify(blocksList)};

  // Function to remove sections
  function removeSections() {
    var removed = 0;
    hiddenSections.forEach(function(sectionId) {
      // Try multiple ID patterns that Shopify uses for sections
      var selectors = [
        'shopify-section-' + sectionId,  // Standard pattern
        'Banner-template--' + sectionId,  // Some themes use Banner prefix
      ];

      // Also try to find by attribute selector (ends with section ID)
      var elements = document.querySelectorAll('[id*="__' + sectionId + '"]');

      var found = false;

      // Try direct ID selectors first
      for (var i = 0; i < selectors.length; i++) {
        var element = document.getElementById(selectors[i]);
        if (element) {
          element.remove();
          removed++;
          found = true;
          break;
        }
      }

      // If not found, try querySelectorAll results
      if (!found && elements.length > 0) {
        elements.forEach(function(el) {
          el.remove();
          removed++;
        });
      }
    });

    if (removed > 0 && window.console) {
      console.log('[Section Scheduler] Removed ' + removed + ' section(s) from DOM');
    }
  }

  // Function to remove blocks within sections
  function removeBlocks() {
    var removed = 0;

    // Iterate through each section that has hidden blocks
    for (var sectionId in hiddenBlocks) {
      if (!hiddenBlocks.hasOwnProperty(sectionId)) continue;

      var blocks = hiddenBlocks[sectionId];

      blocks.forEach(function(block) {
        var found = false;
        var blockId, position;

        // Support both old format (string) and new format (object with position)
        if (typeof block === 'string') {
          blockId = block;
          position = -1;
        } else {
          blockId = block.blockId;
          position = block.position;
        }

        // Find the section container first
        var sectionContainer = document.querySelector('[id*="__' + sectionId + '"]');

        if (!sectionContainer) {
          console.log('[Section Scheduler] Could not find section container: ' + sectionId);
          return;
        }

        // Strategy 1: Try position-based targeting (primary for slideshows)
        if (position >= 0) {
          // Try specific block selectors in order of specificity
          // More specific selectors first to avoid matching parent containers
          var selectors = [
            '.slideshow__slide',           // Shopify Dawn theme slideshow slides
            '[class$="__slide"]',          // BEM pattern for slides
            '[id^="Slide-"]',              // Slide IDs that start with "Slide-"
            '.collapsible-content__item',  // Collapsible content items
            '[id^="Details-"]',            // Details/collapsible IDs
            'li[class*="slide"]',          // List items that are slides
            'div[class*="block-"]'         // Div blocks with block- prefix
          ];

          // Try each selector until we find matching elements
          for (var s = 0; s < selectors.length; s++) {
            var blockContainers = sectionContainer.querySelectorAll(selectors[s]);
            if (blockContainers.length > position) {
              blockContainers[position].remove();
              removed++;
              found = true;
              break;
            }
          }
        }

        // Strategy 2: Try to find by block ID in element ID (fallback)
        if (!found) {
          var blockElements = sectionContainer.querySelectorAll('[id*="' + blockId + '"]');

          if (blockElements.length > 0) {
            blockElements.forEach(function(el) {
              el.remove();
              removed++;
              found = true;
            });
          }
        }

        if (!found && window.console) {
          console.log('[Section Scheduler] Could not find block: ' + blockId + ' (position: ' + position + ') in section: ' + sectionId);
        }
      });
    }

    if (removed > 0 && window.console) {
      console.log('[Section Scheduler] Removed ' + removed + ' block(s) from DOM');
    }
  }

  // Function to apply all hiding
  function applyVisibility() {
    removeSections();
    removeBlocks();
  }

  // Try to remove sections/blocks as early as possible
  if (document.readyState === 'loading') {
    // Document still loading, wait for DOM to be interactive
    document.addEventListener('DOMContentLoaded', applyVisibility);
  } else {
    // Document already loaded, remove immediately
    applyVisibility();
  }
})();
`;
}

/**
 * Helper: Generate CSS to hide sections and blocks
 * Fallback mode using display:none
 */
function generateCSS(hiddenSections, hiddenBlocks) {
  const sectionsList = hiddenSections || [];
  const blocksList = hiddenBlocks || {};

  // Generate section hiding rules
  const sectionRules = sectionsList.map(sectionId =>
    `#shopify-section-${sectionId} { display: none !important; }`
  ).join('\n');

  // Generate block hiding rules
  let blockRules = '';
  for (const sectionId in blocksList) {
    if (!blocksList.hasOwnProperty(sectionId)) continue;

    const blocks = blocksList[sectionId];
    blocks.forEach(block => {
      // Support both old format (string) and new format (object)
      const blockId = typeof block === 'string' ? block : block.blockId;
      // Target elements containing the block ID
      blockRules += `[id*="${blockId}"] { display: none !important; }\n`;
    });
  }

  return `/**
 * Section Scheduler - Section & Block Visibility
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${sectionsList.join(', ')}
 * Hidden blocks: ${JSON.stringify(blocksList)}
 */

${sectionRules}
${blockRules}
`;
}

export default router;
