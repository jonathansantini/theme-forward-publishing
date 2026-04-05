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
      // Use metafield approach for both sections and blocks
      // Direct theme file modification requires special API permissions

      if (blockIds && blockIds.length > 0) {
        // Handle block visibility via metafield
        const hiddenBlocks = await this.getHiddenBlocks();
        let updatedBlocks;

        if (action === 'hide') {
          updatedBlocks = await this.hideBlockViaMetafield(sectionId, blockIds, hiddenBlocks);
        } else if (action === 'show') {
          updatedBlocks = await this.showBlockViaMetafield(sectionId, blockIds, hiddenBlocks);
        } else {
          throw new Error(`Invalid action: ${action}`);
        }

        await this.updateHiddenBlocksMetafield(updatedBlocks);
        await this.logModification(themeId, templateName, sectionId, action, true, blockIds);

        console.log(`[ThemeModifier] Successfully ${action} blocks in section ${sectionId}`);
        return { success: true, hiddenBlocks: updatedBlocks };
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
   * Modify block visibility by directly editing the theme template JSON.
   * This is the most reliable approach - blocks are removed from the template
   * entirely so theme JS (e.g. slideshows) initialises with the correct count.
   */
  async modifyBlockVisibility(themeId, templateName, sectionId, blockIds, action) {
    console.log(`[ThemeModifier] ${action} blocks in section ${sectionId}:`, blockIds);

    if (action === 'hide') {
      return await this.hideBlocksInTheme(themeId, templateName, sectionId, blockIds);
    } else if (action === 'show') {
      return await this.showBlocksInTheme(themeId, templateName, sectionId, blockIds);
    } else {
      throw new Error(`Invalid action: ${action}`);
    }
  }

  /**
   * Remove blocks from the theme template JSON and store their full data
   * in the hidden_blocks metafield so they can be restored later.
   */
  async hideBlocksInTheme(themeId, templateName, sectionId, blockIds) {
    console.log(`[ThemeModifier] ⚠️ Removing blocks from theme file: ${blockIds.join(', ')}`);

    // 1. Read current template JSON
    const fullPath = `templates/${templateName}`;
    const templateFile = await this.client.getThemeFile(themeId, fullPath);
    if (!templateFile) throw new Error(`Template not found: ${fullPath}`);

    const templateData = JSON.parse(this.stripJsonComments(templateFile.body.content));
    const section = templateData.sections?.[sectionId];
    if (!section) throw new Error(`Section ${sectionId} not found in ${templateName}`);

    // 2. Capture full block data before removing
    const hiddenBlocks = await this.getHiddenBlocks();
    const alreadyHidden = hiddenBlocks[sectionId] || [];
    const newEntries = [];

    for (const blockId of blockIds) {
      // Skip if already removed from theme
      if (alreadyHidden.some(b => (typeof b === 'string' ? b : b.blockId) === blockId)) {
        console.log(`[ThemeModifier] Block ${blockId} already hidden, skipping`);
        continue;
      }

      const blockData = section.blocks?.[blockId];
      if (!blockData) {
        console.warn(`[ThemeModifier] Block ${blockId} not found in section, skipping`);
        continue;
      }

      const position = (section.block_order || []).indexOf(blockId);
      newEntries.push({
        blockId,
        position,
        type: blockData.type,
        settings: blockData.settings || {},
      });

      // Remove from template
      section.block_order = (section.block_order || []).filter(id => id !== blockId);
      delete section.blocks[blockId];
    }

    if (newEntries.length === 0) {
      return { success: true, message: 'No new blocks to hide', hiddenBlocks };
    }

    // 3. Write updated template back to theme
    await this.client.updateThemeFiles(themeId, [{
      filename: fullPath,
      body: { value: JSON.stringify(templateData, null, 2) },
    }]);
    console.log(`[ThemeModifier] Template updated, removed ${newEntries.length} block(s)`);

    // 4. Save block data to metafield for later restoration
    hiddenBlocks[sectionId] = [...alreadyHidden, ...newEntries];
    await this.updateHiddenBlocksMetafield(hiddenBlocks);

    return {
      success: true,
      message: `Blocks hidden successfully`,
      hiddenBlocks,
    };
  }

  /**
   * Restore blocks to the theme template JSON using data saved in the
   * hidden_blocks metafield, then remove them from the metafield.
   */
  async showBlocksInTheme(themeId, templateName, sectionId, blockIds) {
    console.log(`[ThemeModifier] Restoring blocks to theme file: ${blockIds.join(', ')}`);

    const hiddenBlocks = await this.getHiddenBlocks();
    const sectionHidden = hiddenBlocks[sectionId] || [];

    // Find the saved entries for the blocks we want to restore
    const toRestore = sectionHidden.filter(b => {
      const id = typeof b === 'string' ? b : b.blockId;
      return blockIds.includes(id);
    });

    if (toRestore.length === 0) {
      console.log(`[ThemeModifier] No hidden block data found for ${blockIds.join(', ')}`);
      return { success: true, message: 'No blocks to restore', hiddenBlocks };
    }

    // 1. Read current template JSON
    const fullPath = `templates/${templateName}`;
    const templateFile = await this.client.getThemeFile(themeId, fullPath);
    if (!templateFile) throw new Error(`Template not found: ${fullPath}`);

    const templateData = JSON.parse(this.stripJsonComments(templateFile.body.content));
    const section = templateData.sections?.[sectionId];
    if (!section) throw new Error(`Section ${sectionId} not found in ${templateName}`);

    if (!section.blocks) section.blocks = {};
    if (!section.block_order) section.block_order = [];

    // 2. Re-insert each block at its original position (sort by position ascending)
    const sorted = [...toRestore].sort((a, b) => {
      const posA = typeof a === 'object' ? a.position : 0;
      const posB = typeof b === 'object' ? b.position : 0;
      return posA - posB;
    });

    for (const entry of sorted) {
      if (typeof entry === 'string') {
        console.warn(`[ThemeModifier] Legacy string entry ${entry} - cannot restore without block data`);
        continue;
      }

      const { blockId, position, type, settings } = entry;

      // Re-add block data
      section.blocks[blockId] = { type, settings };

      // Re-insert at original position (clamped to current length)
      const insertAt = Math.min(position, section.block_order.length);
      section.block_order.splice(insertAt, 0, blockId);
      console.log(`[ThemeModifier] Restored block ${blockId} at position ${insertAt}`);
    }

    // 3. Write updated template back to theme
    await this.client.updateThemeFiles(themeId, [{
      filename: fullPath,
      body: { value: JSON.stringify(templateData, null, 2) },
    }]);
    console.log(`[ThemeModifier] Template updated, restored ${toRestore.length} block(s)`);

    // 4. Remove restored blocks from metafield
    const remaining = sectionHidden.filter(b => {
      const id = typeof b === 'string' ? b : b.blockId;
      return !blockIds.includes(id);
    });

    if (remaining.length === 0) {
      delete hiddenBlocks[sectionId];
    } else {
      hiddenBlocks[sectionId] = remaining;
    }
    await this.updateHiddenBlocksMetafield(hiddenBlocks);

    return {
      success: true,
      message: 'Blocks restored successfully',
      hiddenBlocks,
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
   * Hide blocks via metafield (CSS/JS approach)
   */
  async hideBlockViaMetafield(sectionId, blockIds, currentHiddenBlocks) {
    const updated = { ...currentHiddenBlocks };

    if (!updated[sectionId]) {
      updated[sectionId] = [];
    }

    for (const blockId of blockIds) {
      if (!updated[sectionId].includes(blockId)) {
        updated[sectionId].push(blockId);
        console.log(`[ThemeModifier] Added block ${blockId} to hidden blocks in section ${sectionId}`);
      } else {
        console.log(`[ThemeModifier] Block ${blockId} already hidden in section ${sectionId}`);
      }
    }

    return updated;
  }

  /**
   * Show blocks by removing them from the hidden blocks metafield
   */
  async showBlockViaMetafield(sectionId, blockIds, currentHiddenBlocks) {
    const updated = { ...currentHiddenBlocks };

    if (!updated[sectionId]) {
      console.log(`[ThemeModifier] No hidden blocks found for section ${sectionId}`);
      return updated;
    }

    updated[sectionId] = updated[sectionId].filter(id => !blockIds.includes(id));

    if (updated[sectionId].length === 0) {
      delete updated[sectionId];
    }

    console.log(`[ThemeModifier] Removed blocks ${blockIds.join(', ')} from section ${sectionId}`);
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
