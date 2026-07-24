import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Address lookup for the care-provider dashboard.
 *
 * Uses OpenStreetMap's Nominatim, which is free and needs no key — consistent
 * with the rule that this product must run with an empty `.env`.
 *
 * Nominatim's usage policy caps requests at roughly one per second and forbids
 * bulk geocoding, so this endpoint serialises requests and caches aggressively.
 * A coordinator adds locations one at a time, which fits comfortably inside
 * that budget; anything resembling a bulk import would not, and is deliberately
 * not offered.
 *
 * Privacy: the address is used to obtain coordinates and is never written to
 * our storage. The result goes back to the browser, which keeps it locally.
 * We do not log queries.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const USER_AGENT =
  'ERWaitNavigator/1.0 (Alberta emergency care navigation; contact via erwaitnavigator site)';

/** Cache successful lookups; the same addresses recur constantly in a roster. */
const cache = new Map<string, { result: GeocodeResult[]; storedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

/** Nominatim asks for no more than one request per second. */
const MIN_REQUEST_GAP_MS = 1100;
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

/** Alberta's approximate bounding box, used to bias and sanity-check results. */
const ALBERTA_VIEWBOX = '-120.5,60.5,-109.5,48.5';

function inAlberta(lat: number, lng: number): boolean {
  return lat >= 48 && lat <= 61 && lng >= -121 && lng <= -109;
}

/** Serialise upstream calls so concurrent users cannot breach the rate limit. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_REQUEST_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive even if this task rejects.
  queue = run.catch(() => {});
  return run;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 4) {
    return NextResponse.json(
      { error: 'Enter at least 4 characters of an address' },
      { status: 400 },
    );
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'Address is too long' }, { status: 400 });
  }

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.result, cached: true });
  }

  try {
    const results = await enqueue(async () => {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 'ca');
      url.searchParams.set('viewbox', ALBERTA_VIEWBOX);
      url.searchParams.set('bounded', '1');

      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

      const data = (await response.json()) as Array<{
        display_name?: string;
        lat?: string;
        lon?: string;
      }>;

      return data
        .map((r) => ({
          label: r.display_name ?? '',
          lat: Number.parseFloat(r.lat ?? ''),
          lng: Number.parseFloat(r.lon ?? ''),
        }))
        .filter(
          (r): r is GeocodeResult =>
            Boolean(r.label) &&
            Number.isFinite(r.lat) &&
            Number.isFinite(r.lng) &&
            inAlberta(r.lat, r.lng),
        );
    });

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { result: results, storedAt: Date.now() });

    return NextResponse.json(
      {
        results,
        attribution: 'Address data © OpenStreetMap contributors',
      },
      { headers: { 'Cache-Control': 'private, max-age=3600' } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Address lookup is unavailable right now. You can still add a location by pasting coordinates as "lat, lng".',
        results: [],
      },
      { status: 503 },
    );
  }
}
