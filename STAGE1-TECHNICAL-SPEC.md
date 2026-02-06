# Stage 1: Lead Qualification - Technical Specification

## 🎯 Project Overview

**Feature:** Lead Qualification Interface (Airtable Stage 1 Replacement)
**Purpose:** Enable VA to manually enter businesses and identify qualifying reviews
**Lifecycle Transition:** Prospect → Lead
**Estimated Duration:** 5-7 days (with full testing)

---

## 📋 Complete Tech Stack

### Frontend Framework
- **Next.js 15.5.3** - React framework with App Router
- **React 19.1.0** - UI library
- **TypeScript 5.x** - Type safety

### UI Components & Styling
- **ShadCN UI** - Component library (Radix UI primitives)
  - `@radix-ui/react-dialog` - Modals
  - `@radix-ui/react-dropdown-menu` - Dropdowns
  - `@radix-ui/react-select` - Select inputs
  - `@radix-ui/react-label` - Form labels
  - `@radix-ui/react-tabs` - Tab navigation
  - `@radix-ui/react-tooltip` - Tooltips
- **Tailwind CSS 4.x** - Utility-first CSS
- **class-variance-authority** - Component variants
- **clsx** - Conditional classes
- **Lucide React** - Icon library
- **Framer Motion** - Animations

### Forms & Validation
- **React Hook Form 7.63.0** - Form state management
- **Zod 4.1.9** - Schema validation
- **@hookform/resolvers** - Zod integration

### Data Fetching & State
- **Next.js Server Actions** - Server-side mutations
- **TanStack Table (React Table v8)** - Data tables
- **SWR** or **React Query** - Client-side caching (to be added)

### Backend & Database
- **PostgreSQL** - Database (existing)
- **Node-Postgres (pg)** - Database client
- **Prisma** (optional) - ORM for type safety

### Testing
- **Playwright** - E2E testing (Claude plugin available)
- **Jest** - Unit testing
- **React Testing Library** - Component testing
- **MSW (Mock Service Worker)** - API mocking

### Development Tools
- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript Compiler** - Type checking
- **Husky** - Git hooks

### MCP Servers (Available via ORCHESTRAI)
- **Filesystem MCP** - File operations
- **Memory MCP** - Crystalline memory integration
- **Notion MCP** - Documentation

---

## 📐 Requirements Specification

### Functional Requirements

#### FR-1: Business List View
- **FR-1.1:** Display paginated list of businesses in "lead" lifecycle stage
- **FR-1.2:** Show business name, location, rating, review count, last updated
- **FR-1.3:** Support sorting by: name, date added, rating, review count
- **FR-1.4:** Support filtering by: date range, location, rating range
- **FR-1.5:** Implement search by business name, address, place_id
- **FR-1.6:** Display 15 items per page with pagination controls
- **FR-1.7:** Show total count of leads

#### FR-2: Add Business Form
- **FR-2.1:** Manual entry of business information
  - Business name (required)
  - Google Maps URL or Place ID (optional, triggers auto-fill)
  - Category (dropdown with common categories)
  - Location/City (text input)
  - Full address (text input)
  - Phone number (formatted input)
  - Website URL (validated)
  - Rating (0-5 stars, decimal)
  - Total review count (number)

- **FR-2.2:** Auto-fill from Google Maps URL
  - Extract place_id from URL
  - Fetch business details from cache or Google Maps API
  - Pre-populate form fields
  - Allow manual override

- **FR-2.3:** Add multiple qualifying reviews
  - Dynamic form with "Add Review" button
  - Each review has:
    - Star rating (1-5)
    - Review date (date picker)
    - Review text (textarea, required)
    - Review URL (optional)
  - Remove review button for each entry
  - Minimum 1 review required

- **FR-2.4:** Internal notes field
  - Multi-line text input
  - Not visible to customer
  - Visible to all team members

- **FR-2.5:** Form validation
  - Required field validation
  - URL format validation
  - Phone number format validation
  - Rating range validation (0-5)
  - Review text minimum length (10 characters)

- **FR-2.6:** Save actions
  - "Save as Lead" - Creates business with lifecycle_stage = 'lead'
  - "Cancel" - Discards changes and returns to list
  - Show loading state during save
  - Show success/error notifications

#### FR-3: Edit Business
- **FR-3.1:** Edit button on each business row
- **FR-3.2:** Opens same form as Add, pre-populated
- **FR-3.3:** Update existing business and reviews
- **FR-3.4:** Track "last_updated_at" timestamp
- **FR-3.5:** Maintain audit trail (who updated, when)

#### FR-4: Delete Business
- **FR-4.1:** Delete button with confirmation dialog
- **FR-4.2:** Soft delete (set lifecycle_stage = 'deleted')
- **FR-4.3:** Show confirmation: "Are you sure? This cannot be undone."
- **FR-4.4:** Only delete if not moved to Stage 2 yet

#### FR-5: Move to Stage 2
- **FR-5.1:** "→ Stage 2" button on each business
- **FR-5.2:** Updates lifecycle_stage from 'lead' to 'qualified'
- **FR-5.3:** Validation: Must have at least 1 qualifying review
- **FR-5.4:** Confirmation dialog before transition
- **FR-5.5:** Notification on success

#### FR-6: Bulk Operations
- **FR-6.1:** Checkbox selection for multiple businesses
- **FR-6.2:** "Select All" checkbox
- **FR-6.3:** Bulk actions:
  - Move selected to Stage 2
  - Delete selected
  - Export selected to CSV
- **FR-6.4:** Show count of selected items

#### FR-7: Export
- **FR-7.1:** Export to CSV button
- **FR-7.2:** Exports visible/filtered results
- **FR-7.3:** Includes all business and review data
- **FR-7.4:** Filename format: `leads-export-YYYY-MM-DD.csv`

#### FR-8: Import
- **FR-8.1:** Bulk import from CSV
- **FR-8.2:** Template download for CSV format
- **FR-8.3:** Validation of imported data
- **FR-8.4:** Preview before import
- **FR-8.5:** Show import results (success/errors)

### Non-Functional Requirements

#### NFR-1: Performance
- **NFR-1.1:** Page load time < 2 seconds
- **NFR-1.2:** Form submission response < 1 second
- **NFR-1.3:** Search/filter results < 500ms
- **NFR-1.4:** Support 100 concurrent users
- **NFR-1.5:** Handle 10,000+ leads without performance degradation

#### NFR-2: Accessibility
- **NFR-2.1:** WCAG 2.1 AA compliance
- **NFR-2.2:** Keyboard navigation support
- **NFR-2.3:** Screen reader compatible
- **NFR-2.4:** Focus indicators visible
- **NFR-2.5:** Sufficient color contrast (4.5:1 minimum)

#### NFR-3: Usability
- **NFR-3.1:** Mobile responsive (tablet 768px+, phone view-only)
- **NFR-3.2:** Loading states for all async operations
- **NFR-3.3:** Clear error messages
- **NFR-3.4:** Success notifications
- **NFR-3.5:** Confirmation dialogs for destructive actions
- **NFR-3.6:** Auto-save draft (localStorage) for forms

#### NFR-4: Security
- **NFR-4.1:** Input sanitization (prevent XSS)
- **NFR-4.2:** SQL injection prevention (parameterized queries)
- **NFR-4.3:** CSRF protection
- **NFR-4.4:** Rate limiting on API endpoints
- **NFR-4.5:** Authentication required (session-based)

#### NFR-5: Data Integrity
- **NFR-5.1:** Optimistic locking (prevent concurrent edit conflicts)
- **NFR-5.2:** Transaction support for multi-table updates
- **NFR-5.3:** Data validation on both client and server
- **NFR-5.4:** Audit trail for all changes
- **NFR-5.5:** Backup recovery procedures

---

## 🗄️ Database Schema Updates

### New Tables

#### `reviews` table (if not exists)
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review_date TIMESTAMP NOT NULL,
  review_text TEXT NOT NULL,
  review_url TEXT,
  reviewer_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  CONSTRAINT valid_stars CHECK (stars BETWEEN 1 AND 5)
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_stars ON reviews(stars);
CREATE INDEX idx_reviews_date ON reviews(review_date DESC);
```

#### `audit_log` table
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'business', 'review', etc.
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted'
  user_id UUID REFERENCES users(id),
  changes JSONB, -- Before/after values
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

### Updated Columns on `businesses` table
```sql
-- Add if not exists
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'; -- 'manual', 'scraped', 'imported'
```

---

## 🏗️ Component Architecture

### Page Structure
```
/src/app/leads/qualification/
├── page.tsx                    # Main page component
├── layout.tsx                  # Layout wrapper
└── components/
    ├── LeadsList.tsx           # Data table
    ├── AddBusinessDialog.tsx   # Add/Edit form modal
    ├── BusinessRow.tsx         # Table row component
    ├── ReviewInput.tsx         # Dynamic review form
    ├── BulkActions.tsx         # Bulk operation toolbar
    ├── SearchBar.tsx           # Search input
    ├── FilterPanel.tsx         # Filter controls
    └── ExportButton.tsx        # CSV export
```

### Shared Components (ShadCN)
```
/src/components/ui/
├── button.tsx
├── dialog.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── textarea.tsx
├── table.tsx
├── badge.tsx
├── tooltip.tsx
├── form.tsx
└── ...
```

### API Routes
```
/src/app/api/leads/
├── route.ts                    # GET: list, POST: create
├── [id]/
│   ├── route.ts                # GET: read, PUT: update, DELETE: delete
│   └── transition/route.ts     # POST: move to stage 2
├── bulk/route.ts               # POST: bulk operations
├── import/route.ts             # POST: CSV import
└── export/route.ts             # GET: CSV export
```

### Service Layer
```
/src/lib/services/
├── lead-service.ts             # Business logic for leads
├── review-service.ts           # Review CRUD operations
├── audit-service.ts            # Audit logging
└── google-maps-service.ts      # Auto-fill from Google Maps
```

---

## 🎨 UI/UX Specifications

### Design Tokens
```typescript
// colors
const colors = {
  primary: '#3B82F6',      // Blue
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Orange
  danger: '#EF4444',       // Red
  neutral: '#6B7280',      // Gray
}

// spacing
const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
}

// typography
const typography = {
  heading1: '2rem',        // 32px
  heading2: '1.5rem',      // 24px
  heading3: '1.25rem',     // 20px
  body: '1rem',            // 16px
  small: '0.875rem',       // 14px
}
```

### Keyboard Shortcuts
- `Ctrl/Cmd + K`: Open search
- `Ctrl/Cmd + N`: New business
- `Ctrl/Cmd + S`: Save form
- `Esc`: Close dialog
- `Tab`: Navigate form fields
- `Enter`: Submit form (when not in textarea)

### Loading States
- **Skeleton loaders** for table rows
- **Spinner** for form submission
- **Progress bar** for imports/exports

### Animations
- **Fade in:** 200ms - Page transitions
- **Slide in:** 300ms - Modals/dialogs
- **Scale:** 150ms - Button clicks

---

## 🧪 Testing Strategy

### Unit Tests (Jest + React Testing Library)
- **Component tests:**
  - `LeadsList.test.tsx` - Rendering, pagination, sorting
  - `AddBusinessDialog.test.tsx` - Form validation, submission
  - `ReviewInput.test.tsx` - Dynamic fields, validation

- **Service tests:**
  - `lead-service.test.ts` - CRUD operations
  - `validation.test.ts` - Zod schemas

### Integration Tests
- **API route tests:**
  - `/api/leads` - List, create, update, delete
  - `/api/leads/bulk` - Bulk operations
  - `/api/leads/import` - CSV import

### E2E Tests (Playwright)
```typescript
// tests/e2e/stage1-lead-qualification.spec.ts

test.describe('Stage 1: Lead Qualification', () => {
  test('should add a new business with reviews', async ({ page }) => {
    // 1. Navigate to leads page
    await page.goto('/leads/qualification')

    // 2. Click "Add New Business"
    await page.click('text=Add New Business')

    // 3. Fill business information
    await page.fill('input[name="name"]', 'Test Restaurant')
    await page.fill('input[name="address"]', 'Amsterdam, Netherlands')
    await page.selectOption('select[name="category"]', 'restaurant')

    // 4. Add qualifying review
    await page.click('text=Add Review')
    await page.selectOption('select[name="reviews.0.stars"]', '2')
    await page.fill('textarea[name="reviews.0.text"]', 'Bad service and cold food')

    // 5. Save as lead
    await page.click('text=Save as Lead')

    // 6. Verify success notification
    await expect(page.locator('text=Business added successfully')).toBeVisible()

    // 7. Verify appears in list
    await expect(page.locator('text=Test Restaurant')).toBeVisible()
  })

  test('should edit existing business', async ({ page }) => {
    // Test edit functionality
  })

  test('should move business to Stage 2', async ({ page }) => {
    // Test stage transition
  })

  test('should delete business with confirmation', async ({ page }) => {
    // Test deletion
  })

  test('should perform bulk operations', async ({ page }) => {
    // Test bulk selection and actions
  })

  test('should export leads to CSV', async ({ page }) => {
    // Test CSV export
  })

  test('should import leads from CSV', async ({ page }) => {
    // Test CSV import
  })
})
```

### Accessibility Tests (Playwright + axe-core)
```typescript
test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/leads/qualification')

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

  expect(accessibilityScanResults.violations).toEqual([])
})
```

### Performance Tests
- **Lighthouse CI:** Score ≥ 90 for all metrics
- **Bundle size:** < 500KB (main bundle)
- **Load test:** 100 concurrent users (using k6)

### Visual Regression Tests (Playwright)
```typescript
test('should match visual snapshot', async ({ page }) => {
  await page.goto('/leads/qualification')
  await expect(page).toHaveScreenshot('leads-list.png')
})
```

---

## 🔐 Security Requirements

### Input Validation
- **Server-side validation** for all inputs (Zod schemas)
- **Client-side validation** for UX (React Hook Form)
- **Sanitization** of HTML/script content
- **URL validation** for Google Maps links

### Authentication & Authorization
- **Session-based auth** (NextAuth.js or custom)
- **Role-based access:**
  - VA role: Can create/edit leads
  - Admin role: Full access
- **Protected API routes** (middleware)

### Rate Limiting
- **10 requests/minute** per IP for form submissions
- **100 requests/minute** for read operations

---

## 📦 Dependencies to Install

```bash
# UI Components (ShadCN - install as needed)
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tooltip
npx shadcn-ui@latest add form
npx shadcn-ui@latest add dropdown-menu

# Data Table
npm install @tanstack/react-table

# Date Picker (already installed)
npm install date-fns  # ✅ Already installed

# CSV Export/Import
npm install papaparse
npm install @types/papaparse --save-dev

# Testing
npm install --save-dev @playwright/test
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @axe-core/playwright
```

---

## 🎯 Success Criteria

### Definition of Done
- ✅ All functional requirements implemented
- ✅ All non-functional requirements met
- ✅ Unit test coverage ≥ 80%
- ✅ E2E test coverage ≥ 90% of user flows
- ✅ Accessibility audit passes (WCAG 2.1 AA)
- ✅ Performance benchmarks met
- ✅ Code review approved
- ✅ Documentation complete
- ✅ User acceptance testing passed (VA team)

### User Acceptance Criteria
1. VA can add 10 businesses in < 15 minutes
2. Form is intuitive (no training required)
3. No data loss on accidental refresh (auto-save)
4. Bulk operations work reliably
5. Export/import handles 1000+ records
6. Mobile responsive for viewing (not editing)

---

## 📅 Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Setup & Dependencies | 0.5 day | Environment ready |
| Database Migration | 0.5 day | Schema updated |
| UI Components (ShadCN) | 1 day | Reusable components |
| List View + Search | 1 day | Business list with filters |
| Add/Edit Form | 1.5 days | Full CRUD with validation |
| Bulk Operations | 0.5 day | Selection + actions |
| Import/Export | 0.5 day | CSV functionality |
| E2E Tests | 1 day | Playwright test suite |
| Accessibility | 0.5 day | WCAG compliance |
| Bug Fixes + Polish | 0.5 day | Final refinements |
| **Total** | **7 days** | Production-ready Stage 1 |

---

## 🔄 Next Steps

After Stage 1 completion:
1. User acceptance testing with VA team
2. Deploy to staging environment
3. Performance monitoring
4. Iterate based on feedback
5. Start Stage 2: Enrichment Interface
