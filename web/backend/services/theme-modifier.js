/**
 * Theme Modifier Service
 * Handles modification of theme JSON templates to show/hide sections
 */
export class ThemeModifier {
  constructor(graphqlClient, metafieldStorage) {
    this.client = graphqlClient;
    this.storage = metafieldStorage;
  }

  /**
   * Main function to modify section visibility
   */
  async modifyTemplateVisibility(themeId, templateName, sectionId, action) {
    console.log(
      `Modifying template ${templateName}: ${action} section ${sectionId}`
    );

    try {
      // 1. Fetch current template JSON
      const templateFile = await this.client.getThemeFile(
        themeId,
        `templates/${templateName}`
      );

      if (!templateFile) {
        throw new Error(`Template ${templateName} not found`);
      }

      const templateData = JSON.parse(templateFile.body.content);

      // 2. Create backup before modification
      await this.createBackup(themeId, templateName, templateFile.body.content);

      // 3. Modify sections object based on action
      if (action === 'hide') {
        await this.hideSection(templateData, sectionId);
      } else if (action === 'show') {
        await this.showSection(templateData, sectionId);
      } else {
        throw new Error(`Invalid action: ${action}`);
      }

      // 4. Upload modified template
      const updatedContent = JSON.stringify(templateData, null, 2);
      await this.uploadTemplate(themeId, templateName, updatedContent);

      // 5. Log the modification
      await this.logModification(themeId, templateName, sectionId, action, true);

      console.log(`Successfully ${action} section ${sectionId} in ${templateName}`);

      return {
        success: true,
        message: `Section ${sectionId} ${action === 'hide' ? 'hidden' : 'shown'} successfully`,
      };
    } catch (error) {
      console.error('Template modification error:', error);

      // Log the failed modification
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
   * Hide a section from the template
   */
  async hideSection(templateData, sectionId) {
    // Check if section exists
    if (!templateData.sections || !templateData.sections[sectionId]) {
      throw new Error(`Section ${sectionId} not found in template`);
    }

    // Store original section data for restore
    const originalSection = templateData.sections[sectionId];
    await this.storage.storeOriginalSection(sectionId, {
      data: originalSection,
      order: templateData.order ? templateData.order.indexOf(sectionId) : -1,
    });

    // Remove from sections object
    delete templateData.sections[sectionId];

    // Remove from order array if it exists
    if (templateData.order && Array.isArray(templateData.order)) {
      templateData.order = templateData.order.filter((id) => id !== sectionId);
    }

    return templateData;
  }

  /**
   * Show a section in the template
   */
  async showSection(templateData, sectionId) {
    // Retrieve original section data
    const originalSectionData = await this.storage.getOriginalSection(sectionId);

    if (!originalSectionData) {
      throw new Error(
        `Cannot restore section ${sectionId}: original data not found`
      );
    }

    // Restore section to sections object
    if (!templateData.sections) {
      templateData.sections = {};
    }

    templateData.sections[sectionId] = originalSectionData.data;

    // Restore to order array at original position
    if (!templateData.order) {
      templateData.order = [];
    }

    if (
      originalSectionData.order !== -1 &&
      originalSectionData.order < templateData.order.length
    ) {
      // Insert at original position
      templateData.order.splice(originalSectionData.order, 0, sectionId);
    } else {
      // Append to end if original position not valid
      templateData.order.push(sectionId);
    }

    // Remove from original sections storage
    await this.storage.removeOriginalSection(sectionId);

    return templateData;
  }

  /**
   * Create a backup of the template
   */
  async createBackup(themeId, templateName, content, scheduleId = null) {
    return await this.storage.createBackup({
      themeId,
      templateName,
      content,
      scheduleId,
    });
  }

  /**
   * Restore template from backup
   */
  async restoreFromBackup(backupId) {
    const backup = await this.storage.getBackup(backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    await this.uploadTemplate(backup.themeId, backup.templateName, backup.content);

    return {
      success: true,
      message: `Template ${backup.templateName} restored from backup`,
    };
  }

  /**
   * Upload modified template to Shopify
   */
  async uploadTemplate(themeId, templateName, content) {
    const files = [
      {
        filename: `templates/${templateName}`,
        body: {
          type: 'TEXT',
          value: content,
        },
      },
    ];

    return await this.client.updateThemeFiles(themeId, files);
  }

  /**
   * Log modification to metafield
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
   * Get all sections from a template
   */
  async getTemplateSections(themeId, templateName) {
    try {
      const templateFile = await this.client.getThemeFile(
        themeId,
        `templates/${templateName}`
      );

      if (!templateFile) {
        return null;
      }

      const templateData = JSON.parse(templateFile.body.content);

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

      console.log('[listTemplates] First 5 filenames:',
        theme.files.nodes.slice(0, 5).map(f => f.filename)
      );

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
}

export default ThemeModifier;
