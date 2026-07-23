import type { Metadata } from 'next';
import Link from 'next/link';
import { AHS_FEED_URL, CACHE_TTL_SECONDS } from '@/lib/ahs/client';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Where our data comes from',
  description:
    'Exactly how ER Wait Time Navigator gets Alberta emergency wait times, how often, how travel time is estimated, and what the limitations are.',
  alternates: { canonical: '/data' },
};

export default function DataPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black">Where our data comes from</h1>
      <p className="mt-2 text-lg text-muted">
        A tool that tells you where to seek medical care should be completely transparent about how
        it knows what it claims to know. Here is all of it.
      </p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">Wait times</h2>
          <p className="mt-2">
            Every wait time on this site comes from Alberta Health Services. AHS publishes estimated
            emergency department and urgent care wait times on its public website, served from a
            public JSON endpoint that requires no key and no authentication:
          </p>
          <p className="mt-2 break-all rounded-lg bg-[var(--bg-subtle)] p-3 font-mono text-sm">
            {AHS_FEED_URL}
          </p>
          <p className="mt-2">
            We read that endpoint at most once every {CACHE_TTL_SECONDS / 60} minutes and cache the
            result for everyone, which keeps our load on a public health system&rsquo;s
            infrastructure to a small, constant trickle regardless of how many people use this site.
            We honour the AHS <code>robots.txt</code>, identify ourselves in our user agent, and
            preserve the AHS attribution everywhere the data appears.
          </p>
          <p className="mt-2">
            We do not alter the wait times. What AHS publishes is what you see, alongside our own
            calculations clearly labelled as separate.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">What the wait time actually means</h2>
          <p className="mt-2">
            AHS describes it as an estimate of the time to see a physician, based on the average
            patient. It does not reflect the wait for critically ill or injured patients, who are
            seen first, nor for patients with very minor conditions. Emergency departments triage by
            severity, always.
          </p>
          <p className="mt-2">
            This matters for how you read our rankings: they tell you where an average patient with
            an average complaint would likely be seen soonest. They cannot tell you what will happen
            to you specifically.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Locations</h2>
          <p className="mt-2">
            Facility coordinates come from the same AHS feed, which embeds a map link for each site.
            We parse the coordinates out of that link rather than geocoding addresses ourselves, so
            our positions are exactly the ones AHS publishes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Travel time</h2>
          <p className="mt-2">
            This is our own calculation, and it is an estimate. By default we compute the
            straight-line distance from your device to each facility, apply a road-detour factor
            calibrated for Alberta&rsquo;s grid cities, and convert to minutes using
            distance-tiered average speeds that account for city stops on short trips and highway
            speeds on long ones.
          </p>
          <p className="mt-2">
            We then add a parking-and-walk-in allowance that differs by site, because reaching
            triage at a large tertiary hospital with a parkade genuinely takes longer than at a
            community hospital with a lot at the door.
          </p>
          <p className="mt-2">
            When this deployment is configured with a routing service, we use real road routing
            instead — and with a traffic-aware provider, current traffic conditions. The board tells
            you which method produced the numbers you are looking at.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Historical trends</h2>
          <p className="mt-2">
            AHS publishes the current wait but keeps no public archive, so historical patterns
            cannot be looked up anywhere — they have to be recorded as they happen. We capture the
            full board on a schedule and build the record ourselves. Trends appear once a facility
            has enough readings for an average to mean something.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Care options and phone numbers</h2>
          <p className="mt-2">
            Alternative care information — Health Link 811, pharmacist prescribing scope, crisis
            lines — is compiled from official Alberta government, Primary Care Alberta, and Alberta
            Health Services sources and reviewed periodically. If you find anything out of date,{' '}
            <a href={`mailto:${config.site.contactEmail}`} className="underline">
              tell us
            </a>{' '}
            and we will correct it quickly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Use our data</h2>
          <p className="mt-2">
            Our normalized feed is public and free, including for commercial use, as long as you
            keep the AHS attribution and the non-affiliation notice:
          </p>
          <p className="mt-2 break-all rounded-lg bg-[var(--bg-subtle)] p-3 font-mono text-sm">
            {config.site.url}/api/wait-times
          </p>
          <p className="mt-2">
            Add <code>?region=Edmonton</code> to filter. It returns parsed minute values,
            coordinates, and facility classifications rather than the display strings the upstream
            feed uses.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">Limitations we want you to know about</h2>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              Wait times change without warning. A number that was accurate when you loaded the page
              may not be accurate when you arrive.
            </li>
            <li>
              Travel estimates do not know about closures, collisions, weather, or how long you take
              to leave the house.
            </li>
            <li>
              We cannot see inside a department. A sudden influx of critical patients will lengthen
              every wait behind it, instantly and invisibly.
            </li>
            <li>
              Some sites do not publish a wait time at all. We show those separately and never rank
              them as though they were fast.
            </li>
            <li>
              None of this is a substitute for clinical judgement. When in doubt, call 811, or 911.
            </li>
          </ul>
        </section>

        <p className="text-sm text-muted">
          See also our{' '}
          <Link href="/terms" className="underline">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
