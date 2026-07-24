import type { AhsRegionKey, GeoPoint } from '../ahs/types';

/**
 * Approximate centre of each AHS region.
 *
 * Used to bias address geocoding toward the right city. Edmonton's 104 Avenue
 * runs most of the way across the city, so an un-biased geocoder happily
 * returns a point kilometres from the one intended; biasing by the region
 * centroid pins results to the correct area and stops a cross-street mismatch
 * from silently flipping the ranking.
 */
export const REGION_CENTROIDS: Record<AhsRegionKey, GeoPoint> = {
  Edmonton: { lat: 53.5461, lng: -113.4938 },
  Calgary: { lat: 51.0447, lng: -114.0719 },
  RedDeer: { lat: 52.2681, lng: -113.8112 },
  Lethbridge: { lat: 49.6935, lng: -112.8418 },
  MedicineHat: { lat: 50.0405, lng: -110.6764 },
  GrandePrairie: { lat: 55.1707, lng: -118.7947 },
  FortMcMurray: { lat: 56.7268, lng: -111.381 },
};

export function centroidFor(region: string): GeoPoint {
  return REGION_CENTROIDS[region as AhsRegionKey] ?? REGION_CENTROIDS.Edmonton;
}
