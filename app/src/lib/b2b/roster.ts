'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GeoPoint } from '../ahs/types';
import type { PatientType } from '../rank';

/**
 * The care-provider roster: a set of locations an agency serves.
 *
 * Stored in the coordinator's own browser and never transmitted to us. That is
 * not a shortcut — it is the design.
 *
 * If an agency's client list lived in our database, we would be holding
 * information about identifiable people and their care needs, which would make
 * us a custodian of health information under Alberta's Health Information Act.
 * That would impose obligations this business is not equipped to meet, and it
 * would destroy the privacy position that makes the consumer product
 * defensible. Keeping the roster on-device means a breach of our systems
 * exposes nothing about anyone's clients, because we never had it.
 *
 * The trade-off is real: rosters do not sync between staff or devices. That is
 * the correct thing to charge for later, once the business is incorporated and
 * insured and the legal work of holding that data can actually be done
 * properly. Until then, not holding it is both safer and faster.
 *
 * Note the vocabulary throughout: these are *locations*, not patients. The tool
 * answers "from this address, where is care fastest right now" — a question
 * that never requires knowing who lives there.
 */

export interface RosterEntry {
  id: string;
  /** The agency's own reference. The UI steers them away from real names. */
  label: string;
  address: string;
  coords: GeoPoint;
  /** Which AHS region's facilities to consider for this location. */
  region: string;
  patientType: PatientType;
  /** Free-text operational note, e.g. "wheelchair van required". */
  note?: string;
  addedAt: number;
}

const STORAGE_KEY = 'erwtn.roster.v1';

/** Generous, but a cap keeps localStorage well inside browser quotas. */
export const MAX_ROSTER_ENTRIES = 200;

function read(): RosterEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (e): e is RosterEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RosterEntry).id === 'string' &&
        typeof (e as RosterEntry).label === 'string' &&
        typeof (e as RosterEntry).coords?.lat === 'number' &&
        typeof (e as RosterEntry).coords?.lng === 'number',
    );
  } catch {
    return [];
  }
}

function write(entries: RosterEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing and quota exhaustion both land here. Losing the roster
    // is a bad day; crashing the board during one is worse.
  }
}

export function useRoster() {
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Read after mount so server and client render identically.
  useEffect(() => {
    setEntries(read());
    setLoaded(true);
  }, []);

  const add = useCallback((entry: Omit<RosterEntry, 'id' | 'addedAt'>) => {
    setEntries((current) => {
      if (current.length >= MAX_ROSTER_ENTRIES) return current;
      const next = [
        ...current,
        {
          ...entry,
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          addedAt: Date.now(),
        },
      ];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((current) => {
      const next = current.filter((e) => e.id !== id);
      write(next);
      return next;
    });
  }, []);

  const update = useCallback((id: string, patch: Partial<RosterEntry>) => {
    setEntries((current) => {
      const next = current.map((e) => (e.id === id ? { ...e, ...patch } : e));
      write(next);
      return next;
    });
  }, []);

  const replaceAll = useCallback((next: RosterEntry[]) => {
    const capped = next.slice(0, MAX_ROSTER_ENTRIES);
    setEntries(capped);
    write(capped);
  }, []);

  return { entries, loaded, add, remove, update, replaceAll };
}

/**
 * Serialize the roster for backup or transfer to another machine.
 *
 * Because we hold nothing server-side, this file is the only copy. Making
 * export obvious is a correctness requirement, not a nicety.
 */
export function exportRoster(entries: RosterEntry[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
}

export function parseRosterFile(contents: string): RosterEntry[] | null {
  try {
    const parsed = JSON.parse(contents) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return null;
    return parsed.entries.filter(
      (e): e is RosterEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RosterEntry).label === 'string' &&
        typeof (e as RosterEntry).coords?.lat === 'number',
    );
  } catch {
    return null;
  }
}

/**
 * Flag labels that look like they contain a person's name.
 *
 * Advisory only — we never block input, because the data stays on their device
 * and an agency may have its own lawful basis. But surfacing the risk at the
 * moment of entry is far more effective than burying it in a policy page.
 */
export function looksLikePersonalName(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 3) return false;

  // Two or more capitalised words with no digits reads like "Margaret Kowalski".
  const words = trimmed.split(/\s+/);
  const capitalisedWords = words.filter((w) => /^[A-Z][a-z]{2,}$/.test(w));
  return capitalisedWords.length >= 2 && !/\d/.test(trimmed);
}
