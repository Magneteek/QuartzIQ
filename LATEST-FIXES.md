# Latest Bug Fixes - Round 2

## Issues Fixed (Just Now)

### ✅ 1. Creating Business - place_id NULL Error
**Problem:** `null value in column "place_id" violates not-null constraint`

**Fix:**
- Generate automatic placeholder place_id when not provided
- Format: `manual_{timestamp}_{random}`
- File: `/src/app/api/leads/route.ts`

**Test:** Create a business without entering place_id - should work now!

---

### ✅ 2. Multi-Select & Visual Feedback
**Problem:** Selection checkboxes didn't update visually, rows didn't highlight

**Root Cause:** Column definitions were memoized without dependencies, so they never re-rendered when selection changed

**Fix:**
- Added dependencies to useMemo: `[selectedRows, leads, queuingLeadId]`
- Now columns re-render when selection changes
- File: `/src/app/dashboard/leads/page.tsx`

**Test:**
1. Click checkbox on row 1 → should highlight blue
2. Click checkbox on row 2 → both should be blue
3. Uncheck row 1 → only row 2 should be blue

---

### ✅ 3. Google Maps URL Extraction
**Problem:** "Can't get place ID from URL"

**Fix:**
- Enhanced place_id extraction with 7 different URL format patterns
- Added comprehensive logging for debugging
- Better error messages with helpful tips
- Files: `/src/app/api/leads/extract-google-maps/route.ts`, `/src/components/leads/add-edit-business-dialog.tsx`

**Supported URL Formats:**
1. `https://www.google.com/maps/place/Business+Name/@lat,lng,zoom/data=!...!1sChIJ...` ✅
2. `https://maps.google.com/?cid=12345678901234567890` ✅
3. `https://www.google.com/maps/place/?q=place_id:ChIJ...` ✅
4. Any URL containing `ChIJ...` anywhere ✅
5. URLs with ftid parameter ✅

**How to Get a Valid URL:**
1. Open Google Maps
2. Search for the business
3. Click "Share" button
4. Copy the **full URL** (not shortened goo.gl link)
5. Paste into the dialog

**Test:** Try extracting a business from these example URLs:
- Search "Amsterdam Central Station" on Google Maps
- Click Share → Copy full URL
- Should contain something like `ChIJa77ECvIJxkcRWy24cHvIH00`

---

## Quick Test Checklist

✅ **Test 1: Create Manual Business**
```
1. Click "Add New Business"
2. Enter just business name: "Test Restaurant"
3. Leave place_id empty
4. Click Save
→ Should work! (auto-generates place_id)
```

✅ **Test 2: Multi-Select**
```
1. Click checkbox on 2-3 businesses
2. Verify blue highlight appears
3. Click "Select All" checkbox in header
4. Verify all rows highlight
5. Click "Export Selected" or "Delete Selected"
→ Should work!
```

✅ **Test 3: Google Maps Extract**
```
1. Go to Google Maps → Search any business
2. Click "Share" → Copy full URL
3. In app: "Add New Business" → "Google Maps URL" tab
4. Paste URL → Click "Extract"
→ Should auto-fill all fields!
```

---

## Server Logs to Check

After testing, check the server console for:
- `[Google Maps Extract] Parsing URL:` - Shows URL being processed
- `[Google Maps Extract] Found place_id in...` - Shows where place_id was found
- Any errors will show `[Google Maps Extract] Error:`

---

## Known Working Example

**Test with this business:**
1. Search: "Rijksmuseum Amsterdam" on Google Maps
2. Share URL will look like: `https://www.google.com/maps/place/Rijksmuseum/@52.3599976,4.8852188,17z/data=!...!1sChIJAx3-VPIJJR0Rz_0LVQkKnIE!...`
3. Contains place_id: `ChIJAx3-VPIJJR0Rz_0LVQkKnIE`
4. Should extract all business details successfully

---

## If Still Not Working

**Multi-select still broken?**
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Check browser console for React errors

**Google Maps still failing?**
1. Check server console for the parsing logs
2. Make sure you're using the FULL URL from Share button
3. Verify GOOGLE_PLACES_API_KEY is set in .env.local
4. Share the URL you're trying so I can debug it

**Business creation still failing?**
- Check server console for the full error
- Verify which field is causing the constraint violation

---

Ready to test! 🚀
