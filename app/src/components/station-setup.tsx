'use client';

import { useCallback, useState } from 'react';
import { REGION_LABELS } from '@/lib/ahs/parse';
import type { AhsRegionKey } from '@/lib/ahs/types';
import { encodeStationConfig } from '@/lib/b2b/station-config';
import type { PatientType } from '@/lib/rank';

interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

/**
 * One-time setup for a nurse-station wall display.
 *
 * A care home configures this once — their building address, area, adult or
 * child — and gets a link to bookmark on a mounted tablet. There is no account
 * and nothing is saved on our side; the configuration lives entirely in the
 * generated URL. That is what lets a facility run the display indefinitely with
 * zero dependency on us and zero data held about them.
 */
export function StationSetup({ regions }: { regions: string[] }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState(regions.includes('Edmonton') ? 'Edmonton' : regions[0]);
  const [patientType, setPatientType] = useState<PatientType>('adult');
  const [hits, setHits] = useState<GeocodeHit[] | null>(null);
  const [chosen, setChosen] = useState<GeocodeHit | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const data = (await res.json()) as { results?: GeocodeHit[]; error?: string };
      if (!res.ok || !data.results?.length) {
        setStatus(data.error ?? 'No matching Alberta address found.');
        setHits([]);
      } else {
        setHits(data.results);
      }
    } catch {
      setStatus('Address lookup failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [address]);

  const link =
    chosen && name.trim() && region
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/station?${encodeStationConfig(
          {
            label: name.trim(),
            lat: chosen.lat,
            lng: chosen.lng,
            region,
            patientType,
          },
        ).toString()}`
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl surface p-4">
        <label className="block text-sm">
          <span className="font-medium">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Riverbend Supportive Living — 2nd floor station"
            className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">
            Shown at the top of the screen. A room or station name is fine — no resident names.
          </span>
        </label>

        <label className="mt-4 block text-sm">
          <span className="font-medium">Building address</span>
          <div className="mt-1 flex gap-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void lookup();
                }
              }}
              placeholder="Street address of the facility"
              className="w-full rounded-lg border bg-[var(--surface)] px-3 py-2"
            />
            <button
              type="button"
              onClick={() => void lookup()}
              disabled={busy || address.trim().length < 4}
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? '…' : 'Find'}
            </button>
          </div>
        </label>

        {status && <p className="mt-2 text-sm text-muted">{status}</p>}

        {hits && hits.length > 0 && !chosen && (
          <ul className="mt-3 space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.lat},${hit.lng}`}>
                <button
                  type="button"
                  onClick={() => setChosen(hit)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-brand-600 hover:bg-[var(--bg-subtle)]"
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {chosen && (
          <p className="mt-3 rounded-lg bg-[var(--bg-subtle)] p-2 text-sm">
            <strong>Location set:</strong> {chosen.label}{' '}
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="ml-1 underline"
            >
              change
            </button>
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Area</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 font-medium"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABELS[r as AhsRegionKey] ?? r}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="font-medium">Residents</span>
            <select
              value={patientType}
              onChange={(e) => setPatientType(e.target.value as PatientType)}
              className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 font-medium"
            >
              <option value="adult">Adults</option>
              <option value="child">Children</option>
            </select>
          </label>
        </div>
      </div>

      {link && (
        <div
          className="rounded-xl border-2 p-4"
          style={{ borderColor: 'var(--color-band-green)', background: 'var(--color-band-green-soft)' }}
        >
          <h2 className="font-bold">Your display is ready</h2>
          <p className="mt-1 text-sm">
            Open this link on the screen you want to mount, then bookmark it or set it as the
            tablet&rsquo;s home page. It refreshes itself and needs no sign-in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
            >
              Open display
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
              }}
              className="rounded-lg border px-4 py-2 font-semibold hover:bg-[var(--bg-subtle)]"
            >
              Copy link
            </button>
          </div>
          <p className="mt-3 break-all rounded-lg bg-[var(--surface)] p-2 font-mono text-xs">
            {link}
          </p>
        </div>
      )}
    </div>
  );
}
