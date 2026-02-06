# GoHighLevel (GHL) Integration - Complete Setup Guide

## Overview

QuartzIQ has **two-way integration** with GoHighLevel CRM:

1. **Outbound**: Negative reviews detected → Send alerts to GHL
2. **Inbound**: GHL contact tagged as "customer" → Auto-add to QuartzIQ

---

## Prerequisites

Before starting, ensure you have:
- GoHighLevel account with API access
- QuartzIQ deployed and accessible via public URL
- Database migrations completed (especially migration 006 & 013)

---

## Part 1: Environment Configuration

### Step 1: Generate Webhook Secret

Generate a secure random secret for webhook authentication:

```bash
openssl rand -base64 32
```

### Step 2: Configure Environment Variables

Add these to your `.env.local` or `.env`:

```env
# GoHighLevel API Configuration
GHL_API_KEY=your_ghl_api_key_here
GHL_LOCATION_ID=your_ghl_location_id_here

# Webhook Security
GHL_WEBHOOK_SECRET=your_generated_secret_here

# Custom Field Mappings (optional - for advanced customization)
GHL_FIELD_BUSINESS_NAME=custom_field_business_name_id
GHL_FIELD_REVIEW_RATING=custom_field_review_rating_id
GHL_FIELD_REVIEW_TEXT=custom_field_review_text_id
GHL_FIELD_BUSINESS_CATEGORY=custom_field_business_category_id
GHL_FIELD_REVIEW_DATE=custom_field_review_date_id
```

### Where to Find GHL Credentials:

**GHL API Key:**
1. Log into GoHighLevel
2. Go to Settings → API
3. Generate or copy your API key

**GHL Location ID:**
1. Go to Settings → Business Profile
2. Copy the Location ID from the URL or settings page

---

## Part 2: Outbound Integration (Negative Review → GHL)

### How It Works

When the automated monitoring system detects a **new negative review** (1-3 stars with content):

1. ✅ Alert created in QuartzIQ database
2. ✅ Contact sent to GoHighLevel via API
3. ✅ Contact auto-tagged: `Negative-Review-Alert`, `Customer`, `{stars}-Star-Review`
4. ✅ Custom fields populated with review data
5. ✅ Opportunity created in GHL pipeline
6. ✅ GHL automation can trigger (email, SMS, task creation, etc.)

### What Gets Sent to GHL

**Contact Fields:**
- Name: Business name
- Email: Business email
- Phone: Business phone
- Website: Business website
- Address: Business location
- Tags: Auto-applied tags for filtering/automation

**Custom Fields:**
- Business name
- Review rating (1-5 stars)
- Review text
- Review date
- Reviewer name
- Review URL
- Business category
- Google Place ID

**Opportunity:**
- Pipeline stage: "Negative Review Detected"
- Value: $500 (default - for tracking)
- Name: "Negative Review - {Business Name}"

### GHL Automation Setup

1. **Create Custom Fields** (if not already created):
   - Go to Settings → Custom Fields
   - Create fields for: `business_name`, `review_rating`, `review_text`, `review_date`, `place_id`, etc.
   - Copy the field IDs and add to `.env` (optional)

2. **Create Workflow/Automation**:
   - Trigger: Contact tagged with `Negative-Review-Alert`
   - Actions:
     - Send email to team
     - Send SMS to business owner
     - Create task for team member
     - Add to pipeline
     - Schedule follow-up call

3. **Example Email Template**:
   ```
   Subject: 🚨 New Negative Review Alert - {{contact.custom_field.business_name}}

   A new {{contact.custom_field.review_rating}}-star review was detected:

   Review: "{{contact.custom_field.review_text}}"
   Date: {{contact.custom_field.review_date}}
   Business: {{contact.custom_field.business_name}}

   Action Required:
   1. Review the feedback
   2. Contact the customer
   3. Request review removal if appropriate

   View in QuartzIQ: [Dashboard Link]
   ```

### Testing Outbound Integration

You can test the outbound integration by:

1. **Force-check a customer** to trigger immediate monitoring:
   ```bash
   curl -X POST http://localhost:3069/api/monitoring/force-check \
     -H "Content-Type: application/json" \
     -d '{"businessIds": ["customer-uuid-here"]}'
   ```

2. **Check the logs** for GHL API calls:
   ```
   [MONITORING] Sending alert to GHL for business: xyz
   [GHL] Contact created/updated: ghl_xyz123
   [GHL] Opportunity created: opp_xyz456
   ```

3. **Verify in GHL**:
   - Go to Contacts → Search for business name
   - Check tags, custom fields, and opportunity

---

## Part 3: Inbound Integration (GHL → QuartzIQ)

### How It Works

When a contact in GoHighLevel is tagged as **"customer"** (or related tags):

1. ✅ GHL sends webhook to QuartzIQ
2. ✅ QuartzIQ validates the webhook secret
3. ✅ Contact data fetched from GHL API
4. ✅ Customer created/updated in QuartzIQ database
5. ✅ Monitoring enabled automatically
6. ✅ **First check happens immediately** (not in 14 days)
7. ✅ Customer appears in Customers page

### Webhook Endpoint

**URL**: `https://your-domain.com/api/webhooks/ghl/customer-tagged`

**Method**: `POST`

**Authentication**: Bearer token in header

### Step 1: Configure Webhook in GoHighLevel

1. **Go to Settings → Webhooks** in GHL

2. **Create New Webhook**:
   - **Name**: QuartzIQ Customer Sync
   - **URL**: `https://your-domain.com/api/webhooks/ghl/customer-tagged`
   - **Event**: `contact.tag_added` or `contact.updated`
   - **Method**: POST

3. **Add Custom Headers**:
   - **Header Name**: `x-webhook-secret`
   - **Header Value**: `your_ghl_webhook_secret_here`

   OR

   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer your_ghl_webhook_secret_here`

4. **Save and Enable**

### Step 2: Tag Format

The webhook will process contacts tagged with any of these (case-insensitive):
- `customer`
- `paying customer`
- `client`

You can customize this in `/src/app/api/webhooks/ghl/customer-tagged/route.ts`:
```typescript
const customerTags = ['customer', 'paying customer', 'client']
```

### Step 3: Required GHL Custom Fields

For best results, ensure your GHL contacts have these custom fields:

**Recommended Custom Fields:**
- `place_id` or `google_place_id` - Google Maps Place ID (critical for monitoring)
- `company_name` or `business_name` - Business name
- `category` or `niche_category` - Business category/industry
- `website` - Business website

### Step 4: Webhook Payload Format

GHL will send a payload like this:

```json
{
  "type": "contact.tag_added",
  "contactId": "ghl_contact_id_123",
  "locationId": "ghl_location_id",
  "tag": "customer",
  "contact": {
    "id": "ghl_contact_id_123",
    "name": "John's Restaurant",
    "email": "john@restaurant.com",
    "phone": "+1234567890",
    "website": "https://johnsrestaurant.com",
    "address1": "123 Main St",
    "city": "San Francisco",
    "country": "US",
    "customField": {
      "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "company_name": "John's Restaurant",
      "category": "Restaurant"
    }
  }
}
```

### Testing Inbound Integration

#### Test 1: Manual Webhook Test

```bash
curl -X POST https://your-domain.com/api/webhooks/ghl/customer-tagged \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "type": "contact.tag_added",
    "contactId": "test_123",
    "locationId": "loc_123",
    "tag": "customer",
    "contact": {
      "id": "test_123",
      "name": "Test Restaurant",
      "email": "test@restaurant.com",
      "phone": "+1234567890",
      "website": "https://testrestaurant.com",
      "customField": {
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "company_name": "Test Restaurant",
        "category": "Restaurant"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "customerId": "uuid-of-created-customer",
  "action": "created",
  "monitoringEnabled": true
}
```

#### Test 2: Tag a Real Contact in GHL

1. Go to GHL Contacts
2. Open a contact
3. Add tag: `customer`
4. Check QuartzIQ Customers page - should appear within seconds

#### Test 3: Check Webhook Logs

**In QuartzIQ logs:**
```
[GHL Webhook] Received: { type: 'contact.tag_added', contactId: 'xyz', tag: 'customer' }
[GHL Webhook] Created new customer: uuid-xyz
```

**In GHL:**
- Go to Settings → Webhooks → Your Webhook
- Click "Recent Deliveries"
- Check status codes (200 = success)

### Security Notes

⚠️ **Important Security Measures:**

1. **Never expose your webhook secret** in client-side code
2. **Always validate the webhook secret** before processing
3. **Use HTTPS** for production webhooks
4. **Monitor unauthorized attempts** in your logs
5. **Rotate secrets periodically**

### Troubleshooting Inbound Integration

#### "Unauthorized" error:
- Check that `GHL_WEBHOOK_SECRET` in `.env` matches the header value in GHL
- Ensure header format is correct: `Authorization: Bearer YOUR_SECRET` or `x-webhook-secret: YOUR_SECRET`

#### "No unique identifier found":
- Ensure contact has either `place_id` in custom fields OR `email` field
- Check that custom field names match expected values

#### "Tag not relevant, skipping":
- Verify the tag name matches one of the customer tags
- Check for typos or extra spaces in tag name

#### Contact not appearing in QuartzIQ:
- Check server logs for errors
- Verify database migrations are complete
- Ensure contact has required fields (name, email or place_id)

#### Duplicate customers created:
- System checks by `place_id` first, then `email`
- If neither matches, a new customer is created
- Ensure consistent use of unique identifiers

---

## Part 4: End-to-End Testing

### Complete Integration Test

1. **Setup Phase**:
   - ✅ Configure all environment variables
   - ✅ Deploy application to production URL
   - ✅ Configure GHL webhook
   - ✅ Create GHL automation workflow

2. **Test Inbound**:
   - Tag a contact in GHL as "customer"
   - Verify customer appears in QuartzIQ Customers page
   - Check monitoring is enabled
   - Verify `next_monitoring_check` is set to NOW (immediate first check)

3. **Test Monitoring**:
   - Run cron job manually or wait for schedule
   - Check logs for monitoring execution
   - Verify reviews are crawled

4. **Test Outbound** (when negative review exists):
   - Create or wait for negative review
   - Check QuartzIQ Customers page for alert
   - Verify contact appears in GHL with correct tags
   - Check GHL opportunity is created
   - Verify automation triggers (email/SMS sent)

---

## Part 5: Production Deployment Checklist

### Before Going Live:

- [ ] All environment variables configured in production
- [ ] Database migrations applied to production database
- [ ] GHL API key has correct permissions (read/write contacts, create opportunities)
- [ ] Webhook secret generated and secured
- [ ] Application deployed to public URL with HTTPS
- [ ] GHL webhook configured and enabled
- [ ] GHL automation workflow created and tested
- [ ] Custom fields created in GHL
- [ ] Cron job scheduled (see CRON-SETUP.md)
- [ ] Error monitoring/logging configured
- [ ] Team trained on workflow

### Monitoring Production:

**Key Metrics to Watch:**
- Webhook delivery success rate (in GHL)
- Customer creation/update success rate
- Monitoring cycle completion rate
- GHL API success rate
- Alert creation and delivery rate

**Log Locations:**
- QuartzIQ: Application logs (console or log files)
- GHL: Settings → Webhooks → Recent Deliveries
- Cron: Cron execution logs

---

## Part 6: Advanced Configuration

### Custom Field Mapping

If your GHL custom fields use different names, update the webhook handler:

Edit `/src/app/api/webhooks/ghl/customer-tagged/route.ts`:

```typescript
const customFields = contact.customField || {}
const placeId = customFields.your_place_id_field || customFields.google_place_id
const businessName = customFields.your_business_field || contact.name
const category = customFields.your_category_field || customFields.industry
```

### Monitoring Frequency Override

To set custom monitoring frequency per customer:

```sql
UPDATE businesses
SET monitoring_frequency_hours = 168  -- 7 days
WHERE id = 'customer-uuid';
```

Or add UI controls in the Customers page for per-customer settings.

### Custom Alert Thresholds

To customize alert threshold per customer:

```sql
UPDATE businesses
SET monitoring_alert_threshold = 2  -- Only 1-2 stars
WHERE id = 'customer-uuid';
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      GoHighLevel CRM                         │
│                                                              │
│  Contact Tagged "customer" ──────┐                          │
│                                   │                          │
│                                   ▼                          │
│                             [Webhook Trigger]                │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                                    │ POST /api/webhooks/ghl/customer-tagged
                                    │ Header: x-webhook-secret
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        QuartzIQ App                          │
│                                                              │
│  1. Validate webhook secret                                 │
│  2. Fetch contact data from GHL API                         │
│  3. Create/Update customer in database                      │
│  4. Enable monitoring (next_check = NOW)                    │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │   Automated Monitoring (Cron Daily)    │                │
│  │                                         │                │
│  │  1. Get customers due for monitoring   │                │
│  │  2. Crawl Google reviews               │                │
│  │  3. Detect new negative reviews        │                │
│  │  4. Create alerts in database          │                │
│  │  5. Send to GHL ──────────┐            │                │
│  └───────────────────────────┼────────────┘                │
│                               │                              │
└───────────────────────────────┼──────────────────────────────┘
                                │
                                │ POST https://rest.gohighlevel.com/v1/contacts
                                │ Header: Authorization: Bearer GHL_API_KEY
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      GoHighLevel CRM                         │
│                                                              │
│  1. Contact created/updated                                 │
│  2. Tags applied (Negative-Review-Alert, Customer, etc.)   │
│  3. Custom fields populated                                 │
│  4. Opportunity created                                     │
│  5. Automation triggered ──────────┐                        │
│                                     │                        │
│                                     ▼                        │
│                          [Email/SMS/Task Created]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Support

If you encounter issues:

1. Check logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test webhook delivery in GHL dashboard
4. Ensure database migrations are complete
5. Check CRON-SETUP.md for monitoring configuration

**Common Issues:**
- **Webhook not firing**: Check GHL webhook is enabled and URL is correct
- **Monitoring not running**: See CRON-SETUP.md for cron configuration
- **Customers not syncing**: Verify webhook secret and GHL API key
- **Alerts not sending to GHL**: Check GHL_API_KEY has correct permissions

---

## Next Steps

✅ Complete this setup
✅ Test end-to-end flow
⏳ Add advanced filtering to Leads page (Task #4)
⏳ Build monitoring dashboard with real-time alerts
⏳ Add email/SMS notification options
⏳ Create customer portal for self-service
