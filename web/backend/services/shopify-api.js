import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Shopify API
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(',') || [],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  hostScheme: 'https', // Always use https for ngrok tunnels
  apiVersion: process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION,
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
      const response = await this.client.query({
        data: {
          query: queryString,
          variables,
        },
      });

      // Check for rate limiting
      if (response.headers) {
        const rateLimitHeader = typeof response.headers.get === 'function'
          ? response.headers.get('X-Shopify-Shop-Api-Call-Limit')
          : response.headers['X-Shopify-Shop-Api-Call-Limit'];

        if (rateLimitHeader) {
          const [used, total] = rateLimitHeader.split('/');

          console.log(`API Rate Limit: ${used}/${total}`);

          // If we're close to the limit, wait before next request
          if (parseInt(used) / parseInt(total) > 0.8) {
            console.warn('Approaching rate limit, implementing delay...');
            await this.sleep(1000);
          }
        }
      }

      return response.body;
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
    return response.data.theme;
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
    return response.data.theme;
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
    const files = response.data.theme.files.nodes;
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

        // Use direct fetch instead of REST client for better control
        const url = `https://${this.session.shop}/admin/api/2025-01/themes/${numericThemeId}/assets.json`;
        console.log('[updateThemeFiles] Full URL:', url);

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.session.accessToken,
          },
          body: JSON.stringify({
            asset: {
              key: file.filename,
              value: file.body.value,
            },
          }),
        });

        console.log('[updateThemeFiles] Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[updateThemeFiles] Error response body:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[updateThemeFiles] Upload success:', file.filename);
        console.log('[updateThemeFiles] Response data:', data);

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
    console.log('[DEBUG] Themes query response:', JSON.stringify(response.data, null, 2));

    const themes = response.data.themes.nodes;
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
    return response.data.shop.metafield;
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

    if (response.data.metafieldsSet.userErrors.length > 0) {
      throw new Error(
        `Metafield update errors: ${JSON.stringify(response.data.metafieldsSet.userErrors)}`
      );
    }

    return response.data.metafieldsSet.metafields;
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
    return response.data.shop;
  }

  /**
   * Utility: Sleep function for rate limiting
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ShopifyGraphQLClient;
