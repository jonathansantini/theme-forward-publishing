# Metafield Schema Documentation

This document describes the metafield structure used in the MVP version of the Smart Content Scheduler app and provides a migration path to PostgreSQL for scaling.

## Overview

The MVP uses Shopify metafields to store:
- Schedule definitions
- Backup templates
- Original section data
- Execution logs

All metafields use the namespace `app_scheduler`.

## Metafield Structures

### 1. Schedules (`app_scheduler.schedules`)

Stores all schedule definitions.

**Type**: `json`

**Structure**:

```json
{
  "schedules": [
    {
      "id": "uuid-v4",
      "themeId": "gid://shopify/OnlineStoreTheme/123456789",
      "templateName": "index.json",
      "sectionId": "announcement-bar",
      "action": "hide",
      "executeAt": "2024-12-25T00:00:00.000Z",
      "recurrence": {
        "enabled": true,
        "type": "weekly",
        "dayOfWeek": 6,
        "dayOfMonth": null,
        "time": "00:00"
      },
      "status": "pending",
      "finalized": false,
      "createdAt": "2024-11-15T10:30:00.000Z",
      "updatedAt": "2024-11-15T11:00:00.000Z",
      "lastRun": null,
      "retryCount": 0,
      "error": null
    }
  ]
}
```

**Field Descriptions**:

- `id`: Unique identifier (UUID v4)
- `themeId`: Shopify GID of the theme
- `templateName`: Name of the JSON template (e.g., `index.json`, `product.json`)
- `sectionId`: ID of the section in the template
- `action`: Either `"show"` or `"hide"`
- `executeAt`: ISO 8601 timestamp in UTC
- `recurrence.enabled`: Boolean indicating if schedule repeats
- `recurrence.type`: `"daily"`, `"weekly"`, or `"monthly"`
- `recurrence.dayOfWeek`: 0-6 (Sunday-Saturday) for weekly recurrence
- `recurrence.dayOfMonth`: 1-31 for monthly recurrence
- `recurrence.time`: HH:mm format (24-hour)
- `status`: `"pending"`, `"active"`, `"completed"`, or `"failed"`
- `finalized`: Boolean - if true, schedule cannot be edited
- `createdAt`: ISO 8601 timestamp
- `updatedAt`: ISO 8601 timestamp
- `lastRun`: ISO 8601 timestamp of last execution (null if never run)
- `retryCount`: Number of retry attempts (0-3)
- `error`: Error message if status is "failed"

### 2. Backups (`app_scheduler.backups`)

Stores template backups before modifications.

**Type**: `json`

**Structure**:

```json
{
  "backups": [
    {
      "id": "uuid-v4",
      "themeId": "gid://shopify/OnlineStoreTheme/123456789",
      "templateName": "index.json",
      "content": "{\"sections\":{...},\"order\":[...]}",
      "timestamp": "2024-11-15T10:30:00.000Z",
      "scheduleId": "uuid-of-related-schedule"
    }
  ]
}
```

**Field Descriptions**:

- `id`: Unique identifier (UUID v4)
- `themeId`: Shopify GID of the theme
- `templateName`: Name of the template
- `content`: Full JSON template content (stringified)
- `timestamp`: When backup was created
- `scheduleId`: Related schedule ID (optional)

**Retention Policy**: Keep last 10 backups per template to avoid metafield size limits.

### 3. Original Sections (`app_scheduler.original_sections`)

Stores original section data for restoration when "showing" a hidden section.

**Type**: `json`

**Structure**:

```json
{
  "sections": {
    "announcement-bar": {
      "data": {
        "type": "announcement-bar",
        "settings": {
          "text": "Welcome to our store!",
          "color_scheme": "background-1"
        },
        "blocks": {}
      },
      "order": 0
    }
  }
}
```

**Field Descriptions**:

- Key: Section ID
- `data`: Complete section object from template
- `order`: Original position in template's order array

### 4. Execution Logs (`app_scheduler.execution_logs`)

Stores execution history for audit trail.

**Type**: `json`

**Structure**:

```json
{
  "logs": [
    {
      "id": "uuid-v4",
      "scheduleId": "uuid-of-schedule",
      "timestamp": "2024-11-15T10:30:00.000Z",
      "success": true,
      "action": "hide",
      "sectionId": "announcement-bar",
      "templateName": "index.json",
      "themeId": "gid://shopify/OnlineStoreTheme/123456789",
      "error": null
    }
  ]
}
```

**Field Descriptions**:

- `id`: Unique identifier (UUID v4)
- `scheduleId`: Related schedule ID
- `timestamp`: When execution occurred
- `success`: Boolean indicating success/failure
- `action`: `"show"` or `"hide"`
- `sectionId`: Section that was modified
- `templateName`: Template that was modified
- `themeId`: Theme that was modified
- `error`: Error message if success is false

**Retention Policy**: Keep last 100 logs to avoid metafield size limits.

## Metafield Size Limitations

Shopify metafields have a maximum size of **65,535 characters** (64KB).

### Current Approach

To stay within limits:

1. **Schedules**: Compact JSON without whitespace
2. **Backups**: Rotate old backups (keep last 10 per template)
3. **Logs**: Rotate old logs (keep last 100)
4. **Original Sections**: Minimal storage, remove after restoration

### Monitoring

The app should monitor metafield sizes and warn when approaching limits:

```javascript
const MAX_METAFIELD_SIZE = 65535;
const WARN_THRESHOLD = 0.8; // 80%

function checkMetafieldSize(value) {
  const size = JSON.stringify(value).length;
  if (size > MAX_METAFIELD_SIZE * WARN_THRESHOLD) {
    console.warn(`Metafield approaching size limit: ${size}/${MAX_METAFIELD_SIZE}`);
  }
}
```

## Migration Path to PostgreSQL

When scaling beyond MVP, migrate to PostgreSQL for better performance and no size limits.

### PostgreSQL Schema

```sql
-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  theme_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('show', 'hide')),
  execute_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recurrence JSONB,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'failed')),
  finalized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_run TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  INDEX idx_shop_status (shop_domain, status),
  INDEX idx_execute_at (execute_at)
);

-- Backups table
CREATE TABLE backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  theme_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  INDEX idx_shop_template (shop_domain, template_name),
  INDEX idx_created_at (created_at)
);

-- Original sections table
CREATE TABLE original_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  original_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_domain, section_id)
);

-- Execution logs table
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  executed_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  action VARCHAR(10) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  theme_id VARCHAR(255) NOT NULL,
  error TEXT,
  INDEX idx_shop_schedule (shop_domain, schedule_id),
  INDEX idx_executed_at (executed_at)
);

-- Automatic cleanup of old backups
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM backups
  WHERE shop_domain = NEW.shop_domain
    AND template_name = NEW.template_name
    AND id NOT IN (
      SELECT id FROM backups
      WHERE shop_domain = NEW.shop_domain
        AND template_name = NEW.template_name
      ORDER BY created_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_backups
AFTER INSERT ON backups
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_backups();
```

### Migration Steps

1. **Set up PostgreSQL database**
   - Heroku Postgres addon or managed PostgreSQL service
   - Run schema migration script

2. **Create data migration script**
   ```javascript
   // Migrate from metafields to PostgreSQL
   async function migrateToPostgres(shopDomain) {
     // 1. Fetch all metafield data
     const schedules = await getMetafieldSchedules(shopDomain);
     const backups = await getMetafieldBackups(shopDomain);
     const originalSections = await getMetafieldOriginalSections(shopDomain);
     const logs = await getMetafieldLogs(shopDomain);

     // 2. Insert into PostgreSQL
     await db.schedules.insertMany(schedules);
     await db.backups.insertMany(backups);
     await db.originalSections.insertMany(originalSections);
     await db.executionLogs.insertMany(logs);

     // 3. Verify data integrity
     // 4. Clear metafields (optional, keep as backup)
   }
   ```

3. **Update service layer**
   - Replace `MetafieldStorage` with `PostgresStorage`
   - Keep same interface for minimal code changes

4. **Test thoroughly**
   - Verify all CRUD operations
   - Test schedule execution
   - Validate backup/restore functionality

5. **Deploy with feature flag**
   ```javascript
   const storage = process.env.USE_POSTGRES === 'true'
     ? new PostgresStorage(db)
     : new MetafieldStorage(graphqlClient);
   ```

## Best Practices

### Metafield Management

1. **Compress data**: Remove unnecessary whitespace from JSON
2. **Batch operations**: Update metafields in batches to reduce API calls
3. **Error handling**: Always catch metafield size errors
4. **Monitoring**: Track metafield sizes and set up alerts

### Data Integrity

1. **Validate before save**: Check data structure before writing
2. **Transaction-like behavior**: Store old data before updating
3. **Backup before delete**: Keep copy of deleted schedules for recovery
4. **Regular audits**: Periodically verify data consistency

### Performance

1. **Cache metafield reads**: Don't fetch on every request
2. **Lazy load**: Only fetch logs/backups when needed
3. **Index optimization**: Use appropriate indexes in PostgreSQL
4. **Archival**: Move old data to archive tables

## Troubleshooting

### Metafield Size Exceeded

**Error**: "Metafield value exceeds maximum size"

**Solutions**:
1. Run cleanup on backups/logs
2. Compress JSON (remove whitespace)
3. Archive old data
4. Migrate to PostgreSQL

### Data Loss Prevention

**Strategies**:
1. Regular exports to file system
2. Duplicate critical data to separate metafield
3. Enable Shopify's backup features
4. Implement soft deletes

### Recovery

**From Backups**:
```javascript
async function recoverFromBackup(backupId) {
  const backup = await storage.getBackup(backupId);
  await themeModifier.uploadTemplate(
    backup.themeId,
    backup.templateName,
    backup.content
  );
}
```

**From Original Sections**:
```javascript
async function recoverSection(sectionId) {
  const original = await storage.getOriginalSection(sectionId);
  // Re-add to template
}
```
