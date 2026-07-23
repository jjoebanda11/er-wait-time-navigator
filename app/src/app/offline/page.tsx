import type { Metadata } from 'next';
import { CRISIS_CONTACTS } from '@/lib/care-options';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Shown by the service worker when a navigation fails with no connection.
 *
 * Its job is to be useful without any data at all: the numbers below work from
 * any phone, including one with no data plan and no signal bars, because
 * emergency calls route over any available network.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-black">You&rsquo;re offline</h1>
      <p className="mt-2 text-lg text-muted">
        We can&rsquo;t load live wait times without a connection. These numbers still work.
      </p>

      <ul className="mt-6 space-y-3">
        {CRISIS_CONTACTS.map((contact) => (
          <li
            key={contact.value}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface p-4"
          >
            <span className="font-medium">{contact.label}</span>
            <a
              href={contact.href}
              className="rounded-lg bg-brand-600 px-4 py-2 text-lg font-black text-white tabular-nums"
            >
              {contact.value}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-muted">
        Emergency calls to 911 connect over any available network, even without a data plan or an
        active SIM. Once you have a signal again, reload this page for current wait times.
      </p>
    </div>
  );
}
