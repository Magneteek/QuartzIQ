# Two-Phase Deployment Plan - Alert Status System

## The Problem
We updated code to use new database fields before adding those fields to the database.
This caused all alerts to disappear because the API queries failed.

## The Solution: Two-Phase Deployment

### Phase 1: Deploy Database Migration ONLY ✅
Add new columns to database WITHOUT changing any code.
System continues working normally with old logic.

### Phase 2: Deploy Code Changes ✅
Update API and UI to use the new fields.
Safe because fields already exist from Phase 1.

---

## PHASE 1: Database Migration (DO THIS FIRST)

### What Gets Deployed
- `database/migrations/020_improve_alert_status_tracking.sql` - Adds new columns
- `scripts/run-migration-020.ts` - Script to run migration
- `src/app/api/alerts/[id]/` - New status update endpoint (doesn't break anything)
- `src/app/api/customers/[id]/remove/` - Remove customer feature
- `src/components/ui/alert-dialog.tsx` - UI component for remove customer

### Deployment Steps

```bash
# 1. Commit Phase 1 files
git add database/migrations/020_improve_alert_status_tracking.sql
git add scripts/run-migration-020.ts
git add src/app/api/alerts/
git add src/app/api/customers/[id]/remove/
git add src/components/ui/alert-dialog.tsx
git commit -m "feat: Phase 1 - Add alert status tracking migration and remove customer feature"
git push origin main

# 2. SSH to production
ssh root@your-server-ip

# 3. Pull changes
cd /root/quartz-iq
git pull origin main

# 4. Install dependencies (for new UI component)
npm install @radix-ui/react-alert-dialog

# 5. RUN THE MIGRATION
npx tsx scripts/run-migration-020.ts

# 6. Rebuild (includes new remove customer feature)
npm run build
pm2 restart quartz-iq
pm2 save
```

### Verify Phase 1
1. Check migration output shows alert counts
2. Go to https://iq.quartzleads.com/dashboard/monitoring
3. Alerts should still be visible (using old logic)
4. Go to https://iq.quartzleads.com/dashboard/customers
5. "Remove" button should appear on customers
6. Test removing a customer (makes it a lead again)

### What This Achieves
- ✅ Database now has: `status`, `ghl_webhook_sent`, `ghl_webhook_sent_at` columns
- ✅ All existing alerts migrated to new status field
- ✅ System still works with old logic (backward compatible)
- ✅ Remove customer feature is now live
- ✅ Safe to deploy Phase 2

---

## PHASE 2: Update Code to Use New Fields (DO THIS AFTER PHASE 1)

### What Gets Deployed
Stashed changes that update API and UI to use the new status fields.

### Deployment Steps

```bash
# 1. Unstash the changes
git stash pop

# 2. Commit Phase 2 files
git add src/app/api/monitoring/alerts/route.ts
git add src/app/dashboard/monitoring/page.tsx
git add src/lib/services/customer-monitoring.ts
git commit -m "feat: Phase 2 - Update monitoring UI to use new alert status system

- Update API to return and filter by status field
- Add color-coded status badges (new, in_progress, resolved, dismissed)
- Show webhook sent indicator
- Update stats cards and filters
- Use new /api/alerts/[id]/status endpoint
- Simplify action buttons: Mark In Progress, Mark Resolved, Dismiss"

git push origin main

# 3. SSH to production
ssh root@your-server-ip

# 4. Pull and deploy
cd /root/quartz-iq
git pull origin main
npm run build
pm2 restart quartz-iq
pm2 save
```

### Verify Phase 2
1. Go to https://iq.quartzleads.com/dashboard/monitoring
2. Check stats cards show: New, In Progress, Resolved, Unresolved, Critical
3. Check alert table shows color-coded status badges
4. Check "Webhook Sent" badge appears on alerts that were sent to GHL
5. Open an alert and verify new action buttons
6. Test status workflow: New → In Progress → Resolved
7. Test Dismiss button
8. Test all status filters

---

## Current Status

✅ **Changes Stashed** - Your alerts are visible again
✅ **Migration Created** - Ready for Phase 1
✅ **Deployment Docs** - This guide + ALERT-STATUS-DEPLOYMENT.md

## Next Step

Run Phase 1 deployment now to:
1. Add database fields safely
2. Enable "Remove Customer" feature
3. Prepare for Phase 2 (new alert status UI)

After Phase 1 is verified working, we'll do Phase 2 to get the new status UI.
