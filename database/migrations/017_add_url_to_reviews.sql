-- Migration 017: Add URL column to reviews table
-- This stores the direct link to the review on Google Maps or other platforms

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS url TEXT;

CREATE INDEX IF NOT EXISTS idx_reviews_url ON reviews(url);

COMMENT ON COLUMN reviews.url IS 'Direct URL to the review on the platform (e.g., Google Maps review link)';
