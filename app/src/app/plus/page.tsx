import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';
import { PLANS, formatPrice } from '@/lib/billing/plans';

export const metadata: Metadata = {
  title: 'Plans',
  description:
    'Live Alberta ER wait times and door-to-doctor ranking are free forever, no account. Optional paid tiers add wait-threshold alerts and family coordination.',
  alternates: { canonical: '/plus' },
};

export default function PlusPage() {
  const billingLive = config.billing.enabled;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-black">Plans</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">
        Everything you need to decide where to go right now is free, forever, with no account.
        Paid tiers exist for one thing the free tier structurally cannot do: watch on your behalf
        while you are not looking.
      </p>

      {!billingLive && (
        <div
          className="mt-6 rounded-xl border-2 p-4"
          style={{
            borderColor: 'var(--color-brand-600)',
            background: 'var(--bg-subtle)',
          }}
        >
          <h2 className="font-bold">Paid plans aren&rsquo;t open yet</h2>
          <p className="mt-1 text-sm">
            We&rsquo;re focused on making the free service excellent and dependable first. The
            plans below are what we intend to offer. Nothing that is free today will move behind a
            paywall later.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <section
            key={plan.id}
            className="flex flex-col rounded-xl surface p-5"
            style={
              plan.highlight
                ? { borderColor: 'var(--color-brand-600)', borderWidth: 2 }
                : undefined
            }
          >
            {plan.highlight && (
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-600">
                Most useful
              </p>
            )}

            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

            <p className="mt-4">
              <span className="text-3xl font-black tabular-nums">
                {formatPrice(plan.monthlyPrice)}
              </span>
              {plan.monthlyPrice > 0 && (
                <span className="text-sm text-muted"> /month</span>
              )}
            </p>
            {plan.annualPrice > 0 && (
              <p className="text-sm text-muted">
                or {formatPrice(plan.annualPrice)}/year
              </p>
            )}

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden style={{ color: 'var(--color-band-green)' }}>
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {plan.alwaysFree?.map((note) => (
              <p key={note} className="mt-3 text-xs font-medium text-muted">
                {note}
              </p>
            ))}

            <div className="mt-5">
              {plan.id === 'free' ? (
                <Link
                  href="/"
                  className="block rounded-lg bg-brand-600 px-4 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
                >
                  Start using it
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border px-4 py-2.5 font-semibold opacity-60"
                >
                  {billingLive ? 'Coming soon' : 'Not open yet'}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 max-w-2xl space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-xl font-bold text-[var(--text)]">Our commitment</h2>
        <p>
          The live board, door-to-doctor ranking, symptom triage, alternative care directory, and
          crisis numbers will never require payment or an account. Putting any of that behind a
          paywall would fail the exact person this was built for.
        </p>
        <p>
          We do not sell data, and we do not run advertising trackers.{' '}
          <Link href="/privacy" className="underline">
            Read the privacy policy
          </Link>{' '}
          — it is short, because there is very little to describe.
        </p>
      </section>
    </div>
  );
}
