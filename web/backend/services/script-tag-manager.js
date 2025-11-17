/**
 * ScriptTag Manager
 * Automatically injects a script into the merchant's storefront
 * that reads the hidden_sections metafield and hides sections via CSS
 */
export class ScriptTagManager {
  constructor(graphqlClient) {
    this.client = graphqlClient;
  }

  /**
   * Install the visibility controller script tag
   * Called when app is installed
   */
  async install(shop) {
    try {
      // Check if script tag already exists
      const existing = await this.getScriptTags();

      if (existing && existing.length > 0) {
        console.log('[ScriptTag] Already installed');
        return existing[0];
      }

      // The script will be served from our app
      const scriptUrl = `https://${process.env.SHOPIFY_APP_URL}/script-tag.js`;

      const mutation = `
        mutation scriptTagCreate($input: ScriptTagInput!) {
          scriptTagCreate(input: $input) {
            scriptTag {
              id
              src
              displayScope
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const result = await this.client.query(mutation, {
        input: {
          src: scriptUrl,
          displayScope: 'ONLINE_STORE',
          cache: false,
        },
      });

      if (result.data?.scriptTagCreate?.userErrors?.length > 0) {
        throw new Error(result.data.scriptTagCreate.userErrors[0].message);
      }

      console.log('[ScriptTag] Installed successfully:', scriptUrl);
      return result.data.scriptTagCreate.scriptTag;
    } catch (error) {
      console.error('[ScriptTag] Installation error:', error);
      throw error;
    }
  }

  /**
   * Get existing script tags
   */
  async getScriptTags() {
    try {
      const query = `
        query {
          scriptTags(first: 10) {
            nodes {
              id
              src
              displayScope
            }
          }
        }
      `;

      const result = await this.client.query(query);
      return result.data?.scriptTags?.nodes || [];
    } catch (error) {
      console.error('[ScriptTag] Error fetching script tags:', error);
      return [];
    }
  }

  /**
   * Uninstall the script tag
   * Called when app is uninstalled
   */
  async uninstall() {
    try {
      const scriptTags = await this.getScriptTags();

      for (const tag of scriptTags) {
        const mutation = `
          mutation scriptTagDelete($id: ID!) {
            scriptTagDelete(id: $id) {
              deletedScriptTagId
              userErrors {
                field
                message
              }
            }
          }
        `;

        await this.client.query(mutation, { id: tag.id });
        console.log('[ScriptTag] Uninstalled:', tag.src);
      }
    } catch (error) {
      console.error('[ScriptTag] Uninstall error:', error);
      throw error;
    }
  }
}

export default ScriptTagManager;
