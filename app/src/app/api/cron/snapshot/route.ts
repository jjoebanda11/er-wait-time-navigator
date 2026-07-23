import { NextResponse } from 'next/server';
import { getWaitTimes } from '@/lib/ahs/client';
import { config } from '@/lib/config';
import { bucketTimestamp, recordCaptureRun, recordSnapshot } from '@/lib/db/history';
import { dispatchAlerts } from '@/lib/push/dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled capture.
 *
 * Two jobs: append the current board to the history table, and fire any
 * wait-threshold alerts that have become true since the last run.
 *
 * Every exit path records a row in `capture_runs`, including the paths that
 * write no snapshot. That is what makes a gap in the history interpretable
 * later — a missing window with a failed run beside it is an upstream outage,
 * a missing window with no run at all is a scheduler miss, and nothing can
 * distinguish those after the fact if we did not write it down at the time.
 */
function isAuthorized(request: Request): boolean {
  if (request.headers.get('x-vercel-cron')) return true;

  if (!config.cronSecret) return false;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return provided === config.cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const triggerSource = request.headers.get('x-vercel-cron') ? 'cron' : 'manual';
  const elapsed = () => Date.now() - startedAt;

  const snapshot = await getWaitTimes();

  if (snapshot.facilities.length === 0) {
    await recordCaptureRun({
      status: 'upstream_empty',
      durationMs: elapsed(),
      triggerSource,
      error: snapshot.error ?? 'no facilities returned upstream',
    });
    return NextResponse.json(
      { ok: false, reason: 'no facilities returned upstream', error: snapshot.error },
      { status: 503 },
    );
  }

  // Never write a stale snapshot into history — it would duplicate whichever
  // reading happened to be cached, and silently bias every average built on it.
  if (snapshot.stale) {
    await recordCaptureRun({
      status: 'stale_skipped',
      facilitiesSeen: snapshot.facilities.length,
      durationMs: elapsed(),
      triggerSource,
      error: snapshot.error ?? 'upstream stale',
    });
    return NextResponse.json(
      { ok: false, reason: 'upstream stale, skipping write', error: snapshot.error },
      { status: 202 },
    );
  }

  const capturedAt = bucketTimestamp();
  const fetchedAt = new Date(snapshot.fetchedAt);

  const rowsWritten = await recordSnapshot(snapshot.facilities, capturedAt, fetchedAt);
  const alerts = await dispatchAlerts(snapshot.facilities);

  await recordCaptureRun({
    status: 'success',
    bucket: capturedAt,
    facilitiesSeen: snapshot.facilities.length,
    rowsWritten,
    durationMs: elapsed(),
    triggerSource,
  });

  return NextResponse.json({
    ok: true,
    capturedAt: capturedAt.toISOString(),
    fetchedAt: snapshot.fetchedAt,
    facilities: snapshot.facilities.length,
    rowsWritten,
    historyEnabled: config.database.enabled,
    alerts,
  });
}
