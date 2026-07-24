import { describe, expect, it } from 'vitest';
import fixture from '../ahs/__fixtures__/ahs-sample.json';
import { normalizePayload } from '../ahs/parse';
import type { AhsRawPayload } from '../ahs/types';
import { rankFacilitiesSync } from '../rank';
import { exportRoster, looksLikePersonalName, parseRosterFile, type RosterEntry } from './roster';

const facilities = normalizePayload(fixture as unknown as AhsRawPayload);

const entry: RosterEntry = {
  id: 'a',
  label: 'Client 14 — Millwoods',
  address: '10320 82 Ave NW Edmonton',
  coords: { lat: 53.4668, lng: -113.4408 },
  region: 'Edmonton',
  patientType: 'adult',
  addedAt: Date.now(),
};

describe('looksLikePersonalName', () => {
  it('flags labels that read like a person', () => {
    expect(looksLikePersonalName('Margaret Kowalski')).toBe(true);
    expect(looksLikePersonalName('John Smith')).toBe(true);
  });

  it('accepts non-identifying references', () => {
    expect(looksLikePersonalName('Client 14 — Millwoods')).toBe(false);
    expect(looksLikePersonalName('Unit 3B')).toBe(false);
    expect(looksLikePersonalName('Site 7')).toBe(false);
    expect(looksLikePersonalName('NW route 2')).toBe(false);
  });

  it('does not flag trivially short labels', () => {
    expect(looksLikePersonalName('A')).toBe(false);
    expect(looksLikePersonalName('')).toBe(false);
  });
});

describe('roster export and import', () => {
  it('round-trips a roster', () => {
    const json = exportRoster([entry]);
    const parsed = parseRosterFile(json);
    expect(parsed).toHaveLength(1);
    expect(parsed![0].label).toBe('Client 14 — Millwoods');
    expect(parsed![0].coords).toEqual({ lat: 53.4668, lng: -113.4408 });
  });

  it('rejects malformed files rather than importing garbage', () => {
    expect(parseRosterFile('not json')).toBeNull();
    expect(parseRosterFile('{"nope": 1}')).toBeNull();
  });

  it('drops entries missing coordinates', () => {
    const parsed = parseRosterFile(
      JSON.stringify({ entries: [{ label: 'broken' }, entry] }),
    );
    expect(parsed).toHaveLength(1);
  });
});

describe('rankFacilitiesSync', () => {
  it('agrees with the async path on the best facility', async () => {
    const { rankFacilities } = await import('../rank');
    const { estimateProvider } = await import('../geo/drive-time');

    const options = {
      origin: entry.coords,
      region: 'Edmonton',
      patientType: 'adult' as const,
    };

    const sync = rankFacilitiesSync(facilities, options);
    const async_ = await rankFacilities(facilities, estimateProvider, options);

    // The dashboard and the consumer board must never disagree about which
    // hospital is fastest from the same address.
    expect(sync.map((r) => r.facility.slug)).toEqual(async_.map((r) => r.facility.slug));
    expect(sync[0].doorToDoctorMinutes).toBeCloseTo(async_[0].doorToDoctorMinutes!, 5);
  });

  it('produces a usable ranking for a roster location', () => {
    const ranked = rankFacilitiesSync(facilities, {
      origin: entry.coords,
      region: entry.region,
      patientType: entry.patientType,
    });

    expect(ranked.length).toBeGreaterThan(0);
    const best = ranked.find((r) => r.doorToDoctorMinutes != null);
    expect(best).toBeDefined();
    expect(best!.doorToDoctorMinutes!).toBeGreaterThan(best!.facility.waitMinutes!);
  });

  it('never ranks an unpublished wait as fastest', () => {
    const withUnknown = [
      ...facilities,
      {
        ...facilities.find((f) => f.region === 'Edmonton')!,
        slug: 'mystery',
        name: 'Mystery Site',
        waitMinutes: null,
        waitUnavailable: true,
        coords: entry.coords,
      },
    ];
    const ranked = rankFacilitiesSync(withUnknown, {
      origin: entry.coords,
      region: 'Edmonton',
    });
    expect(ranked[0].facility.slug).not.toBe('mystery');
  });

  it('is deterministic, so repeated renders cannot reorder the board', () => {
    const opts = { origin: entry.coords, region: 'Edmonton' };
    const a = rankFacilitiesSync(facilities, opts).map((r) => r.facility.slug);
    const b = rankFacilitiesSync(facilities, opts).map((r) => r.facility.slug);
    expect(a).toEqual(b);
  });
});
