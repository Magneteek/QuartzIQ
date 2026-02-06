# GoHighLevel - Negative Review Alert Webhook Setup

## Overview

When a negative review is detected for a monitored customer, QuartzIQ automatically sends alert data to GoHighLevel to:
- Create/update contact with review information
- Apply tags for automation triggers
- Create opportunity in pipeline
- Populate custom fields
- Trigger automated workflows

---

## Step 1: Configure Custom Fields in GHL

Before setting up the webhook, create these **custom fields** in GoHighLevel:

### Go to: Settings → Custom Fields → Create New Field

| Field Name | Field Type | API Key | Purpose |
|------------|-----------|---------|---------|
| Business Name | Text | `business_name` | Name of the business |
| Review Rating | Number | `review_rating` | Star rating (1-5) |
| Review Text | Text Area | `review_text` | Full review content |
| Review Date | Date | `review_date` | When review was posted |
| Reviewer Name | Text | `reviewer_name` | Name of reviewer |
| Alert Severity | Dropdown | `alert_severity` | critical, high, medium, low |
| Google Place ID | Text | `place_id` | Google Maps identifier |
| Business Category | Text | `business_category` | Type of business |

**Important:** Copy the **Field ID** for each custom field (you'll need these for mapping in `.env`).

---

## Step 2: Update Environment Variables

Add these to your `.env.local`:

```env
# GHL API Configuration (you already have these)
GHL_API_KEY=your_ghl_api_key_here
GHL_LOCATION_ID=your_ghl_location_id_here

# GHL Custom Field IDs (replace with YOUR actual field IDs)
GHL_FIELD_BUSINESS_NAME=<field_id_from_ghl>
GHL_FIELD_REVIEW_RATING=<field_id_from_ghl>
GHL_FIELD_REVIEW_TEXT=<field_id_from_ghl>
GHL_FIELD_REVIEW_DATE=<field_id_from_ghl>
GHL_FIELD_REVIEWER_NAME=<field_id_from_ghl>
GHL_FIELD_ALERT_SEVERITY=<field_id_from_ghl>
GHL_FIELD_PLACE_ID=<field_id_from_ghl>
GHL_FIELD_BUSINESS_CATEGORY=<field_id_from_ghl>
```

**How to get Field IDs:**
1. In GHL, go to Settings → Custom Fields
2. Click on a custom field to edit it
3. Look at the URL or field settings - you'll see the field ID (usually starts with `contact.`)
4. Copy each field ID and paste into `.env.local`

---

## Step 3: Create GHL Automation Workflow

### Go to: Automation → Create New Workflow

**Trigger:** Contact Tagged → `Negative-Review-Alert`

**Actions:**

1. **Send Email to Team**
   - To: Your team email
   - Subject: `🚨 Negative Review Alert - {{contact.custom_field.business_name}}`
   - Body:
   ```
   A new {{contact.custom_field.review_rating}}-star review was detected:

   Business: {{contact.custom_field.business_name}}
   Category: {{contact.custom_field.business_category}}

   Review: "{{contact.custom_field.review_text}}"
   Reviewer: {{contact.custom_field.reviewer_name}}
   Date: {{contact.custom_field.review_date}}
   Severity: {{contact.custom_field.alert_severity}}

   Action Required:
   1. Review the feedback immediately
   2. Contact the customer to address concerns
   3. Determine if review removal is appropriate

   View in QuartzIQ: http://localhost:3069/dashboard/monitoring
   ```

2. **Send SMS to Business Owner** (Optional)
   - To: {{contact.phone}}
   - Message: "We detected a {{contact.custom_field.review_rating}}-star review for {{contact.custom_field.business_name}}. Please check your dashboard."

3. **Create Task**
   - Assign to: Your team member
   - Title: "Address Negative Review - {{contact.custom_field.business_name}}"
   - Due: Today

4. **Add to Pipeline**
   - Pipeline: "Review Management"
   - Stage: "Negative Review Detected"

---

## Step 4: Create GHL Pipeline (Optional)

### Go to: Opportunities → Create Pipeline

**Pipeline Name:** "Review Management"

**Stages:**
1. Negative Review Detected
2. Customer Contacted
3. Issue Resolved
4. Review Removed (or Response Posted)

This allows you to track the progress of each alert through your workflow.

---

## Step 5: Test the Integration

### Option A: Manual Test (Recommended)

Run this test script to send a test alert to GHL:

```bash
NODE_OPTIONS='--require dotenv/config' npx tsx scripts/test-ghl-alert.ts dotenv_config_path=.env.local
```

### Option B: Trigger Real Alert

1. Acknowledge one of the existing alerts in QuartzIQ dashboard
2. Create a new alert manually (I can help with this)
3. Check GHL to verify:
   - Contact created/updated
   - Tags applied
   - Custom fields populated
   - Automation triggered

---

## Step 6: What Gets Sent to GHL

When a negative review is detected, QuartzIQ sends this data:

**Standard Contact Fields:**
- Name: Business name
- Email: Business email (if available)
- Phone: Business phone (if available)
- Website: Business website
- Address: Business location

**Tags Applied:**
- `Negative-Review-Alert` (triggers automation)
- `Customer`
- `{severity}-Severity` (e.g., `Critical-Severity`)
- `{stars}-Star-Review` (e.g., `1-Star-Review`)

**Custom Fields Populated:**
- All fields from Step 1 above

**Opportunity Created:**
- Pipeline: "Negative Review Alerts" (auto-created)
- Stage: "New Alert"
- Value: $500 (configurable)
- Name: "Negative Review - {Business Name}"

---

## Step 7: Verify Integration

After setup, verify everything works:

1. **Check Contact Created:**
   - Go to GHL Contacts
   - Search for the business name
   - Verify all fields are populated

2. **Check Tags Applied:**
   - Open the contact
   - Look for tags: `Negative-Review-Alert`, `Customer`, etc.

3. **Check Automation Triggered:**
   - Go to Automation → Workflow History
   - Verify workflow ran for the contact
   - Check if email/SMS/task was created

4. **Check Opportunity Created:**
   - Go to Opportunities
   - Look for "Negative Review - {Business Name}"
   - Verify it's in the correct pipeline/stage

---

## Troubleshooting

### Issue: Custom fields not populating

**Solution:**
- Verify field IDs in `.env.local` are correct
- Check that field API keys match
- Try using field IDs instead of API keys

### Issue: Automation not triggering

**Solution:**
- Verify workflow is active/published
- Check trigger is set to `Negative-Review-Alert` tag
- Test manually by adding tag to a contact

### Issue: Contact not created

**Solution:**
- Verify `GHL_API_KEY` and `GHL_LOCATION_ID` are correct
- Check API key has correct permissions (create contacts, opportunities)
- Review server logs for API errors

### Issue: Duplicate contacts created

**Solution:**
- QuartzIQ tries to match by email or phone first
- Ensure consistent email/phone data in system
- Check GHL duplicate detection settings

---

## Configuration Reference

**Current Setup (from your .env.local):**
- ✅ GHL_API_KEY: Configured
- ✅ GHL_LOCATION_ID: Configured
- ⚠️ Custom Field Mappings: Need to be configured

**Next Steps:**
1. Create custom fields in GHL (Step 1)
2. Update `.env.local` with field IDs (Step 2)
3. Create automation workflow (Step 3)
4. Test integration (Step 5)

---

## Sample Test Alert Payload

This is what QuartzIQ sends to GHL:

```json
{
  "name": "Stedelijk Museum Amsterdam",
  "email": "info@stedelijk.nl",
  "phone": "+31 20 573 2911",
  "website": "https://www.stedelijk.nl",
  "address1": "Museumplein 10",
  "city": "Amsterdam",
  "country": "NL",
  "tags": [
    "Negative-Review-Alert",
    "Customer",
    "Critical-Severity",
    "1-Star-Review"
  ],
  "customField": {
    "business_name": "Stedelijk Museum Amsterdam",
    "review_rating": 1,
    "review_text": "Terrible experience. Staff was rude...",
    "review_date": "2026-02-04",
    "reviewer_name": "John Doe",
    "alert_severity": "critical",
    "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "business_category": "Museum"
  }
}
```

---

## Ready to Test?

Once you've completed Steps 1-2, let me know and I'll:
1. Create a test script to send a sample alert to GHL
2. Help verify the integration is working correctly
3. Test the automation workflow

**Current Status:**
- ✅ Monitoring system working
- ✅ Alerts being detected
- ⏳ GHL webhook integration (waiting for custom fields setup)
