# 📊 Complete Enrichment to Export Workflow

## 🎯 Current System Overview

You have **TWO SEPARATE WORKFLOWS** in QuartzIQ:

### 1️⃣ **Lead Enrichment Workflow** (Stage 1 - NEW)
**Purpose:** Find executive contact information for qualified businesses
**Pages:** Lead Qualification (`/dashboard/leads`) → Enrichment (`/dashboard/enrichment`)
**Tables:** `businesses`, `enrichment_queue`, `contact_enrichments`

### 2️⃣ **Review Crawling Workflow** (Original Feature - LEGACY)
**Purpose:** Extract Google Maps reviews from businesses
**Pages:** Crawl Manager, Crawl Queue, Crawl History
**Tables:** `businesses`, `reviews`, `crawl_queue` (different table!)

---

## 🔄 Step-by-Step: Enrichment to Export Workflow

### **Step 1: Qualify Leads**
📍 Page: `/dashboard/leads`

1. VA manually enters businesses OR imports from Google Maps
2. VA adds qualifying reviews to each business
3. Business lifecycle: `prospect` → `lead`
4. VA clicks **"Import to Quartz"** button (📤 Send icon)
   - Sets `ready_for_enrichment = true`
   - Sets `lifecycle_stage = 'qualified'`
   - Adds business to `enrichment_queue` table

---

### **Step 2: Enrich Contacts** ✅ YOU ARE HERE
📍 Page: `/dashboard/enrichment`

1. Click **"Process Queue"** button
2. Select batch size (All, 10, 50, or 100)
3. System processes leads using 3-tier strategy:
   - **Tier 1:** Claude website research (FREE) ✅
   - **Tier 2:** Apify leads enrichment ($0.005) ⚠️ No APIFY_API_TOKEN yet
   - **Tier 3:** Apollo search + enrich ($0.02) ⚠️ No APOLLO_API_KEY yet

4. **Results stored in `contact_enrichments` table:**
   ```sql
   id, business_id, organization_id,
   email, phone, linkedin_url,
   owner_name, owner_linkedin,
   enrichment_source, confidence_score,
   enrichment_cost_usd, created_at
   ```

5. **Business record updated with contact info:**
   ```sql
   UPDATE businesses SET
     first_name = 'John',
     last_name = 'Doe',
     email = 'john@example.com',
     phone = '+1234567890',
     enrichment_status = 'completed'
   ```

---

### **Step 3: View Enriched Contacts** ⚠️ MISSING PAGE
📍 **NEEDED:** `/dashboard/contacts` or `/dashboard/enriched`

**Current Problem:** After enrichment completes, there's NO dedicated page to:
- View all enriched contacts
- Filter by enrichment status
- Select contacts for export
- Review enrichment quality

**Current Workaround:**
- Enriched contacts appear in `/dashboard/enrichment` page
- Contact data is stored in `contact_enrichments` table
- Business data updated with contact info

---

### **Step 4: Export to Quartz/GHL** ⚠️ NOT CONNECTED YET
📍 **EXISTS:** `/api/quartz-leads/send-contacts` (API endpoint)
📍 **MISSING:** UI to trigger export

**What Exists:**
```typescript
// API endpoint ready: /api/quartz-leads/send-contacts
POST /api/quartz-leads/send-contacts
{
  "contacts": [
    {
      "name": "Business Name",
      "address": "123 Main St",
      "phone": "+1234567890",
      "email": "contact@example.com",
      "website": "https://example.com",
      "source": "QuartzIQ-Enrichment"
    }
  ],
  "clientId": "default" // or specific client
}
```

**What's Missing:**
1. UI button/page to trigger export
2. Select contacts to export (checkboxes)
3. Preview export payload
4. Confirm before sending
5. View export history/logs

---

## 🤔 What Are the "Crawl" Pages For?

### These are LEGACY features for review extraction (not enrichment):

#### **Crawl Manager** (`/dashboard/crawl-manager`)
- **Purpose:** Manage businesses that need review crawling
- **Use case:** Schedule when to re-crawl reviews from Google Maps
- **NOT USED FOR:** Contact enrichment

#### **Crawl Queue** (`/dashboard/crawl-queue`)
- **Purpose:** View queued review extraction jobs
- **Use case:** See what businesses are waiting to have reviews extracted
- **NOT USED FOR:** Contact enrichment queue (that's `/dashboard/enrichment`)

#### **Crawl History** (`/dashboard/crawl-history`)
- **Purpose:** View history of review extractions
- **Use case:** See when reviews were last crawled and how many found
- **NOT USED FOR:** Contact enrichment history

**These pages are confusing because:**
- They use similar concepts (queue, processing, history)
- But they operate on a different workflow (reviews vs contacts)
- Should be renamed/reorganized to avoid confusion

---

## 🎯 Recommended Next Steps

### **Option A: Quick Export (Minimal UI)**
Create a simple export button in `/dashboard/enrichment`:

```
┌─────────────────────────────────────────┐
│  Contact Enrichment Page                │
├─────────────────────────────────────────┤
│  [Process Queue] [Export to Quartz] ← NEW
│                                         │
│  ☑ Business 1 (john@example.com)       │
│  ☑ Business 2 (jane@example.com)       │
│  ☐ Business 3 (pending enrichment)     │
└─────────────────────────────────────────┘
```

**Implementation:**
1. Add checkboxes to enrichment table
2. Add "Export Selected" button
3. Opens confirmation dialog showing:
   - Number of contacts to export
   - Preview of data being sent
   - Which GHL location they'll go to
4. Calls `/api/quartz-leads/send-contacts`
5. Shows success/error results

---

### **Option B: Dedicated Contacts Page (Recommended)**
Create `/dashboard/contacts` page for better organization:

```
┌─────────────────────────────────────────┐
│  📇 Enriched Contacts                   │
├─────────────────────────────────────────┤
│  Stats:                                  │
│  ✅ 47 Enriched   ⏳ 12 Pending         │
│  💰 $0.31 Total Cost                    │
├─────────────────────────────────────────┤
│  Filters:                                │
│  [All] [Exported] [Not Exported]        │
│  [Claude] [Apify] [Apollo]              │
├─────────────────────────────────────────┤
│  [Select All] [Export Selected (25)] ← ACTION
│                                         │
│  ☑ Dental Clinic Amsterdam              │
│     john@dental.com | +31-123-4567      │
│     Enriched: Claude (FREE)             │
│     Exported: ❌ Not yet                │
│                                         │
│  ☑ Hair Salon Rotterdam                 │
│     jane@salon.nl | +31-987-6543        │
│     Enriched: Apify ($0.005)            │
│     Exported: ✅ Yes (2024-01-15)       │
└─────────────────────────────────────────┘
```

**Features:**
- Filter by enrichment status (pending/completed)
- Filter by enrichment method (Claude/Apify/Apollo)
- Filter by export status (exported/not exported)
- Select multiple contacts
- Preview export data
- Track export history
- Re-export if needed

---

### **Option C: Combined Workflow (Ideal)**
Merge enrichment + export into one flow:

```
Lead Qualification → Enrichment → Contacts → Export
   /dashboard/leads     (auto)    /dashboard/contacts
```

**Benefits:**
- Clear linear workflow
- No confusion about where to go next
- All enriched data in one place
- Export is the final action

---

## 🗺️ Navigation Cleanup Suggestions

### **Current Navigation (Confusing):**
```
Dashboard
├─ Lead Qualification  (Stage 1)
├─ Enrichment          (Stage 1 processing)
├─ Crawl Manager       (Review extraction - legacy)
├─ Crawl Queue         (Review extraction - legacy)
├─ Crawl History       (Review extraction - legacy)
├─ Crawl Targets       (Review extraction - legacy)
└─ Qualified Reviews   (Review extraction - legacy)
```

### **Recommended Navigation (Clear):**
```
Dashboard
│
├─ 📊 Lead Management
│  ├─ Lead Qualification      (Stage 1: Add & qualify)
│  ├─ Contact Enrichment      (Stage 1: Auto-enrich)
│  └─ Enriched Contacts ← NEW (Stage 1: View & export)
│
└─ 📝 Review Extraction (Legacy)
   ├─ Review Manager          (renamed from Crawl Manager)
   ├─ Review Queue            (renamed from Crawl Queue)
   ├─ Review History          (renamed from Crawl History)
   └─ Qualified Reviews
```

**Benefits:**
- Groups related features together
- Makes Stage 1 workflow obvious
- Separates legacy features
- Clear naming (Review vs Crawl)

---

## 📋 What to Build Next

Based on your needs, here's my recommendation:

### **Phase 1: Export Functionality (1-2 hours)**
1. Add checkboxes to enrichment table ✅
2. Add "Export Selected to Quartz" button ✅
3. Create export confirmation dialog:
   - Show contact count
   - Preview first 3 contacts
   - Display target GHL location
   - Estimated export time
4. Call existing `/api/quartz-leads/send-contacts` endpoint
5. Show success/error toast notifications
6. Update business records with `exported_to_ghl = true` field

### **Phase 2: Contacts Page (2-3 hours)**
1. Create `/dashboard/contacts` page
2. Fetch from `contact_enrichments` table
3. Display enriched contacts with filters
4. Track export status
5. Allow re-export if needed

### **Phase 3: Navigation Cleanup (1 hour)**
1. Rename "Crawl" pages to "Review" pages
2. Group navigation into sections
3. Add breadcrumbs for clarity

---

## 🔧 Environment Setup Needed

Before full testing, you need:

```env
# .env.local

# Required for Apollo enrichment (Tier 3)
APOLLO_API_KEY=your_apollo_api_key_here
APOLLO_MONTHLY_LIMIT=100

# Required for Apify enrichment (Tier 2)
APIFY_API_TOKEN=your_apify_api_token_here

# Required for GHL/Quartz export
# (Already configured via client-config)
# See: src/lib/client-config.ts

# Optional - Free enrichment (Tier 1)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 💡 Quick Win: Test Without API Keys

You can test the export workflow WITHOUT API keys:

1. **Manually insert test data:**
   ```sql
   INSERT INTO contact_enrichments (
     business_id,
     email,
     phone,
     owner_name,
     enrichment_source,
     confidence_score
   ) VALUES (
     'some-business-id',
     'test@example.com',
     '+31-123-4567',
     'Test Contact',
     'manual',
     0.95
   );
   ```

2. **Build export UI** pointing to your test data
3. **Test GHL export** with test contacts
4. **Then add API keys** for real enrichment

---

## 📞 Summary

**Where You Are:**
- ✅ Enrichment API built and working (no API keys yet)
- ✅ Data saved to `contact_enrichments` table
- ✅ Export API exists (`/api/quartz-leads/send-contacts`)

**What's Missing:**
- ❌ UI to view enriched contacts
- ❌ UI to select and export contacts
- ❌ Export status tracking
- ❌ Clear navigation/workflow

**Next Steps:**
1. Add APOLLO_API_KEY to test full enrichment
2. Build export button in enrichment page
3. Test export to GHL/Quartz
4. (Optional) Create dedicated Contacts page
5. (Optional) Clean up navigation

**Should we proceed with Phase 1 (Export functionality)?**
