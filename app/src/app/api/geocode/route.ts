import { NextResponse } from 'next/server';
import { centroidFor } from '@/lib/geo/region-centroids';

export const dynamic = 'force-dynamic';

/**
 * Address lookup for the care-provider tools.
 *
 * Both providers are free and need no key, consistent with the rule that this
 * product runs with an empty `.env`.
 *
 *  1. Photon (photon.komoot.io) is tried first. It resolves house numbers in
 *     Canadian cities far better than Nominatim's free-text search, and it
 *     accepts a location bias so results cluster near the intended city.
 *  2. Nominatim is the fallback if Photon returns nothing.
 *
 * The bias matters more than it looks. Edmonton's 104 Avenue runs most of the
 * way across the city; an un-biased geocoder will cheerfully return a point on
 * the wrong end of it, kilometres away, which would flip the facility ranking.
 * Passing `near` (the selected region's centroid) pins results to the right
 * area.
 *
 * Neither the query nor the result is stored or logged. Successful lookups are
 * cached in memory only.
 */

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const USER_AGENT =
  'ERWaitNavigator/1.0 (Alberta emergency care navigation; contact via erwaitnavigator site)';

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  /** True when the match resolved to a specific building, not a street. */
  precise: boolean;
}

const cache = new Map<string, { result: GeocodeResult[]; storedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

/** Nominatim asks for no more than one request per second; be a good citizen. */
const MIN_REQUEST_GAP_MS = 1100;
let lastNominatimAt = 0;

function inAlberta(lat: number, lng: number): boolean {
  return lat >= 48 && lat <= 61 && lng >= -121 && lng <= -109;
}

/** Photon returns rich address parts; assemble a label a human can tell apart. */
function photonLabel(p: Record<string, unknown>): string {
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.city ?? p.town ?? p.village,
    p.state,
    p.postcode,
  ].filter(Boolean);
  return parts.join(', ') || String(p.name ?? '');
}

async function queryPhoton(query: string, near: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '6');
  url.searchParams.set('lang', 'en');
  // Bias toward the intended city.
  url.searchParams.set('lat', String(near.lat));
  url.searchParams.set('lon', String(near.lng));

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);

  const data = (await response.json()) as {
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: [number, number] };
    }>;
  };

  return (data.features ?? [])
    .map((f) => {
      const coords = f.geometry?.coordinates;
      const p = f.properties ?? {};
      return {
        label: photonLabel(p),
        lat: coords?.[1] ?? NaN,
        lng: coords?.[0] ?? NaN,
        precise: Boolean(p.housenumber),
      };
    })
    .filter((r) => r.label && Number.isFinite(r.lat) && inAlberta(r.lat, r.lng));
}

async function queryNominatim(query: string): Promise<GeocodeResult[]> {
  const wait = Math.max(0, lastNominatimAt + MIN_REQUEST_GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'ca');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);

  const data = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: { house_number?: string };
  }>;

  return data
    .map((r) => ({
      label: r.display_name ?? '',
      lat: Number.parseFloat(r.lat ?? ''),
      lng: Number.parseFloat(r.lon ?? ''),
      precise: Boolean(r.address?.house_number),
    }))
    .filter((r) => r.label && Number.isFinite(r.lat) && inAlberta(r.lat, r.lng));
}

/** Drop near-duplicate results (same rounded coordinates). */
function dedupe(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const r of results) {
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  // Precise (building-level) matches first.
  return out.sort((a, b) => Number(b.precise) - Number(a.precise));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const region = searchParams.get('region') ?? 'Edmonton';

  if (!query || query.length < 4) {
    return NextResponse.json({ error: 'Enter at least 4 characters of an address' }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'Address is too long' }, { status: 400 });
  }

  const near = centroidFor(region);
  const key = `${region}:${query.toLowerCase()}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.result, cached: true });
  }

  let results: GeocodeResult[] = [];
  try {
    results = await queryPhoton(query, near);
  } catch {
    // fall through to Nominatim
  }

  if (results.length === 0) {
    try {
      results = await queryNominatim(query);
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

  results = dedupe(results).slice(0, 6);

  if (results.length === 0) {
    return NextResponse.json({
      results: [],
      error:
        'No match found. Try a nearby intersection (e.g. "104 Ave & 100 St, Edmonton"), or paste coordinates as "lat, lng".',
    });
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result: results, storedAt: Date.now() });

  return NextResponse.json(
    { results, attribution: 'Address data © OpenStreetMap contributors' },
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
  );
}
