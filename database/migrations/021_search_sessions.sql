-- Search Sessions tracking
-- Records every discovery search so users can see history and re-run searches

CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  country_code VARCHAR(10),
  businesses_found INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'completed',  -- 'running', 'completed', 'failed'
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  zoom INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_sessions_category ON search_sessions(category);
CREATE INDEX IF NOT EXISTS idx_search_sessions_location ON search_sessions(location);
