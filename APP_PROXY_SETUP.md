# App Proxy Setup Guide

This app uses **Shopify App Proxy** to dynamically control section visibility without modifying theme files directly.

## What is App Proxy?

App Proxy allows your app to serve dynamic content on the merchant's storefront. When a customer visits:

```
https://store.myshopify.com/apps/scheduler/visibility.js
```

Shopify automatically proxies the request to your backend:

```
https://your-backend.com/proxy/visibility.js
```

Your backend then returns JavaScript that removes scheduled sections from the DOM.

## Setup Instructions

### 1. Configure App Proxy in Shopify Partner Dashboard

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to **Apps** → Select your app
3. Click **App setup** in the left sidebar
4. Scroll down to **App proxy** section
5. Configure with these values:

   **Subpath prefix:** `apps`

   **Subpath:** `scheduler`

   **Proxy URL:** `https://your-backend-url.com/proxy`

   > **Note:** Replace `your-backend-url.com` with your actual backend URL (e.g., your ngrok URL during development, or your production domain)

6. Click **Save**

### 2. Deploy the Theme App Extension

If you haven't already deployed the theme app extension:

```bash
# Make sure you have Shopify CLI installed
npm install -g @shopify/cli @shopify/app

# Link your app (first time only)
cd /path/to/theme-forward-publishing
shopify app config link

# Deploy the extension
shopify app deploy
```

### 3. Install the App Block in the Theme

1. In the Shopify admin, go to **Online Store** → **Themes**
2. Click **Customize** on your active theme
3. In the theme editor, click the **</>** (code) icon in the header
4. Add the **"Section Scheduler"** app block to the `<head>` section:
   - Click "Add block" in the header section
   - Find "Section Scheduler" under "Apps"
   - Add it

Alternatively, you can add it to specific templates by editing the JSON template files.

### 4. Configure Visibility Mode (Optional)

The app block has a setting to switch between two modes:

- **JavaScript mode (default):** Removes sections from DOM entirely
- **CSS mode (fallback):** Hides sections with `display: none`

To change the mode:

1. In the theme editor, click the "Section Scheduler" block
2. In the block settings, select your preferred **Visibility Mode**
3. Click **Save**

## How It Works

### Flow Diagram

```
Customer visits page
        ↓
Theme loads "Section Scheduler" app block in <head>
        ↓
App block loads: <script src="/apps/scheduler/visibility.js?mode=js"></script>
        ↓
Shopify proxies to: https://your-backend.com/proxy/visibility.js
        ↓
Backend reads hidden_sections metafield via GraphQL
        ↓
Backend returns JavaScript: document.getElementById('shopify-section-X').remove()
        ↓
JavaScript executes and removes sections from DOM before they render
        ↓
Customer sees page with scheduled sections hidden
```

### Backend Implementation

The app proxy endpoint is implemented in `/web/backend/routes/proxy.js`:

- **GET /proxy/visibility.js** - Main endpoint that returns section removal code
- **GET /proxy/health** - Health check for the proxy

### Supported Query Parameters

- `?mode=js` - Returns JavaScript that removes sections (default)
- `?mode=css` - Returns CSS that hides sections with `display: none`

## Testing the App Proxy

### 1. Test Proxy Health

```bash
curl https://your-backend-url.com/proxy/health
```

Expected response:
```json
{
  "status": "ok",
  "proxy": "active",
  "timestamp": "2025-11-20T..."
}
```

### 2. Test Visibility Script

Create a test schedule in your app to hide a section, then visit:

```
https://your-dev-store.myshopify.com/apps/scheduler/visibility.js
```

You should see JavaScript code like:

```javascript
(function() {
  'use strict';
  var hiddenSections = ["product-recommendations", "featured-collection"];
  // ... removal logic
})();
```

### 3. Verify in Browser Console

1. Visit your storefront
2. Open browser DevTools (F12)
3. Check the Console for messages:
   ```
   [Section Scheduler] Removed 2 section(s) from DOM
   ```
4. Inspect the DOM - hidden sections should not appear in the HTML

## Troubleshooting

### Issue: "No shop domain in request headers"

**Cause:** The app proxy is not configured correctly in Partner Dashboard.

**Solution:**
- Verify the Subpath and Proxy URL settings
- Make sure your backend is accessible from the internet
- Check that HTTPS is enabled (required for app proxy)

### Issue: Sections still visible on storefront

**Possible causes:**

1. **App block not installed in theme**
   - Check theme editor → Ensure "Section Scheduler" block is in `<head>`

2. **App proxy not configured**
   - Verify Partner Dashboard settings
   - Test the proxy endpoint directly

3. **No active session for shop**
   - Make sure the app is installed and you've authenticated
   - Check backend logs: `[Proxy] No session found for shop`

4. **Metafield not set**
   - Verify schedules are executing: POST to `/api/processor/trigger`
   - Check if `hidden_sections` metafield exists (use GraphQL explorer)

### Issue: JavaScript errors in console

**Cause:** Sections might load before the script executes.

**Solution:**
- The script uses `DOMContentLoaded` to ensure sections are available
- Switch to CSS mode as fallback: Set mode to "css" in app block settings

## Development vs Production

### Development (with ngrok)

```bash
# Start ngrok tunnel
ngrok http 3000

# Use ngrok URL in Partner Dashboard
# Proxy URL: https://abc123.ngrok.io/proxy
```

### Production

- Deploy backend to a production server (Heroku, Railway, AWS, etc.)
- Update Proxy URL in Partner Dashboard to your production domain
- Ensure HTTPS is enabled

## Security Notes

- The app proxy is publicly accessible (no authentication required)
- Shopify adds headers to verify the request came from their servers
- Sensitive operations should verify the `X-Shopify-Shop-Domain` header
- Consider implementing request signing for additional security

## Cache Settings

The proxy endpoint sets cache headers:

```
Cache-Control: public, max-age=60
```

This caches the response for 1 minute, balancing:
- **Freshness:** Changes take effect within 60 seconds
- **Performance:** Reduces backend load and improves page speed

Adjust in `/web/backend/routes/proxy.js` if needed.

## Next Steps

- Monitor backend logs during testing
- Check Shopify's app proxy documentation for advanced features
- Consider adding analytics to track section visibility changes
