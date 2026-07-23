import Link from 'next/link';
import type { Metadata } from 'next';
import { getWaitTimes } from '@/lib/ahs/client';
import { REGION_LABELS, REGION_SLUGS } from '@/lib/ahs/parse';
import { config } from '@/lib/config';
import { WaitBoard } from '@/components/wait-board';
import { formatDuration } from '@/lib/rank';

// Re-render at most every three minutes; the client refreshes on top of this.
export const revalidate = 180;

export const metadata: Metadata = {
  title: 'Live Alberta ER wait times — ranked by when you will actually be seen',
  description:
    'Compare live emergency department and urgent care wait times across Edmonton, Calgary and Alberta. Ranked by true door-to-doctor time: current wait plus your drive. Free, no sign-up.',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const snapshot = await getWaitTimes();

  const routingUpgradeAvailable = Boolean(
    config.routing.orsApiKey || config.routing.googleRoutesApiKey,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <section className="mb-6">
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">
          Don&rsquo;t wait. Know.
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          Live emergency wait times across Alberta, ranked by how long it will actually take you to
          be seen — the posted wait <em>plus</em> your drive and parking. Free, no account.
        </p>

      </section>

      <WaitBoard snapshot={snapshot} routingUpgradeAvailable={routingUpgradeAvailable} />

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Link
          href="/triage"
          className="rounded-xl surface p-4 transition hover:border-brand-600"
        >
          <h2 className="font-bold">Not sure if this is an ER trip?</h2>
          <p className="mt-1 text-sm text-muted">
            Answer a few plain-language questions and we&rsquo;ll point you to the right level of
            care — including when to call 911 immediately.
          </p>
        </Link>

        <Link
          href="/alternatives"
          className="rounded-xl surface p-4 transition hover:border-brand-600"
        >
          <h2 className="font-bold">Faster options than the ER</h2>
          <p className="mt-1 text-sm text-muted">
            Alberta pharmacists can prescribe for many conditions. Health Link 811 is free, 24/7.
            Most ER visits have a faster alternative.
          </p>
        </Link>

        <Link href="/trends" className="rounded-xl surface p-4 transition hover:border-brand-600">
          <h2 className="font-bold">Best time to go</h2>
          <p className="mt-1 text-sm text-muted">
            Wait times follow patterns. See when each department is typically quietest, so a visit
            that can wait, waits well.
          </p>
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Wait times by city</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(REGION_SLUGS) as Array<keyof typeof REGION_SLUGS>).map((key) => {
            const count = snapshot.facilities.filter((f) => f.region === key).length;
            if (count === 0) return null;
            return (
              <li key={key}>
                <Link
                  href={`/${REGION_SLUGS[key]}-er-wait-times`}
                  className="inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
                >
                  {REGION_LABELS[key]}{' '}
                  <span className="text-muted">({count})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-xl font-bold text-[var(--text)]">
          Why the nearest emergency room is often the wrong one
        </h2>
        <p>
          Alberta Health Services publishes an estimated wait time for each emergency department,
          but reading it as a list of numbers hides the decision you are actually making. A hospital
          twenty minutes further away with a two-hour shorter queue gets you treated sooner. A large
          tertiary site with a parkade and a long walk to triage costs you time that a community
          hospital with a lot at the door does not.
        </p>
        <p>
          This site adds those pieces together into one number — the time from where you are
          standing to the moment a clinician sees you — and sorts every Alberta site by it. That is
          the only number worth acting on, and nobody else publishes it.
        </p>
        <p>
          It is free, requires no account, and keeps your location on your device.{' '}
          <Link href="/data" className="underline">
            Read exactly where the data comes from
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
