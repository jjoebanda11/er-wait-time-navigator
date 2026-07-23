import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why ER Wait Time Navigator exists, what it does differently from the official AHS wait times page, and how it stays free.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black">About</h1>

      <div className="mt-6 space-y-6 leading-relaxed">
        <p className="text-lg">
          Alberta Health Services already tells you how long each emergency department expects you
          to wait. It does not tell you the thing you actually need to know: given where you are
          standing right now, which one will see you soonest.
        </p>

        <p>
          Those are different questions, and the gap between them is measured in hours. A hospital
          twenty-five minutes further away with a three-hour shorter queue is the better choice, and
          the official list — sorted alphabetically, with no reference to where you are — will never
          tell you that. Neither will a maps app, which knows the drive but not the queue.
        </p>

        <p>
          This site adds the two together, plus a realistic allowance for parking and walking to
          triage, and sorts every Alberta emergency department and urgent care centre by the result.
          One number: how long until someone sees you.
        </p>

        <h2 className="text-xl font-bold">What it also does</h2>
        <p>
          A large share of emergency department visits would be resolved faster somewhere else.
          Alberta gives pharmacists the broadest prescribing scope in the country, and Health Link
          811 puts a registered nurse on the phone for free at any hour. Most people do not know the
          first thing and forget the second. So this site also{' '}
          <Link href="/triage" className="underline">
            asks a few plain questions
          </Link>{' '}
          and points you to the right level of care — always escalating when there is any doubt, and
          always putting 911 first when the answer is 911.
        </p>

        <h2 className="text-xl font-bold">How it stays free</h2>
        <p>
          The live board, the rankings, the triage tool, and the alternative care directory are free
          and always will be, with no account required. Nobody should hit a paywall while deciding
          where to take a sick child at 2am.
        </p>
        <p>
          Costs are covered by optional paid features for people who want the service watching on
          their behalf — wait-threshold alerts, multi-person coordination — and, in time, by
          organizations that need this at scale. We do not sell data and we do not run advertising
          trackers.
        </p>

        <h2 className="text-xl font-bold">Independence</h2>
        <p>
          {config.site.name} is independent and is not affiliated with, endorsed by, or operated by
          Alberta Health Services, Primary Care Alberta, or the Government of Alberta. We use their
          published data, attribute it clearly, and take care not to burden their systems.{' '}
          <Link href="/data" className="underline">
            The full data methodology is public
          </Link>
          .
        </p>

        <h2 className="text-xl font-bold">Corrections</h2>
        <p>
          If a phone number is wrong, a facility is missing, or something reads misleadingly, tell
          us and we will fix it quickly:{' '}
          <a href={`mailto:${config.site.contactEmail}`} className="underline">
            {config.site.contactEmail}
          </a>
          . Accuracy complaints about this kind of tool go to the front of the queue.
        </p>
      </div>
    </div>
  );
}
