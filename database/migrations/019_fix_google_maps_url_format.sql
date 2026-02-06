-- Migration 019: Fix google_maps_url format for Apify compatibility
-- The Search API format doesn't work reliably with Apify
-- Change from: https://www.google.com/maps/search/?api=1&query=NAME&query_place_id=ID
-- Change to: https://www.google.com/maps/place/?q=place_id:ID

UPDATE businesses
SET google_maps_url = 'https://www.google.com/maps/place/?q=place_id:' || place_id
WHERE google_maps_url LIKE '%google.com/maps/search%'
  AND place_id IS NOT NULL
  AND place_id != '';

COMMENT ON COLUMN businesses.google_maps_url IS 'Google Maps URL using place_id format for reliable Apify scraping';
