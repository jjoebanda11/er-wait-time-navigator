'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { WaitTimeSnapshot } from '@/lib/ahs/types';
import {
  TRIAGE_STAGES,
  triage,
  type PatientAgeBand,
  type TriageOutcome,
} from '@/lib/triage/engine';
import { optionsForLevel } from '@/lib/care-options';
import { WaitBoard } from './wait-board';

const AGE_BANDS: { value: PatientAgeBand; label: string; hint: string }[] = [
  { value: 'infant', label: 'Baby under 1', hint: 'Including newborns' },
  { value: 'child', label: 'Child 1–17', hint: '' },
  { value: 'adult', label: 'Adult 18–74', hint: '' },
  { value: 'senior', label: 'Adult 75+', hint: '' },
];

const LEVEL_STYLES: Record<
  TriageOutcome['level'],
  { border: string; bg: string; text: string }
> = {
  'call-911': {
    border: 'var(--color-band-red)',
    bg: 'var(--color-band-red-soft)',
    text: 'var(--color-band-red)',
  },
  emergency: {
    border: 'var(--color-band-orange)',
    bg: 'var(--color-band-orange-soft)',
    text: 'var(--color-band-orange)',
  },
  'urgent-care': {
    border: 'var(--color-band-yellow)',
    bg: 'var(--color-band-yellow-soft)',
    text: 'var(--color-band-yellow)',
  },
  'self-care': {
    border: 'var(--color-band-green)',
    bg: 'var(--color-band-green-soft)',
    text: 'var(--color-band-green)',
  },
};

export function TriageFlow({
  snapshot,
  routingUpgradeAvailable,
}: {
  snapshot: WaitTimeSnapshot;
  routingUpgradeAvailable: boolean;
}) {
  const [ageBand, setAgeBand] = useState<PatientAgeBand>('adult');
  const [pregnant, setPregnant] = useState(false);
  const [unsure, setUnsure] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const outcome = useMemo(
    () => triage({ ageBand, selected, pregnant, unsure }),
    [ageBand, selected, pregnant, unsure],
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const reset = () => {
    setSelected([]);
    setUnsure(false);
    setPregnant(false);
    setSubmitted(false);
  };

  // As soon as a 911-level flag is ticked we show the result immediately,
  // without waiting for the user to work through the rest of the form.
  const immediateEmergency = outcome.level === 'call-911';
  const showResult = submitted || immediateEmergency;

  if (showResult) {
    const style = LEVEL_STYLES[outcome.level];
    const careOptions = optionsForLevel(outcome.careLevel);

    return (
      <div className="space-y-6">
        <div
          className="rounded-xl border-2 p-5"
          style={{ borderColor: style.border, background: style.bg }}
        >
          <h2 className="text-2xl font-black" style={{ color: style.text }}>
            {outcome.title}
          </h2>
          <p className="mt-2 leading-relaxed">{outcome.message}</p>

          {outcome.phone && (
            <a
              href={`tel:${outcome.phone}`}
              className="mt-4 inline-block rounded-lg px-5 py-3 text-lg font-black text-white"
              style={{ background: style.border }}
            >
              Call {outcome.phone} now
            </a>
          )}

          {outcome.reasons.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Why we&rsquo;re saying this
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {outcome.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="rounded-lg border p-4 text-sm text-muted">
          This is a navigation aid, not a medical assessment. It cannot examine you and does not
          know your history. If your instinct says something is seriously wrong, act on it — call
          911, or call Health Link at <a href="tel:811" className="font-bold underline">811</a> to
          speak with a registered nurse for free, any time.
        </div>

        {careOptions.length > 0 && (
          <section>
            <h3 className="text-xl font-bold">Your options</h3>
            <ul className="mt-3 space-y-3">
              {careOptions.map((option) => (
                <li key={option.id} className="rounded-xl surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-bold">{option.name}</h4>
                    <span className="text-sm text-muted">
                      {option.typicalWait} · {option.cost}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{option.summary}</p>
                  <p className="mt-2 text-sm text-muted">{option.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {option.phone && (
                      <a
                        href={`tel:${option.phone.replace(/[^\d+]/g, '')}`}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Call {option.phone}
                      </a>
                    )}
                    {option.url && (
                      <a
                        href={option.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
                      >
                        Learn more
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {outcome.showFacilities && (
          <section>
            <h3 className="text-xl font-bold">
              {outcome.childPatient
                ? 'Closest care for a child, by total time'
                : 'Where you would be seen soonest'}
            </h3>
            <div className="mt-3">
              <WaitBoard
                snapshot={snapshot}
                initialPatientType={outcome.childPatient ? 'child' : 'adult'}
                routingUpgradeAvailable={routingUpgradeAvailable}
              />
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={reset}
          className="rounded-lg border px-4 py-2 font-semibold hover:bg-[var(--bg-subtle)]"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-lg font-bold">Who needs care?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => (
            <button
              key={band.value}
              type="button"
              onClick={() => setAgeBand(band.value)}
              aria-pressed={ageBand === band.value}
              className="rounded-lg border-2 px-4 py-2 text-sm font-semibold"
              style={
                ageBand === band.value
                  ? { borderColor: 'var(--color-brand-600)', background: 'var(--bg-subtle)' }
                  : undefined
              }
            >
              {band.label}
            </button>
          ))}
        </div>
      </fieldset>

      {(ageBand === 'adult' || ageBand === 'senior') && (
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={pregnant}
            onChange={(e) => setPregnant(e.target.checked)}
            className="h-4 w-4"
          />
          Currently pregnant
        </label>
      )}

      {TRIAGE_STAGES.map((stage) => {
        const flags = stage.flags.filter(
          (flag) => !flag.ageBands || flag.ageBands.includes(ageBand),
        );
        if (flags.length === 0) return null;

        const isEmergencyStage = stage.level === 'call-911';

        return (
          <fieldset
            key={stage.id}
            className="rounded-xl border-2 p-4"
            style={
              isEmergencyStage
                ? {
                    borderColor: 'var(--color-band-red)',
                    background: 'var(--color-band-red-soft)',
                  }
                : { borderColor: 'var(--border)' }
            }
          >
            <legend className="px-1 text-lg font-bold">{stage.title}</legend>
            <p className="text-sm text-muted">{stage.instruction}</p>

            <div className="mt-3 space-y-2">
              {flags.map((flag) => (
                <label
                  key={flag.id}
                  className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(flag.id)}
                    onChange={() => toggle(flag.id)}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  <span>
                    <span className="font-medium">{flag.label}</span>
                    {flag.hint && (
                      <span className="block text-sm text-muted">{flag.hint}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
        <input
          type="checkbox"
          checked={unsure}
          onChange={(e) => setUnsure(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          <span className="font-bold">I&rsquo;m not sure how serious this is</span>
          <span className="block text-sm text-muted">
            Selecting this always moves you to a higher level of care. There is no penalty for
            being cautious.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={() => setSubmitted(true)}
        className="w-full rounded-lg bg-brand-600 px-5 py-3.5 text-lg font-bold text-white hover:bg-brand-700"
      >
        Show me where to go
      </button>

      <p className="text-center text-sm text-muted">
        Or skip this and{' '}
        <Link href="/" className="underline">
          go straight to live wait times
        </Link>
        .
      </p>
    </div>
  );
}
