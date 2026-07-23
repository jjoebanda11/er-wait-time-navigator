import {
  AHS_REGION_KEYS,
  type AhsRawFacility,
  type AhsRawPayload,
  type AhsRegionKey,
  type FacilityKind,
  type GeoPoint,
  type NormalizedFacility,
} from './types';

/** AHS joins the two halves of a split-facility record with this literal. */
const SPLIT = '[;]';

/** Human-readable labels for the upstream region keys. */
export const REGION_LABELS: Record<AhsRegionKey, string> = {
  Edmonton: 'Edmonton',
  Calgary: 'Calgary',
  RedDeer: 'Red Deer',
  Lethbridge: 'Lethbridge',
  MedicineHat: 'Medicine Hat',
  GrandePrairie: 'Grande Prairie',
  FortMcMurray: 'Fort McMurray',
};

/** URL slugs for region landing pages. */
export const REGION_SLUGS: Record<AhsRegionKey, string> = {
  Edmonton: 'edmonton',
  Calgary: 'calgary',
  RedDeer: 'red-deer',
  Lethbridge: 'lethbridge',
  MedicineHat: 'medicine-hat',
  GrandePrairie: 'grande-prairie',
  FortMcMurray: 'fort-mcmurray',
};

export function regionFromSlug(slug: string): AhsRegionKey | null {
  const entry = Object.entries(REGION_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as AhsRegionKey) : null;
}

/**
 * Split a possibly-compound upstream field into its parts.
 *
 * Returns a single-element array for ordinary records, so callers can treat
 * split and non-split records identically.
 */
export function splitField(value: string | null | undefined): string[] {
  if (value == null) return [];
  return value.includes(SPLIT) ? value.split(SPLIT) : [value];
}

/**
 * Parse an AHS wait string into minutes.
 *
 * Accepts `"3 hr 38 min"`, `"4 hr 0 min"`, and tolerates a bare `"45 min"` or
 * `"2 hr"` in case AHS ever shortens the format. Returns `null` for the
 * `"Wait times unavailable"` sentinel or anything unrecognized — an unparseable
 * wait must never silently become zero.
 */
export function parseWaitMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/unavailable/i.test(text)) return null;

  const hours = text.match(/(\d+)\s*hr/i);
  const mins = text.match(/(\d+)\s*min/i);
  if (!hours && !mins) return null;

  const total =
    (hours ? Number.parseInt(hours[1], 10) * 60 : 0) +
    (mins ? Number.parseInt(mins[1], 10) : 0);

  return Number.isFinite(total) ? total : null;
}

/**
 * Pull coordinates out of the Google Maps link, which is the only place AHS
 * exposes them. Saves us an entire geocoding dependency.
 */
export function parseCoords(mapsUrl: string | null | undefined): GeoPoint | null {
  if (!mapsUrl) return null;
  const match = mapsUrl.match(/query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Alberta sits roughly within these bounds; reject anything outside so a
  // malformed upstream link can't drop a facility into the ocean.
  if (lat < 48 || lat > 61 || lng < -121 || lng > -109) return null;

  return { lat, lng };
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Decode the HTML entities and `<br />` tags AHS embeds in note text. */
export function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Collapse the newlines AHS embeds in some address strings. */
export function cleanAddress(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Tokens that mark the end of the street portion of an address.
 *
 * Scanning backwards from the province name, the first of these we hit means
 * everything after it is the municipality. Without this, capitalized street
 * types leak into the place name and "Strathcona Community Hospital" reports
 * its location as "Drive Sherwood Park".
 */
const STREET_STOP_WORDS = new Set([
  // Street types.
  'street', 'st', 'avenue', 'ave', 'drive', 'dr', 'road', 'rd', 'boulevard',
  'blvd', 'trail', 'tr', 'way', 'common', 'commons', 'plaza', 'crescent',
  'cres', 'close', 'court', 'crt', 'lane', 'place', 'pl', 'gate', 'terrace',
  'link', 'loop', 'point', 'bay', 'square', 'parkway', 'highway', 'hwy',
  'circle', 'green', 'grove', 'ridge', 'view', 'landing', 'row', 'mews',
  // Quadrant and directional suffixes, which follow the street name here.
  'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w', 'north', 'south', 'east', 'west',
  // Unit designators.
  'suite', 'unit', 'floor',
]);

/**
 * Abbreviations that begin a place name rather than end a street.
 *
 * "St." is ambiguous: it means Street at the end of an address and Saint at the
 * start of a municipality. Matched with the period intact and only accepted
 * once at least one place word has been collected, which disambiguates
 * "201 Boudreau Road St. Albert" — Road stops the street, St. joins Albert.
 */
const PLACE_PREFIX_ABBREVIATIONS = new Set(['st.', 'ste.', 'mt.', 'ft.']);

/**
 * Extract the municipality from an AHS address.
 *
 * Addresses end with `... <Municipality> Alberta <PostalCode>`, so we anchor on
 * the province name and walk backwards until we hit a street-type token or a
 * number. This is what lets us tell a user that "Strathcona Community Hospital"
 * is actually in Sherwood Park, and that "Fort Sask Community Hospital" means a
 * drive out to Fort Saskatchewan.
 */
export function parseMunicipality(address: string): string | null {
  const match = cleanAddress(address).match(/^(.*?)\s+Alberta\b/);
  if (!match) return null;

  const words = match[1].trim().split(/\s+/);
  const place: string[] = [];

  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i];
    if (/\d/.test(word)) break;
    if (!/^[A-Z]/.test(word)) break;

    const lower = word.toLowerCase();
    if (place.length > 0 && PLACE_PREFIX_ABBREVIATIONS.has(lower)) {
      place.unshift(word);
      continue;
    }
    if (STREET_STOP_WORDS.has(lower.replace(/\.$/, ''))) break;

    place.unshift(word);
    if (place.length >= 4) break;
  }

  return place.length > 0 ? place.join(' ') : null;
}

/**
 * Build a Google Maps directions URL that displays the facility by name.
 *
 * AHS supplies only a coordinate search link, which renders as a bare lat/lng
 * pair — accurate, but it gives a user no way to confirm they are being sent to
 * the right hospital. Using the name plus the full civic address resolves
 * reliably for named hospitals and shows something a person can actually
 * verify. The coordinate link is kept alongside it for anyone who wants the
 * exact pin.
 */
export function buildDirectionsUrl(name: string, address: string): string {
  const destination = address ? `${name}, ${address}` : name;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Classify a department. Pediatric sites are separated out because routing a
 * child to an adult ER (or vice versa) is a real failure mode, not a nuance.
 */
function classify(name: string, category: string, department: string | null): FacilityKind {
  const haystack = `${name} ${department ?? ''}`.toLowerCase();
  if (/children|pediatric|paediatric|stollery/.test(haystack)) {
    return 'pediatric-emergency';
  }
  if (/urgent/i.test(category)) return 'urgent-care';
  return 'emergency';
}

/**
 * Expand one raw AHS record into one or more normalized facilities.
 *
 * Split records become two entries; ordinary records become one. Records we
 * cannot place on a map are dropped, because a facility without coordinates
 * cannot participate in distance ranking and would silently rank last.
 */
export function normalizeFacility(
  raw: AhsRawFacility,
  region: AhsRegionKey,
): NormalizedFacility[] {
  const names = splitField(raw.Name);
  const categories = splitField(raw.Category);
  const waits = splitField(raw.WaitTime);
  const urls = splitField(raw.URL);
  const notes = splitField(raw.Note);
  const unavailable = splitField(raw.TimesUnavailable);
  const addresses = splitField(raw.Address);
  const maps = splitField(raw.GoogleMapsLinkDirection);
  const departments = splitField(raw.SplitFacility);

  const count = Math.max(names.length, waits.length, 1);
  const results: NormalizedFacility[] = [];

  for (let i = 0; i < count; i += 1) {
    // Split records repeat shared values in every position, but defensively
    // fall back to index 0 for any field AHS did not split.
    const at = <T,>(arr: T[]): T | undefined => arr[i] ?? arr[0];

    const name = (at(names) ?? '').trim();
    if (!name) continue;

    const mapsUrl = at(maps) ?? '';
    const coords = parseCoords(mapsUrl);
    if (!coords) continue;

    const department = departments.length > 0 ? (at(departments) ?? null) : null;
    const category = at(categories) ?? 'Emergency';
    const address = cleanAddress(at(addresses));

    const flaggedUnavailable = /true/i.test(at(unavailable) ?? 'False');
    const waitMinutes = parseWaitMinutes(at(waits));

    // Treat an explicit AHS flag and an unparseable time as the same condition:
    // we do not know this wait, and must not present a number.
    const waitUnavailable = flaggedUnavailable || waitMinutes === null;

    results.push({
      slug: slugify(department ? `${name}-${department}` : name),
      name,
      kind: classify(name, category, department),
      region,
      regionLabel: REGION_LABELS[region],
      waitMinutes: waitUnavailable ? null : waitMinutes,
      waitUnavailable,
      rawWaitTime: (at(waits) ?? '').trim(),
      note: cleanText(at(notes)),
      address,
      municipality: parseMunicipality(address),
      coords,
      infoUrl: at(urls) ?? '',
      mapsUrl,
      directionsUrl: buildDirectionsUrl(name, address),
      department: department?.trim() || null,
      siteClosingSoon: Boolean(raw.SiteClosingSoon),
    });
  }

  return results;
}

/** Normalize a full upstream payload into a flat, sorted facility list. */
export function normalizePayload(payload: AhsRawPayload): NormalizedFacility[] {
  const facilities: NormalizedFacility[] = [];

  for (const region of AHS_REGION_KEYS) {
    const bucket = payload[region];
    if (!bucket) continue;

    for (const list of [bucket.Emergency, bucket.Urgent]) {
      for (const raw of list ?? []) {
        facilities.push(...normalizeFacility(raw, region));
      }
    }
  }

  // Deduplicate on slug: distinct regions should never collide, but a rename
  // upstream could produce two records for one site, and a duplicate would
  // render twice in the board.
  const seen = new Set<string>();
  return facilities
    .filter((f) => {
      const key = `${f.region}:${f.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
