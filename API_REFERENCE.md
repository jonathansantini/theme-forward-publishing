# API Reference

This document provides detailed information about all GraphQL queries and mutations used by the Section Scheduler app.

## GraphQL Admin API Version

**API Version**: `2025-01` (or latest stable)

**Required Scopes**:
- `write_themes` - Modify theme files
- `read_themes` - Read theme data
- `write_content` - Write metafields
- `read_content` - Read metafields

## Theme Operations

### Get Theme Files

Retrieves all files from a specific theme.

**Query**:

```graphql
query getThemeFiles($themeId: ID!) {
  theme(id: $themeId) {
    id
    name
    role
    files(first: 250) {
      nodes {
        filename
        body {
          ... on OnlineStoreThemeFileBodyText {
            content
          }
        }
      }
    }
  }
}
```

**Variables**:

```json
{
  "themeId": "gid://shopify/OnlineStoreTheme/123456789"
}
```

**Response**:

```json
{
  "data": {
    "theme": {
      "id": "gid://shopify/OnlineStoreTheme/123456789",
      "name": "Dawn",
      "role": "MAIN",
      "files": {
        "nodes": [
          {
            "filename": "templates/index.json",
            "body": {
              "content": "{\"sections\":{...},\"order\":[...]}"
            }
          }
        ]
      }
    }
  }
}
```

**Usage**: Used to list all templates and get their content.

---

### Get Specific Theme File

Retrieves a single file from a theme.

**Query**:

```graphql
query getThemeFile($themeId: ID!, $filename: String!) {
  theme(id: $themeId) {
    files(first: 1, filename: $filename) {
      nodes {
        filename
        body {
          ... on OnlineStoreThemeFileBodyText {
            content
          }
        }
      }
    }
  }
}
```

**Variables**:

```json
{
  "themeId": "gid://shopify/OnlineStoreTheme/123456789",
  "filename": "templates/index.json"
}
```

**Response**:

```json
{
  "data": {
    "theme": {
      "files": {
        "nodes": [
          {
            "filename": "templates/index.json",
            "body": {
              "content": "{\"sections\":{\"announcement-bar\":{...}},\"order\":[...]}"
            }
          }
        ]
      }
    }
  }
}
```

**Usage**: Fetch specific template before modification.

---

### Update Theme Files

Uploads modified theme files.

**Mutation**:

```graphql
mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles {
      filename
      body {
        ... on OnlineStoreThemeFileBodyText {
          content
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables**:

```json
{
  "themeId": "gid://shopify/OnlineStoreTheme/123456789",
  "files": [
    {
      "filename": "templates/index.json",
      "body": {
        "type": "TEXT",
        "value": "{\"sections\":{...},\"order\":[...]}"
      }
    }
  ]
}
```

**Response**:

```json
{
  "data": {
    "themeFilesUpsert": {
      "upsertedThemeFiles": [
        {
          "filename": "templates/index.json",
          "body": {
            "content": "{\"sections\":{...}}"
          }
        }
      ],
      "userErrors": []
    }
  }
}
```

**Error Handling**:

```json
{
  "data": {
    "themeFilesUpsert": {
      "upsertedThemeFiles": [],
      "userErrors": [
        {
          "field": ["files", "0", "body"],
          "message": "Invalid JSON format"
        }
      ]
    }
  }
}
```

**Usage**: Upload modified templates after hiding/showing sections.

---

### Get Published Theme

Retrieves the currently published (main) theme.

**Query**:

```graphql
query getPublishedTheme {
  themes(first: 10, roles: MAIN) {
    nodes {
      id
      name
      role
    }
  }
}
```

**Response**:

```json
{
  "data": {
    "themes": {
      "nodes": [
        {
          "id": "gid://shopify/OnlineStoreTheme/123456789",
          "name": "Dawn",
          "role": "MAIN"
        }
      ]
    }
  }
}
```

**Usage**: Get the published theme ID for schedule creation.

---

## Metafield Operations

### Get Shop Metafield

Retrieves a specific metafield from the shop.

**Query**:

```graphql
query getShopMetafield($namespace: String!, $key: String!) {
  shop {
    metafield(namespace: $namespace, key: $key) {
      id
      namespace
      key
      value
      type
    }
  }
}
```

**Variables**:

```json
{
  "namespace": "app_scheduler",
  "key": "schedules"
}
```

**Response**:

```json
{
  "data": {
    "shop": {
      "metafield": {
        "id": "gid://shopify/Metafield/123456789",
        "namespace": "app_scheduler",
        "key": "schedules",
        "value": "{\"schedules\":[...]}",
        "type": "json"
      }
    }
  }
}
```

**Usage**: Fetch schedules, backups, or logs stored in metafields.

---

### Set Shop Metafields

Creates or updates shop metafields.

**Mutation**:

```graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
      value
      type
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables**:

```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/Shop/123456789",
      "namespace": "app_scheduler",
      "key": "schedules",
      "type": "json",
      "value": "{\"schedules\":[...]}"
    }
  ]
}
```

**Response**:

```json
{
  "data": {
    "metafieldsSet": {
      "metafields": [
        {
          "id": "gid://shopify/Metafield/123456789",
          "namespace": "app_scheduler",
          "key": "schedules",
          "value": "{\"schedules\":[...]}",
          "type": "json"
        }
      ],
      "userErrors": []
    }
  }
}
```

**Error Handling**:

```json
{
  "data": {
    "metafieldsSet": {
      "metafields": [],
      "userErrors": [
        {
          "field": ["metafields", "0", "value"],
          "message": "Value exceeds maximum length"
        }
      ]
    }
  }
}
```

**Usage**: Save schedules, backups, and logs.

---

## Shop Information

### Get Shop Info

Retrieves shop details including timezone.

**Query**:

```graphql
query getShopInfo {
  shop {
    id
    name
    email
    ianaTimezone
    currencyCode
  }
}
```

**Response**:

```json
{
  "data": {
    "shop": {
      "id": "gid://shopify/Shop/123456789",
      "name": "My Dev Store",
      "email": "store@example.com",
      "ianaTimezone": "America/New_York",
      "currencyCode": "USD"
    }
  }
}
```

**Usage**: Get shop timezone for schedule calculations.

---

## Rate Limiting

### Understanding Shopify Rate Limits

Shopify uses a **leaky bucket** algorithm for rate limiting.

**Limits**:
- **REST API**: 2 requests/second (burst up to 40)
- **GraphQL API**: Cost-based (default 1000 points, refills at 50 points/second)

### Headers

Response headers indicate rate limit status:

```
X-Shopify-Shop-Api-Call-Limit: 32/40
```

### Handling Rate Limits

**Detection**:

```javascript
const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
if (rateLimitHeader) {
  const [used, total] = rateLimitHeader.split('/').map(Number);
  const usage = used / total;

  if (usage > 0.8) {
    // Approaching limit, slow down
    await sleep(1000);
  }
}
```

**Retry Logic**:

```javascript
async function queryWithRetry(query, variables, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.query(query, variables);
    } catch (error) {
      if (error.message.includes('Throttled') || error.response?.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Error Handling

### Common Errors

#### 1. Invalid GID Format

**Error**:
```json
{
  "errors": [
    {
      "message": "Variable themeId of type ID! was provided invalid value"
    }
  ]
}
```

**Solution**: Ensure GIDs follow format: `gid://shopify/ResourceType/123`

#### 2. Theme Not Found

**Error**:
```json
{
  "data": {
    "theme": null
  }
}
```

**Solution**: Verify theme ID exists and is accessible.

#### 3. Insufficient Permissions

**Error**:
```json
{
  "errors": [
    {
      "message": "Access denied"
    }
  ]
}
```

**Solution**: Check app has required scopes installed.

#### 4. Invalid JSON in Template

**Error**:
```json
{
  "data": {
    "themeFilesUpsert": {
      "userErrors": [
        {
          "field": ["files", "0", "body"],
          "message": "Invalid JSON"
        }
      ]
    }
  }
}
```

**Solution**: Validate JSON before uploading.

#### 5. Metafield Too Large

**Error**:
```json
{
  "data": {
    "metafieldsSet": {
      "userErrors": [
        {
          "field": ["metafields", "0", "value"],
          "message": "Value exceeds maximum length of 65535 characters"
        }
      ]
    }
  }
}
```

**Solution**: Compress data or migrate to PostgreSQL.

---

## Best Practices

### 1. Batch Operations

Group multiple operations when possible:

```javascript
// Good: Single mutation for multiple metafields
await metafieldsSet([
  { namespace: 'app_scheduler', key: 'schedules', value: '...' },
  { namespace: 'app_scheduler', key: 'backups', value: '...' }
]);

// Bad: Multiple separate mutations
await metafieldsSet([{ namespace: 'app_scheduler', key: 'schedules', value: '...' }]);
await metafieldsSet([{ namespace: 'app_scheduler', key: 'backups', value: '...' }]);
```

### 2. Error Recovery

Always implement retry logic:

```javascript
try {
  await updateThemeFile(themeId, filename, content);
} catch (error) {
  if (isRateLimitError(error)) {
    await sleep(2000);
    return await updateThemeFile(themeId, filename, content);
  }
  throw error;
}
```

### 3. Validation

Validate before making API calls:

```javascript
// Validate GID format
if (!themeId.match(/^gid:\/\/shopify\/OnlineStoreTheme\/\d+$/)) {
  throw new Error('Invalid theme ID format');
}

// Validate JSON
try {
  JSON.parse(templateContent);
} catch {
  throw new Error('Invalid JSON content');
}
```

### 4. Logging

Log all API operations:

```javascript
console.log(`[GraphQL] Fetching theme ${themeId}`);
const theme = await getTheme(themeId);
console.log(`[GraphQL] Successfully fetched theme: ${theme.name}`);
```

### 5. Caching

Cache frequently accessed data:

```javascript
const cache = new Map();

async function getPublishedTheme() {
  const cacheKey = 'published_theme';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 300000) { // 5 min
    return cached.data;
  }

  const theme = await fetchPublishedTheme();
  cache.set(cacheKey, { data: theme, timestamp: Date.now() });
  return theme;
}
```

---

## Testing

### Using GraphiQL

Test queries in Shopify's GraphiQL explorer:

1. Go to your store admin
2. Navigate to `https://YOUR-STORE.myshopify.com/admin/api/graphiql.json`
3. Paste query and test

### Example Test Queries

**Test 1: Verify Theme Access**

```graphql
{
  themes(first: 5) {
    nodes {
      id
      name
      role
    }
  }
}
```

**Test 2: Check Metafield**

```graphql
{
  shop {
    metafield(namespace: "app_scheduler", key: "schedules") {
      value
    }
  }
}
```

**Test 3: Validate Template**

```graphql
query($themeId: ID!) {
  theme(id: $themeId) {
    files(first: 1, filename: "templates/index.json") {
      nodes {
        filename
      }
    }
  }
}
```

---

## References

- [Shopify GraphQL Admin API](https://shopify.dev/api/admin-graphql)
- [Rate Limiting](https://shopify.dev/api/usage/rate-limits)
- [Metafields](https://shopify.dev/api/admin-graphql/latest/objects/metafield)
- [Online Store Themes](https://shopify.dev/api/admin-graphql/latest/objects/onlinestoretheme)
