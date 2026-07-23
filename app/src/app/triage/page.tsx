import type { Metadata } from 'next';
import { getWaitTimes } from '@/lib/ahs/client';
import { config } from '@/lib/config';
import { TriageFlow } from '@/components/triage-flow';

export const revalidate = 180;

export const metadata: Metadata = {
  title: 'Should I go to the ER? — Alberta care navigator',
  description:
    'Answer a few plain-language questions to find the right level of care in Alberta: 911, emergency department, urgent care, a pharmacist, or free nurse advice at 811.',
  alternates: { canonical: '/triage' },
};

export default async function TriagePage() {
  const snapshot = await getWaitTimes();
  const routingUpgradeAvailable = Boolean(
    config.routing.orsApiKey || config.routing.googleRoutesApiKey,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-black leading-tight">Where should I go?</h1>
      <p className="mt-2 text-lg text-muted">
        A few questions to find the right level of care. This takes about a minute and is designed
        to send you to an emergency department whenever there is any doubt.
      </p>

      <div
        className="mt-4 rounded-lg border-2 p-4"
        style={{
          borderColor: 'var(--color-band-red)',
          background: 'var(--color-band-red-soft)',
        }}
      >
        <p className="font-bold" style={{ color: 'var(--color-band-red)' }}>
          If this is a life-threatening emergency, stop and call 911 now.
        </p>
        <p className="mt-1 text-sm">
          Do not use this tool during an emergency. It is not a medical assessment and cannot see or
          examine you.
        </p>
      </div>

      <div className="mt-8">
        <TriageFlow snapshot={snapshot} routingUpgradeAvailable={routingUpgradeAvailable} />
      </div>
    </div>
  );
}
