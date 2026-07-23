import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for ER Wait Time Navigator.',
  alternates: { canonical: '/terms' },
};

const EFFECTIVE_DATE = 'July 22, 2026';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-6 space-y-6 leading-relaxed">
        <section
          className="rounded-xl border-2 p-4"
          style={{
            borderColor: 'var(--color-band-red)',
            background: 'var(--color-band-red-soft)',
          }}
        >
          <h2 className="text-xl font-bold">1. This is not medical advice</h2>
          <p className="mt-2">
            {config.site.name} is an information and navigation tool. It does not provide medical
            advice, diagnosis, or treatment, and using it does not create a clinician–patient
            relationship. Nothing on this site should be used as a substitute for the judgement of a
            qualified health professional.
          </p>
          <p className="mt-2 font-semibold">
            If you believe you are experiencing a medical emergency, call 911 immediately. If you
            are unsure how serious your situation is, call Health Link at 811 to speak with a
            registered nurse, free, 24 hours a day.
          </p>
          <p className="mt-2">
            Never delay seeking care, and never disregard professional medical advice, because of
            something you read here.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">2. About the wait time information</h2>
          <p className="mt-2">
            Wait times shown on this site originate from Alberta Health Services, which publishes
            them as estimates of the time to see a physician. Alberta Health Services states that
            these estimates are approximate, can change significantly and immediately without
            warning, and are not guaranteed.
          </p>
          <p className="mt-2">
            We add estimated travel and parking time to produce a combined figure. Travel estimates
            are calculated from distance and typical speeds, or from a routing service, and do not
            account for road closures, weather, construction, or your individual circumstances.
            Every number shown is an estimate, and the combined figure compounds the uncertainty of
            its parts.
          </p>
          <p className="mt-2">
            Patients are seen in emergency departments according to the severity of their condition,
            not according to arrival order or any posted estimate. A shorter posted wait does not
            mean you will be seen sooner than at another site, and a longer one does not mean you
            will not.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">3. Independence</h2>
          <p className="mt-2">
            {config.site.name} is an independent service. It is not affiliated with, endorsed by,
            sponsored by, or operated by Alberta Health Services, Primary Care Alberta, Acute Care
            Alberta, Alberta Health, or the Government of Alberta. References to those organizations
            are descriptive only.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">4. Acceptable use</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use the service in a way that interferes with its operation or availability;</li>
            <li>
              Present information from this service as official Alberta Health Services
              communication, or otherwise misrepresent its source;
            </li>
            <li>
              Use the service to make clinical decisions for other people in a professional
              capacity without independent verification;
            </li>
            <li>Attempt to gain unauthorized access to any part of the service.</li>
          </ul>
          <p className="mt-2">
            Our public wait-times endpoint is offered free of charge, and the attribution and
            non-affiliation notices must be preserved wherever it is used. Note that the underlying
            wait times are Alberta Health Services content, licensed by AHS for personal,
            non-commercial use; commercial use requires written permission from AHS. We grant no
            rights in that underlying data, because they are not ours to grant. Anyone intending
            commercial use is responsible for obtaining permission from AHS directly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">5. Availability</h2>
          <p className="mt-2">
            The service is provided as-is and as-available. We do not guarantee uptime, accuracy, or
            continued availability, and we depend on an upstream data source we do not control. The
            service may be interrupted, changed, or discontinued at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">6. Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, {config.site.legalEntity} and anyone involved in
            producing this service will not be liable for any injury, loss, or damage arising from
            your use of, or reliance on, the service or the information in it — including decisions
            about where, when, or whether to seek medical care.
          </p>
          <p className="mt-2">
            Some jurisdictions do not allow the exclusion of certain liabilities. Where that is the
            case, our liability is limited to the minimum permitted by law. Nothing in these terms
            excludes liability that cannot lawfully be excluded.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">7. Changes to these terms</h2>
          <p className="mt-2">
            We may update these terms. Material changes will be reflected in the effective date
            above. Continuing to use the service after a change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">8. Governing law</h2>
          <p className="mt-2">
            These terms are governed by the laws of the Province of Alberta and the federal laws of
            Canada that apply in Alberta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">9. Contact</h2>
          <p className="mt-2">
            Questions about these terms:{' '}
            <a href={`mailto:${config.site.contactEmail}`} className="underline">
              {config.site.contactEmail}
            </a>
            .
          </p>
        </section>

        <p className="text-sm text-muted">
          See also our{' '}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{' '}
          and{' '}
          <Link href="/data" className="underline">
            data sources
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
