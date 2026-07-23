'use client';

import Link from 'next/link';
import type { RankedFacility } from '@/lib/rank';
import { formatDuration, waitBand, type WaitBand } from '@/lib/rank';

const BAND_STYLES: Record<WaitBand, { bar: string; text: string; soft: string; label: string }> = {
  green: {
    bar: 'var(--color-band-green)',
    text: 'var(--color-band-green)',
    soft: 'var(--color-band-green-soft)',
    label: 'Short wait',
  },
  yellow: {
    bar: 'var(--color-band-yellow)',
    text: 'var(--color-band-yellow)',
    soft: 'var(--color-band-yellow-soft)',
    label: 'Moderate wait',
  },
  orange: {
    bar: 'var(--color-band-orange)',
    text: 'var(--color-band-orange)',
    soft: 'var(--color-band-orange-soft)',
    label: 'Long wait',
  },
  red: {
    bar: 'var(--color-band-red)',
    text: 'var(--color-band-red)',
    soft: 'var(--color-band-red-soft)',
    label: 'Very long wait',
  },
  unknown: {
    bar: 'var(--color-band-unknown)',
    text: 'var(--color-band-unknown)',
    soft: 'var(--color-band-unknown-soft)',
    label: 'Wait not published',
  },
};

const KIND_LABELS: Record<string, string> = {
  emergency: 'Emergency department',
  'urgent-care': 'Urgent care',
  'pediatric-emergency': "Children's emergency",
};

interface Props {
  entry: RankedFacility;
  rank: number;
  /** Whether we know where the user is; without it we cannot show totals. */
  hasOrigin: boolean;
  saved: boolean;
  onToggleSave: (slug: string) => void;
}

export function FacilityCard({ entry, rank, hasOrigin, saved, onToggleSave }: Props) {
  const { facility } = entry;
  const band = BAND_STYLES[waitBand(facility.waitMinutes)];

  // Headline is the total when we can compute it, otherwise the posted wait.
  const headlineMinutes = hasOrigin ? entry.doorToDoctorMinutes : facility.waitMinutes;
  const headlineLabel = hasOrigin ? 'Total time to be seen' : 'Current wait';

  return (
    <li
      className="relative overflow-hidden rounded-xl surface"
      style={entry.isBest ? { borderColor: 'var(--color-band-green)', borderWidth: 2 } : undefined}
    >
      <div aria-hidden className="h-1.5 w-full" style={{ background: band.bar }} />

      {entry.isBest && (
        <p
          className="px-4 pt-3 text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--color-band-green)' }}
        >
          ★ Fastest option for you right now
        </p>
      )}

      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-muted tabular-nums">{rank}.</span>
            <h3 className="min-w-0 text-lg font-bold leading-snug">{facility.name}</h3>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="rounded-full px-2 py-0.5" style={{ background: band.soft, color: band.text }}>
              {KIND_LABELS[facility.kind] ?? 'Emergency department'}
            </span>
            {facility.department && <span>{facility.department}</span>}
            {facility.municipality && facility.municipality !== facility.regionLabel && (
              <span className="font-semibold">in {facility.municipality}</span>
            )}
          </p>

          {/* The breakdown is what makes the headline number trustworthy. */}
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted">Posted wait</dt>
              <dd className="font-semibold tabular-nums" style={{ color: band.text }}>
                {formatDuration(facility.waitMinutes)}
              </dd>
            </div>
            {hasOrigin && (
              <>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Drive</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatDuration(entry.driveMinutes)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Park &amp; walk in</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatDuration(entry.parkingMinutes)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Distance</dt>
                  <dd className="font-semibold tabular-nums">
                    {entry.distanceKm.toFixed(1)} km
                  </dd>
                </div>
              </>
            )}
          </dl>

          {entry.minutesSavedVsWorst != null && entry.minutesSavedVsWorst >= 20 && (
            <p
              className="mt-2 text-sm font-semibold"
              style={{ color: 'var(--color-band-green)' }}
            >
              About {formatDuration(entry.minutesSavedVsWorst)} sooner than a typical nearby choice
            </p>
          )}

          {facility.waitUnavailable && (
            <p className="mt-2 text-sm text-muted">
              Alberta Health Services is not publishing a wait time for this site right now, so we
              cannot rank it. Call ahead before driving.
            </p>
          )}

          {facility.note && (
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{facility.note}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onToggleSave(facility.slug)}
            aria-pressed={saved}
            className="rounded-full border px-2 py-1 text-sm hover:bg-[var(--bg-subtle)]"
            title={saved ? 'Remove from saved' : 'Save this facility'}
          >
            <span aria-hidden>{saved ? '★' : '☆'}</span>
            <span className="sr-only-custom">
              {saved ? `Remove ${facility.name} from saved` : `Save ${facility.name}`}
            </span>
          </button>

          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {headlineLabel}
            </p>
            <p
              className="text-3xl font-black leading-none tabular-nums"
              style={{ color: band.text }}
            >
              {formatDuration(headlineMinutes)}
            </p>
            {!hasOrigin && (
              <p className="mt-1 text-[11px] text-muted">+ your drive</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t px-4 py-3">
        <a
          href={facility.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Directions
        </a>
        <Link
          href={`/facility/${facility.slug}`}
          className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
        >
          Details &amp; trends
        </Link>
        {facility.infoUrl && (
          <a
            href={facility.infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
          >
            AHS site info
          </a>
        )}
      </div>
    </li>
  );
}
