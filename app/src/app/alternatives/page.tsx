import type { Metadata } from 'next';
import Link from 'next/link';
import { CARE_OPTIONS, CRISIS_CONTACTS } from '@/lib/care-options';

export const metadata: Metadata = {
  title: 'Faster alternatives to the ER in Alberta',
  description:
    'Alberta pharmacists can prescribe for many conditions in under an hour. Health Link 811 gives free nurse advice 24/7. Urgent care, virtual care and more — every option that beats an eight-hour ER wait.',
  alternates: { canonical: '/alternatives' },
};

export default function AlternativesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-black leading-tight">
        Faster ways to get care in Alberta
      </h1>
      <p className="mt-2 text-lg text-muted">
        Most emergency department visits have a faster, equally valid alternative. These are the
        real options available across Alberta, what each one handles, and roughly how long it takes.
      </p>

      <section
        className="mt-6 rounded-xl border-2 p-4"
        style={{ borderColor: 'var(--color-band-red)', background: 'var(--color-band-red-soft)' }}
      >
        <h2 className="font-bold" style={{ color: 'var(--color-band-red)' }}>
          Numbers worth saving right now
        </h2>
        <ul className="mt-3 space-y-2">
          {CRISIS_CONTACTS.map((contact) => (
            <li key={contact.value} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">{contact.label}</span>
              <a href={contact.href} className="text-lg font-black underline tabular-nums">
                {contact.value}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ul className="mt-8 space-y-4">
        {CARE_OPTIONS.map((option) => (
          <li key={option.id} className="rounded-xl surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{option.name}</h2>
              <span className="text-sm font-semibold text-muted">{option.availability}</span>
            </div>

            <p className="mt-1 font-medium">{option.summary}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{option.detail}</p>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted">Typical wait</dt>
                <dd className="font-semibold">{option.typicalWait}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Cost</dt>
                <dd className="font-semibold">{option.cost}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {option.phone && (
                <a
                  href={`tel:${option.phone.replace(/[^\d+]/g, '')}`}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Call {option.phone}
                </a>
              )}
              {option.url && (
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
                >
                  Official information
                </a>
              )}
              {option.id === 'urgent-care' && (
                <Link
                  href="/"
                  className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
                >
                  See live urgent care waits
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-xl font-bold text-[var(--text)]">
          Why using an alternative helps everyone
        </h2>
        <p>
          Emergency departments triage by severity, so a non-urgent patient waits behind every more
          serious case that arrives — which is why non-urgent waits stretch past eight hours while
          critical patients are seen in minutes. Choosing a pharmacist or urgent care centre for a
          non-urgent problem gets you treated far sooner and shortens the queue for the person
          behind you.
        </p>
        <p>
          None of this means avoiding the ER when you need it. If your situation is or might be an
          emergency, go — or call 911.{' '}
          <Link href="/triage" className="underline">
            Not sure which this is?
          </Link>
        </p>
      </section>
    </div>
  );
}
