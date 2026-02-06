-- Migration 018: Sync google_profile_url to google_maps_url
-- When businesses are added via Google Maps URL, google_profile_url is populated
-- but google_maps_url (used by review crawler) is NULL
-- This migration copies google_profile_url to google_maps_url where needed

UPDATE businesses
SET google_maps_url = google_profile_url
WHERE google_profile_url IS NOT NULL
  AND google_maps_url IS NULL;

COMMENT ON COLUMN businesses.google_maps_url IS 'Google Maps URL used for review crawling - synced from google_profile_url when needed';
