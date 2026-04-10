import express from 'express';
import { ShopifyGraphQLClient } from '../services/shopify-api.js';
import { shopify } from '../services/shopify-api.js';
import { validateProxyHmac } from '../middleware/validate-proxy-hmac.js';

const router = express.Router();

// Apply HMAC validation to all proxy routes
router.use(validateProxyHmac);

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
 *
 * Cache buster: Add ?v=timestamp to force reload
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

    // NOTE: Always generate the full script even if metafields are empty
    // The script includes customizer badge logic that fetches schedules
    // independently from /schedules.json endpoint (not from metafields)
    // This avoids GraphQL caching issues with metafields

    // Generate response based on mode
    let response;
    if (mode === 'css') {
      response = generateCSS(hiddenSections, hiddenBlocks);
      res.type('text/css');
    } else {
      response = generateJavaScript(hiddenSections, hiddenBlocks);
      res.type('text/javascript');
    }

    // Set caching headers (NO cache during development for testing)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.status(200).send(response);

  } catch (error) {
    console.error('[Proxy] Error in visibility.js:', error);
    return res.status(500).type('text/javascript').send(
      `// Error: ${error.message}`
    );
  }
});

/**
 * GET /proxy/schedules.json
 * Returns schedules for customizer badges
 * Query params:
 *   - template: template name (e.g., "index.json")
 */
router.get('/schedules.json', async (req, res) => {
  try {
    const shop = req.headers['x-shopify-shop-domain'] ||
                 req.headers['http_x_shopify_shop_domain'] ||
                 req.query.shop;

    console.log('[Proxy] schedules.json request from shop:', shop);

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain not found' });
    }

    const template = req.query.template;
    console.log('[Proxy] Fetching schedules for template:', template);

    // Look up session for this shop
    const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);

    if (!sessions || sessions.length === 0) {
      return res.json({ schedules: [] });
    }

    const session = sessions[0];
    const graphqlClient = new ShopifyGraphQLClient(session);

    // Get all schedules from metafield
    const schedules = await getSchedules(graphqlClient);

    // Filter by template if specified
    let filteredSchedules = schedules;
    if (template) {
      filteredSchedules = schedules.filter(s => s.templateName === template);
    }

    // Map to customizer-friendly format
    const customizerSchedules = filteredSchedules.map(s => ({
      id: s.id,
      sectionId: s.sectionId,
      action: s.action,
      status: s.status,
      startTime: s.startTime,
      endTime: s.endTime,
      name: s.name,
      finalized: s.finalized,
    }));

    // Set short cache
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ schedules: customizerSchedules });

  } catch (error) {
    console.error('[Proxy] Error in schedules.json:', error);
    return res.status(500).json({ error: error.message });
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

    const metafieldValue = response?.node?.metafield?.value;

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
 * Helper: Get all schedules from shop metafield
 */
async function getSchedules(graphqlClient) {
  try {
    const shopInfo = await graphqlClient.getShopInfo();

    const query = `
      query getSchedules($ownerId: ID!) {
        node(id: $ownerId) {
          ... on Shop {
            metafield(namespace: "app_scheduler", key: "schedules") {
              value
            }
          }
        }
      }
    `;

    const response = await graphqlClient.query(query, {
      ownerId: shopInfo.id,
    });

    const metafieldValue = response?.node?.metafield?.value;

    if (!metafieldValue) {
      return [];
    }

    const data = JSON.parse(metafieldValue);
    return data.schedules || [];
  } catch (error) {
    console.error('[Proxy] Error getting schedules:', error);
    return [];
  }
}

/**
 * Helper: Generate JavaScript to remove sections and blocks from DOM
 */
function generateJavaScript(hiddenSections, hiddenBlocks) {
  const sectionsList = hiddenSections || [];
  const blocksMap = hiddenBlocks || {};

  return `/**
 * Section Scheduler - Dynamic Section & Block Visibility
 * Version: 2.0.0-customizer-badges
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${sectionsList.join(', ')}
 * Hidden blocks: ${JSON.stringify(blocksMap)}
 */
(function() {
  'use strict';

  console.log('[Section Scheduler] Script version: 2.0.0-customizer-badges');

  var hiddenSections = ${JSON.stringify(sectionsList)};
  var hiddenBlocks = ${JSON.stringify(blocksMap)};

  console.log('[Section Scheduler Inline] removeBlocks called, hiddenBlocks:', hiddenBlocks);

  // Check if we're in the theme customizer
  function isInCustomizer() {
    // Method 1: Check if we're in an iframe
    var inIframe = window.parent !== window;

    if (!inIframe) {
      // Not in iframe, check current window URL
      return window.location.search.includes('_ab=') ||
             window.location.search.includes('key=');
    }

    // Method 2: If in iframe, try to check parent URL (might be blocked by CORS)
    try {
      var parentUrl = window.parent.location.href;
      if (parentUrl.includes('admin/themes') ||
          parentUrl.includes('customize') ||
          parentUrl.includes('_ab=')) {
        return true;
      }
    } catch (e) {
      // Cross-origin, can't access parent URL
      console.log('[Section Scheduler] Cannot access parent URL (CORS)');
    }

    // Method 3: Check iframe attributes via frameElement
    try {
      if (window.frameElement) {
        var iframeId = window.frameElement.id || '';
        var iframeClass = window.frameElement.className || '';
        var iframeTitle = window.frameElement.title || '';

        console.log('[Section Scheduler] Iframe detected:', {
          id: iframeId,
          class: iframeClass,
          title: iframeTitle
        });

        // Shopify customizer uses specific iframe IDs/classes
        if (iframeId.includes('storefront-iframe') ||
            iframeClass.includes('StaticIframe') ||
            iframeTitle.includes('preview')) {
          return true;
        }
      }
    } catch (e) {
      console.log('[Section Scheduler] Cannot access frameElement:', e.message);
    }

    // Method 4: If we're in an iframe but can't determine the parent,
    // assume we're in customizer (safe assumption for most cases)
    return inIframe;
  }

  var inCustomizer = isInCustomizer();
  console.log('[Section Scheduler] In customizer mode:', inCustomizer);

  // Function to remove blocks from sections
  function removeBlocks() {
    var removed = 0;

    for (var sectionId in hiddenBlocks) {
      var blockIds = hiddenBlocks[sectionId];
      console.log('[Section Scheduler Inline] Processing section:', sectionId);

      // Find the section container
      var sectionContainer = document.querySelector('[id*="' + sectionId + '"]');
      console.log('[Section Scheduler Inline] Section container found:', !!sectionContainer);

      if (sectionContainer) {
        blockIds.forEach(function(blockId) {
          // Try multiple selectors for blocks
          var blockSelectors = [
            '[id*="' + blockId + '"]',
            '[data-block-id="' + blockId + '"]',
            '.' + blockId
          ];

          blockSelectors.forEach(function(selector) {
            var blocks = sectionContainer.querySelectorAll(selector);
            blocks.forEach(function(block) {
              block.remove();
              removed++;
              console.log('[Section Scheduler Inline] Removed block:', blockId);
            });
          });
        });
      }
    }

    if (removed > 0 && window.console) {
      console.log('[Section Scheduler Inline] Removed ' + removed + ' block(s) from DOM');
    }
  }

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

  // Function to apply all hiding
  function applyVisibility() {
    // Skip hiding in customizer - badges will show status instead
    if (inCustomizer) {
      console.log('[Section Scheduler] Skipping hide in customizer - badges will show status');
      return;
    }
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

  // ===== CUSTOMIZER BADGES =====
  // Show visual indicators in theme customizer for scheduled sections

  function isAdmin() {
    // Check if logged in as admin (Shopify sets _shopify_y cookie for admins)
    return document.cookie.includes('_shopify_y=');
  }

  async function injectCustomizerBadges() {
    if (!inCustomizer) {
      console.log('[Section Scheduler] Not in customizer, skipping badges');
      return;
    }

    console.log('[Section Scheduler] In customizer mode - injecting badges');

    try {
      // Get current template name from meta tag or URL
      var templateMeta = document.querySelector('meta[name="shopify-template"]');
      var template = templateMeta ? templateMeta.content : null;

      if (!template) {
        console.log('[Section Scheduler] Could not determine template name');
        return;
      }

      // Fetch schedules for this template
      var response = await fetch('/apps/scheduler/schedules.json?template=' + template);
      var data = await response.json();
      var schedules = data.schedules || [];

      console.log('[Section Scheduler] Found ' + schedules.length + ' schedules for template:', template);

      // Inject CSS for badges
      injectBadgeStyles();

      // Add badges to scheduled sections
      schedules.forEach(function(schedule) {
        addBadgeToSection(schedule);
      });

    } catch (error) {
      console.error('[Section Scheduler] Error injecting customizer badges:', error);
    }
  }

  function injectBadgeStyles() {
    if (document.getElementById('section-scheduler-styles')) {
      return; // Already injected
    }

    var style = document.createElement('style');
    style.id = 'section-scheduler-styles';
    style.textContent = \`
      .section-scheduler-badge {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .section-scheduler-badge.status-pending {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .section-scheduler-badge.status-active {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      .section-scheduler-badge.status-completed {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }

      .section-scheduler-badge-icon {
        margin-right: 8px;
      }

      .section-scheduler-badge-link {
        color: white;
        text-decoration: none;
        padding: 4px 12px;
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
        font-size: 12px;
        transition: background 0.2s;
      }

      .section-scheduler-badge-link:hover {
        background: rgba(255,255,255,0.3);
      }

      .section-scheduler-overlay {
        position: relative;
      }

      .section-scheduler-overlay.is-hidden {
        opacity: 0.4;
        pointer-events: none;
      }
    \`;
    document.head.appendChild(style);
  }

  function addBadgeToSection(schedule) {
    // Find section element
    var sectionSelectors = [
      '#shopify-section-' + schedule.sectionId,
      '[id*="__' + schedule.sectionId + '"]',
      '[id*="' + schedule.sectionId + '"]'
    ];

    var sectionElement = null;
    for (var i = 0; i < sectionSelectors.length; i++) {
      sectionElement = document.querySelector(sectionSelectors[i]);
      if (sectionElement) break;
    }

    if (!sectionElement) {
      console.log('[Section Scheduler] Section element not found for:', schedule.sectionId);
      return;
    }

    // Don't add badge twice
    if (sectionElement.querySelector('.section-scheduler-badge')) {
      return;
    }

    // Create badge element
    var badge = document.createElement('div');
    badge.className = 'section-scheduler-badge status-' + schedule.status;

    var icon = schedule.status === 'active' ? '🔴' :
               schedule.status === 'pending' ? '⏰' : '✅';

    var statusText = schedule.status === 'active' ? 'Active - ' + (schedule.action === 'hide' ? 'Hidden' : 'Shown') + ' by app' :
                     schedule.status === 'pending' ? 'Scheduled to ' + schedule.action :
                     'Completed';

    var timeText = '';
    if (schedule.startTime && schedule.endTime) {
      var start = new Date(schedule.startTime).toLocaleString();
      var end = new Date(schedule.endTime).toLocaleString();
      timeText = start + ' - ' + end;
    } else if (schedule.startTime) {
      timeText = new Date(schedule.startTime).toLocaleString();
    }

    // Build app URL
    var appUrl = '/admin/apps/section-scheduler-1'; // Will need to get actual app handle

    badge.innerHTML = \`
      <div>
        <span class="section-scheduler-badge-icon">\${icon}</span>
        <span>\${schedule.name || statusText}</span>
        \${timeText ? '<div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">' + timeText + '</div>' : ''}
      </div>
      <a href="\${appUrl}" target="_top" class="section-scheduler-badge-link">
        Edit Schedule →
      </a>
    \`;

    // Add overlay class to section
    sectionElement.classList.add('section-scheduler-overlay');
    if (schedule.status === 'active' && schedule.action === 'hide') {
      sectionElement.classList.add('is-hidden');
    }

    // Make section position relative if needed
    var computedStyle = window.getComputedStyle(sectionElement);
    if (computedStyle.position === 'static') {
      sectionElement.style.position = 'relative';
    }

    // Insert badge at the top of the section
    sectionElement.insertBefore(badge, sectionElement.firstChild);
  }

  // Run customizer badge injection after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCustomizerBadges);
  } else {
    // Try immediately, but also retry after a short delay in case sections load dynamically
    injectCustomizerBadges();
    setTimeout(injectCustomizerBadges, 1000);
  }
})();
`;
}

/**
 * Helper: Generate CSS to hide sections
 * Fallback mode using display:none
 */
function generateCSS(hiddenSections) {
  const sectionsList = hiddenSections || [];

  const rules = sectionsList.map(sectionId =>
    `#shopify-section-${sectionId} { display: none !important; }`
  ).join('\n');

  return `/**
 * Section Scheduler - Section Visibility
 * Generated: ${new Date().toISOString()}
 * Hidden sections: ${sectionsList.join(', ')}
 */

${rules}
`;
}

export default router;
