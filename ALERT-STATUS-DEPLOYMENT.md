# Alert Status System Deployment Guide

## What Was Changed

### Database Migration (Migration 020)
**File:** `database/migrations/020_improve_alert_status_tracking.sql`

Added new columns to `customer_monitoring_alerts` table:
- `status` VARCHAR(20) - Alert workflow status: 'new', 'in_progress', 'resolved', 'dismissed'
- `ghl_webhook_sent` BOOLEAN - Tracks if alert was sent to GHL
- `ghl_webhook_sent_at` TIMESTAMP - When webhook was sent

Migrated existing data:
- Resolved alerts → 'resolved'
- Acknowledged but not resolved → 'in_progress'
- New alerts → 'new'

### Backend API Updates

#### Updated: `/src/app/api/monitoring/alerts/route.ts`
- GET endpoint now returns `status`, `ghl_webhook_sent`, `ghl_webhook_sent_at` fields
- Updated statistics to track by status instead of acknowledged_at/resolved_at
- Updated filters to use new status values: 'new', 'in_progress', 'resolved', 'dismissed', 'unresolved'
- New stats: `newAlerts`, `inProgress`, `unresolved`, `webhooksSent`

#### Created: `/src/app/api/alerts/[id]/status/route.ts`
- PATCH endpoint to update alert status
- Validates status: 'new', 'in_progress', 'resolved', 'dismissed'
- Sets timestamps: `acknowledged_at` for 'in_progress', `resolved_at` for 'resolved'
- Accepts optional `notes` parameter for resolution notes

#### Updated: `/src/lib/services/customer-monitoring.ts`
- Alert creation sets `status = 'new'` and `ghl_webhook_sent = false`
- After successful webhook send, updates `ghl_webhook_sent = true` and sets timestamp

### Frontend UI Updates

#### Updated: `/src/app/dashboard/monitoring/page.tsx`
- Updated Alert interface with new fields: `status`, `ghl_webhook_sent`, `ghl_webhook_sent_at`
- Updated Stats interface with new fields
- Status column now shows color-coded badges:
  - **New** = Blue (Bell icon)
  - **In Progress** = Yellow (Clock icon)
  - **Resolved** = Green (CheckCircle2 icon)
  - **Dismissed** = Gray (XCircle icon)
- Added "Webhook Sent" badge when `ghl_webhook_sent = true`
- Updated stats cards: New, In Progress, Resolved, Unresolved, Critical
- Updated status filter dropdown with new values
- Alert detail dialog shows:
  - Current status badge
  - GHL webhook sent status
  - Action buttons: "Mark In Progress", "Mark Resolved", "Dismiss"
- Replaced `handleAction` with `handleStatusChange` using new PATCH endpoint

### Created Files
- `scripts/run-migration-020.ts` - Migration script
- `ALERT-STATUS-DEPLOYMENT.md` - This deployment guide

## Deployment Steps

### 1. Commit Changes to Git
```bash
git add .
git commit -m "feat: Add simplified alert status tracking with GHL webhook monitoring

- Migration 020: Add status, ghl_webhook_sent fields
- Update API to use new status field
- Add /api/alerts/[id]/status endpoint
- Update monitoring UI with color-coded status badges
- Show webhook sent indicator
- Simplify workflow: new → in_progress → resolved (or dismissed)"

git push origin main
```

### 2. Deploy to Production Server
```bash
# SSH into production server
ssh root@your-server-ip

# Navigate to project directory
cd /root/quartz-iq

# Pull latest changes
git pull origin main

# Install dependencies (if any new ones)
npm install

# Run the migration
npx tsx scripts/run-migration-020.ts

# Rebuild the application
npm run build

# Restart PM2
pm2 restart quartz-iq
pm2 save
```

### 3. Verify Deployment
1. Check migration output shows alert status counts
2. Navigate to https://iq.quartzleads.com/dashboard/monitoring
3. Verify stats cards show: New, In Progress, Resolved, Unresolved, Critical
4. Check alert table shows status badges and webhook indicators
5. Open an alert and verify action buttons: "Mark In Progress", "Mark Resolved", "Dismiss"
6. Test status updates work correctly
7. Verify filter dropdown has new status options

### 4. Test Alert Workflow
1. Wait for or trigger a negative review for a monitored customer
2. Alert should appear with status = 'new'
3. Check "Webhook Sent" badge appears (GHL notification sent)
4. Click "Mark In Progress" → status changes to yellow
5. Click "Mark Resolved" → status changes to green
6. Verify timestamps are set correctly

## Status Workflow

```
new (blue)
  ↓ [Mark In Progress]
in_progress (yellow)
  ↓ [Mark Resolved]
resolved (green)

OR

new (blue)
  ↓ [Mark Resolved] (skips in_progress)
resolved (green)

OR

new/in_progress
  ↓ [Dismiss]
dismissed (gray)
```

## GHL Webhook Tracking

When a new alert is created:
1. Alert status = 'new', ghl_webhook_sent = false
2. System sends webhook to GHL
3. On success: ghl_webhook_sent = true, ghl_webhook_sent_at = current timestamp
4. UI shows "Webhook Sent" badge on alert

## Database Schema Changes

```sql
-- New columns added
ALTER TABLE customer_monitoring_alerts
ADD COLUMN status VARCHAR(20) DEFAULT 'new'
  CHECK (status IN ('new', 'in_progress', 'resolved', 'dismissed'));

ALTER TABLE customer_monitoring_alerts
ADD COLUMN ghl_webhook_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN ghl_webhook_sent_at TIMESTAMP;

-- Indexes for performance
CREATE INDEX idx_alerts_status ON customer_monitoring_alerts(status);
CREATE INDEX idx_alerts_webhook_sent ON customer_monitoring_alerts(ghl_webhook_sent);

-- Helper function
CREATE FUNCTION get_unresolved_alerts_count(customer_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM customer_monitoring_alerts
  WHERE business_id = customer_id
    AND status IN ('new', 'in_progress')
$$ LANGUAGE SQL STABLE;
```

## Rollback Plan (if needed)

If issues occur, you can revert to old workflow:
1. The old `acknowledged_at` and `resolved_at` fields still exist
2. The old POST endpoint at `/api/monitoring/alerts` still works
3. Migration 020 only adds new fields, doesn't remove old ones
4. To rollback UI: `git revert HEAD` then redeploy

## Notes

- Migration preserves all existing data
- Old acknowledge/resolve fields still exist for backward compatibility
- New status field is the source of truth going forward
- UI is cleaner with 4 clear states instead of nullable timestamps
- Webhook tracking helps verify GHL integration is working
