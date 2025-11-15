/**
 * Validation Utilities
 * Input validation helpers
 */

/**
 * Validate schedule creation data
 */
export function validateScheduleInput(data) {
  const errors = [];

  // Required fields
  if (!data.themeId) errors.push('themeId is required');
  if (!data.templateName) errors.push('templateName is required');
  if (!data.sectionId) errors.push('sectionId is required');
  if (!data.action) errors.push('action is required');
  if (!data.executeAt) errors.push('executeAt is required');

  // Validate action
  if (data.action && !['show', 'hide'].includes(data.action)) {
    errors.push('action must be "show" or "hide"');
  }

  // Validate template name format
  if (data.templateName && !data.templateName.endsWith('.json')) {
    errors.push('templateName must end with .json');
  }

  // Validate executeAt is a valid date
  if (data.executeAt) {
    const date = new Date(data.executeAt);
    if (isNaN(date.getTime())) {
      errors.push('executeAt must be a valid ISO 8601 date string');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate recurrence data
 */
export function validateRecurrence(recurrence) {
  const errors = [];

  if (!recurrence.type) {
    errors.push('recurrence.type is required');
  } else if (!['daily', 'weekly', 'monthly'].includes(recurrence.type)) {
    errors.push('recurrence.type must be daily, weekly, or monthly');
  }

  if (recurrence.type === 'weekly') {
    if (
      recurrence.dayOfWeek === undefined ||
      recurrence.dayOfWeek < 0 ||
      recurrence.dayOfWeek > 6
    ) {
      errors.push('recurrence.dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  if (recurrence.type === 'monthly') {
    if (
      recurrence.dayOfMonth === undefined ||
      recurrence.dayOfMonth < 1 ||
      recurrence.dayOfMonth > 31
    ) {
      errors.push('recurrence.dayOfMonth must be between 1 and 31');
    }
  }

  if (!recurrence.time || !/^\d{2}:\d{2}$/.test(recurrence.time)) {
    errors.push('recurrence.time must be in HH:mm format (e.g., "14:30")');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize input to prevent injection
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // Remove any potential malicious characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Validate Shopify GID format
 */
export function isValidShopifyGid(gid, expectedType = null) {
  const gidPattern = /^gid:\/\/shopify\/(\w+)\/\d+$/;
  const match = gid.match(gidPattern);

  if (!match) return false;

  if (expectedType && match[1] !== expectedType) {
    return false;
  }

  return true;
}

/**
 * Validate section ID format (alphanumeric, hyphens, underscores)
 */
export function isValidSectionId(sectionId) {
  return /^[a-zA-Z0-9_-]+$/.test(sectionId);
}

/**
 * Validate template name format
 */
export function isValidTemplateName(templateName) {
  return /^[a-zA-Z0-9_-]+\.json$/.test(templateName);
}

export default {
  validateScheduleInput,
  validateRecurrence,
  sanitizeInput,
  isValidShopifyGid,
  isValidSectionId,
  isValidTemplateName,
};
