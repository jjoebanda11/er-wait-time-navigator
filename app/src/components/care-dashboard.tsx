'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { REGION_LABELS } from '@/lib/ahs/parse';
import type { AhsRegionKey, GeoPoint, WaitTimeSnapshot } from '@/lib/ahs/types';
import {
  MAX_ROSTER_ENTRIES,
  exportRoster,
  looksLikePersonalName,
  parseRosterFile,
  useRoster,
  type RosterEntry,
} from '@/lib/b2b/roster';
import { formatDuration, rankFacilitiesSync, waitBand, type PatientType } from '@/lib/rank';

const BAND_COLORS: Record<string, string> = {
  green: 'var(--color-band-green)',
  yellow: 'var(--color-band-yellow)',
  orange: 'var(--color-band-orange)',
  red: 'var(--color-band-red)',
  unknown: 'var(--color-band-unknown)',
};

interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

/** Accept a pasted "53.54, -113.49" so the tool still works if geocoding is down. */
function parseCoordinatePair(input: string): GeoPoint | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number.parseFloat(m[1]);
  const lng = Number.parseFloat(m[2]);
  if (lat < 48 || lat > 61 || lng < -121 || lng > -109) return null;
  return { lat, lng };
}

export function CareDashboard({ snapshot }: { snapshot: WaitTimeSnapshot }) {
  const { entries, loaded, add, remove, replaceAll } = useRoster();
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Every roster location ranked against the current board.
   *
   * Computed during render, synchronously. Ranking in an effect would mean a
   * setState per render pass — the exact shape of the loop that previously
   * locked the consumer board's main thread. Pure computation cannot loop.
   */
  const rows = useMemo(() => {
    return entries.map((entry) => {
      const ranked = rankFacilitiesSync(snapshot.facilities, {
        origin: entry.coords,
        region: entry.region,
        patientType: entry.patientType,
        includeUrgentCare: true,
      });
      const best = ranked.find((r) => r.doorToDoctorMinutes != null) ?? null;
      return { entry, ranked, best };
    });
  }, [entries, snapshot.facilities]);

  /** Worst-first: the coordinator's real question is "who is stuck right now". */
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const av = a.best?.doorToDoctorMinutes ?? -1;
        const bv = b.best?.doorToDoctorMinutes ?? -1;
        return bv - av;
      }),
    [rows],
  );

  const summary = useMemo(() => {
    const known = rows.map((r) => r.best?.doorToDoctorMinutes).filter((v): v is number => v != null);
    if (known.length === 0) return null;
    return {
      count: known.length,
      worst: Math.max(...known),
      best: Math.min(...known),
      median: [...known].sort((a, b) => a - b)[Math.floor(known.length / 2)],
      overFour: known.filter((v) => v >= 240).length,
    };
  }, [rows]);

  const handleExport = useCallback(() => {
    const blob = new Blob([exportRoster(entries)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `er-navigator-locations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseRosterFile(String(reader.result));
        if (parsed) replaceAll(parsed);
      };
      reader.readAsText(file);
    },
    [replaceAll],
  );

  const exportCsv = useCallback(() => {
    const header = 'Location,Address,Best option,Total time (min),Posted wait (min),Drive (min)\n';
    const lines = sortedRows.map(({ entry, best }) => {
      const cells = [
        entry.label,
        entry.address,
        best?.facility.name ?? 'unavailable',
        best?.doorToDoctorMinutes != null ? Math.round(best.doorToDoctorMinutes) : '',
        best?.facility.waitMinutes ?? '',
        best?.driveMinutes != null ? Math.round(best.driveMinutes) : '',
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `er-navigator-snapshot-${new Date().toISOString().slice(0, 16).replace(':', '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedRows]);

  if (!loaded) {
    return <p className="text-muted">Loading your locations…</p>;
  }

  return (
    <div className="space-y-6">
      <AddLocationForm
        onAdd={add}
        disabled={entries.length >= MAX_ROSTER_ENTRIES}
        regions={[...new Set(snapshot.facilities.map((f) => f.region))]}
      />

      {entries.length === 0 ? (
        <div className="rounded-xl surface p-6 text-center">
          <h2 className="text-lg font-bold">No locations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add the addresses you serve. Each one gets a live answer to &ldquo;where would this
            person be seen soonest right now&rdquo; — the posted wait plus the drive plus parking.
          </p>
        </div>
      ) : (
        <>
          {summary && (
            <section className="grid gap-3 sm:grid-cols-4">
              <Stat label="Locations tracked" value={String(summary.count)} />
              <Stat
                label="Longest right now"
                value={formatDuration(summary.worst)}
                color={BAND_COLORS[waitBand(summary.worst)]}
              />
              <Stat label="Median" value={formatDuration(summary.median)} />
              <Stat
                label="Over 4 hours"
                value={`${summary.overFour} of ${summary.count}`}
                color={summary.overFour > 0 ? 'var(--color-band-orange)' : undefined}
              />
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold">
              Your locations{' '}
              <span className="font-normal text-muted">— longest wait first</span>
            </h2>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
            >
              Back up
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
            >
              Restore
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
          </div>

          <ul className="space-y-3">
            {sortedRows.map(({ entry, ranked, best }) => {
              const color = BAND_COLORS[waitBand(best?.doorToDoctorMinutes ?? null)];
              const isOpen = expanded === entry.id;

              return (
                <li key={entry.id} className="overflow-hidden rounded-xl surface">
                  <div aria-hidden className="h-1.5 w-full" style={{ background: color }} />
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{entry.label}</h3>
                      <p className="mt-0.5 text-xs text-muted">{entry.address}</p>
                      {entry.note && (
                        <p className="mt-1 text-sm text-muted">{entry.note}</p>
                      )}

                      {best ? (
                        <p className="mt-2 text-sm">
                          Fastest: <strong>{best.facility.name}</strong>{' '}
                          <span className="text-muted">
                            ({formatDuration(best.facility.waitMinutes)} wait +{' '}
                            {formatDuration(best.driveMinutes)} drive +{' '}
                            {formatDuration(best.parkingMinutes)} parking)
                          </span>
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted">
                          No facility in {REGION_LABELS[entry.region as AhsRegionKey] ?? entry.region}{' '}
                          is publishing a wait time right now.
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        Time to be seen
                      </p>
                      <p
                        className="text-2xl font-black leading-none tabular-nums"
                        style={{ color }}
                      >
                        {formatDuration(best?.doorToDoctorMinutes ?? null)}
                      </p>
                      {entry.patientType === 'child' && (
                        <p className="mt-1 text-[11px] font-semibold text-muted">child</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide options' : 'All options'}
                    </button>
                    {best && (
                      <a
                        href={best.facility.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Directions
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      className="ml-auto rounded-lg px-2 py-1.5 text-sm text-muted hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  {isOpen && (
                    <ol className="space-y-1 border-t bg-[var(--bg-subtle)] px-4 py-3 text-sm">
                      {ranked.slice(0, 6).map((r, i) => (
                        <li
                          key={r.facility.slug}
                          className="flex flex-wrap items-baseline justify-between gap-2"
                        >
                          <span>
                            <span className="mr-1.5 font-bold text-muted tabular-nums">
                              {i + 1}.
                            </span>
                            {r.facility.name}
                            <span className="ml-1.5 text-xs text-muted">
                              {r.distanceKm.toFixed(1)} km
                            </span>
                          </span>
                          <span
                            className="font-bold tabular-nums"
                            style={{ color: BAND_COLORS[waitBand(r.doorToDoctorMinutes)] }}
                          >
                            {formatDuration(r.doorToDoctorMinutes)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="rounded-lg border p-3 text-xs text-muted">
        Your locations are stored in this browser only and are never sent to us. Back them up if
        you clear site data or move to another computer. This tool supports operational planning —
        it is not medical advice, and it does not replace clinical judgement. For an emergency,
        call 911; for nurse advice, call <a href="tel:811" className="font-semibold underline">811</a>.{' '}
        <Link href="/for-care-providers" className="underline">
          About this tool
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-xl font-black tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function AddLocationForm({
  onAdd,
  disabled,
  regions,
}: {
  onAdd: (entry: Omit<RosterEntry, 'id' | 'addedAt'>) => void;
  disabled: boolean;
  regions: string[];
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState(regions[0] ?? 'Edmonton');
  const [patientType, setPatientType] = useState<PatientType>('adult');
  const [note, setNote] = useState('');
  const [hits, setHits] = useState<GeocodeHit[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameWarning = looksLikePersonalName(label);

  const lookup = useCallback(async () => {
    const pasted = parseCoordinatePair(address);
    if (pasted) {
      setHits([{ label: `${pasted.lat}, ${pasted.lng}`, ...pasted }]);
      setStatus(null);
      return;
    }

    setBusy(true);
    setStatus(null);
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
      setStatus('Address lookup failed. You can paste coordinates as "lat, lng" instead.');
    } finally {
      setBusy(false);
    }
  }, [address]);

  const choose = (hit: GeocodeHit) => {
    onAdd({
      label: label.trim() || hit.label.split(',')[0],
      address: hit.label,
      coords: { lat: hit.lat, lng: hit.lng },
      region,
      patientType,
      note: note.trim() || undefined,
    });
    setLabel('');
    setAddress('');
    setNote('');
    setHits(null);
    setStatus(null);
  };

  return (
    <section className="rounded-xl surface p-4">
      <h2 className="font-bold">Add a location</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Your reference</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Client 14 — Millwoods"
            className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium">Address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void lookup();
              }
            }}
            placeholder="10320 82 Ave NW, Edmonton"
            className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2"
          />
        </label>

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
          <span className="font-medium">Patient type</span>
          <select
            value={patientType}
            onChange={(e) => setPatientType(e.target.value as PatientType)}
            className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 font-medium"
          >
            <option value="adult">Adult</option>
            <option value="child">Child</option>
          </select>
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium">
            Operational note <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Wheelchair van required"
            className="mt-1 w-full rounded-lg border bg-[var(--surface)] px-3 py-2"
          />
        </label>
      </div>

      {nameWarning && (
        <p
          className="mt-3 rounded-lg border-2 p-3 text-sm"
          style={{
            borderColor: 'var(--color-band-yellow)',
            background: 'var(--color-band-yellow-soft)',
          }}
        >
          That looks like a person&rsquo;s name. Consider a reference like &ldquo;Client 14 —
          Millwoods&rdquo; instead. This stays on your device either way, but a non-identifying
          label keeps you clear of privacy obligations if this screen is ever shared or shoulder-read.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void lookup()}
          disabled={busy || address.trim().length < 4 || disabled}
          className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Looking up…' : 'Find address'}
        </button>
        {disabled && (
          <span className="text-sm text-muted">
            Roster is full ({MAX_ROSTER_ENTRIES} locations).
          </span>
        )}
      </div>

      {status && <p className="mt-2 text-sm text-muted">{status}</p>}

      {hits && hits.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Select the correct match:</p>
          <ul className="mt-2 space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.lat},${hit.lng}`}>
                <button
                  type="button"
                  onClick={() => choose(hit)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-brand-600 hover:bg-[var(--bg-subtle)]"
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Address data © OpenStreetMap contributors</p>
        </div>
      )}
    </section>
  );
}
