import { NextResponse } from 'next/server';
import { getWaitTimes } from '@/lib/ahs/client';
import { config } from '@/lib/config';
import { bucketTimestamp, recordSnapshot } from '@/lib/db/history';
import { dispatchAlerts } from '@/lib/push/dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled capture.
 *
 * Invoked by Vercel Cron (see vercel.json). Does two jobs: append the current
 * board to the history table, and fire any wait-threshold alerts that have
 * become true since the last run.
 *
 * Authorized either by Vercel's own cron header or by a shared secret, so it
 * can also be driven from an external scheduler like GitHub Actions.
 */
function isAuthorized(request: Request): boolean {
  // Vercel signs its cron invocations with this header.
  if (request.headers.get('x-vercel-cron')) return true;

  if (!config.cronSecret) return false;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return provided === config.cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await getWaitTimes();

  if (snapshot.facilities.length === 0) {
    return NextResponse.json(
      { ok: false, reason: 'no facilities returned upstream', error: snapshot.error },
      { status: 503 },
    );
  }

  // Never write a stale snapshot into history — it would corrupt the trend data
  // with duplicated readings from whenever the cache was filled.
  if (snapshot.stale) {
    return NextResponse.json(
      { ok: false, reason: 'upstream stale, skipping write', error: snapshot.error },
      { status: 202 },
    );
  }

  const capturedAt = bucketTimestamp();
  const rowsWritten = await recordSnapshot(snapshot.facilities, capturedAt);
  const alerts = await dispatchAlerts(snapshot.facilities);

  return NextResponse.json({
    ok: true,
    capturedAt: capturedAt.toISOString(),
    facilities: snapshot.facilities.length,
    rowsWritten,
    historyEnabled: config.database.enabled,
    alerts,
  });
}
