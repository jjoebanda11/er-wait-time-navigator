/**
 * Types for the Alberta Health Services public wait-times feed.
 *
 * Upstream endpoint:
 *   https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en
 *
 * This is the same public JSON that powers the AHS "Estimated Emergency
 * Department Wait Times" page. It requires no key and no authentication, and
 * AHS `robots.txt` disallows only `/org/` and `/rls/`.
 *
 * The upstream shape is quirky in ways that matter, so the raw types below
 * describe what AHS actually sends, and `NormalizedFacility` describes what the
 * rest of the app is allowed to see. Everything in between is `parse.ts`.
 */

/** Region keys as they appear in the upstream payload. */
export const AHS_REGION_KEYS = [
  'Edmonton',
  'Calgary',
  'RedDeer',
  'Lethbridge',
  'MedicineHat',
  'GrandePrairie',
  'FortMcMurray',
] as const;

export type AhsRegionKey = (typeof AHS_REGION_KEYS)[number];

/**
 * A single facility record exactly as AHS sends it.
 *
 * Several fields are "split records": one JSON object describing two distinct
 * departments at one physical site, with the two values joined by the literal
 * separator `[;]`. As of writing, South Health Campus in Calgary is the only
 * such record, publishing separate children's and adult emergency waits. The
 * separator can appear in `Name`, `Category`, `WaitTime`, `URL`, `Note`,
 * `TimesUnavailable`, `Address` and `GoogleMapsLinkDirection`.
 */
export interface AhsRawFacility {
  Name: string;
  Category: string;
  /** Either `"3 hr 38 min"`, or the sentinel `"Wait times unavailable"`. */
  WaitTime: string;
  URL: string;
  /** May contain HTML entities and `<br />` tags. */
  Note: string;
  /** Stringified boolean: `"True"` / `"False"`. */
  TimesUnavailable: string;
  Address: string;
  /** Contains the only coordinates AHS gives us, as `?query=<lat>,<lng>`. */
  GoogleMapsLinkDirection: string;
  SiteId: string | null;
  /** Non-null only on split records, e.g. `"Children's emergency[;]Adult emergency"`. */
  SplitFacility: string | null;
  SiteClosingSoon: boolean;
  SiteOpen: boolean;
}

/** Per-region buckets. AHS omits `Urgent` entirely for most regions. */
export interface AhsRawRegion {
  Emergency?: AhsRawFacility[];
  Urgent?: AhsRawFacility[];
}

export type AhsRawPayload = Partial<Record<AhsRegionKey, AhsRawRegion>>;

/** How a facility's department is classified, after normalization. */
export type FacilityKind = 'emergency' | 'urgent-care' | 'pediatric-emergency';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * A facility after parsing: split records have been exploded into one entry
 * each, wait times are numeric minutes, and coordinates are real numbers.
 */
export interface NormalizedFacility {
  /** Stable, URL-safe identifier derived from the facility name. */
  slug: string;
  name: string;
  kind: FacilityKind;
  region: AhsRegionKey;
  /** Human-friendly region name, e.g. `"Edmonton"`, `"Red Deer"`. */
  regionLabel: string;
  /**
   * Estimated wait in minutes, or `null` when AHS reports the site's times as
   * unavailable. `null` is meaningfully different from `0` and must never be
   * coerced — an unknown wait is not a short wait.
   */
  waitMinutes: number | null;
  /** True when AHS explicitly flags this site's times as unavailable. */
  waitUnavailable: boolean;
  /**
   * The exact string AHS published, before parsing — e.g. `"3 hr 38 min"`.
   *
   * Retained for provenance. If a parsing assumption ever turns out to be
   * wrong, this is the only way to re-derive the truth from archived rows
   * rather than discovering the history is quietly corrupt.
   */
  rawWaitTime: string;
  /** Cleaned note: HTML entities decoded, `<br />` turned into newlines. */
  note: string;
  address: string;
  /** The town/city parsed out of the address, used for "this site is in X" hints. */
  municipality: string | null;
  coords: GeoPoint;
  /** AHS facility detail page. */
  infoUrl: string;
  /**
   * Google Maps link supplied by AHS. Coordinate-based, so it is unambiguous
   * but displays as raw numbers rather than a place name.
   */
  mapsUrl: string;
  /**
   * Turn-by-turn directions link built from the facility name and full civic
   * address, so Maps shows "Royal Alexandra Hospital" rather than
   * "53.556151,-113.496108". A person deciding whether to trust a destination
   * at 2am should not have to verify a pair of decimals.
   */
  directionsUrl: string;
  /** Present on split records, e.g. `"Children's emergency"`. */
  department: string | null;
  siteClosingSoon: boolean;
}

/** A complete, parsed snapshot of the feed at one moment in time. */
export interface WaitTimeSnapshot {
  /** ISO-8601 timestamp of when we fetched the feed. */
  fetchedAt: string;
  facilities: NormalizedFacility[];
  /**
   * Set when we are serving cached or stale data rather than a fresh upstream
   * read, so the UI can be honest about it.
   */
  stale?: boolean;
  /** Populated when the upstream fetch failed and we fell back to cache. */
  error?: string;
}
