# Smart Content Scheduler - Feature Roadmap

**Status:** Approved - Ready for Development  
**Last Updated:** 2026-04-12  
**Estimated Timeline:** 9-13 weeks (Phase 0 + Tier 1 + 2)

---

## 🎯 Approved Scope

Building **database foundation + Tier 1 + Tier 2 features** to position as the only Shopify scheduling app with:
- ✅ Time-based scheduling (already built)
- ✅ Production-ready database with audit logging (new - Phase 0)
- ✅ Customer segmentation (new - competitive gap)
- ✅ Performance analytics (new - differentiator)
- ✅ AI-native Sidekick integration (new - first mover)

**Strategic Positioning:** "Schedule + Segment + Measure"

---

## 📅 Implementation Phases

### Phase 0: Database Foundation (1-2 weeks) 🆕

**Goal:** Replace metafield-only storage with PostgreSQL for production readiness, unlimited logging, and audit trails.

**Why First:**
- Foundation for customer segmentation queries
- Required for analytics data storage (Phase 3)
- Unlimited execution history (current: only 100 logs kept)
- Full audit trail (who created/modified schedules)
- Production-ready for client deployments
- Better to migrate small dataset now vs large dataset later

**What Gets Built:**
- PostgreSQL database + Prisma ORM
- Database schema for schedules, execution logs, audit logs, backups
- Migration scripts from metafields to database
- Audit logging system (track who/what/when)
- User attribution on all schedule operations
- Unlimited execution history storage

**Database Schema:**
```sql
-- Schedules table
schedules (
  id UUID PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL,
  theme_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  finalized BOOLEAN DEFAULT FALSE,
  customer_tags JSONB,  -- For Phase 1
  recurrence JSONB,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Execution logs (unlimited history)
execution_logs (
  id UUID PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id),
  action VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error TEXT,
  duration_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
)

-- Audit logs (track all changes)
audit_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),
  changes JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
)

-- Backups (unlimited)
backups (
  id UUID PRIMARY KEY,
  theme_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  section_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
)
```

**Files to Create:**
- `web/backend/prisma/schema.prisma` - Prisma schema definition
- `web/backend/prisma/migrations/` - Database migrations
- `web/backend/services/database.js` - Database service layer
- `web/backend/services/audit-logger.js` - Audit logging service
- `web/backend/scripts/migrate-from-metafields.js` - Migration script

**Files to Modify:**
- `web/backend/services/metafield-storage.js` - Replace with database calls (keep class interface)
- `web/backend/package.json` - Add Prisma dependencies
- `web/backend/.env.example` - Add DATABASE_URL
- `web/backend/__tests__/database.test.js` - Database service tests

**Migration Strategy:**
1. Set up PostgreSQL (Heroku/Render/Railway - ~$7-9/month)
2. Install Prisma ORM
3. Create database schema
4. Write migration script to copy existing metafield data
5. Run migration in dev environment
6. Test all CRUD operations
7. Deploy to production with zero-downtime migration

**Testing:**
- Test all schedule CRUD operations with database
- Verify audit logs capture create/update/delete
- Test migration script with production metafield data
- Performance testing: database vs metafield queries
- Rollback testing (verify metafield backup works)

**Audit Logging Example:**
```javascript
// Every action automatically logged:
{
  entity_type: 'schedule',
  entity_id: 'abc-123',
  action: 'created',
  user_id: 'admin@store.myshopify.com',
  changes: {
    name: 'Black Friday Sale',
    start_time: '2026-11-29T00:00:00Z',
    action: 'show'
  },
  timestamp: '2026-04-12T10:30:00Z'
}
```

**Benefits:**
- ✅ Unlimited execution history (no more 100-log limit)
- ✅ Full audit trail (compliance-ready for clients)
- ✅ User attribution (know who created/modified what)
- ✅ Production-ready architecture
- ✅ No metafield size limits (65KB)
- ✅ Better query performance for analytics
- ✅ Foundation for Phases 1-4

**Hosting Cost:** $7-9/month (Render/Railway/Heroku Postgres)

---

### Phase 1: Customer Segmentation - Tag-Based (2-3 weeks)

**Goal:** Allow merchants to show/hide scheduled sections based on customer tags.

**Use Cases:**
- Premium customers see exclusive hero banners
- VIP customers get early access to launches
- Wholesale customers see B2B content

**Technical Approach:**
- Start simple: Shopify customer tags only (`premium`, `vip`, `wholesale`)
- Theme app extension with Liquid conditionals
- No advanced metafields or segments API (future phases)
- Store customer tag rules in database (from Phase 0)

**Benefits from Phase 0 Database:**
- Customer tags stored in `schedules.customer_tags` JSONB column
- Fast queries for schedules targeting specific customer segments
- Audit trail of who added segmentation rules

**Files to Modify:**
- `web/frontend/components/ScheduleForm.jsx` - Add tag selector UI
- `web/backend/services/database.js` - Add customer_tags field to queries
- `extensions/theme-app-extension/` - NEW: Create Liquid conditional rendering
- `web/backend/__tests__/customer-segmentation.test.js` - Add tag filtering tests

**Testing:**
- Create schedules with tag rules in dev store
- Test with tagged customers
- Verify conditional rendering works
- Edge cases: no tags, multiple tags, tag removal
- Verify audit logs capture segmentation changes

---

### Phase 2: Shopify Sidekick Integration (3-4 weeks)

**Goal:** Expose scheduling through Shopify's AI assistant for natural language control.

**Merchant Experience:**
- "Show me all active schedules"
- "What sections are scheduled for this week?"
- "Create a banner schedule for Black Friday"

**Technical Approach:**
- Build Sidekick app extension
- Expose GraphQL schema for schedule queries
- Start with read-only (safer for early API adoption)
- Add mutations later if API stable

**Benefits from Phase 0 Database:**
- Fast complex queries for Sidekick search ("schedules created this week")
- Audit logs track Sidekick-initiated actions
- Better performance for natural language queries

**Guardrails for Early Adoption:**
- Feature flag to enable/disable without redeploying
- Read-only queries first (less risky)
- Comprehensive error logging
- Graceful degradation if API fails
- Fallback to traditional admin UI

**Files to Create:**
- `extensions/sidekick-extension/` - Extension configuration
- `web/backend/routes/graphql.js` - GraphQL schema for Sidekick
- `web/backend/services/sidekick-handlers.js` - Command handlers

**Testing:**
- Install extension in dev store
- Test natural language queries
- Verify error handling
- Document API limitations encountered
- Verify Sidekick actions appear in audit logs

---

### Phase 3: Schedule Analytics (2-3 weeks)

**Goal:** Show merchants the business impact of scheduled content.

**Metrics:**
- Views per scheduled section (before/during/after)
- Click-through rates
- Conversion rate changes
- Simple correlation (not complex attribution)

**Technical Approach:**
- Event tracking via theme app extension JavaScript
- Integrate Shopify Analytics API
- Build dashboard in admin UI
- Start simple: before/after comparisons

**REQUIRES Phase 0 Database:**
- Analytics data stored in new `analytics_events` table
- Unlimited event history (not possible with metafields)
- Fast aggregation queries for dashboard
- Time-series analysis for before/during/after metrics

**New Database Tables:**
```sql
analytics_events (
  id UUID PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id),
  event_type VARCHAR(50),  -- 'view', 'click', 'conversion'
  customer_id VARCHAR(255),
  session_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
)
```

**Files to Create:**
- `extensions/theme-app-extension/` - Add event tracking
- `web/frontend/components/AnalyticsDashboard.jsx` - Dashboard UI
- `web/backend/services/analytics.js` - Analytics API integration
- `web/backend/prisma/migrations/add_analytics.sql` - Analytics tables

**Testing:**
- Create tracked schedule
- Generate test traffic
- Verify metrics accuracy
- Test report generation
- Performance test: query 10K+ events

---

### Phase 4: Schedule Templates (1 week)

**Goal:** Pre-built schedule configurations for common use cases.

**Templates:**
- Weekend Sale Banner (Fri 6pm - Sun 11pm)
- Flash Sale - 24 Hours
- Weekly Product Spotlight (Every Monday 9am)
- Holiday Countdown (7 days before holidays)

**Technical Approach:**
- Template library JSON file
- "Use Template" button in schedule form
- Pre-populate form with template values

**Files to Create:**
- `web/frontend/components/TemplateLibrary.jsx` - Template selector
- `web/backend/data/schedule-templates.json` - Template definitions
- `web/frontend/components/ScheduleForm.jsx` - Add template functionality

**Testing:**
- Verify template population
- Test customization workflow
- Test with recurring + one-time schedules

---

## 🎯 Success Metrics

### Competitive Differentiation
- ✅ Only non-Plus app with customer segmentation
- ✅ First scheduling app with Sidekick integration
- ✅ Only app combining scheduling + segmentation + analytics

### Market Positioning
**"Schedule + Segment + Measure"** - Fill the gap no competitor addresses

---

## 🔮 Future Consideration (Tier 3)

**If Tier 1 + 2 successful:**
- Multi-schedule campaigns (coordinate multiple schedules)
- Schedule preview mode (see before it goes live)
- Notification system (email/Slack alerts)

**Decision Point:** Re-evaluate after launch and merchant feedback

---

## 🛠️ Technical Notes

### Reusable Code
- `web/backend/services/metafield-storage.js` - Extend for new fields
- `web/backend/services/shopify-api.js` - Use for Customer API queries
- `web/frontend/hooks/useTimezone.js` - Reuse for analytics timestamps
- Testing infrastructure already configured (Vitest workspace)

### Architecture Decisions
- **Customer Segmentation:** Theme app extension (better performance than app proxy)
- **Sidekick:** Feature flag for risk mitigation
- **Analytics:** Simple correlation, avoid complex attribution
- **Storage:** Continue using metafields (no new infrastructure needed)

### Risk Mitigation
- Sidekick API is new (2025) - start read-only, log errors extensively
- Customer segmentation - default to "show all" if evaluation fails
- Analytics - clearly label as correlation not causation

---

## 📚 Research Summary

**Competitor Apps Analyzed:**
- Maestro Theme Scheduler - Basic scheduling
- Novo Block Campaign Scheduler - Campaign windows
- **Simple Section Rules Scheduler** - ONLY app with customer segmentation
- Timely Theme Scheduler - CRO impact tracking
- Launchpad (Shopify Plus) - Enterprise features

**Key Finding:** No app combines scheduling + customer segmentation + analytics

---

## 🚀 Next Session Action

**Start Phase 0: Database Foundation** 

1. Create feature branch: `claude/database-foundation-01AMsumUVBvqtWjwFvicurZM`
2. Set up PostgreSQL database (Heroku/Render/Railway)
3. Install and configure Prisma ORM
4. Create database schema (schedules, execution_logs, audit_logs, backups)
5. Write migration script from metafields to database
6. Update `MetafieldStorage` service to use database instead
7. Add audit logging service
8. Write comprehensive tests for database operations
9. Test migration with existing metafield data
10. Deploy to dev environment and verify

**Estimated:** 1-2 weeks to complete Phase 0

**After Phase 0:** Move to Phase 1 (Customer Segmentation) with database foundation ready

---

**For detailed technical analysis, see:** `/root/.claude/plans/fancy-puzzling-yao.md`
