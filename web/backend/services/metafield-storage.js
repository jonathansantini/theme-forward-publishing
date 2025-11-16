import { v4 as uuidv4 } from 'uuid';

/**
 * Metafield Storage Service
 * Handles CRUD operations for schedules, backups, and original sections using Shopify metafields
 */
export class MetafieldStorage {
  constructor(graphqlClient) {
    this.client = graphqlClient;
    this.namespace = 'app_scheduler';
  }

  /**
   * Get all schedules
   */
  async getSchedules() {
    try {
      const metafield = await this.client.getShopMetafield(this.namespace, 'schedules');

      if (!metafield || !metafield.value) {
        return [];
      }

      const data = JSON.parse(metafield.value);
      return data.schedules || [];
    } catch (error) {
      console.error('Error getting schedules:', error);
      return [];
    }
  }

  /**
   * Get a single schedule by ID
   */
  async getSchedule(scheduleId) {
    const schedules = await this.getSchedules();
    return schedules.find((s) => s.id === scheduleId);
  }

  /**
   * Create a new schedule
   */
  async createSchedule(scheduleData) {
    const schedules = await this.getSchedules();

    const newSchedule = {
      id: uuidv4(),
      ...scheduleData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastRun: null,
      finalized: false,
    };

    schedules.push(newSchedule);
    await this.saveSchedules(schedules);

    return newSchedule;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId, updates) {
    const schedules = await this.getSchedules();
    const index = schedules.findIndex((s) => s.id === scheduleId);

    if (index === -1) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Prevent editing finalized schedules
    if (schedules[index].finalized && !updates.hasOwnProperty('finalized')) {
      throw new Error('Cannot edit finalized schedule. Unpublish first.');
    }

    schedules[index] = {
      ...schedules[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveSchedules(schedules);
    return schedules[index];
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId) {
    const schedules = await this.getSchedules();
    const filtered = schedules.filter((s) => s.id !== scheduleId);

    if (filtered.length === schedules.length) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    await this.saveSchedules(filtered);
    return true;
  }

  /**
   * Get pending schedules that need to be executed
   */
  async getPendingSchedules() {
    const schedules = await this.getSchedules();
    return schedules.filter((s) => s.status === 'pending' || s.status === 'active');
  }

  /**
   * Save schedules to metafield
   */
  async saveSchedules(schedules) {
    // Get the actual shop GID
    const shopInfo = await this.client.getShopInfo();

    const metafields = [
      {
        ownerId: shopInfo.id, // Use the actual shop GID
        namespace: this.namespace,
        key: 'schedules',
        type: 'json',
        value: JSON.stringify({ schedules }),
      },
    ];

    return await this.client.setShopMetafields(metafields);
  }

  /**
   * Get all backups
   */
  async getBackups() {
    try {
      const metafield = await this.client.getShopMetafield(this.namespace, 'backups');

      if (!metafield || !metafield.value) {
        return [];
      }

      const data = JSON.parse(metafield.value);
      return data.backups || [];
    } catch (error) {
      console.error('Error getting backups:', error);
      return [];
    }
  }

  /**
   * Create a backup
   */
  async createBackup(backupData) {
    const backups = await this.getBackups();

    const newBackup = {
      id: uuidv4(),
      ...backupData,
      timestamp: new Date().toISOString(),
    };

    backups.push(newBackup);

    // Keep only the last 10 backups per template to avoid metafield size issues
    const templateBackups = backups.filter(
      (b) =>
        b.themeId === backupData.themeId && b.templateName === backupData.templateName
    );

    if (templateBackups.length > 10) {
      // Remove oldest backups
      const sortedBackups = templateBackups.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      const toRemove = sortedBackups.slice(0, sortedBackups.length - 10);
      toRemove.forEach((backup) => {
        const idx = backups.findIndex((b) => b.id === backup.id);
        if (idx !== -1) backups.splice(idx, 1);
      });
    }

    await this.saveBackups(backups);
    return newBackup;
  }

  /**
   * Get backup by ID
   */
  async getBackup(backupId) {
    const backups = await this.getBackups();
    return backups.find((b) => b.id === backupId);
  }

  /**
   * Save backups to metafield
   */
  async saveBackups(backups) {
    // Get the actual shop GID
    const shopInfo = await this.client.getShopInfo();

    const metafields = [
      {
        ownerId: shopInfo.id, // Use the actual shop GID
        namespace: this.namespace,
        key: 'backups',
        type: 'json',
        value: JSON.stringify({ backups }),
      },
    ];

    return await this.client.setShopMetafields(metafields);
  }

  /**
   * Get original sections storage
   */
  async getOriginalSections() {
    try {
      const metafield = await this.client.getShopMetafield(
        this.namespace,
        'original_sections'
      );

      if (!metafield || !metafield.value) {
        return {};
      }

      const data = JSON.parse(metafield.value);
      return data.sections || {};
    } catch (error) {
      console.error('Error getting original sections:', error);
      return {};
    }
  }

  /**
   * Store original section data for restore
   */
  async storeOriginalSection(sectionId, sectionData) {
    const originalSections = await this.getOriginalSections();
    originalSections[sectionId] = sectionData;

    // Get the actual shop GID
    const shopInfo = await this.client.getShopInfo();

    const metafields = [
      {
        ownerId: shopInfo.id, // Use the actual shop GID
        namespace: this.namespace,
        key: 'original_sections',
        type: 'json',
        value: JSON.stringify({ sections: originalSections }),
      },
    ];

    return await this.client.setShopMetafields(metafields);
  }

  /**
   * Get original section data
   */
  async getOriginalSection(sectionId) {
    const originalSections = await this.getOriginalSections();
    return originalSections[sectionId] || null;
  }

  /**
   * Remove original section after restore
   */
  async removeOriginalSection(sectionId) {
    const originalSections = await this.getOriginalSections();
    delete originalSections[sectionId];

    const metafields = [
      {
        ownerId: 'gid://shopify/Shop/1',
        namespace: this.namespace,
        key: 'original_sections',
        type: 'json',
        value: JSON.stringify({ sections: originalSections }),
      },
    ];

    return await this.client.setShopMetafields(metafields);
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs() {
    try {
      const metafield = await this.client.getShopMetafield(
        this.namespace,
        'execution_logs'
      );

      if (!metafield || !metafield.value) {
        return [];
      }

      const data = JSON.parse(metafield.value);
      return data.logs || [];
    } catch (error) {
      console.error('Error getting execution logs:', error);
      return [];
    }
  }

  /**
   * Log a schedule execution
   */
  async logExecution(logData) {
    const logs = await this.getExecutionLogs();

    const newLog = {
      id: uuidv4(),
      ...logData,
      timestamp: new Date().toISOString(),
    };

    logs.push(newLog);

    // Keep only last 100 logs to avoid metafield size issues
    if (logs.length > 100) {
      logs.shift();
    }

    const metafields = [
      {
        ownerId: 'gid://shopify/Shop/1',
        namespace: this.namespace,
        key: 'execution_logs',
        type: 'json',
        value: JSON.stringify({ logs }),
      },
    ];

    return await this.client.setShopMetafields(metafields);
  }
}

export default MetafieldStorage;
