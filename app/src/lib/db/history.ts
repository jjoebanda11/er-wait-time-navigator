import type { NormalizedFacility } from '../ahs/types';
import { db, safeQuery } from './client';

/**
 * Capture bucket size, in minutes.
 *
 * Snapshots are stamped with the current time floored to this interval, which
 * makes the unique index in schema.sql a real guard against duplicate rows from
 * retried or overlapping cron runs.
 */
export const BUCKET_MINUTES = 10;

export function bucketTimestamp(date = new Date()): Date {
  const ms = BUCKET_MINUTES * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/** Persist one capture of the whole board. Returns rows written. */
export async function recordSnapshot(
  facilities: NormalizedFacility[],
  capturedAt = bucketTimestamp(),
  fetchedAt = new Date(),
): Promise<number> {
  const sql = db();
  if (!sql || facilities.length === 0) return 0;

  const rows = facilities.map((f) => ({
    facility_slug: f.slug,
    region: f.region,
    facility_name: f.name,
    kind: f.kind,
    wait_minutes: f.waitMinutes,
    captured_at: capturedAt,
    fetched_at: fetchedAt,
    raw_wait_time: f.rawWaitTime,
  }));

  return safeQuery(async (client) => {
    const result = await client`
      INSERT INTO wait_snapshots ${client(
        rows,
        'facility_slug',
        'region',
        'facility_name',
        'kind',
        'wait_minutes',
        'captured_at',
        'fetched_at',
        'raw_wait_time',
      )}
      ON CONFLICT (facility_slug, captured_at) DO NOTHING
    `;
    return result.count ?? 0;
  }, 0);
}

/** Outcome of a capture attempt, including attempts that wrote nothing. */
export type CaptureStatus =
  | 'success'
  | 'stale_skipped'
  | 'upstream_empty'
  | 'upstream_error'
  | 'write_error';

export interface CaptureRun {
  status: CaptureStatus;
  bucket?: Date | null;
  facilitiesSeen?: number;
  rowsWritten?: number;
  durationMs?: number;
  triggerSource?: string;
  error?: string | null;
}

/**
 * Record that a capture was attempted and how it went.
 *
 * Must be called on every path, including failures. A gap in `wait_snapshots`
 * with a corresponding failed run is an upstream outage; a gap with no run at
 * all is a scheduler miss. Those are different facts, and only this table can
 * tell them apart after the moment has passed.
 */
export async function recordCaptureRun(run: CaptureRun): Promise<void> {
  await safeQuery(
    (sql) => sql`
      INSERT INTO capture_runs
        (bucket, status, facilities_seen, rows_written, duration_ms, trigger_source, error)
      VALUES (
        ${run.bucket ?? null},
        ${run.status},
        ${run.facilitiesSeen ?? 0},
        ${run.rowsWritten ?? 0},
        ${run.durationMs ?? null},
        ${run.triggerSource ?? 'cron'},
        ${run.error ?? null}
      )
    `,
    undefined,
  );
}

export interface TrendPoint {
  /** 0 = Sunday, matching JavaScript's `getDay()`. */
  dayOfWeek: number;
  hour: number;
  averageMinutes: number;
  sampleCount: number;
}

/**
 * Average wait by day-of-week and hour for one facility.
 *
 * Computed in Alberta local time, because "Tuesday at 7pm" has to mean what a
 * user in Edmonton means by it, not what UTC means by it.
 */
export async function getFacilityTrends(
  facilitySlug: string,
  days = 90,
): Promise<TrendPoint[]> {
  return safeQuery(async (sql) => {
    const rows = await sql<
      { day_of_week: number; hour: number; avg_minutes: number; samples: number }[]
    >`
      SELECT
        EXTRACT(DOW  FROM captured_at AT TIME ZONE 'America/Edmonton')::int AS day_of_week,
        EXTRACT(HOUR FROM captured_at AT TIME ZONE 'America/Edmonton')::int AS hour,
        AVG(wait_minutes)::float                                            AS avg_minutes,
        COUNT(*)::int                                                       AS samples
      FROM wait_snapshots
      WHERE facility_slug = ${facilitySlug}
        AND wait_minutes IS NOT NULL
        AND captured_at > now() - (${days} || ' days')::interval
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;

    return rows.map((r) => ({
      dayOfWeek: r.day_of_week,
      hour: r.hour,
      averageMinutes: r.avg_minutes,
      sampleCount: r.samples,
    }));
  }, []);
}

export interface RecentPoint {
  capturedAt: string;
  waitMinutes: number | null;
}

/** Raw recent readings for a facility, for the sparkline on its detail page. */
export async function getRecentHistory(
  facilitySlug: string,
  hours = 48,
): Promise<RecentPoint[]> {
  return safeQuery(async (sql) => {
    const rows = await sql<{ captured_at: Date; wait_minutes: number | null }[]>`
      SELECT captured_at, wait_minutes
      FROM wait_snapshots
      WHERE facility_slug = ${facilitySlug}
        AND captured_at > now() - (${hours} || ' hours')::interval
      ORDER BY captured_at ASC
    `;

    return rows.map((r) => ({
      capturedAt: r.captured_at.toISOString(),
      waitMinutes: r.wait_minutes,
    }));
  }, []);
}

export interface QuietWindow {
  dayOfWeek: number;
  hour: number;
  averageMinutes: number;
}

/**
 * The quietest hours for a facility, as a "best time to go" recommendation.
 *
 * Requires a minimum sample count per bucket so a single unusual Tuesday cannot
 * become advice. Returns an empty list until enough history exists, and callers
 * must present that honestly rather than inventing a recommendation.
 */
export async function getQuietWindows(
  facilitySlug: string,
  limit = 5,
  minSamples = 4,
): Promise<QuietWindow[]> {
  const trends = await getFacilityTrends(facilitySlug);
  return trends
    .filter((t) => t.sampleCount >= minSamples)
    .sort((a, b) => a.averageMinutes - b.averageMinutes)
    .slice(0, limit)
    .map(({ dayOfWeek, hour, averageMinutes }) => ({ dayOfWeek, hour, averageMinutes }));
}

/** How much history we have, used to decide whether to show trends at all. */
export async function getHistoryCoverage(): Promise<{
  totalRows: number;
  oldestCapture: string | null;
  facilitiesTracked: number;
}> {
  return safeQuery(
    async (sql) => {
      const [row] = await sql<
        { total: number; oldest: Date | null; facilities: number }[]
      >`
        SELECT
          COUNT(*)::int                      AS total,
          MIN(captured_at)                   AS oldest,
          COUNT(DISTINCT facility_slug)::int AS facilities
        FROM wait_snapshots
      `;
      return {
        totalRows: row?.total ?? 0,
        oldestCapture: row?.oldest ? row.oldest.toISOString() : null,
        facilitiesTracked: row?.facilities ?? 0,
      };
    },
    { totalRows: 0, oldestCapture: null, facilitiesTracked: 0 },
  );
}

export interface CaptureHealth {
  totalRuns: number;
  successfulRuns: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  recentFailures: { status: string; startedAt: string; error: string | null }[];
}

/**
 * Capture reliability, for the operator and for anyone assessing the archive's
 * completeness. Publishing this alongside the data is what lets a third party
 * judge whether a gap is ours or upstream's.
 */
export async function getCaptureHealth(days = 7): Promise<CaptureHealth> {
  return safeQuery(
    async (sql) => {
      const [summary] = await sql<
        { total: number; ok: number; last_run: Date | null; last_success: Date | null }[]
      >`
        SELECT
          COUNT(*)::int                                                  AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int                AS ok,
          MAX(started_at)                                                AS last_run,
          MAX(started_at) FILTER (WHERE status = 'success')              AS last_success
        FROM capture_runs
        WHERE started_at > now() - (${days} || ' days')::interval
      `;

      const failures = await sql<{ status: string; started_at: Date; error: string | null }[]>`
        SELECT status, started_at, error
        FROM capture_runs
        WHERE status <> 'success'
          AND started_at > now() - (${days} || ' days')::interval
        ORDER BY started_at DESC
        LIMIT 10
      `;

      return {
        totalRuns: summary?.total ?? 0,
        successfulRuns: summary?.ok ?? 0,
        lastRunAt: summary?.last_run ? summary.last_run.toISOString() : null,
        lastSuccessAt: summary?.last_success ? summary.last_success.toISOString() : null,
        recentFailures: failures.map((f) => ({
          status: f.status,
          startedAt: f.started_at.toISOString(),
          error: f.error,
        })),
      };
    },
    {
      totalRuns: 0,
      successfulRuns: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      recentFailures: [],
    },
  );
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDayHour(dayOfWeek: number, hour: number): string {
  const day = DAY_NAMES[dayOfWeek] ?? 'Unknown';
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${day} around ${display}${suffix}`;
}
