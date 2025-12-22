# Shopify App Upgrade Notes

This document outlines the improvements made to bring the app up to Shopify's latest coding standards and best practices.

## Changes Implemented

### 1. ✅ Updated Dependencies

**Updated packages:**
- `@shopify/shopify-api`: 10.0.0 → 12.2.0
- `@shopify/shopify-app-session-storage-memory`: 3.0.5 → 5.0.4
- `@shopify/shopify-app-session-storage-redis`: Added (new)

**Location:** `package.json`

**Breaking Changes:**
- API v12 may have minor breaking changes. Test thoroughly.
- Session storage interface updated to latest version.

---

### 2. ✅ Production-Ready Session Storage

**What Changed:**
- Replaced hard-coded in-memory session storage with configurable storage
- Added Redis support for production environments
- Created smart session storage factory

**New Files:**
- `web/backend/config/session-storage.js` - Session storage configuration

**Environment Variables:**
```bash
# Required in production
REDIS_URL=redis://localhost:6379

# For Redis Cloud:
REDIS_URL=redis://username:password@host:port
```

**How it Works:**
- **Production:** Requires `REDIS_URL` - will throw error if not set
- **Development:** Falls back to in-memory storage with warning
- Automatically selects storage based on `NODE_ENV`

**Location:** `web/backend/server.js:40`

---

### 3. ✅ Fixed Hard-Coded API Version

**What Changed:**
- Removed hard-coded `2022-10` API version
- Now uses `SHOPIFY_API_VERSION` from environment
- Falls back to `LATEST_API_VERSION` if not set

**Location:** `web/backend/services/shopify-api.js:179`

**Before:**
```javascript
const apiVersion = '2022-10'; // ⚠️ Hard-coded
```

**After:**
```javascript
const apiVersion = process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION;
```

---

### 4. ✅ Added HMAC Validation to App Proxy

**What Changed:**
- Added security middleware to validate Shopify App Proxy requests
- Prevents unauthorized access to proxy endpoints
- Uses timing-safe HMAC comparison

**New Files:**
- `web/backend/middleware/validate-proxy-hmac.js` - HMAC validation middleware

**Location:** `web/backend/routes/proxy.js:9`

**How it Works:**
- Validates `signature` query parameter from Shopify
- Compares against calculated HMAC using app secret
- Can be skipped in development with `SKIP_PROXY_VALIDATION=true`

**Environment Variables:**
```bash
# Set to 'true' ONLY in development to skip validation
SKIP_PROXY_VALIDATION=false
```

---

### 5. ✅ Migrated to New Unified App Bridge

**What Changed:**
- Removed old `@shopify/app-bridge-react` package
- Migrated to new unified App Bridge (script-based)
- Simplified authentication and initialization

**Modified Files:**
- `web/frontend/index.html` - Added App Bridge script
- `web/frontend/App.jsx` - Removed AppBridgeProvider wrapper
- `web/frontend/vite.config.js` - Added HTML transform plugin

**Before:**
```javascript
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';

<AppBridgeProvider config={config}>
  {/* app */}
</AppBridgeProvider>
```

**After:**
```html
<!-- index.html -->
<meta name="shopify-api-key" content="%VITE_SHOPIFY_API_KEY%" />
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
```

```javascript
// Use global shopify object
shopify.toast.show('Hello!');
shopify.modal.show();
```

---

### 6. ✅ Added React Error Boundaries

**What Changed:**
- Created ErrorBoundary component to catch React errors
- Prevents app crashes from propagating
- Shows user-friendly error messages

**New Files:**
- `web/frontend/components/ErrorBoundary.jsx` - Error boundary component

**Location:** `web/frontend/App.jsx:36`

**Features:**
- Catches all React component errors
- Shows Polaris Banner with error message
- Displays stack trace in development mode
- Provides "Try again" action to reset error state
- Integrates with App Bridge toast notifications

---

### 7. ✅ Added App Uninstall Webhook

**What Changed:**
- Registered `app/uninstalled` webhook in app config
- Created webhook handler to clean up data
- Added GDPR compliance webhook placeholders

**New Files:**
- `web/backend/routes/webhooks.js` - Webhook handlers

**Modified Files:**
- `shopify.app.toml` - Added webhook subscription
- `web/backend/server.js:60` - Registered webhook routes

**Webhooks Implemented:**
- `app/uninstalled` - Cleans up sessions and active shops
- `customers/data_request` - GDPR data request (TODO)
- `customers/redact` - GDPR customer redaction (TODO)
- `shop/redact` - GDPR shop redaction (TODO)

---

### 8. ✅ Updated Environment Configuration

**What Changed:**
- Updated `.env` with new required variables
- Added Redis configuration
- Updated API version to 2025-10
- Added security settings

**New Environment Variables:**
```bash
# Redis (Required in production)
REDIS_URL=

# API Configuration
SHOPIFY_API_VERSION=2025-10

# Security
SKIP_PROXY_VALIDATION=false
```

**Location:** `.env`

---

## Migration Checklist

### Before Deploying to Production

- [ ] **Set up Redis**
  - [ ] Provision Redis instance (Redis Cloud, AWS ElastiCache, etc.)
  - [ ] Set `REDIS_URL` environment variable
  - [ ] Test session persistence

- [ ] **Update Environment Variables**
  - [ ] Set `NODE_ENV=production`
  - [ ] Set `SHOPIFY_API_VERSION=2025-10`
  - [ ] Ensure `REDIS_URL` is set
  - [ ] Ensure `SKIP_PROXY_VALIDATION=false`

- [ ] **Test Webhooks**
  - [ ] Install/uninstall app to test `app/uninstalled` webhook
  - [ ] Verify session cleanup works
  - [ ] Implement GDPR webhook logic (required for App Store)

- [ ] **Test App Bridge**
  - [ ] Verify app loads in Shopify admin
  - [ ] Test toast notifications
  - [ ] Test error boundaries

- [ ] **Security Review**
  - [ ] Verify HMAC validation works on app proxy
  - [ ] Ensure no API keys in client-side code
  - [ ] Review session storage security

---

## Testing Instructions

### 1. Test Session Storage

**Development (In-Memory):**
```bash
# Don't set REDIS_URL
npm run dev
# Should see warning: "WARNING: Using in-memory session storage"
```

**Production (Redis):**
```bash
# Set REDIS_URL
export REDIS_URL=redis://localhost:6379
npm run dev
# Should see: "Using Redis session storage"
```

### 2. Test App Bridge Migration

1. Open app in Shopify admin
2. Open browser console
3. Type `shopify` - should see App Bridge object
4. Test toast: `shopify.toast.show('Test')`

### 3. Test Error Boundary

1. Temporarily add error-throwing code to a component
2. Verify error boundary catches it
3. Verify "Try again" button resets state

### 4. Test HMAC Validation

1. Access app proxy endpoint directly (without Shopify)
2. Should receive "Unauthorized - Invalid signature" error
3. Access through Shopify - should work normally

### 5. Test Webhook

1. Install the app
2. Uninstall the app
3. Check server logs for "App uninstall cleanup completed"
4. Verify sessions are deleted

---

## Rollback Instructions

If you encounter issues, you can rollback specific changes:

### Rollback Dependencies
```bash
npm install @shopify/shopify-api@10.0.0 @shopify/shopify-app-session-storage-memory@3.0.5
```

### Rollback App Bridge
```bash
npm install @shopify/app-bridge-react
# Restore old App.jsx from git
git checkout HEAD -- web/frontend/App.jsx web/frontend/index.html
```

### Rollback Session Storage
```bash
# In server.js, replace:
const sessionStorage = createSessionStorage();
# With:
const sessionStorage = new MemorySessionStorage();
```

---

## Next Steps (Future Improvements)

1. **Implement GDPR Webhooks**
   - Complete `customers/data_request` handler
   - Complete `customers/redact` handler
   - Complete `shop/redact` handler

2. **Add Database Storage**
   - Consider PostgreSQL for shop/schedule data
   - Implement proper data archival

3. **Replace Global State**
   - Move `global.activeShops` to Redis or database
   - Implement proper multi-instance support

4. **Add TypeScript**
   - Migrate to TypeScript for better type safety
   - Add type definitions for Shopify API responses

5. **Monitoring & Logging**
   - Add application monitoring (Sentry, DataDog, etc.)
   - Implement structured logging
   - Add performance monitoring

6. **Testing**
   - Add unit tests for critical functions
   - Add integration tests for API endpoints
   - Add E2E tests for user flows

---

## Support

For questions or issues with these changes, refer to:

- [Shopify App Documentation](https://shopify.dev/docs/apps)
- [App Bridge Documentation](https://shopify.dev/docs/api/app-bridge)
- [Shopify API Changelog](https://shopify.dev/docs/api/release-notes)

---

**Last Updated:** December 2024
**Shopify API Version:** 2025-10
**Node Version:** ≥18.0.0
