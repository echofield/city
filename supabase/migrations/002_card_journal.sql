-- FLOW Card Journal v1.6
-- Append-only trace of every card revision during a driver's shift.
-- Rule: only write when card_hash changes OR every 15 min max.
-- This is the trust layer — "what FLOW told you, and when."

-- ── Card Journal (append-only) ──

CREATE TABLE IF NOT EXISTS driver_card_journal (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id       UUID NOT NULL,  -- groups entries within one night session
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  card_hash      TEXT NOT NULL,
  card_payload   JSONB NOT NULL,
  top_opportunity_id  TEXT,
  top_zone       TEXT,           -- denormalized for quick queries
  confidence     DECIMAL(3,2) DEFAULT 0,
  stale          BOOLEAN DEFAULT FALSE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  revision_reason TEXT NOT NULL CHECK (revision_reason IN (
    'initial',
    'new_top',
    'opportunity_expired',
    'opportunity_added',
    'weather_shift',
    'transport_disruption',
    'confidence_change',
    'pack_refresh',
    'driver_profile_change',
    'scheduled'
  ))
);

-- Fast lookups: driver's recent journals, and shift timeline
CREATE INDEX idx_journal_driver_date
  ON driver_card_journal(driver_id, created_at DESC);

CREATE INDEX idx_journal_shift
  ON driver_card_journal(shift_id, created_at ASC);

-- Dedup check: don't insert if same hash exists for this shift
CREATE INDEX idx_journal_shift_hash
  ON driver_card_journal(shift_id, card_hash);


-- ── Nightly Feedback (one row per shift) ──
-- "Ça a servi ?" — binary, no surveillance, no GPS.

CREATE TABLE IF NOT EXISTS nightly_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id       UUID NOT NULL,
  shift_date     DATE NOT NULL,
  served         BOOLEAN NOT NULL,          -- "ça a servi ?" ✅/❌
  long_ride      BOOLEAN,                   -- "course longue ?" (optional)
  top_zones      TEXT[] DEFAULT '{}',       -- denormalized: which zones FLOW recommended
  top_causes     TEXT[] DEFAULT '{}',       -- denormalized: which cause_types appeared
  card_count     INTEGER DEFAULT 0,         -- how many revisions tonight
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, shift_date)
);

CREATE INDEX idx_feedback_driver
  ON nightly_feedback(driver_id, shift_date DESC);


-- ── Driver Shift Sessions ──
-- Tracks when a shift starts/ends. Links journal entries.

CREATE TABLE IF NOT EXISTS driver_shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date     DATE NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  anchor_zone    TEXT,                      -- from driver profile tonight
  ride_preference TEXT CHECK (ride_preference IN ('courtes', 'longues', 'peu_importe')),
  end_time_target TEXT,                     -- "02h", "04h", "matin"
  risk_tolerance  TEXT CHECK (risk_tolerance IN ('faible', 'moyen', 'fort')),
  card_revisions  INTEGER DEFAULT 0,
  UNIQUE(driver_id, shift_date)
);

CREATE INDEX idx_shifts_driver
  ON driver_shifts(driver_id, shift_date DESC);


-- ── RLS Policies ──

ALTER TABLE driver_card_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE nightly_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;

-- Drivers see only their own journal
CREATE POLICY "driver_journal_select" ON driver_card_journal
  FOR SELECT USING (auth.uid() = driver_id);

-- Drivers can insert their own journal entries (written by API on their behalf)
CREATE POLICY "driver_journal_insert" ON driver_card_journal
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Drivers see only their own feedback
CREATE POLICY "feedback_select" ON nightly_feedback
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "feedback_insert" ON nightly_feedback
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "feedback_update" ON nightly_feedback
  FOR UPDATE USING (auth.uid() = driver_id);

-- Drivers see only their own shifts
CREATE POLICY "shifts_select" ON driver_shifts
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "shifts_insert" ON driver_shifts
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "shifts_update" ON driver_shifts
  FOR UPDATE USING (auth.uid() = driver_id);


-- ── Service role can write all (for API/cron) ──
-- The API writes journal entries on behalf of the driver.
-- Service role bypasses RLS by default in Supabase.
-- No additional policy needed for server-side writes.
