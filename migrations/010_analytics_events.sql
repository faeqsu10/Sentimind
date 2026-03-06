-- Analytics events table for user behavior tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_guest BOOLEAN DEFAULT true,
  properties JSONB DEFAULT '{}'::jsonb,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  theme TEXT CHECK (theme IN ('light', 'dark')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_analytics_event ON analytics_events(event);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);
CREATE INDEX idx_analytics_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;

-- No RLS needed — analytics is write-only from server, read-only for admins
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Server inserts via service_role key (bypasses RLS)
-- Admin read policy (optional, for dashboard queries)
CREATE POLICY analytics_admin_read ON analytics_events
  FOR SELECT USING (auth.role() = 'service_role');
