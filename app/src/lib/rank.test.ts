import { describe, expect, it } from 'vitest';
import fixture from './ahs/__fixtures__/ahs-sample.json';
import { normalizePayload } from './ahs/parse';
import type { AhsRawPayload, NormalizedFacility } from './ahs/types';
import { estimateProvider } from './geo/drive-time';
import { formatDuration, rankFacilities, waitBand } from './rank';

const facilities = normalizePayload(fixture as unknown as AhsRawPayload);

/** Downtown Edmonton, near Churchill Square. */
const DOWNTOWN_EDMONTON = { lat: 53.5444, lng: -113.4909 };

describe('waitBand', () => {
  it('maps minutes onto the documented colour bands', () => {
    expect(waitBand(60)).toBe('green');
    expect(waitBand(119)).toBe('green');
    expect(waitBand(120)).toBe('yellow');
    expect(waitBand(239)).toBe('yellow');
    expect(waitBand(240)).toBe('orange');
    expect(waitBand(479)).toBe('orange');
    expect(waitBand(480)).toBe('red');
    expect(waitBand(null)).toBe('unknown');
  });
});

describe('formatDuration', () => {
  it('formats the way a stressed reader parses fastest', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(218)).toBe('3 hr 38 min');
    expect(formatDuration(null)).toBe('Unavailable');
  });
});

describe('rankFacilities', () => {
  it('ranks Edmonton by total door-to-doctor time, not raw wait', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
    });

    // 12 Edmonton facilities, less the Stollery which is children-only and so
    // excluded from an adult ranking (the default patient type).
    expect(ranked.length).toBe(11);

    const known = ranked.filter((r) => r.doorToDoctorMinutes != null);
    for (let i = 1; i < known.length; i += 1) {
      expect(known[i].doorToDoctorMinutes!).toBeGreaterThanOrEqual(
        known[i - 1].doorToDoctorMinutes!,
      );
    }
  });

  it('adds drive and parking on top of the posted wait', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
    });

    for (const entry of ranked) {
      if (entry.doorToDoctorMinutes == null) continue;
      expect(entry.doorToDoctorMinutes).toBeCloseTo(
        entry.driveMinutes + entry.parkingMinutes + entry.facility.waitMinutes!,
        5,
      );
      // Total must always exceed the raw wait, or we would be telling users a
      // hospital is faster to reach than to sit in.
      expect(entry.doorToDoctorMinutes).toBeGreaterThan(entry.facility.waitMinutes!);
    }
  });

  it('flags exactly one best option', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
    });
    expect(ranked.filter((r) => r.isBest)).toHaveLength(1);
    expect(ranked[0].isBest).toBe(true);
  });

  it('never ranks an unknown wait above a known one', async () => {
    const withUnknown: NormalizedFacility[] = [
      ...facilities.filter((f) => f.region === 'Edmonton'),
      {
        ...facilities.find((f) => f.region === 'Edmonton')!,
        slug: 'mystery-hospital',
        name: 'Mystery Hospital',
        waitMinutes: null,
        waitUnavailable: true,
        // Placed directly on the origin, so it wins on every distance measure.
        coords: DOWNTOWN_EDMONTON,
      },
    ];

    const ranked = await rankFacilities(withUnknown, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
    });

    const mysteryIndex = ranked.findIndex((r) => r.facility.slug === 'mystery-hospital');
    const lastKnownIndex = ranked.reduce(
      (acc, r, i) => (r.doorToDoctorMinutes != null ? i : acc),
      -1,
    );
    expect(mysteryIndex).toBeGreaterThan(lastKnownIndex);
    expect(ranked[mysteryIndex].doorToDoctorMinutes).toBeNull();
    expect(ranked[mysteryIndex].isBest).toBe(false);
  });

  it('prefers a pediatric ER for a child when times are comparable', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
      patientType: 'child',
    });
    // Stollery is the pediatric site in Edmonton and posts a short wait in the
    // captured payload, so it should surface at the top for a child.
    expect(ranked[0].facility.name).toBe("Stollery Children's Hospital");
    expect(ranked[0].pediatricPreferred).toBe(true);
  });

  it('never sends an adult to a children-only hospital', async () => {
    // Stollery is 17-and-under. An adult routed there would be turned away, so
    // it must not appear in an adult ranking at all — even though it may post
    // the shortest raw wait.
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
      patientType: 'adult',
    });
    expect(ranked.some((r) => r.facility.name === "Stollery Children's Hospital")).toBe(false);
  });

  it('still offers the children-only hospital to a child', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
      patientType: 'child',
    });
    expect(ranked.some((r) => r.facility.name === "Stollery Children's Hospital")).toBe(true);
  });

  it('excludes adult-only departments when the patient is a child', async () => {
    const adultOnly: NormalizedFacility = {
      ...facilities.find((f) => f.region === 'Edmonton')!,
      slug: 'adults-only-ed',
      name: 'Adults Only ED',
      note: 'Open 24 hours\nFor patients 15 and older',
      waitMinutes: 5,
      waitUnavailable: false,
      coords: DOWNTOWN_EDMONTON,
    };

    const ranked = await rankFacilities([...facilities, adultOnly], estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
      patientType: 'child',
    });

    expect(ranked.some((r) => r.facility.slug === 'adults-only-ed')).toBe(false);
  });

  it('includes that same department for an adult', async () => {
    const adultOnly: NormalizedFacility = {
      ...facilities.find((f) => f.region === 'Edmonton')!,
      slug: 'adults-only-ed',
      name: 'Adults Only ED',
      note: 'Open 24 hours\nFor patients 15 and older',
      waitMinutes: 5,
      waitUnavailable: false,
      coords: DOWNTOWN_EDMONTON,
    };

    const ranked = await rankFacilities([...facilities, adultOnly], estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
      patientType: 'adult',
    });

    expect(ranked[0].facility.slug).toBe('adults-only-ed');
  });

  it('filters urgent care out when asked', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: { lat: 51.0447, lng: -114.0719 },
      region: 'Calgary',
      includeUrgentCare: false,
    });
    expect(ranked.every((r) => r.facility.kind !== 'urgent-care')).toBe(true);
  });

  it('reports time saved against a realistic baseline, never negative', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Edmonton',
    });
    for (const entry of ranked) {
      if (entry.minutesSavedVsWorst != null) {
        expect(entry.minutesSavedVsWorst).toBeGreaterThan(0);
      }
    }
    // The best option should demonstrate a real saving on this payload, which
    // is the entire premise of the product.
    expect(ranked[0].minutesSavedVsWorst).toBeGreaterThan(0);
  });

  it('falls back rather than returning nothing when a radius excludes everything', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: { lat: 58.5, lng: -117.0 },
      maxDistanceKm: 1,
    });
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('returns an empty list for a region with no facilities', async () => {
    const ranked = await rankFacilities(facilities, estimateProvider, {
      origin: DOWNTOWN_EDMONTON,
      region: 'Nunavut',
    });
    expect(ranked).toEqual([]);
  });
});
