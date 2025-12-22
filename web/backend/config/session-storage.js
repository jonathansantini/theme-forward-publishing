import { MemorySessionStorage } from '@shopify/shopify-app-session-storage-memory';
import { RedisSessionStorage } from '@shopify/shopify-app-session-storage-redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Configure session storage based on environment
 *
 * Production: Uses Redis for scalable, persistent session storage
 * Development: Can use in-memory storage (sessions lost on restart)
 *
 * Environment Variables:
 * - REDIS_URL: Redis connection string (e.g., redis://localhost:6379)
 * - NODE_ENV: 'production' or 'development'
 */
export function createSessionStorage() {
  const redisUrl = process.env.REDIS_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  // Production MUST use Redis
  if (isProduction && !redisUrl) {
    throw new Error(
      'REDIS_URL is required in production. ' +
      'Sessions cannot be stored in memory in production environments. ' +
      'Please set REDIS_URL in your environment variables.'
    );
  }

  // Use Redis if URL is provided
  if (redisUrl) {
    console.log('✓ Using Redis session storage:', redisUrl.replace(/:[^:]*@/, ':***@'));
    return new RedisSessionStorage(redisUrl);
  }

  // Development fallback to in-memory storage
  console.warn(
    '⚠️  WARNING: Using in-memory session storage. ' +
    'Sessions will be lost on server restart. ' +
    'This is NOT suitable for production. ' +
    'Set REDIS_URL to use persistent storage.'
  );

  return new MemorySessionStorage();
}

export default createSessionStorage;
