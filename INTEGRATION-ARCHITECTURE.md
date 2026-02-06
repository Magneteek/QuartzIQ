# QuartzIQ Integration Architecture
## Unified Application with Role-Based Access

## 🎯 Current State Analysis

### Existing QuartzIQ Features
```
/dashboard/
├── crawl-manager/          # Manage business crawling
├── crawl-queue/            # Queue for scheduled crawls
├── crawl-history/          # History of past crawls
├── crawl-targets/          # Target businesses for crawling
└── qualified-reviews/      # Extracted qualifying reviews
```

**Tech Stack (Already in place):**
- ✅ Next.js 15 with App Router
- ✅ ShadCN UI components (Card, Button, etc.)
- ✅ Framer Motion animations
- ✅ PostgreSQL database
- ✅ Lucide React icons
- ✅ Tailwind CSS

**Current User Flow:**
1. Extract businesses from Google Maps (via Apify)
2. Crawl for reviews
3. Filter qualifying reviews
4. View in dashboard

---

## 🏗️ Proposed Integration Architecture

### Unified Application Structure

```
QuartzIQ (Single Application - Port 3069)
│
├── Public Routes (No Auth)
│   └── /login                      # Authentication page
│
├── Dashboard Routes (Authenticated)
│   │
│   ├── /dashboard                  # 🆕 Main dashboard (role-based home)
│   │
│   ├── Extraction Module (Existing - All Roles)
│   │   ├── /dashboard/crawl-manager
│   │   ├── /dashboard/crawl-queue
│   │   ├── /dashboard/crawl-history
│   │   ├── /dashboard/crawl-targets
│   │   └── /dashboard/qualified-reviews
│   │
│   ├── Lead Management Module (🆕 Stage 1 - VA Role)
│   │   ├── /dashboard/leads
│   │   ├── /dashboard/leads/add
│   │   └── /dashboard/leads/[id]/edit
│   │
│   ├── Enrichment Module (🆕 Stage 2 - Enrichment Role)
│   │   ├── /dashboard/enrichment
│   │   ├── /dashboard/enrichment/[id]
│   │   └── /dashboard/enrichment/bulk
│   │
│   ├── Customer Management (🆕 - Admin Role)
│   │   ├── /dashboard/customers
│   │   ├── /dashboard/customers/[id]
│   │   └── /dashboard/monitoring
│   │
│   └── Alerts & Reports (🆕 - All Roles)
│       ├── /dashboard/alerts
│       └── /dashboard/reports
│
└── API Routes
    ├── /api/extract/*              # Existing extraction APIs
    ├── /api/monitoring/*           # 🆕 Customer monitoring (implemented)
    ├── /api/leads/*                # 🆕 Lead management (Stage 1)
    ├── /api/enrichment/*           # 🆕 Contact enrichment (Stage 2)
    └── /api/auth/*                 # 🆕 Authentication
```

---

## 👥 User Roles & Permissions

### Role Definition

```typescript
enum UserRole {
  ADMIN = 'admin',           // Full access
  VA = 'va',                 // Virtual Assistant - Stage 1 entry
  ENRICHMENT = 'enrichment', // Enrichment Specialist - Stage 2
  VIEWER = 'viewer'          // Read-only access
}

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  team?: string              // For multi-tenant support
  createdAt: Date
  lastLogin: Date
}
```

### Permission Matrix

| Feature | Admin | VA | Enrichment | Viewer |
|---------|-------|----|-----------:|--------|
| **Extraction Module** | | | | |
| View crawl manager | ✅ | ✅ | ✅ | ✅ |
| Schedule crawls | ✅ | ✅ | ❌ | ❌ |
| View qualified reviews | ✅ | ✅ | ✅ | ✅ |
| **Lead Management (Stage 1)** | | | | |
| View leads | ✅ | ✅ | ✅ | ✅ |
| Add/edit leads | ✅ | ✅ | ❌ | ❌ |
| Delete leads | ✅ | ❌ | ❌ | ❌ |
| Move to enrichment | ✅ | ✅ | ❌ | ❌ |
| **Enrichment (Stage 2)** | | | | |
| View enrichment queue | ✅ | ❌ | ✅ | ✅ |
| Enrich contacts (manual) | ✅ | ❌ | ✅ | ❌ |
| Enrich contacts (AI) | ✅ | ❌ | ✅ | ❌ |
| Move to qualified | ✅ | ❌ | ✅ | ❌ |
| **Customer Management** | | | | |
| View customers | ✅ | ❌ | ❌ | ✅ |
| Enable monitoring | ✅ | ❌ | ❌ | ❌ |
| Manage lifecycle | ✅ | ❌ | ❌ | ❌ |
| **Alerts** | | | | |
| View alerts | ✅ | ✅ | ✅ | ✅ |
| Acknowledge alerts | ✅ | ❌ | ✅ | ❌ |
| **Settings** | | | | |
| User management | ✅ | ❌ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ |

---

## 🔄 Workflow Integration

### Complete Business Journey

```
┌──────────────────────────────────────────────────────────┐
│                    QUARTZIQ UNIFIED FLOW                  │
└──────────────────────────────────────────────────────────┘

Step 1: Extraction (Existing - Automated)
┌────────────────────────────────────────────────┐
│ Google Maps Scraping (Apify)                   │
│ • Extract businesses by category/location      │
│ • Cache in database (lifecycle: prospect)      │
│ • Extract reviews automatically                │
└────────────────────────────────────────────────┘
                    ↓
Step 2: Lead Qualification (🆕 Stage 1 - VA Manual)
┌────────────────────────────────────────────────┐
│ /dashboard/leads (VA Interface)                │
│ • VA reviews prospects                         │
│ • Identifies qualifying reviews (1-3 stars)    │
│ • Adds business info manually                  │
│ • Marks as "lead" (lifecycle: prospect → lead) │
└────────────────────────────────────────────────┘
                    ↓
Step 3: Contact Enrichment (🆕 Stage 2 - Enrichment Specialist)
┌────────────────────────────────────────────────┐
│ /dashboard/enrichment (Enrichment Interface)   │
│ • Enrichment specialist views leads            │
│ • Option A: AI enrichment (Apollo/Apify)       │
│ • Option B: Manual enrichment                  │
│ • Option C: Edit AI results                    │
│ • Marks as "qualified" (lifecycle: lead → qualified)│
└────────────────────────────────────────────────┘
                    ↓
Step 4: Customer Conversion (Admin)
┌────────────────────────────────────────────────┐
│ /dashboard/customers (Admin Interface)         │
│ • Qualified leads contacted                    │
│ • Business pays for review removal             │
│ • Admin marks as "customer"                    │
│ • Enables monitoring (lifecycle: qualified → customer)│
└────────────────────────────────────────────────┘
                    ↓
Step 5: Monitoring (Automated)
┌────────────────────────────────────────────────┐
│ /dashboard/monitoring (Automated + Alerts)     │
│ • Auto-scrape customer reviews daily           │
│ • Detect new negative reviews                  │
│ • Create alerts (severity-based)               │
│ • Notify team via /dashboard/alerts            │
└────────────────────────────────────────────────┘
```

---

## 🎨 Unified Design System

### Navigation Structure

**Sidebar Navigation (Role-Based)**

```typescript
// /src/components/layout/sidebar.tsx

const navigationItems = {
  admin: [
    {
      section: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      section: "Extraction",
      items: [
        { label: "Crawl Manager", href: "/dashboard/crawl-manager", icon: Search },
        { label: "Crawl Queue", href: "/dashboard/crawl-queue", icon: Clock },
        { label: "Crawl History", href: "/dashboard/crawl-history", icon: History },
      ]
    },
    {
      section: "Lead Management",
      items: [
        { label: "Leads", href: "/dashboard/leads", icon: UserPlus },
        { label: "Enrichment", href: "/dashboard/enrichment", icon: Sparkles },
      ]
    },
    {
      section: "Customers",
      items: [
        { label: "Customers", href: "/dashboard/customers", icon: Users },
        { label: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
        { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
      ]
    },
    {
      section: "Settings",
      items: [
        { label: "Users", href: "/dashboard/users", icon: UserCog },
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
      ]
    }
  ],

  va: [
    {
      section: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      section: "My Work",
      items: [
        { label: "Leads", href: "/dashboard/leads", icon: UserPlus },
        { label: "Qualified Reviews", href: "/dashboard/qualified-reviews", icon: CheckCircle },
      ]
    },
    {
      section: "Tools",
      items: [
        { label: "Crawl Manager", href: "/dashboard/crawl-manager", icon: Search },
      ]
    }
  ],

  enrichment: [
    {
      section: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      section: "My Work",
      items: [
        { label: "Enrichment Queue", href: "/dashboard/enrichment", icon: Sparkles },
        { label: "Qualified Leads", href: "/dashboard/leads?status=qualified", icon: CheckCircle },
      ]
    },
    {
      section: "Alerts",
      items: [
        { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
      ]
    }
  ]
}
```

### Shared Layout Component

```typescript
// /src/app/dashboard/layout.tsx

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth() // 🆕 Auth hook

  return (
    <div className="flex h-screen">
      {/* Sidebar Navigation */}
      <Sidebar user={user} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Top Bar */}
        <TopBar user={user} />

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
```

### Consistent Design Tokens (Already in QuartzIQ)

```typescript
// Extend existing design system
const quartzIQTheme = {
  colors: {
    primary: '#3B82F6',      // Blue (existing)
    success: '#10B981',      // Green
    warning: '#F59E0B',      // Orange
    danger: '#EF4444',       // Red
    neutral: '#6B7280',      // Gray
    // 🆕 Lifecycle stage colors
    prospect: '#9CA3AF',     // Gray
    lead: '#3B82F6',         // Blue
    qualified: '#10B981',    // Green
    customer: '#8B5CF6',     // Purple
    churned: '#EF4444',      // Red
  },
  components: {
    // Reuse existing ShadCN components
    button: 'existing',
    card: 'existing',
    dialog: 'existing',
    // Add new components for Stage 1/2
  }
}
```

---

## 🔐 Authentication & Authorization

### Authentication Options

**Option 1: NextAuth.js (Recommended)**
```bash
npm install next-auth @auth/pg-adapter
```

**Features:**
- Session-based auth
- PostgreSQL adapter (same database)
- Email/password + OAuth providers
- Built-in CSRF protection
- Easy role management

**Option 2: Custom Session Auth**
- Simpler for small team
- Store sessions in PostgreSQL
- Custom middleware for protection

### Middleware Protection

```typescript
// /src/middleware.ts

export async function middleware(request: NextRequest) {
  const session = await getSession(request)

  // Protect all /dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role-based protection
    const path = request.nextUrl.pathname

    if (path.startsWith('/dashboard/enrichment') && session.user.role !== 'enrichment' && session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (path.startsWith('/dashboard/customers') && session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}
```

---

## 📊 Dashboard Integration

### Role-Based Home Pages

**Admin Dashboard (`/dashboard`)**
```
┌──────────────────────────────────────────────────┐
│  Overview                                         │
│  ┌──────┬──────┬──────┬──────┬──────┐           │
│  │Prosp.│Leads │Qual. │Cust. │Alert │           │
│  │ 1243 │  87  │  45  │  32  │  16  │           │
│  └──────┴──────┴──────┴──────┴──────┘           │
│                                                   │
│  Recent Activity                                  │
│  • 12 businesses scraped (2h ago)                │
│  • 5 leads qualified by John (VA)                │
│  • 8 contacts enriched by Sarah                  │
│  • 3 critical alerts (new 1-star reviews)        │
│                                                   │
│  Quick Actions                                    │
│  [View Alerts] [Run Monitoring] [Crawl Manager]  │
└──────────────────────────────────────────────────┘
```

**VA Dashboard (`/dashboard`)**
```
┌──────────────────────────────────────────────────┐
│  My Work Queue                                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ 45 Prospects Need Review                    │ │
│  │ [Start Qualifying]                          │ │
│  │                                             │ │
│  │ Today's Progress                            │ │
│  │ • 12 businesses qualified                   │ │
│  │ • 8 moved to enrichment                     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Recent Leads                                     │
│  [Table of recently added leads]                 │
└──────────────────────────────────────────────────┘
```

**Enrichment Specialist Dashboard (`/dashboard`)**
```
┌──────────────────────────────────────────────────┐
│  Enrichment Queue                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ 87 Leads Waiting for Enrichment             │ │
│  │ [Start Enriching]                           │ │
│  │                                             │ │
│  │ Today's Progress                            │ │
│  │ • 15 contacts enriched (8 AI, 7 manual)    │ │
│  │ • 12 moved to qualified                     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  AI Enrichment Stats                              │
│  • Success rate: 85%                              │
│  • Cost today: $3.20                              │
└──────────────────────────────────────────────────┘
```

---

## 🔗 Data Flow Between Modules

### Database Schema (Unified)

```sql
-- Existing table (update)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(50) DEFAULT 'prospect',
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS stage1_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS stage1_completed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS stage2_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS stage2_completed_by UUID REFERENCES users(id);

-- Track who did what
CREATE INDEX idx_businesses_assigned ON businesses(assigned_to);
CREATE INDEX idx_businesses_lifecycle ON businesses(lifecycle_stage);
```

### State Transitions

```typescript
// Service layer handles transitions
class BusinessLifecycleService {
  async transitionToLead(
    businessId: string,
    userId: string,
    reviews: Review[]
  ) {
    // Update lifecycle_stage from 'prospect' to 'lead'
    // Record stage1_completed_by and stage1_completed_at
    // Create audit log entry
  }

  async transitionToQualified(
    businessId: string,
    userId: string,
    enrichmentData: EnrichmentData
  ) {
    // Update lifecycle_stage from 'lead' to 'qualified'
    // Save enrichment data
    // Record stage2_completed_by and stage2_completed_at
    // Create audit log entry
  }

  async transitionToCustomer(
    businessId: string,
    userId: string,
    tierassignment: 'basic' | 'premium' | 'enterprise'
  ) {
    // Update lifecycle_stage from 'qualified' to 'customer'
    // Enable monitoring
    // Create audit log entry
  }
}
```

---

## 📅 Implementation Strategy

### Phase 1: Authentication & Layout (Week 1)
1. Install NextAuth.js or custom auth
2. Create login page
3. Add user management (admin only)
4. Build dashboard layout with sidebar
5. Implement role-based navigation
6. Add middleware protection

### Phase 2: Stage 1 Integration (Week 2)
1. Create `/dashboard/leads` page
2. Integrate with existing extraction data
3. Build lead qualification form
4. Add transition to enrichment
5. Test with VA team

### Phase 3: Stage 2 Integration (Week 3)
1. Create `/dashboard/enrichment` page
2. Integrate AI enrichment (Apollo/Apify)
3. Build manual enrichment form
4. Add transition to qualified
5. Test with enrichment team

### Phase 4: Customer Management (Week 4)
1. Create `/dashboard/customers` page
2. Integrate monitoring service (already built)
3. Create alerts dashboard
4. Add customer lifecycle management
5. Full system testing

---

## ✅ Benefits of Unified Approach

### 1. **Single Application**
- ✅ One codebase to maintain
- ✅ Shared components and design system
- ✅ Consistent user experience
- ✅ Easier deployment (one server)
- ✅ Shared authentication

### 2. **Role-Based Access**
- ✅ Each user sees only what they need
- ✅ Prevents errors (VA can't delete customers)
- ✅ Clear separation of duties
- ✅ Audit trail (who did what)

### 3. **Data Integration**
- ✅ Seamless data flow between stages
- ✅ Single source of truth (PostgreSQL)
- ✅ No data duplication
- ✅ Real-time updates across modules

### 4. **Existing Infrastructure**
- ✅ Reuse existing components (ShadCN UI)
- ✅ Reuse existing API patterns
- ✅ Reuse existing database
- ✅ Minimal additional dependencies

---

## 🎯 Recommendation

**Use the unified approach:**
1. Integrate Stage 1 & 2 into existing `/dashboard` structure
2. Add role-based navigation and permissions
3. Extend existing database schema (no migration needed)
4. Reuse existing design system and components
5. Add authentication layer (NextAuth.js)

**Result:**
- One application, multiple workflows
- Role-based access for security
- Seamless data flow
- Consistent user experience
- Easier to maintain and deploy

**Timeline:**
- Week 1: Auth + Layout
- Week 2: Stage 1 (VA interface)
- Week 3: Stage 2 (Enrichment)
- Week 4: Customer management + Testing
- **Total: 4 weeks for complete integration**
