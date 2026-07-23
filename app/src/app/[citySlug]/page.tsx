import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWaitTimes } from '@/lib/ahs/client';
import { REGION_LABELS, REGION_SLUGS, regionFromSlug } from '@/lib/ahs/parse';
import type { AhsRegionKey } from '@/lib/ahs/types';
import { config } from '@/lib/config';
import { formatDuration } from '@/lib/rank';
import { WaitBoard } from '@/components/wait-board';

export const revalidate = 180;

/** City pages live at `/edmonton-er-wait-times`, matching how people search. */
const SUFFIX = '-er-wait-times';

function regionForCitySlug(citySlug: string): AhsRegionKey | null {
  if (!citySlug.endsWith(SUFFIX)) return null;
  return regionFromSlug(citySlug.slice(0, -SUFFIX.length));
}

export function generateStaticParams() {
  return Object.values(REGION_SLUGS).map((slug) => ({ citySlug: `${slug}${SUFFIX}` }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}): Promise<Metadata> {
  const { citySlug } = await params;
  const region = regionForCitySlug(citySlug);
  if (!region) return {};

  const city = REGION_LABELS[region];
  return {
    title: `${city} ER wait times — live emergency room waits`,
    description: `Live emergency department wait times for ${city}, Alberta, ranked by true door-to-doctor time including your drive. Updated continuously from Alberta Health Services. Free.`,
    alternates: { canonical: `/${citySlug}` },
    openGraph: {
      title: `Live ${city} ER wait times`,
      description: `Which ${city} emergency room will actually see you soonest, including the drive.`,
      url: `${config.site.url}/${citySlug}`,
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  const region = regionForCitySlug(citySlug);
  if (!region) notFound();

  const snapshot = await getWaitTimes();
  const facilities = snapshot.facilities.filter((f) => f.region === region);
  if (facilities.length === 0 && snapshot.facilities.length > 0) notFound();

  const city = REGION_LABELS[region];
  const withWaits = facilities.filter((f) => f.waitMinutes != null);
  const average =
    withWaits.length > 0
      ? withWaits.reduce((sum, f) => sum + f.waitMinutes!, 0) / withWaits.length
      : null;

  const routingUpgradeAvailable = Boolean(
    config.routing.orsApiKey || config.routing.googleRoutesApiKey,
  );

  // Structured data so search engines can surface the live numbers directly.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the shortest ER wait time in ${city} right now?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            withWaits.length > 0
              ? `The shortest posted emergency department wait in the ${city} area is currently ${formatDuration(
                  Math.min(...withWaits.map((f) => f.waitMinutes!)),
                )}. Wait times change continuously — check the live board for current numbers, and remember to add your travel time.`
              : `Wait time data for ${city} is temporarily unavailable. Call Health Link at 811 for advice on where to go.`,
        },
      },
      {
        '@type': 'Question',
        name: `Which ${city} emergency room should I go to?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The best choice is the one with the shortest total time to be seen, which combines the posted wait with your drive and parking — not simply the nearest hospital or the shortest posted wait. If you are unsure whether you need an emergency department at all, call Health Link at 811 for free 24/7 nurse advice. For anything life-threatening, call 911.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Where does this wait time data come from?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wait times are published by Alberta Health Services and are estimates of the time to see a physician. They can change without warning and are not guaranteed. This site is independent and not affiliated with Alberta Health Services.',
        },
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href="/" className="hover:underline">
          Alberta
        </Link>{' '}
        / <span className="text-[var(--text)]">{city}</span>
      </nav>

      <h1 className="text-3xl font-black leading-tight sm:text-4xl">
        {city} ER wait times, live
      </h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">
        Every emergency department and urgent care centre in the {city} area, ranked by how long it
        would actually take <em>you</em> to be seen.
      </p>

      {average != null && (
        <p className="mt-4 text-sm text-muted">
          Across {withWaits.length} {city}-area sites reporting right now, the average posted wait is{' '}
          <strong className="text-[var(--text)]">{formatDuration(average)}</strong>.
        </p>
      )}

      <div className="mt-6">
        <WaitBoard
          snapshot={snapshot}
          fixedRegion={region}
          routingUpgradeAvailable={routingUpgradeAvailable}
        />
      </div>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-xl font-bold text-[var(--text)]">
          How to choose an emergency department in {city}
        </h2>
        <p>
          Start with whether you need an emergency department at all. Alberta pharmacists can assess
          and prescribe for a long list of conditions, usually within half an hour, and Health Link
          at 811 gives free registered-nurse advice around the clock.{' '}
          <Link href="/alternatives" className="underline">
            See every faster alternative
          </Link>
          , or{' '}
          <Link href="/triage" className="underline">
            answer a few questions
          </Link>{' '}
          to find the right level of care.
        </p>
        <p>
          If you do need emergency care, compare total time rather than posted wait. Sharing your
          location above adds your drive and a realistic parking allowance to each site&rsquo;s
          current queue, then sorts by the result. In practice that regularly changes which hospital
          is the right answer.
        </p>
        <p>
          For anything life-threatening — chest pain, trouble breathing, stroke symptoms, severe
          bleeding — call 911 rather than driving. Paramedics begin care immediately and the
          department is ready before you arrive.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Other Alberta cities</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(REGION_SLUGS) as AhsRegionKey[])
            .filter((key) => key !== region)
            .filter((key) => snapshot.facilities.some((f) => f.region === key))
            .map((key) => (
              <li key={key}>
                <Link
                  href={`/${REGION_SLUGS[key]}${SUFFIX}`}
                  className="inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
                >
                  {REGION_LABELS[key]}
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
