# Deployment Guide

This guide covers deploying the Smart Content Scheduler app to Heroku and other platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Heroku Deployment](#heroku-deployment)
- [Environment Configuration](#environment-configuration)
- [Post-Deployment Setup](#post-deployment-setup)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- [ ] Shopify Partner account
- [ ] Shopify app created in Partner Dashboard
- [ ] Heroku account
- [ ] Heroku CLI installed
- [ ] Git repository set up
- [ ] All required environment variables documented

## Heroku Deployment

### Step 1: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create new app
heroku create your-app-name

# Or use an existing app
heroku git:remote -a your-app-name
```

### Step 2: Configure Environment Variables

```bash
# Set Shopify credentials
heroku config:set SHOPIFY_API_KEY=your_api_key_here
heroku config:set SHOPIFY_API_SECRET=your_api_secret_here

# Set app URL (replace with your Heroku app URL)
heroku config:set SHOPIFY_APP_URL=https://your-app-name.herokuapp.com

# Set scopes
heroku config:set SCOPES=write_themes,read_themes,write_content,read_content

# Set environment
heroku config:set NODE_ENV=production

# Set port (Heroku manages this, but good to have)
heroku config:set PORT=3000

# Optional: Set API version
heroku config:set SHOPIFY_API_VERSION=2025-01
```

### Step 3: Add Buildpacks

```bash
# Add Node.js buildpack
heroku buildpacks:add heroku/nodejs
```

### Step 4: Configure Procfile

Create a `Procfile` in the root directory:

```
web: node web/backend/server.js
```

### Step 5: Deploy to Heroku

```bash
# Add Heroku remote if not already added
git remote add heroku https://git.heroku.com/your-app-name.git

# Deploy
git push heroku main

# Or if using a different branch
git push heroku your-branch:main
```

### Step 6: Scale Dynos

```bash
# Scale web dyno
heroku ps:scale web=1

# For production, consider hobby or standard dynos
heroku ps:type hobby
```

### Step 7: Add Scheduler Add-on

The schedule processor runs as a cron job. You have two options:

#### Option A: Heroku Scheduler (Recommended for MVP)

```bash
# Add Heroku Scheduler
heroku addons:create scheduler:standard

# Open scheduler dashboard
heroku addons:open scheduler
```

In the Scheduler dashboard:
- Add a job: `curl -X POST https://your-app-name.herokuapp.com/api/processor/trigger`
- Frequency: Every 10 minutes (or as needed)

#### Option B: Background Worker Dyno

Modify `Procfile`:

```
web: node web/backend/server.js
worker: node web/backend/jobs/worker.js
```

Create `web/backend/jobs/worker.js`:

```javascript
import { ScheduleProcessor } from './schedule-processor.js';
import { Scheduler } from '../services/scheduler.js';
// ... initialize and start processor
```

Scale worker dyno:

```bash
heroku ps:scale worker=1
```

### Step 8: View Logs

```bash
# Tail logs
heroku logs --tail

# View recent logs
heroku logs -n 200

# Filter logs
heroku logs --source app --tail
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SHOPIFY_API_KEY` | Your app's API key | `a1b2c3d4e5f6...` |
| `SHOPIFY_API_SECRET` | Your app's API secret | `shpss_xyz123...` |
| `SHOPIFY_APP_URL` | Your app's URL | `https://app.herokuapp.com` |
| `SCOPES` | Required OAuth scopes | `write_themes,read_themes...` |
| `NODE_ENV` | Environment | `production` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `SHOPIFY_API_VERSION` | API version | `LATEST_API_VERSION` |
| `DATABASE_URL` | PostgreSQL URL (future) | - |
| `SESSION_SECRET` | Session encryption secret | Auto-generated |

### Verifying Configuration

```bash
# List all config vars
heroku config

# Get specific var
heroku config:get SHOPIFY_API_KEY
```

## Post-Deployment Setup

### 1. Update Shopify App URLs

In your Shopify Partner Dashboard:

1. Go to **Apps** > Your App > **App setup**
2. Update **App URL**: `https://your-app-name.herokuapp.com`
3. Update **Allowed redirection URL(s)**:
   - `https://your-app-name.herokuapp.com/auth/callback`
   - `https://your-app-name.herokuapp.com/auth/shopify/callback`
4. Save changes

### 2. Enable App Extensions (if any)

Currently not needed for MVP, but for future:

```bash
heroku run shopify app deploy
```

### 3. Test OAuth Flow

1. Navigate to your app in Partner Dashboard
2. Click "Test on development store"
3. Complete OAuth installation
4. Verify app loads correctly

### 4. Verify Schedule Processor

```bash
# Manually trigger processor
curl -X POST https://your-app-name.herokuapp.com/api/processor/trigger

# Check processor status
curl https://your-app-name.herokuapp.com/api/processor/status

# Check health
curl https://your-app-name.herokuapp.com/health
```

## Monitoring

### Application Monitoring

#### Heroku Metrics

```bash
# View app metrics
heroku logs --tail

# Monitor dyno metrics
heroku ps
```

#### New Relic (Recommended)

```bash
# Add New Relic
heroku addons:create newrelic:wayne

# Configure
heroku config:set NEW_RELIC_APP_NAME="Smart Content Scheduler"
```

#### Papertrail (Log Management)

```bash
# Add Papertrail
heroku addons:create papertrail:choklad

# Open dashboard
heroku addons:open papertrail
```

### Custom Monitoring

Add to your app:

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    processor: scheduleProcessor.getStatus()
  });
});
```

Monitor with external service (e.g., UptimeRobot):
- URL: `https://your-app-name.herokuapp.com/health`
- Interval: 5 minutes

### Error Tracking

#### Sentry

```bash
npm install @sentry/node

# Configure
heroku config:set SENTRY_DSN=your_sentry_dsn
```

In `server.js`:

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.errorHandler());
```

## Scaling

### Horizontal Scaling

```bash
# Scale web dynos
heroku ps:scale web=2

# Scale worker dynos
heroku ps:scale worker=2
```

### Vertical Scaling

```bash
# Upgrade dyno type
heroku ps:type standard-1x

# Or performance dynos for high traffic
heroku ps:type performance-m
```

### Database Scaling

When migrating to PostgreSQL:

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:hobby-basic

# Upgrade as needed
heroku pg:upgrade DATABASE_URL --version 15
```

### Caching

Add Redis for session storage and caching:

```bash
# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Configure in app
heroku config:get REDIS_URL
```

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"

      - name: Run health check
        run: |
          sleep 30
          curl -f https://your-app-name.herokuapp.com/health || exit 1
```

### Heroku Pipelines

```bash
# Create pipeline
heroku pipelines:create section-scheduler

# Add app to staging
heroku pipelines:add section-scheduler --stage staging

# Add app to production
heroku pipelines:add section-scheduler --stage production

# Promote staging to production
heroku pipelines:promote -r staging
```

## Backup Strategy

### Code Backup

- Use GitHub/GitLab for code repository
- Tag releases: `git tag v1.0.0 && git push --tags`

### Data Backup

For metafield data:

```javascript
// Scheduled backup script
async function backupMetafields() {
  const schedules = await storage.getSchedules();
  const backups = await storage.getBackups();

  // Save to file or external storage
  await saveToS3('schedules-backup.json', JSON.stringify(schedules));
  await saveToS3('backups-backup.json', JSON.stringify(backups));
}
```

Run daily via Heroku Scheduler:

```bash
node scripts/backup-metafields.js
```

### Database Backup (Future PostgreSQL)

```bash
# Manual backup
heroku pg:backups:capture

# Schedule automatic backups
heroku pg:backups:schedule DATABASE_URL --at '02:00 America/New_York'

# Download backup
heroku pg:backups:download
```

## Rollback

### Heroku Rollback

```bash
# View releases
heroku releases

# Rollback to previous release
heroku rollback

# Rollback to specific release
heroku rollback v42
```

### Git Rollback

```bash
# Rollback to previous commit
git revert HEAD
git push heroku main

# Rollback to specific commit
git reset --hard <commit-hash>
git push heroku main --force
```

## Security Checklist

- [ ] Environment variables set (not in code)
- [ ] HTTPS enforced
- [ ] Session secret configured
- [ ] API keys rotated regularly
- [ ] OAuth scopes minimized
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] Error messages sanitized
- [ ] Dependencies updated

## Performance Optimization

### 1. Enable Compression

Already configured in `server.js`:

```javascript
import compression from 'compression';
app.use(compression());
```

### 2. Static Asset Caching

```javascript
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('web/frontend/dist', {
    maxAge: '1d',
    etag: true
  }));
}
```

### 3. Database Connection Pooling

When using PostgreSQL:

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Maintenance Mode

Create `maintenance.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Maintenance</title>
</head>
<body>
  <h1>Under Maintenance</h1>
  <p>We'll be back soon!</p>
</body>
</html>
```

Enable maintenance mode:

```bash
heroku maintenance:on
```

Disable:

```bash
heroku maintenance:off
```

## Troubleshooting Deployment

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting steps.

### Common Issues

**App Crashes on Start**

```bash
# Check logs
heroku logs --tail

# Restart app
heroku restart
```

**Environment Variables Not Set**

```bash
# Verify all required vars are set
heroku config
```

**Build Fails**

```bash
# Check build log
heroku builds:output

# Rebuild
git commit --allow-empty -m "Rebuild"
git push heroku main
```

## Additional Resources

- [Heroku Node.js Guide](https://devcenter.heroku.com/articles/deploying-nodejs)
- [Heroku CLI Reference](https://devcenter.heroku.com/articles/heroku-cli)
- [Shopify App Deployment](https://shopify.dev/apps/deployment)
