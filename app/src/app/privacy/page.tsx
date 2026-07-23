import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How ER Wait Time Navigator handles your information. Short version: your location stays on your device and we collect no health information.',
  alternates: { canonical: '/privacy' },
};

const EFFECTIVE_DATE = 'July 22, 2026';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-6 space-y-6 leading-relaxed">
        <section
          className="rounded-xl border-2 p-4"
          style={{
            borderColor: 'var(--color-band-green)',
            background: 'var(--color-band-green-soft)',
          }}
        >
          <h2 className="text-xl font-bold">The short version</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>We do not ask for your name, email, or health card number.</li>
            <li>We never collect or store your symptoms, conditions, or medical history.</li>
            <li>
              Your location is used on your device to sort a list. It is not stored on our servers.
            </li>
            <li>The symptom checker runs entirely in your browser. Answers are never sent to us.</li>
            <li>We do not sell data, and we do not run advertising trackers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">1. What we collect</h2>

          <h3 className="mt-3 font-bold">Location</h3>
          <p className="mt-1">
            If you tap &ldquo;Use my location&rdquo;, your browser gives us your approximate
            coordinates. They are used to calculate distances and sort facilities, and they are
            stored only in your own browser so the list still works when you return. They are not
            transmitted to our servers, and we cannot see them.
          </p>
          <p className="mt-1">
            The one exception: if this deployment is configured with a third-party routing service
            to improve drive-time accuracy, your coordinates and the hospital coordinates are sent
            to that service to compute travel times. They are not stored by us and are not linked to
            any identifier. You can avoid this entirely by not sharing your location; the site works
            without it.
          </p>

          <h3 className="mt-3 font-bold">Symptom checker answers</h3>
          <p className="mt-1">
            The symptom checker runs entirely in your browser. Your answers are never sent to our
            servers, never stored, and disappear when you close the page. This is deliberate: we do
            not want to hold health information about anyone.
          </p>

          <h3 className="mt-3 font-bold">Preferences</h3>
          <p className="mt-1">
            Your chosen city, saved facilities, and patient type are kept in your browser&rsquo;s
            local storage on your device. Clearing your browser data removes them.
          </p>

          <h3 className="mt-3 font-bold">Wait-time alerts</h3>
          <p className="mt-1">
            If you set up an alert, we store the push endpoint your browser generates, which
            facility you want watched, and your chosen threshold in minutes. That is all. We do not
            store a name, an email address, a location, or any reason for your interest. You can
            delete an alert at any time, which removes the record.
          </p>

          <h3 className="mt-3 font-bold">Technical logs</h3>
          <p className="mt-1">
            Our hosting provider records standard server logs, which may include IP addresses,
            request times, and user agents, for security and reliability purposes. We do not use
            these to build profiles of individuals.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">2. What we do not collect</h2>
          <p className="mt-2">
            We do not collect health information, personal health numbers, diagnoses, symptoms, or
            any information that would identify you as a patient. We are not a custodian of health
            information under Alberta&rsquo;s <em>Health Information Act</em>, and we have designed
            the service specifically so that we never become one.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">3. Legal basis and your rights</h2>
          <p className="mt-2">
            We handle the limited information above in accordance with Alberta&rsquo;s{' '}
            <em>Personal Information Protection Act</em> (PIPA) and Canada&rsquo;s{' '}
            <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) where
            applicable.
          </p>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Ask what information we hold that relates to you;</li>
            <li>Ask us to correct or delete it;</li>
            <li>Withdraw consent at any time, by deleting your alerts and clearing site data;</li>
            <li>Complain to the Office of the Information and Privacy Commissioner of Alberta.</li>
          </ul>
          <p className="mt-2">
            Because we hold so little, most requests can be satisfied by you clearing your browser
            data and deleting any alerts. For anything else, contact us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">4. Sharing</h2>
          <p className="mt-2">
            We do not sell, rent, or trade information. We share only with service providers
            necessary to operate the site — hosting, and, if configured, a routing provider and a
            push notification service — and only what those providers need to perform their
            function. We may disclose information if required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">5. Retention</h2>
          <p className="mt-2">
            Alert records are kept until you delete them, or until your browser&rsquo;s push
            subscription expires and delivery permanently fails, at which point we remove them
            automatically. Aggregate wait-time history contains no user information at all and is
            kept indefinitely for trend analysis.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">6. Children</h2>
          <p className="mt-2">
            The service is intended for adults, including adults seeking care for children. We do
            not knowingly collect information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">7. Contact</h2>
          <p className="mt-2">
            Privacy questions or requests:{' '}
            <a href={`mailto:${config.site.contactEmail}`} className="underline">
              {config.site.contactEmail}
            </a>
            .
          </p>
        </section>

        <p className="text-sm text-muted">
          See also our{' '}
          <Link href="/terms" className="underline">
            terms of use
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
