import moment from 'moment-timezone';

/**
 * Timezone Utilities
 * Helper functions for handling timezone conversions
 */

/**
 * Convert a date to shop timezone
 */
export function toShopTimezone(date, shopTimezone) {
  return moment(date).tz(shopTimezone);
}

/**
 * Get current time in shop timezone
 */
export function getCurrentShopTime(shopTimezone) {
  return moment().tz(shopTimezone);
}

/**
 * Format date for display in shop timezone
 */
export function formatShopDate(date, shopTimezone, format = 'YYYY-MM-DD HH:mm:ss z') {
  return moment(date).tz(shopTimezone).format(format);
}

/**
 * Parse date string with shop timezone
 */
export function parseShopDate(dateString, shopTimezone) {
  return moment.tz(dateString, shopTimezone);
}

/**
 * Check if a date is in the past (shop timezone)
 */
export function isPastDate(date, shopTimezone) {
  const now = moment().tz(shopTimezone);
  const checkDate = moment(date).tz(shopTimezone);
  return checkDate.isBefore(now);
}

/**
 * Check if a date is in the future (shop timezone)
 */
export function isFutureDate(date, shopTimezone) {
  const now = moment().tz(shopTimezone);
  const checkDate = moment(date).tz(shopTimezone);
  return checkDate.isAfter(now);
}

/**
 * Get time until a specific date (in shop timezone)
 */
export function getTimeUntil(date, shopTimezone) {
  const now = moment().tz(shopTimezone);
  const targetDate = moment(date).tz(shopTimezone);
  const duration = moment.duration(targetDate.diff(now));

  return {
    days: Math.floor(duration.asDays()),
    hours: duration.hours(),
    minutes: duration.minutes(),
    seconds: duration.seconds(),
    totalMinutes: Math.floor(duration.asMinutes()),
    humanReadable: duration.humanize(),
  };
}

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone) {
  return moment.tz.names().includes(timezone);
}

/**
 * Get all available timezones
 */
export function getAllTimezones() {
  return moment.tz.names();
}

export default {
  toShopTimezone,
  getCurrentShopTime,
  formatShopDate,
  parseShopDate,
  isPastDate,
  isFutureDate,
  getTimeUntil,
  isValidTimezone,
  getAllTimezones,
};
