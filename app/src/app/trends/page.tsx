import type { Metadata } from 'next';
import Link from 'next/link';
import { getWaitTimes } from '@/lib/ahs/client';
import { formatDayHour, getHistoryCoverage, getQuietWindows } from '@/lib/db/history';
import { formatDuration } from '@/lib/rank';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Best time to go to the ER in Alberta',
  description:
    'Historical emergency department wait patterns across Alberta. See when each hospital is typically quietest, built from continuously recorded Alberta Health Services data.',
  alternates: { canonical: '/trends' },
};

export default async function TrendsPage() {
  const [snapshot, coverage] = await Promise.all([getWaitTimes(), getHistoryCoverage()]);

  const edmontonFirst = [...snapshot.facilities].sort((a, b) => {
    if (a.region !== b.region) {
      if (a.region === 'Edmonton') return -1;
      if (b.region === 'Edmonton') return 1;
      return a.region.localeCompare(b.region);
    }
    return a.name.localeCompare(b.name);
  });

  const quietByFacility = await Promise.all(
    edmontonFirst.map(async (facility) => ({
      facility,
      quiet: await getQuietWindows(facility.slug, 3),
    })),
  );

  const withData = quietByFacility.filter((entry) => entry.quiet.length > 0);
  const daysOfHistory = coverage.oldestCapture
    ? Math.floor((Date.now() - new Date(coverage.oldestCapture).getTime()) / 86_400_000)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-black leading-tight">Best time to go</h1>
      <p className="mt-2 text-lg text-muted">
        Emergency department waits follow strong weekly patterns. For a visit that can safely wait,
        going at the right hour is worth more than choosing the right hospital.
      </p>

      {withData.length === 0 ? (
        <section className="mt-6 rounded-xl surface p-5">
          <h2 className="text-xl font-bold">We&rsquo;re still collecting</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Alberta Health Services publishes the current wait for each site but keeps no public
            history, so there is no archive to look this up in — it has to be recorded as it
            happens. This service captures every site every few minutes and builds the record over
            time.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {coverage.totalRows > 0 ? (
              <>
                So far we have {coverage.totalRows.toLocaleString()} readings across{' '}
                {coverage.facilitiesTracked} facilities
                {daysOfHistory > 0 ? `, going back ${daysOfHistory} days` : ''}. Patterns appear
                here once each site has enough coverage to be trustworthy.
              </>
            ) : (
              <>
                History collection is not switched on for this deployment yet. The live board and
                everything else works normally.
              </>
            )}
          </p>
          <Link href="/" className="mt-4 inline-block font-semibold underline">
            See live wait times instead
          </Link>
        </section>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            Built from {coverage.totalRows.toLocaleString()} readings across{' '}
            {coverage.facilitiesTracked} facilities
            {daysOfHistory > 0 ? `, going back ${daysOfHistory} days` : ''}.
          </p>

          <ul className="mt-6 space-y-3">
            {withData.map(({ facility, quiet }) => (
              <li key={`${facility.region}-${facility.slug}`} className="rounded-xl surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-bold">
                    <Link href={`/facility/${facility.slug}`} className="hover:underline">
                      {facility.name}
                    </Link>
                  </h2>
                  <span className="text-sm text-muted">{facility.regionLabel}</span>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {quiet.map((window) => (
                    <li
                      key={`${window.dayOfWeek}-${window.hour}`}
                      className="flex justify-between gap-4"
                    >
                      <span>{formatDayHour(window.dayOfWeek, window.hour)}</span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: 'var(--color-band-green)' }}
                      >
                        {formatDuration(window.averageMinutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      <section
        className="mt-8 rounded-xl border-2 p-4"
        style={{
          borderColor: 'var(--color-band-orange)',
          background: 'var(--color-band-orange-soft)',
        }}
      >
        <h2 className="font-bold">Never delay urgent care to wait for a quiet hour</h2>
        <p className="mt-1 text-sm">
          These patterns are for planning a visit that can genuinely wait — a nagging injury, a
          referral, a recurring problem. If you need care now, go now, and call 911 if it is
          serious.
        </p>
      </section>
    </div>
  );
}
