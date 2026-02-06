# Automated Monitoring Cron Job - Setup Guide

## Overview

The automated monitoring system runs daily to check customers for new negative reviews. This guide shows you how to set it up.

---

## Step 1: Generate Cron Secret

Generate a secure random secret:

```bash
openssl rand -base64 32
```

Copy the output and add it to your `.env.local`:

```env
CRON_SECRET=your_generated_secret_here
```

---

## Step 2: Choose Your Cron Service

You have several options depending on where you're hosting:

### **Option A: Vercel Cron (Recommended if using Vercel)**

✅ **Already configured!** The `vercel.json` file is set up.

**Schedule:** Daily at 2 AM UTC
**No additional setup needed** - Vercel automatically runs it after deployment.

**Configuration (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/cron/monitoring",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Notes:**
- Available on Vercel Pro plans and higher
- Free tier: No cron support
- Automatically includes authorization header
- Logs visible in Vercel dashboard

---

### **Option B: External Cron Service (Self-hosted, DigitalOcean, Railway, etc.)**

Use a free external cron service to trigger your endpoint:

#### **Services to Use:**
1. **[cron-job.org](https://cron-job.org)** (Free, reliable)
2. **[EasyCron](https://www.easycron.com)** (Free tier available)
3. **[GitHub Actions](https://github.com/features/actions)** (Free for public repos)

#### **Setup Example (cron-job.org):**

1. Go to https://cron-job.org and sign up
2. Create new cron job:
   - **Title:** QuartzIQ Customer Monitoring
   - **URL:** `https://your-domain.com/api/cron/monitoring`
   - **Schedule:** `0 2 * * *` (Daily at 2 AM)
   - **Request Method:** GET
   - **Add Custom Header:**
     - Name: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET`

3. Save and enable

**That's it!** The service will hit your endpoint daily.

---

### **Option C: Server Cron (If you have SSH access)**

If you're self-hosting on a VPS/dedicated server:

```bash
# Edit your crontab
crontab -e

# Add this line (runs daily at 2 AM server time)
0 2 * * * curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/monitoring
```

**Or use a script:**

```bash
#!/bin/bash
# File: /home/user/quartziq-cron.sh

CRON_SECRET="your_cron_secret_here"
DOMAIN="https://your-domain.com"

curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$DOMAIN/api/cron/monitoring"
```

Make executable and add to cron:
```bash
chmod +x /home/user/quartziq-cron.sh
crontab -e
# Add: 0 2 * * * /home/user/quartziq-cron.sh
```

---

### **Option D: GitHub Actions (Free)**

Create `.github/workflows/monitoring-cron.yml`:

```yaml
name: Daily Customer Monitoring

on:
  schedule:
    # Runs daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Monitoring
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/monitoring
```

**Setup:**
1. Add `CRON_SECRET` to GitHub repository secrets
2. Commit the workflow file
3. Done! Runs daily automatically

---

## Step 3: Test Your Cron Setup

### **Manual Test:**

```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3069/api/cron/monitoring
```

**Expected Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-04T02:00:00.000Z",
  "summary": {
    "totalCustomers": 2,
    "successful": 2,
    "failed": 0,
    "totalNewReviews": 5,
    "totalNegativeReviews": 1,
    "totalAlertsCreated": 1,
    "totalCostUsd": 0.02,
    "durationSeconds": "12.5"
  }
}
```

### **Test Without Authorization (Should Fail):**

```bash
curl -X GET http://localhost:3069/api/cron/monitoring
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Step 4: Monitor Cron Executions

### **Check Logs:**

**Vercel:**
- Go to your project dashboard
- Click "Logs" tab
- Filter by `/api/cron/monitoring`

**Self-hosted:**
- Check your application logs
- Look for `[CRON]` prefixed messages

**Example Log Output:**
```
🔄 [CRON] Starting automated customer monitoring cycle...
📅 [CRON] Timestamp: 2026-02-04T02:00:00.000Z
✅ [CRON] Monitoring cycle complete: {
  customers: 2,
  newReviews: 5,
  negativeReviews: 1,
  alerts: 1,
  cost: "$0.02",
  duration: "12.5s"
}
```

---

## Cron Schedule Reference

Common schedules (in cron syntax):

```
0 2 * * *     # Daily at 2 AM
0 */12 * * *  # Every 12 hours
0 0 * * 0     # Weekly on Sunday at midnight
0 3 * * 1-5   # Weekdays at 3 AM
```

**Current Setting:** `0 2 * * *` (Daily at 2 AM)

---

## What Happens During Cron Execution?

1. ✅ Cron service calls `/api/cron/monitoring`
2. ✅ Verifies `Authorization: Bearer CRON_SECRET`
3. ✅ Fetches customers due for monitoring (using `get_customers_for_monitoring()`)
4. ✅ For each customer:
   - Crawls Google reviews
   - Compares with stored reviews
   - Detects new reviews
   - Filters negative reviews (1-3 stars with content)
   - Creates alerts in database
   - **Sends to GoHighLevel** (when Task #3 is complete)
   - Logs monitoring history
   - Schedules next check (+10-14 days)
5. ✅ Returns summary statistics

---

## Troubleshooting

### **"Unauthorized" error:**
- Check `CRON_SECRET` in `.env.local` matches header
- Ensure header format: `Authorization: Bearer YOUR_SECRET`

### **No customers found:**
- Run force-check first: `/api/monitoring/force-check`
- Verify customers have `monitoring_enabled = true`
- Check `next_monitoring_check` is not in the future

### **Reviews not detected:**
- Verify customers have valid `place_id`
- Check Apify API key is configured
- Look for errors in logs

### **Cron not triggering:**
- **Vercel:** Check you're on Pro plan
- **External:** Verify cron service is enabled
- **GitHub Actions:** Check workflow runs in Actions tab

---

## Security Notes

⚠️ **Important:**
- Never commit `CRON_SECRET` to git
- Use different secrets for dev/production
- Rotate secrets periodically
- Monitor unauthorized access attempts

---

## Next Steps

- ✅ Set up cron (this guide)
- ⏳ Implement GHL webhook integration (Task #3)
- ⏳ Test end-to-end flow with real customers

**Once Task #3 is complete, your customers will automatically receive notifications about negative reviews!** 🎉
