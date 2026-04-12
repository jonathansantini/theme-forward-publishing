# Section Scheduler - Feature Roadmap

**Status:** Approved - Ready for Development  
**Last Updated:** 2026-04-12  
**Estimated Timeline:** 8-11 weeks for Tier 1 + 2

---

## 🎯 Approved Scope

Building **Tier 1 + Tier 2 features** to position as the only Shopify scheduling app with:
- ✅ Time-based scheduling (already built)
- ✅ Customer segmentation (new - competitive gap)
- ✅ Performance analytics (new - differentiator)
- ✅ AI-native Sidekick integration (new - first mover)

**Strategic Positioning:** "Schedule + Segment + Measure"

---

## 📅 Implementation Phases

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

**Files to Modify:**
- `web/frontend/components/ScheduleForm.jsx` - Add tag selector UI
- `web/backend/services/metafield-storage.js` - Extend schema with `customerTags: []`
- `extensions/theme-app-extension/` - NEW: Create Liquid conditional rendering
- `web/backend/__tests__/metafield-storage.test.js` - Add tag storage tests

**Testing:**
- Create schedules with tag rules in dev store
- Test with tagged customers
- Verify conditional rendering works
- Edge cases: no tags, multiple tags, tag removal

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

**Files to Create:**
- `extensions/theme-app-extension/` - Add event tracking
- `web/frontend/components/AnalyticsDashboard.jsx` - Dashboard UI
- `web/backend/services/analytics.js` - Analytics API integration
- `web/backend/services/metafield-storage.js` - Store analytics data

**Testing:**
- Create tracked schedule
- Generate test traffic
- Verify metrics accuracy
- Test report generation

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

**Start Phase 1: Customer Segmentation**

1. Create feature branch: `claude/customer-segmentation-01AMsumUVBvqtWjwFvicurZM`
2. Extend metafield schema with `customerTags` field
3. Build tag selector UI in ScheduleForm
4. Create theme app extension scaffolding
5. Implement Liquid conditionals for tag-based rendering
6. Write tests for tag storage and retrieval
7. Test in dev store with tagged customers

**Estimated:** 2-3 weeks to complete Phase 1

---

**For detailed technical analysis, see:** `/root/.claude/plans/fancy-puzzling-yao.md`
