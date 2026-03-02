-- FLOW Intelligence Engine Schema
-- Run this migration to add intelligence tables

-- Add profile_state to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_state JSONB DEFAULT NULL;

-- Driver feedback (V1 simple)
CREATE TABLE IF NOT EXISTS driver_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 0, 1)),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_feedback_user ON driver_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_feedback_brief ON driver_feedback(brief_id);

-- Brief run metadata (for pipeline monitoring)
CREATE TABLE IF NOT EXISTS brief_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_mode TEXT NOT NULL CHECK (run_mode IN ('daily', 'weekly', 'intraday_alert')),
  horizon TEXT NOT NULL CHECK (horizon IN ('24h', '7d')),
  profiles_processed INTEGER DEFAULT 0,
  briefs_generated INTEGER DEFAULT 0,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  tokens_used INTEGER DEFAULT 0,
  confidence_avg DECIMAL(3,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  errors TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_brief_runs_date ON brief_runs(started_at DESC);

-- Source items (city signals packs)
CREATE TABLE IF NOT EXISTS source_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_date DATE NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('24h', '7d')),
  content_json JSONB NOT NULL,
  sources_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(pack_date, horizon)
);

CREATE INDEX IF NOT EXISTS idx_source_items_date ON source_items(pack_date DESC);

-- RLS Policies
ALTER TABLE driver_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own feedback
CREATE POLICY "Users can view own feedback" ON driver_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON driver_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brief runs visible to authenticated users (for transparency)
CREATE POLICY "Authenticated users can view brief runs" ON brief_runs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Source items visible to authenticated users
CREATE POLICY "Authenticated users can view source items" ON source_items
  FOR SELECT USING (auth.role() = 'authenticated');
