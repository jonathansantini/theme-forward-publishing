import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import dotenv from 'dotenv';

dotenv.config();

// Get the API version to use (default to the latest stable version)
const API_VERSION = process.env.SHOPIFY_API_VERSION || ApiVersion.October24;

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(',') || [],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https', // Always use https for ngrok tunnels
  apiVersion: API_VERSION,
  isEmbeddedApp: true,
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

/**
 * GraphQL API Client
 * Handles all GraphQL queries and mutations to Shopify
 */
export class ShopifyGraphQLClient {
  constructor(session) {
    this.session = session;
    this.client = new shopify.clients.Graphql({ session });
    this.restClient = new shopify.clients.Rest({ session });
  }

  /**
   * Execute a GraphQL query with rate limit handling
   */
  async query(queryString, variables = {}) {
    try {
      // Updated for Shopify API v12+ - no longer wraps in 'data' object
      const response = await this.client.request(queryString, {
        variables,
      });

      // Check for rate limiting using extensions.cost (v12+ API)
      if (response.extensions?.cost) {
        const { requestedQueryCost, actualQueryCost, throttleStatus } = response.extensions.cost;

        console.log(`API Cost: ${actualQueryCost} (max per call: ${throttleStatus?.maximumAvailable || 'N/A'})`);

        // If approaching rate limit, add delay
        if (throttleStatus && throttleStatus.currentlyAvailable < throttleStatus.maximumAvailable * 0.2) {
          console.warn('Approaching rate limit, implementing delay...');
          await this.sleep(1000);
        }
      }

      // In API v12+, response is { data, extensions } - no .body wrapper
      return response.data;
    } catch (error) {
      console.error('GraphQL query error:', error);

      // Handle rate limiting errors
      if (error.message?.includes('Throttled') || error.response?.status === 429) {
        console.log('Rate limited, retrying after delay...');
        await this.sleep(2000);
        return this.query(queryString, variables);
      }

      throw error;
    }
  }

  /**
   * Get theme files from a specific theme
   */
  async getThemeFiles(themeId) {
    const query = `
      query getThemeFiles($themeId: ID!) {
        theme(id: $themeId) {
          id
          name
          role
          files(first: 250) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.query(query, { themeId });
    return response.theme;
  }

  /**
   * Get theme file names only (optimized for listing)
   */
  async getThemeFileNames(themeId) {
    const query = `
      query getThemeFileNames($themeId: ID!) {
        theme(id: $themeId) {
          id
          name
          role
          files(first: 500) {
            nodes {
              filename
            }
          }
        }
      }
    `;

    const response = await this.query(query, { themeId });
    return response.theme;
  }

  /**
   * Get a specific theme file content
   */
  async getThemeFile(themeId, filename) {
    // Note: Shopify's GraphQL API doesn't support filtering by filename
    // We need to fetch files and filter client-side
    const query = `
      query getThemeFile($themeId: ID!) {
        theme(id: $themeId) {
          files(first: 500) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.query(query, { themeId });
    const files = response.theme.files.nodes;
    const matchingFile = files.find(f => f.filename === filename);
    return matchingFile || null;
  }

  /**
   * Update theme files using REST API
   * (GraphQL themeFilesUpsert requires special Shopify exemption)
   */
  async updateThemeFiles(themeId, files) {
    // Extract numeric ID from GID format: gid://shopify/OnlineStoreTheme/123456
    const numericThemeId = themeId.split('/').pop();

    console.log('[updateThemeFiles] Theme GID:', themeId);
    console.log('[updateThemeFiles] Numeric theme ID:', numericThemeId);
    console.log('[updateThemeFiles] Files to upload:', files.length);

    const results = [];

    for (const file of files) {
      try {
        console.log('[updateThemeFiles] Uploading:', file.filename);
        console.log('[updateThemeFiles] Asset key:', file.filename);
        console.log('[updateThemeFiles] Content length:', file.body.value?.length || 0);

        // Use configured API version (falls back to the version set in shopify config)
        const apiVersion = process.env.SHOPIFY_API_VERSION || API_VERSION;

        // First, verify we can GET the asset to ensure it exists
        const getUrl = `https://${this.session.shop}/admin/api/${apiVersion}/themes/${numericThemeId}/assets.json?asset[key]=${encodeURIComponent(file.filename)}`;
        console.log('[updateThemeFiles] Testing GET first:', getUrl);
        console.log('[updateThemeFiles] API Version:', apiVersion);

        const getResponse = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.session.accessToken,
          },
        });

        console.log('[updateThemeFiles] GET Response status:', getResponse.status, getResponse.statusText);

        if (!getResponse.ok) {
          const getErrorText = await getResponse.text();
          console.error('[updateThemeFiles] GET failed:', getErrorText);
          throw new Error(`Cannot access asset (GET failed with ${getResponse.status}): ${getErrorText}`);
        }

        const getAsset = await getResponse.json();
        console.log('[updateThemeFiles] Asset exists, current size:', getAsset?.asset?.value?.length || 0);
        console.log('[updateThemeFiles] Asset key from GET:', getAsset?.asset?.key);
        console.log('[updateThemeFiles] Requested filename:', file.filename);
        console.log('[updateThemeFiles] Keys match:', getAsset?.asset?.key === file.filename);

        // Now try to PUT the updated asset using the configured API version
        const putUrl = `https://${this.session.shop}/admin/api/${process.env.SHOPIFY_API_VERSION || API_VERSION}/themes/${numericThemeId}/assets.json`;
        const putBody = {
          asset: {
            key: file.filename,
            value: file.body.value,
          },
        };

        console.log('[updateThemeFiles] PUT URL:', putUrl);
        console.log('[updateThemeFiles] PUT body keys:', Object.keys(putBody.asset));
        console.log('[updateThemeFiles] PUT asset.key:', putBody.asset.key);
        console.log('[updateThemeFiles] PUT asset.value length:', putBody.asset.value?.length);

        const response = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.session.accessToken,
          },
          body: JSON.stringify(putBody),
        });

        console.log('[updateThemeFiles] PUT Response status:', response.status, response.statusText);
        console.log('[updateThemeFiles] PUT Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[updateThemeFiles] PUT Error response body:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[updateThemeFiles] Upload success:', file.filename);

        results.push({
          filename: file.filename,
          success: true,
        });
      } catch (error) {
        console.error(`[updateThemeFiles] Failed to upload ${file.filename}:`, error.message);
        throw new Error(`Theme file update failed for ${file.filename}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get published theme
   */
  async getPublishedTheme() {
    const query = `
      query getPublishedTheme {
        themes(first: 10) {
          nodes {
            id
            name
            role
          }
        }
      }
    `;

    const response = await this.query(query);
    console.log('[DEBUG] Themes query response:', JSON.stringify(response, null, 2));

    const themes = response.themes.nodes;
    console.log(`[DEBUG] Found ${themes.length} theme(s):`, themes.map(t => ({ name: t.name, role: t.role })));

    // Find the main/published theme
    const publishedTheme = themes.find(
      (theme) => theme.role === 'MAIN' || theme.role === 'main'
    );

    if (!publishedTheme && themes.length > 0) {
      // If no MAIN theme found, return the first one (likely the published theme)
      console.log('[DEBUG] No MAIN theme found, using first theme');
      return themes[0];
    }

    return publishedTheme;
  }

  /**
   * Get shop metafields
   */
  async getShopMetafield(namespace, key) {
    const query = `
      query getShopMetafield($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            value
            type
          }
        }
      }
    `;

    const response = await this.query(query, { namespace, key });
    return response.shop.metafield;
  }

  /**
   * Set shop metafields
   */
  async setShopMetafields(metafields) {
    const mutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query(mutation, { metafields });

    if (response.metafieldsSet.userErrors.length > 0) {
      throw new Error(
        `Metafield update errors: ${JSON.stringify(response.metafieldsSet.userErrors)}`
      );
    }

    return response.metafieldsSet.metafields;
  }

  /**
   * Get shop information including timezone
   */
  async getShopInfo() {
    const query = `
      query getShopInfo {
        shop {
          id
          name
          email
          ianaTimezone
          currencyCode
        }
      }
    `;

    const response = await this.query(query);
    // query() now returns response.data directly (not response.body.data)
    return response.shop;
  }

  /**
   * Utility: Sleep function for rate limiting
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ShopifyGraphQLClient;
