import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/ahs-sample.json';
import {
  cleanText,
  normalizeFacility,
  normalizePayload,
  parseCoords,
  parseMunicipality,
  parseWaitMinutes,
  regionFromSlug,
  slugify,
  splitField,
} from './parse';
import type { AhsRawFacility, AhsRawPayload } from './types';

describe('parseWaitMinutes', () => {
  it('parses the standard AHS format', () => {
    expect(parseWaitMinutes('3 hr 38 min')).toBe(218);
    expect(parseWaitMinutes('0 hr 54 min')).toBe(54);
    expect(parseWaitMinutes('4 hr 0 min')).toBe(240);
    expect(parseWaitMinutes('7 hr 38 min')).toBe(458);
  });

  it('tolerates shortened formats', () => {
    expect(parseWaitMinutes('45 min')).toBe(45);
    expect(parseWaitMinutes('2 hr')).toBe(120);
  });

  it('returns null rather than zero for unavailable waits', () => {
    // This is the single most important assertion in the file. Coercing an
    // unknown wait to 0 would rank a site with no data as the fastest option.
    expect(parseWaitMinutes('Wait times unavailable')).toBeNull();
    expect(parseWaitMinutes('')).toBeNull();
    expect(parseWaitMinutes(null)).toBeNull();
    expect(parseWaitMinutes('closed')).toBeNull();
  });
});

describe('parseCoords', () => {
  it('extracts coordinates from the AHS maps link', () => {
    expect(
      parseCoords('https://www.google.com/maps/search/?api=1&query=53.520765,-113.521010'),
    ).toEqual({ lat: 53.520765, lng: -113.52101 });
  });

  it('rejects coordinates outside Alberta', () => {
    expect(parseCoords('https://maps.google.com/?query=0,0')).toBeNull();
    expect(parseCoords('https://maps.google.com/?query=51.5,-0.12')).toBeNull();
  });

  it('returns null when no coordinates are present', () => {
    expect(parseCoords('https://example.com/no-coords')).toBeNull();
    expect(parseCoords('')).toBeNull();
  });
});

describe('cleanText', () => {
  it('decodes entities and converts line breaks', () => {
    expect(cleanText('Open 24 hours for patients 17 &amp; under')).toBe(
      'Open 24 hours for patients 17 & under',
    );
    expect(cleanText('Open 24 hours<br />This location is in Sherwood Park')).toBe(
      'Open 24 hours\nThis location is in Sherwood Park',
    );
  });

  it('strips stray tags without leaving empty lines', () => {
    expect(cleanText('<p>Open</p><br /><br />')).toBe('Open');
  });
});

describe('parseMunicipality', () => {
  it('finds the town in a full AHS address', () => {
    expect(parseMunicipality('9000 Emerald Drive Sherwood Park Alberta T8H 0J3')).toBe(
      'Sherwood Park',
    );
    expect(parseMunicipality('8440 112 Street Edmonton Alberta T6G 2B7')).toBe('Edmonton');
    expect(parseMunicipality('4210 48 Street Leduc Alberta T9E 5Z3')).toBe('Leduc');
  });

  it('keeps "St." attached to a place name instead of reading it as Street', () => {
    // "Road" ends the street, so "St." here means Saint and belongs to Albert.
    expect(parseMunicipality('201 Boudreau Road St. Albert Alberta T8N 6C4')).toBe('St. Albert');
  });

  it('still treats a trailing "St" as a street type', () => {
    expect(parseMunicipality('10240 Kingsway St Edmonton Alberta T5H 3V9')).toBe('Edmonton');
  });

  it('handles multi-word place names', () => {
    expect(parseMunicipality('9401 86 Avenue Fort Saskatchewan Alberta T8L 0C6')).toBe(
      'Fort Saskatchewan',
    );
    expect(parseMunicipality('7 Hospital Street Fort McMurray Alberta T9H 1P2')).toBe(
      'Fort McMurray',
    );
  });

  it('strips quadrant suffixes from the place name', () => {
    expect(parseMunicipality('1100 Youville Drive NW Edmonton Alberta T6L 5X8')).toBe('Edmonton');
    expect(parseMunicipality('3500 26 Avenue NE Calgary Alberta T1Y 6J4')).toBe('Calgary');
  });
});

describe('splitField', () => {
  it('splits compound records and passes through simple ones', () => {
    expect(splitField('a[;]b')).toEqual(['a', 'b']);
    expect(splitField('plain')).toEqual(['plain']);
    expect(splitField(null)).toEqual([]);
  });
});

describe('slugify', () => {
  it('produces stable URL-safe slugs', () => {
    expect(slugify("Stollery Children's Hospital")).toBe('stollery-childrens-hospital');
    expect(slugify('University of Alberta Hospital')).toBe('university-of-alberta-hospital');
  });
});

describe('regionFromSlug', () => {
  it('round-trips region slugs', () => {
    expect(regionFromSlug('edmonton')).toBe('Edmonton');
    expect(regionFromSlug('red-deer')).toBe('RedDeer');
    expect(regionFromSlug('fort-mcmurray')).toBe('FortMcMurray');
    expect(regionFromSlug('nowhere')).toBeNull();
  });
});

describe('normalizeFacility', () => {
  const base: AhsRawFacility = {
    Name: 'Test Hospital',
    Category: 'Emergency',
    WaitTime: '2 hr 30 min',
    URL: 'https://example.com/facility',
    Note: 'Open 24 hours',
    TimesUnavailable: 'False',
    Address: '100 Test Street Edmonton Alberta T5A 1A1',
    GoogleMapsLinkDirection: 'https://www.google.com/maps/search/?api=1&query=53.5,-113.5',
    SiteId: 'abc',
    SplitFacility: null,
    SiteClosingSoon: false,
    SiteOpen: false,
  };

  it('normalizes an ordinary record', () => {
    const [facility] = normalizeFacility(base, 'Edmonton');
    expect(facility.name).toBe('Test Hospital');
    expect(facility.waitMinutes).toBe(150);
    expect(facility.waitUnavailable).toBe(false);
    expect(facility.kind).toBe('emergency');
    expect(facility.coords).toEqual({ lat: 53.5, lng: -113.5 });
    expect(facility.municipality).toBe('Edmonton');
  });

  it('explodes a split-facility record into two entries', () => {
    const split: AhsRawFacility = {
      ...base,
      Name: 'South Health Campus Children[;]South Health Campus',
      Category: 'Emergency Departments[;]Emergency',
      WaitTime: '0 hr 54 min[;]4 hr 32 min',
      TimesUnavailable: 'False[;]False',
      SplitFacility: "Children's emergency[;]Adult emergency",
    };

    const results = normalizeFacility(split, 'Calgary');
    expect(results).toHaveLength(2);

    expect(results[0].name).toBe('South Health Campus Children');
    expect(results[0].waitMinutes).toBe(54);
    expect(results[0].department).toBe("Children's emergency");
    expect(results[0].kind).toBe('pediatric-emergency');

    expect(results[1].name).toBe('South Health Campus');
    expect(results[1].waitMinutes).toBe(272);
    expect(results[1].department).toBe('Adult emergency');
    expect(results[1].kind).toBe('emergency');

    // Split halves must not collide on slug, or one would overwrite the other.
    expect(results[0].slug).not.toBe(results[1].slug);
  });

  it('marks a wait unavailable when AHS flags it, and reports no number', () => {
    const [facility] = normalizeFacility(
      { ...base, WaitTime: 'Wait times unavailable', TimesUnavailable: 'True' },
      'Edmonton',
    );
    expect(facility.waitUnavailable).toBe(true);
    expect(facility.waitMinutes).toBeNull();
  });

  it('treats an unparseable wait as unavailable even if AHS says otherwise', () => {
    const [facility] = normalizeFacility(
      { ...base, WaitTime: 'sometime later', TimesUnavailable: 'False' },
      'Edmonton',
    );
    expect(facility.waitUnavailable).toBe(true);
    expect(facility.waitMinutes).toBeNull();
  });

  it('drops records that cannot be placed on a map', () => {
    expect(
      normalizeFacility({ ...base, GoogleMapsLinkDirection: 'https://example.com' }, 'Edmonton'),
    ).toEqual([]);
  });

  it('classifies pediatric sites regardless of category', () => {
    const [facility] = normalizeFacility({ ...base, Name: "Stollery Children's Hospital" }, 'Edmonton');
    expect(facility.kind).toBe('pediatric-emergency');
  });

  it('classifies urgent care from the category field', () => {
    const [facility] = normalizeFacility({ ...base, Category: 'Urgent Care' }, 'Calgary');
    expect(facility.kind).toBe('urgent-care');
  });
});

describe('normalizePayload against the real AHS response', () => {
  const facilities = normalizePayload(fixture as unknown as AhsRawPayload);

  it('parses every facility in the captured live payload', () => {
    // 29 upstream records, one of which is a split that becomes two entries.
    expect(facilities).toHaveLength(30);
  });

  it('covers all seven Alberta regions', () => {
    const regions = new Set(facilities.map((f) => f.region));
    expect(regions).toEqual(
      new Set([
        'Edmonton',
        'Calgary',
        'RedDeer',
        'Lethbridge',
        'MedicineHat',
        'GrandePrairie',
        'FortMcMurray',
      ]),
    );
  });

  it('finds the expected Edmonton facilities', () => {
    const edmonton = facilities.filter((f) => f.region === 'Edmonton');
    expect(edmonton).toHaveLength(12);

    const names = edmonton.map((f) => f.name);
    expect(names).toContain('University of Alberta Hospital');
    expect(names).toContain("Stollery Children's Hospital");
    expect(names).toContain('Royal Alexandra Hospital');
    expect(names).toContain('Misericordia Community Hospital');
  });

  it('gives every facility usable coordinates inside Alberta', () => {
    for (const f of facilities) {
      expect(f.coords.lat).toBeGreaterThan(48);
      expect(f.coords.lat).toBeLessThan(61);
      expect(f.coords.lng).toBeGreaterThan(-121);
      expect(f.coords.lng).toBeLessThan(-109);
    }
  });

  it('produces unique slugs within each region', () => {
    const keys = facilities.map((f) => `${f.region}:${f.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('identifies the pediatric sites', () => {
    const pediatric = facilities.filter((f) => f.kind === 'pediatric-emergency');
    const names = pediatric.map((f) => f.name);
    expect(names).toContain("Stollery Children's Hospital");
    expect(names).toContain("Alberta Children's Hospital");
  });

  it('never reports a negative or absurd wait', () => {
    for (const f of facilities) {
      if (f.waitMinutes != null) {
        expect(f.waitMinutes).toBeGreaterThanOrEqual(0);
        expect(f.waitMinutes).toBeLessThan(24 * 60);
      }
    }
  });

  it('notes which suburban sites are outside the city proper', () => {
    const strathcona = facilities.find((f) => f.name === 'Strathcona Community Hospital');
    expect(strathcona?.municipality).toBe('Sherwood Park');
    expect(strathcona?.region).toBe('Edmonton');

    const sturgeon = facilities.find((f) => f.name === 'Sturgeon Community Hospital');
    expect(sturgeon?.municipality).toBe('St. Albert');

    const fortSask = facilities.find((f) => f.name === 'Fort Sask Community Hospital');
    expect(fortSask?.municipality).toBe('Fort Saskatchewan');
  });

  it('resolves a municipality for every facility in the live payload', () => {
    // A missing municipality means a user cannot tell that a "Edmonton area"
    // hospital is actually a 40-minute drive out of town.
    for (const facility of facilities) {
      expect(facility.municipality, `${facility.name} has no municipality`).toBeTruthy();
    }
  });
});
