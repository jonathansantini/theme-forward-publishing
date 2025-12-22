import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Middleware to validate HMAC signature for Shopify App Proxy requests
 *
 * Shopify App Proxy automatically adds these query parameters:
 * - signature: HMAC-SHA256 signature of the other parameters
 * - shop: The shop domain
 * - path_prefix: /apps/scheduler
 * - timestamp: Unix timestamp
 * - And any other query params from the original request
 *
 * This middleware verifies the signature matches to ensure:
 * 1. The request actually came from Shopify
 * 2. The request hasn't been tampered with
 *
 * Reference: https://shopify.dev/docs/apps/build/online-store/app-proxies
 */
export function validateProxyHmac(req, res, next) {
  const { signature, ...queryParams } = req.query;

  // Skip validation in development if SKIP_PROXY_VALIDATION is set
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_PROXY_VALIDATION === 'true') {
    console.warn('⚠️  WARNING: HMAC validation skipped for development');
    return next();
  }

  // Signature is required
  if (!signature) {
    console.error('[Proxy HMAC] Missing signature parameter');
    return res.status(401).type('text/javascript').send(
      '// Error: Unauthorized - Missing signature'
    );
  }

  // Build the message to hash (query params in alphabetical order)
  const sortedParams = Object.keys(queryParams)
    .sort()
    .map(key => `${key}=${queryParams[key]}`)
    .join('');

  // Calculate HMAC using app secret
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error('[Proxy HMAC] SHOPIFY_API_SECRET not configured');
    return res.status(500).type('text/javascript').send(
      '// Error: Server misconfiguration'
    );
  }

  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(sortedParams)
    .digest('hex');

  // Compare signatures (timing-safe comparison)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedHmac)
  );

  if (!isValid) {
    console.error('[Proxy HMAC] Invalid signature');
    console.error('[Proxy HMAC] Expected:', calculatedHmac);
    console.error('[Proxy HMAC] Received:', signature);
    return res.status(401).type('text/javascript').send(
      '// Error: Unauthorized - Invalid signature'
    );
  }

  // Signature is valid, continue
  console.log('[Proxy HMAC] ✓ Valid signature for shop:', queryParams.shop);
  next();
}

export default validateProxyHmac;
