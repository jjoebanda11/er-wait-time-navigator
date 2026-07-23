import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { resolveDriveTimeProvider } from '@/lib/geo/drive-time';
import type { GeoPoint } from '@/lib/ahs/types';

export const dynamic = 'force-dynamic';

/** Refuse absurd batches so one caller cannot burn a whole daily routing quota. */
const MAX_DESTINATIONS = 40;

function isValidPoint(value: unknown): value is GeoPoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/**
 * Refine drive times using whichever routing provider this deployment has.
 *
 * Coordinates are used to compute a matrix and are never logged or stored. The
 * client only calls this when the server advertises a provider; without one the
 * on-device estimate is already in use and this endpoint is never hit.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { origin, destinations } = (body ?? {}) as {
    origin?: unknown;
    destinations?: unknown;
  };

  if (!isValidPoint(origin)) {
    return NextResponse.json({ error: 'A valid origin is required' }, { status: 400 });
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return NextResponse.json({ error: 'At least one destination is required' }, { status: 400 });
  }
  if (destinations.length > MAX_DESTINATIONS) {
    return NextResponse.json(
      { error: `At most ${MAX_DESTINATIONS} destinations per request` },
      { status: 400 },
    );
  }
  if (!destinations.every(isValidPoint)) {
    return NextResponse.json({ error: 'All destinations must be valid points' }, { status: 400 });
  }

  const provider = resolveDriveTimeProvider({
    ORS_API_KEY: config.routing.orsApiKey,
    GOOGLE_ROUTES_API_KEY: config.routing.googleRoutesApiKey,
  });

  const results = await provider.matrix(origin, destinations);

  return NextResponse.json(
    { provider: provider.name, results },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
