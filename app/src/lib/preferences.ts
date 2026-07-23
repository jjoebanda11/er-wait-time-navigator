'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PatientType } from './rank';

/**
 * Local, device-only preferences.
 *
 * Everything a user tells this app is kept in their own browser. We store no
 * accounts, no symptoms, and no location on any server for the core product.
 * That is a deliberate privacy posture, and it is also why the free tier needs
 * no sign-up: there is nothing to sign up to.
 */
export interface Preferences {
  region: string;
  patientType: PatientType;
  includeUrgentCare: boolean;
  /** Facility slugs the user has starred. */
  saved: string[];
  /** Last known coordinates, so a returning user sees a ranked board instantly. */
  lastOrigin: { lat: number; lng: number; at: number } | null;
}

const STORAGE_KEY = 'erwtn.prefs.v1';

export const DEFAULT_PREFERENCES: Preferences = {
  region: 'Edmonton',
  patientType: 'adult',
  includeUrgentCare: true,
  saved: [],
  lastOrigin: null,
};

/** A cached position older than this is not trustworthy for ranking. */
const ORIGIN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function read(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const origin = parsed.lastOrigin;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      lastOrigin:
        origin && typeof origin.lat === 'number' && Date.now() - origin.at < ORIGIN_MAX_AGE_MS
          ? origin
          : null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function write(prefs: Preferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing and full quotas both throw here. Losing preferences is
    // an acceptable degradation; crashing the board is not.
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  // Read after mount so server and client render identically and hydration
  // does not mismatch.
  useEffect(() => {
    setPrefs(read());
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      write(next);
      return next;
    });
  }, []);

  const toggleSaved = useCallback((slug: string) => {
    setPrefs((current) => {
      const saved = current.saved.includes(slug)
        ? current.saved.filter((s) => s !== slug)
        : [...current.saved, slug];
      const next = { ...current, saved };
      write(next);
      return next;
    });
  }, []);

  return { prefs, loaded, update, toggleSaved };
}
