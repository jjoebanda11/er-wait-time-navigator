import type { GeoPoint, NormalizedFacility } from './ahs/types';
import type { DriveTimeProvider, DriveTimeResult } from './geo/drive-time';
import { estimateDriveMinutes, haversineKm, parkingOverheadMinutes } from './geo/haversine';

/** Who the trip is for. Drives pediatric routing, which is a safety concern. */
export type PatientType = 'adult' | 'child';

export interface RankOptions {
  origin: GeoPoint;
  patientType?: PatientType;
  /** Restrict to one region. Omit to rank across everything we have. */
  region?: string;
  /** Include urgent care alongside emergency departments. */
  includeUrgentCare?: boolean;
  /** Drop facilities further than this many km. Omit for no limit. */
  maxDistanceKm?: number;
}

export interface RankedFacility {
  facility: NormalizedFacility;
  driveMinutes: number;
  distanceKm: number;
  parkingMinutes: number;
  /**
   * Drive + parking + posted wait. The single number this product exists to
   * produce. `null` when AHS is not publishing a wait for the site, because a
   * total built on a guessed wait would be worse than no total at all.
   */
  doorToDoctorMinutes: number | null;
  driveTimeSource: DriveTimeResult['source'];
  liveTraffic: boolean;
  /** How much sooner than the worst reasonable option this site is. */
  minutesSavedVsWorst: number | null;
  /** True for the top-ranked facility with a known wait. */
  isBest: boolean;
  /** Set when this site is recommended specifically for a child. */
  pediatricPreferred: boolean;
}

/**
 * Wait-time colour bands, matching the thresholds in the business plan.
 *
 * These are deliberately coarse. A user glancing at their phone in a parking
 * lot at 2am needs a colour, not a chart.
 */
export type WaitBand = 'green' | 'yellow' | 'orange' | 'red' | 'unknown';

export function waitBand(minutes: number | null): WaitBand {
  if (minutes == null) return 'unknown';
  if (minutes < 120) return 'green';
  if (minutes < 240) return 'yellow';
  if (minutes < 480) return 'orange';
  return 'red';
}

/** Format a minute count the way a stressed person reads fastest. */
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return 'Unavailable';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function isPediatric(facility: NormalizedFacility): boolean {
  return facility.kind === 'pediatric-emergency';
}

/**
 * Some emergency departments do not accept children, or hand them off. Routing
 * a sick child to one of those wastes the very hours this product is trying to
 * save, so we detect the exclusion from the note AHS publishes.
 */
function excludesChildren(facility: NormalizedFacility): boolean {
  return /\b(1[5-9]|2\d)\s*(and|&|\+)?\s*(older|over|and older)\b/i.test(facility.note);
}

/**
 * Rank facilities by true door-to-doctor time.
 *
 * The ordering rule is: facilities with a known wait always outrank facilities
 * without one. Within the known group we sort by total time; the unknown group
 * is sorted by drive time and shown last, clearly labelled. This prevents the
 * failure mode where a site with no published wait floats to the top and reads
 * as "no wait".
 */
export async function rankFacilities(
  facilities: NormalizedFacility[],
  provider: DriveTimeProvider,
  options: RankOptions,
): Promise<RankedFacility[]> {
  const candidates = filterCandidates(facilities, options);
  if (candidates.length === 0) return [];

  const travel = await provider.matrix(
    options.origin,
    candidates.map((f) => f.coords),
  );

  return applyRanking(candidates, travel, options);
}

/**
 * Rank without awaiting a provider, using the built-in distance estimator.
 *
 * Exists for the care-provider dashboard, which ranks every roster location on
 * every render. Doing that work in an effect would mean a setState per render
 * pass, which is the precise shape of the render loop that previously locked
 * the consumer board's main thread. Pure synchronous computation during render
 * cannot loop, so the dashboard uses this instead.
 *
 * Ordering logic is shared with the async path below, so the two can never
 * disagree about which facility is best.
 */
export function rankFacilitiesSync(
  facilities: NormalizedFacility[],
  options: RankOptions,
): RankedFacility[] {
  const candidates = filterCandidates(facilities, options);
  if (candidates.length === 0) return [];

  const travel: DriveTimeResult[] = candidates.map((f) => ({
    minutes: estimateDriveMinutes(options.origin, f.coords),
    distanceKm: haversineKm(options.origin, f.coords),
    source: 'estimate' as const,
    liveTraffic: false,
  }));

  return applyRanking(candidates, travel, options);
}

function filterCandidates(
  facilities: NormalizedFacility[],
  options: RankOptions,
): NormalizedFacility[] {
  const { patientType = 'adult', region, includeUrgentCare = true } = options;

  return facilities.filter((f) => {
    if (region && f.region !== region) return false;
    if (!includeUrgentCare && f.kind === 'urgent-care') return false;
    if (patientType === 'child' && excludesChildren(f)) return false;
    return true;
  });
}

function applyRanking(
  candidates: NormalizedFacility[],
  travel: DriveTimeResult[],
  options: RankOptions,
): RankedFacility[] {
  const { patientType = 'adult' } = options;

  let ranked: RankedFacility[] = candidates.map((facility, i) => {
    const trip = travel[i];
    const parkingMinutes = parkingOverheadMinutes(facility.name);
    const doorToDoctorMinutes =
      facility.waitMinutes == null
        ? null
        : trip.minutes + parkingMinutes + facility.waitMinutes;

    return {
      facility,
      driveMinutes: trip.minutes,
      distanceKm: trip.distanceKm,
      parkingMinutes,
      doorToDoctorMinutes,
      driveTimeSource: trip.source,
      liveTraffic: trip.liveTraffic,
      minutesSavedVsWorst: null,
      isBest: false,
      pediatricPreferred: patientType === 'child' && isPediatric(facility),
    };
  });

  if (options.maxDistanceKm != null) {
    const limited = ranked.filter((r) => r.distanceKm <= options.maxDistanceKm!);
    // Never return an empty board because of a radius filter — a user in a
    // rural area still needs to see their nearest option.
    if (limited.length > 0) ranked = limited;
  }

  ranked.sort((a, b) => {
    const aKnown = a.doorToDoctorMinutes != null;
    const bKnown = b.doorToDoctorMinutes != null;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;

    if (aKnown && bKnown) {
      // For a child, a pediatric ER wins ties within a 20-minute band. Beyond
      // that the time difference genuinely matters more than the specialty.
      if (a.pediatricPreferred !== b.pediatricPreferred) {
        const gap = Math.abs(a.doorToDoctorMinutes! - b.doorToDoctorMinutes!);
        if (gap <= 20) return a.pediatricPreferred ? -1 : 1;
      }
      return a.doorToDoctorMinutes! - b.doorToDoctorMinutes!;
    }

    return a.driveMinutes - b.driveMinutes;
  });

  const known = ranked.filter((r) => r.doorToDoctorMinutes != null);
  if (known.length > 0) {
    known[0].isBest = true;

    // Compare against the median of the slower half rather than the single
    // worst site. "You saved 6 hours vs. driving to the worst ER in the
    // province" is technically true and useless; the realistic counterfactual
    // is a typical nearby choice.
    const totals = known.map((r) => r.doorToDoctorMinutes!).sort((a, b) => a - b);
    const baseline = totals[Math.floor(totals.length / 2)];
    for (const entry of known) {
      const saved = baseline - entry.doorToDoctorMinutes!;
      entry.minutesSavedVsWorst = saved > 0 ? saved : null;
    }
  }

  return ranked;
}
