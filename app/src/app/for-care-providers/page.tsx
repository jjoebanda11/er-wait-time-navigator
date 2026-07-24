import type { Metadata } from 'next';
import Link from 'next/link';
import { getWaitTimes } from '@/lib/ahs/client';
import { REGION_LABELS } from '@/lib/ahs/parse';
import type { AhsRegionKey } from '@/lib/ahs/types';
import { config } from '@/lib/config';
import { formatDuration } from '@/lib/rank';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'For home care, senior living and care coordinators',
  description:
    'Track live Alberta emergency wait times across every address your organization serves. Free tool for home care agencies, supportive living operators and care coordinators.',
  alternates: { canonical: '/for-care-providers' },
};

/**
 * The one-page pitch, as a live web page.
 *
 * Prints to a single sheet (see the print rules in globals.css) so it can be
 * left on a desk after a meeting, and works as an inbound landing page for
 * coordinators searching for exactly this.
 *
 * Deliberately, the headline evidence is computed from the current board rather
 * than written as a static claim. A pitch that demonstrates the problem at the
 * moment it is read is far more persuasive than one asserting it happened once,
 * and it cannot go stale.
 */
export default async function ForCareProvidersPage() {
  const snapshot = await getWaitTimes();

  // Find the region with the widest live spread — the sharpest evidence
  // available at this moment, wherever it happens to be.
  const byRegion = new Map<string, { name: string; wait: number }[]>();
  for (const f of snapshot.facilities) {
    if (f.waitMinutes == null) continue;
    const list = byRegion.get(f.region) ?? [];
    list.push({ name: f.name, wait: f.waitMinutes });
    byRegion.set(f.region, list);
  }

  let evidence: {
    region: string;
    shortest: { name: string; wait: number };
    longest: { name: string; wait: number };
    spread: number;
  } | null = null;

  for (const [region, list] of byRegion) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.wait - b.wait);
    const shortest = sorted[0];
    const longest = sorted[sorted.length - 1];
    const spread = longest.wait - shortest.wait;
    if (!evidence || spread > evidence.spread) {
      evidence = { region, shortest, longest, spread };
    }
  }

  return (
    <div className="print-compact mx-auto max-w-3xl px-4 py-8">
      <div className="print-tight space-y-6">
        <header className="page-break-avoid">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-600">
            For home care, supportive living &amp; care coordination
          </p>
          <h1 className="mt-1 text-3xl font-black leading-tight">
            Stop sending clients to the slowest emergency room
          </h1>
          <p className="mt-2 text-lg text-muted">
            Alberta Health Services publishes how long each emergency department expects patients to
            wait. It does not tell you which one will see <em>your</em> client soonest. Those are
            different questions, and the gap between them is measured in hours.
          </p>
        </header>

        {evidence && evidence.spread >= 60 && (
          <section
            className="page-break-avoid rounded-xl border-2 p-4"
            style={{
              borderColor: 'var(--color-band-green)',
              background: 'var(--color-band-green-soft)',
            }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wide">
              Live evidence, as you read this
            </h2>
            <p className="mt-1 leading-relaxed">
              In{' '}
              <strong>
                {REGION_LABELS[evidence.region as AhsRegionKey] ?? evidence.region}
              </strong>{' '}
              right now there is a <strong>{formatDuration(evidence.spread)}</strong> difference
              between the shortest posted wait ({evidence.shortest.name},{' '}
              {formatDuration(evidence.shortest.wait)}) and the longest ({evidence.longest.name},{' '}
              {formatDuration(evidence.longest.wait)}).
            </p>
            <p className="mt-1.5 text-sm">
              For a frail client, that difference is not an inconvenience. It is hours on a
              stretcher in a hallway, and a materially worse day.
            </p>
          </section>
        )}

        <section className="page-break-avoid">
          <h2 className="text-xl font-bold">What the dashboard does</h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
            <li>
              <strong>Every address you serve, on one screen.</strong> Add the locations your team
              covers. Each shows the fastest real option right now.
            </li>
            <li>
              <strong>Sorted worst-first.</strong> The clients facing the longest waits are at the
              top, because that is the decision you actually need to make.
            </li>
            <li>
              <strong>True door-to-doctor time.</strong> Posted wait plus the drive from that
              address plus a realistic parking and walk-in allowance — not just the raw number.
            </li>
            <li>
              <strong>Child-aware routing.</strong> Prefers children&rsquo;s emergency departments
              and hides departments that only accept adults.
            </li>
            <li>
              <strong>All seven reporting Alberta regions.</strong> Edmonton, Calgary, Red Deer,
              Lethbridge, Medicine Hat, Grande Prairie, Fort McMurray.
            </li>
            <li>
              <strong>Faster alternatives built in.</strong> Alberta pharmacists can assess and
              prescribe for many conditions; Health Link 811 is free, 24/7. Often the right answer
              is not an emergency department at all.
            </li>
            <li>
              <strong>Export to CSV</strong> for shift handover or incident records.
            </li>
          </ul>
        </section>

        <section
          className="page-break-avoid rounded-xl border-2 p-4"
          style={{ borderColor: 'var(--color-brand-600)' }}
        >
          <h2 className="text-xl font-bold">Your client list never reaches us</h2>
          <p className="mt-1.5 text-sm leading-relaxed">
            Locations you add are stored in your own browser and are never transmitted to our
            servers. We hold no names, no addresses, no health information, and there is no account
            to create.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            This is deliberate. Because we never receive information about identifiable people, we
            are not a custodian of health information under Alberta&rsquo;s{' '}
            <em>Health Information Act</em>, and adopting this tool does not add a vendor to your
            privacy impact assessment. The tool also steers staff toward non-identifying labels
            such as &ldquo;Client 14 — Millwoods&rdquo;.
          </p>
        </section>

        <section className="page-break-avoid">
          <h2 className="text-xl font-bold">Cost</h2>
          <p className="mt-1.5 text-sm leading-relaxed">
            <strong>Free to use today</strong>, with no account and no commitment. We are working
            with a small number of Alberta care organizations to get this right before adding paid
            team features — shared rosters across staff and devices, reporting, and a support
            agreement.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            If you want to be one of them, the most useful thing you can give us is twenty minutes
            of a coordinator&rsquo;s time telling us what actually happens on a bad afternoon.
          </p>
        </section>

        <section className="page-break-avoid rounded-xl surface p-4">
          <h2 className="text-lg font-bold">Two ways to use it</h2>
          <p className="mt-1 text-sm">
            <strong>Coordinator dashboard</strong> —{' '}
            <Link href="/dashboard" className="font-semibold text-brand-600 underline">
              {config.site.url.replace(/^https?:\/\//, '')}/dashboard
            </Link>
            . For home care: every address you serve on one screen, longest wait first.
          </p>
          <p className="mt-1.5 text-sm">
            <strong>Station display</strong> —{' '}
            <Link href="/station" className="font-semibold text-brand-600 underline">
              {config.site.url.replace(/^https?:\/\//, '')}/station
            </Link>
            . For a single building: a hands-free wall screen showing the fastest option right now.
            Set it up once and mount a tablet.
          </p>
          <p className="mt-2 text-sm">
            Questions:{' '}
            <a href={`mailto:${config.site.contactEmail}`} className="underline">
              {config.site.contactEmail}
            </a>
          </p>
        </section>

        <section className="page-break-avoid border-t pt-3 text-xs leading-relaxed text-muted">
          <p>
            Wait times are published by Alberta Health Services as estimates of the time to see a
            physician and can change without warning. Emergency departments triage by severity, so a
            shorter posted wait does not guarantee being seen sooner. Travel and parking times are
            our own estimates. This tool supports operational planning and is not medical advice, a
            clinical assessment, or a substitute for professional judgement. In an emergency call
            911; for free 24/7 nurse advice call 811.
          </p>
          <p className="mt-1.5">
            {config.site.name} is independent and is not affiliated with, endorsed by, or operated
            by Alberta Health Services, Primary Care Alberta, or the Government of Alberta.
          </p>
        </section>

        <div className="no-print">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700"
          >
            Open the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
