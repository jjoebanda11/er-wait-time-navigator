import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWaitTimes } from '@/lib/ahs/client';
import { REGION_SLUGS } from '@/lib/ahs/parse';
import { config } from '@/lib/config';
import {
  formatDayHour,
  getFacilityTrends,
  getQuietWindows,
  getRecentHistory,
} from '@/lib/db/history';
import { formatDuration, waitBand } from '@/lib/rank';
import { AlertSetup } from '@/components/alert-setup';
import { RecentSparkline, TrendHeatmap } from '@/components/trend-chart';

export const revalidate = 180;

async function findFacility(slug: string) {
  const snapshot = await getWaitTimes();
  return {
    snapshot,
    facility: snapshot.facilities.find((f) => f.slug === slug) ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { facility } = await findFacility(slug);
  if (!facility) return { title: 'Facility not found' };

  return {
    title: `${facility.name} — current ER wait time`,
    description: `Live emergency wait time for ${facility.name} in ${facility.regionLabel}, Alberta, plus historical patterns showing when it is typically quietest.`,
    alternates: { canonical: `/facility/${slug}` },
  };
}

const BAND_COLORS: Record<string, string> = {
  green: 'var(--color-band-green)',
  yellow: 'var(--color-band-yellow)',
  orange: 'var(--color-band-orange)',
  red: 'var(--color-band-red)',
  unknown: 'var(--color-band-unknown)',
};

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { facility } = await findFacility(slug);
  if (!facility) notFound();

  // These all return empty without a database, and the page adapts.
  const [trends, quiet, recent] = await Promise.all([
    getFacilityTrends(slug),
    getQuietWindows(slug),
    getRecentHistory(slug),
  ]);

  const color = BAND_COLORS[waitBand(facility.waitMinutes)];
  const citySlug = REGION_SLUGS[facility.region];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href="/" className="hover:underline">
          Alberta
        </Link>{' '}
        /{' '}
        <Link href={`/${citySlug}-er-wait-times`} className="hover:underline">
          {facility.regionLabel}
        </Link>{' '}
        / <span className="text-[var(--text)]">{facility.name}</span>
      </nav>

      <h1 className="text-3xl font-black leading-tight">{facility.name}</h1>
      {facility.department && (
        <p className="mt-1 font-medium text-muted">{facility.department}</p>
      )}
      <p className="mt-1 text-muted">{facility.address}</p>

      <div className="mt-5 rounded-xl surface p-5">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          Current posted wait
        </p>
        <p className="text-5xl font-black tabular-nums" style={{ color }}>
          {formatDuration(facility.waitMinutes)}
        </p>
        {facility.waitUnavailable && (
          <p className="mt-2 text-sm text-muted">
            Alberta Health Services is not publishing a wait time for this site right now. Call
            ahead before driving.
          </p>
        )}
        {facility.note && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted">{facility.note}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={facility.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
            Directions
          </a>
          <a
            href={facility.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-4 py-2 font-semibold hover:bg-[var(--bg-subtle)]"
            title="Opens the exact coordinates published by AHS"
          >
            Exact map pin
          </a>
          <Link
            href={`/${citySlug}-er-wait-times`}
            className="rounded-lg border px-4 py-2 font-semibold hover:bg-[var(--bg-subtle)]"
          >
            Compare with nearby sites
          </Link>
          {facility.infoUrl && (
            <a
              href={facility.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border px-4 py-2 font-semibold hover:bg-[var(--bg-subtle)]"
            >
              AHS site info
            </a>
          )}
        </div>
      </div>

      <div className="mt-6">
        <AlertSetup
          facilitySlug={facility.slug}
          facilityName={facility.name}
          available={config.push.enabled && config.database.enabled}
          vapidPublicKey={config.push.publicKey}
        />
      </div>

      {recent.length >= 3 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">The last two days</h2>
          <div className="mt-3 rounded-xl surface p-4">
            <RecentSparkline points={recent} />
          </div>
        </section>
      )}

      {quiet.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Typically quietest here</h2>
          <p className="mt-1 text-sm text-muted">
            Based on {trends.reduce((sum, t) => sum + t.sampleCount, 0).toLocaleString()} readings
            we have collected. Useful for a visit that can wait — never for one that cannot.
          </p>
          <ul className="mt-3 space-y-2">
            {quiet.map((window) => (
              <li
                key={`${window.dayOfWeek}-${window.hour}`}
                className="flex items-center justify-between rounded-lg surface px-4 py-3"
              >
                <span className="font-medium">
                  {formatDayHour(window.dayOfWeek, window.hour)}
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: 'var(--color-band-green)' }}
                >
                  {formatDuration(window.averageMinutes)} average
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trends.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Pattern by day and hour</h2>
          <div className="mt-3 rounded-xl surface p-4">
            <TrendHeatmap points={trends} />
          </div>
        </section>
      )}

      {trends.length === 0 && (
        <section className="mt-8 rounded-xl surface p-5">
          <h2 className="text-xl font-bold">Trends are still building</h2>
          <p className="mt-2 text-sm text-muted">
            Alberta Health Services publishes only the current wait and keeps no public history, so
            we record our own. Historical patterns for this site will appear here once enough
            readings have accumulated.
          </p>
        </section>
      )}

      <p className="mt-8 text-sm text-muted">
        Wait times are estimates published by Alberta Health Services and can change without
        warning. If this is an emergency, call 911. If you are unsure, call Health Link at{' '}
        <a href="tel:811" className="font-bold underline">
          811
        </a>
        .
      </p>
    </div>
  );
}
