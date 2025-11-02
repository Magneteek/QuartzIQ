# Search Query Improvements - Implementation Summary

## Problem Statement

The original search query generation was inefficient and unrealistic:

1. **Repetitive Queries**: Searching "hospital Netherlands", "hospital Nederland", "hospital Dutch", "beste hospital Netherlands" found the same businesses repeatedly
2. **Poor Geographic Coverage**: Country-level searches returned primarily Amsterdam-area businesses
3. **Unrealistic Search Patterns**: Real users search "hospital Amsterdam" not "hospital Netherlands"
4. **APIFY Quota Waste**: 4 similar queries returning duplicate results

## Solution Implemented

### 1. City-Based Search Strategy (Netherlands)

For country-level location searches ("Netherlands" or "Nederland"), the system now:

- Searches **4 major Dutch cities** individually: Amsterdam, Rotterdam, Utrecht, Den Haag
- Uses **localized category names** with city (e.g., "ziekenhuis Amsterdam")
- Adds **English variation** for international businesses (e.g., "hospital Amsterdam")

**Example transformation:**
```
BEFORE (repetitive country-level):
- "hospital Netherlands"
- "hospital Nederland"
- "hospital Dutch"
- "beste hospital Netherlands"

AFTER (city-based diversity):
- "ziekenhuis Amsterdam"
- "ziekenhuis Rotterdam"
- "ziekenhuis Utrecht"
- "ziekenhuis Den Haag"
- "hospital Amsterdam"
```

### 2. City-Specific Search Patterns

For specific city searches (e.g., "Eindhoven"), the system uses diverse Dutch patterns:

- Basic: `{category} {city}` → "tandarts Eindhoven"
- English: `{category_en} {city}` → "dentist Eindhoven"
- In location: `{category} in {city}` → "tandarts in Eindhoven"
- Near location: `{category} nabij {city}` → "tandarts nabij Eindhoven"

### 3. Complete Dutch Translation Dictionary

Added **100+ Dutch translations** for all official Google Business categories:

#### Healthcare & Medical (10 categories)
- dentist → tandarts
- hospital → ziekenhuis
- medical_clinic → medische kliniek
- pharmacy → apotheek
- physical_therapist → fysiotherapeut
- ... and more

#### Beauty & Wellness (7 categories)
- beauty_salon → schoonheidssalon
- hair_salon → kapper
- gym → sportschool
- massage_therapist → massagetherapeut

#### Food & Dining (8 categories)
- restaurant → restaurant
- cafe → café
- bakery → bakkerij
- pizza_restaurant → pizzeria

#### Professional Services (10 categories)
- lawyer → advocaat
- accountant → accountant
- real_estate_agency → makelaar
- insurance_agency → verzekering

#### Home Services (10 categories)
- plumber → loodgieter
- electrician → elektricien
- hvac_contractor → installatiebedrijf
- locksmith → slotenmaker

#### Automotive, Education, Entertainment, Pet Services, Technology (20+ categories)
- Complete translations for all remaining sectors

## Expected Improvements

### Business Discovery
- **4-5x more unique businesses** per extraction
- **Better geographic distribution** across Netherlands
- **Reduced duplicate findings** across queries

### Search Accuracy
- **Native language matching** improves Google Maps results
- **Realistic search patterns** match user behavior
- **Category-specific translations** (tandarts, ziekenhuis, makelaar)

### Cost Efficiency
- **Fewer wasted API calls** on duplicate searches
- **Better APIFY quota utilization** per extraction
- **More valuable results** per API credit spent

## Technical Implementation

### File Changes
- **extractor.ts** (`generateSearchQueries()` function, line 213-245)
  - Netherlands case now detects country vs city searches
  - Major cities array: `['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag']`
  - City-specific patterns with "in" and "nabij" variations

- **extractor.ts** (`translateBusinessCategory()` function, line 477-569)
  - Expanded Dutch translation dictionary from 9 to 100+ entries
  - Organized by sector for maintainability
  - Covers all new Google Business Profile categories

### Code Structure
```typescript
case 'nl': // Netherlands
  // For country-level searches, use major cities
  if (location.toLowerCase() === 'netherlands' || location.toLowerCase() === 'nederland') {
    const majorCities = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag']
    majorCities.forEach(city => {
      queries.push(`${localizedCategory} ${city}`)
    })
    if (localizedCategory !== category) {
      queries.push(`${category} Amsterdam`) // English variation
    }
  } else {
    // For city-specific searches, diverse patterns
    queries.push(
      `${localizedCategory} ${location}`,
      `${category} ${location}`,
      `${localizedCategory} in ${location}`,
      `${localizedCategory} nabij ${location}`
    )
  }
  break
```

## Testing & Validation

### Test Case: Hospital Search in Netherlands

**Old behavior:**
- Query: "hospital Netherlands"
- Result: ~16 businesses (mostly Amsterdam)
- Duplicates: High overlap across 4 similar queries

**Expected new behavior:**
- Queries: "ziekenhuis Amsterdam", "ziekenhuis Rotterdam", "ziekenhuis Utrecht", "ziekenhuis Den Haag", "hospital Amsterdam"
- Result: ~80+ unique businesses across 4 cities
- Duplicates: Minimal - each city returns different businesses

### Monitoring Success
- Compare business count before/after for same category + Netherlands
- Check geographic distribution (businesses across multiple cities)
- Monitor APIFY quota usage efficiency (results per API credit)
- Verify Dutch translations in server logs during extraction

## Next Steps

1. **Test Extraction**: Run "hospital Netherlands" extraction to validate improvements
2. **Monitor Logs**: Check server output for translated queries ("ziekenhuis Amsterdam")
3. **Compare Results**: Analyze business count and geographic diversity vs previous extractions
4. **APIFY Usage**: Track API credit efficiency improvements

## Implementation Date
October 9, 2025 - Commit f52b974

## Related Commits
- `2b30313` - Replace custom categories with Google Business official categories
- `f52b974` - Improve search query generation with city-based searches and complete translations
