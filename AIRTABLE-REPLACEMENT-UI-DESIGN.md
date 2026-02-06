# QuartzIQ UI Design - Airtable Replacement

## 🎯 Requirements

### Current Airtable Workflow

**Stage 1: Lead Qualification (VA Entry)**
- VA manually enters company information
- VA identifies reviews that qualify for removal
- VA adds entries to Airtable list

**Stage 2: Contact Enrichment (Enrichment Specialist)**
- Different person views qualified leads
- Manually enriches with phone/email
- Or: AI auto-enrichment (coming)
- Still needs ability to manually add/edit

### New Requirements
- ✅ 2-stage workflow preserved
- ✅ Manual entry capability maintained
- ✅ AI enrichment integration
- ✅ Ability to verify/fix AI results
- ✅ No Airtable record/API limits
- ✅ Better search and filtering

---

## 🏗️ Application Structure

### URL Structure

```
/                           → Dashboard (overview stats)
/leads/qualification        → Stage 1: VA Entry
/leads/enrichment          → Stage 2: Enrichment
/customers                 → Paying customers (monitoring)
/alerts                    → Negative review alerts
/settings                  → System configuration
```

### Database Lifecycle Mapping

```
Airtable Stage → QuartzIQ Lifecycle Stage
─────────────────────────────────────────
[Not in Airtable] → prospect (scraped, not qualified)
Stage 1 Entry → lead (manually entered, needs enrichment)
Stage 2 Enriched → qualified (enriched, ready for outreach)
Paid → customer (paying for review removal)
```

---

## 📱 Page-by-Page Design

### 1. Dashboard (Home)

**Purpose:** Quick overview of pipeline status

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  QuartzIQ - Review Removal Pipeline                      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  📊 Pipeline Overview                                     │
│  ┌─────────────┬─────────────┬─────────────┬──────────┐ │
│  │  Prospects  │   Leads     │  Qualified  │Customers │ │
│  │    1,243    │     87      │     45      │    32    │ │
│  │   (Auto)    │  (Stage 1)  │  (Stage 2)  │ (Paying) │ │
│  └─────────────┴─────────────┴─────────────┴──────────┘ │
│                                                            │
│  🔔 Recent Alerts (Last 24h)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔴 Critical: 3 new 1-star reviews                  │  │
│  │ 🟠 High: 5 new 2-star reviews                      │  │
│  │ 🟡 Medium: 8 new 3-star reviews                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  📈 Today's Activity                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ • 12 businesses scraped                             │  │
│  │ • 5 leads qualified by VA                           │  │
│  │ • 8 contacts enriched                               │  │
│  │ • $0.45 spent on scraping                           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  🚀 Quick Actions                                         │
│  [+ Add Business Manually] [Run Monitoring] [View Alerts]│
└──────────────────────────────────────────────────────────┘
```

---

### 2. Stage 1: Lead Qualification (`/leads/qualification`)

**Purpose:** VA manually enters businesses and identifies qualifying reviews

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Stage 1: Lead Qualification (VA Entry)                  │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  [+ Add New Business]  [Bulk Import]  [Search...]        │
│                                                            │
│  Filters: [All] [Today] [This Week]  Sort: [Newest]      │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Business Name                    | Reviews | Actions│  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🍕 Luigi's Pizzeria             │    3    │ [Edit] │  │
│  │    📍 Amsterdam, Netherlands     │ ⭐ 2.3  │ [→ Stage 2]│
│  │    Last updated: 2 hours ago     │         │ [Delete]│
│  │                                  │         │        │  │
│  │ 🏨 Grand Hotel Europe            │    5    │ [Edit] │  │
│  │    📍 Rotterdam, Netherlands     │ ⭐ 1.8  │ [→ Stage 2]│
│  │    Last updated: Today 10:23     │         │ [Delete]│
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Showing 15 of 87 leads • Page 1 of 6                    │
└──────────────────────────────────────────────────────────┘
```

**Add/Edit Business Form:**
```
┌──────────────────────────────────────────────────────────┐
│  Add New Business                                    [X]  │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Business Information                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Business Name *                                    │  │
│  │ [                                          ]       │  │
│  │                                                    │  │
│  │ Google Maps URL or Place ID                       │  │
│  │ [                                          ]       │  │
│  │ [Auto-Fill from Google Maps]                      │  │
│  │                                                    │  │
│  │ Category           | Location                     │  │
│  │ [Restaurant     ▼] | [Amsterdam          ]       │  │
│  │                                                    │  │
│  │ Address                                           │  │
│  │ [                                          ]       │  │
│  │                                                    │  │
│  │ Phone              | Website                      │  │
│  │ [              ]   | [                    ]       │  │
│  │                                                    │  │
│  │ Rating    | Total Reviews                         │  │
│  │ [2.3  ]   | [45          ]                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Qualifying Reviews                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [+ Add Review]                                     │  │
│  │                                                    │  │
│  │ Review #1                              [Remove]   │  │
│  │ Rating: [2 ⭐]  Date: [2024-01-15]               │  │
│  │ Review Text:                                       │  │
│  │ [Food was cold, service terrible...]              │  │
│  │                                                    │  │
│  │ Review URL (optional):                            │  │
│  │ [https://maps.google.com/...]                     │  │
│  │                                                    │  │
│  │ ─────────────────────────────────────────────────│  │
│  │                                                    │  │
│  │ Review #2                              [Remove]   │  │
│  │ Rating: [1 ⭐]  Date: [2024-01-18]               │  │
│  │ Review Text:                                       │  │
│  │ [Worst experience ever...]                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Notes (Internal)                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [                                          ]       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  [Cancel]                          [Save as Lead]         │
└──────────────────────────────────────────────────────────┘
```

---

### 3. Stage 2: Contact Enrichment (`/leads/enrichment`)

**Purpose:** Enrich contacts (AI or manual) before outreach

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Stage 2: Contact Enrichment                              │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  [🤖 Auto-Enrich Selected] [Search...]                   │
│                                                            │
│  Filters: [Needs Enrichment] [Enriched] [All]            │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ☐ Business Name            | Status    | Actions   │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ ☐ 🍕 Luigi's Pizzeria      │ 🟡 Partial│ [Enrich]│  │
│  │      📍 Amsterdam           │ 📧 ✓ 📞 ✗│ [Edit]  │  │
│  │      Email: luigi@...      │          │ [→ Ready]│
│  │      Phone: Missing        │          │         │  │
│  │                            │          │         │  │
│  │ ☐ 🏨 Grand Hotel Europe    │ 🔴 None  │ [Enrich]│  │
│  │      📍 Rotterdam           │ 📧 ✗ 📞 ✗│ [Edit]  │  │
│  │      Email: -              │          │ [→ Ready]│
│  │      Phone: -              │          │         │  │
│  │                            │          │         │  │
│  │ ☐ 🍔 Burger Joint NL       │ 🟢 Full  │ [Edit]  │  │
│  │      📍 Utrecht            │ 📧 ✓ 📞 ✓│ [→ Ready]│
│  │      Email: contact@...    │ AI ✓     │         │  │
│  │      Phone: +31 20...      │          │         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ☐ Select All (3)  [🤖 Auto-Enrich All] [Move to Qualified]│
└──────────────────────────────────────────────────────────┘
```

**Enrichment Form (Manual or Edit AI Results):**
```
┌──────────────────────────────────────────────────────────┐
│  Enrich Contact: Luigi's Pizzeria                    [X]  │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  🤖 AI Enrichment Available                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Auto-Enrich with Apollo] ($0.40/contact)         │  │
│  │ [Auto-Enrich with Apify] ($0.005/contact)         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ─── OR Enter Manually ────────────────────────────────  │
│                                                            │
│  Contact Information                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Owner Name                                         │  │
│  │ [Luigi Rossi                              ]        │  │
│  │                                                    │  │
│  │ Email *                                           │  │
│  │ [luigi@luigispizza.nl                     ]        │  │
│  │ Source: [Manual ▼]  Confidence: [High ▼]         │  │
│  │                                                    │  │
│  │ Phone                                             │  │
│  │ [+31 20 123 4567                          ]        │  │
│  │                                                    │  │
│  │ Position/Title                                    │  │
│  │ [Owner                                    ]        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Social Media (Optional)                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ LinkedIn: [                                ]       │  │
│  │ Facebook: [                                ]       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Enrichment Notes                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Found email on website contact page]             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  AI Enrichment Results (if used)                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Provider: Apollo.io                                │  │
│  │ Cost: $0.40                                        │  │
│  │ Confidence: 85% (Medium)                           │  │
│  │ Date: 2024-01-20 14:32                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  [Cancel]  [Save as Qualified Lead]  [Save & Move to Ready]│
└──────────────────────────────────────────────────────────┘
```

---

### 4. Customers Page (`/customers`)

**Purpose:** View paying customers and monitoring status

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Customers (Paying)                                       │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  [+ Add Customer] [Import from Qualified] [Search...]    │
│                                                            │
│  Filters: [All] [Monitoring On] [Monitoring Off]         │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Business Name           | Monitoring | Last Check │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🍕 Luigi's Pizzeria     │ 🟢 ON      │ 2h ago    │  │
│  │    📧 luigi@...         │ Every 24h  │ No alerts │  │
│  │    📞 +31 20...         │ Threshold: 3★│ [View]  │  │
│  │    Tier: Basic          │            │ [Edit]    │  │
│  │    Since: Jan 15, 2024  │            │ [Turn Off]│
│  │                         │            │           │  │
│  │ 🏨 Grand Hotel Europe   │ 🔴 OFF     │ Never     │  │
│  │    📧 info@...          │ -          │ -         │  │
│  │    📞 +31 10...         │            │ [View]    │  │
│  │    Tier: Premium        │            │ [Edit]    │  │
│  │    Since: Dec 1, 2024   │            │ [Turn On] │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Showing 32 customers • Total MRR: $1,280                │
└──────────────────────────────────────────────────────────┘
```

---

### 5. Alerts Page (`/alerts`)

**Purpose:** View and manage negative review alerts

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Review Alerts                                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Filters: [Unacknowledged] [All] [Critical] [High]       │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL - Luigi's Pizzeria                     │  │
│  │    ⭐ 1-star review detected 2 hours ago            │  │
│  │    "Worst food I ever had. Disgusting service..."  │  │
│  │    Reviewer: John D. (15 reviews)                  │  │
│  │    [View Full Review] [Contact Customer] [Acknowledge]│
│  │                                                     │  │
│  │ 🟠 HIGH - Grand Hotel Europe                       │  │
│  │    ⭐⭐ 2-star review detected 5 hours ago          │  │
│  │    "Dirty rooms, staff unhelpful..."               │  │
│  │    Reviewer: Sarah M. (43 reviews, Local Guide)   │  │
│  │    [View Full Review] [Contact Customer] [Acknowledge]│
│  │                                                     │  │
│  │ ✅ ACKNOWLEDGED - Burger Joint NL                  │  │
│  │    ⭐⭐⭐ 3-star review (Yesterday)                  │  │
│  │    Action: Removal requested                        │  │
│  │    By: enrichment@team.com                         │  │
│  │    [View Details]                                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  16 unacknowledged alerts                                │
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System

### Color Scheme
- **Primary:** Blue (#3B82F6) - Actions, links
- **Success:** Green (#10B981) - Completed, success states
- **Warning:** Orange (#F59E0B) - Needs attention
- **Danger:** Red (#EF4444) - Critical alerts
- **Neutral:** Gray (#6B7280) - Text, borders

### Lifecycle Stage Colors
- **Prospect:** Gray (#9CA3AF)
- **Lead:** Blue (#3B82F6)
- **Qualified:** Green (#10B981)
- **Customer:** Purple (#8B5CF6)
- **Churned:** Red (#EF4444)

### Status Badges
```
🟢 Complete   - All info present
🟡 Partial    - Some info missing
🔴 None       - No enrichment
⚪ Pending    - AI enrichment running
```

---

## 🔄 Workflow Transitions

```
Prospect (Auto-scraped)
    ↓
    VA manually reviews and adds qualifying reviews
    ↓
Lead (Stage 1 Complete)
    ↓
    Enrichment specialist adds contacts (AI or manual)
    ↓
Qualified (Stage 2 Complete)
    ↓
    Business pays for review removal
    ↓
Customer (Paying)
    ↓
    Auto-monitoring enabled
    ↓
    Alerts generated on new negative reviews
```

---

## 🚀 Key Features

### For VA (Stage 1)
- ✅ Quick business entry form
- ✅ Auto-fill from Google Maps URL
- ✅ Add multiple qualifying reviews
- ✅ Search existing leads
- ✅ Bulk import capability

### For Enrichment Specialist (Stage 2)
- ✅ View all leads needing enrichment
- ✅ One-click AI enrichment (Apollo or Apify)
- ✅ Manual entry option
- ✅ Edit AI results
- ✅ Verify and mark as qualified
- ✅ Batch enrichment

### For Everyone
- ✅ Dashboard with pipeline overview
- ✅ Search across all businesses
- ✅ Export to CSV/Excel
- ✅ Audit trail (who did what, when)
- ✅ Keyboard shortcuts
- ✅ Mobile responsive

---

## 💻 Tech Stack

### Frontend
- **Next.js 15** - App Router
- **ShadCN UI** - Component library
- **TanStack Table** - Data tables
- **React Hook Form** - Forms
- **Zod** - Validation

### Backend
- **Next.js API Routes** - Backend
- **PostgreSQL** - Database (existing)
- **Server Actions** - Form submissions

### UI Components Needed
1. `<DataTable>` - Business listings
2. `<BusinessForm>` - Add/edit business
3. `<EnrichmentForm>` - Contact enrichment
4. `<StatusBadge>` - Lifecycle stages
5. `<AlertCard>` - Review alerts
6. `<StageTransition>` - Move between stages

---

## 📱 Mobile Considerations

### Responsive Breakpoints
- **Desktop:** 1024px+ (full features)
- **Tablet:** 768-1023px (adapted layout)
- **Mobile:** <768px (simplified, priority features)

### Mobile Priority Features
- View leads/customers
- Quick status updates
- Acknowledge alerts
- Search
- (Full forms remain desktop-only)

---

## 🔐 Access Control

### User Roles
1. **VA** - Can add leads (Stage 1 only)
2. **Enrichment Specialist** - Can enrich (Stage 2 only)
3. **Admin** - Full access
4. **Read-Only** - View only

### Permissions Matrix
| Action | VA | Enrichment | Admin |
|--------|----|-----------:|-------|
| Add Lead | ✅ | ❌ | ✅ |
| Enrich Contact | ❌ | ✅ | ✅ |
| Move to Customer | ❌ | ❌ | ✅ |
| Delete | ❌ | ❌ | ✅ |
| View All | ✅ | ✅ | ✅ |

---

## ⏭️ Next Steps

1. **Build UI Components** (2-3 days)
   - Stage 1: Lead qualification page
   - Stage 2: Enrichment page
   - Customers page
   - Alerts page

2. **API Integration** (1 day)
   - Connect to existing customer-monitoring service
   - Add lifecycle transition endpoints
   - Add bulk operations

3. **Testing** (1 day)
   - Test with real data
   - User acceptance testing with VA and enrichment team
   - Performance testing

4. **Deployment** (See DEPLOYMENT-ANALYSIS.md)

**Total estimate: 5-6 days for full Airtable replacement**
