# Business Categories - Google Business Profile Mapping

This document explains how business categories work in the frontend vs backend.

## Frontend Display vs Backend Mapping

The frontend shows user-friendly category names, but the backend uses specific Google Business Profile category IDs:

| Frontend Display | Backend Category ID | Google Business Profile |
|-----------------|-------------------|----------------------|
| Dental - Dentist | `tandarts` | dentist |
| Medical & Cosmetic | `doctor` | doctor, medical_center |
| Luxury Retail & Jewelers | `jewelry_store` | jewelry_store |
| High-End Car Dealers | `car_dealer` | car_dealer |
| Financial & Business Services | `financial_consultant` | financial_consultant |
| Legal / Professional Services | `lawyer` | lawyer, law_firm |
| Real Estate & Housing | `real_estate_agency` | real_estate_agency |
| Wellness & Lifestyle | `spa` | spa, beauty_salon |
| Insurance Agency | `insurance_agency` | insurance_agency |
| Custom Category | `custom` | User-defined |

## How It Works

1. **Frontend**: Users see descriptive labels like "Legal / Professional Services"
2. **Form Submission**: The form sends the category ID (e.g., `lawyer`) to the backend
3. **Backend Processing**: The extractor uses the category ID for Google Business searches
4. **Search Optimization**: The backend can map category IDs to multiple related Google categories

## Adding New Categories

To add a new category:

1. Add it to the `businessCategories` array in `search-form.tsx`
2. Include proper mapping in the backend extractor if needed
3. Test with actual Google Business Profile searches

## Notes

- The `tandarts` category is kept as-is since it works well for Dutch dental searches
- Custom categories allow users to enter their own search terms
- The backend should validate category IDs and provide appropriate fallbacks