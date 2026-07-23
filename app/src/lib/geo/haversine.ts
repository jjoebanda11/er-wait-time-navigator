import type { GeoPoint } from '../ahs/types';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Detour factor converting straight-line distance into road distance.
 *
 * Edmonton and Calgary are grid cities with river valleys and ring roads. An
 * empirical circuity factor of ~1.35 is a standard planning figure for North
 * American grid networks and matches spot checks against real routes here.
 */
export const ROAD_CIRCUITY_FACTOR = 1.35;

/**
 * Estimate driving minutes from straight-line distance alone.
 *
 * This is the zero-cost, zero-dependency fallback used when no routing API key
 * is configured — which is the default, and is what lets the product launch
 * without a billing account anywhere.
 *
 * Speeds are deliberately conservative and distance-tiered: short trips are
 * dominated by city streets and lights, long trips by highway. We then add a
 * fixed overhead for parking and walking from the lot to triage, because the
 * number the user actually cares about is when a clinician sees them, not when
 * their tires stop moving.
 */
export function estimateDriveMinutes(from: GeoPoint, to: GeoPoint): number {
  const roadKm = haversineKm(from, to) * ROAD_CIRCUITY_FACTOR;

  // Average effective speed in km/h, including stops.
  let speedKmh: number;
  if (roadKm < 3) speedKmh = 26;
  else if (roadKm < 10) speedKmh = 38;
  else if (roadKm < 25) speedKmh = 52;
  else speedKmh = 72;

  return (roadKm / speedKmh) * 60;
}

/**
 * Minutes to add for parking, walking in, and reaching the triage desk.
 *
 * Large tertiary sites have paid parkades and long internal walks; community
 * sites have surface lots at the door. Treating these as equal understates the
 * true cost of the big hospitals, which is precisely the bias this product
 * exists to correct.
 */
export function parkingOverheadMinutes(facilityName: string): number {
  const name = facilityName.toLowerCase();
  const majorSites = [
    'university of alberta',
    'stollery',
    'royal alexandra',
    'foothills',
    'peter lougheed',
    'rockyview',
    'alberta children',
    'south health campus',
  ];
  if (majorSites.some((site) => name.includes(site))) return 12;
  if (name.includes('misericordia') || name.includes('grey nuns')) return 8;
  return 5;
}
