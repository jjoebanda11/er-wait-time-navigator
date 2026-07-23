-- Migration 001 — capture provenance
--
-- Run once against an existing database. Safe to re-run; every statement is
-- IF NOT EXISTS. New installs get this from schema.sql already and do not need
-- to run it.
--
-- Why this exists. Without it, a gap in the series is ambiguous: we cannot tell
-- whether nobody sampled that window or whether AHS was down. A researcher
-- cannot correct for a bias they cannot see, so an archive without capture
-- provenance is only good for our own trend charts — it is not credible enough
-- to publish or license. These columns cannot be backfilled, which is why it is
-- worth doing while the table is small.

-- ---------------------------------------------------------------------------
-- Per-reading provenance
-- ---------------------------------------------------------------------------

-- The wall-clock moment we actually read the feed. captured_at is floored to a
-- bucket for deduplication, so it is deliberately not the real observation time.
ALTER TABLE wait_snapshots
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

-- The exact string AHS published, e.g. '3 hr 38 min' or 'Wait times
-- unavailable'. Lets any future correction to the parser be applied to history
-- instead of invalidating it.
ALTER TABLE wait_snapshots
  ADD COLUMN IF NOT EXISTS raw_wait_time TEXT;

-- ---------------------------------------------------------------------------
-- Per-run provenance
-- ---------------------------------------------------------------------------
-- One row per capture attempt, including the ones that wrote nothing. This is
-- the table that makes a gap interpretable: a missing window with a failed run
-- recorded is an upstream outage, a missing window with no run at all is a
-- scheduler miss, and those two are not the same fact.

CREATE TABLE IF NOT EXISTS capture_runs (
  id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket         TIMESTAMPTZ,
  -- success | stale_skipped | upstream_empty | upstream_error | write_error
  status         TEXT        NOT NULL,
  facilities_seen INTEGER    NOT NULL DEFAULT 0,
  rows_written   INTEGER     NOT NULL DEFAULT 0,
  duration_ms    INTEGER,
  -- 'cron' for the scheduler, 'manual' for a hand-triggered run.
  trigger_source TEXT        NOT NULL DEFAULT 'cron',
  error          TEXT
);

CREATE INDEX IF NOT EXISTS capture_runs_started_idx
  ON capture_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS capture_runs_status_idx
  ON capture_runs (status, started_at DESC);
