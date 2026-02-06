# Stage 1: ORCHESTRAI Agent Orchestration Plan

## 🤖 Specialized Agents Required

### Phase 1: Architecture & Planning (Day 1)

#### 1. `frontend-architect-specialist`
**Purpose:** Design component architecture and application structure
**Tasks:**
- Design component hierarchy
- Define state management strategy
- Plan API integration patterns
- Create folder structure
- Define TypeScript interfaces

**Invocation:**
```bash
Task(
  subagent_type="frontend-architect-specialist",
  prompt="Design the component architecture for Stage 1 Lead Qualification interface.
  Requirements in STAGE1-TECHNICAL-SPEC.md. Focus on:
  - Component hierarchy for LeadsList, AddBusinessDialog, ReviewInput
  - State management for forms and data fetching
  - File structure following Next.js 15 App Router best practices
  - TypeScript interfaces for Business and Review entities"
)
```

#### 2. `api-architect`
**Purpose:** Design API endpoints and data flow
**Tasks:**
- Design REST API structure
- Define request/response schemas
- Plan error handling
- Design database queries
- Create API documentation

**Invocation:**
```bash
Task(
  subagent_type="api-architect",
  prompt="Design the API architecture for Stage 1 Lead Qualification.
  Requirements in STAGE1-TECHNICAL-SPEC.md. Focus on:
  - API routes for /api/leads (CRUD operations)
  - Bulk operations endpoint
  - Import/export endpoints
  - Error handling patterns
  - Request validation with Zod"
)
```

#### 3. `design-system-architect`
**Purpose:** Establish design system and component library
**Tasks:**
- Configure ShadCN UI components
- Define design tokens
- Create reusable patterns
- Establish naming conventions

**Invocation:**
```bash
Task(
  subagent_type="design-system-architect",
  prompt="Establish design system for QuartzIQ Stage 1.
  Using ShadCN UI + Tailwind CSS.
  Define: design tokens, color scheme, typography, spacing, component variants.
  Reference: AIRTABLE-REPLACEMENT-UI-DESIGN.md for visual specs"
)
```

---

### Phase 2: Database & Backend (Day 2)

#### 4. `backend-development-specialist`
**Purpose:** Implement database schema and backend services
**Tasks:**
- Create database migration
- Implement lead-service.ts
- Implement review-service.ts
- Implement audit-service.ts
- Add transaction support

**Invocation:**
```bash
Task(
  subagent_type="backend-development-specialist",
  prompt="Implement backend for Stage 1 Lead Qualification.
  Tasks:
  1. Create database migration (reviews table, audit_log table)
  2. Implement lead-service.ts with CRUD operations
  3. Implement review-service.ts for review management
  4. Implement audit-service.ts for change tracking
  5. Add PostgreSQL transaction support for atomicity

  Tech stack: Next.js 15, PostgreSQL, node-postgres (pg), Zod validation"
)
```

#### 5. `api-integration-specialist`
**Purpose:** Build API routes with validation and error handling
**Tasks:**
- Implement /api/leads routes
- Add Zod validation schemas
- Implement error handling
- Add rate limiting
- Create API tests

**Invocation:**
```bash
Task(
  subagent_type="api-integration-specialist",
  prompt="Build API routes for Stage 1 Lead Qualification.
  Implement:
  - /api/leads (GET, POST)
  - /api/leads/[id] (GET, PUT, DELETE)
  - /api/leads/[id]/transition (POST)
  - /api/leads/bulk (POST)
  - /api/leads/import (POST)
  - /api/leads/export (GET)

  Requirements: Zod validation, error handling, rate limiting, CSRF protection"
)
```

---

### Phase 3: UI Components (Days 3-4)

#### 6. `ui-component-developer`
**Purpose:** Build reusable UI components
**Tasks:**
- Install and configure ShadCN components
- Create custom components
- Implement component variants
- Add TypeScript types

**Invocation:**
```bash
Task(
  subagent_type="ui-component-developer",
  prompt="Build UI components for Stage 1 Lead Qualification.

  Components to create:
  1. LeadsList.tsx - Data table with sorting, filtering, pagination
  2. AddBusinessDialog.tsx - Modal form for add/edit
  3. BusinessRow.tsx - Table row with actions
  4. ReviewInput.tsx - Dynamic review form fields
  5. BulkActions.tsx - Bulk operation toolbar
  6. SearchBar.tsx - Debounced search input
  7. FilterPanel.tsx - Filter controls
  8. ExportButton.tsx - CSV export

  Tech: ShadCN UI, TanStack Table, React Hook Form, Tailwind CSS"
)
```

#### 7. `frontend-design:frontend-design` (Skill from Plugin)
**Purpose:** Create polished, production-grade UI design
**Tasks:**
- Design distinctive interface (not generic AI look)
- Create cohesive visual design
- Implement animations and transitions
- Polish user experience

**Invocation:**
```bash
Skill(
  skill="frontend-design:frontend-design",
  args="Design Stage 1 Lead Qualification interface.
  Create a polished, professional data management UI with:
  - Clean table design for business listings
  - Intuitive modal form for adding businesses
  - Smooth animations and transitions
  - Clear visual hierarchy
  - Professional color scheme (blues, greens)
  Reference AIRTABLE-REPLACEMENT-UI-DESIGN.md for layout"
)
```

#### 8. `responsive-layout-optimizer`
**Purpose:** Ensure mobile responsiveness
**Tasks:**
- Optimize for tablet (768px+)
- Create mobile view (view-only)
- Test on various screen sizes
- Implement responsive breakpoints

**Invocation:**
```bash
Task(
  subagent_type="responsive-layout-optimizer",
  prompt="Optimize Stage 1 Lead Qualification for responsive design.
  Requirements:
  - Desktop: Full features (1024px+)
  - Tablet: Adapted layout (768-1023px)
  - Mobile: View-only mode (<768px)
  Test on: iPhone 14, iPad Pro, Desktop HD"
)
```

---

### Phase 4: Forms & Validation (Day 4)

#### 9. `form-validation-specialist` (Create if needed)
**Purpose:** Implement robust form validation
**Tasks:**
- Create Zod schemas
- Implement React Hook Form integration
- Add client-side validation
- Create error messages
- Implement auto-save

**Invocation:**
```bash
Task(
  subagent_type="backend-development-specialist",
  prompt="Implement form validation for Stage 1 Lead Qualification.

  Create Zod schemas for:
  - Business form (name, address, phone, website, rating validation)
  - Review form (stars 1-5, review text min 10 chars, date validation)
  - Bulk import validation

  Integrate with React Hook Form:
  - Client-side validation with error messages
  - Server-side validation in API routes
  - Auto-save draft to localStorage (every 30 seconds)
  - Prevent data loss on page refresh"
)
```

---

### Phase 5: Testing (Days 5-6)

#### 10. `e2e-test-automator`
**Purpose:** Create comprehensive E2E test suite
**Tasks:**
- Set up Playwright
- Create test scenarios
- Implement page objects
- Add data fixtures
- CI/CD integration

**Invocation:**
```bash
Task(
  subagent_type="e2e-test-automator",
  prompt="Create E2E test suite for Stage 1 Lead Qualification.

  Test scenarios (from STAGE1-TECHNICAL-SPEC.md):
  1. Add new business with reviews
  2. Edit existing business
  3. Delete business with confirmation
  4. Move business to Stage 2
  5. Bulk operations (select, move, delete)
  6. Search and filter
  7. CSV export/import
  8. Form validation errors
  9. Auto-save recovery
  10. Pagination and sorting

  Tech: Playwright + TypeScript
  Target: 90% coverage of user flows"
)
```

#### 11. `accessibility-agent`
**Purpose:** Ensure WCAG 2.1 AA compliance
**Tasks:**
- Run accessibility audits
- Fix accessibility issues
- Add ARIA labels
- Test keyboard navigation
- Test with screen readers

**Invocation:**
```bash
Task(
  subagent_type="accessibility-agent",
  prompt="Audit and fix accessibility issues for Stage 1 Lead Qualification.

  Requirements:
  - WCAG 2.1 AA compliance
  - Keyboard navigation (Tab, Enter, Esc)
  - Screen reader compatibility
  - Focus indicators visible
  - Color contrast ≥ 4.5:1
  - ARIA labels for dynamic content

  Use Playwright + axe-core for automated testing"
)
```

#### 12. `functional-testing-specialist`
**Purpose:** Create integration and unit tests
**Tasks:**
- Set up Jest + React Testing Library
- Create component tests
- Create service layer tests
- Add API route tests
- Mock external dependencies

**Invocation:**
```bash
Task(
  subagent_type="functional-testing-specialist",
  prompt="Create unit and integration tests for Stage 1.

  Unit tests:
  - LeadsList component (rendering, pagination)
  - AddBusinessDialog component (validation, submission)
  - ReviewInput component (dynamic fields)
  - lead-service.ts (CRUD operations)
  - Zod validation schemas

  Integration tests:
  - API routes (/api/leads)
  - Database operations (transactions)
  - Form submission flow

  Tech: Jest + React Testing Library + MSW
  Target: 80% code coverage"
)
```

#### 13. `performance-testing-expert`
**Purpose:** Load testing and performance optimization
**Tasks:**
- Run Lighthouse audits
- Create load tests
- Optimize bundle size
- Implement caching
- Performance monitoring

**Invocation:**
```bash
Task(
  subagent_type="performance-testing-expert",
  prompt="Performance test and optimize Stage 1 Lead Qualification.

  Tasks:
  1. Run Lighthouse CI (target: ≥90 all metrics)
  2. Load test with k6 (100 concurrent users)
  3. Bundle size analysis (target: <500KB)
  4. Database query optimization
  5. Implement client-side caching (SWR)
  6. Lazy loading for heavy components

  Performance budgets:
  - Page load: <2s
  - Form submission: <1s
  - Search results: <500ms"
)
```

#### 14. `visual-regression-tester`
**Purpose:** Prevent UI regressions
**Tasks:**
- Set up visual regression testing
- Create baseline screenshots
- Add to CI pipeline
- Review visual diffs

**Invocation:**
```bash
Task(
  subagent_type="visual-regression-tester",
  prompt="Set up visual regression testing for Stage 1.

  Capture screenshots for:
  - Leads list (empty, populated, filtered)
  - Add business form (empty, filled, errors)
  - Business row hover states
  - Modals and dialogs
  - Mobile responsive views

  Tech: Playwright visual snapshots
  Integrate into CI/CD pipeline"
)
```

---

### Phase 6: Security & Quality (Day 7)

#### 15. `security-testing-specialist`
**Purpose:** Security audit and penetration testing
**Tasks:**
- OWASP Top 10 audit
- Input validation testing
- SQL injection testing
- XSS testing
- CSRF protection verification

**Invocation:**
```bash
Task(
  subagent_type="security-testing-specialist",
  prompt="Security audit for Stage 1 Lead Qualification.

  OWASP Top 10 checks:
  1. SQL Injection - Test parameterized queries
  2. XSS - Test input sanitization
  3. CSRF - Verify token protection
  4. Authentication - Test session management
  5. Rate limiting - Test API endpoints

  Also test:
  - URL validation (Google Maps links)
  - File upload security (CSV import)
  - Authorization (role-based access)

  Generate security report with findings"
)
```

#### 16. `code-quality-agent`
**Purpose:** Code quality and linting
**Tasks:**
- Run ESLint
- Run Prettier
- TypeScript type checking
- Code review automation
- Fix linting issues

**Invocation:**
```bash
Task(
  subagent_type="code-quality-agent",
  prompt="Run code quality checks for Stage 1.

  Tasks:
  1. ESLint - Fix all warnings/errors
  2. Prettier - Format all code
  3. TypeScript - Resolve type errors
  4. Unused imports/variables - Remove
  5. Code complexity - Refactor if >10

  Generate code quality report"
)
```

---

### Phase 7: Integration & Deployment (Day 7)

#### 17. `devops-deployment-specialist`
**Purpose:** Prepare for deployment
**Tasks:**
- Create production build
- Configure environment variables
- Set up PM2 configuration
- Create deployment scripts
- Configure monitoring

**Invocation:**
```bash
Task(
  subagent_type="devops-deployment-specialist",
  prompt="Prepare Stage 1 for production deployment.

  Tasks:
  1. Create optimized production build
  2. Configure .env.production
  3. Create PM2 ecosystem.config.js
  4. Write deployment script
  5. Set up error monitoring (Sentry/similar)
  6. Configure logging
  7. Database backup strategy

  Target server: 4GB RAM, 2 CPU (shared with N8N, Smilelab)
  Deployment method: PM2 (recommended from DEPLOYMENT-ANALYSIS.md)"
)
```

#### 18. `testing-report-generator`
**Purpose:** Generate comprehensive testing report
**Tasks:**
- Aggregate test results
- Generate coverage report
- Create testing documentation
- List known issues
- Acceptance criteria checklist

**Invocation:**
```bash
Task(
  subagent_type="testing-report-generator",
  prompt="Generate comprehensive testing report for Stage 1.

  Include:
  - Unit test results + coverage (≥80%)
  - E2E test results + coverage (≥90%)
  - Accessibility audit results (WCAG 2.1 AA)
  - Performance metrics (Lighthouse scores)
  - Security audit findings
  - Visual regression test results
  - Known issues/bugs
  - Acceptance criteria checklist (from STAGE1-TECHNICAL-SPEC.md)

  Format: Markdown report"
)
```

---

## 🔄 Orchestration Pipeline

### Option 1: Use Existing Pipeline (Recommended)

**Pipeline:** `orchestrai-domains/webdev/pipelines/design-development-pipeline.js`

This pipeline already includes:
- Frontend architecture design
- UI component development
- Backend API development
- Testing (unit, integration, E2E)
- Accessibility validation
- Performance optimization
- Deployment preparation

**Customize for Stage 1:**
```javascript
// Add to pipeline config
const stage1Config = {
  projectName: 'QuartzIQ Stage 1',
  technicalSpec: 'STAGE1-TECHNICAL-SPEC.md',
  designSpec: 'AIRTABLE-REPLACEMENT-UI-DESIGN.md',
  outputDir: '/src/app/leads/qualification',

  phases: [
    'architecture',
    'database',
    'ui-components',
    'forms-validation',
    'testing',
    'security',
    'deployment'
  ]
}
```

### Option 2: Create Custom Pipeline

**Pipeline:** `orchestrai-domains/webdev/pipelines/stage1-lead-qualification-pipeline.js`

```javascript
const Stage1Pipeline = {
  name: 'Stage 1: Lead Qualification',
  domain: 'webdev',
  estimatedDuration: 420, // 7 days in minutes (hypothetical)

  phases: [
    {
      name: 'Architecture & Planning',
      agents: [
        'frontend-architect-specialist',
        'api-architect',
        'design-system-architect'
      ],
      duration: 60,
      parallel: true
    },
    {
      name: 'Database & Backend',
      agents: [
        'backend-development-specialist',
        'api-integration-specialist'
      ],
      duration: 120,
      parallel: true
    },
    {
      name: 'UI Development',
      agents: [
        'ui-component-developer',
        'responsive-layout-optimizer'
      ],
      duration: 180,
      parallel: false,
      skills: ['frontend-design:frontend-design']
    },
    {
      name: 'Testing Suite',
      agents: [
        'e2e-test-automator',
        'accessibility-agent',
        'functional-testing-specialist',
        'performance-testing-expert',
        'visual-regression-tester'
      ],
      duration: 120,
      parallel: true
    },
    {
      name: 'Security & Quality',
      agents: [
        'security-testing-specialist',
        'code-quality-agent'
      ],
      duration: 60,
      parallel: true
    },
    {
      name: 'Deployment',
      agents: [
        'devops-deployment-specialist',
        'testing-report-generator'
      ],
      duration: 60,
      parallel: false
    }
  ],

  qualityGates: [
    { metric: 'testCoverage', threshold: 80, blocking: true },
    { metric: 'e2eCoverage', threshold: 90, blocking: true },
    { metric: 'accessibility', threshold: 100, blocking: true },
    { metric: 'lighthouse', threshold: 90, blocking: true },
    { metric: 'securityAudit', threshold: 0, blocking: true } // 0 critical issues
  ]
}
```

---

## 🎯 Execution Strategy

### Parallel Execution (Where Possible)

**Phase 1: Architecture (Day 1) - Parallel**
```bash
# Run simultaneously
Task(subagent_type="frontend-architect-specialist", ...)
Task(subagent_type="api-architect", ...)
Task(subagent_type="design-system-architect", ...)
```

**Phase 2: Backend (Day 2) - Parallel**
```bash
Task(subagent_type="backend-development-specialist", ...)
Task(subagent_type="api-integration-specialist", ...)
```

**Phase 3: UI (Days 3-4) - Sequential**
```bash
# First: Set up components
Task(subagent_type="ui-component-developer", ...)

# Then: Apply design polish
Skill(skill="frontend-design:frontend-design", ...)

# Finally: Optimize responsive
Task(subagent_type="responsive-layout-optimizer", ...)
```

**Phase 4: Testing (Days 5-6) - Parallel**
```bash
# Run all tests simultaneously
Task(subagent_type="e2e-test-automator", ...)
Task(subagent_type="accessibility-agent", ...)
Task(subagent_type="functional-testing-specialist", ...)
Task(subagent_type="performance-testing-expert", ...)
Task(subagent_type="visual-regression-tester", ...)
```

---

## 📊 Progress Tracking

### Agent Coordination

Use `orchestrai-master-coordinator` for overall coordination:

```bash
Task(
  subagent_type="orchestrai-master-coordinator",
  prompt="Coordinate Stage 1 Lead Qualification development.

  Phases:
  1. Architecture (3 agents, parallel)
  2. Backend (2 agents, parallel)
  3. UI Development (3 agents, sequential)
  4. Testing (5 agents, parallel)
  5. Security & Quality (2 agents, parallel)
  6. Deployment (2 agents, sequential)

  Monitor progress, resolve blockers, ensure quality gates pass.
  Reference: STAGE1-ORCHESTRATION-PLAN.md"
)
```

### Quality Gates (Automated Checks)

Hookify rules to enforce:
- ✅ Test coverage ≥ 80% before merge
- ✅ No accessibility violations
- ✅ Lighthouse score ≥ 90
- ✅ No critical security issues
- ✅ TypeScript compilation success

---

## 🚀 Kickoff Command

To start the entire pipeline:

```bash
# Option 1: Use existing pipeline
node orchestrai-domains/webdev/pipelines/design-development-pipeline.js \
  --project="QuartzIQ Stage 1" \
  --spec="STAGE1-TECHNICAL-SPEC.md" \
  --design="AIRTABLE-REPLACEMENT-UI-DESIGN.md"

# Option 2: Manual agent invocation (for more control)
# Start with architecture phase
```

---

## 📝 Success Metrics

- ✅ All 18 agent tasks completed
- ✅ All quality gates passed
- ✅ User acceptance criteria met
- ✅ Production-ready deployment package
- ✅ Comprehensive documentation
- ✅ Testing report with ≥80% coverage
- ✅ Zero critical security issues
- ✅ WCAG 2.1 AA compliant
- ✅ Lighthouse scores ≥90

**Estimated Completion: 7 working days**
