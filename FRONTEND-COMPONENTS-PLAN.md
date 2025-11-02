# Frontend Components Plan - Business Review Crawl Management System

## 📋 Overview

We're building **3 main dashboard views** that give you complete control over crawling your 5,216 cached businesses for reviews.

---

## 🎯 User Journey

```
Your Scenario:
├─ You have 5,216 businesses in cache
├─ You want to crawl 2,000 now, 2,000 later
└─ Re-crawl after 14 days to get new reviews

Our Solution:
1. Business Crawl Manager → Select which businesses to crawl
2. Crawl Queue View → Monitor active crawls
3. Crawl History Timeline → Track all past crawls
```

---

## 1️⃣ Business Crawl Manager (Main Dashboard)

### Purpose
**Your central command center** for selecting and queuing businesses for review extraction.

### Route
`/dashboard/crawl-manager`

### What You'll See

```
┌─────────────────────────────────────────────────────────────────┐
│ Business Review Crawl Manager                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📊 Quick Stats Cards (Top)                                      │
│  ┌──────────┬──────────┬──────────┬──────────┐                  │
│  │ 5,216    │ 5,186    │ 0        │ 0        │                  │
│  │ Total    │ Never    │ Due for  │ In       │                  │
│  │ Cached   │ Crawled  │ Re-crawl │ Queue    │                  │
│  └──────────┴──────────┴──────────┴──────────┘                  │
│                                                                   │
│  🔍 Smart Filters (Sidebar)                                      │
│  ┌─────────────────────────┐                                     │
│  │ □ Never Crawled (5,186) │  ← Default selection               │
│  │ □ Due (>14 days)        │                                     │
│  │ □ Overdue (>30 days)    │                                     │
│  │ □ Recent (<7 days)      │                                     │
│  │                         │                                     │
│  │ Category:               │                                     │
│  │ [Dropdown: All     ▼]   │                                     │
│  │                         │                                     │
│  │ City:                   │                                     │
│  │ [Dropdown: All     ▼]   │                                     │
│  │                         │                                     │
│  │ Rating Range:           │                                     │
│  │ [1★] ─────■───── [5★]   │                                     │
│  │                         │                                     │
│  │ [Apply Filters]         │                                     │
│  └─────────────────────────┘                                     │
│                                                                   │
│  📋 Business Table (Main Area)                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ☑ Select All (10 selected) │ Add to Queue │ Actions ▼  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ☑ │ Business Name         │ City   │ ★   │ Last Crawl │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ☑ │ Tandarts Amsterdam    │ A'dam  │ 4.2 │ Never      │   │
│  │ ☑ │ Fysio-Emmen Kamstra   │ Emmen  │ 4.5 │ Never      │   │
│  │ ☑ │ Kinemar               │ Klaz   │ 5.0 │ Never      │   │
│  │ ☑ │ Massage Emmen         │ Emmen  │ 4.9 │ Never      │   │
│  │ ...                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Showing 1-50 of 5,186 businesses [← Prev] [Next →]             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

#### A. Quick Stats Cards
```typescript
{
  totalBusinesses: 5216,
  neverCrawled: 5186,
  dueForRecrawl: 0,
  inQueue: 0
}
```
**What it does**: Shows overview of your business catalog at a glance

#### B. Smart Filter Presets
- **Never Crawled** → 5,186 businesses (perfect for initial crawl)
- **Due (>14 days)** → Businesses ready for re-crawl
- **Overdue (>30 days)** → Businesses needing urgent re-crawl
- **Recent (<7 days)** → Just crawled, no action needed

**What it does**: Quick access to common filtering scenarios

#### C. Advanced Filters
- **Category** → Filter by business type (tandarts, restaurant, etc.)
- **City** → Filter by location (Amsterdam, Rotterdam, etc.)
- **Rating Range** → Filter by Google rating (e.g., only <3★ for complaints)

**What it does**: Narrow down to specific businesses

#### D. Business Table
Columns:
- **Checkbox** → Select for batch queue
- **Business Name** → Click to view details
- **City** → Location
- **Rating** → Google rating (★)
- **Reviews Count** → Total reviews
- **Last Crawled** → "Never" / "14 days ago" / "2 weeks ago"
- **Next Recommended** → "Ready now" / "Oct 29, 2025"
- **Status** → Badge (Never, Due, Recent)
- **Actions** → View History, Priority Crawl

**What it does**:
- View all businesses with crawl status
- Select individual or bulk businesses
- Sort by any column

#### E. Batch Actions
- **Add to Queue** button (when businesses selected)
- Opens modal:
  ```
  ┌────────────────────────────────────────┐
  │ Add to Crawl Queue                     │
  ├────────────────────────────────────────┤
  │ Selected: 2,000 businesses             │
  │                                        │
  │ Batch Name:                            │
  │ [Amsterdam Tandarts - Oct 2025]        │
  │                                        │
  │ Reviews per Business: [2     ▼]        │
  │ Max Review Stars: [3         ▼]        │
  │ Days Back: [14               ▼]        │
  │                                        │
  │ Priority: [75                ─────■]   │
  │ Schedule: [○ Now  ○ Schedule for...]  │
  │                                        │
  │ Estimated Cost: $40.00                 │
  │ Estimated Time: 45 minutes             │
  │                                        │
  │ [Cancel] [Add to Queue]                │
  └────────────────────────────────────────┘
  ```

### User Workflow Example

**Scenario**: User wants to crawl first 2,000 businesses

```
Step 1: Open Business Crawl Manager
Step 2: Filter shows "Never Crawled (5,186)"
Step 3: Sort by "Rating" (lowest first to prioritize complaints)
Step 4: Click "Select All" → Shows "50 selected"
Step 5: Navigate pages, keep selecting until "2,000 selected"
Step 6: Click "Add to Queue"
Step 7: Configure:
        - Batch Name: "First 2K - High Priority"
        - Reviews per Business: 2
        - Max Stars: 3
        - Priority: 75
Step 8: See "Est. Cost: $40, Time: 45 min"
Step 9: Click "Add to Queue" → Success!
Step 10: Navigate to Crawl Queue View to monitor
```

---

## 2️⃣ Crawl Queue View (Active Monitoring)

### Purpose
**Monitor and control** your active crawl batches in real-time.

### Route
`/dashboard/crawl-queue`

### What You'll See

```
┌─────────────────────────────────────────────────────────────────┐
│ Active Crawl Queue                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📊 Queue Summary                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1 Active Batch │ 2,000 Queued │ 0 In Progress │ $40 Est.│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🔄 Active Batches                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ First 2K - High Priority                   [⋮ Actions]  │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Status: Queued                                          │    │
│  │ Progress: ████░░░░░░░░░░░░░░░░░░░░░ 0% (0/2,000)        │    │
│  │                                                         │    │
│  │ 💼 Businesses: 2,000                                    │    │
│  │ ⏱️  Queued: Oct 15, 2025 2:30 PM                        │    │
│  │ 💰 Cost: $0.00 / $40.00                                 │    │
│  │ 📊 Reviews: 0 extracted                                 │    │
│  │                                                         │    │
│  │ [▶ Start Crawl] [⏸ Pause] [🗑️ Cancel]                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  📋 Completed Batches (Last 5)                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ✅ Test Batch - API Verification                        │    │
│  │    5 businesses │ 10 reviews │ $0.10 │ Oct 15, 2:47 PM │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

#### A. Real-Time Progress
- **Progress Bar** → Visual representation (0-100%)
- **Counter** → "523/2,000 businesses completed"
- **Live Updates** → WebSocket or polling every 5 seconds
- **Status Badge** → Queued | In Progress | Completed | Failed

#### B. Batch Controls
- **▶ Start Crawl** → Begin extraction
- **⏸ Pause** → Pause mid-crawl (saves progress)
- **🗑️ Cancel** → Stop and remove from queue
- **📊 View Details** → Expand to see individual businesses

#### C. Cost Tracking
- **Real-time Cost** → "$18.50 / $40.00"
- **Cost Per Business** → "$0.02 avg"
- **Savings Display** → "75% saved with incremental" (if applicable)

#### D. Expanded Batch View
When you click "View Details":
```
┌────────────────────────────────────────────────────────┐
│ Batch: First 2K - High Priority                        │
├────────────────────────────────────────────────────────┤
│ Status: In Progress (523/2,000)                        │
│                                                        │
│ Recent Activity:                                       │
│ ✅ Tandarts Amsterdam → 2 reviews → $0.02             │
│ ✅ Fysio Kamstra → 1 review → $0.01                   │
│ ⚠️  Kinemar → Failed: API timeout → Retry queued      │
│ 🔄 Processing: Massage Emmen...                        │
│                                                        │
│ Performance:                                           │
│ • Speed: 3 businesses/minute                           │
│ • Success Rate: 99.5%                                  │
│ • Est. Time Remaining: 42 minutes                      │
└────────────────────────────────────────────────────────┘
```

### User Workflow Example

**Scenario**: User starts crawl and monitors progress

```
Step 1: Navigate to Crawl Queue View
Step 2: See "First 2K - High Priority" batch in "Queued" status
Step 3: Click "▶ Start Crawl"
Step 4: Watch progress bar fill up in real-time
Step 5: See live updates:
        - "52/2,000 completed"
        - "$1.04 / $40.00 spent"
        - "Est. 43 minutes remaining"
Step 6: Optionally pause/resume if needed
Step 7: Get notification when complete
Step 8: Review final stats:
        - 2,000 businesses crawled
        - 3,847 reviews extracted
        - $39.80 spent
        - 45 min duration
```

---

## 3️⃣ Crawl History Timeline (Analytics)

### Purpose
**Analyze and understand** your crawl history, costs, and patterns over time.

### Route
`/dashboard/crawl-history`

### What You'll See

```
┌─────────────────────────────────────────────────────────────────┐
│ Crawl History & Analytics                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📊 Overall Statistics                                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │ 2,030    │ 3,857    │ $39.90   │ 75.2%    │ 45 min   │       │
│  │ Total    │ Reviews  │ Total    │ Cache    │ Avg      │       │
│  │ Crawls   │ Found    │ Spent    │ Hit Rate │ Duration │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
│                                                                   │
│  📈 Timeline Visualization                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Crawls Over Time (Last 30 Days)                          │   │
│  │                                                           │   │
│  │    Reviews                                                │   │
│  │    4000│                                         ●        │   │
│  │    3000│                                                  │   │
│  │    2000│                                                  │   │
│  │    1000│  ●                                               │   │
│  │       0├─────────────────────────────────────────────────│   │
│  │        Oct 1    Oct 8    Oct 15   Oct 22   Oct 29       │   │
│  │                                                           │   │
│  │  Legend: ● Full Crawl  ◐ Incremental Crawl               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🔍 Detailed Crawl Log                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Date       │ Batch Name          │ Count │ Reviews │ $ │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ Oct 15 PM  │ First 2K - High Pri │ 2,000 │ 3,847   │40│   │
│  │ Oct 15 AM  │ Test Batch          │     5 │    10   │ 0│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  💡 Cost Insights                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Incremental crawls saved you $120 this month            │   │
│  │ • Average cost per business: $0.02                        │   │
│  │ • Projected monthly cost: $60 (if crawl 2x/month)         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

#### A. Historical Statistics
- **Total Crawls** → Count of all extraction sessions
- **Total Reviews** → Sum of all reviews extracted
- **Total Cost** → Cumulative Apify spending
- **Cache Hit Rate** → % of businesses from cache
- **Avg Duration** → Average time per crawl

#### B. Timeline Chart (D3.js)
- **X-axis** → Dates
- **Y-axis** → Reviews extracted
- **Dots** → Individual crawls
  - Full dot (●) = Full crawl
  - Half dot (◐) = Incremental crawl
- **Color coding** → Cost (green = low, red = high)
- **Interactive** → Hover for details, click to view batch

#### C. Per-Business Drill-Down
Click any business in the table to see:
```
┌────────────────────────────────────────────┐
│ Crawl History: Tandarts Amsterdam          │
├────────────────────────────────────────────┤
│ Total Crawls: 3                            │
│                                            │
│ 🔵 Oct 15, 2025 - Full Crawl              │
│    Reviews: 2 │ Cost: $0.02 │ New: 2      │
│                                            │
│ 🟢 Oct 1, 2025 - Incremental              │
│    Reviews: 1 │ Cost: $0.005 │ New: 1     │
│                                            │
│ 🔵 Sep 15, 2025 - Full Crawl              │
│    Reviews: 2 │ Cost: $0.02 │ New: 2      │
│                                            │
│ Next Recommended: Oct 29, 2025             │
└────────────────────────────────────────────┘
```

#### D. Cost Analysis
- **Incremental Savings** → "Saved $120 this month"
- **Cost Breakdown** → Chart showing full vs. incremental
- **Projections** → "At this rate, $60/month"

---

## 📦 Technical Stack

### Components We're Building

```
src/app/dashboard/
├── crawl-manager/
│   ├── page.tsx                        # Main page
│   └── components/
│       ├── business-table.tsx          # Table with selection
│       ├── stats-cards.tsx             # Quick stats
│       ├── filter-sidebar.tsx          # Smart filters
│       └── add-to-queue-modal.tsx      # Batch configuration
│
├── crawl-queue/
│   ├── page.tsx                        # Main page
│   └── components/
│       ├── queue-summary.tsx           # Overview cards
│       ├── active-batch-card.tsx       # Individual batch
│       ├── progress-tracker.tsx        # Real-time progress
│       └── batch-controls.tsx          # Start/pause/cancel
│
└── crawl-history/
    ├── page.tsx                        # Main page
    └── components/
        ├── history-stats.tsx           # Overall statistics
        ├── timeline-chart.tsx          # D3.js visualization
        ├── crawl-log-table.tsx         # Detailed log
        └── business-history-modal.tsx  # Per-business drill-down
```

### UI Components (ShadCN)
- **Card** → Container for content sections
- **Table** → Business listings
- **Badge** → Status indicators
- **Button** → Actions
- **Checkbox** → Multi-select
- **Dialog/Modal** → Add to queue, details
- **Progress** → Real-time progress bars
- **Select/Dropdown** → Filters
- **Slider** → Priority, rating range
- **Tabs** → View switching

### State Management
- **React Query** → API data fetching and caching
- **Zustand** (optional) → Global state (selected businesses)
- **WebSocket/Polling** → Real-time updates for queue

---

## 🎨 Design Principles

### Visual Hierarchy
1. **Stats First** → Quick overview at top
2. **Actions Prominent** → Big buttons for main actions
3. **Data Tables** → Clean, scannable
4. **Progressive Disclosure** → Details on demand

### Color Coding
- 🟢 **Green** → Recent, up-to-date, success
- 🟡 **Yellow** → Due soon, warning
- 🔴 **Red** → Overdue, failed, attention needed
- 🔵 **Blue** → In progress, processing
- ⚪ **Gray** → Never crawled, neutral

### Interactive Elements
- **Hover States** → Show additional info
- **Click Actions** → View details, select
- **Real-time Updates** → Live progress without refresh
- **Bulk Actions** → Multi-select and batch operations

---

## 🔄 Data Flow

```
User Action → Frontend Component → API Call → Backend Service → Database
                    ↓
          Real-time UI Update
```

Example: Adding businesses to queue
```
1. User selects 2,000 businesses in table
2. Clicks "Add to Queue" button
3. Modal opens with configuration
4. User sets: name, priority, config
5. Clicks "Add to Queue" in modal
6. POST /api/crawl/queue with businessIds
7. Backend creates batch, returns batchId
8. Frontend shows success toast
9. Navigation to Crawl Queue View
10. See new batch with "Queued" status
```

---

## 📱 Responsive Design

All components will be:
- **Desktop-first** (primary use case)
- **Tablet-friendly** (simplified filters)
- **Mobile-aware** (stacked layout, essential features only)

---

## ✅ Summary: What We're Building

### 3 Main Pages
1. **Business Crawl Manager** → Select and queue businesses
2. **Crawl Queue View** → Monitor active crawls
3. **Crawl History Timeline** → Analyze past crawls

### 12 Key Components
- Stats Cards
- Filter Sidebar
- Business Table (with selection)
- Add to Queue Modal
- Queue Summary
- Active Batch Cards
- Progress Tracker
- Batch Controls
- History Stats
- Timeline Chart (D3.js)
- Crawl Log Table
- Business History Modal

### Core Functionality
✅ View 5,216 businesses with filters
✅ Select businesses (individual or bulk)
✅ Add to queue with configuration
✅ Monitor crawl progress in real-time
✅ Track costs and savings
✅ View complete crawl history
✅ Per-business drill-down

---

## 🚀 Implementation Priority

**Phase 1: Essential** (Build First)
1. Business Crawl Manager with table and filters
2. Add to Queue modal
3. Basic Queue View with start button

**Phase 2: Enhanced** (Build Second)
4. Real-time progress tracking
5. Batch controls (pause/cancel)
6. Stats cards and summaries

**Phase 3: Analytics** (Build Third)
7. Crawl History Timeline
8. D3.js visualizations
9. Cost analytics

---

**Ready to start building?** We'll begin with the Business Crawl Manager - the most critical component that lets you select and queue businesses for crawling.

Does this match your vision? Any changes or additions you'd like before we start coding?
