import { normalizePayload } from './parse';
import type { AhsRawPayload, WaitTimeSnapshot } from './types';

export const AHS_FEED_URL =
  'https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en';

/**
 * How long a snapshot is considered fresh.
 *
 * AHS recomputes roughly every few minutes. Polling faster gains nothing real
 * and is discourteous to a public health system's infrastructure, so we cache
 * for three minutes and let Next.js serve everyone else from that.
 */
export const CACHE_TTL_SECONDS = 180;

/**
 * How long we will keep serving a cached snapshot after upstream starts
 * failing. Two hours of slightly-stale wait times, clearly labelled as stale,
 * beats an error page for someone who needs care right now.
 */
const STALE_GRACE_MS = 2 * 60 * 60 * 1000;

interface CacheEntry {
  snapshot: WaitTimeSnapshot;
  storedAt: number;
}

// Module-level cache. On Vercel this is per-instance and warm across requests
// within an instance; Next's own fetch cache does the heavy lifting, and this
// exists to survive an upstream outage.
let lastGood: CacheEntry | null = null;

/** A descriptive UA so AHS can identify and contact us if we ever misbehave. */
const USER_AGENT =
  'ERWaitNavigator/1.0 (+https://github.com/; Alberta ER wait-time navigation; contact via site)';

export class AhsFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AhsFetchError';
  }
}

async function fetchRaw(signal?: AbortSignal): Promise<AhsRawPayload> {
  const response = await fetch(AHS_FEED_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT,
    },
    signal: signal ?? AbortSignal.timeout(10_000),
    next: { revalidate: CACHE_TTL_SECONDS },
  });

  if (!response.ok) {
    throw new AhsFetchError(
      `AHS feed returned ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  const text = await response.text();
  if (!text.trim()) throw new AhsFetchError('AHS feed returned an empty body');

  try {
    return JSON.parse(text) as AhsRawPayload;
  } catch {
    throw new AhsFetchError('AHS feed returned malformed JSON');
  }
}

/**
 * Fetch and normalize the current wait-time snapshot.
 *
 * Never throws. On upstream failure it returns the last good snapshot marked
 * `stale`, and only if there is nothing cached does it return an empty
 * snapshot carrying the error for the UI to explain.
 */
export async function getWaitTimes(): Promise<WaitTimeSnapshot> {
  try {
    const raw = await fetchRaw();
    const facilities = normalizePayload(raw);

    // A structurally valid but empty payload means AHS changed something.
    // Prefer known-good stale data over showing the user nothing.
    if (facilities.length === 0) {
      throw new AhsFetchError('AHS feed contained no usable facilities');
    }

    const snapshot: WaitTimeSnapshot = {
      fetchedAt: new Date().toISOString(),
      facilities,
    };
    lastGood = { snapshot, storedAt: Date.now() };
    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (lastGood && Date.now() - lastGood.storedAt < STALE_GRACE_MS) {
      return { ...lastGood.snapshot, stale: true, error: message };
    }

    return {
      fetchedAt: new Date().toISOString(),
      facilities: [],
      stale: true,
      error: message,
    };
  }
}

/** Age of a snapshot in minutes, for "updated N minutes ago" labels. */
export function snapshotAgeMinutes(snapshot: WaitTimeSnapshot): number {
  return Math.max(0, (Date.now() - new Date(snapshot.fetchedAt).getTime()) / 60_000);
}
