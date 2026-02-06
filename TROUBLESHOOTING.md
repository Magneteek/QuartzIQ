# QuartzIQ Troubleshooting Guide

## Duplicate Business Error

### ✅ What Was Fixed
When adding a business that already exists, you'll now see a **red error banner** in the dialog (not a browser alert) that explains:
- Which business already exists
- What stage it's in (lead/qualified)
- Suggestions for what to do next

### 🧪 How to Test
1. Go to Lead Qualification page
2. Click "Add New Business"
3. Try to add a business that already exists (use same Google Maps URL or exact same business name)
4. You should see a **red error box** at the top of the dialog explaining the duplicate

### ❌ If Error Still Doesn't Show
- Check browser console (F12) for the 409 response
- Make sure the dialog isn't closing automatically
- Refresh the page and try again

---

## Process Queue Button

### ⚙️ What It Does
The "Process Queue" button on the Enrichment page automatically enriches leads using:
1. Claude website research (FREE)
2. Apollo API (if needed - costs $0.01-0.02 per lead)

### 📋 Prerequisites
You MUST have these environment variables set in `.env.local`:

```env
# Required - get from https://apollo.io/settings/integrations
APOLLO_API_KEY=your_apollo_key_here

# Optional but recommended - get from https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### 🧪 How to Test
1. **Queue some leads first**:
   - Go to Lead Qualification page
   - Select leads with websites
   - Click "Import to Quartz" (Send icon) for each lead

2. **Go to Enrichment page**:
   - You should see leads with "pending" status
   - The "Process Queue (X)" button should show the count

3. **Click "Process Queue"**:
   - Browser will ask: "Start automatic enrichment for all pending leads in queue?"
   - Click **OK** (not Cancel!)
   - Check browser console (F12) for logs starting with `[Process Queue]`

### ❌ Common Issues

#### Button is Disabled
- **Cause**: No pending leads in queue
- **Fix**: Queue some leads from Lead Qualification page first

#### Button Doesn't Respond
- Check browser console for errors
- Logs should show: `[Process Queue] Button clicked`
- If you see nothing, there might be a JavaScript error

#### "Apollo API key not configured" Error
- **Cause**: Missing `APOLLO_API_KEY` in `.env.local`
- **Fix**: Add the API key and restart the dev server (`npm run dev`)

#### "Failed to process queue" Error
- Check browser console for detailed error
- Check server logs in terminal for backend errors
- Common causes:
  - Missing API keys
  - Invalid API keys
  - No businesses have websites (Claude research skipped)
  - Database connection issues

---

## Manual Enrichment

### 📝 How It Works
You can manually enrich leads by clicking the "Enrich" button on any pending lead.

### ✅ Required Fields
To click **"Complete Enrichment"**, you MUST fill:
- ✅ First Name
- ✅ Last Name
- ✅ Email Address

### ⚠️ Why Button is Disabled
The "Complete Enrichment" button will be **disabled** (grayed out) if:
- First name is empty
- Last name is empty
- Email is empty

### 🔄 "Save Progress" vs "Complete Enrichment"
- **Save Progress**: Saves partial data, status stays "in_progress"
- **Complete Enrichment**: Requires all 3 fields, moves to "completed" status

### 💡 Data Source Options
- **Manual Research**: You looked up the info yourself
- **Apollo.io**: You used Apollo's website/tools
- **Apify**: You used Apify's scraping tools
- **Multiple Sources**: You combined data from different places

The data source is just for tracking - it doesn't affect functionality.

---

## Checking Environment Variables

Run this in your terminal to verify your setup:

```bash
# Check if .env.local exists
ls -la .env.local

# Check if variables are set (won't show actual values for security)
grep "APOLLO_API_KEY" .env.local
grep "ANTHROPIC_API_KEY" .env.local
```

Expected output:
```
APOLLO_API_KEY=apllo_xxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

---

## Debug Checklist

### For Duplicate Error Not Showing
- [ ] Error shows 409 status in browser console
- [ ] Red error banner appears in dialog
- [ ] Dialog stays open after error
- [ ] Error message explains the duplicate

### For Process Queue Not Working
- [ ] Button shows count of pending leads
- [ ] Button is NOT disabled (should be blue, not gray)
- [ ] Clicking button shows browser confirmation
- [ ] Clicking "OK" on confirmation starts processing
- [ ] Browser console shows `[Process Queue]` logs
- [ ] API keys are set in `.env.local`
- [ ] Dev server was restarted after adding API keys

### For Manual Enrichment Button Disabled
- [ ] First name field is filled
- [ ] Last name field is filled
- [ ] Email field is filled (and valid format)
- [ ] No validation errors showing

---

## Getting More Help

1. **Check browser console** (F12 → Console tab)
   - Look for errors in red
   - Look for `[Process Queue]` logs

2. **Check server logs** (terminal where `npm run dev` is running)
   - Look for API errors
   - Look for database errors

3. **Verify API keys work**:
   ```bash
   # Test Apollo API (replace with your key)
   curl -H "Authorization: Bearer YOUR_APOLLO_KEY" \
        https://api.apollo.io/api/v1/auth/health
   ```

4. **Check database**:
   ```bash
   # Verify enrichment queue has items
   psql -d your_database -c "SELECT COUNT(*) FROM enrichment_queue WHERE status = 'queued';"
   ```
