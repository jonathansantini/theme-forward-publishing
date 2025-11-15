import { shopify } from '../services/shopify-api.js';

/**
 * Authentication Middleware
 * Verifies Shopify session and provides access to authenticated client
 */

/**
 * Verify the request has a valid Shopify session
 */
export async function verifyAuth(req, res, next) {
  try {
    // Get session from Shopify session storage
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized - No session found' });
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'Unauthorized - Invalid session' });
    }

    // Attach session to request
    req.shopifySession = session;

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Verify request is coming from embedded app
 */
export async function verifyRequest(app) {
  return async (req, res, next) => {
    try {
      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
        return res.redirect(`/auth?shop=${req.query.shop}`);
      }

      const session = await shopify.config.sessionStorage.loadSession(sessionId);

      if (!session || !session.accessToken) {
        return res.redirect(`/auth?shop=${req.query.shop}`);
      }

      req.shopifySession = session;
      next();
    } catch (error) {
      console.error('Verify request error:', error);
      return res.redirect(`/auth?shop=${req.query.shop}`);
    }
  };
}

export default {
  verifyAuth,
  verifyRequest,
};
