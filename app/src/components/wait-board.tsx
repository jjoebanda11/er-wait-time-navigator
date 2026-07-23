'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AhsRegionKey, NormalizedFacility, WaitTimeSnapshot } from '@/lib/ahs/types';
import { REGION_LABELS, REGION_SLUGS } from '@/lib/ahs/parse';
import { estimateProvider, type DriveTimeResult } from '@/lib/geo/drive-time';
import {
  formatDuration,
  rankFacilities,
  type PatientType,
  type RankedFacility,
} from '@/lib/rank';
import { usePreferences } from '@/lib/preferences';
import { FacilityCard } from './facility-card';

type LocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'unavailable'; message: string };

interface Props {
  snapshot: WaitTimeSnapshot;
  /** Lock the board to one region, used by the city landing pages. */
  fixedRegion?: string;
  /** Pre-select a patient type, used when arriving from triage. */
  initialPatientType?: PatientType;
  /** True when the server has a real routing provider configured. */
  routingUpgradeAvailable?: boolean;
}

export function WaitBoard({
  snapshot,
  fixedRegion,
  initialPatientType,
  routingUpgradeAvailable = false,
}: Props) {
  const { prefs, loaded, update, toggleSaved } = usePreferences();
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  // Null until a location-based ranking exists; the render-time base ranking is
  // used in the meantime so the board is never empty.
  const [ranked, setRanked] = useState<RankedFacility[] | null>(null);
  const [refinedTimes, setRefinedTimes] = useState<Record<string, DriveTimeResult> | null>(null);

  const region = fixedRegion ?? prefs.region;
  const patientType = initialPatientType ?? prefs.patientType;

  // Restore a recent position so a returning user gets a ranked board without
  // having to re-approve location.
  useEffect(() => {
    if (!loaded || location.status !== 'idle') return;
    if (prefs.lastOrigin) {
      setLocation({ status: 'ready', lat: prefs.lastOrigin.lat, lng: prefs.lastOrigin.lng });
    }
  }, [loaded, prefs.lastOrigin, location.status]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation({
        status: 'unavailable',
        message: 'This browser cannot share your location.',
      });
      return;
    }

    setLocation({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ status: 'ready', lat: latitude, lng: longitude });
        update({ lastOrigin: { lat: latitude, lng: longitude, at: Date.now() } });
      },
      (error) => {
        setLocation(
          error.code === error.PERMISSION_DENIED
            ? { status: 'denied' }
            : { status: 'unavailable', message: 'We could not get your location.' },
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [update]);

  const origin = location.status === 'ready' ? { lat: location.lat, lng: location.lng } : null;

  /**
   * The board as it looks before we know where the user is: the selected
   * region, sorted by posted wait.
   *
   * Computed during render rather than in an effect, and that is the whole
   * point. Effects do not run on the server, so building this list in one left
   * the server HTML with an empty `<ol>` — no hospitals and no wait times for
   * anyone without JavaScript, for search engines that do not execute it, and
   * for everyone else until hydration finished. A wait-time board that needs
   * JavaScript to show any wait times is the wrong shape for this product.
   */
  const baseRanking = useMemo<RankedFacility[]>(() => {
    const inRegion = snapshot.facilities
      .filter((f) => f.region === region)
      .filter((f) => prefs.includeUrgentCare || f.kind !== 'urgent-care');

    return [...inRegion]
      .sort((a, b) => {
        // A facility with no published wait is not a fast facility; it sorts
        // last regardless.
        if ((a.waitMinutes == null) !== (b.waitMinutes == null)) {
          return a.waitMinutes == null ? 1 : -1;
        }
        return (a.waitMinutes ?? 0) - (b.waitMinutes ?? 0);
      })
      .map((facility) => ({
        facility,
        driveMinutes: 0,
        distanceKm: 0,
        parkingMinutes: 0,
        doorToDoctorMinutes: null,
        driveTimeSource: 'estimate' as const,
        liveTraffic: false,
        minutesSavedVsWorst: null,
        isBest: false,
        pediatricPreferred: false,
      }));
  }, [snapshot.facilities, region, prefs.includeUrgentCare]);

  // Rank on the device once we have a location. Pure arithmetic, so results
  // appear instantly and keep working with no network at all.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const facilities: NormalizedFacility[] = snapshot.facilities;
      if (facilities.length === 0 || !origin) {
        if (!cancelled) setRanked(null);
        return;
      }

      const provider = refinedTimes
        ? {
            name: 'openrouteservice' as const,
            async matrix(_o: typeof origin, destinations: { lat: number; lng: number }[]) {
              return destinations.map(
                (d) =>
                  refinedTimes[`${d.lat},${d.lng}`] ?? {
                    minutes: 0,
                    distanceKm: 0,
                    source: 'estimate' as const,
                    liveTraffic: false,
                  },
              );
            },
          }
        : estimateProvider;

      const result = await rankFacilities(facilities, provider, {
        origin,
        region,
        patientType,
        includeUrgentCare: prefs.includeUrgentCare,
      });

      if (!cancelled) setRanked(result);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [snapshot, region, patientType, prefs.includeUrgentCare, origin, refinedTimes]);

  // Progressive enhancement: if the deployment has a routing key, ask the
  // server for real road times and re-rank. Failure here is silent because the
  // estimated board is already correct enough to act on.
  useEffect(() => {
    if (!routingUpgradeAvailable || !origin || refinedTimes) return;

    const destinations = snapshot.facilities
      .filter((f) => f.region === region)
      .map((f) => f.coords);
    if (destinations.length === 0) return;

    const controller = new AbortController();
    fetch('/api/drive-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destinations }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { results?: DriveTimeResult[] } | null) => {
        if (!data?.results) return;
        const map: Record<string, DriveTimeResult> = {};
        destinations.forEach((d, i) => {
          const result = data.results![i];
          if (result) map[`${d.lat},${d.lng}`] = result;
        });
        setRefinedTimes(map);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [routingUpgradeAvailable, origin, region, snapshot.facilities, refinedTimes]);

  // Location-based ranking when we have one, otherwise the render-time list.
  const effectiveRanking = ranked ?? baseRanking;

  const savedFirst = useMemo(() => {
    if (prefs.saved.length === 0) return effectiveRanking;
    const saved = effectiveRanking.filter((r) => prefs.saved.includes(r.facility.slug));
    const rest = effectiveRanking.filter((r) => !prefs.saved.includes(r.facility.slug));
    return [...saved, ...rest];
  }, [effectiveRanking, prefs.saved]);

  const hasOrigin = Boolean(origin);
  const regionsAvailable = useMemo(
    () => [...new Set(snapshot.facilities.map((f) => f.region))],
    [snapshot.facilities],
  );

  if (snapshot.facilities.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-band-red)] bg-[var(--color-band-red-soft)] p-5">
        <h2 className="font-bold">Wait times are unavailable right now</h2>
        <p className="mt-2 text-sm">
          We could not reach the Alberta Health Services wait time service. Check{' '}
          <a
            className="underline"
            href="https://www.albertahealthservices.ca/waittimes/waittimes.aspx"
            target="_blank"
            rel="noopener noreferrer"
          >
            the official AHS page
          </a>
          , or call Health Link at <a className="font-bold underline" href="tel:811">811</a> for
          advice on where to go.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Location control. The single highest-value action on the page. */}
      {!hasOrigin && (
        <div className="rounded-xl border-2 border-brand-600 bg-[var(--bg-subtle)] p-4">
          <h2 className="font-bold">Show my true wait, including the drive</h2>
          <p className="mt-1 text-sm text-muted">
            The nearest emergency department is often not the fastest one. Share your location and
            we will rank every site by when you would actually be seen. Your location stays on this
            device.
          </p>
          <button
            type="button"
            onClick={requestLocation}
            disabled={location.status === 'locating'}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {location.status === 'locating' ? 'Finding you…' : 'Use my location'}
          </button>

          {location.status === 'denied' && (
            <p className="mt-2 text-sm text-muted">
              Location permission was declined, so the list below is sorted by posted wait time
              only. You can still compare sites — just remember to add your own travel time.
            </p>
          )}
          {location.status === 'unavailable' && (
            <p className="mt-2 text-sm text-muted">{location.message}</p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!fixedRegion && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Area</span>
            <select
              value={region}
              onChange={(e) => update({ region: e.target.value })}
              className="rounded-lg border bg-[var(--surface)] px-2.5 py-1.5 text-sm font-medium"
            >
              {regionsAvailable.map((key) => (
                <option key={key} value={key}>
                  {REGION_LABELS[key as keyof typeof REGION_LABELS] ?? key}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Patient</span>
          <select
            value={patientType}
            onChange={(e) => update({ patientType: e.target.value as PatientType })}
            className="rounded-lg border bg-[var(--surface)] px-2.5 py-1.5 text-sm font-medium"
          >
            <option value="adult">Adult</option>
            <option value="child">Child</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={prefs.includeUrgentCare}
            onChange={(e) => update({ includeUrgentCare: e.target.checked })}
            className="h-4 w-4"
          />
          Include urgent care
        </label>

        {hasOrigin && (
          <button
            type="button"
            onClick={requestLocation}
            className="ml-auto rounded-lg border px-2.5 py-1.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
          >
            Update location
          </button>
        )}
      </div>

      {patientType === 'child' && (
        <p className="rounded-lg border bg-[var(--bg-subtle)] p-3 text-sm">
          Ranking for a child. Children&rsquo;s emergency departments are preferred when they are
          not much further, and departments that only see adults are hidden.
        </p>
      )}

      <SpreadCallout ranked={effectiveRanking} regionLabel={REGION_LABELS[region as AhsRegionKey] ?? region} />

      <StatusLine snapshot={snapshot} hasOrigin={hasOrigin} ranked={effectiveRanking} />

      <ol className="space-y-3">
        {savedFirst.map((entry, index) => (
          <FacilityCard
            key={`${entry.facility.region}-${entry.facility.slug}`}
            entry={entry}
            rank={index + 1}
            hasOrigin={hasOrigin}
            saved={prefs.saved.includes(entry.facility.slug)}
            onToggleSave={toggleSaved}
          />
        ))}
      </ol>

      {effectiveRanking.length === 0 && (
        <p className="rounded-lg border p-4 text-sm text-muted">
          No facilities match these filters. Try including urgent care, or choose another area.
        </p>
      )}
    </div>
  );
}

/**
 * The headline insight: how much the choice of facility is worth right now.
 *
 * Computed from the facilities actually on screen, so it can never contradict
 * the board beneath it — an earlier version was hardcoded to Edmonton and would
 * cheerfully quote Edmonton numbers while the user was looking at Fort McMurray.
 *
 * Suppressed below an hour, because a spread that small is inside the noise of
 * these estimates and does not justify sending anyone further afield.
 */
function SpreadCallout({
  ranked,
  regionLabel,
}: {
  ranked: RankedFacility[];
  regionLabel: string;
}) {
  const known = ranked.filter((r) => r.facility.waitMinutes != null);
  if (known.length < 2) return null;

  const sorted = [...known].sort(
    (a, b) => a.facility.waitMinutes! - b.facility.waitMinutes!,
  );
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];
  const spread = longest.facility.waitMinutes! - shortest.facility.waitMinutes!;
  if (spread < 60) return null;

  return (
    <div
      className="rounded-xl border-2 p-4"
      style={{
        borderColor: 'var(--color-band-green)',
        background: 'var(--color-band-green-soft)',
      }}
    >
      <p className="text-base leading-relaxed">
        <strong>
          Right now in {regionLabel} there is a {formatDuration(spread)} gap
        </strong>{' '}
        between the shortest posted wait ({shortest.facility.name},{' '}
        {formatDuration(shortest.facility.waitMinutes)}) and the longest (
        {longest.facility.name}, {formatDuration(longest.facility.waitMinutes)}). Which one you
        drive to matters more than when you leave.
      </p>
    </div>
  );
}

function StatusLine({
  snapshot,
  hasOrigin,
  ranked,
}: {
  snapshot: WaitTimeSnapshot;
  hasOrigin: boolean;
  ranked: RankedFacility[];
}) {
  const [ago, setAgo] = useState<string>('just now');

  useEffect(() => {
    const compute = () => {
      const minutes = Math.floor((Date.now() - new Date(snapshot.fetchedAt).getTime()) / 60_000);
      if (minutes < 1) setAgo('just now');
      else if (minutes === 1) setAgo('1 minute ago');
      else setAgo(`${minutes} minutes ago`);
    };
    compute();
    const timer = setInterval(compute, 30_000);
    return () => clearInterval(timer);
  }, [snapshot.fetchedAt]);

  const usesLiveTraffic = ranked.some((r) => r.liveTraffic);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="live-dot inline-block h-2 w-2 rounded-full"
          style={{
            background: snapshot.stale ? 'var(--color-band-orange)' : 'var(--color-band-green)',
          }}
        />
        {snapshot.stale ? 'Showing last known data' : 'Live from Alberta Health Services'} ·
        updated {ago}
      </span>

      {hasOrigin && (
        <span>
          {usesLiveTraffic
            ? 'Drive times include current traffic.'
            : 'Drive times are estimated from distance and typical city speeds.'}
        </span>
      )}
    </div>
  );
}
