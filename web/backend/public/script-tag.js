/**
 * Section Scheduler - Storefront Script
 * This script is injected via ScriptTag API
 * It fetches the list of hidden sections and applies CSS to hide them
 */
(function() {
  'use strict';

  // Get shop domain from Shopify global variable
  const shop = window.Shopify && window.Shopify.shop;

  if (!shop) {
    console.warn('[Section Scheduler] Could not determine shop domain');
    return;
  }

  // Fetch hidden sections from our app
  async function fetchHiddenSections() {
    try {
      // Call our app endpoint to get hidden sections
      // The app will look up the metafield for this shop
      const response = await fetch(`https://${getAppDomain()}/api/hidden-sections?shop=${shop}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[Section Scheduler] Failed to fetch hidden sections:', response.status);
        return [];
      }

      const data = await response.json();
      return data.hiddenSections || [];
    } catch (error) {
      console.warn('[Section Scheduler] Error fetching hidden sections:', error);
      return [];
    }
  }

  // Apply CSS to hide sections
  function hideSections(sectionIds) {
    if (!sectionIds || sectionIds.length === 0) {
      return;
    }

    // Create style element
    const style = document.createElement('style');
    style.id = 'section-scheduler-css';
    style.textContent = sectionIds
      .map(id => `#shopify-section-${id} { display: none !important; }`)
      .join('\n');

    // Insert at the beginning of head to ensure it loads early
    const head = document.head || document.getElementsByTagName('head')[0];
    head.insertBefore(style, head.firstChild);

    console.log('[Section Scheduler] Hiding sections:', sectionIds);
  }

  // Get app domain from script tag src
  function getAppDomain() {
    // Find our script tag
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src && script.src.includes('/script-tag.js')) {
        const url = new URL(script.src);
        return url.hostname;
      }
    }
    // Fallback - look for the script injected by ScriptTag API
    const scriptTag = document.querySelector('script[src*="script-tag.js"]');
    if (scriptTag) {
      const url = new URL(scriptTag.src);
      return url.hostname;
    }
    // Final fallback
    return null;
  }

  // Initialize on DOMContentLoaded (or immediately if already loaded)
  async function init() {
    const hiddenSections = await fetchHiddenSections();
    hideSections(hiddenSections);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
