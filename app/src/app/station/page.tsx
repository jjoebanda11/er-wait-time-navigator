import type { Metadata } from 'next';
import Link from 'next/link';
import { getWaitTimes } from '@/lib/ahs/client';
import { decodeStationConfig } from '@/lib/b2b/station-config';
import { StationDisplay } from '@/components/station-display';
import { StationSetup } from '@/components/station-setup';

export const revalidate = 180;

export const metadata: Metadata = {
  title: 'Nurse station display',
  description:
    'A hands-free wall display showing which emergency department is fastest from a care facility right now. Set it up once and mount it.',
  // Configured URLs carry a facility name; keep them out of search results.
  robots: { index: false, follow: false },
};

/**
 * The station route serves double duty from one URL.
 *
 * With valid config in the query string it renders the full-screen wall
 * display. With no config it renders the one-time setup wizard. That keeps the
 * whole feature at a single, shareable address and means a facility can go from
 * "never seen this" to "mounted and running" without an account or a call.
 */
export default async function StationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const config = decodeStationConfig(params);
  const snapshot = await getWaitTimes();

  if (config) {
    return <StationDisplay snapshot={snapshot} config={config} />;
  }

  const regions = [...new Set(snapshot.facilities.map((f) => f.region))];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href="/for-care-providers" className="hover:underline">
          For care providers
        </Link>{' '}
        / <span className="text-[var(--text)]">Station display</span>
      </nav>

      <h1 className="text-3xl font-black leading-tight">Set up a station display</h1>
      <p className="mt-2 text-lg text-muted">
        A hands-free screen for a nurse station or reception desk. It shows, in large type, which
        emergency department would see someone from this building soonest right now — and refreshes
        itself. Set it up once, mount a tablet, and leave it running.
      </p>

      <div className="mt-6">
        <StationSetup regions={regions} />
      </div>

      <section className="mt-8 space-y-2 text-sm text-muted">
        <h2 className="text-base font-bold text-[var(--text)]">How it works</h2>
        <p>
          Everything you enter is packed into the display&rsquo;s web address. There is no account
          and nothing is stored on our servers — not the building, not its address. Bookmark the
          link on the device you mount and it will keep working on its own.
        </p>
        <p>
          It is a planning aid, not medical advice, and it does not replace clinical judgement. For
          an emergency, call 911; for free nurse advice, call 811.
        </p>
      </section>
    </div>
  );
}
