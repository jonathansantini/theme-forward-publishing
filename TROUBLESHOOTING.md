# Troubleshooting Guide

This guide helps resolve common issues with the Section Scheduler app.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Authentication Problems](#authentication-problems)
- [Schedule Execution Issues](#schedule-execution-issues)
- [Theme Modification Errors](#theme-modification-errors)
- [Metafield Issues](#metafield-issues)
- [Performance Problems](#performance-problems)
- [API Rate Limiting](#api-rate-limiting)
- [Frontend Issues](#frontend-issues)
- [Debugging Tips](#debugging-tips)

## Installation Issues

### App Won't Install on Store

**Symptoms**: OAuth flow fails or app installation hangs

**Possible Causes**:
1. Incorrect redirect URLs
2. Invalid API credentials
3. Insufficient scopes

**Solutions**:

```bash
# 1. Verify environment variables
heroku config:get SHOPIFY_API_KEY
heroku config:get SHOPIFY_API_SECRET

# 2. Check redirect URLs in Partner Dashboard match:
# https://your-app.herokuapp.com/auth/callback
# https://your-app.herokuapp.com/auth/shopify/callback

# 3. Verify scopes are correct
heroku config:get SCOPES
# Should be: write_themes,read_themes,write_content,read_content

# 4. Check app URL
heroku config:get SHOPIFY_APP_URL
# Should match Partner Dashboard App URL
```

### "Host Parameter Missing" Error

**Error**: `Missing host parameter`

**Solution**:

Ensure your app URL includes the host parameter:

```javascript
// In frontend App.jsx
const params = new URLSearchParams(window.location.search);
const host = params.get('host');

if (!host) {
  // Redirect to re-authenticate
  window.location.href = `/auth?shop=${shop}`;
}
```

### Session Not Persisting

**Symptoms**: User logged out frequently, session errors

**Solutions**:

```javascript
// 1. Use proper session storage
import { MemorySessionStorage } from '@shopify/shopify-api';

// For production, use Redis or database
const sessionStorage = new MemorySessionStorage();
shopify.config.sessionStorage = sessionStorage;

// 2. Set session secret
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)
```

## Authentication Problems

### "Unauthorized" Errors

**Error**: `401 Unauthorized - No session found`

**Diagnostic Steps**:

```bash
# 1. Check if session exists
curl -H "Cookie: session=..." https://your-app/api/schedules

# 2. Verify auth middleware is working
# Check server logs for auth verification
heroku logs --tail | grep "Auth"

# 3. Test OAuth flow manually
# Visit: https://your-app/auth?shop=your-store.myshopify.com
```

**Solutions**:

1. Clear cookies and re-authenticate
2. Verify session storage is configured
3. Check that auth middleware is applied to routes

### Access Token Invalid

**Error**: `Invalid access token`

**Solutions**:

```javascript
// 1. Check token expiration
const session = await sessionStorage.loadSession(sessionId);
if (!session || !session.accessToken) {
  // Redirect to re-auth
  return res.redirect('/auth?shop=' + shop);
}

// 2. Implement token refresh
if (session.expires && session.expires < new Date()) {
  // Token expired, re-auth required
}
```

## Schedule Execution Issues

### Schedules Not Executing

**Symptoms**: Schedules remain in "pending" status past execution time

**Diagnostic Steps**:

```bash
# 1. Check if processor is running
curl https://your-app/api/processor/status

# 2. Manually trigger processor
curl -X POST https://your-app/api/processor/trigger

# 3. Check Heroku Scheduler
heroku addons:open scheduler
# Verify job is configured to run

# 4. Check logs for errors
heroku logs --tail | grep "Schedule processor"
```

**Solutions**:

1. Verify Heroku Scheduler is configured
2. Check timezone issues (see below)
3. Ensure cron job is running

### Wrong Execution Time

**Symptoms**: Schedules execute at unexpected times

**Cause**: Timezone mismatch

**Solutions**:

```javascript
// 1. Verify shop timezone
const shopInfo = await client.getShopInfo();
console.log('Shop timezone:', shopInfo.ianaTimezone);

// 2. Check schedule execution time
const executeAt = moment(schedule.executeAt).tz(shopTimezone);
const now = moment().tz(shopTimezone);
console.log('Execute at:', executeAt.format());
console.log('Current time:', now.format());

// 3. Ensure all dates use ISO 8601 format
const isoDate = new Date().toISOString();
```

### Recurring Schedules Not Repeating

**Symptoms**: Schedule executes once but doesn't recur

**Diagnostic Steps**:

```javascript
// Check recurrence configuration
const schedule = await storage.getSchedule(scheduleId);
console.log('Recurrence:', schedule.recurrence);

// Verify next occurrence calculation
const nextOccurrence = scheduler.calculateNextOccurrence(schedule);
console.log('Next occurrence:', nextOccurrence);
```

**Solutions**:

1. Ensure `recurrence.enabled` is `true`
2. Verify recurrence type is valid (`daily`, `weekly`, `monthly`)
3. Check that status is reset to `pending` after execution

## Theme Modification Errors

### "Template Not Found"

**Error**: `Template index.json not found`

**Solutions**:

```javascript
// 1. Verify template name includes .json extension
const templateName = 'index.json'; // Correct
// NOT: 'index' or 'templates/index.json'

// 2. List available templates
const templates = await modifier.listTemplates(themeId);
console.log('Available templates:', templates);

// 3. Check theme ID is correct
const publishedTheme = await client.getPublishedTheme();
console.log('Published theme:', publishedTheme.id);
```

### "Section Not Found in Template"

**Error**: `Section announcement-bar not found in template`

**Solutions**:

```javascript
// 1. Validate section exists before scheduling
const validation = await modifier.validateSection(
  themeId,
  templateName,
  sectionId
);

if (!validation.valid) {
  console.error('Validation error:', validation.error);
}

// 2. Check section ID matches exactly
// Section IDs are case-sensitive and must match template
const sections = await modifier.getTemplateSections(themeId, templateName);
console.log('Available sections:', Object.keys(sections.sections));
```

### Theme Upload Fails

**Error**: `Failed to upload template: Invalid JSON`

**Solutions**:

```javascript
// 1. Validate JSON before upload
try {
  JSON.parse(templateContent);
} catch (error) {
  console.error('Invalid JSON:', error.message);
  // Don't upload invalid JSON
  return;
}

// 2. Check JSON structure
const template = JSON.parse(templateContent);
if (!template.sections || !template.order) {
  throw new Error('Invalid template structure');
}

// 3. Ensure proper formatting
const formattedContent = JSON.stringify(templateData, null, 2);
```

### Backup Creation Fails

**Error**: `Failed to create backup`

**Solutions**:

```javascript
// 1. Check metafield size
const backupContent = JSON.stringify(templateData);
if (backupContent.length > 65000) {
  console.warn('Backup too large:', backupContent.length);
  // Compress or split backup
}

// 2. Verify backup storage works
const backups = await storage.getBackups();
console.log('Existing backups:', backups.length);

// 3. Clean old backups
// Keep only last 10 per template
```

## Metafield Issues

### "Metafield Value Exceeds Maximum Length"

**Error**: `Value exceeds maximum length of 65535 characters`

**Solutions**:

```javascript
// 1. Check current size
const schedulesData = JSON.stringify({ schedules });
console.log('Metafield size:', schedulesData.length, '/ 65535');

// 2. Compress JSON (remove whitespace)
const compressed = JSON.stringify({ schedules }); // No formatting

// 3. Clean old data
// Remove completed/failed schedules older than 30 days
const activeSchedules = schedules.filter(s => {
  if (s.status === 'pending' || s.status === 'active') return true;
  const age = Date.now() - new Date(s.updatedAt).getTime();
  return age < 30 * 24 * 60 * 60 * 1000; // 30 days
});

// 4. Migrate to PostgreSQL (recommended for scaling)
```

### Metafield Not Saving

**Error**: Silent failure or `userErrors` in response

**Solutions**:

```javascript
// 1. Check response for errors
const response = await client.setShopMetafields(metafields);
if (response.data.metafieldsSet.userErrors.length > 0) {
  console.error('Metafield errors:', response.data.metafieldsSet.userErrors);
}

// 2. Verify metafield structure
const metafield = {
  ownerId: 'gid://shopify/Shop/123', // Correct format
  namespace: 'app_scheduler',        // Max 20 chars
  key: 'schedules',                  // Max 30 chars
  type: 'json',                      // Correct type
  value: '{"schedules":[]}'          // Valid JSON string
};

// 3. Test with minimal data
const testMetafield = {
  ownerId: shopId,
  namespace: 'test',
  key: 'test',
  type: 'single_line_text_field',
  value: 'test'
};
```

### Lost Metafield Data

**Symptoms**: Schedules disappear after app reinstall

**Prevention**:

```javascript
// 1. Implement data export
async function exportSchedules() {
  const schedules = await storage.getSchedules();
  const backups = await storage.getBackups();

  // Save to file or external storage
  fs.writeFileSync(
    'schedules-export.json',
    JSON.stringify({ schedules, backups }, null, 2)
  );
}

// 2. Schedule regular backups
// Run daily via Heroku Scheduler

// 3. Warn before uninstall
// Display warning in UI before app removal
```

## Performance Problems

### Slow API Responses

**Symptoms**: Requests take >5 seconds

**Solutions**:

```javascript
// 1. Implement caching
const cache = new Map();

async function getCachedSchedules() {
  if (cache.has('schedules')) {
    const { data, timestamp } = cache.get('schedules');
    if (Date.now() - timestamp < 60000) { // 1 minute cache
      return data;
    }
  }

  const schedules = await storage.getSchedules();
  cache.set('schedules', { data: schedules, timestamp: Date.now() });
  return schedules;
}

// 2. Optimize GraphQL queries
// Only fetch needed fields
query {
  theme(id: $themeId) {
    id
    name
    # Don't fetch all files unless needed
  }
}

// 3. Batch operations
// Group multiple metafield updates into one mutation
```

### High Memory Usage

**Symptoms**: Heroku dyno runs out of memory

**Solutions**:

```bash
# 1. Check memory usage
heroku logs --tail | grep "Error R14"

# 2. Upgrade dyno
heroku ps:type standard-1x

# 3. Optimize code
# - Don't store large objects in memory
# - Use streaming for large files
# - Clear caches periodically
```

### App Timeout

**Error**: `H12 Request timeout` or `H18 Server Request Interrupted`

**Solutions**:

```javascript
// 1. Increase timeout (if using custom server)
server.setTimeout(30000); // 30 seconds

// 2. Move long operations to background jobs
// Don't process schedules in HTTP request
// Use worker dyno instead

// 3. Implement request timeout handling
app.use((req, res, next) => {
  req.setTimeout(25000); // 25 seconds
  next();
});
```

## API Rate Limiting

### "Throttled" Errors

**Error**: `Throttled` or status `429`

**Solutions**:

```javascript
// 1. Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('Throttled') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`Throttled, retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

// 2. Add delay between requests
async function processSchedulesWithDelay(schedules) {
  for (const schedule of schedules) {
    await processSchedule(schedule);
    await sleep(500); // 500ms delay
  }
}

// 3. Monitor rate limit headers
const used = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
console.log('API usage:', used);
```

## Frontend Issues

### App Not Loading in Shopify Admin

**Symptoms**: Blank page or infinite loading

**Solutions**:

```javascript
// 1. Check App Bridge configuration
const config = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
  host: hostParam,
  forceRedirect: true
};

// Verify apiKey is set
if (!config.apiKey) {
  console.error('VITE_SHOPIFY_API_KEY not set');
}

// 2. Check browser console for errors
// Open DevTools and check Console tab

// 3. Verify CORS settings
app.use(cors({
  origin: true,
  credentials: true
}));
```

### "Failed to Fetch" Errors

**Error**: `TypeError: Failed to fetch`

**Solutions**:

```javascript
// 1. Check API endpoint URLs
const API_BASE = '/api'; // Relative URL
// NOT: 'https://your-app.com/api' (avoid hardcoding)

// 2. Add error handling to API calls
async function fetchWithErrorHandling(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// 3. Check network tab in DevTools
// Verify requests are being made
```

### State Not Updating

**Symptoms**: UI doesn't reflect changes after API calls

**Solutions**:

```javascript
// 1. Ensure state is updated after mutations
const createSchedule = async (data) => {
  await api.createSchedule(data);
  await refetchSchedules(); // Refresh list
};

// 2. Use proper React hooks dependencies
useEffect(() => {
  fetchSchedules();
}, [fetchSchedules]); // Include dependency

// 3. Check for stale closures
// Use functional updates
setSchedules(prev => [...prev, newSchedule]);
```

## Debugging Tips

### Enable Debug Logging

```javascript
// Backend
process.env.LOG_LEVEL = 'debug';

console.debug('Debug message');
console.info('Info message');
console.warn('Warning message');
console.error('Error message');

// Frontend
const DEBUG = import.meta.env.DEV;

if (DEBUG) {
  console.log('Debug:', data);
}
```

### Check Heroku Logs

```bash
# Real-time logs
heroku logs --tail

# Filter by source
heroku logs --source app

# Search logs
heroku logs --tail | grep "ERROR"

# View specific time range
heroku logs --since="2024-01-15 10:00" --until="2024-01-15 11:00"
```

### Test API Endpoints

```bash
# Test health endpoint
curl https://your-app/health

# Test with authentication
curl -H "Cookie: session=..." https://your-app/api/schedules

# POST request
curl -X POST https://your-app/api/schedules \
  -H "Content-Type: application/json" \
  -d '{"themeId":"...","templateName":"index.json",...}'
```

### Inspect Metafield Data

```bash
# Use Shopify CLI
shopify app info

# Or GraphiQL Explorer
# Visit: https://your-store.myshopify.com/admin/api/graphiql.json

# Query metafields
{
  shop {
    metafields(first: 10, namespace: "app_scheduler") {
      edges {
        node {
          key
          value
        }
      }
    }
  }
}
```

### Database State

```javascript
// Log current state
async function debugState() {
  const schedules = await storage.getSchedules();
  const backups = await storage.getBackups();
  const logs = await storage.getExecutionLogs();

  console.log('=== DEBUG STATE ===');
  console.log('Schedules:', schedules.length);
  console.log('Backups:', backups.length);
  console.log('Logs:', logs.length);

  schedules.forEach(s => {
    console.log(`Schedule ${s.id}:`, {
      status: s.status,
      executeAt: s.executeAt,
      sectionId: s.sectionId
    });
  });
}
```

## Getting Help

If you're still experiencing issues:

1. **Check documentation**:
   - [README.md](./README.md)
   - [API_REFERENCE.md](./API_REFERENCE.md)
   - [METAFIELD_SCHEMA.md](./METAFIELD_SCHEMA.md)

2. **Search existing issues**:
   - GitHub Issues: [repository-url]/issues

3. **Collect information**:
   - Error messages
   - Steps to reproduce
   - Environment details (Heroku, Node version, etc.)
   - Relevant logs

4. **Create detailed bug report**:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce
   - Screenshots if applicable

5. **Contact support**:
   - Email: support@example.com
   - GitHub: Create new issue

## Common Error Messages Reference

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `401 Unauthorized` | Missing/invalid session | Re-authenticate |
| `403 Forbidden` | Insufficient scopes | Update app scopes |
| `404 Not Found` | Invalid endpoint/resource | Check URL/ID |
| `429 Too Many Requests` | Rate limited | Implement backoff |
| `500 Internal Server Error` | Server error | Check logs |
| `Invalid GID format` | Malformed Shopify GID | Use correct format |
| `Metafield too large` | Exceeds 64KB limit | Compress or migrate |
| `Template not found` | Wrong template name | Verify name |
| `Section not found` | Invalid section ID | Validate section |
