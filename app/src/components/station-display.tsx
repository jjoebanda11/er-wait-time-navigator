'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NormalizedFacility } from '@/lib/ahs/types';
import { REGION_LABELS } from '@/lib/ahs/parse';
import type { AhsRegionKey } from '@/lib/ahs/types';
import { formatDuration, rankFacilitiesSync, waitBand, type PatientType } from '@/lib/rank';

const BAND: Record<string, { fg: string; bg: string; label: string }> = {
  green: { fg: '#052e16', bg: 'var(--color-band-green)', label: 'Shortest' },
  yellow: { fg: '#3a2e05', bg: 'var(--color-band-yellow)', label: 'Moderate' },
  orange: { fg: '#3a1e05', bg: 'var(--color-band-orange)', label: 'Long' },
  red: { fg: '#3a0505', bg: 'var(--color-band-red)', label: 'Very long' },
  unknown: { fg: '#1e293b', bg: 'var(--color-band-unknown)', label: 'No data' },
};

export interface StationConfig {
  label: string;
  lat: number;
  lng: number;
  region: string;
  patientType: PatientType;
}

/**
 * The nurse-station wall display.
 *
 * Built for a completely different reader from the rest of the app: a clinician
 * glancing at a mounted screen from across a room, hands full, deciding in two
 * seconds where to send a resident. So: enormous type, the single answer
 * dominant, at most three options, and no interaction required or expected.
 *
 * The building's position lives in the page URL, so the display needs no login,
 * no account, and no server-side storage of where a care home is. A facility
 * bookmarks the configured URL on a mounted tablet and it simply runs. Ranking
 * is synchronous during render — the same rule as the dashboard, so an
 * auto-refreshing kiosk can never fall into a render loop.
 */
export function StationDisplay({
  snapshot,
  config,
}: {
  snapshot: { facilities: NormalizedFacility[]; fetchedAt: string };
  config: StationConfig;
}) {
  const ranked = useMemo(
    () =>
      rankFacilitiesSync(snapshot.facilities, {
        origin: { lat: config.lat, lng: config.lng },
        region: config.region,
        patientType: config.patientType,
        includeUrgentCare: true,
      }),
    [snapshot.facilities, config.lat, config.lng, config.region, config.patientType],
  );

  const known = ranked.filter((r) => r.doorToDoctorMinutes != null);
  const top = known.slice(0, 3);
  const best = top[0];

  // A clock and a "refreshed N ago" line, so staff can trust the screen is live
  // rather than frozen. The board itself re-fetches on the interval below.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Reload the whole page periodically to pull a fresh snapshot. A kiosk runs
  // untouched for days; a full reload is the simplest way to guarantee it never
  // drifts onto stale data, and it also recovers from any transient error.
  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 4 * 60_000);
    return () => clearInterval(t);
  }, []);

  const ageMin = now
    ? Math.max(0, Math.floor((now.getTime() - new Date(snapshot.fetchedAt).getTime()) / 60_000))
    : 0;

  const bestBand = BAND[waitBand(best?.doorToDoctorMinutes ?? null)];

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] px-[3vw] py-[2.5vh]">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-[clamp(1.5rem,3.5vw,3rem)] font-black leading-none">
            {config.label}
          </h1>
          <p className="mt-1 text-[clamp(0.8rem,1.4vw,1.2rem)] text-muted">
            Fastest emergency care right now
            {config.patientType === 'child' ? ' · for a child' : ''} ·{' '}
            {REGION_LABELS[config.region as AhsRegionKey] ?? config.region}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-black tabular-nums leading-none">
            {now
              ? now.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
              : '—'}
          </p>
          <p className="text-[clamp(0.7rem,1.1vw,1rem)] text-muted">
            {snapshot.facilities.length === 0
              ? 'data unavailable'
              : ageMin < 1
                ? 'updated just now'
                : `updated ${ageMin} min ago`}
          </p>
        </div>
      </header>

      {best ? (
        <>
          {/* The one answer, as large as the screen allows. */}
          <div
            className="my-[2vh] flex flex-1 flex-col justify-center rounded-[2vw] px-[4vw] py-[3vh]"
            style={{ background: bestBand.bg, color: bestBand.fg }}
          >
            <p className="text-[clamp(1rem,2vw,1.6rem)] font-bold uppercase tracking-wide opacity-80">
              Send here
            </p>
            <p className="text-[clamp(2rem,6vw,5.5rem)] font-black leading-[1.05]">
              {best.facility.name}
            </p>
            <p className="mt-[1vh] text-[clamp(1.2rem,3vw,3rem)] font-bold">
              About {formatDuration(best.doorToDoctorMinutes)} until seen
            </p>
            <p className="mt-[0.5vh] text-[clamp(0.9rem,1.6vw,1.5rem)] font-semibold opacity-80">
              {formatDuration(best.facility.waitMinutes)} posted wait +{' '}
              {formatDuration(best.driveMinutes)} drive +{' '}
              {formatDuration(best.parkingMinutes)} parking
            </p>
          </div>

          {/* Runners-up, so staff can see the next options without touching anything. */}
          {top.length > 1 && (
            <div className="grid gap-[1.5vw]" style={{ gridTemplateColumns: `repeat(${top.length - 1}, 1fr)` }}>
              {top.slice(1).map((r) => {
                const b = BAND[waitBand(r.doorToDoctorMinutes)];
                return (
                  <div
                    key={r.facility.slug}
                    className="rounded-[1.2vw] border-2 p-[1.5vw]"
                    style={{ borderColor: b.bg }}
                  >
                    <p className="text-[clamp(0.9rem,1.8vw,1.6rem)] font-bold leading-tight">
                      {r.facility.name}
                    </p>
                    <p
                      className="mt-[0.5vh] text-[clamp(1.1rem,2.4vw,2.2rem)] font-black tabular-nums"
                      style={{ color: b.bg }}
                    >
                      {formatDuration(r.doorToDoctorMinutes)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="my-[2vh] flex flex-1 flex-col items-center justify-center rounded-[2vw] border-4 border-dashed p-[4vw] text-center">
          <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-black">
            Wait times unavailable
          </p>
          <p className="mt-[1vh] max-w-[40ch] text-[clamp(1rem,1.8vw,1.5rem)] text-muted">
            Alberta Health Services is not reporting for this area right now. Call Health Link at
            811 for advice on where to go, or 911 for an emergency.
          </p>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[clamp(0.65rem,1vw,0.95rem)] text-muted">
        <p>
          For a life-threatening emergency call <strong className="text-[var(--text)]">911</strong>.
          Free nurse advice: <strong className="text-[var(--text)]">811</strong>. Estimates only —
          not medical advice. Emergency departments treat the sickest patients first.
        </p>
        <p>Independent · data from Alberta Health Services · not affiliated with AHS</p>
      </footer>
    </div>
  );
}
