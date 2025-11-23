/**
 * Theme Modifier Service (App Extension Version)
 * Manages section visibility via shop metafields instead of direct theme file modification.
 * The theme app extension reads these metafields and applies CSS to hide sections.
 */
export class ThemeModifier {
  constructor(graphqlClient, metafieldStorage) {
    this.client = graphqlClient;
    this.storage = metafieldStorage;
  }

  /**
   * Main function to modify section visibility
   * Now updates metafields instead of modifying theme files
   */
  async modifyTemplateVisibility(themeId, templateName, sectionId, action, blockIds = []) {
    console.log(
      `[ThemeModifier] ${action} section ${sectionId}${blockIds.length > 0 ? ` blocks: ${blockIds.join(', ')}` : ''} in ${templateName}`
    );

    try {
      // If blockIds provided, modify block visibility instead of section
      if (blockIds && blockIds.length > 0) {
        return await this.modifyBlockVisibility(themeId, templateName, sectionId, blockIds, action);
      }

      // Otherwise, modify section visibility as before
      const hiddenSections = await this.getHiddenSections();

      let updatedSections;
      if (action === 'hide') {
        updatedSections = await this.hideSection(sectionId, hiddenSections);
      } else if (action === 'show') {
        updatedSections = await this.showSection(sectionId, hiddenSections);
      } else {
        throw new Error(`Invalid action: ${action}`);
      }

      await this.updateHiddenSectionsMetafield(updatedSections);
      await this.logModification(themeId, templateName, sectionId, action, true);

      console.log(`[ThemeModifier] Successfully ${action} section ${sectionId}`);
      console.log(`[ThemeModifier] Currently hidden sections:`, updatedSections);

      return {
        success: true,
        message: `Section ${sectionId} ${action === 'hide' ? 'hidden' : 'shown'} successfully`,
        hiddenSections: updatedSections,
      };
    } catch (error) {
      console.error('[ThemeModifier] Error:', error);

      await this.logModification(
        themeId,
        templateName,
        sectionId,
        action,
        false,
        error.message
      );

      throw error;
    }
  }

  /**
   * Modify block visibility within a section
   * Fetches section JSON to map block IDs to positions for reliable DOM targeting
   */
  async modifyBlockVisibility(themeId, templateName, sectionId, blockIds, action) {
    console.log(`[ThemeModifier] ${action} blocks in section ${sectionId}:`, blockIds);

    const hiddenBlocks = await this.getHiddenBlocks();
    let updatedBlocks = { ...hiddenBlocks };

    if (action === 'hide') {
      // Fetch section JSON to get block positions
      const sectionData = await this.getTemplateSections(themeId, templateName);
      const section = sectionData?.sections?.[sectionId];

      if (!section || !section.block_order) {
        console.error(`[ThemeModifier] Could not fetch section data for ${sectionId}`);
        // Fallback: store blocks without positions
        const currentBlocks = updatedBlocks[sectionId] || [];
        const newBlocks = [...new Set([...currentBlocks, ...blockIds])];
        updatedBlocks[sectionId] = newBlocks;
      } else {
        // Map each block ID to its position in block_order
        const blockOrder = section.block_order;
        const blocksWithPositions = blockIds.map(blockId => {
          const position = blockOrder.indexOf(blockId);
          return {
            blockId: blockId,
            position: position >= 0 ? position : -1
          };
        });

        // Merge with existing hidden blocks
        const currentBlocks = updatedBlocks[sectionId] || [];
        const existingBlockIds = currentBlocks.map(b => typeof b === 'string' ? b : b.blockId);

        // Filter out blocks we're adding from existing list
        const filteredCurrent = currentBlocks.filter(b => {
          const id = typeof b === 'string' ? b : b.blockId;
          return !blockIds.includes(id);
        });

        // Add new blocks with positions
        updatedBlocks[sectionId] = [...filteredCurrent, ...blocksWithPositions];
      }

      console.log(`[ThemeModifier] ⚠️ HIDING BLOCKS in ${sectionId}:`, updatedBlocks[sectionId]);
    } else if (action === 'show') {
      // Remove blocks from hidden list
      if (updatedBlocks[sectionId]) {
        updatedBlocks[sectionId] = updatedBlocks[sectionId].filter(b => {
          const id = typeof b === 'string' ? b : b.blockId;
          return !blockIds.includes(id);
        });

        // Remove section key if no blocks are hidden
        if (updatedBlocks[sectionId].length === 0) {
          delete updatedBlocks[sectionId];
        }
      }
      console.log(`[ThemeModifier] Showing blocks in ${sectionId}:`, blockIds);
    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    await this.updateHiddenBlocksMetafield(updatedBlocks);

    return {
      success: true,
      message: `Blocks ${action === 'hide' ? 'hidden' : 'shown'} successfully`,
      hiddenBlocks: updatedBlocks,
    };
  }

  /**
   * Get hidden blocks from shop metafield
   * Returns object like: { "section_id": [{"blockId": "block_1", "position": 0}, ...] }
   * Legacy format with just strings is also supported for backward compatibility
   */
  async getHiddenBlocks() {
    try {
      const shopInfo = await this.client.getShopInfo();

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

      const response = await this.client.query(query, {
        ownerId: shopInfo.id,
      });

      const metafieldValue = response?.data?.node?.metafield?.value;

      if (!metafieldValue) {
        console.log('[ThemeModifier] No hidden blocks metafield found, returning empty object');
        return {};
      }

      const parsed = JSON.parse(metafieldValue);
      console.log('[ThemeModifier] Current hidden blocks:', parsed);
      return parsed;
    } catch (error) {
      console.error('[ThemeModifier] Error getting hidden blocks:', error);
      return {};
    }
  }

  /**
   * Update the shop metafield with hidden blocks
   */
  async updateHiddenBlocksMetafield(hiddenBlocks) {
    try {
      const shopInfo = await this.client.getShopInfo();

      const metafields = [
        {
          ownerId: shopInfo.id,
          namespace: 'app_scheduler',
          key: 'hidden_blocks',
          type: 'json',
          value: JSON.stringify(hiddenBlocks),
        },
      ];

      console.log('[ThemeModifier] Updating hidden_blocks metafield:', hiddenBlocks);

      const result = await this.client.setShopMetafields(metafields);
      console.log('[ThemeModifier] Metafield update result:', result);

      return result;
    } catch (error) {
      console.error('[ThemeModifier] Error updating hidden_blocks metafield:', error);
      throw error;
    }
  }

  /**
   * Get current list of hidden sections from shop metafield
   */
  async getHiddenSections() {
    try {
      const shopInfo = await this.client.getShopInfo();

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

      const response = await this.client.query(query, {
        ownerId: shopInfo.id,
      });

      const metafieldValue = response?.data?.node?.metafield?.value;

      if (!metafieldValue) {
        console.log('[ThemeModifier] No hidden sections metafield found, returning empty array');
        return [];
      }

      const parsed = JSON.parse(metafieldValue);
      console.log('[ThemeModifier] Current hidden sections:', parsed);
      return parsed;
    } catch (error) {
      console.error('[ThemeModifier] Error getting hidden sections:', error);
      return [];
    }
  }

  /**
   * Hide a section by adding it to the hidden sections list
   */
  async hideSection(sectionId, currentHiddenSections) {
    // Don't add if already hidden
    if (currentHiddenSections.includes(sectionId)) {
      console.log(`[ThemeModifier] Section ${sectionId} is already hidden`);
      return currentHiddenSections;
    }

    const updated = [...currentHiddenSections, sectionId];
    console.log(`[ThemeModifier] ⚠️ HIDING SECTION: ${sectionId}`);
    console.log(`[ThemeModifier] Call stack:`, new Error().stack);
    return updated;
  }

  /**
   * Show a section by removing it from the hidden sections list
   */
  async showSection(sectionId, currentHiddenSections) {
    // Filter out the section ID
    const updated = currentHiddenSections.filter(id => id !== sectionId);

    if (updated.length === currentHiddenSections.length) {
      console.log(`[ThemeModifier] Section ${sectionId} was not hidden`);
    } else {
      console.log(`[ThemeModifier] Removing ${sectionId} from hidden sections`);
    }

    return updated;
  }

  /**
   * Update the shop metafield with the list of hidden sections
   * The theme app extension reads this to apply CSS
   */
  async updateHiddenSectionsMetafield(hiddenSections) {
    try {
      const shopInfo = await this.client.getShopInfo();

      const metafields = [
        {
          ownerId: shopInfo.id,
          namespace: 'app_scheduler',
          key: 'hidden_sections',
          type: 'json',
          value: JSON.stringify(hiddenSections),
        },
      ];

      console.log('[ThemeModifier] Updating hidden_sections metafield:', hiddenSections);

      const result = await this.client.setShopMetafields(metafields);
      console.log('[ThemeModifier] Metafield update result:', result);

      return result;
    } catch (error) {
      console.error('[ThemeModifier] Error updating metafield:', error);
      throw error;
    }
  }

  /**
   * Log modification to metafield (for audit trail)
   */
  async logModification(themeId, templateName, sectionId, action, success, error = null) {
    return await this.storage.logExecution({
      themeId,
      templateName,
      sectionId,
      action,
      success,
      error,
    });
  }

  /**
   * Get all sections from a template (still useful for UI)
   */
  async getTemplateSections(themeId, templateName) {
    try {
      const fullPath = `templates/${templateName}`;
      console.log('[getTemplateSections] Fetching file:', fullPath);

      const templateFile = await this.client.getThemeFile(themeId, fullPath);

      if (!templateFile) {
        console.error('[getTemplateSections] File not found:', fullPath);
        return null;
      }

      console.log('[getTemplateSections] File found:', templateFile.filename);

      // Strip comments before parsing
      const cleanedContent = this.stripJsonComments(templateFile.body.content);
      const templateData = JSON.parse(cleanedContent);

      return {
        sections: templateData.sections || {},
        order: templateData.order || [],
      };
    } catch (error) {
      console.error('Error getting template sections:', error);
      throw error;
    }
  }

  /**
   * List all JSON templates in a theme
   */
  async listTemplates(themeId) {
    try {
      console.log('[listTemplates] Fetching theme file names for:', themeId);
      const theme = await this.client.getThemeFileNames(themeId);

      console.log('[listTemplates] Theme data:', {
        id: theme?.id,
        name: theme?.name,
        filesCount: theme?.files?.nodes?.length || 0
      });

      if (!theme || !theme.files || !theme.files.nodes) {
        console.error('[listTemplates] Invalid theme data structure:', theme);
        return [];
      }

      const jsonTemplates = theme.files.nodes
        .filter(
          (file) =>
            file.filename.startsWith('templates/') &&
            file.filename.endsWith('.json')
        )
        .map((file) => ({
          filename: file.filename.replace('templates/', ''),
          fullPath: file.filename,
        }));

      console.log('[listTemplates] Filtered JSON templates:', jsonTemplates.length);
      return jsonTemplates;
    } catch (error) {
      console.error('Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Validate that a section exists in a template
   */
  async validateSection(themeId, templateName, sectionId) {
    const sections = await this.getTemplateSections(themeId, templateName);

    if (!sections) {
      return { valid: false, error: 'Template not found' };
    }

    if (!sections.sections[sectionId]) {
      return { valid: false, error: 'Section not found in template' };
    }

    return { valid: true };
  }

  /**
   * Strip C-style comments from JSON string
   * Shopify theme files may contain comments which are not valid JSON
   */
  stripJsonComments(jsonString) {
    // Remove /* ... */ style comments
    let result = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove // style comments (but be careful not to remove URLs)
    result = result.replace(/^\s*\/\/.*$/gm, '');
    return result.trim();
  }
}

export default ThemeModifier;
