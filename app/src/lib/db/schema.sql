-- ER Wait Time Navigator — database schema
--
-- Target: any standard Postgres. Verified against Neon and Supabase free tiers.
-- Apply with:  psql "$DATABASE_URL" -f src/lib/db/schema.sql
--
-- Everything here is optional. The app runs fully without a database; this adds
-- historical trends, "best time to go" predictions, and wait-threshold alerts.

-- ---------------------------------------------------------------------------
-- Wait time history
-- ---------------------------------------------------------------------------
-- One row per facility per capture. This table is the compounding asset of the
-- business: AHS publishes only the current number and keeps no public history,
-- so every day this runs widens a moat no competitor can backfill.

CREATE TABLE IF NOT EXISTS wait_snapshots (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_slug TEXT        NOT NULL,
  region        TEXT        NOT NULL,
  facility_name TEXT        NOT NULL,
  kind          TEXT        NOT NULL,
  wait_minutes  INTEGER,               -- NULL when AHS reported it unavailable
  -- Written by the ingester rounded down to a fixed bucket (see BUCKET_MINUTES
  -- in history.ts), never defaulted to now(). Bucketing is what makes the
  -- dedupe index below meaningful: a retried or overlapping cron run lands on
  -- the same bucket and is rejected instead of duplicating the reading.
  captured_at   TIMESTAMPTZ NOT NULL,
  -- Provenance. captured_at is floored to a bucket for deduplication, so it is
  -- deliberately not the real observation time; fetched_at is. raw_wait_time
  -- preserves exactly what AHS published, so a future correction to the parser
  -- can be applied to history rather than invalidating it.
  fetched_at    TIMESTAMPTZ,
  raw_wait_time TEXT
);

-- One row per capture attempt, including attempts that wrote nothing. This is
-- what makes a gap in the series interpretable: a missing window with a failed
-- run recorded is an upstream outage; a missing window with no run at all is a
-- scheduler miss. Those are different facts, and an archive that cannot tell
-- them apart is not credible enough to publish or license.
CREATE TABLE IF NOT EXISTS capture_runs (
  id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket          TIMESTAMPTZ,
  -- success | stale_skipped | upstream_empty | upstream_error | write_error
  status          TEXT        NOT NULL,
  facilities_seen INTEGER     NOT NULL DEFAULT 0,
  rows_written    INTEGER     NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  trigger_source  TEXT        NOT NULL DEFAULT 'cron',
  error           TEXT
);

CREATE INDEX IF NOT EXISTS capture_runs_started_idx
  ON capture_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS capture_runs_status_idx
  ON capture_runs (status, started_at DESC);

-- Primary read pattern: one facility's recent history, newest first.
CREATE INDEX IF NOT EXISTS wait_snapshots_facility_time_idx
  ON wait_snapshots (facility_slug, captured_at DESC);

-- Secondary: a whole region at a point in time, for board-level analytics.
CREATE INDEX IF NOT EXISTS wait_snapshots_region_time_idx
  ON wait_snapshots (region, captured_at DESC);

-- Guards against a retried cron run double-inserting the same capture.
CREATE UNIQUE INDEX IF NOT EXISTS wait_snapshots_dedupe_idx
  ON wait_snapshots (facility_slug, captured_at);

-- ---------------------------------------------------------------------------
-- Push alert subscriptions
-- ---------------------------------------------------------------------------
-- Deliberately minimal. We store a push endpoint, which facility the user cares
-- about, and a threshold. No name, no email, no health information — there is
-- nothing here that identifies a person or a medical condition.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             TEXT        PRIMARY KEY,
  endpoint       TEXT        NOT NULL UNIQUE,
  p256dh         TEXT        NOT NULL,
  auth           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Populated only when billing is switched on and the user has paid.
  stripe_customer_id      TEXT,
  subscription_tier       TEXT NOT NULL DEFAULT 'free',
  subscription_status     TEXT,
  subscription_expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id              TEXT        PRIMARY KEY,
  subscription_id TEXT        NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  facility_slug   TEXT        NOT NULL,
  facility_name   TEXT        NOT NULL,
  -- Notify when the posted wait drops to or below this many minutes.
  threshold_minutes INTEGER   NOT NULL CHECK (threshold_minutes > 0),
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rate limiting: never notify about the same facility twice in quick
  -- succession, or a wait hovering at the threshold becomes a spam machine.
  last_notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alert_rules_facility_idx
  ON alert_rules (facility_slug) WHERE active;

CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_unique_idx
  ON alert_rules (subscription_id, facility_slug);

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- Raw snapshots stay useful for trend building for about a year. Run this
-- periodically to keep a free-tier database inside its size limit.
--
--   DELETE FROM wait_snapshots WHERE captured_at < now() - INTERVAL '400 days';
